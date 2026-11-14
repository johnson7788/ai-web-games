// 主入口：PING PONG PRO。状态机 title → playing ⇄ paused → over。
import { WORLD, STEP, TABLE, COLORS, RULES, CONFIG } from '../config/game.config.js';
import { createRun, tick, getHud, drainEvents } from './game/sim.js';
import { createRenderer } from './render/index.js';
import { ui } from './ui/ui.js';
import { audio } from './audio.js';
import Sdk from './core/sdk.js';

const canvas = document.getElementById('canvas');
const renderer = createRenderer(canvas);

let run = createRun({ seed: 1 });
let state = 'title';
let wins = Sdk.load('wins', 0);
let lastTime = performance.now();
let accumulator = 0;
const input = { move: 0, targetX: null };
const keys = { left: false, right: false };

const llState = { phase: 'title', lang: ui.lang, dir: ui.dir };

function syncLl() {
  llState.phase = state;
  llState.lang = ui.lang;
  llState.dir = ui.dir;
}

// ---- 事件 → 表现 ---------------------------------------------------------
function processEvents() {
  for (const ev of drainEvents(run)) {
    if (ev.type === 'hit') audio.hit();
    else if (ev.type === 'wall') audio.wall();
    else if (ev.type === 'point') { audio.point(); renderer.flashPoint(); }
    else if (ev.type === 'win') onWin(ev.winner);
  }
}

// ---- 状态机 --------------------------------------------------------------
function startGame() {
  run = createRun({ seed: Math.floor(Math.random() * 0x7fffffff) });
  renderer.clearEffects();
  accumulator = 0;
  state = 'playing';
  syncLl();
  Sdk.newRun({ mode: 'pong' });
  ui.showGame();
  lastTime = performance.now();
}
function backToTitle() {
  state = 'title';
  syncLl();
  ui.showTitle();
  ui.updateBest(wins);
}
function pauseGame() {
  if (state !== 'playing') return;
  state = 'paused';
  syncLl();
  ui.showPause();
}
function resumeGame() {
  if (state !== 'paused') return;
  state = 'playing';
  syncLl();
  ui.hidePause();
  lastTime = performance.now();
}
function onWin(winner) {
  state = 'over';
  syncLl();
  if (winner === 0) { wins += 1; Sdk.save('wins', wins); audio.win(); }
  else audio.lose();
  Sdk.gameOver({ winner });
  ui.showEnd(winner === 0);
}
function doMute() {
  audio.setMuted(!audio.muted);
  Sdk.save('muted', audio.muted);
  ui.updateMute(audio.muted);
}

// ---- 输入 ----------------------------------------------------------------
function canvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (canvas.width / rect.width),
    y: (e.clientY - rect.top) * (canvas.height / rect.height),
  };
}
canvas.addEventListener('pointermove', (e) => {
  if (state !== 'playing') return;
  input.targetX = canvasPos(e).x;
});
canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (state !== 'playing') return;
  input.targetX = canvasPos(e).x;
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (state === 'playing') pauseGame();
    else if (state === 'paused') resumeGame();
    return;
  }
  if (e.code === 'KeyA' || e.code === 'ArrowLeft') { keys.left = true; input.targetX = null; }
  if (e.code === 'KeyD' || e.code === 'ArrowRight') { keys.right = true; input.targetX = null; }
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = false;
  if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = false;
});
window.addEventListener('blur', () => { keys.left = false; keys.right = false; if (state === 'playing') pauseGame(); });

// ---- 按钮 ----------------------------------------------------------------
ui.btnStart.addEventListener('click', () => { audio.unlock(); startGame(); });
ui.btnResume.addEventListener('click', resumeGame);
ui.btnRestart.addEventListener('click', startGame);
ui.btnAgain.addEventListener('click', startGame);
ui.btnTitle.addEventListener('click', backToTitle);
ui.btnMute.addEventListener('click', doMute);
ui.btnPause.addEventListener('click', () => { if (state === 'playing') pauseGame(); });
for (const sel of ui.langSelects) {
  if (sel) sel.addEventListener('change', (e) => { ui.setLang(e.target.value); syncLl(); });
}

Sdk.onAdStart(() => pauseGame());
Sdk.onAdEnd(() => resumeGame());

// ---- 主循环（定步长物理） ------------------------------------------------
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  if (state === 'playing') {
    input.move = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    accumulator += dt;
    while (accumulator >= STEP) {
      tick(run, STEP, input);
      accumulator -= STEP;
    }
    processEvents();
  }
  renderer.update(dt);
  renderer.render({ run });
}

// ---- 初始化 --------------------------------------------------------------
Sdk.ready();
audio.setMuted(Sdk.load('muted', false));
ui.applyLang();
ui.showTitle();
ui.updateBest(wins);
ui.updateMute(audio.muted);
syncLl();
requestAnimationFrame(loop);

// ---- 调试契约 ------------------------------------------------------------
window.G = { run: () => run, state: () => state, ui };

window.__ll = {
  state: llState,
  start: startGame,
  pause: pauseGame,
  resume: resumeGame,
  restart: backToTitle,
  startAct: startGame,
  sim: run,
  save: (k, v) => Sdk.save(k, v),
  load: (k, d) => Sdk.load(k, d),
  ui: () => ui,
  debug: {
    state: () => getHud(run),
    step: (sec, inp) => { const n = Math.ceil(sec * 60); for (let i = 0; i < n; i += 1) tick(run, 1 / 60, inp || {}); processEvents(); return getHud(run); },
    setScore: (a, b) => { run.scores = [a, b]; return run.scores; },
    movePaddle: (x) => { input.targetX = x; return x; },
    playAll: () => {
      let guard = 0;
      while (run.phase !== 'over' && guard < 20000) {
        // 简单 AI 代打：球拍追球
        tick(run, 1 / 60, { targetX: run.ball.x });
        processEvents();
        guard += 1;
      }
      return getHud(run);
    },
  },
};