// 主入口：BASKET BROS。状态机 title → playing ⇄ paused → over。
import { STEP, RULES } from '../config/game.config.js';
import { createRun, tick, doShoot, getHud, drainEvents } from './game/sim.js';
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
const input = { left: false, right: false, jump: false, shoot: false, steal: false };
const keys = { left: false, right: false, jump: false, shoot: false, steal: false };
const touch = { left: false, right: false, jump: false, shoot: false, steal: false };

const llState = { phase: 'title', lang: ui.lang, dir: ui.dir };
function syncLl() { llState.phase = state; llState.lang = ui.lang; llState.dir = ui.dir; }

// ---- 事件 → 表现 ---------------------------------------------------------
function processEvents() {
  for (const ev of drainEvents(run)) {
    if (ev.type === 'grab') audio.grab();
    else if (ev.type === 'shoot') audio.shoot();
    else if (ev.type === 'bounce') audio.bounce();
    else if (ev.type === 'rim') audio.rim();
    else if (ev.type === 'steal') audio.steal();
    else if (ev.type === 'score') { audio.swish(); renderer.flashScore(); Sdk.track('score', { scorer: ev.scorer }); }
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
  Sdk.newRun({ mode: 'basket' });
  ui.showGame();
  lastTime = performance.now();
}
function backToTitle() { state = 'title'; syncLl(); ui.showTitle(); ui.updateBest(wins); }
function pauseGame() { if (state !== 'playing') return; state = 'paused'; syncLl(); ui.showPause(); }
function resumeGame() { if (state !== 'paused') return; state = 'playing'; syncLl(); ui.hidePause(); lastTime = performance.now(); }
function onWin(winner) {
  state = 'over'; syncLl();
  if (winner === 0) { wins += 1; Sdk.save('wins', wins); audio.win(); } else audio.lose();
  Sdk.gameOver({ winner });
  ui.showEnd(winner === 0);
}
function doMute() { audio.setMuted(!audio.muted); Sdk.save('muted', audio.muted); ui.updateMute(audio.muted); }

// ---- 键盘 ----------------------------------------------------------------
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (state === 'playing') pauseGame(); else if (state === 'paused') resumeGame();
    return;
  }
  if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = true;
  if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = true;
  if (e.code === 'KeyW' || e.code === 'ArrowUp') { keys.jump = true; e.preventDefault(); }
  if (e.code === 'Space') { keys.shoot = true; e.preventDefault(); }
  if (e.code === 'KeyJ' || e.code === 'KeyK') keys.steal = true;
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = false;
  if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = false;
  if (e.code === 'KeyW' || e.code === 'ArrowUp') keys.jump = false;
  if (e.code === 'Space') keys.shoot = false;
  if (e.code === 'KeyJ' || e.code === 'KeyK') keys.steal = false;
});
window.addEventListener('blur', () => {
  for (const k of Object.keys(keys)) keys[k] = false;
  for (const k of Object.keys(touch)) touch[k] = false;
  if (state === 'playing') pauseGame();
});

// ---- 触控按钮 ------------------------------------------------------------
function bindHold(btn, key) {
  if (!btn) return;
  const on = (e) => { e.preventDefault(); audio.unlock(); touch[key] = true; };
  const off = (e) => { e.preventDefault(); touch[key] = false; };
  btn.addEventListener('pointerdown', on);
  btn.addEventListener('pointerup', off);
  btn.addEventListener('pointercancel', off);
  btn.addEventListener('pointerleave', off);
}
bindHold(ui.btnLeft, 'left');
bindHold(ui.btnRight, 'right');
bindHold(ui.btnJump, 'jump');
bindHold(ui.btnShoot, 'shoot');
bindHold(ui.btnSteal, 'steal');

// ---- 按钮 ----------------------------------------------------------------
ui.btnStart.addEventListener('click', () => { audio.unlock(); startGame(); });
ui.btnResume.addEventListener('click', resumeGame);
ui.btnRestart.addEventListener('click', startGame);
ui.btnAgain.addEventListener('click', startGame);
ui.btnTitle.addEventListener('click', backToTitle);
if (ui.btnTitleEnd) ui.btnTitleEnd.addEventListener('click', backToTitle);
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
    for (const k of Object.keys(input)) input[k] = keys[k] || touch[k];
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
    step: (sec, inp) => { const n = Math.ceil(sec * 60); for (let i = 0; i < n; i++) tick(run, 1 / 60, inp || {}); processEvents(); return getHud(run); },
    setScore: (a, b) => { run.scores = [a, b]; return run.scores; },
    giveBall: (i) => {
      for (const p of run.players) p.hasBall = false;
      run.players[i].hasBall = true;
      run.ball.holder = i; run.ball.pickupCd = 0;
      return getHud(run);
    },
    shoot: (i, charge = RULES.idealCharge) => {
      for (const p of run.players) p.hasBall = false;
      run.players[i].hasBall = true; run.ball.holder = i;
      doShoot(run, i, charge);
      processEvents();
      return getHud(run);
    },
    playAll: () => {
      let guard = 0;
      while (run.phase !== 'over' && guard < 20000) { tick(run, 1 / 60, {}); processEvents(); guard++; }
      return getHud(run);
    },
  },
};