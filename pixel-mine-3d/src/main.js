// src/main.js — 装配：60Hz 固定步长 + 状态机 + 事件分发 + SDK 漏斗 + 标准调试口。
import { STEP, CONFIG } from '../config/game.config.js';
import { createSim, updateSim, getHud, drainEvents, recallToCamp, finish as finishRun } from './game/sim.js';
import { createRenderer } from './render/index.js';
import { ui } from './ui/ui.js';
import { save } from './core/save.js';
import { Sdk } from './core/sdk.js';
import { createAudio } from './core/audio.js';

const $ = (id) => document.getElementById(id);
const stage = $('stage');
const canvas = $('canvas');
const renderer = createRenderer(canvas);
const audio = createAudio();
const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
const SENS = 0.0024;

let state = 'title';          // title | playing | paused | results
let run = null;
let upgradeOpen = false;
let ended = false;
let lastTime = 0, accumulator = 0;
let yaw = 0, pitch = 0;
let mineHeld = false, placeQueued = false, jumpQueued = false;
let locked = false, firstInputDone = false;

const keys = new Set();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------------- 输入 ----------------
window.addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  keys.add(e.code);
  audio.ensure();
  markFirstInput();
  if (e.code === 'Space' && !e.repeat) jumpQueued = true;
  if (e.code === 'Escape') {
    if (upgradeOpen) { upgradeOpen = false; ui.closeUpgrade(); }
    else if (state === 'playing') pauseGame();
    else if (state === 'paused') resumeGame();
  }
  if ((e.code === 'Tab' || e.code === 'KeyE') && state === 'playing') toggleUpgrade();
  if (e.code === 'KeyR' && state === 'playing') recallToCamp(run, true);
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => { keys.clear(); mineHeld = false; if (state === 'playing') pauseGame(); });

canvas.addEventListener('mousedown', (e) => {
  audio.ensure();
  markFirstInput();
  if (state !== 'playing') return;
  if (e.button === 0) { mineHeld = true; try { const p = canvas.requestPointerLock?.(); if (p?.catch) p.catch(() => {}); } catch {} }
  if (e.button === 2) placeQueued = true;
});
window.addEventListener('mouseup', (e) => { if (e.button === 0) mineHeld = false; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('mousemove', (e) => {
  if (!locked || state !== 'playing') return;
  yaw -= e.movementX * SENS;
  pitch -= e.movementY * SENS;
  pitch = clamp(pitch, -1.45, 1.45);
});
document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === canvas; });

function markFirstInput() {
  if (firstInputDone) return;
  firstInputDone = true;
  Sdk.track('first_input', { ms: Math.round(performance.now()) });
}

function readInput() {
  if (window.__AUTO) {
    const a = window.__AUTO;
    return { yaw: a.yaw ?? yaw, pitch: a.pitch ?? pitch, f: a.f || 0, s: a.s || 0, jump: !!a.jump, mine: !!a.mine, place: false, target: a.target || null };
  }
  const f = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
  const s = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
  const inp = {
    yaw, pitch,
    f: f + touchF,
    s: s + touchS,
    jump: jumpQueued,
    mine: mineHeld || touchMine,
    place: placeQueued,
    target: null,
  };
  jumpQueued = false;
  placeQueued = false;
  return inp;
}

// ---------------- 触屏 ----------------
let touchF = 0, touchS = 0, touchMine = false;
if (isTouch) {
  const joy = $('joy'), knob = $('joy-knob');
  let joyId = null, jcx = 0, jcy = 0;
  joy.addEventListener('pointerdown', (e) => {
    joyId = e.pointerId; joy.setPointerCapture(e.pointerId);
    const r = joy.getBoundingClientRect(); jcx = r.left + r.width / 2; jcy = r.top + r.height / 2;
  });
  joy.addEventListener('pointermove', (e) => {
    if (e.pointerId !== joyId) return;
    let dx = (e.clientX - jcx) / 45, dy = (e.clientY - jcy) / 45;
    const len = Math.hypot(dx, dy); if (len > 1) { dx /= len; dy /= len; }
    touchS = dx; touchF = -dy;
    knob.style.transform = `translate(calc(-50% + ${dx * 30}px), calc(-50% + ${dy * 30}px))`;
  });
  const joyEnd = (e) => { if (e.pointerId === joyId) { joyId = null; touchS = 0; touchF = 0; knob.style.transform = 'translate(-50%,-50%)'; } };
  joy.addEventListener('pointerup', joyEnd);
  joy.addEventListener('pointercancel', joyEnd);

  const bind = (id, set) => {
    const b = $(id);
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.classList.add('active'); set(true); });
    const up = (e) => { e.preventDefault(); b.classList.remove('active'); set(false); };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
  };
  bind('btn-mine', (v) => { touchMine = v; });
  $('btn-ladder').addEventListener('pointerdown', () => { placeQueued = true; });
  $('btn-jump').addEventListener('pointerdown', () => { jumpQueued = true; });
  $('btn-camp').addEventListener('pointerdown', () => { if (run) recallToCamp(run, true); });
  $('btn-bag').addEventListener('pointerdown', () => { if (state === 'playing') toggleUpgrade(); });

  // 右半屏拖动 = 视角
  let lookId = null, lx = 0, ly = 0;
  canvas.addEventListener('touchstart', (e) => {
    for (const t of e.changedTouches) {
      if (t.clientX > window.innerWidth * 0.4 && lookId === null) { lookId = t.identifier; lx = t.clientX; ly = t.clientY; }
    }
  }, { passive: false });
  canvas.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === lookId) {
        yaw -= (t.clientX - lx) * 0.006;
        pitch -= (t.clientY - ly) * 0.006;
        pitch = clamp(pitch, -1.45, 1.45);
        lx = t.clientX; ly = t.clientY;
      }
    }
    e.preventDefault();
  }, { passive: false });
  const lookEnd = (e) => { for (const t of e.changedTouches) if (t.identifier === lookId) lookId = null; };
  canvas.addEventListener('touchend', lookEnd);
  canvas.addEventListener('touchcancel', lookEnd);
}

// ---------------- 流程 ----------------
function startRun() {
  run = createSim({ seed: (Math.random() * 1e9) | 0, bestDepth: save.get('bestDepth', 0) });
  run.hud = getHud(run);
  ui.setRun(run);
  ended = false;
  state = 'playing';
  upgradeOpen = false;
  yaw = 0; pitch = -0.45;
  ui.showGame();
  audio.ensure(); audio.resume(); audio.event('start');
  Sdk.newRun({});
  if (!save.get('tutDone', false)) ui.tutorial.start();
  lastTime = performance.now();
  accumulator = 0;
}

function pauseGame() {
  if (state !== 'playing') return;
  state = 'paused';
  ui.showPause();
  audio.stopAll();
}
function resumeGame() {
  if (state !== 'paused') return;
  state = 'playing';
  ui.hidePause();
  audio.resume();
  lastTime = performance.now();
}
function toMenu() {
  state = 'title';
  ui.showTitle();
  audio.stopAll();
}
function endRun() {
  ended = true;
  state = 'results';
  const prevBest = save.get('bestDepth', 0);
  if (run.depthMax > prevBest) save.set('bestDepth', Math.floor(run.depthMax));
  save.set('totalAssets', (save.get('totalAssets', 0) || 0) + run.stats.earned);
  audio.stopAll();
  if (run.treasureFound) Sdk.levelCleared({ score: run.stats.earned });
  else Sdk.track('session_end', { score: run.stats.earned });
  ui.showResults(run);
}
function toggleUpgrade() {
  if (upgradeOpen) { upgradeOpen = false; ui.closeUpgrade(); }
  else { upgradeOpen = true; ui.openUpgrade(run); }
}

// ---------------- 事件分发 ----------------
function dispatch(ev) {
  audio.event(ev.type);
  ui.popup(ev);
  ui.tutorial.doneCheck(run);
  if (ev.type === 'sell') Sdk.track('sell', { value: ev.value });
  if (ev.type === 'upgrade') Sdk.track('upgrade', { id: ev.id });
}

// ---------------- 主循环 ----------------
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - lastTime) / 1000, 0.5);
  lastTime = now;
  if (state === 'playing' && !upgradeOpen) {
    accumulator += dt;
    let guard = 0;
    while (accumulator >= STEP && guard++ < 60) {
      updateSim(run, readInput());
      run.hud = getHud(run);
      for (const ev of drainEvents(run)) dispatch(ev);
      accumulator -= STEP;
      if (run.phase === 'finished' && !ended) { endRun(); break; }
    }
    ui.updateHUD(run);
    audio.setMuted(save.get('muted', false));
  }
  renderer.render(state === 'title' ? null : run);
}

// ---------------- UI 接线 ----------------
$('btn-start').addEventListener('click', () => { audio.ensure(); audio.ui(); startRun(); });
$('btn-howto').addEventListener('click', () => { audio.ui(); ui.tutorial.start(); });
$('btn-resume').addEventListener('click', () => { audio.ui(); resumeGame(); });
$('btn-restart-pause').addEventListener('click', () => { audio.ui(); Sdk.track('restart'); startRun(); });
$('btn-menu-pause').addEventListener('click', () => { audio.ui(); toMenu(); });
$('btn-restart').addEventListener('click', () => { audio.ui(); Sdk.track('restart'); startRun(); });
$('btn-menu').addEventListener('click', () => { audio.ui(); toMenu(); });
$('btn-upg-close').addEventListener('click', () => { audio.ui(); upgradeOpen = false; ui.closeUpgrade(); });
$('btn-mute').addEventListener('click', () => {
  const m = !save.get('muted', false);
  save.set('muted', m);
  audio.setMuted(m);
  ui.applyLang();
});
$('btn-rotate-skip').addEventListener('click', () => { save.set('rotateDismissed', true); updateRotate(); });
for (const sel of [$('lang-select'), $('lang-select-pause')]) {
  sel.addEventListener('change', (e) => ui.setLang(e.target.value));
}

function updateRotate() {
  const portrait = innerHeight > innerWidth;
  $('rotate').classList.toggle('hidden', !(isTouch && portrait && !save.get('rotateDismissed', false)));
}
function resize() {
  const s = Math.min(innerWidth / 1280, innerHeight / 720);
  stage.style.transform = `translate(-50%,-50%) scale(${s})`;
  if (ui.tutorial.active) ui.tutorial.render();
}
window.addEventListener('resize', () => { resize(); updateRotate(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'playing') pauseGame(); });
window.addEventListener('pagehide', () => Sdk.track('session_end', { bestDepth: save.get('bestDepth', 0) }));

// ---------------- 启动 ----------------
audio.setMuted(save.get('muted', false));
Sdk.ready().then(() => Sdk.track('load', { appId: CONFIG.title }));
ui.applyLang();
ui.showTitle();
resize();
updateRotate();
lastTime = performance.now();
requestAnimationFrame(loop);

// ---------------- 标准调试口 ----------------
window.G = { Game: { startRun, pauseGame, resumeGame }, UI: ui, Render: renderer, Audio: audio, Save: save };
window.__ll = {
  get state() { return { phase: state, lang: ui.lang, dir: ui.dir }; },
  get run() { return run; },
  get hud() { return run ? run.hud : null; },
  start: startRun,
  pause: pauseGame,
  resume: resumeGame,
  restart: toMenu,
  startAct: startRun,
  startTutorial: () => ui.tutorial.start(),
  get tutorial() {
    const t = ui.tutorial;
    return { active: t.active, step: t.step, steps: t.steps, current: t.current, skip: () => t.skip() };
  },
  save: () => save,
  ui: () => ui,
  lang: () => ui.lang,
  setLang: (l) => ui.setLang(l),
  setInput: (obj) => { window.__AUTO = obj; },
  finish: () => { if (run) finishRun(run); },
  recall: () => { if (run) recallToCamp(run, true); },
};
