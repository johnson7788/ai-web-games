// 主入口：CITY BUS。状态机 title → playing ⇄ paused → over。
import { STEP } from '../config/game.config.js';
import { createRun, tick, getHud, drainEvents, spawnPassenger } from './game/sim.js';
import { createRenderer } from './render/index.js';
import { ui } from './ui/ui.js';
import { audio } from './audio.js';
import Sdk from './core/sdk.js';
import { t } from './core/i18n.js';

const canvas = document.getElementById('canvas');
const renderer = createRenderer(canvas);

let run = createRun({ seed: 1 });
let state = 'title';
let best = Sdk.load('best', 0);
let lastTime = performance.now();
let accumulator = 0;
const input = { up: false, down: false, left: false, right: false };
const keys = { up: false, down: false, left: false, right: false };
const touch = { up: false, down: false, left: false, right: false };

const llState = { phase: 'title', lang: ui.lang, dir: ui.dir };
function syncLl() { llState.phase = state; llState.lang = ui.lang; llState.dir = ui.dir; }

function processEvents() {
  for (const ev of drainEvents(run)) {
    if (ev.type === 'pickup') { audio.pickup(); renderer.addFloater(`${t('pickup')} +${ev.count}`, run.bus.x, run.bus.y - 60, '#fbbf24'); }
    else if (ev.type === 'dropoff') { audio.dropoff(); renderer.addFloater(`+$${ev.gained}`, run.bus.x, run.bus.y - 60, '#4ade80'); Sdk.track('dropoff', { gained: ev.gained }); }
    else if (ev.type === 'left') audio.left();
    else if (ev.type === 'bump') audio.bump();
    else if (ev.type === 'shiftEnd') onShiftEnd(ev);
  }
}

function startGame() {
  run = createRun({ seed: Math.floor(Math.random() * 0x7fffffff) });
  renderer.clearEffects();
  accumulator = 0;
  state = 'playing';
  syncLl();
  Sdk.newRun({ mode: 'bus' });
  ui.showGame();
  lastTime = performance.now();
}
function backToTitle() { state = 'title'; syncLl(); ui.showTitle(); ui.updateBest(best); }
function pauseGame() { if (state !== 'playing') return; state = 'paused'; syncLl(); ui.showPause(); }
function resumeGame() { if (state !== 'paused') return; state = 'playing'; syncLl(); ui.hidePause(); lastTime = performance.now(); }
function onShiftEnd(ev) {
  state = 'over'; syncLl();
  if (ev.money > best) { best = ev.money; Sdk.save('best', best); }
  audio.shiftEnd();
  Sdk.gameOver({ money: ev.money, delivered: ev.delivered });
  ui.showEnd(ev.money, ev.delivered);
}
function doMute() { audio.setMuted(!audio.muted); Sdk.save('muted', audio.muted); ui.updateMute(audio.muted); }

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (state === 'playing') pauseGame(); else if (state === 'paused') resumeGame();
    return;
  }
  if (e.code === 'KeyW' || e.code === 'ArrowUp') { keys.up = true; e.preventDefault(); }
  if (e.code === 'KeyS' || e.code === 'ArrowDown') { keys.down = true; e.preventDefault(); }
  if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = true;
  if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = true;
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'KeyW' || e.code === 'ArrowUp') keys.up = false;
  if (e.code === 'KeyS' || e.code === 'ArrowDown') keys.down = false;
  if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = false;
  if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = false;
});
window.addEventListener('blur', () => {
  for (const k of Object.keys(keys)) keys[k] = false;
  for (const k of Object.keys(touch)) touch[k] = false;
  if (state === 'playing') pauseGame();
});

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
bindHold(ui.btnGas, 'up');
bindHold(ui.btnBrake, 'down');

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

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  if (state === 'playing') {
    for (const k of Object.keys(input)) input[k] = keys[k] || touch[k];
    accumulator += dt;
    while (accumulator >= STEP) { tick(run, STEP, input); accumulator -= STEP; }
    processEvents();
  }
  renderer.update(dt);
  renderer.render({ run });
}

Sdk.ready();
audio.setMuted(Sdk.load('muted', false));
ui.applyLang();
ui.showTitle();
ui.updateBest(best);
ui.updateMute(audio.muted);
syncLl();
requestAnimationFrame(loop);

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
    teleport: (x, y, heading = 0) => { run.bus.x = x; run.bus.y = y; run.bus.heading = heading; run.bus.speed = 0; return getHud(run); },
    spawn: (origin, dest) => { spawnPassenger(run, origin, dest); return getHud(run); },
    setMoney: (m) => { run.money = m; return run.money; },
    endShift: () => { run.timeLeft = 0; tick(run, 1 / 60, {}); processEvents(); return getHud(run); },
    playAll: () => { run.timeLeft = 0; tick(run, 1 / 60, {}); processEvents(); return getHud(run); },
  },
};