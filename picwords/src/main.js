// 主入口：PICWORDS。状态机 title → playing ⇄ paused → clear。
import { WORLD, COLORS, RULES, CONFIG } from '../config/game.config.js';
import {
  createRun, tapTile, tapSlot, clearSlots, useHint, nextLevel, getHud, drainEvents, LEVEL_COUNT,
} from './game/sim.js';
import { createRenderer } from './render/index.js';
import { preload } from './render/art.js';
import { ui } from './ui/ui.js';
import { audio } from './audio.js';
import Sdk from './core/sdk.js';
import { t, i18n } from './core/i18n.js';

const canvas = document.getElementById('canvas');
const renderer = createRenderer(canvas);

let run = createRun({ level: 0, seed: 1 });
let state = 'title';
let best = Sdk.load('best', 0);
let lastTime = performance.now();

const llState = { phase: 'title', lang: ui.lang, dir: ui.dir };

function syncLl() {
  llState.phase = state;
  llState.lang = ui.lang;
  llState.dir = ui.dir;
}
function refreshHint() {
  ui.setHint(run.picture.hint[i18n.lang] || run.picture.hint.en);
}
function syncUi() {
  ui.updateHUD(getHud(run));
}

// ---- 事件 → 表现 ---------------------------------------------------------
function processEvents() {
  for (const ev of drainEvents(run)) {
    if (ev.type === 'place') {
      audio.place();
    } else if (ev.type === 'correct') {
      audio.correct();
      renderer.flashCorrect();
      onClear();
    } else if (ev.type === 'wrong') {
      audio.wrong();
      renderer.flashWrong();
    } else if (ev.type === 'hint') {
      audio.hint();
    }
  }
}

function doTapTile(idx) {
  tapTile(run, idx);
  processEvents();
  syncUi();
}
function doTapSlot(idx) {
  tapSlot(run, idx);
  audio.click();
  syncUi();
}
function doHint() {
  const h = useHint(run);
  if (!h) audio.wrong();
  processEvents();
  syncUi();
}
function doClear() {
  clearSlots(run);
  audio.click();
  syncUi();
}

// ---- 状态机 --------------------------------------------------------------
function startGame() {
  run = createRun({ level: 0, seed: Math.floor(Math.random() * 0x7fffffff) });
  renderer.clearEffects();
  state = 'playing';
  syncLl();
  Sdk.newRun({ mode: 'picwords' });
  ui.showGame();
  refreshHint();
  syncUi();
  lastTime = performance.now();
}
function doNext() {
  nextLevel(run);
  renderer.clearEffects();
  state = 'playing';
  syncLl();
  ui.hideClear();
  refreshHint();
  syncUi();
  lastTime = performance.now();
}
function backToTitle() {
  state = 'title';
  syncLl();
  ui.showTitle();
  ui.updateBest(best);
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
function onClear() {
  state = 'clear';
  syncLl();
  if (run.score > best) { best = run.score; Sdk.save('best', best); }
  Sdk.levelCleared({ level: run.level, score: run.score });
  ui.showClear(run.word);
  audio.complete();
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
canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (state !== 'playing') return;
  const p = canvasPos(e);
  const tile = renderer.hitTile(p.x, p.y, run);
  if (tile >= 0) { doTapTile(tile); return; }
  const slot = renderer.hitSlot(p.x, p.y, run);
  if (slot >= 0) doTapSlot(slot);
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (state === 'playing') pauseGame();
    else if (state === 'paused') resumeGame();
  }
  if (state === 'playing') {
    if (e.code === 'KeyH') doHint();
    if (e.code === 'Backspace') {
      for (let i = run.slots.length - 1; i >= 0; i -= 1) {
        if (run.slots[i] !== null) { doTapSlot(i); break; }
      }
      e.preventDefault();
    }
  }
});
window.addEventListener('blur', () => { if (state === 'playing') pauseGame(); });

// ---- 按钮 ----------------------------------------------------------------
ui.btnStart.addEventListener('click', () => { audio.unlock(); startGame(); });
ui.btnResume.addEventListener('click', resumeGame);
ui.btnRestart.addEventListener('click', startGame);
ui.btnNext.addEventListener('click', doNext);
ui.btnTitle.addEventListener('click', backToTitle);
ui.btnHint.addEventListener('click', doHint);
ui.btnClear.addEventListener('click', doClear);
ui.btnMute.addEventListener('click', doMute);
ui.btnPause.addEventListener('click', () => { if (state === 'playing') pauseGame(); });
for (const sel of ui.langSelects) {
  if (sel) sel.addEventListener('change', (e) => { ui.setLang(e.target.value); syncLl(); if (state === 'playing') refreshHint(); });
}

Sdk.onAdStart(() => pauseGame());
Sdk.onAdEnd(() => resumeGame());

// ---- 主循环 --------------------------------------------------------------
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  renderer.update(dt);
  renderer.render({ run });
}

// ---- 初始化 --------------------------------------------------------------
Sdk.ready();
audio.setMuted(Sdk.load('muted', false));
audio.loadBgm();
preload();
ui.applyLang();
ui.showTitle();
ui.updateBest(best);
ui.updateMute(audio.muted);
syncLl();
syncUi();
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
    tapTile: (i) => { doTapTile(i); return getHud(run); },
    tapSlot: (i) => { doTapSlot(i); return getHud(run); },
    hint: () => { const h = useHint(run); processEvents(); syncUi(); return h; },
    solve: () => {
      clearSlots(run);
      for (const letter of run.word) {
        const idx = run.tiles.findIndex((x) => !x.used && x.letter === letter);
        tapTile(run, idx);
      }
      processEvents();
      syncUi();
      return getHud(run);
    },
    next: () => { doNext(); return getHud(run); },
  },
};