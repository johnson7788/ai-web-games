// src/main.js — 装配：固定步长 / 输入手势 / 事件分发 / 状态机 / SDK / 音频。
import { STEP, WORLD } from '../config/game.config.js';
import { LEVELS } from '../config/levels.js';
import { createRun } from './game/sim.js';
import { createRender } from './render/index.js';
import { createUI } from './ui/index.js';
import { createAudio } from './core/audio.js';
import { i18n } from './core/i18n.js';
import Sdk from './core/sdk.js';

const canvas = document.getElementById('canvas');
const uiRoot = document.getElementById('ui-root');
const loadingEl = document.getElementById('loading');

const renderer = createRender(canvas);
const audio = createAudio();
const ui = createUI(uiRoot, {
  onStart: () => startGame(),
  onResume: () => resumeGame(),
  onRestart: () => toTitle(),
  onNext: () => advanceLevel(),
  onRetry: () => retryLevel(),
  onShare: () => shareResult(),
  onHint: () => useHint(),
  onHelp: () => useDoctorHelp(),
});

// ---------- 状态 ----------
let state = 'boot';             // boot | title | playing | paused | solved | complete
let run = null;
let lastTime = 0;
let accumulator = 0;
let expression = 'neutral';
let dragState = null;           // { id, x, y } 拖拽中的物体（渲染用）
let gestureQueue = [];          // 待消费手势（pointerup 入队，主循环逐帧消费）
let bestTimes = [];             // 每关最佳时间（ms）
let totalBestMs = 0;
let cleared = 0;
let lastClear = null;

// ---------- 输入手势（pointer → tap/drag）----------
const TAP_THRESHOLD = 10;
let pointer = null;             // { id, startX, startY, x, y, moved }

function canvasToWorld(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(rect.width / WORLD.WIDTH, rect.height / WORLD.HEIGHT);
  const ox = (rect.width - WORLD.WIDTH * scale) / 2;
  const oy = (rect.height - WORLD.HEIGHT * scale) / 2;
  return { x: (clientX - rect.left - ox) / scale, y: (clientY - rect.top - oy) / scale };
}

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  const p = canvasToWorld(e.clientX, e.clientY);
  const obj = run && run.phase === 'playing' ? run.hitDraggable(p.x, p.y) : null;
  pointer = { id: obj ? obj.id : null, startX: p.x, startY: p.y, x: p.x, y: p.y, moved: false };
  if (obj) dragState = { id: obj.id, x: p.x, y: p.y };
});

canvas.addEventListener('pointermove', (e) => {
  if (!pointer) return;
  const p = canvasToWorld(e.clientX, e.clientY);
  pointer.x = p.x;
  pointer.y = p.y;
  if (Math.hypot(p.x - pointer.startX, p.y - pointer.startY) > TAP_THRESHOLD) pointer.moved = true;
  if (pointer.id && dragState) {
    dragState.x = p.x;
    dragState.y = p.y;
  }
});

function finishPointer(e) {
  if (!pointer) return;
  const p = canvasToWorld(e.clientX, e.clientY);
  const moved = pointer.moved || Math.hypot(p.x - pointer.startX, p.y - pointer.startY) > TAP_THRESHOLD;
  if (pointer.id && moved) {
    gestureQueue.push({ kind: 'drag', id: pointer.id, fromX: pointer.startX, fromY: pointer.startY, toX: p.x, toY: p.y });
  } else {
    gestureQueue.push({ kind: 'tap', x: p.x, y: p.y });
  }
  pointer = null;
  dragState = null;
}

canvas.addEventListener('pointerup', finishPointer);
canvas.addEventListener('pointercancel', () => { pointer = null; dragState = null; });
canvas.addEventListener('pointerleave', () => { /* 保留 pointer，出画布释放由 pointerup 处理 */ });

// ---------- 键盘 ----------
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') { togglePause(); }
  else if (e.code === 'Enter') {
    if (state === 'title') startGame();
    else if (state === 'solved') advanceLevel();
    else if (state === 'complete') toTitle();
  } else if (e.code === 'KeyR' && (state === 'solved' || state === 'complete')) { retryLevel(); }
});

// ---------- 音频设置持久化 ----------
function applyAudioSettings() {
  const muted = Sdk.load('muted', false);
  const vol = Sdk.load('volume', 0.8);
  audio.setMuted(!!muted);
  audio.setVolume(vol);
}

function updateTotalBest() {
  totalBestMs = bestTimes.reduce((a, b) => a + (b || 0), 0);
}

// ---------- 游戏流转 ----------
function startGame() {
  audio.unlock();
  run = createRun({ levelIndex: 0 });
  state = 'playing';
  gestureQueue = [];
  dragState = null;
  pointer = null;
  expression = 'neutral';
  accumulator = 0;
  lastTime = performance.now();
  ui.show('playing');
  Sdk.newRun({ zone: 1 });
  audio.playBgm();
  applyAudioSettings();
}

function jumpToLevel(n) {
  const idx = Math.max(0, Math.min(LEVELS.length - 1, Math.floor(Number(n) || 1) - 1));
  run = createRun({ levelIndex: idx });
  state = 'playing';
  gestureQueue = [];
  dragState = null;
  pointer = null;
  expression = 'neutral';
  lastTime = performance.now();
  ui.show('playing');
}

function togglePause() {
  if (state === 'playing') { state = 'paused'; ui.show('paused'); }
  else if (state === 'paused') { resumeGame(); }
}
function resumeGame() {
  if (state === 'paused') { state = 'playing'; ui.show('playing'); lastTime = performance.now(); }
}

function toTitle() {
  state = 'title';
  run = null;
  gestureQueue = [];
  dragState = null;
  ui.show('title');
  renderer.draw(null, { lang: i18n.lang });
  audio.stopBgm();
  Sdk.track('restart', {});
}

function advanceLevel() {
  if (!run) return;
  if (run.phase === 'complete') { toTitle(); return; }
  run.nextLevel();
  state = 'playing';
  gestureQueue = [];
  dragState = null;
  expression = 'neutral';
  lastTime = performance.now();
  ui.show('playing');
  audio.playBgm();
}

function retryLevel() {
  if (!run) { startGame(); return; }
  run.resetLevel();
  state = 'playing';
  gestureQueue = [];
  dragState = null;
  expression = 'neutral';
  lastTime = performance.now();
  ui.show('playing');
}

function useHint() {
  if (!run || run.phase !== 'playing') return;
  audio.unlock();
  if (run.useHint()) ui.setHud(hudPayload());
}

function useDoctorHelp() {
  if (!run || run.phase !== 'playing') return;
  audio.unlock();
  if (run.doctorSolve()) {
    Sdk.gameOver({ level: run.levelIndex + 1, reason: 'doctor-help' });
    drainNow();
  }
}

async function shareResult() {
  const n = run ? run.levelIndex + 1 : 1;
  await Sdk.share({
    title: 'BRAIN TEASE',
    text: i18n.lang === 'zh' ? `我在脑力试炼过了 ${n} 关！` : `I cracked ${n} levels in BRAIN TEASE!`,
  });
  Sdk.track('share', { level: n });
}

// ---------- 事件分发 ----------
function setExpressionFor(ev) {
  if (ev.type === 'roast') expression = 'laugh';
  else if (ev.type === 'wrong') expression = 'annoyed';
}

function dispatchEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    setExpressionFor(ev);

    if (ev.type === 'levelClear') {
      const best = bestTimes[ev.levelIndex] || 0;
      const newRecord = best === 0 || ev.elapsedMs < best;
      if (newRecord && ev.elapsedMs > 0) {
        bestTimes[ev.levelIndex] = ev.elapsedMs;
        Sdk.save('bestTimes', bestTimes);
        updateTotalBest();
      }
      if (ev.levelNumber > cleared) {
        cleared = ev.levelNumber;
        Sdk.save('cleared', cleared);
        ui.setCleared(cleared);
      }
      lastClear = { stars: ev.stars, elapsedMs: ev.elapsedMs, newRecord, lastLevel: ev.levelIndex >= LEVELS.length - 1 };
      Sdk.levelCleared({ level: ev.levelNumber, stars: ev.stars });
      Sdk.track('newRecord', { level: ev.levelNumber, ms: ev.elapsedMs, record: newRecord });
    } else if (ev.type === 'wrong') {
      Sdk.track('wrong', { level: run.levelIndex + 1 });
    } else if (ev.type === 'hint') {
      Sdk.track('hint', { level: run.levelIndex + 1 });
    } else if (ev.type === 'doctorSolve') {
      Sdk.track('doctorSolve', { level: run.levelIndex + 1 });
    }

    if (state === 'playing') ui.tutorial.onGameEvent(ev, performance.now());
  }
}

/** 立即消费一次事件（doctorSolve 等非逐帧路径用）。 */
function drainNow() {
  dispatchEvents(run.drainEvents());
  if (run.phase === 'solved' || run.phase === 'complete') onSolved();
}

function hudPayload() {
  const h = run.getHud();
  h.totalStars = run.stars.reduce((a, b) => a + b, 0);
  return h;
}

// ---------- 结算 ----------
function onSolved() {
  if (run.phase === 'complete') {
    state = 'complete';
    ui.els.completeTime.textContent = fmtTime(totalBestMs);
    ui.show('complete');
    audio.stopBgm();
    return;
  }
  state = 'solved';
  const data = lastClear || { stars: 3, elapsedMs: 0, newRecord: false, lastLevel: false };
  data.roast = run.level.roast;
  data.stars = run.stars[run.levelIndex];
  ui.show('solved', data);
  audio.stopBgm();
}

function fmtTime(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

// ---------- 主循环 ----------
function loop(now) {
  requestAnimationFrame(loop);

  if (state !== 'playing') {
    renderer.draw(run, { lang: i18n.lang, expression });
    return;
  }

  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  accumulator += dt;

  let steps = 0;
  while (accumulator >= STEP && steps < 6) {
    const gesture = gestureQueue.shift() || null;
    run.step({ gesture });
    accumulator -= STEP;
    steps += 1;
    dispatchEvents(run.drainEvents());
    if (run.phase === 'solved' || run.phase === 'complete') { onSolved(); return; }
  }

  renderer.draw(run, { lang: i18n.lang, expression, drag: dragState });
  ui.setHud(hudPayload());
  ui.tutorial.tick();
}

// ---------- 失焦自动暂停 ----------
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'playing') togglePause();
});

// ---------- 广告期间静音 ----------
Sdk.onAdStart(() => audio.setMuted(true));
Sdk.onAdEnd(() => { audio.setMuted(!!Sdk.load('muted', false)); });

// ---------- session 埋点 ----------
window.addEventListener('pagehide', () => { Sdk.track('session_end', {}); });

// ---------- 启动 ----------
(async () => {
  bestTimes = Sdk.load('bestTimes', []) || [];
  updateTotalBest();
  cleared = Sdk.load('cleared', 0) || 0;
  ui.setBest(totalBestMs);
  ui.setCleared(cleared);
  applyAudioSettings();
  await Sdk.ready();
  Sdk.track('load', { lang: i18n.lang });
  // boot 竞态守卫：异步 SDK 加载窗口内玩家可能已点 Start，只在还没开局时才显示标题。
  if (state === 'boot') { state = 'title'; ui.show('title'); }
  renderer.draw(null, { lang: i18n.lang });
  loadingEl.classList.add('hidden');
  lastTime = performance.now();
  requestAnimationFrame(loop);
})();

// ---------- 标准调试契约 ----------
window.G = {
  get run() { return run; },
  ui,
  renderer,
  audio,
  Sdk,
  get state() { return state; },
};

window.__ll = {
  get state() { return { phase: state, lang: i18n.lang, dir: i18n.dir }; },
  lang: () => i18n.lang,
  setLang: (l) => { i18n.setLang(l); ui.applyLang(); },
  get run() { return run; },
  start: startGame,
  pause: togglePause,
  resume: resumeGame,
  restart: toTitle,
  startLevel: jumpToLevel,
  solveLevel: () => { if (run && run.phase === 'playing') { run.solveCurrent(); drainNow(); } },
  nextLevel: advanceLevel,
  tutorial: {
    get active() { return ui.tutorial.active; },
    get step() { return ui.tutorial.step; },
    get steps() { return ui.tutorial.steps; },
    get current() { return ui.tutorial.current; },
    skip: () => ui.tutorial.skip(),
  },
  save: () => Sdk.save,
  ui: () => ui,
  debug: { layout: () => ({ viewport: [canvas.clientWidth, canvas.clientHeight], rotate: !!document.getElementById('rotate') }) },
};
