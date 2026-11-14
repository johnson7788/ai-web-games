// 主入口：PAPER WORLD。状态机 title → playing ⇄ paused（无尽沙盒）。A/D + 鼠标挖掘/放置。
import { STEP, BLOCKS, HOTBAR } from '../config/game.config.js';
import { createRun, tick, getHud, drainEvents } from './game/sim.js';
import { createRenderer } from './render/index.js';
import { ui } from './ui/ui.js';
import { audio } from './audio.js';
import Sdk from './core/sdk.js';

const canvas = document.getElementById('canvas');
const renderer = createRenderer(canvas);

let run = createRun({ seed: 1 });
let state = 'title';
let lastTime = performance.now();
let accumulator = 0;
const keys = { left: false, right: false, jump: false };
const mouse = { x: 640, y: 360, mining: false, placing: false };

const llState = { phase: 'title', lang: ui.lang, dir: ui.dir };
function syncLl() { llState.phase = state; llState.lang = ui.lang; llState.dir = ui.dir; }

function canvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  return { x: (e.clientX - rect.left) * (canvas.width / rect.width), y: (e.clientY - rect.top) * (canvas.height / rect.height) };
}

function processEvents() {
  for (const ev of drainEvents(run)) {
    if (ev.type === 'mine') { audio.mine(); Sdk.track('mine', { id: ev.id }); }
    else if (ev.type === 'place') audio.place();
  }
}

function startGame() {
  run = createRun({ seed: Math.floor(Math.random() * 0x7fffffff) });
  renderer.clearEffects();
  accumulator = 0;
  state = 'playing';
  syncLl();
  Sdk.newRun({ mode: 'paperworld' });
  ui.showGame();
  lastTime = performance.now();
}
function backToTitle() { state = 'title'; syncLl(); ui.showTitle(); }
function pauseGame() { if (state !== 'playing') return; state = 'paused'; syncLl(); ui.showPause(); }
function resumeGame() { if (state !== 'paused') return; state = 'playing'; syncLl(); ui.hidePause(); lastTime = performance.now(); }
function doMute() { audio.setMuted(!audio.muted); Sdk.save('muted', audio.muted); ui.updateMute(audio.muted); }

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') { if (state === 'playing') pauseGame(); else if (state === 'paused') resumeGame(); return; }
  if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = true;
  if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = true;
  if (e.code === 'KeyW' || e.code === 'ArrowUp' || e.code === 'Space') { keys.jump = true; e.preventDefault(); }
  if (e.code >= 'Digit1' && e.code <= 'Digit5') { run.selected = Number(e.code.slice(5)) - 1; audio.select(); }
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = false;
  if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = false;
  if (e.code === 'KeyW' || e.code === 'ArrowUp' || e.code === 'Space') keys.jump = false;
});
canvas.addEventListener('pointermove', (e) => { const p = canvasPos(e); mouse.x = p.x; mouse.y = p.y; });
canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  const p = canvasPos(e); mouse.x = p.x; mouse.y = p.y;
  if (e.button === 2) mouse.placing = true; else mouse.mining = true;
});
window.addEventListener('pointerup', (e) => { if (e.button === 2) mouse.placing = false; else mouse.mining = false; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('blur', () => { keys.left = keys.right = keys.jump = false; mouse.mining = mouse.placing = false; if (state === 'playing') pauseGame(); });

ui.btnStart.addEventListener('click', () => { audio.unlock(); startGame(); });
ui.btnResume.addEventListener('click', resumeGame);
ui.btnRestart.addEventListener('click', startGame);
ui.btnTitle.addEventListener('click', backToTitle);
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
    const input = { ...keys, mouse: { x: mouse.x, y: mouse.y }, mining: mouse.mining, placing: mouse.placing };
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
    mine: (c, r) => {
      const id = run.grid[r][c];
      if (id !== 0) { const drop = BLOCKS[id].drop; run.grid[r][c] = 0; if (drop) run.inventory[drop] = (run.inventory[drop] || 0) + 1; run.mined++; }
      return getHud(run);
    },
    place: (c, r, id) => { run.grid[r][c] = id; run.placed++; return getHud(run); },
    setInv: (id, n) => { run.inventory[id] = n; return run.inventory[id]; },
    select: (i) => { run.selected = i; return run.selected; },
  },
};