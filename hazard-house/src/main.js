// 主入口：HAZARD HOUSE。状态机 title → playing ⇄ paused → over。本地 1–4 人。
import { STEP, RULES } from '../config/game.config.js';
import { createRun, tick, getHud, drainEvents } from './game/sim.js';
import { createRenderer } from './render/index.js';
import { ui } from './ui/ui.js';
import { audio } from './audio.js';
import Sdk from './core/sdk.js';

const canvas = document.getElementById('canvas');
const renderer = createRenderer(canvas);

let run = createRun({ seed: 1, humans: 1 });
let state = 'title';
let lastTime = performance.now();
let accumulator = 0;
const keys = Object.create(null);

const llState = { phase: 'title', lang: ui.lang, dir: ui.dir };
function syncLl() { llState.phase = state; llState.lang = ui.lang; llState.dir = ui.dir; }

function buildInputs() {
  const k = (c) => !!keys[c];
  const solo = run.humans === 1;
  return [
    { up: k('KeyW') || (solo && k('ArrowUp')), down: k('KeyS') || (solo && k('ArrowDown')), left: k('KeyA') || (solo && k('ArrowLeft')), right: k('KeyD') || (solo && k('ArrowRight')) },
    { up: k('ArrowUp'), down: k('ArrowDown'), left: k('ArrowLeft'), right: k('ArrowRight') },
    { up: k('KeyI'), down: k('KeyK'), left: k('KeyJ'), right: k('KeyL') },
    { up: k('KeyT'), down: k('KeyG'), left: k('KeyF'), right: k('KeyH') },
  ];
}

function processEvents() {
  for (const ev of drainEvents(run)) {
    if (ev.type === 'hit') audio.hit();
    else if (ev.type === 'eliminated') audio.eliminated();
    else if (ev.type === 'boom') { audio.boom(); renderer.addBurst(ev.x, ev.y); }
    else if (ev.type === 'go') audio.go();
    else if (ev.type === 'roundend') { if (ev.winner >= 0) audio.roundWin(); }
    else if (ev.type === 'matchend') onMatchEnd(ev.winner);
  }
}

function startGame() {
  run = createRun({ seed: Math.floor(Math.random() * 0x7fffffff), humans: ui.humans });
  renderer.clearEffects();
  accumulator = 0;
  state = 'playing';
  syncLl();
  Sdk.newRun({ mode: 'hazard', humans: ui.humans });
  ui.showGame();
  lastTime = performance.now();
}
function backToTitle() { state = 'title'; syncLl(); ui.showTitle(); }
function pauseGame() { if (state !== 'playing') return; state = 'paused'; syncLl(); ui.showPause(); }
function resumeGame() { if (state !== 'paused') return; state = 'playing'; syncLl(); ui.hidePause(); lastTime = performance.now(); }
function onMatchEnd(winner) {
  state = 'over'; syncLl();
  audio.champion();
  Sdk.gameOver({ winner });
  ui.showEnd(winner);
}
function doMute() { audio.setMuted(!audio.muted); Sdk.save('muted', audio.muted); ui.updateMute(audio.muted); }

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (state === 'playing') pauseGame(); else if (state === 'paused') resumeGame();
    return;
  }
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  keys[e.code] = true;
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k of Object.keys(keys)) keys[k] = false; if (state === 'playing') pauseGame(); });

ui.countBtns.forEach((b, i) => { if (b) b.addEventListener('click', () => { audio.unlock(); audio.click(); ui.setHumans(i + 1); }); });
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
    const inputs = buildInputs();
    accumulator += dt;
    while (accumulator >= STEP) { tick(run, STEP, inputs); accumulator -= STEP; }
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
    step: (sec, inputs) => { const n = Math.ceil(sec * 60); for (let i = 0; i < n; i++) tick(run, 1 / 60, inputs || []); processEvents(); return getHud(run); },
    setHumans: (n) => { ui.setHumans(n); return n; },
    setScores: (arr) => { run.scores = [...arr]; return run.scores; },
    killAllBut: (id) => { for (const p of run.players) { if (p.id !== id) { p.alive = false; p.hp = 0; } } return getHud(run); },
    playAll: () => {
      run.humans = 0;
      for (const p of run.players) p.isBot = true;
      let guard = 0;
      while (run.phase !== 'over' && guard < 60 * 400) { tick(run, 1 / 60, []); processEvents(); guard++; }
      return getHud(run);
    },
  },
};