// 主入口：ROCKET GOAL。状态机 title → playing ⇄ paused → over。WASD + Shift boost。
import { STEP, RULES } from '../config/game.config.js';
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
const keys = { up: false, down: false, left: false, right: false, boost: false };

const llState = { phase: 'title', lang: ui.lang, dir: ui.dir };
function syncLl() { llState.phase = state; llState.lang = ui.lang; llState.dir = ui.dir; }

function processEvents() {
  for (const ev of drainEvents(run)) {
    if (ev.type === 'hit') audio.hit();
    else if (ev.type === 'goal') { audio.goal(); renderer.flashGoal(); Sdk.track('goal', { team: ev.team }); }
    else if (ev.type === 'go') audio.whistle();
    else if (ev.type === 'win') onWin(ev.winner);
  }
}

function startGame() {
  run = createRun({ seed: Math.floor(Math.random() * 0x7fffffff) });
  renderer.clearEffects();
  accumulator = 0;
  state = 'playing';
  syncLl();
  Sdk.newRun({ mode: 'rocketgoal' });
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
  ui.showEnd(winner);
}
function doMute() { audio.setMuted(!audio.muted); Sdk.save('muted', audio.muted); ui.updateMute(audio.muted); }

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') { if (state === 'playing') pauseGame(); else if (state === 'paused') resumeGame(); return; }
  if (e.code === 'KeyW' || e.code === 'ArrowUp') { keys.up = true; e.preventDefault(); }
  if (e.code === 'KeyS' || e.code === 'ArrowDown') { keys.down = true; e.preventDefault(); }
  if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = true;
  if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = true;
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.boost = true;
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'KeyW' || e.code === 'ArrowUp') keys.up = false;
  if (e.code === 'KeyS' || e.code === 'ArrowDown') keys.down = false;
  if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = false;
  if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = false;
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.boost = false;
});
window.addEventListener('blur', () => { for (const k of Object.keys(keys)) keys[k] = false; if (state === 'playing') pauseGame(); });

ui.btnStart.addEventListener('click', () => { audio.unlock(); startGame(); });
ui.btnResume.addEventListener('click', resumeGame);
ui.btnRestart.addEventListener('click', startGame);
ui.btnAgain.addEventListener('click', startGame);
ui.btnTitle.addEventListener('click', backToTitle);
if (ui.btnTitleEnd) ui.btnTitleEnd.addEventListener('click', backToTitle);
ui.btnMute.addEventListener('click', doMute);
ui.btnPause.addEventListener('click', () => { if (state === 'playing') pauseGame(); });
for (const sel of ui.langSelects) { if (sel) sel.addEventListener('change', (e) => { ui.setLang(e.target.value); syncLl(); }); }

Sdk.onAdStart(() => pauseGame());
Sdk.onAdEnd(() => resumeGame());

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  if (state === 'playing') {
    accumulator += dt;
    while (accumulator >= STEP) { tick(run, STEP, keys); accumulator -= STEP; }
    processEvents();
  }
  renderer.update(dt);
  renderer.render({ run });
}

Sdk.ready();
audio.setMuted(Sdk.load('muted', false));
ui.applyLang();
ui.showTitle();
ui.updateBest(wins);
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
    step: (sec, input) => { const n = Math.ceil(sec * 60); for (let i = 0; i < n; i++) tick(run, 1 / 60, input || {}); processEvents(); return getHud(run); },
    setScores: (a, b) => { run.scores = [a, b]; return run.scores; },
    goal: (team) => { run.scores[team] += 1; run.lastScorer = team; run.phase = 'goal'; run.phaseT = RULES.goalPause; processEvents(); return getHud(run); },
    playAll: () => {
      run.cars[0].isBot = true;
      let guard = 0;
      while (run.phase !== 'over' && guard < 60 * 240) { tick(run, 1 / 60, {}); processEvents(); guard++; }
      return getHud(run);
    },
  },
};