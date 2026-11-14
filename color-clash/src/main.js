// 主入口：COLOR CLASH。状态机 title → playing ⇄ paused → over。
// 玩家回合等待输入；AI 回合按延时自动 aiStep。
import { WORLD, RULES, COLORS, COLOR_KEYS, LAYOUT, CONFIG } from '../config/game.config.js';
import {
  createRun, topCard, legalMoves, playCard, draw, pass, aiStep, bestColor, getHud, drainEvents,
} from './game/sim.js';
import { createRenderer } from './render/index.js';
import { preload as preloadArt } from './render/art.js';
import { ui } from './ui/ui.js';
import { audio } from './audio.js';
import Sdk from './core/sdk.js';
import { t, i18n } from './core/i18n.js';

const canvas = document.getElementById('canvas');
const renderer = createRenderer(canvas);

let run = createRun({ seed: 1 });
let state = 'title';
let playable = new Set();
let pendingWild = null;
let aiTimer = 0;
let wins = Sdk.load('wins', 0);
let losses = Sdk.load('losses', 0);
let lastTime = performance.now();

const llState = { phase: 'title', lang: ui.lang, dir: ui.dir };

function syncLl() {
  llState.phase = state;
  llState.lang = ui.lang;
  llState.dir = ui.dir;
}
function playerTurn() {
  return state === 'playing' && run.phase === 'playing' && run.turn === 0;
}
function syncUi() {
  playable = playerTurn() ? new Set(legalMoves(run, 0)) : new Set();
  ui.updateHUD({ wins, losses });
  if (playerTurn() && run.drawnThisTurn) ui.showPass();
  else ui.hidePass();
}

// ---- 事件 → 表现 ---------------------------------------------------------
function processEvents() {
  for (const ev of drainEvents(run)) {
    if (ev.type === 'play') {
      if (['skip', 'reverse', 'draw2', 'wild', 'wild4'].includes(ev.card.value)) audio.special();
      else audio.play();
      renderer.popup(`${ev.player === 0 ? t('you') : t('bot') + ' ' + ev.player}`, LAYOUT.discard.x, LAYOUT.discard.y - 90, COLORS.accent);
      Sdk.track('play', { player: ev.player, value: ev.card.value });
    } else if (ev.type === 'draw') {
      audio.draw();
    } else if (ev.type === 'win') {
      onEnd(ev.player);
    }
  }
}

function doPlay(index, color) {
  if (!playerTurn()) return;
  const r = playCard(run, index, color);
  if (r.ok) {
    ui.hideColorPicker();
    ui.hidePass();
    pendingWild = null;
    processEvents();
    aiTimer = 0;
    syncUi();
  }
  return r;
}
function doDraw() {
  if (!playerTurn() || run.drawnThisTurn) return;
  const r = draw(run);
  processEvents();
  syncUi();
  return r;
}
function doPass() {
  if (!playerTurn()) return;
  pass(run);
  ui.hidePass();
  processEvents();
  aiTimer = 0;
  syncUi();
}

// ---- 状态机 --------------------------------------------------------------
function startGame() {
  run = createRun({ seed: Math.floor(Math.random() * 0x7fffffff) });
  pendingWild = null;
  aiTimer = 0;
  renderer.clearEffects();
  ui.hideColorPicker();
  state = 'playing';
  syncLl();
  Sdk.newRun({ mode: 'uno' });
  ui.showGame();
  syncUi();
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
function onEnd(winner) {
  state = 'over';
  syncLl();
  if (winner === 0) { wins += 1; Sdk.save('wins', wins); Sdk.levelCleared({ winner }); audio.win(); }
  else { losses += 1; Sdk.save('losses', losses); Sdk.gameOver({ winner }); audio.lose(); }
  const label = winner === 0 ? t('you') : `${t('bot')} ${winner}`;
  ui.showEnd(winner === 0, label);
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
  if (!playerTurn() || pendingWild != null) return;
  const p = canvasPos(e);
  if (renderer.hitDraw(p.x, p.y)) { doDraw(); return; }
  const idx = renderer.hitHand(p.x, p.y, run);
  if (idx >= 0 && playable.has(idx)) {
    const c = run.hands[0][idx];
    if (c.color === 'wild') {
      pendingWild = idx;
      ui.showColorPicker();
      audio.click();
    } else {
      doPlay(idx);
    }
  }
});

for (const color of COLOR_KEYS) {
  ui.cpBtns[color].addEventListener('click', () => {
    if (pendingWild == null) return;
    doPlay(pendingWild, color);
  });
}
ui.btnPass.addEventListener('click', doPass);

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
  if (state === 'playing' && run.phase === 'playing' && run.turn !== 0) {
    aiTimer += dt * 1000;
    if (aiTimer >= RULES.aiDelayMs) {
      aiTimer = 0;
      aiStep(run);
      processEvents();
      syncUi();
    }
  }
  renderer.update(dt);
  renderer.render({
    run,
    playable,
    playerTurn: playerTurn(),
    drawLabel: t('draw'),
    botLabel: t('bot'),
    thinkingLabel: t('thinking'),
    yourTurnLabel: t('yourTurn'),
  });
}

// ---- 初始化 --------------------------------------------------------------
Sdk.ready();
audio.setMuted(Sdk.load('muted', false));
ui.applyLang();
ui.showTitle();
ui.updateBest(wins);
ui.updateMute(audio.muted);
syncLl();
syncUi();
preloadArt(); // 素材后台预载：未就位前渲染层画程序化占位，到位后下一帧自动换 sprite
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
    state: () => ({ ...getHud(run), hand: run.hands[0].map((c) => ({ color: c.color, value: c.value })) }),
    legal: () => legalMoves(run, 0),
    play: (i, color) => doPlay(i, color),
    draw: () => doDraw(),
    pass: () => doPass(),
    ai: () => { const a = aiStep(run); processEvents(); syncUi(); return a; },
    runAI: () => { let guard = 0; while (run.phase === 'playing' && run.turn !== 0 && guard < 20) { aiStep(run); guard += 1; } processEvents(); syncUi(); return getHud(run); },
    forceWin: () => { run.hands[0] = [{ id: 999, color: run.color, value: topCard(run).value }]; run.turn = 0; run.phase = 'playing'; syncUi(); return doPlay(0); },
  },
};