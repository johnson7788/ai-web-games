// 主入口：SANDBOX CITY。状态机 title → playing ⇄ paused（无尽建造）。点击建造 + 1-7 选工具。
import { STEP, TILE, COLS, ROWS, OX, OY, TOOLS } from '../config/game.config.js';
import { createRun, tick, getHud, drainEvents, placeTile } from './game/sim.js';
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
const mouse = { x: 640, y: 360, down: false };
let lastPaint = null;

const llState = { phase: 'title', lang: ui.lang, dir: ui.dir };
function syncLl() { llState.phase = state; llState.lang = ui.lang; llState.dir = ui.dir; }

function canvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  return { x: (e.clientX - rect.left) * (canvas.width / rect.width), y: (e.clientY - rect.top) * (canvas.height / rect.height) };
}

function tryPlace(px, py) {
  const c = Math.floor((px - OX) / TILE), r = Math.floor((py - OY) / TILE);
  if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return;
  const key = c + ',' + r;
  if (key === lastPaint) return;
  lastPaint = key;
  const res = placeTile(run, c, r, TOOLS[run.selected]);
  if (res.ok) Sdk.track('build', { id: TOOLS[run.selected] });
  else if (res.reason === 'money') audio.error();
}

function processEvents() {
  for (const ev of drainEvents(run)) {
    if (ev.type === 'build') audio.build();
    else if (ev.type === 'bulldoze') audio.bulldoze();
    else if (ev.type === 'income') audio.income();
  }
}

function startGame() {
  run = createRun({ seed: Math.floor(Math.random() * 0x7fffffff) });
  renderer.clearEffects();
  accumulator = 0;
  state = 'playing';
  syncLl();
  Sdk.newRun({ mode: 'sandboxcity' });
  ui.showGame();
  lastTime = performance.now();
}
function backToTitle() { state = 'title'; syncLl(); ui.showTitle(); }
function pauseGame() { if (state !== 'playing') return; state = 'paused'; syncLl(); ui.showPause(); }
function resumeGame() { if (state !== 'paused') return; state = 'playing'; syncLl(); ui.hidePause(); lastTime = performance.now(); }
function doMute() { audio.setMuted(!audio.muted); Sdk.save('muted', audio.muted); ui.updateMute(audio.muted); }

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') { if (state === 'playing') pauseGame(); else if (state === 'paused') resumeGame(); return; }
  if (e.code >= 'Digit1' && e.code <= 'Digit7') { run.selected = Number(e.code.slice(5)) - 1; audio.select(); }
});
canvas.addEventListener('pointermove', (e) => {
  const p = canvasPos(e); mouse.x = p.x; mouse.y = p.y;
  if (mouse.down && state === 'playing') tryPlace(p.x, p.y);
});
canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  const p = canvasPos(e); mouse.x = p.x; mouse.y = p.y; mouse.down = true; lastPaint = null;
  if (state === 'playing') tryPlace(p.x, p.y);
});
window.addEventListener('pointerup', () => { mouse.down = false; lastPaint = null; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('blur', () => { mouse.down = false; if (state === 'playing') pauseGame(); });

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
    accumulator += dt;
    while (accumulator >= STEP) { tick(run, STEP); accumulator -= STEP; }
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
    step: (sec) => { const n = Math.ceil(sec * 60); for (let i = 0; i < n; i++) tick(run, 1 / 60); processEvents(); return getHud(run); },
    place: (c, r, id) => { placeTile(run, c, r, id); processEvents(); return getHud(run); },
    bulldoze: (c, r) => { placeTile(run, c, r, -1); processEvents(); return getHud(run); },
    setMoney: (n) => { run.money = n; return run.money; },
    select: (i) => { run.selected = i; return run.selected; },
  },
};