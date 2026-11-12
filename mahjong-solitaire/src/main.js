// 主入口：麻将接龙。状态机 title → playing ⇄ paused，通关 win。
import { RULES } from '../config/game.config.js';
import { createBoard } from './game/board.js';
import { createRenderer, tileRect } from './render/index.js';
import { ui } from './ui/ui.js';
import { audio } from './audio.js';
import Sdk from './core/sdk.js';

const canvas = document.getElementById('canvas');
const renderer = createRenderer(canvas);

const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

let board = createBoard({ seed: 1 });
let state = 'title'; // title | playing | paused | win
let elapsed = 0;
let lastTime = performance.now();
let effects = { removals: [], flashes: [], hint: null, shake: null };
let deadlocked = false;

const llState = { phase: 'title', lang: ui.lang, dir: ui.dir };

function syncLl() {
  llState.phase = state;
  llState.lang = ui.lang;
  llState.dir = ui.dir;
  board.phase = state;
}

function freshSeed() {
  return Math.floor(Math.random() * 0x7fffffff);
}

function newBoard() {
  board = createBoard({ seed: freshSeed() });
  board.phase = state;
  elapsed = 0;
  effects = { removals: [], flashes: [], hint: null, shake: null };
  deadlocked = false;
}

function syncUi() {
  ui.updateHUD({ remaining: board.remaining, pairs: board.pairsDone, timeSec: elapsed });
  ui.updateButtons({
    hint: RULES.hintLimit - board.hintUsed,
    undo: RULES.undoLimit - board.undoUsed,
    shuffle: RULES.shuffleLimit - board.shuffleUsed,
  });
  ui.hud.classList.toggle('dead', deadlocked);
  if (board.shuffleUsed < RULES.shuffleLimit && board.remaining > 0) {
    ui.btnShuffle.classList.toggle('pulse', deadlocked);
  } else {
    ui.btnShuffle.classList.remove('pulse');
  }
}

function checkDeadlock() {
  deadlocked = board.remaining > 0 && board.findPair() === null;
}

function startGame() {
  newBoard();
  state = 'playing';
  syncLl();
  Sdk.newRun({ mode: 'turtle' });
  ui.showGame();
  syncUi();
  lastTime = performance.now();
}

function backToTitle() {
  newBoard();
  state = 'title';
  syncLl();
  ui.showTitle();
  ui.updateBest(Sdk.load('best', 0));
}

function restartRun() {
  startGame();
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

function doPick(index) {
  const r = board.pick(index);
  if (r.selected != null) {
    audio.click();
    return;
  }
  if (r.matched) {
    const now = performance.now();
    audio.match();
    for (const i of r.pair) {
      const t = board.tiles[i];
      effects.removals.push({
        rect: tileRect(t), kind: t.kind, layer: t.layer, t0: now, dur: RULES.matchAnimMs,
      });
      renderer.burst(tileRect(t).x + 30, tileRect(t).y + 40, '#ffd76a');
    }
    if (!REDUCED) effects.shake = now;
    effects.hint = null;
    Sdk.track('pair_matched', { remaining: board.remaining });
    if (board.remaining === 0) {
      const stars = board.getState().stars;
      state = 'win';
      syncLl();
      const best = Sdk.load('best', 0);
      if (!best || elapsed < best) Sdk.save('best', Math.round(elapsed));
      Sdk.levelCleared({ level: 1, time: Math.round(elapsed), stars });
      ui.showWin(elapsed, stars);
      audio.win();
    }
    checkDeadlock();
    syncUi();
  } else if (r.wrong) {
    audio.wrong();
    const now = performance.now();
    for (const i of r.wrong) effects.flashes.push({ i, until: now + 320 });
    effects.hint = null;
  }
  if (r.matched || r.wrong) syncUi();
}

function doHint() {
  const pair = board.hint();
  if (pair) {
    effects.hint = pair;
    audio.click();
    syncUi();
  }
}

function doUndo() {
  if (board.undo()) {
    effects.hint = null;
    effects.removals = [];
    effects.flashes = [];
    audio.click();
    checkDeadlock();
    syncUi();
  }
}

function doShuffle() {
  if (board.shuffle()) {
    effects.hint = null;
    effects.removals = [];
    effects.flashes = [];
    audio.click();
    checkDeadlock();
    syncUi();
  }
}

function doMute() {
  audio.setMuted(!audio.muted);
  Sdk.save('muted', audio.muted);
  ui.updateMute(audio.muted);
}

// ---- 输入 ---------------------------------------------------------------
function canvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY,
  };
}

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (state !== 'playing') return;
  const p = canvasPos(e);
  const index = renderer.hitTest(p.x, p.y, board);
  if (index >= 0) doPick(index);
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (state === 'playing') pauseGame();
    else if (state === 'paused') resumeGame();
  }
});

window.addEventListener('blur', () => {
  if (state === 'playing') pauseGame();
});

// ---- 按钮 ---------------------------------------------------------------
ui.btnStart.addEventListener('click', () => { audio.unlock(); startGame(); });
ui.btnResume.addEventListener('click', resumeGame);
ui.btnRestart.addEventListener('click', restartRun);
ui.btnAgain.addEventListener('click', startGame);
ui.btnTitle.addEventListener('click', backToTitle);
ui.btnHint.addEventListener('click', doHint);
ui.btnUndo.addEventListener('click', doUndo);
ui.btnShuffle.addEventListener('click', doShuffle);
ui.btnMute.addEventListener('click', doMute);
for (const sel of ui.langSelects) {
  if (sel) sel.addEventListener('change', (e) => { ui.setLang(e.target.value); syncLl(); });
}

Sdk.onAdStart(() => pauseGame());
Sdk.onAdEnd(() => resumeGame());

// ---- 主循环 -------------------------------------------------------------
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  if (state === 'playing') {
    elapsed += dt;
    board.elapsed = elapsed;
  }

  renderer.update(dt);
  renderer.render({ board, effects, now });

  if (state === 'playing') {
    ui.updateHUD({ remaining: board.remaining, pairs: board.pairsDone, timeSec: elapsed });
  }
}

// ---- 初始化 -------------------------------------------------------------
Sdk.ready();
audio.setMuted(Sdk.load('muted', false));
ui.applyLang();
ui.showTitle();
ui.updateBest(Sdk.load('best', 0));
ui.updateMute(audio.muted);
syncLl();
checkDeadlock();
syncUi();
requestAnimationFrame(loop);

// ---- 调试契约 -----------------------------------------------------------
window.G = {
  board: () => board,
  state: () => state,
  ui,
};

window.__ll = {
  state: llState,
  start: startGame,
  pause: pauseGame,
  resume: resumeGame,
  restart: backToTitle,
  startAct: startGame,
  sim: board,
  save: (k, v) => Sdk.save(k, v),
  load: (k, d) => Sdk.load(k, d),
  ui: () => ui,
  debug: {
    state: () => board.getState(),
    pick: (i) => board.pick(i),
    hint: () => board.hint(),
    shuffle: () => board.shuffle(),
    autoSolvePair: () => board.autoSolvePair(),
  },
};
