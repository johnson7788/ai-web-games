// 主入口：BLOCK BLAST。状态机 title → playing ⇄ paused → over。
// 拖拽放置 + 行列爆破 + 连击。60Hz 渲染循环，事件驱动玩法。
import { WORLD, BOARD, TRAY, COLORS, RULES, CONFIG } from '../config/game.config.js';
import { createSim, place, canPlace, findAnyFit, getHud, drainEvents } from './game/sim.js';
import { createRenderer, cellRect } from './render/index.js';
import { ui } from './ui/ui.js';
import { audio } from './audio.js';
import Sdk from './core/sdk.js';

const canvas = document.getElementById('canvas');
const renderer = createRenderer(canvas);
const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const SIZE = BOARD.SIZE;
const CELL = BOARD.CELL;
const BOARD_CX = BOARD.X + (SIZE * CELL) / 2;
const BOARD_CY = BOARD.Y + (SIZE * CELL) / 2;

let sim = createSim({ seed: freshSeed() });
let state = 'title'; // title | playing | paused | over
let drag = null;
let best = Sdk.load('best', 0);
let lastTime = performance.now();

const llState = { phase: 'title', lang: ui.lang, dir: ui.dir };

function freshSeed() {
  return Math.floor(Math.random() * 0x7fffffff);
}

function syncLl() {
  llState.phase = state;
  llState.lang = ui.lang;
  llState.dir = ui.dir;
}

function syncUi() {
  ui.updateHUD({ score: sim.score, best, combo: sim.combo, lines: sim.lines });
}

// ---- 事件 → 表现 ---------------------------------------------------------
function processEvents() {
  for (const ev of drainEvents(sim)) {
    if (ev.type === 'place') {
      audio.place();
      const cx = ev.cells.reduce((a, c) => a + cellRect(c.r, c.c).x + CELL / 2, 0) / ev.cells.length;
      const cy = ev.cells.reduce((a, c) => a + cellRect(c.r, c.c).y + CELL / 2, 0) / ev.cells.length;
      renderer.popup(`+${ev.gained}`, cx, cy - 20, COLORS.ink);
      Sdk.track('place', { cells: ev.cells.length });
    } else if (ev.type === 'blast') {
      audio.blast(ev.combo);
      for (const c of ev.cells) {
        const rect = cellRect(c.r, c.c);
        renderer.burst(rect.x + CELL / 2, rect.y + CELL / 2, COLORS.blocks[c.color], 8);
      }
      if (!REDUCED) renderer.shake(6 + ev.lines * 3);
      renderer.popup(`+${ev.gained}`, BOARD_CX, BOARD_CY - 40, COLORS.accent, true);
      if (ev.lines > 1) renderer.popup(`${ev.lines} LINES`, BOARD_CX, BOARD_CY + 10, '#fbbf24');
      if (ev.combo > 1) renderer.popup(`COMBO ×${ev.combo}`, BOARD_CX, BOARD_CY + 56, '#f472b6');
      Sdk.track('blast', { lines: ev.lines, combo: ev.combo });
    } else if (ev.type === 'over') {
      onGameOver();
    }
  }
}

function doPlace(pieceIndex, row, col) {
  const r = place(sim, pieceIndex, row, col);
  if (r.ok) {
    processEvents();
    syncUi();
  }
  return r;
}

// ---- 状态机 --------------------------------------------------------------
function startGame() {
  sim = createSim({ seed: freshSeed() });
  drag = null;
  renderer.clearEffects();
  state = 'playing';
  syncLl();
  Sdk.newRun({ mode: 'classic' });
  ui.showGame();
  syncUi();
  lastTime = performance.now();
}

function backToTitle() {
  sim = createSim({ seed: freshSeed() });
  drag = null;
  renderer.clearEffects();
  state = 'title';
  syncLl();
  ui.showTitle();
  ui.updateBest(best);
}

function pauseGame() {
  if (state !== 'playing') return;
  state = 'paused';
  drag = null;
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

function onGameOver() {
  state = 'over';
  drag = null;
  syncLl();
  const isNewBest = sim.score > best;
  if (isNewBest) {
    best = sim.score;
    Sdk.save('best', best);
  }
  Sdk.gameOver({ score: sim.score, lines: sim.lines });
  ui.showOver(sim.score, best, isNewBest);
  audio.over();
}

function doMute() {
  audio.setMuted(!audio.muted);
  Sdk.save('muted', audio.muted);
  ui.updateMute(audio.muted);
}

// ---- 拖拽输入 ------------------------------------------------------------
function canvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (canvas.width / rect.width),
    y: (e.clientY - rect.top) * (canvas.height / rect.height),
  };
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function updateDragTarget() {
  if (!drag) return;
  const piece = sim.tray[drag.pieceIndex];
  if (!piece) { drag.targetRow = null; return; }
  const left = drag.x - drag.grabDX;
  const top = drag.y - drag.grabDY - drag.lift;
  const col = Math.round((left - BOARD.X) / CELL);
  const row = Math.round((top - BOARD.Y) / CELL);
  drag.targetRow = row;
  drag.targetCol = col;
  drag.valid = canPlace(sim, drag.pieceIndex, row, col);
}

function beginDrag(e) {
  if (state !== 'playing') return;
  const p = canvasPos(e);
  const i = renderer.hitTestTray(p.x, p.y, sim);
  if (i < 0) return;
  const piece = sim.tray[i];
  const rect = renderer.trayPieceRect(piece, i);
  const fx = clamp((p.x - rect.x) / rect.w, 0, 1);
  const fy = clamp((p.y - rect.y) / rect.h, 0, 1);
  drag = {
    pieceIndex: i,
    x: p.x, y: p.y,
    grabDX: fx * piece.w * CELL,
    grabDY: fy * piece.h * CELL,
    lift: e.pointerType === 'touch' ? TRAY.DRAG_LIFT : 0,
    targetRow: null, targetCol: null, valid: false,
  };
  updateDragTarget();
  audio.pickup();
  try { canvas.setPointerCapture(e.pointerId); } catch { /* noop */ }
}

function moveDrag(e) {
  if (!drag) return;
  const p = canvasPos(e);
  drag.x = p.x;
  drag.y = p.y;
  updateDragTarget();
}

function endDrag(e) {
  if (!drag) return;
  const d = drag;
  drag = null;
  try { canvas.releasePointerCapture(e.pointerId); } catch { /* noop */ }
  if (d.valid && d.targetRow != null) {
    doPlace(d.pieceIndex, d.targetRow, d.targetCol);
  } else if (d.targetRow != null && d.targetRow >= -1 && d.targetRow <= SIZE) {
    audio.invalid();
  }
}

canvas.addEventListener('pointerdown', (e) => { audio.unlock(); beginDrag(e); });
canvas.addEventListener('pointermove', moveDrag);
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', () => { drag = null; });

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (state === 'playing') pauseGame();
    else if (state === 'paused') resumeGame();
  }
});
window.addEventListener('blur', () => { if (state === 'playing') pauseGame(); });

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

// ---- 主循环 --------------------------------------------------------------
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  if (state === 'playing') renderer.update(dt);
  renderer.render({ sim, drag, now });
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
window.G = {
  sim: () => sim,
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
  sim,
  save: (k, v) => Sdk.save(k, v),
  load: (k, d) => Sdk.load(k, d),
  ui: () => ui,
  debug: {
    state: () => ({ ...getHud(sim), tray: sim.tray.map((p) => (p ? p.shapeId : null)) }),
    fit: () => findAnyFit(sim),
    place: (i, r, c) => doPlace(i, r, c),
    autoPlace: () => {
      const f = findAnyFit(sim);
      if (!f) return { ok: false };
      return doPlace(f.pieceIndex, f.row, f.col);
    },
    setupLine: () => {
      // 填满第 0 行只差最后一格，托盘 0 号换成单块，便于验收触发爆破。
      for (let c = 0; c < SIZE - 1; c += 1) sim.grid[0][c] = 2;
      sim.tray[0] = { uid: 999, shapeId: 'dot', cells: [[0, 0]], color: 4, w: 1, h: 1 };
      return { pieceIndex: 0, row: 0, col: SIZE - 1 };
    },
  },
};