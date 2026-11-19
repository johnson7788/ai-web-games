// MERGE MELON DROP · 主入口：60Hz 固定步长 + 标题→游戏→暂停→结算 + 教程 + SDK 统一出口
// 装配：sim(纯逻辑) / render(Canvas) / ui(DOM) / audio(WebAudio) / sdk(存档埋点统一出口)。
// 调试契约 window.__ll：{ state:{phase,lang}, start, pause, resume, restart, run, tutorial:{active,step,steps}, startTutorial }。
import { STEP, WORLD, TIERS, ROCK, MAX_TIER } from '../config/game.config.js';
import { createRun } from './game/sim.js';
import { createRenderer } from './render/index.js';
import { createAudio } from './core/audio.js';
import { ui } from './ui/ui.js';
import { i18n, t, syncDocumentLang } from './core/i18n.js';
import Sdk from './core/sdk.js';

const $ = (id) => document.getElementById(id);
const canvas = $('canvas');
const container = $('game-container');
const renderer = createRenderer(canvas);
const audio = createAudio();

// ---------- 存档（统一走 Sdk；localStorage 只在 sdk.js 内部兜底） ----------
let best = Sdk.load('best', 0) | 0;
let muted = !!Sdk.load('muted', false);
let tutorialDone = !!Sdk.load('tutorialDone', false);

let run = null;
let phase = 'title';        // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let tutorialStep = -1;
let firstInputTracked = false;

const TUT_STEP_IDS = ['move', 'drop', 'merge'];
const TUT_TEXT = { move: 'tutStepMove', drop: 'tutStepDrop', merge: 'tutStepMerge' };

const reducedMotion = typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
renderer.setReducedMotion(reducedMotion);
audio.setMuted(muted);

Sdk.ready(); // 不 await，不阻塞首屏
Sdk.track('load', { level: 1 });
Sdk.onAdStart(() => { if (phase === 'playing') pauseGame(); });
Sdk.onAdEnd(() => { if (phase === 'paused') resumeGame(); });

function persist() {
  Sdk.save('best', best);
  Sdk.save('muted', muted);
  Sdk.save('tutorialDone', tutorialDone);
}

function trackFirstInput() {
  if (firstInputTracked) return;
  firstInputTracked = true;
  Sdk.track('first_input', {});
}

// ---------- 阶段状态机 ----------
function setPhase(p) { phase = p; }

function startGame() {
  run = createRun({ seed: (Date.now() % 2147483647) || 1, best });
  firstInputTracked = false;
  setPhase('playing');
  ui.showGame();
  audio.unlock();
  audio.startBgm();
  Sdk.newRun({ level: 1 });
  if (!tutorialDone) startTutorial();
}

function restartGame() {
  Sdk.track('restart', {});
  startGame();
}

function goHome() {
  run = null;
  setPhase('title');
  ui.showTitle();
  audio.stopBgm();
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

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  persist();
  $('btn-mute').textContent = muted ? '🔇' : '🔊';
}

// ---------- 教程 ----------
function startTutorial() {
  tutorialStep = 0;
  renderTutorialStep();
}

function renderTutorialStep() {
  const el = $('tutorial');
  if (tutorialStep < 0 || tutorialStep >= TUT_STEP_IDS.length) {
    el.classList.add('hidden');
    $('tut-spotlight').style.display = 'none';
    return;
  }
  el.classList.remove('hidden');
  const stepId = TUT_STEP_IDS[tutorialStep];
  $('tut-text').textContent = t(TUT_TEXT[stepId]);
  const rect = spotRect(stepId);
  const spot = $('tut-spotlight');
  if (rect) {
    spot.style.display = 'block';
    spot.style.left = `${rect.x}px`;
    spot.style.top = `${rect.y}px`;
    spot.style.width = `${rect.w}px`;
    spot.style.height = `${rect.h}px`;
  } else {
    spot.style.display = 'none';
  }
}

function spotRect(stepId) {
  const cont = container.getBoundingClientRect();
  const cv = canvas.getBoundingClientRect();
  const sx = cv.width / WORLD.WIDTH;
  const sy = cv.height / WORLD.HEIGHT;
  let logical;
  if (stepId === 'container') {
    logical = { x: WORLD.WALL_L - 10, y: WORLD.CEIL_Y - 10, w: WORLD.WALL_R - WORLD.WALL_L + 20, h: WORLD.FLOOR_Y - WORLD.CEIL_Y + 20 };
  } else {
    const r = run ? (run.state.heldTier === -1 ? ROCK.RADIUS : TIERS[run.state.heldTier].r) : 18;
    logical = { x: (run ? run.state.heldX : (WORLD.WALL_L + WORLD.WALL_R) / 2) - r - 12, y: WORLD.HOLD_Y - r - 12, w: 2 * r + 24, h: 2 * r + 24 };
  }
  return {
    x: cv.left - cont.left + logical.x * sx,
    y: cv.top - cont.top + logical.y * sy,
    w: logical.w * sx,
    h: logical.h * sy,
  };
}

function tutorialAdvance(evType) {
  if (tutorialStep < 0 || tutorialStep >= TUT_STEP_IDS.length) return;
  const want = TUT_STEP_IDS[tutorialStep];
  const hit = (want === 'move' && evType === 'first_input')
    || (want === 'drop' && evType === 'drop')
    || (want === 'merge' && evType === 'merge');
  if (!hit) return;
  tutorialStep += 1;
  if (tutorialStep >= TUT_STEP_IDS.length) endTutorial();
  else renderTutorialStep();
}

function tutorialNext() {
  if (tutorialStep < 0) return;
  tutorialStep += 1;
  if (tutorialStep >= TUT_STEP_IDS.length) endTutorial();
  else renderTutorialStep();
}

function endTutorial() {
  tutorialStep = -1;
  tutorialDone = true;
  Sdk.save('tutorialDone', true);
  renderTutorialStep();
}

// ---------- 事件消费 ----------
function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    renderer.fx(ev.type, ev);
    tutorialAdvance(ev.type);
    if (ev.type === 'gameover') finishRun(ev);
  }
}

function finishRun(ev) {
  setPhase('result');
  audio.stopBgm();
  const newBest = ev.score > best;
  if (newBest) { best = ev.score; Sdk.save('best', best); }
  Sdk.gameOver({ level: 1, score: ev.score });
  audio.event('star', {});
  ui.showResult({ score: ev.score, stars: ev.stars, maxTier: ev.maxTier, best, newBest });
}

// ---------- 输入 ----------
function canvasToWorld(e) {
  const rect = canvas.getBoundingClientRect();
  return (e.clientX - rect.left) * (WORLD.WIDTH / rect.width);
}

let pointerDown = false;

canvas.addEventListener('pointermove', (e) => {
  if (phase !== 'playing' || !run) return;
  trackFirstInput();
  run.setAim(canvasToWorld(e));
});

canvas.addEventListener('pointerdown', (e) => {
  if (phase !== 'playing' || !run) return;
  trackFirstInput();
  pointerDown = true;
  run.setAim(canvasToWorld(e));
});

canvas.addEventListener('pointerup', () => {
  if (phase !== 'playing' || !run || !pointerDown) return;
  pointerDown = false;
  trackFirstInput();
  doDrop();
});

canvas.addEventListener('pointerleave', () => { pointerDown = false; });

function doDrop() {
  if (run && run.state.phase === 'playing') run.drop();
}

const input = { left: false, right: false, dropQueued: false };

window.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') { input.left = true; e.preventDefault(); }
  else if (e.code === 'ArrowRight' || e.code === 'KeyD') { input.right = true; e.preventDefault(); }
  else if (e.code === 'Space' || e.code === 'ArrowDown' || e.code === 'KeyS' || e.code === 'Enter') {
    e.preventDefault();
    if (phase === 'title') startGame();
    else if (phase === 'result') restartGame();
    else if (phase === 'playing') input.dropQueued = true;
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
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') input.left = false;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') input.right = false;
});

window.addEventListener('pagehide', () => {
  Sdk.track('session_end', { sec: run ? Math.round(run.state.time) : 0, level: 1, restarts: 0 });
});

// ---------- 主循环 ----------
function frame(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;

  if (phase === 'playing' && run) {
    if (input.left) run.setAim(run.state.heldX - 420 * dt);
    if (input.right) run.setAim(run.state.heldX + 420 * dt);
    if (input.dropQueued) { input.dropQueued = false; doDrop(); }
    accumulator += dt;
    while (accumulator >= STEP) {
      run.step(STEP);
      accumulator -= STEP;
    }
    handleEvents(run.drainEvents());
    if (run && phase === 'playing') ui.updateHud(run.getHud());
  }

  renderer.draw(run && phase !== 'title' ? run.state : null, dt);
  requestAnimationFrame(frame);
}

// ---------- UI 按钮 ----------
$('btn-start').addEventListener('click', startGame);
$('btn-resume').addEventListener('click', resumeGame);
$('btn-retry').addEventListener('click', restartGame);
$('btn-restart2').addEventListener('click', restartGame);
$('btn-home').addEventListener('click', goHome);
$('btn-home2').addEventListener('click', goHome);
$('btn-home3').addEventListener('click', goHome);
$('btn-mute').addEventListener('click', toggleMute);
$('btn-restart').addEventListener('click', restartGame);
$('btn-tut-replay').addEventListener('click', () => { if (phase === 'paused') resumeGame(); startTutorial(); });
$('btn-howto').addEventListener('click', () => { if (phase === 'playing' || phase === 'result') startTutorial(); });
$('btn-howto-title').addEventListener('click', () => startTutorial());
$('tut-skip').addEventListener('click', endTutorial);
$('tut-next').addEventListener('click', tutorialNext);

for (const id of ['lang-select', 'lang-select-pause']) {
  const sel = $(id);
  if (sel) sel.addEventListener('change', () => ui.setLang(sel.value));
}

// ---------- 调试契约（截图/验收脚本通用） ----------
window.__ll = {
  state: {
    get phase() { return phase; },
    get lang() { return i18n.lang; },
  },
  start: () => startGame(),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => restartGame(),
  home: () => goHome(),
  get run() { return run; },
  save: (k, v) => Sdk.save(k, v),
  ui,
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return TUT_STEP_IDS; },
    get current() { return tutorialStep >= 0 ? TUT_STEP_IDS[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  debug: {
    state: () => (run ? run.debugState() : null),
    setAim: (x) => { if (run) run.setAim(x); },
    drop: () => doDrop(),
    dropAt: (x) => { if (run) { run.setAim(x); run.drop(); } },
    step: (n) => { if (run) { for (let i = 0; i < (n | 0); i += 1) { run.step(STEP); } handleEvents(run.drainEvents()); } },
    setTutorialDone: (b) => { tutorialDone = !!b; Sdk.save('tutorialDone', tutorialDone); },
    startTutorial: () => startTutorial(),
    tutorialStep: () => tutorialStep,
    seedRun: (seed) => {
      run = createRun({ seed: seed | 0 || 1, best });
      firstInputTracked = false;
      setPhase('playing');
      ui.showGame();
      audio.startBgm();
      return true;
    },
    // 用于截图：直接铺一个局面
    loadBoard: (kind) => {
      if (!run) return false;
      run.state.bodies = [];
      run.state.score = 0;
      run.state.maxTier = -1;
      const spawn = (tier, x, y) => run.debugSpawn(tier, x, y);
      if (kind === 'rock') {
        spawn(-1, WORLD.WALL_L + 200, WORLD.FLOOR_Y - 50);
        spawn(0, WORLD.WALL_L + 330, WORLD.FLOOR_Y - 20);
        spawn(3, WORLD.WALL_L + 430, WORLD.FLOOR_Y - 40);
        run.state.maxTier = 3;
      } else if (kind === 'merge') {
        spawn(1, WORLD.WALL_L + 180, WORLD.FLOOR_Y - 40);
        spawn(2, WORLD.WALL_L + 300, WORLD.FLOOR_Y - 55);
        spawn(3, WORLD.WALL_L + 230, WORLD.FLOOR_Y - 85);
        spawn(4, WORLD.WALL_L + 360, WORLD.FLOOR_Y - 95);
        spawn(5, WORLD.WALL_L + 300, WORLD.FLOOR_Y - 130);
        run.state.maxTier = 5;
        run.state.score = 60;
      } else if (kind === 'full') {
        spawn(0, WORLD.WALL_L + 160, WORLD.FLOOR_Y - 20);
        spawn(1, WORLD.WALL_L + 210, WORLD.FLOOR_Y - 24);
        spawn(2, WORLD.WALL_L + 270, WORLD.FLOOR_Y - 30);
        spawn(3, WORLD.WALL_L + 340, WORLD.FLOOR_Y - 36);
        spawn(4, WORLD.WALL_L + 200, WORLD.FLOOR_Y - 70);
        spawn(5, WORLD.WALL_L + 300, WORLD.FLOOR_Y - 90);
        spawn(6, WORLD.WALL_L + 400, WORLD.FLOOR_Y - 60);
        run.state.maxTier = 6;
        run.state.score = 180;
      }
      return true;
    },
    gameOver: () => { if (run) run.debugGameOver(); },
  },
};

window.G = { Game: () => run, UI: ui, Render: renderer, Audio: audio, Save: Sdk };

// ---------- 启动 ----------
ui.lastBest = best;
ui.applyLang();
ui.updateBest(best);
ui.showTitle();
$('btn-mute').textContent = muted ? '🔇' : '🔊';
renderer.draw(null, 1 / 60);
requestAnimationFrame(frame);
