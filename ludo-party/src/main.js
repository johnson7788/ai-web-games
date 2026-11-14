// 主入口：LUDO PARTY。状态机 title → playing ⇄ paused → over。
// 玩家（红）掷骰/点选棋子；AI（蓝）自动行动。
import { WORLD, STEP, COLORS, PLAYERS, RULES, CONFIG } from '../config/game.config.js';
import {
  createRun, rollDice, moveToken, aiStep, getHud, drainEvents,
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
let wins = Sdk.load('wins', 0);
let lastTime = performance.now();
let aiTimer = 0;

const llState = { phase: 'title', lang: ui.lang, dir: ui.dir };

function syncLl() {
  llState.phase = state;
  llState.lang = ui.lang;
  llState.dir = ui.dir;
}
function isHumanTurn() {
  return run.turn === 0 && run.phase !== 'over';
}
function syncUi() {
  const hud = getHud(run);
  ui.setDice(run.dice);
  ui.setProgress(hud.finished);
  let status = '';
  if (run.phase === 'over') status = '';
  else if (run.turn === 0) status = run.phase === 'move' ? t('pickToken') : t('yourTurn');
  else status = t('botTurn');
  ui.setTurnStatus(status);
  ui.setRollEnabled(state === 'playing' && run.turn === 0 && run.phase === 'roll');
}

// ---- 事件 → 表现 ---------------------------------------------------------
function processEvents() {
  for (const ev of drainEvents(run)) {
    if (ev.type === 'roll') {
      audio.roll();
      if (ev.dice === 6) ui.setFeedback(t('six'), '');
    } else if (ev.type === 'move') {
      audio.move();
    } else if (ev.type === 'capture') {
      audio.capture();
      ui.setFeedback(t('captured'), '');
    } else if (ev.type === 'finish') {
      audio.finish();
    } else if (ev.type === 'noMoves') {
      ui.setFeedback(t('noMoves'), '');
    } else if (ev.type === 'win') {
      onWin(ev.player);
    }
  }
}

function doRoll() {
  if (state !== 'playing' || run.turn !== 0 || run.phase !== 'roll') return;
  ui.setFeedback('', '');
  rollDice(run);
  processEvents();
  syncUi();
}
function doMove(tokenIdx) {
  if (state !== 'playing' || run.turn !== 0 || run.phase !== 'move') return;
  moveToken(run, tokenIdx);
  processEvents();
  syncUi();
}

// ---- 状态机 --------------------------------------------------------------
function startGame() {
  run = createRun({ seed: Math.floor(Math.random() * 0x7fffffff) });
  aiTimer = 0;
  state = 'playing';
  syncLl();
  Sdk.newRun({ mode: 'ludo' });
  ui.showGame();
  ui.setFeedback('', '');
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
function onWin(player) {
  state = 'over';
  syncLl();
  if (player === 0) { wins += 1; Sdk.save('wins', wins); }
  Sdk.gameOver({ winner: player });
  ui.showWin(player === 0);
  audio.win();
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
  if (state !== 'playing' || !isHumanTurn() || run.phase !== 'move') return;
  const p = canvasPos(e);
  const token = renderer.hitToken(p.x, p.y, run);
  if (token != null) doMove(token);
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (state === 'playing') pauseGame();
    else if (state === 'paused') resumeGame();
  }
  if (state === 'playing' && run.turn === 0) {
    if (e.code === 'Space' && run.phase === 'roll') { doRoll(); e.preventDefault(); }
    if (run.phase === 'move' && e.code.startsWith('Digit')) {
      const n = Number(e.code.slice(5));
      if (n >= 1 && n <= 4 && run.movable.includes(n - 1)) doMove(n - 1);
    }
  }
});
window.addEventListener('blur', () => { if (state === 'playing') pauseGame(); });

// ---- 按钮 ----------------------------------------------------------------
ui.btnStart.addEventListener('click', () => { audio.unlock(); startGame(); });
ui.btnResume.addEventListener('click', resumeGame);
ui.btnRestart.addEventListener('click', startGame);
ui.btnAgain.addEventListener('click', startGame);
ui.btnTitle.addEventListener('click', backToTitle);
ui.btnRoll.addEventListener('click', () => { audio.unlock(); doRoll(); });
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
  if (state === 'playing' && run.turn === 1 && run.phase !== 'over') {
    aiTimer += dt * 1000;
    if (aiTimer >= 700) {
      aiTimer = 0;
      aiStep(run);
      processEvents();
      syncUi();
    }
  }
  renderer.update(dt);
  renderer.render({ run, now, movable: run.movable, state });
}

// ---- 初始化 --------------------------------------------------------------
preload(); // 一次性预载素材；未到位时渲染层画占位，不阻塞启动
Sdk.ready();
audio.setMuted(Sdk.load('muted', false));
ui.applyLang();
ui.showTitle();
ui.updateBest(wins);
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
    roll: () => { doRoll(); return getHud(run); },
    move: (i) => { doMove(i); return getHud(run); },
    ai: () => { aiStep(run); processEvents(); syncUi(); return getHud(run); },
    setDice: (d) => { run.rng = () => (d - 1) / 6 + 0.001; return d; },
    playAll: () => {
      run.rng = Math.random; // 恢复真实随机，避免 setDice 固定骰子导致死局
      let guard = 0;
      while (run.phase !== 'over' && guard < 5000) {
        if (run.turn === 0) {
          if (run.phase === 'roll') rollDice(run);
          else if (run.phase === 'move') moveToken(run, run.movable[0]);
        } else {
          aiStep(run);
        }
        processEvents();
        guard += 1;
      }
      syncUi();
      return getHud(run);
    },
  },
};