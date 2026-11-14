// 主入口：DAILY WORD HUNT。状态机 title → playing ⇄ paused → clear。
// 每日 seeded 词搜 + 直线划词 + 计时。Date 仅在此层使用（逻辑层无 Date）。
import { WORLD, GRID, COLORS, RULES, CONFIG } from '../config/game.config.js';
import { createRun, submitSelection, useHint, lineCells, getHud, drainEvents, hashSeed } from './game/sim.js';
import { createRenderer } from './render/index.js';
import { ui } from './ui/ui.js';
import { audio } from './audio.js';
import Sdk from './core/sdk.js';
import { t, i18n } from './core/i18n.js';

const canvas = document.getElementById('canvas');
const renderer = createRenderer(canvas);
const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function pad(n) { return String(n).padStart(2, '0'); }
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function dailyNumber() {
  return Math.floor((Date.now() - Date.UTC(2026, 0, 1)) / 86400000) + 1;
}

let run = createRun({ seed: hashSeed(todayKey()), mode: 'daily', dailyNumber: dailyNumber() });
let state = 'title';
let elapsed = 0;
let dragging = false;
let startCell = null;
let selection = [];
let hintFlash = null;
let best = Sdk.load('best', 0);
let lastTime = performance.now();

const llState = { phase: 'title', lang: ui.lang, dir: ui.dir };

function syncLl() {
  llState.phase = state;
  llState.lang = ui.lang;
  llState.dir = ui.dir;
}
function puzzleLabel() {
  return run.mode === 'daily' ? `${t('daily')} #${run.dailyNumber}` : t('newPuzzle');
}
function themeName() {
  return run.theme.name[i18n.lang] || run.theme.name.en;
}
function syncUi() {
  ui.updateHUD({ puzzleLabel: puzzleLabel(), found: run.found.size, total: run.words.length, timeSec: elapsed });
  ui.updateHint(RULES.hintLimit - run.hintsUsed);
}

// ---- 事件 → 表现 ---------------------------------------------------------
function processEvents() {
  const now = performance.now();
  for (const ev of drainEvents(run)) {
    if (ev.type === 'found') {
      audio.found(ev.streak);
      const mid = ev.cells[Math.floor(ev.cells.length / 2)];
      const rect = renderer.cellRect(mid.r, mid.c);
      renderer.burst(rect.x + GRID.CELL / 2, rect.y + GRID.CELL / 2, COLORS.gold, 16);
      renderer.popup(`+${ev.gained}`, rect.x + GRID.CELL / 2, rect.y - 10, COLORS.accent);
      Sdk.track('word_found', { word: ev.word, streak: ev.streak });
    } else if (ev.type === 'clear') {
      onClear();
    } else if (ev.type === 'hint') {
      audio.hint();
      hintFlash = { cell: ev.cell, until: now + 1200 };
    }
  }
}

function doSubmit(cells) {
  const r = submitSelection(run, cells);
  if (r.kind === 'invalid') {
    audio.invalid();
    if (!REDUCED) renderer.shake(4);
  } else if (r.kind === 'already') {
    audio.click();
    const mid = cells[Math.floor(cells.length / 2)];
    const rect = renderer.cellRect(mid.r, mid.c);
    renderer.popup(t('already'), rect.x + GRID.CELL / 2, rect.y - 10, COLORS.gold);
  }
  processEvents();
  syncUi();
  return r;
}

// ---- 状态机 --------------------------------------------------------------
function startGame(mode = 'daily') {
  const seed = mode === 'daily' ? hashSeed(todayKey()) : Math.floor(Math.random() * 0x7fffffff);
  run = createRun({ seed, mode, dailyNumber: mode === 'daily' ? dailyNumber() : 0 });
  elapsed = 0;
  dragging = false;
  selection = [];
  hintFlash = null;
  renderer.clearEffects();
  state = 'playing';
  syncLl();
  Sdk.newRun({ mode });
  ui.showGame();
  syncUi();
  lastTime = performance.now();
}

function backToTitle() {
  dragging = false;
  selection = [];
  state = 'title';
  syncLl();
  ui.showTitle();
  ui.updateBest(best);
}
function pauseGame() {
  if (state !== 'playing') return;
  state = 'paused';
  dragging = false;
  selection = [];
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
  dragging = false;
  selection = [];
  syncLl();
  if (run.score > best) {
    best = run.score;
    Sdk.save('best', best);
  }
  Sdk.levelCleared({ score: run.score, time: Math.round(elapsed), mode: run.mode });
  ui.showClear(run.score, elapsed);
  audio.clear();
}
function doHint() {
  const h = useHint(run);
  if (h) processEvents();
  else renderer.popup(t('noHints'), GRID.X + (GRID.SIZE * GRID.CELL) / 2, GRID.Y - 20, COLORS.danger);
  syncUi();
}
function doMute() {
  audio.setMuted(!audio.muted);
  Sdk.save('muted', audio.muted);
  ui.updateMute(audio.muted);
}

// ---- 网格划词输入 --------------------------------------------------------
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
  const cell = renderer.cellAt(p.x, p.y);
  if (cell) {
    dragging = true;
    startCell = cell;
    selection = [cell];
    audio.select();
    try { canvas.setPointerCapture(e.pointerId); } catch { /* noop */ }
  }
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const p = canvasPos(e);
  const cell = renderer.cellAt(p.x, p.y);
  if (cell) selection = lineCells(startCell, cell, run.size);
});
function endDrag(e) {
  if (!dragging) return;
  dragging = false;
  try { canvas.releasePointerCapture(e.pointerId); } catch { /* noop */ }
  const cells = selection;
  selection = [];
  startCell = null;
  if (cells.length >= 2) doSubmit(cells);
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', () => { dragging = false; selection = []; startCell = null; });

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (state === 'playing') pauseGame();
    else if (state === 'paused') resumeGame();
  }
});
window.addEventListener('blur', () => { if (state === 'playing') pauseGame(); });

// ---- 按钮 ----------------------------------------------------------------
ui.btnStart.addEventListener('click', () => { audio.unlock(); startGame('daily'); });
ui.btnNew.addEventListener('click', () => { audio.unlock(); startGame('random'); });
ui.btnResume.addEventListener('click', resumeGame);
ui.btnRestart.addEventListener('click', () => startGame(run.mode));
ui.btnAgain.addEventListener('click', () => startGame('random'));
ui.btnTitle.addEventListener('click', backToTitle);
ui.btnHint.addEventListener('click', doHint);
ui.btnMute.addEventListener('click', doMute);
ui.btnPause.addEventListener('click', () => { if (state === 'playing') pauseGame(); });
for (const sel of ui.langSelects) {
  if (sel) sel.addEventListener('change', (e) => { ui.setLang(e.target.value); syncLl(); });
}

Sdk.onAdStart(() => pauseGame());
Sdk.onAdEnd(() => resumeGame());

// ---- 主循环 --------------------------------------------------------------
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  if (state === 'playing') elapsed += dt;
  if (state === 'playing' || state === 'clear') renderer.update(dt);
  renderer.render({
    run,
    selection,
    hintFlash,
    now,
    listTitle: t('words'),
    themeName: themeName(),
  });
  if (state === 'playing') syncUi();
}

// ---- 初始化 --------------------------------------------------------------
Sdk.ready();
audio.setMuted(Sdk.load('muted', false));
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
  start: () => startGame('daily'),
  pause: pauseGame,
  resume: resumeGame,
  restart: backToTitle,
  startAct: () => startGame('random'),
  sim: run,
  save: (k, v) => Sdk.save(k, v),
  load: (k, d) => Sdk.load(k, d),
  ui: () => ui,
  debug: {
    state: () => ({ ...getHud(run), words: run.words.map((w) => w.word), found: [...run.found] }),
    select: (cells) => doSubmit(cells),
    solveWord: (i) => doSubmit(run.words[i].cells),
    solveAll: () => {
      for (const { cells, word } of run.words) {
        if (!run.found.has(word)) doSubmit(cells);
      }
      return getHud(run);
    },
    hint: () => { const h = useHint(run); processEvents(); syncUi(); return h; },
    setSeed: (n) => { run = createRun({ seed: n, mode: 'random' }); state = 'playing'; syncLl(); ui.showGame(); syncUi(); return getHud(run); },
  },
};