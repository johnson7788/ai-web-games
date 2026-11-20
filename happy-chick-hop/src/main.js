// 主入口：60Hz 固定步长 + 标题/游戏/暂停/结算 + 教程引导 + SDK 统一出口
// 装配：sim（纯逻辑）/ render（canvas）/ ui（DOM）/ audio（WebAudio）。
import { STEP, WORLD, GAME, TIERS } from '../config/game.config.js';
import { createRun } from './game/sim.js';
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
let phase = 'title';        // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let hammerArmed = false;
let tutorialStep = -1;      // -1 = 未激活
let muted = !!Sdk.load('muted', false);
let best = Sdk.load('best', 0) | 0;
let tutorialDone = !!Sdk.load('tutorialDone', false);
let firstMergeAt = null;

const view = {
  phase: 'title',
  particles: [],
  comboTexts: [],
  shake: 0,
};

Sdk.ready(); // 不 await，不阻塞首屏
audio.setMuted(muted);

function persist() {
  Sdk.save('muted', muted);
  Sdk.save('best', best);
  Sdk.save('tutorialDone', tutorialDone);
}

function setPhase(p) {
  phase = p;
  view.phase = p;
}

function spawnBurst(wx, wy, color, count, power = 260) {
  if (view.particles.length > 160) return;
  for (let i = 0; i < count; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const sp = power * (0.4 + Math.random() * 0.8);
    view.particles.push({
      x: wx,
      y: wy,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 60,
      r: 2 + Math.random() * 4,
      color,
      life: 0.5 + Math.random() * 0.3,
      maxLife: 0.8,
    });
  }
}

function spawnComboText(wx, wy, text, color) {
  view.comboTexts.push({ x: wx, y: wy, text, color, life: 1.2, maxLife: 1.2 });
}

// ---------- 阶段 ----------
function startGame() {
  run = createRun({ seed: (Date.now() % 2147483647) || 1 });
  hammerArmed = false;
  firstMergeAt = null;
  view.particles = [];
  view.comboTexts = [];
  setPhase('playing');
  ui.showGame();
  hideResult();
  updateHammerBtn();
  updateHud();
  audio.unlock();
  audio.startBgm();
  Sdk.track('start', {});
  Sdk.newRun({});
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
  if (run) Sdk.track('restart', {});
  startGame();
}

function goHome() {
  run = null;
  setPhase('title');
  hideResult();
  ui.showTitle();
  audio.stopBgm();
}

// ---------- HUD / 结算 ----------
function updateHud() {
  if (!run) return;
  const h = run.getHud();
  $('hud-score').textContent = String(h.score);
  $('hud-best').textContent = `${t('best')} ${best}`;
  const goalEl = $('hud-goal');
  if (goalEl) goalEl.innerHTML = `🎯 <b>${t('goal')}</b>: ${t('goalGolden')}`;
  $('hud-stage').textContent = t('stageLabel', { n: h.stage });
  const comboEl = $('hud-combo');
  if (h.combo >= 2) {
    comboEl.textContent = `COMBO ×${1 + GAME.COMBO_BONUS * (h.combo - 1)}`;
    comboEl.classList.remove('hidden');
  } else {
    comboEl.classList.add('hidden');
  }
  $('hammer-badge').textContent = String(h.hammers);
}

function updateHammerBtn() {
  const btn = $('btn-hammer');
  if (!btn) return;
  btn.classList.toggle('armed', hammerArmed);
  const hint = $('hammer-hint');
  if (hint) hint.textContent = hammerArmed ? t('hammerHint') : t('hammer');
}

function showResult(res) {
  const won = !!res.won;
  const titleEl = $('result-title');
  titleEl.textContent = won ? t('winTitle') : t('loseTitle');
  titleEl.classList.toggle('lose', !won);
  const starsEl = $('result-stars');
  const stars = res.stars || 0;
  starsEl.innerHTML = won
    ? `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}`
    : '';
  $('result-score').textContent = `${t('score')}: ${run ? run.state.score : res.score}`;
  $('result-meta').textContent = won
    ? `${t('winReason')} ${t('merged')}: ${run ? run.state.merges : 0}`
    : `${t('loseReason')} ${t('score')}: ${run ? run.state.score : res.score}`;
  ui.showResult();
}

function hideResult() {
  ui.hideResult();
}

function finishRun(ev) {
  if (!run) return;
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  const res = run.state.result || { won: ev.type === 'win', score: run.state.score, stars: ev.type === 'win' ? 1 : 0, merges: run.state.merges };
  if (run.state.score > best) best = run.state.score;
  persist();
  Sdk.track(res.won ? 'win' : 'fail', {
    score: run.state.score,
    base: run.state.base,
    stars: res.stars || 0,
    highestTier: run.state.highestTier,
  });
  Sdk.gameOver({ score: run.state.score, won: res.won });
  showResult(res);
  audio.event(res.won ? 'win' : 'lose');
}

// ---------- 教程 ----------
const TUT_STEPS = () => [
  { text: t('tutStep1'), spot: 'aim' },
  { text: t('tutStep2'), spot: 'well' },
  { text: t('tutStep3'), spot: 'danger' },
];

function startTutorial() {
  tutorialStep = 0;
  renderTutorialStep();
}

function renderTutorialStep() {
  const el = $('tutorial');
  if (tutorialStep < 0) {
    el.classList.add('hidden');
    return;
  }
  const steps = TUT_STEPS();
  const s = steps[tutorialStep];
  el.classList.remove('hidden');
  $('tut-title').textContent = t('tutTitle');
  $('tut-text').textContent = s ? s.text : '';
  $('tut-skip').textContent = t('tutSkip');
  $('tut-next').textContent = t('tutNext');
  const rect = s && s.spot ? renderer.layoutRect(s.spot) : null;
  const spot = $('tut-spotlight');
  if (rect) {
    spot.style.display = 'block';
    spot.style.left = `${rect.x - 8}px`;
    spot.style.top = `${rect.y - 8}px`;
    spot.style.width = `${rect.w + 16}px`;
    spot.style.height = `${rect.h + 16}px`;
  } else {
    spot.style.display = 'none';
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

const TUT_TRIGGER = ['drop', 'merge', 'stage'];
function tutorialAdvance(evType) {
  if (tutorialStep < 0 || tutorialStep >= TUT_TRIGGER.length) return;
  if (TUT_TRIGGER[tutorialStep] !== evType) return;
  tutorialStep += 1;
  if (tutorialStep >= TUT_TRIGGER.length) endTutorial();
  else renderTutorialStep();
}

// ---------- 事件消费 ----------
function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    tutorialAdvance(ev.type);
    switch (ev.type) {
      case 'drop':
        view.shake = 2;
        break;
      case 'rock':
        view.shake = 3;
        spawnBurst(ev.x, GAME.SPAWN_Y, '#9E9E9E', 8, 200);
        break;
      case 'merge': {
        const tier = ev.tier;
        const color = (TIERS[tier - 1] && TIERS[tier - 1].color) || '#FFD54F';
        spawnBurst(ev.x, ev.y, color, 12, 300);
        spawnComboText(ev.x, ev.y - 10, `+${ev.base + ev.bonus}`, '#FFE082');
        if (firstMergeAt === null) firstMergeAt = performance.now();
        view.shake = 2;
        break;
      }
      case 'combo':
        spawnComboText(WORLD.WIDTH / 2, 200, 'COMBO!', '#FF9800');
        break;
      case 'stage':
        spawnComboText(WORLD.WIDTH / 2, 220, t('stageLabel', { n: ev.stage }), '#4CAF50');
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

// ---------- 输入 ----------
function canvasToWorld(e) {
  const rect = canvas.getBoundingClientRect();
  return renderer.worldFromScreen(e.clientX - rect.left, e.clientY - rect.top);
}

let pointerDown = false;
canvas.addEventListener('pointermove', (e) => {
  if (!run || phase !== 'playing') return;
  const p = canvasToWorld(e);
  run.setAim(p.x);
});
canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (!run || phase !== 'playing') return;
  pointerDown = true;
  const p = canvasToWorld(e);
  run.setAim(p.x);
});
canvas.addEventListener('pointerup', (e) => {
  if (!run || phase !== 'playing') return;
  pointerDown = false;
  const p = canvasToWorld(e);
  if (hammerArmed) {
    const res = run.useHammer(p.x, p.y);
    if (res.ok) {
      hammerArmed = false;
      updateHammerBtn();
      audio.event('hammer');
      spawnBurst(p.x, p.y, '#9E9E9E', 12, 320);
      view.shake = 4;
      updateHud();
    } else {
      audio.event('click');
    }
    return;
  }
  run.drop();
  updateHud();
});
canvas.addEventListener('pointerleave', () => { pointerDown = false; });

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
  $('btn-mute').classList.toggle('is-muted', muted);
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
  on('btn-restart', restartGame);
  on('btn-retry', restartGame);
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-mute', toggleMute);
  on('btn-hammer', () => {
    if (!run || phase !== 'playing') return;
    hammerArmed = !hammerArmed;
    updateHammerBtn();
  });
  on('btn-howto', () => { startTutorial(); });
  on('btn-tut-replay', () => {
    if (phase === 'paused') resumeGame();
    startTutorial();
  });
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);
  on('btn-rotate-skip', () => {
    const rs = $('rotate-screen');
    if (rs) rs.style.display = 'none';
  });

  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = $(id);
    if (!sel) continue;
    sel.addEventListener('change', () => {
      ui.setLang(sel.value);
      renderTutorialStep();
      updateHud();
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

  if (view.shake > 0) view.shake = Math.max(0, view.shake - dt * 22);
  view.particles = view.particles.filter((p) => p.life > 0);
  view.comboTexts = view.comboTexts.filter((c) => c.life > 0);

  try {
    renderer.draw(run ? run.state : null, dt, view);
  } catch (err) {
    console.warn('render error', err);
  }

  requestAnimationFrame(frame);
}

// ---------- 调试契约 ----------
window.__ll = {
  state: {
    get phase() { return phase; },
    get lang() { return i18n.lang; },
  },
  run: () => run,
  start: () => startGame(),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => restartGame(),
  home: () => goHome(),
  sim: () => (run ? run.state : null),
  ui,
  save: () => { persist(); return true; },
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['aim', 'drop', 'merge']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  debug: {
    state: () => {
      if (!run) return null;
      const st = run.state;
      return {
        phase: st.phase,
        score: st.score,
        base: st.base,
        stage: st.stage,
        merges: st.merges,
        drops: st.drops,
        hammers: st.hammers,
        highestTier: st.highestTier,
        objects: st.objects.length,
        current: st.current,
        next: st.next,
      };
    },
    drop: (x) => {
      if (!run) return false;
      if (x != null) run.setAim(x);
      const r = run.drop();
      if (r.ok) handleEvents(run.drainEvents());
      return r.ok;
    },
    fastForwardToLose: () => {
      if (!run) return false;
      run.forceResult(false);
      handleEvents(run.drainEvents());
      return true;
    },
    fastForwardToWin: () => {
      if (!run) return false;
      run.forceResult(true);
      handleEvents(run.drainEvents());
      return true;
    },
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    armHammer: () => { hammerArmed = true; updateHammerBtn(); },
  },
};

// ---------- 启动 ----------
bind();
syncDocumentLang();
ui.applyLang();
$('btn-mute').classList.toggle('is-muted', muted);
Sdk.track('load', {});
requestAnimationFrame(frame);
