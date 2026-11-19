// GUN GOD ARENA · 主入口：60Hz 固定步长 + 标题/游戏/暂停/结算 + 教程引导 + SDK 统一出口
import { STEP, WORLD, GUN, STAR_LEVELS } from '../config/game.config.js';
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
let phase = 'title';           // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let fpsSamples = [];
let tutorialStep = -1;         // -1 = 未激活
let dragging = false;          // 拖拽瞄准中

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let best = Sdk.load('best', 0) || 0;
let tutorialDone = !!Sdk.load('tutorialDone', false);

Sdk.ready();
audio.setMuted(muted);
ui.setMuted(muted);

function persist() {
  Sdk.save('muted', muted);
  Sdk.save('best', best);
  Sdk.save('tutorialDone', tutorialDone);
}

// ---------- 阶段状态机 ----------
function setPhase(p) { phase = p; }

function startRun() {
  run = createRun({ seed: (Date.now() % 2147483647) || 1 });
  dragging = false;
  setPhase('playing');
  ui.showGame();
  ui.hideResult();
  ui.hideLevelClear();
  updateHud();
  audio.unlock();
  audio.startBgm();
  Sdk.newRun({});
  if (!tutorialDone) startTutorial();
}

function pauseGame(silent) {
  if (phase !== 'playing') return;
  setPhase('paused');
  audio.stopBgm();
  if (!silent) ui.showPause();
}

function resumeGame() {
  if (phase !== 'paused') return;
  setPhase('playing');
  ui.hidePause();
  audio.startBgm();
}

function restartRun() {
  Sdk.track('restart', {});
  startRun();
}

function goHome() {
  run = null;
  setPhase('title');
  ui.hideResult();
  ui.hideLevelClear();
  ui.showTitle();
  renderTitleBest();
}

// ---------- HUD / 标题 / 结算 ----------
function updateHud() {
  if (!run) return;
  const st = run.state;
  const set = (id, txt) => { const el = $(id); if (el) el.textContent = txt; };
  set('hud-level', `${t('level')} ${st.level}`);
  set('hud-targets', `${t('targets')} ${st.targets.length}`);
  set('hud-ammo', `${t('ammo')} ${st.bullets}`);
  set('hud-combo', `${t('combo')} ×${st.combo}`);
  set('hud-score', `${t('score')} ${Math.floor(st.score)}`);
  set('hud-best', `${t('best')} ${Math.floor(Math.max(best, st.score))}`);
  const comboEl = $('hud-combo');
  if (comboEl) comboEl.classList.toggle('combo-hot', st.combo >= 2);
}

function renderTitleBest() {
  const el = $('title-best');
  if (el) el.textContent = `${t('bestLabel')} ${Math.floor(best)}`;
}

function showLevelClear(ev) {
  const title = $('level-clear-title');
  const stars = $('level-clear-stars');
  if (title) title.textContent = `${t('levelClear')} · ${t('level')} ${ev.level}`;
  if (stars) stars.textContent = '★'.repeat(ev.stars) + '☆'.repeat(3 - ev.stars);
  ui.showLevelClear();
  clearTimeout(showLevelClear._t);
  showLevelClear._t = setTimeout(() => ui.hideLevelClear(), 1050);
}

function showResult(ev, won) {
  const st = run.state;
  const isBest = ev.score > best;
  $('result-title').textContent = won ? t('youWin') : t('resultFail');
  $('result-stars').textContent = '';
  $('result-score').textContent = `${t('finalScore')} ${Math.floor(ev.score)}`;
  $('result-cleared').textContent = `${t('cleared')} ${ev.cleared || 0} / ${STAR_LEVELS}`;
  $('result-best').textContent = isBest ? t('newBest') : `${t('bestLabel')} ${Math.floor(best)}`;
  ui.showResult();
}

function finishRun(ev, won) {
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  if (ev.score > best) {
    best = ev.score;
    persist();
  }
  Sdk.gameOver({ score: Math.floor(ev.score), level: ev.level, kills: ev.kills, cleared: ev.cleared, won });
  showResult(ev, won);
}

// ---------- 教程引导（首次自动弹，可跳过，完成/跳过后持久化不再自动弹） ----------
const TUT_STEPS = () => [
  { key: 'aim', text: t('tutStep1') },
  { key: 'shoot', text: t('tutStep2') },
  { key: 'target', text: t('tutStep3') },
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
  $('tut-title').textContent = t('tutTitle');
  $('tut-text').textContent = s ? s.text : '';
  $('tut-skip').textContent = t('tutSkip');
  $('tut-next').textContent = t('tutNext');
  const spot = $('tut-spotlight');
  const rect = spotlightRect(s && s.key);
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

function spotlightRect(key) {
  if (key === 'aim') return { x: GUN.X - 70, y: GUN.Y - 70, w: 140, h: 130 };
  if (key === 'shoot') return { x: WORLD.WIDTH / 2 - 110, y: 150, w: 220, h: 150 };
  return { x: WORLD.WIDTH / 2 - 100, y: 170, w: 200, h: 140 };
}

function tutorialNext() {
  tutorialStep += 1;
  if (tutorialStep >= TUT_STEPS().length) endTutorial();
  else renderTutorialStep();
}

function tutorialSkip() { endTutorial(); }

function endTutorial() {
  tutorialStep = -1;
  tutorialDone = true;
  persist();
  renderTutorialStep();
}

// ---------- 事件消费 ----------
function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    switch (ev.type) {
      case 'shot':
        renderer.fx('shot', ev.x, ev.y);
        break;
      case 'reflect':
        break;
      case 'kill':
        renderer.fx('kill', ev.x, ev.y, '#ffd75e');
        renderer.addShake(2);
        break;
      case 'crate':
        renderer.fx('crate', ev.x, ev.y);
        break;
      case 'rock':
        renderer.fx('rock', ev.x, ev.y);
        break;
      case 'pickup':
        renderer.fx('pickup', GUN.X, GUN.Y - 30);
        break;
      case 'boom':
        renderer.fx('boom', GUN.X, GUN.Y - 60);
        renderer.addShake(4);
        break;
      case 'combo':
        break;
      case 'crush':
        renderer.fx('kill', ev.x, ev.y, '#ff6bd6');
        renderer.addShake(2);
        break;
      case 'levelclear':
        showLevelClear(ev);
        break;
      case 'vipfail':
        renderer.fx('vipfail', ev.x, ev.y);
        renderer.addShake(8);
        break;
      case 'fail':
        finishRun(ev, false);
        return;
      case 'win':
        finishRun(ev, true);
        return;
      default:
        break;
    }
  }
}

// ---------- 输入 ----------
function canvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (WORLD.WIDTH / rect.width),
    y: (e.clientY - rect.top) * (WORLD.HEIGHT / rect.height),
  };
}

function aimAtPointer(e) {
  if (!run || phase !== 'playing') return;
  const p = canvasPos(e);
  run.aimAt(p.x, p.y);
}

window.addEventListener('keydown', (e) => {
  const k = e.code;
  if (phase === 'playing' && run) {
    if (k === 'ArrowLeft') { e.preventDefault(); run.rotate(-0.09); }
    if (k === 'ArrowRight') { e.preventDefault(); run.rotate(0.09); }
    if (k === 'Space') { e.preventDefault(); audio.unlock(); run.fire(); }
  }
  if (k === 'Escape' || k === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
  if (k === 'KeyR') {
    if (phase === 'playing' || phase === 'paused' || phase === 'result') restartRun();
  }
  if (k === 'KeyM') toggleMute();
});

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (!run || phase !== 'playing') return;
  dragging = true;
  aimAtPointer(e);
});
canvas.addEventListener('pointermove', (e) => {
  if (dragging) aimAtPointer(e);
});
canvas.addEventListener('pointerup', (e) => {
  if (dragging && run && phase === 'playing') run.fire();
  dragging = false;
});
canvas.addEventListener('pointercancel', () => { dragging = false; });

function updateGoalHint() {
  const el = $('goal-hint');
  if (!el) return;
  if (phase === 'playing' && run && run.state.time < 4.5 && run.state.phase === 'playing') {
    el.textContent = t('goalHint');
    el.classList.remove('hidden');
    el.style.opacity = run.state.time < 3.5 ? '1' : String(Math.max(0, 1 - (run.state.time - 3.5)));
  } else {
    el.classList.add('hidden');
  }
}

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
  on('btn-start', startRun);
  on('btn-resume', resumeGame);
  on('btn-restart', restartRun);
  on('btn-restart2', restartRun);
  on('btn-retry', restartRun);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result') startTutorial(); });
  on('btn-howto-title', () => startTutorial());
  on('tut-next', tutorialNext);
  on('tut-skip', tutorialSkip);
  on('btn-rotate-skip', () => {
    const rs = $('rotate-screen');
    if (rs) rs.style.display = 'none';
  });

  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = $(id);
    if (!sel) continue;
    sel.addEventListener('change', () => {
      ui.setLang(sel.value);
      renderTitleBest();
      if (run) updateHud();
      renderTutorialStep();
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

  renderer.draw(run ? run.state : null, dt);
  updateGoalHint();
  if (fpsSamples.length < 600 && dt > 0) fpsSamples.push(1 / dt);
  requestAnimationFrame(frame);
}

// ---------- 调试契约（截图/验收脚本通用） ----------
window.__ll = {
  state: {
    get phase() { return phase; },
    get lang() { return i18n.lang; },
  },
  run: () => run,
  sim: () => (run ? run.state : null),
  start: () => startRun(),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => restartRun(),
  home: () => goHome(),
  startAct: () => startRun(),
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['aim', 'shoot', 'target']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => tutorialSkip(),
  },
  startTutorial: () => startTutorial(),
  save: (k, v) => Sdk.save(k, v),
  ui: () => ui,
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: () => (run ? run.state : null),
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    startSeeded: (seed) => {
      run = createRun({ seed: seed | 0 || 1 });
      dragging = false;
      setPhase('playing');
      ui.showGame();
      ui.hideResult();
      ui.hideLevelClear();
      updateHud();
      audio.unlock();
      return true;
    },
    fire: () => (run ? run.fire() : { ok: false }),
    giveUp: () => {
      if (run) {
        run.state.phase = 'result';
        run.state.won = false;
        handleEvents([{ type: 'fail', score: run.state.score, level: run.state.level, kills: run.state.kills, cleared: run.state.clearedCount }]);
      }
      return true;
    },
    spawnShowcase: () => {
      if (!run) return false;
      const st = run.state;
      st.phase = 'playing';
      st.targets = [{ x: 300, y: 220 }, { x: 640, y: 180 }, { x: 980, y: 220 }];
      st.vips = [{ x: 160, y: 540 }];
      st.crates = [];
      st.rocks = [];
      st.powerups = [];
      st.bulletsFlying = [{ x: 640, y: 560, vx: -40, vy: -480, bounces: 0 }];
      return true;
    },
  },
};

window.G = {
  state: () => phase,
  run: () => run,
  createRun,
};

// ---------- 启动 ----------
bind();
syncDocumentLang();
ui.applyLang();
renderTitleBest();
Sdk.track('load', {});
requestAnimationFrame(frame);
