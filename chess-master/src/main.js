// 主入口：CHESS MASTER。状态机 title → playing ⇄ paused → over。
// 玩家（白）点选走子；AI（黑）按延时自动应着。
import { WORLD, BOARD, COLORS, RULES, CONFIG } from '../config/game.config.js';
import {
  createRun, legalForPlayer, movesFrom, playerMove, aiMove, undo, getHud, drainEvents,
} from './game/sim.js';
import { createRenderer } from './render/index.js';
import { preload } from './render/art.js';
import { ui } from './ui/ui.js';
import { audio } from './audio.js';
import Sdk from './core/sdk.js';
import { t } from './core/i18n.js';

const canvas = document.getElementById('canvas');
const renderer = createRenderer(canvas);

let run = createRun({ seed: 1 });
let state = 'title';
let selected = null;
let targets = new Set();
let pendingPromotion = null;
let aiTimer = 0;
let lastTime = performance.now();

const llState = { phase: 'title', lang: ui.lang, dir: ui.dir };

function syncLl() {
  llState.phase = state;
  llState.lang = ui.lang;
  llState.dir = ui.dir;
}
function playerTurn() {
  return state === 'playing' && run.status === 'playing' && run.state.turn === run.playerColor;
}
function selectSquare(sq) {
  selected = sq;
  targets = new Set(movesFrom(run, sq.r, sq.c).map((m) => `${m.to.r},${m.to.c}`));
}
function clearSelection() {
  selected = null;
  targets = new Set();
}
function syncUi() {
  const hud = getHud(run);
  let status;
  if (run.status === 'checkmate') status = t('checkmate');
  else if (run.status === 'stalemate') status = t('stalemate');
  else if (run.status === 'draw') status = t('draw');
  else if (hud.turn === run.playerColor) status = hud.inCheck ? `${t('yourTurn')} · ${t('check')}` : t('yourTurn');
  else status = t('aiTurn');
  ui.setStatus(status);
  ui.setCaptured(run.captured);
  ui.setMoveCount(run.history.length);
  ui.setUndoEnabled(run.history.length > 0 && playerTurn());
}

// ---- 事件 → 表现 ---------------------------------------------------------
function processEvents() {
  for (const ev of drainEvents(run)) {
    if (ev.type === 'move') {
      if (ev.castle) audio.castle();
      else if (ev.capture) audio.capture();
      else audio.move();
      Sdk.track('move', { capture: ev.capture });
    } else if (ev.type === 'check') {
      audio.check();
    } else if (ev.type === 'end') {
      onEnd(ev.status, ev.winner);
    }
  }
}

function doPlayerMove(from, to, promo = 'q') {
  const r = playerMove(run, from, to, promo);
  if (r.ok) {
    clearSelection();
    ui.hidePromotion();
    pendingPromotion = null;
    processEvents();
    aiTimer = 0;
    syncUi();
  }
  return r;
}

// ---- 状态机 --------------------------------------------------------------
function startGame() {
  run = createRun({ seed: Math.floor(Math.random() * 0x7fffffff) });
  clearSelection();
  pendingPromotion = null;
  aiTimer = 0;
  ui.hidePromotion();
  state = 'playing';
  syncLl();
  Sdk.newRun({ mode: 'chess' });
  ui.showGame();
  syncUi();
  lastTime = performance.now();
}
function backToTitle() {
  state = 'title';
  syncLl();
  ui.showTitle();
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
function onEnd(status, winner) {
  state = 'over';
  syncLl();
  clearSelection();
  let title;
  let win;
  if (status === 'checkmate') {
    win = winner === run.playerColor;
    title = win ? t('youWin') : t('youLose');
    if (win) { audio.win(); Sdk.levelCleared({ winner }); }
    else { audio.lose(); Sdk.gameOver({ winner }); }
  } else {
    win = null;
    title = t('drawTitle');
    audio.click();
    Sdk.gameOver({ draw: true });
  }
  ui.showEnd(title, `${t('checkmate')} · ${t('moves')}: ${run.history.length}`, win);
}
function doUndo() {
  if (!playerTurn()) return;
  undo(run);
  clearSelection();
  audio.click();
  syncUi();
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
  if (!playerTurn() || pendingPromotion) return;
  const p = canvasPos(e);
  const sq = renderer.hitSquare(p.x, p.y);
  if (!sq) { clearSelection(); return; }
  if (selected && targets.has(`${sq.r},${sq.c}`)) {
    const move = movesFrom(run, selected.r, selected.c).find((m) => m.to.r === sq.r && m.to.c === sq.c);
    if (move && move.promotion) {
      pendingPromotion = { from: selected, to: sq };
      ui.showPromotion();
      audio.click();
    } else {
      doPlayerMove(selected, sq);
    }
    return;
  }
  const piece = run.state.board[sq.r][sq.c];
  if (piece && piece.color === run.playerColor) {
    selectSquare(sq);
    audio.click();
  } else {
    clearSelection();
  }
});

for (const piece of ['q', 'r', 'b', 'n']) {
  ui.promoBtns[piece].addEventListener('click', () => {
    if (!pendingPromotion) return;
    doPlayerMove(pendingPromotion.from, pendingPromotion.to, piece);
  });
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (state === 'playing') pauseGame();
    else if (state === 'paused') resumeGame();
  }
  if (e.code === 'KeyU' && playerTurn()) doUndo();
});
window.addEventListener('blur', () => { if (state === 'playing') pauseGame(); });

// ---- 按钮 ----------------------------------------------------------------
ui.btnStart.addEventListener('click', () => { audio.unlock(); startGame(); });
ui.btnResume.addEventListener('click', resumeGame);
ui.btnRestart.addEventListener('click', startGame);
ui.btnAgain.addEventListener('click', startGame);
ui.btnTitle.addEventListener('click', backToTitle);
ui.btnNew.addEventListener('click', startGame);
ui.btnUndo.addEventListener('click', doUndo);
ui.btnMute.addEventListener('click', doMute);
ui.btnPause.addEventListener('click', () => { if (state === 'playing') pauseGame(); });
for (const sel of ui.langSelects) {
  if (sel) sel.addEventListener('change', (e) => { ui.setLang(e.target.value); syncLl(); syncUi(); });
}

Sdk.onAdStart(() => pauseGame());
Sdk.onAdEnd(() => resumeGame());

// ---- 主循环 --------------------------------------------------------------
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  if (state === 'playing' && run.status === 'playing' && run.state.turn === run.aiColor) {
    aiTimer += dt * 1000;
    if (aiTimer >= RULES.aiDelayMs) {
      aiTimer = 0;
      aiMove(run);
      processEvents();
      syncUi();
    }
  }
  const hud = getHud(run);
  renderer.render({
    run,
    selected,
    targets,
    checkPos: hud.inCheck ? hud.kingPos : null,
    phase: state,
  });
}

// ---- 初始化 --------------------------------------------------------------
Sdk.ready();
preload(); // 启动即预载素材；渲染端按 art.progress 画加载条
audio.setMuted(Sdk.load('muted', false));
ui.applyLang();
ui.showTitle();
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
    legal: () => legalForPlayer(run).map((m) => ({ from: m.from, to: m.to, piece: m.piece })),
    move: (fr, fc, tr, tc, promo) => doPlayerMove({ r: fr, c: fc }, { r: tr, c: tc }, promo),
    ai: () => { const r = aiMove(run); processEvents(); syncUi(); return r; },
    select: (r, c) => { selectSquare({ r, c }); return [...targets]; },
    undo: () => { doUndo(); return getHud(run); },
    newGame: () => { startGame(); return getHud(run); },
  },
};