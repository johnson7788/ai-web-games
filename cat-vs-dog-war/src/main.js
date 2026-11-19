// 主入口：60Hz 固定步长 + 标题→游戏→暂停→结算 + 教程引导 + SDK 统一出口
import { STEP, WORLD, LAYOUT, GAME, MONSTER_TYPES, ROCK } from '../config/game.config.js';
import { createRun, starRating } from './game/sim.js';
import { createRenderer } from './render/index.js';
import { createAudio } from './core/audio.js';
import { ui } from './ui/ui.js';
import { i18n, t, syncDocumentLang } from './core/i18n.js';
import Sdk from './core/sdk.js';

const $ = (id) => document.getElementById(id);
const canvas = $('canvas');
const renderer = createRenderer(canvas);
const audio = createAudio();

let run = null;
let phase = 'title';           // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let fpsSamples = [];
let tutorialStep = -1;         // -1 = 未激活

const view = {
  fxQueue: [],                 // {type, x, y, ttl, max, ...}
  shake: 0,
  flash: 0,                    // 点石头红闪
};

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let best = Sdk.load('best', 0) | 0;
let tutorialDone = !!Sdk.load('tutorialDone', false);

Sdk.ready(); // 不 await，不阻塞首屏
audio.setMuted(muted);
ui.setMuted(muted);

function persist() {
  Sdk.save('muted', muted);
  Sdk.save('best', best);
  Sdk.save('tutorialDone', tutorialDone);
}

// ---------- 阶段状态机 ----------
function setPhase(p) { phase = p; }

function startGame() {
  run = createRun((Date.now() % 2147483647) || 1);
  setPhase('playing');
  ui.showGame();
  ui.hideResult();
  view.fxQueue = [];
  view.shake = 0;
  view.flash = 0;
  updateHud();
  audio.startBgm();
  Sdk.newRun({ game: 'cat-vs-dog-war' });
  if (!tutorialDone) startTutorial();
}

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
}

function restartGame() {
  startGame();
}

function goHome() {
  run = null;
  setPhase('title');
  ui.hideResult();
  ui.showTitle();
  audio.stopBgm();
}

// ---------- HUD / 结算 ----------
function updateHud() {
  if (!run) return;
  const h = run.getHud();
  const secs = Math.max(0, Math.ceil(h.timeLeft));
  ui.hudTime.textContent = `${t('time')} ${secs}s`;
  ui.hudTime.classList.toggle('time-low', secs <= 5);
  ui.hudScore.textContent = `${t('score')} ${h.score}`;
  ui.hudTarget.textContent = `${t('target')} ${h.target}`;
  ui.hudStage.textContent = `${t('stage')} ${h.stage}/${h.stageCount}`;
  ui.hudCombo.textContent = h.combo >= 2 ? `×${h.combo}` : t('combo');
  ui.hudCombo.classList.toggle('off', h.combo < 2);
  ui.hudHearts.textContent = '❤️'.repeat(h.hearts) + '🖤'.repeat(Math.max(0, GAME.HEARTS - h.hearts));
  ui.hudBest.textContent = `${t('best')} ${best}`;
}

function showResult(res) {
  const { won, stars, score, reason } = res;
  ui.resultTitle.textContent = won ? t('winTitle') : t('loseTitle');
  ui.resultTitle.classList.toggle('lose', !won);
  ui.resultStars.innerHTML = won
    ? `<span class="stars">${'<span class="star star-on">★</span>'.repeat(stars)}${'<span class="star">☆</span>'.repeat(3 - stars)}</span>`
    : '';
  ui.resultScore.textContent = `${t('resultScore')}: ${score}`;
  ui.resultBest.textContent = `${t('resultBest')}: ${Math.max(best, score)}`;
  const isNewBest = won && score > best && best > 0;
  ui.resultNewbest.classList.toggle('hidden', !(won && score > best));
  if (score > best && won) ui.resultNewbest.textContent = t('newBest');
  ui.resultReason.textContent = won ? '' : (reason === 'noHearts' ? t('reasonHearts') : t('reasonTime'));
  ui.resultReason.classList.toggle('hidden', won);
  ui.hud.classList.add('hidden');
  ui.showResult();
}

function finishRun(ev) {
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  const st = run.state;
  const won = ev.type === 'win';
  const stars = won ? starRating(st.score) : 0;
  if (won && st.score > best) best = st.score;
  persist();
  audio.event(won ? 'win' : 'lose', ev);
  showResult({ won, stars, score: st.score, reason: st.reason });
}

// ---------- 教程（首次自动弹，可跳过，可重看，持久化） ----------
const TUT_STEPS = () => [
  { text: t('tutStep1') },
  { text: t('tutStep2') },
  { text: t('tutStep3') },
];

function startTutorial() {
  tutorialStep = 0;
  renderTutorialStep();
}

function renderTutorialStep() {
  const el = $('tutorial');
  if (tutorialStep < 0) { el.classList.add('hidden'); return; }
  const steps = TUT_STEPS();
  const s = steps[tutorialStep];
  el.classList.remove('hidden');
  ui.tutTitle.textContent = t('tutTitle');
  ui.tutText.textContent = s ? s.text : '';
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

function tutorialAdvance(evType) {
  // 第一次真实击杀推进第一步，其余用「知道了」推进
  if (tutorialStep === 0 && evType === 'kill') {
    tutorialStep += 1;
    if (tutorialStep >= TUT_STEPS().length) endTutorial();
    else renderTutorialStep();
  }
}

// ---------- 事件消费 ----------
function fxPop(holeIndex, color) {
  const h = LAYOUT.holes[holeIndex];
  view.fxQueue.push({ type: 'pop', x: h.x, y: h.y - 40, ttl: 0.4, max: 0.4, color, seed: Math.random() * TAU2 });
}

function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    tutorialAdvance(ev.type);
    switch (ev.type) {
      case 'kill': {
        const def = MONSTER_TYPES[ev.kind] || MONSTER_TYPES.cat;
        fxPop(ev.hole, def.color);
        view.fxQueue.push({ type: 'scoreFloat', x: LAYOUT.holes[ev.hole].x, y: LAYOUT.holes[ev.hole].y - 110, ttl: 0.7, max: 0.7, text: `+${ev.gained}`, color: '#fff' });
        break;
      }
      case 'hit':
        view.fxQueue.push({ type: 'ring', x: LAYOUT.holes[ev.hole].x, y: LAYOUT.holes[ev.hole].y - 60, ttl: 0.25, max: 0.25 });
        break;
      case 'rockHit':
        view.shake = 6;
        view.flash = 0.3;
        fxPop(ev.hole, ROCK.color);
        break;
      case 'escape':
        view.fxQueue.push({ type: 'scoreFloat', x: LAYOUT.holes[ev.hole].x, y: LAYOUT.holes[ev.hole].y - 100, ttl: 0.6, max: 0.6, text: '✗', color: '#ff7a7a' });
        break;
      case 'stageUp':
        view.fxQueue.push({ type: 'scoreFloat', x: WORLD.WIDTH / 2, y: 160, ttl: 1.1, max: 1.1, text: `${t('stage')} ${ev.stage}`, color: '#FFE95C' });
        break;
      case 'win':
      case 'lose':
        finishRun(ev);
        return;
      default:
        break;
    }
  }
}

const TAU2 = Math.PI * 2;

// ---------- 输入 ----------
function canvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (WORLD.WIDTH / rect.width),
    y: (e.clientY - rect.top) * (WORLD.HEIGHT / rect.height),
  };
}

function pickHole(p) {
  let bestI = -1;
  let bestD = Infinity;
  for (let i = 0; i < LAYOUT.holes.length; i += 1) {
    const h = LAYOUT.holes[i];
    const dx = p.x - h.x;
    const dy = p.y - (h.y - 30);
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; bestI = i; }
  }
  const maxR = LAYOUT.HOLE_R * 1.7;
  return bestD <= maxR * maxR ? bestI : -1;
}

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (!run || phase !== 'playing') return;
  const p = canvasPos(e);
  const i = pickHole(p);
  if (i < 0) return;
  const res = run.tapHole(i);
  if (res.miss) {
    view.fxQueue.push({ type: 'ring', x: LAYOUT.holes[i].x, y: LAYOUT.holes[i].y - 40, ttl: 0.2, max: 0.2 });
  }
  updateHud();
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
  if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'result')) restartGame();
  if (e.code === 'KeyM') toggleMute();
});

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  ui.setMuted(muted);
  persist();
}

// ---------- UI 绑定 ----------
function bind() {
  const on = (id, fn) => {
    const el = $(id);
    if (el) el.addEventListener('click', () => { audio.unlock(); fn(); });
  };
  on('btn-start', startGame);
  on('btn-resume', resumeGame);
  on('pause-restart', restartGame);
  on('hud-restart', restartGame);
  on('pause-home', goHome);
  on('hud-home', goHome);
  on('btn-retry', restartGame);
  on('btn-home2', goHome);
  on('hud-mute', toggleMute);
  on('title-mute', toggleMute);
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);
  on('hud-howto', () => { if (phase === 'playing' || phase === 'result') startTutorial(); });
  on('title-howto', () => startTutorial());
  on('pause-howto', () => { resumeGame(); startTutorial(); });

  $('btn-rotate-skip')?.addEventListener('click', () => {
    const rs = $('rotate-screen');
    if (rs) rs.style.display = 'none';
  });

  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = $(id);
    if (!sel) continue;
    sel.addEventListener('change', () => {
      ui.setLang(sel.value);
      renderTutorialStep();
      if (run) updateHud();
    });
  }
}

// ---------- 主循环 ----------
function frame(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;

  if (phase === 'playing' && run) {
    accumulator += dt;
    while (accumulator >= STEP) {
      run.step(STEP);
      accumulator -= STEP;
    }
    handleEvents(run.drainEvents());
    if (run && phase === 'playing') updateHud();
  }

  if (view.shake > 0) view.shake = Math.max(0, view.shake - dt * 20);
  if (view.flash > 0) view.flash = Math.max(0, view.flash - dt);
  for (const fx of view.fxQueue) if (fx.ttl > 0) fx.ttl -= dt;

  try {
    renderer.draw(run ? run.state : null, dt, view);
    if (view.flash > 0) {
      const c = renderer.ctx;
      c.fillStyle = `rgba(255,60,60,${view.flash * 0.35})`;
      c.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    }
    if (view.shake > 0) {
      canvas.style.transform = `translate(${(Math.random() - 0.5) * view.shake}px, ${(Math.random() - 0.5) * view.shake}px)`;
    } else {
      canvas.style.transform = '';
    }
  } catch (err) {
    console.warn('render error', err);
  }
  view.fxQueue = view.fxQueue.filter((fx) => fx.ttl > 0);

  if (fpsSamples.length < 600 && dt > 0) fpsSamples.push(1 / dt);
  requestAnimationFrame(frame);
}

// ---------- 调试契约 ----------
window.__ll = {
  state: {
    get phase() { return phase; },
    get lang() { return i18n.lang; },
  },
  run: () => run,
  sim: () => (run ? run.state : null),
  start: () => startGame(),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => restartGame(),
  home: () => goHome(),
  save: (key, value) => Sdk.save(key, value),
  ui: () => ui,
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['tap', 'combo', 'rock']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: () => (run ? run.state : null),
    // 验收辅助：强制在某个洞放置指定类型（cat/pup/hound/gold/rock）
    forceMonster: (i, type) => {
      if (!run) return false;
      const hole = run.state.holes[i];
      if (!hole) return false;
      if (type === 'rock') {
        hole.monster = { type: 'rock', tapsLeft: 0, tapsNeeded: 0, score: ROCK.score, age: 0.2, lifetime: ROCK.lifetime };
      } else {
        const def = MONSTER_TYPES[type] || MONSTER_TYPES.cat;
        hole.monster = { type, tapsLeft: def.taps, tapsNeeded: def.taps, score: def.score, age: 0.2, lifetime: def.lifetime };
      }
      return true;
    },
    // 直接结算（验收用）
    forceWin: (score) => {
      if (!run) return false;
      run.state.score = score || 3000;
      run.state.stage = run.state.stageCount;
      finishRun({ type: 'win', score: run.state.score, stars: starRating(run.state.score) });
      return true;
    },
    forceLose: () => {
      if (!run) return false;
      run.state.reason = 'timeUp';
      finishRun({ type: 'lose' });
      return true;
    },
  },
};

// ---------- 启动 ----------
bind();
syncDocumentLang();
ui.applyLang();
ui.showTitle();
ui.setMuted(muted);
renderer.draw(null, 0, view);
Sdk.track('load', {});
requestAnimationFrame(frame);
