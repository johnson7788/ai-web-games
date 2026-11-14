// 主入口：PARKOUR GUN。状态机 title → playing ⇄ paused → over。A/D + 跳 + 鼠标。
import { STEP, PLAYER, RULES } from '../config/game.config.js';
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
const keys = { left: false, right: false, jump: false };
const mouse = { x: 640, y: 360, down: false };

const llState = { phase: 'title', lang: ui.lang, dir: ui.dir };
function syncLl() { llState.phase = state; llState.lang = ui.lang; llState.dir = ui.dir; }

function canvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  return { x: (e.clientX - rect.left) * (canvas.width / rect.width), y: (e.clientY - rect.top) * (canvas.height / rect.height) };
}

function processEvents() {
  for (const ev of drainEvents(run)) {
    if (ev.type === 'shoot') { if (ev.id === 0) audio.shoot(); }
    else if (ev.type === 'jump') { if (ev.id === 0) audio.jump(); }
    else if (ev.type === 'hit') { if (ev.id === 0) { audio.hit(); renderer.flash(); } }
    else if (ev.type === 'kill') {
      const v = run.players[ev.victim];
      renderer.addSpark(v.x, v.y - PLAYER.H / 2, ev.team === 0 ? '#7dd3fc' : '#fda4af');
      if (ev.killer === 0 || ev.victim === 0) audio.kill();
      if (ev.victim === 0) { audio.death(); renderer.flash(); }
      Sdk.track('kill', { team: ev.team });
    }
    else if (ev.type === 'respawn') { if (ev.id === 0) audio.respawn(); }
    else if (ev.type === 'win') onWin(ev.winner);
  }
}

function startGame() {
  run = createRun({ seed: Math.floor(Math.random() * 0x7fffffff) });
  renderer.clearEffects();
  accumulator = 0;
  state = 'playing';
  syncLl();
  Sdk.newRun({ mode: 'parkourgun' });
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
  if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = true;
  if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = true;
  if (e.code === 'KeyW' || e.code === 'ArrowUp' || e.code === 'Space') { keys.jump = true; e.preventDefault(); }
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = false;
  if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = false;
  if (e.code === 'KeyW' || e.code === 'ArrowUp' || e.code === 'Space') keys.jump = false;
});
canvas.addEventListener('pointermove', (e) => { const p = canvasPos(e); mouse.x = p.x; mouse.y = p.y; });
canvas.addEventListener('pointerdown', (e) => { audio.unlock(); const p = canvasPos(e); mouse.x = p.x; mouse.y = p.y; mouse.down = true; });
window.addEventListener('pointerup', () => { mouse.down = false; });
window.addEventListener('blur', () => { keys.left = keys.right = keys.jump = false; mouse.down = false; if (state === 'playing') pauseGame(); });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

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
    const me = run.players[0];
    const input = { ...keys, aim: Math.atan2(mouse.y - (me.y - PLAYER.H * 0.55), mouse.x - me.x), shoot: mouse.down };
    accumulator += dt;
    while (accumulator >= STEP) { tick(run, STEP, input); accumulator -= STEP; }
    processEvents();
  }
  renderer.update(dt);
  renderer.render({ run, mouse });
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
    kill: (id) => { const q = run.players[id]; q.alive = false; q.hp = 0; q.respawnT = PLAYER.RESPAWN; run.scores[1 - q.team] += 1; return getHud(run); },
    playAll: () => {
      run.players[0].isBot = true;
      let guard = 0;
      while (run.phase !== 'over' && guard < 60 * 200) { tick(run, 1 / 60, {}); processEvents(); guard++; }
      return getHud(run);
    },
  },
};