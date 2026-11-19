// 主入口：60Hz 固定步长 + 标题/游戏/暂停/结算 + 教程引导 + SDK 统一出口。
// 玩法：霓虹光点无人机（flappy one-tap 1:1 还原 + 光珠/护盾/擦边连击/速度阶梯/星级）。
// 契约见 README.md。装配：sim(M1) / render+ui(M2) / audio(M4)。
import { STEP, WORLD, BIRD, LEVELS, STARS } from '../config/game.config.js';
import { createRun } from './game/sim.js';
import { createRenderer } from './render/index.js';
import { createAudio } from './core/audio.js';
import { ui } from './ui/ui.js';
import { i18n, t, syncDocumentLang } from './core/i18n.js';
import Sdk from './core/sdk.js';

const $ = (id) => document.getElementById(id);
const renderer = createRenderer(ui.canvas);
const audio = createAudio();

let run = null;
let phase = 'title';          // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let muted = !!Sdk.load('muted', false);
let best = Sdk.load('best', 0) | 0;
let tutorialDone = !!Sdk.load('tutorialDone', false);
let tutorialStep = -1;        // -1 = 未激活

const view = { shake: 0, particles: [], pops: [], flash: 0 };

Sdk.ready(); // 不 await，不阻塞首屏
audio.setMuted(muted);
ui.setMuted(muted);

function persist() {
  Sdk.save('muted', muted);
  Sdk.save('best', best);
  Sdk.save('tutorialDone', tutorialDone);
}

// ---------- 阶段状态机 ----------
function resetRun(seed) {
  run = createRun({ seed: seed | 0 || (Date.now() % 2147483647) || 1, best });
  view.shake = 0;
  view.particles = [];
  view.pops = [];
  view.flash = 0;
}

function startGame() {
  resetRun(Date.now() % 2147483647);
  run.start();
  setPhase('playing');
  ui.showGame();
  ui.hideResult();
  updateHud();
  audio.startBgm();
  Sdk.newRun({ game: 'flap-reborn' });
  if (!tutorialDone) startTutorial();
}

function setPhase(p) { phase = p; }

function pauseGame() {
  if (phase !== 'playing') return;
  setPhase('paused');
  audio.stopBgm();
  ui.showPause();
}

function resumeGame() {
  if (phase !== 'paused') return;
  setPhase('playing');
  ui.hidePause();
  audio.startBgm();
  lastTime = performance.now();
}

function goHome() {
  setPhase('title');
  ui.showTitle();
  ui.hideResult();
  audio.stopBgm();
  resetRun(Date.now() % 2147483647);
  updateBestHud();
}

function retry() {
  startGame();
}

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  ui.setMuted(muted);
  persist();
}

// ---------- HUD / 结算 ----------
function updateBestHud() {
  ui.titleBest.textContent = `★ ${t('best')} ${best}`;
}

function updateHud() {
  if (!run) return;
  const st = run.state;
  ui.hudScore.textContent = String(st.score);
  ui.hudBest.textContent = `${t('best')} ${Math.max(best, st.score)}`;
  ui.hudSector.textContent = `${t('sector')} ${st.level}`;
  ui.hudShield.classList.toggle('off', st.shield <= 0);
  if (st.combo > 1) {
    ui.hudCombo.textContent = `×${st.combo}`;
    ui.hudCombo.classList.remove('hidden');
  } else {
    ui.hudCombo.classList.add('hidden');
  }
}

function reasonText(reason) {
  return t(reason === 'ground' ? 'reasonGround' : reason === 'ceiling' ? 'reasonCeiling' : 'reasonPipe');
}

function finishRun(ev) {
  if (phase === 'result') return;
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  const st = run.state;
  const score = st.score;
  const newBest = score > best;
  if (newBest) { best = score; }
  persist();
  Sdk.gameOver({ score, stars: st.stars, sector: st.level, reason: st.reason });

  ui.resultTitle.textContent = t('result');
  ui.resultTitle.classList.toggle('lose', true);
  ui.resultStars.innerHTML =
    `<span>${'★'.repeat(st.stars)}</span><span class="off">${'☆'.repeat(Math.max(0, 3 - st.stars))}</span>`;
  ui.resultScore.textContent = String(score);
  ui.resultBest.textContent = `${t('resultBest')} ${best}`;
  ui.resultNewbest.classList.toggle('hidden', !newBest);
  if (newBest) ui.resultNewbest.textContent = t('resultNewBest');
  ui.resultReason.textContent = reasonText(st.reason);
  ui.showResult();
  audio.event('lose', ev);
}

// ---------- 教程（首次自动弹，可跳过，完成/跳过后持久化；标题可重看） ----------
const TUT_STEPS = () => [t('tutStep1'), t('tutStep2'), t('tutStep3')];

function startTutorial() {
  tutorialStep = 0;
  renderTutorialStep();
}

function renderTutorialStep() {
  if (tutorialStep < 0) { ui.tutorial.classList.add('hidden'); return; }
  const steps = TUT_STEPS();
  ui.tutorial.classList.remove('hidden');
  ui.tutTitle.textContent = t('tutTitle');
  ui.tutText.textContent = steps[tutorialStep] || '';
  ui.tutSkip.textContent = t('tutSkip');
  ui.tutNext.textContent = t('tutNext');
  const dots = steps.map((_, i) => (i === tutorialStep ? '●' : '○')).join(' ');
  const dotsEl = ui.tutCard.querySelector('.steps-dots');
  if (!dotsEl) {
    const d = document.createElement('div');
    d.className = 'steps-dots';
    d.textContent = dots;
    ui.tutCard.insertBefore(d, ui.tutCard.firstChild);
  } else {
    dotsEl.textContent = dots;
  }
}

function tutorialNext() {
  tutorialStep += 1;
  if (tutorialStep >= TUT_STEPS().length) endTutorial();
  else renderTutorialStep();
}

function endTutorial() {
  tutorialStep = -1;
  tutorialDone = true;
  persist();
  renderTutorialStep();
}

// ---------- 事件消费 ----------
function spawnParticles(x, y, color, n, speed = 160) {
  for (let i = 0; i < n; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.4 + Math.random() * 0.9);
    view.particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      ttl: 0.5 + Math.random() * 0.4, maxTtl: 0.9, size: 2 + Math.random() * 3,
      color,
    });
  }
  if (view.particles.length > 260) view.particles.splice(0, view.particles.length - 260);
}

function addPop(x, y, text, color, size = 22) {
  view.pops.push({ x, y, text, color, ttl: 0.9, maxTtl: 0.9, size });
  if (view.pops.length > 12) view.pops.shift();
}

function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    switch (ev.type) {
      case 'flap':
        spawnParticles(run.state.bird.x, run.state.bird.y + BIRD.R, '#29e6ff', 4, 120);
        break;
      case 'score':
        addPop(run.state.bird.x + 60, run.state.bird.y - 30, `+${ev.combo || 1}`, '#29e6ff');
        break;
      case 'nearMiss':
        addPop(run.state.bird.x + 60, run.state.bird.y - 30, `NEAR ×${ev.combo}`, '#8f6bff', 24);
        view.shake = 2;
        break;
      case 'orb':
        spawnParticles(run.state.bird.x, run.state.bird.y, '#ffd166', 10, 200);
        addPop(run.state.bird.x + 60, run.state.bird.y - 30, `+${ev.score ? 2 : 2}`, '#ffd166');
        break;
      case 'shieldGain':
        addPop(run.state.bird.x, run.state.bird.y - 40, t('shield'), '#ffd166', 18);
        break;
      case 'shieldBreak':
        view.flash = 0.5;
        view.shake = 6;
        spawnParticles(run.state.bird.x, run.state.bird.y, '#ffd166', 16, 240);
        break;
      case 'levelUp':
        view.flash = 0.35;
        addPop(run.state.bird.x, run.state.bird.y - 50, `${t('sector')} ${ev.level}`, '#ff3ec8', 26);
        break;
      case 'lose':
        spawnParticles(run.state.bird.x, run.state.bird.y, '#ff4d6d', 22, 260);
        finishRun(ev);
        return;
      default:
        break;
    }
  }
}

// ---------- 输入 ----------
function flap() {
  audio.unlock();
  if (phase !== 'playing' || !run || run.state.phase !== 'playing' || tutorialStep >= 0) return;
  run.flap();
}

ui.canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  flap();
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
    if (phase === 'playing') { e.preventDefault(); flap(); }
    else if (phase === 'result') { e.preventDefault(); retry(); }
    else if (phase === 'title') { e.preventDefault(); startGame(); }
  } else if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  } else if (e.code === 'KeyR') {
    if (phase === 'playing' || phase === 'paused' || phase === 'result') retry();
  } else if (e.code === 'KeyM') {
    toggleMute();
  }
});

// ---------- UI 绑定 ----------
function bind() {
  const on = (id, fn) => {
    const el = $(id);
    if (el) el.addEventListener('click', () => { audio.unlock(); fn(); });
  };
  on('btn-start', startGame);
  on('btn-resume', resumeGame);
  on('btn-restart', goHome);
  on('btn-restart2', goHome);
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-retry', retry);
  on('btn-mute', toggleMute);
  on('btn-howto', () => startTutorial());
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);
  on('btn-rotate-skip', () => { ui.rotateScreen.style.display = 'none'; });

  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = $(id);
    if (!sel) continue;
    sel.addEventListener('change', () => {
      ui.setLang(sel.value);
      updateBestHud();
      if (tutorialStep >= 0) renderTutorialStep();
      if (run) updateHud();
    });
  }
}

// ---------- 主循环 ----------
function frame(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;

  if (phase === 'playing' && run && run.state.phase === 'playing' && tutorialStep < 0) {
    accumulator += dt;
    while (accumulator >= STEP) {
      run.step(STEP);
      accumulator -= STEP;
    }
    handleEvents(run.drainEvents());
    if (run && phase === 'playing') updateHud();
  }

  if (view.shake > 0) view.shake = Math.max(0, view.shake - dt * 22);
  if (view.flash > 0) view.flash = Math.max(0, view.flash - dt * 1.6);
  for (const p of view.particles) { p.ttl -= dt; }
  view.particles = view.particles.filter((p) => p.ttl > 0);
  for (const p of view.pops) { p.ttl -= dt; }
  view.pops = view.pops.filter((p) => p.ttl > 0);

  try {
    renderer.draw(run ? run.state : null, dt, view);
  } catch (err) {
    console.warn('render error', err);
  }

  requestAnimationFrame(frame);
}

// ---------- 调试契约（截图/验收脚本通用） ----------
window.__ll = {
  state: {
    get phase() { return phase; },
    get lang() { return i18n.lang; },
    get dir() { return i18n.dir; },
  },
  run: () => run,
  start: () => startGame(),
  startAct: () => startGame(),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => goHome(),
  home: () => goHome(),
  sim: () => (run ? run.state : null),
  save: () => Sdk,
  ui: () => ui,
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['flap', 'score', 'orb']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  debug: {
    state: () => (run ? run.state : null),
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    tutorialStep: () => tutorialStep,
    crash: () => {
      if (!run) return false;
      if (run.state.phase === 'ready') { run.start(); }
      run.state.bird.y = WORLD.GROUND_Y - BIRD.R + 2;
      run.step(STEP);
      handleEvents(run.drainEvents());
      return true;
    },
  },
};

window.G = {
  run: () => run,
  phase: () => phase,
  ui,
  Sdk,
  audio,
};

// ---------- 启动 ----------
bind();
syncDocumentLang();
ui.applyLang();
ui.rotateText.textContent = t('rotateHint');
ui.btnRotateSkip.textContent = t('rotateSkip');
resetRun(Date.now() % 2147483647);
updateBestHud();
Sdk.track('load', {});
requestAnimationFrame(frame);
