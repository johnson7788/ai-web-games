// src/main.js — 主入口：60Hz 固定步长 + 状态机（title→playing→result / paused）+ 教程 + 调试契约。
import { WORLD, STAGES, RUN } from '../config/game.config.js';
import { createRun, stepRun, getHud, getState, decorateRun } from './game/sim.js';
import { greedyDir, greedyBoost } from './game/ai.js';
import { createRenderer } from './render/index.js';
import { ui } from './ui/ui.js';
import { i18n } from './core/i18n.js';
import { save } from './core/save.js';
import { createAudio } from './core/audio.js';
import { Sdk } from './core/sdk.js';

const STEP = 1 / 60;

const canvas = document.getElementById('canvas');
const renderer = createRenderer(canvas);
const audio = createAudio();

const reducedMotion = typeof window.matchMedia === 'function'
  ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
  : false;

const toPx = (c) => ({ x: WORLD.BOARD_X + (c.x + 0.5) * WORLD.CELL, y: WORLD.BOARD_Y + (c.y + 0.5) * WORLD.CELL });

// ---------------------------------------------------------------- 状态

let state = 'title'; // title | playing | paused | result
let run = decorateRun(createRun({ seed: 1 }));
let fx = { trail: [], particles: [] };
let lastMoves = 0;
let lastTime = performance.now();
let accumulator = 0;

const input = { dir: null, boost: false };
let boostDown = false;
let touchBoostDown = false;

const tutorial = {
  active: false,
  step: 0,
  steps: ['steer', 'eat', 'boost'],
  current: 'steer',
  foodEatenStart: 0,
};

// ---------------------------------------------------------------- 运行控制

function startRun(seed, opts = {}) {
  run = decorateRun(createRun({ seed: seed == null ? ((Math.random() * 1e9) | 0) : seed }));
  fx = { trail: [], particles: [] };
  lastMoves = 0;
  accumulator = 0;
  state = 'playing';
  input.dir = null;
  boostDown = false;
  touchBoostDown = false;
  ui.showGame();
  Sdk.newRun();
  Sdk.track('start', { seed: run.seed });
  audio.unlock();
  audio.startBgm();
  if (!opts.skipTutorial && !save.get('tutorialDone', false)) {
    startTutorial();
  } else {
    tutorial.active = false;
    ui.hideTutorial();
  }
}

function startGame() {
  startRun();
}

function pause() {
  if (state === 'playing') {
    state = 'paused';
    ui.showPause();
  }
}

function resume() {
  if (state === 'paused') {
    state = 'playing';
    ui.hidePause();
    lastTime = performance.now();
  }
}

function restart() {
  state = 'title';
  ui.showTitle();
  audio.stopBgm();
}

function retry() {
  startRun(undefined, { skipTutorial: true });
}

// ---------------------------------------------------------------- 教程

function positionTutorialSpotlight() {
  const stepId = tutorial.steps[tutorial.step];
  let rect;
  if (stepId === 'steer') {
    rect = { x: WORLD.BOARD_X, y: WORLD.BOARD_Y, w: WORLD.BOARD_W, h: WORLD.BOARD_H };
  } else if (stepId === 'eat') {
    const f = run.food || run.snake[0];
    rect = { x: WORLD.BOARD_X + f.x * WORLD.CELL, y: WORLD.BOARD_Y + f.y * WORLD.CELL, w: WORLD.CELL, h: WORLD.CELL };
  } else {
    rect = { x: 1060, y: 10, w: 210, h: 54 };
  }
  ui.positionSpotlight(rect);
}

function startTutorial() {
  if (state !== 'playing') startRun(undefined, { skipTutorial: true });
  tutorial.active = true;
  tutorial.step = 0;
  tutorial.current = tutorial.steps[0];
  tutorial.foodEatenStart = run.foodEaten;
  ui.showGame();
  ui.showTutorial(tutorial.current, 0, tutorial.steps.length);
  positionTutorialSpotlight();
}

function finishTutorial() {
  tutorial.active = false;
  ui.hideTutorial();
  save.set('tutorialDone', true);
}

function advanceTutorial() {
  tutorial.step += 1;
  if (tutorial.step >= tutorial.steps.length) {
    finishTutorial();
    return;
  }
  tutorial.current = tutorial.steps[tutorial.step];
  if (tutorial.step === 1) tutorial.foodEatenStart = run.foodEaten;
  ui.showTutorial(tutorial.current, tutorial.step, tutorial.steps.length);
  positionTutorialSpotlight();
}

// ---------------------------------------------------------------- 结算

function computeStars(score, length) {
  if (run.phase === 'won' || score >= 900) return 3;
  if (score >= 400) return 2;
  if (score >= 50) return 1;
  return 0;
}

function onGameEnd(win) {
  if (state === 'result') return;
  state = 'result';
  const score = run.score;
  const best = save.get('best', 0);
  const newBest = score > best;
  if (newBest) save.set('best', score);
  const stars = computeStars(score, run.snake.length);
  ui.showResult({ win, score, length: run.snake.length, stars, newBest, best: Math.max(best, score) });
  if (win) Sdk.levelCleared({ score, length: run.snake.length });
  else Sdk.gameOver({ score, length: run.snake.length });
  Sdk.track(win ? 'win' : 'fail', { score });
  audio.stopBgm();
}

// ---------------------------------------------------------------- 反馈

function spawnParticles(cell, color, count) {
  const p = toPx(cell);
  const n = reducedMotion ? Math.ceil(count / 2) : count;
  for (let i = 0; i < n; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const sp = 1 + Math.random() * 2.5;
    fx.particles.push({
      x: p.x,
      y: p.y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 0.4 + Math.random() * 0.4,
      maxLife: 0.8,
      color,
      size: 2 + Math.random() * 3,
    });
  }
  if (fx.particles.length > 180) fx.particles.splice(0, fx.particles.length - 180);
}

function consumeEvents() {
  const events = run.drainEvents();
  for (const e of events) {
    audio.event(e.type, e);
    if (e.type === 'food') spawnParticles({ x: e.x, y: e.y }, '124,255,107', 12);
    else if (e.type === 'goldEat') spawnParticles({ x: e.x, y: e.y }, '255,211,77', 20);
    else if (e.type === 'death') spawnParticles(run.snake[0], '255,62,200', 24);
    if (e.type === 'win') onGameEnd(true);
    else if (e.type === 'death') onGameEnd(false);
  }
}

// ---------------------------------------------------------------- 步进

function stepOnce() {
  const pendingBefore = run.pending.length;
  input.boost = boostDown || touchBoostDown;
  stepRun(run, input, STEP);
  const steered = run.pending.length > pendingBefore;
  input.dir = null;

  consumeEvents();
  if (state !== 'playing') return;

  // 教程推进（真实动作触发）
  if (tutorial.active) {
    if (tutorial.step === 0 && steered) advanceTutorial();
    else if (tutorial.step === 1 && run.foodEaten > tutorial.foodEatenStart) advanceTutorial();
    else if (tutorial.step === 2 && run.boosting) advanceTutorial();
  }

  // 拖尾
  if (run.moves !== lastMoves) {
    lastMoves = run.moves;
    const hp = toPx(run.snake[0]);
    fx.trail.unshift(hp);
    if (fx.trail.length > 24) fx.trail.pop();
  }
}

function updateFx(dt) {
  for (const p of fx.particles) {
    p.x += p.vx * dt * 60;
    p.y += p.vy * dt * 60;
    p.life -= dt;
  }
  fx.particles = fx.particles.filter((p) => p.life > 0);
}

// ---------------------------------------------------------------- 输入

function dirFromKey(code) {
  if (code === 'ArrowUp' || code === 'KeyW') return { x: 0, y: -1 };
  if (code === 'ArrowDown' || code === 'KeyS') return { x: 0, y: 1 };
  if (code === 'ArrowLeft' || code === 'KeyA') return { x: -1, y: 0 };
  if (code === 'ArrowRight' || code === 'KeyD') return { x: 1, y: 0 };
  return null;
}

window.addEventListener('keydown', (e) => {
  const d = dirFromKey(e.code);
  if (d) {
    e.preventDefault();
    if (state === 'playing') input.dir = d;
    else if (state === 'title') { startGame(); input.dir = d; }
    return;
  }
  if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
    e.preventDefault();
    if (state === 'playing') boostDown = true;
    else if (state === 'title') startGame();
    return;
  }
  if (e.code === 'Escape') {
    if (state === 'playing') pause();
    else if (state === 'paused') resume();
    return;
  }
  if (e.code === 'KeyR') {
    if (state === 'playing' || state === 'result') retry();
    return;
  }
  if (e.code === 'KeyM') {
    toggleMute();
    return;
  }
  if (e.code === 'Enter' && state === 'title') {
    startGame();
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') boostDown = false;
});

// 触屏滑动转向
{
  let sx = null;
  let sy = null;
  const el = document.getElementById('game-container');
  el.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0];
    sx = t.clientX;
    sy = t.clientY;
  }, { passive: true });
  el.addEventListener('touchmove', (e) => {
    if (sx == null || sy == null) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - sx;
    const dy = t.clientY - sy;
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
    let d;
    if (Math.abs(dx) > Math.abs(dy)) d = dx > 0 ? { x: 1, y: 0 } : { x: -1, y: 0 };
    else d = dy > 0 ? { x: 0, y: 1 } : { x: 0, y: -1 };
    sx = t.clientX;
    sy = t.clientY;
    if (state === 'playing') input.dir = d;
    else if (state === 'title') { startGame(); input.dir = d; }
  }, { passive: true });
  el.addEventListener('touchend', () => { sx = null; sy = null; }, { passive: true });
}

// 触屏冲刺按钮
{
  const btn = ui.btnBoost;
  btn.addEventListener('pointerdown', (e) => { e.preventDefault(); touchBoostDown = true; });
  btn.addEventListener('pointerup', () => { touchBoostDown = false; });
  btn.addEventListener('pointerleave', () => { touchBoostDown = false; });
  btn.addEventListener('pointercancel', () => { touchBoostDown = false; });
}

function toggleMute() {
  const m = audio.setMuted(!ui.muted);
  ui.setMuteLabel(m);
  save.set('muted', m);
}

// ---------------------------------------------------------------- UI 事件

ui.init();

ui.btnStart.addEventListener('click', () => { audio.event('click', {}); startGame(); });
ui.btnHowto.addEventListener('click', () => { audio.event('click', {}); startTutorial(); });
ui.btnResume.addEventListener('click', () => { audio.event('click', {}); resume(); });
document.getElementById('btn-restart2').addEventListener('click', () => { audio.event('click', {}); retry(); });
document.getElementById('btn-home3').addEventListener('click', () => { audio.event('click', {}); restart(); });
document.getElementById('btn-replay').addEventListener('click', () => { audio.event('click', {}); startTutorial(); });
document.getElementById('btn-replay-pause').addEventListener('click', () => { audio.event('click', {}); startTutorial(); });
document.getElementById('btn-home').addEventListener('click', () => { audio.event('click', {}); restart(); });
document.getElementById('btn-restart').addEventListener('click', () => { audio.event('click', {}); retry(); });
document.getElementById('btn-mute').addEventListener('click', () => { audio.event('click', {}); toggleMute(); });
ui.btnRetry.addEventListener('click', () => { audio.event('click', {}); retry(); });
document.getElementById('btn-home2').addEventListener('click', () => { audio.event('click', {}); restart(); });
ui.tutSkip.addEventListener('click', () => { audio.event('click', {}); finishTutorial(); });
ui.tutNext.addEventListener('click', () => { audio.event('click', {}); finishTutorial(); });
document.getElementById('btn-rotate-skip').addEventListener('click', () => { ui.hideRotateHint(); });

for (const sel of ui.langSelects) {
  if (sel) sel.addEventListener('change', (e) => ui.setLang(e.target.value));
}

// 初始音量状态
{
  const m = !!save.get('muted', false);
  audio.setMuted(m);
  ui.setMuteLabel(m);
}

// ---------------------------------------------------------------- 主循环

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  if (state === 'playing') {
    accumulator += dt;
    let guard = 0;
    while (accumulator >= STEP && state === 'playing' && guard < 8) {
      stepOnce();
      accumulator -= STEP;
      guard += 1;
    }
    updateFx(dt);
    renderer.render(run, fx);
    ui.updateHUD(getHud(run), save.get('best', 0));
  } else if (state === 'paused' || state === 'result') {
    updateFx(dt);
    renderer.render(run, fx);
  } else {
    renderer.render(null);
  }
}

// ---------------------------------------------------------------- 调试契约

function fastForward() {
  let guard = 0;
  while (run.phase === 'playing' && guard < 60 * 130) {
    const d = greedyDir(run);
    const b = greedyBoost(run);
    stepRun(run, { dir: d, boost: b }, STEP);
    run.drainEvents();
    guard += 1;
  }
  if (run.phase === 'won') onGameEnd(true);
  else if (run.phase === 'lost') onGameEnd(false);
}

function jump(seconds) {
  const target = run.elapsedMs + seconds * 1000;
  let guard = 0;
  while (run.phase === 'playing' && run.elapsedMs < target && guard < 60 * seconds + 10) {
    const d = greedyDir(run);
    const b = greedyBoost(run);
    stepRun(run, { dir: d, boost: b }, STEP);
    run.drainEvents();
    guard += 1;
  }
}

function forceWin() {
  run.phase = 'won';
  run.boosting = false;
  if (run.score < 50) run.score = 1200;
  if (run.snake.length < 10) {
    while (run.snake.length < 10) run.snake.push({ ...run.snake[run.snake.length - 1] });
  }
  onGameEnd(true);
}

function forceLose() {
  run.phase = 'lost';
  run.boosting = false;
  onGameEnd(false);
}

window.__ll = {
  get state() { return { phase: state, lang: ui.lang, dir: ui.dir }; },
  start: () => startGame(),
  startAct: (n) => startGame(),
  pause,
  resume,
  restart,
  get run() { return run; },
  tutorial: {
    get active() { return tutorial.active; },
    get step() { return tutorial.step; },
    get steps() { return tutorial.steps; },
    get current() { return tutorial.current; },
    skip: () => finishTutorial(),
    startTutorial: () => startTutorial(),
  },
  save: () => save,
  ui: () => ui,
  sdk: () => Sdk,
  debug: {
    state: () => getState(run),
    startSeeded: (seed) => startRun(seed, { skipTutorial: true }),
    fastForward: () => fastForward(),
    jump: (seconds) => jump(seconds),
    forceWin: () => forceWin(),
    forceLose: () => forceLose(),
  },
};

window.G = { run: () => run, state: () => state, save, ui, Sdk, audio };

// ---------------------------------------------------------------- 启动

// 把整个 1280×720 stage 等比缩放到视口（canvas 与 DOM 覆盖层一起缩放，避免移动端 HUD 遮棋盘）
function fitStage() {
  const c = document.getElementById('game-container');
  const s = Math.min(window.innerWidth / WORLD.WIDTH, window.innerHeight / WORLD.HEIGHT);
  c.style.transform = `translate(-50%, -50%) scale(${s})`;
}
window.addEventListener('resize', fitStage);
fitStage();

Sdk.ready().then(() => Sdk.track('load', {}));
ui.applyLang();
ui.showTitle();
renderer.render(null);
requestAnimationFrame(loop);
