// DRIFT KING CN · 主入口：60Hz 固定步长 + 标题→游戏→暂停→结算 + 教程 + SDK 统一出口。
import { STEP, WORLD } from '../config/game.config.js';
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
let nowSec = 0;
let tutorialStep = -1;

const view = {
  shake: 0,
  time: 0,
};

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let best = Sdk.load('best', 0) | 0;
let tutorialDone = !!Sdk.load('tutorialDone', false);

Sdk.ready(); // 不 await，不阻塞首屏
Sdk.onAdStart(() => { if (phase === 'playing') pauseGame(true); });
Sdk.onAdEnd(() => { if (phase === 'paused') resumeGame(); });
audio.setMuted(muted);
ui.setMuted(muted);

function persist() {
  Sdk.save('muted', muted);
  Sdk.save('best', best);
  Sdk.save('tutorialDone', tutorialDone);
}

// ---------- 阶段状态机 ----------
function setPhase(p) { phase = p; }

function startLevel() {
  run = createRun({ seed: ((Date.now() % 2147483647) || 1) });
  renderer.clearTrail();
  setPhase('playing');
  ui.showGame();
  ui.hideResult();
  updateHud();
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
  lastTime = performance.now();
}

function restartGame() {
  Sdk.track('restart', {});
  startLevel();
}

function goHome() {
  run = null;
  setPhase('title');
  ui.hideResult();
  ui.showTitle();
  renderer.clearTrail();
}

function showGameOver() {
  if (!run) return;
  setPhase('result');
  audio.stopBgm();
  const score = Math.floor(run.state.score);
  const isNewBest = score > best;
  if (isNewBest) best = score;
  persist();
  ui.showResult(score, best, isNewBest);
  audio.event('death', {});
  Sdk.gameOver({ score, best, durationMs: Math.round(run.state.time * 1000) });
}

// ---------- HUD ----------
function updateHud() {
  if (run) ui.updateHud(run.getHud());
}

// ---------- 教程引导 ----------
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
  $('tut-title').textContent = t('tutTitle');
  $('tut-text').textContent = s ? s.text : '';
  $('tut-skip').textContent = t('tutSkip');
  $('tut-next').textContent = t('tutNext');
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
function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    switch (ev.type) {
      case 'kill':
        renderer.spawn('explosion', WORLD.WIDTH / 2, WORLD.HEIGHT / 2);
        view.shake = Math.max(view.shake, 3);
        break;
      case 'star':
        renderer.spawn('starPop', WORLD.WIDTH / 2, WORLD.HEIGHT / 2);
        break;
      case 'hit':
        renderer.spawn('ring', WORLD.WIDTH / 2, WORLD.HEIGHT / 2);
        view.shake = Math.max(view.shake, 6);
        break;
      case 'hot':
        renderer.spawn('ring', WORLD.WIDTH / 2, WORLD.HEIGHT / 2);
        view.shake = Math.max(view.shake, 8);
        break;
      case 'pylon':
        renderer.spawn('pylonPop', WORLD.WIDTH / 2, WORLD.HEIGHT / 2);
        break;
      case 'hurt':
        renderer.spawn('hurt', WORLD.WIDTH / 2, WORLD.HEIGHT / 2);
        view.shake = Math.max(view.shake, 5);
        break;
      case 'death':
        showGameOver();
        return;
      default:
        break;
    }
  }
}

// ---------- 输入 ----------
let keyL = false;
let keyR = false;
function steer() {
  return keyL && !keyR ? -1 : keyR && !keyL ? 1 : 0;
}
function applySteer() {
  if (run && phase === 'playing') run.setSteer(steer());
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') { keyL = true; applySteer(); e.preventDefault(); }
  else if (e.code === 'ArrowRight' || e.code === 'KeyD') { keyR = true; applySteer(); e.preventDefault(); }
  else if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
    e.preventDefault();
    audio.unlock();
    if (phase === 'playing' && run) run.pressBoost();
  } else if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  } else if (e.code === 'KeyR') {
    if (phase === 'playing' || phase === 'paused' || phase === 'result') restartGame();
  } else if (e.code === 'KeyM') {
    toggleMute();
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') { keyL = false; applySteer(); }
  else if (e.code === 'ArrowRight' || e.code === 'KeyD') { keyR = false; applySteer(); }
});

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (phase !== 'playing' || !run) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  run.setSteer(x < rect.width / 2 ? -1 : 1);
  canvas.setPointerCapture?.(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (phase !== 'playing' || !run) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  run.setSteer(x < rect.width / 2 ? -1 : 1);
});
const endPointer = () => { if (run) run.setSteer(0); };
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);

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
  on('btn-start', () => startLevel());
  on('btn-resume', resumeGame);
  on('btn-restart2', restartGame);
  on('btn-retry', restartGame);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-pause', () => pauseGame());
  on('btn-mute', toggleMute);
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result') startTutorial(); });
  on('btn-boost', () => { if (phase === 'playing' && run) run.pressBoost(); });
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);

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
  nowSec += dt;
  view.time = nowSec;

  if (phase === 'playing' && run) {
    accumulator += dt;
    while (accumulator >= STEP) {
      run.step(STEP);
      accumulator -= STEP;
    }
    handleEvents(run.drainEvents());
    if (run && phase === 'playing') updateHud();
    renderer.tick(run.state);
  }

  if (view.shake > 0) view.shake = Math.max(0, view.shake - dt * 26);

  const drawState = (phase === 'playing' || phase === 'paused') ? run.state : { phase: 'title' };
  renderer.draw(drawState, dt, view);

  requestAnimationFrame(frame);
}

// ---------- 调试契约 ----------
window.__ll = {
  state: {
    get phase() { return phase; },
    get lang() { return i18n.lang; },
  },
  run: () => run,
  start: () => startLevel(),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => restartGame(),
  home: () => goHome(),
  save: () => Sdk,
  ui: () => ui,
  startTutorial: () => startTutorial(),
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['steer', 'collect', 'boost']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    startTutorial: () => startTutorial(),
  },
  debug: {
    state: () => (run ? { ...run.state, mode: run.state.mode } : null),
    mode: () => (run ? run.state.mode : null),
    stageDemo: () => (run ? run.stageDemo() : false),
    forceHit: () => {
      if (!run) return false;
      run.state.mode = 'hit';
      run.state.modeTime = 8;
      run.state.boost = 0;
      run.state.hitKills = 0;
      return true;
    },
    forceCombo: () => {
      if (!run) return false;
      run.state.combo = 5;
      run.state.comboTime = 3;
      return true;
    },
    die: () => { showGameOver(); return true; },
  },
};

// ---------- 启动 ----------
bind();
syncDocumentLang();
ui.applyLang();
$('btn-mute').classList.toggle('is-muted', muted);
Sdk.track('load', {});
requestAnimationFrame(frame);
