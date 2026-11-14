// 主入口：MINI BLOCKS。状态机 title → playing ⇄ paused（第一人称沙盒）。指针锁定 + WASD。
import { STEP, HOTBAR } from '../config/game.config.js';
import { createRun, tick, getHud, drainEvents, raycast, getBlock } from './game/sim.js';
import { BLOCKS } from '../config/game.config.js';
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
const keys = { forward: false, back: false, left: false, right: false, jump: false };
const mouse = { mining: false, placing: false };
let locked = false;

const llState = { phase: 'title', lang: ui.lang, dir: ui.dir };
function syncLl() { llState.phase = state; llState.lang = ui.lang; llState.dir = ui.dir; }

function processEvents() {
  for (const ev of drainEvents(run)) {
    if (ev.type === 'mine') { audio.mine(); Sdk.track('mine', { id: ev.id }); }
    else if (ev.type === 'place') audio.place();
  }
}

function startGame() {
  run = createRun({ seed: Math.floor(Math.random() * 0x7fffffff) });
  run.player.pitch = -0.22;
  renderer.clearEffects();
  accumulator = 0;
  state = 'playing';
  syncLl();
  Sdk.newRun({ mode: 'miniblocks' });
  ui.showGame();
  lastTime = performance.now();
}
function backToTitle() { state = 'title'; syncLl(); ui.showTitle(); if (document.pointerLockElement) document.exitPointerLock(); }
function pauseGame() { if (state !== 'playing') return; state = 'paused'; syncLl(); ui.showPause(); if (document.pointerLockElement) document.exitPointerLock(); }
function resumeGame() { if (state !== 'paused') return; state = 'playing'; syncLl(); ui.hidePause(); lastTime = performance.now(); }
function doMute() { audio.setMuted(!audio.muted); Sdk.save('muted', audio.muted); ui.updateMute(audio.muted); }

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') { if (state === 'playing') pauseGame(); else if (state === 'paused') resumeGame(); return; }
  if (e.code === 'KeyW' || e.code === 'ArrowUp') keys.forward = true;
  if (e.code === 'KeyS' || e.code === 'ArrowDown') keys.back = true;
  if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = true;
  if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = true;
  if (e.code === 'Space') { keys.jump = true; e.preventDefault(); }
  if (e.code >= 'Digit1' && e.code <= 'Digit6') { run.selected = Number(e.code.slice(5)) - 1; audio.select(); }
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'KeyW' || e.code === 'ArrowUp') keys.forward = false;
  if (e.code === 'KeyS' || e.code === 'ArrowDown') keys.back = false;
  if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = false;
  if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = false;
  if (e.code === 'Space') keys.jump = false;
});

document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === canvas; });
canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (state !== 'playing') return;
  if (!locked && canvas.requestPointerLock) { try { canvas.requestPointerLock(); } catch (_) {} }
  if (e.button === 2) mouse.placing = true; else mouse.mining = true;
});
window.addEventListener('pointerup', (e) => { if (e.button === 2) mouse.placing = false; else mouse.mining = false; });
window.addEventListener('mousemove', (e) => {
  if (state !== 'playing') return;
  if (!locked && !mouse.mining && !mouse.placing) return;
  const sens = 0.0026;
  run.player.yaw += (e.movementX || 0) * sens;
  run.player.pitch -= (e.movementY || 0) * sens;
  run.player.pitch = Math.max(-1.5, Math.min(1.5, run.player.pitch));
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('blur', () => { for (const k of Object.keys(keys)) keys[k] = false; mouse.mining = mouse.placing = false; if (state === 'playing') pauseGame(); });

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
    const input = { ...keys, mining: mouse.mining, placing: mouse.placing };
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
    look: (yaw, pitch) => { run.player.yaw = yaw; run.player.pitch = pitch; return getHud(run); },
    teleport: (x, y, z) => { run.player.x = x; run.player.y = y; run.player.z = z; return getHud(run); },
    mine: () => {
      const target = raycast(run);
      if (target) {
        const { x, y, z } = target.hit;
        const id = getBlock(run, x, y, z);
        run.world[x + 32 * (z + 32 * y)] = 0;
        const drop = id === 1 ? 2 : id;
        if (HOTBAR.includes(drop)) run.inventory[drop] = (run.inventory[drop] || 0) + 1;
        run.mined++;
      }
      return getHud(run);
    },
    setInv: (id, n) => { run.inventory[id] = n; return run.inventory[id]; },
    select: (i) => { run.selected = i; return run.selected; },
  },
};