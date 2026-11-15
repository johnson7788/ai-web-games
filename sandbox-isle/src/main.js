// src/main.js — 装配：60Hz 固定步长 + 状态机 + 事件分发 + SDK 漏斗 + 标准调试口（window.__ll）。
import { STEP, CONFIG, WORLD, HOTBAR } from '../config/game.config.js';
import { createSim, updateSim, getHud, drainEvents, raycast, buildBridge, forceWin } from './game/sim.js';
import { createRenderer } from './render/index.js';
import { ui } from './ui/ui.js';
import { t } from './core/i18n.js';
import { save } from './core/save.js';
import { Sdk } from './core/sdk.js';
import { createAudio } from './core/audio.js';

const canvas = document.getElementById('canvas');
const renderer = createRenderer(canvas);
const audio = createAudio();
const $ = (id) => document.getElementById(id);
const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

let state = 'title'; // title | playing | paused | results
let run = createSim({ seed: (Math.random() * 1e9) | 0 });
let lastTime = 0, accumulator = 0;
let yaw = run.player.yaw, pitch = run.player.pitch;
let slot = 0;
let viewMode = 'fp';
let tutOrigin = { x: run.player.x, z: run.player.z };

// ---------------------------------------------------------------- 输入
const keys = new Set();
let fireQueued = false, placeQueued = false, interactQueued = false;
let mouseDX = 0, mouseDY = 0, locked = false;
let touchMove = { x: 0, y: 0 };

window.addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  keys.add(e.code);
  const digits = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4, Digit6: 5 };
  if (e.code in digits) slot = digits[e.code];
  if (e.code === 'KeyV' && state === 'playing') { viewMode = viewMode === 'fp' ? 'top' : 'fp'; renderer.setView(viewMode); }
  if (e.code === 'KeyE' && state === 'playing' && !e.repeat) interactQueued = true;
  if (e.code === 'Escape') {
    if (state === 'playing') pauseGame();
    else if (state === 'paused') resumeGame();
  }
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => { keys.clear(); if (state === 'playing') pauseGame(); });

// 鼠标：指针锁定视角 + 左键挖 / 右键放
canvas.addEventListener('click', () => {
  if (state === 'playing' && document.pointerLockElement !== canvas && !isTouch) {
    try { const p = canvas.requestPointerLock?.(); if (p?.catch) p.catch(() => {}); } catch {}
  }
});
window.addEventListener('mousemove', (e) => { if (locked) { mouseDX += e.movementX || 0; mouseDY += e.movementY || 0; } });
window.addEventListener('mousedown', (e) => {
  if (locked && state === 'playing') {
    if (e.button === 0) fireQueued = true;
    else if (e.button === 2) placeQueued = true;
  }
});
window.addEventListener('contextmenu', (e) => { if (locked) e.preventDefault(); });
document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === canvas; });
window.addEventListener('wheel', (e) => {
  if (state === 'playing') { slot = (slot + (e.deltaY > 0 ? 1 : -1) + HOTBAR.length) % HOTBAR.length; }
}, { passive: true });

// 触屏：摇杆移动 + 拖拽视角 + 挖/放/视角按钮
if (isTouch) {
  $('touch').classList.remove('hidden');
  const joy = $('joy');
  let jid = null, jx = 0, jy = 0;
  joy.addEventListener('touchstart', (e) => {
    e.preventDefault(); const t = e.changedTouches[0];
    jid = t.identifier; const r = joy.getBoundingClientRect();
    jx = r.left + r.width / 2; jy = r.top + r.height / 2; touchMove = { x: 0, y: 0 };
  }, { passive: false });
  joy.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) if (t.identifier === jid) {
      touchMove.x = clamp((t.clientX - jx) / 40, -1, 1);
      touchMove.y = clamp((t.clientY - jy) / 40, -1, 1);
    }
  }, { passive: false });
  const joyEnd = (e) => { for (const t of e.changedTouches) if (t.identifier === jid) { jid = null; touchMove = { x: 0, y: 0 }; } };
  joy.addEventListener('touchend', joyEnd); joy.addEventListener('touchcancel', joyEnd);

  let lid = null, lx = 0, ly = 0;
  canvas.addEventListener('touchstart', (e) => {
    for (const t of e.changedTouches) if (lid === null && t.target === canvas) { lid = t.identifier; lx = t.clientX; ly = t.clientY; }
  }, { passive: true });
  canvas.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) if (t.identifier === lid) {
      mouseDX += (t.clientX - lx); mouseDY += (t.clientY - ly); lx = t.clientX; ly = t.clientY;
    }
  }, { passive: true });
  const lookEnd = (e) => { for (const t of e.changedTouches) if (t.identifier === lid) lid = null; };
  canvas.addEventListener('touchend', lookEnd); canvas.addEventListener('touchcancel', lookEnd);

  const bindBtn = (btn, fn) => {
    btn.addEventListener('pointerdown', (e) => { e.preventDefault(); fn(); });
  };
  bindBtn($('btn-dig'), () => { fireQueued = true; });
  bindBtn($('btn-place'), () => { placeQueued = true; });
  bindBtn($('btn-view'), () => { viewMode = viewMode === 'fp' ? 'top' : 'fp'; renderer.setView(viewMode); });
}

function readInput() {
  // 视角
  yaw -= mouseDX * 0.0024;
  pitch -= mouseDY * 0.0024;
  pitch = clamp(pitch, -1.45, 1.45);
  mouseDX = 0; mouseDY = 0;

  const input = {
    move: { x: 0, z: 0 }, yaw, pitch, slot,
    action: null, interact: false,
  };
  const f = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
  const s = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
  input.move = { x: s + touchMove.x, z: f - touchMove.y };

  // 动作（射线命中）
  const e = { x: run.player.x, y: run.player.y + WORLD.EYE, z: run.player.z };
  const sin = Math.sin(yaw), cos = Math.cos(yaw);
  const dx = -sin * Math.cos(pitch), dy = Math.sin(pitch), dz = -cos * Math.cos(pitch);
  const hit = raycast(run, e.x, e.y, e.z, dx, dy, dz, WORLD.REACH);
  if (hit.hit && fireQueued) input.action = { kind: 'dig', x: hit.x, y: hit.y, z: hit.z };
  else if (hit.hit && placeQueued) input.action = { kind: 'place', x: hit.x + hit.nx, y: hit.y + hit.ny, z: hit.z + hit.nz, block: HOTBAR[slot] };
  input.interact = interactQueued;
  fireQueued = placeQueued = interactQueued = false;
  return input;
}

// ---------------------------------------------------------------- 流程
function startRun() {
  run = createSim({ seed: (Math.random() * 1e9) | 0 });
  yaw = run.player.yaw; pitch = run.player.pitch;
  slot = 0; viewMode = 'fp'; renderer.setView(viewMode);
  tutOrigin = { x: run.player.x, z: run.player.z };
  state = 'playing';
  renderer.setHeld(true);
  ui.showGame();
  audio.unlock(); audio.play('start');
  Sdk.newRun({ mode: 'sandbox' });
  if (!save.get('tutDone', false)) ui.tutorial.start();
  lastTime = performance.now();
  accumulator = 0;
}

function pauseGame() {
  if (state !== 'playing') return;
  state = 'paused';
  ui.showPause();
  audio.stopAll();
  if (document.pointerLockElement === canvas) document.exitPointerLock?.();
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
  renderer.setHeld(false);
  ui.showTitle();
  audio.stopAll();
  if (document.pointerLockElement === canvas) document.exitPointerLock?.();
}

function endRun() {
  state = 'results';
  renderer.setHeld(false);
  const hud = getHud(run);
  save.set('best', Math.max(save.get('best', 0), hud.gold));
  Sdk.levelCleared({ goals: hud.totalGoalsCompleted, gold: hud.gold });
  audio.event('win');
  ui.showResults(hud);
  if (document.pointerLockElement === canvas) document.exitPointerLock?.();
}

// ---------------------------------------------------------------- 事件分发
function dispatch(ev) {
  audio.event(ev.type);
  renderer.onEvent(ev);
  if (ev.type === 'dig' || ev.type === 'place') renderer.dirty = true;
  if (ev.type === 'goal_complete') { ui.popup(t('goalDone', { gold: ev.gold }), 'good'); Sdk.track('goal_complete', { id: ev.id }); }
  else if (ev.type === 'produce') ui.popup(t('produced', { gold: ev.gold }), 'warn');
  else if (ev.type === 'day') ui.popup(t('newDay', { n: ev.day }), 'good');
  else if (ev.type === 'collapse') ui.popup(t('collapsed'), 'bad');
  // 引导：真实动作推进
  const tut = ui.tutorial;
  if (tut.active) {
    if (tut.step === 1 && ev.type === 'dig') tut.next();
    else if (tut.step === 2 && ev.type === 'place') tut.next();
    else if (tut.step === 3 && (ev.type === 'feed' || ev.type === 'harvest' || ev.type === 'goal_complete')) tut.next();
  }
}

// ---------------------------------------------------------------- 主循环
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - lastTime) / 1000, 0.25);
  lastTime = now;

  if (state === 'playing') {
    accumulator += dt;
    let guard = 0;
    while (accumulator >= STEP && guard++ < 60) {
      const input = readInput();
      updateSim(run, input, STEP);
      const hud = getHud(run);
      ui.updateHUD(hud);
      for (const ev of drainEvents(run)) dispatch(ev);
      // 引导第 0 步：走两步
      const tut = ui.tutorial;
      if (tut.active && tut.step === 0) {
        if (Math.hypot(run.player.x - tutOrigin.x, run.player.z - tutOrigin.z) > 2) tut.next();
      }
      if (run.phase === 'won') { endRun(); break; }
      accumulator -= STEP;
    }
  }

  renderer.render(run, dt);
}

// ---------------------------------------------------------------- UI 接线
$('btn-start').addEventListener('click', () => { audio.ui(); startRun(); });
$('btn-resume').addEventListener('click', () => { audio.ui(); resumeGame(); });
$('btn-restart-pause').addEventListener('click', () => { audio.ui(); Sdk.track('restart'); startRun(); });
$('btn-menu-pause').addEventListener('click', () => { audio.ui(); toMenu(); });
$('btn-restart').addEventListener('click', () => { audio.ui(); Sdk.track('restart'); startRun(); });
$('btn-menu').addEventListener('click', () => { audio.ui(); toMenu(); });
$('btn-howto').addEventListener('click', () => { audio.ui(); ui.tutorial.start(); });
$('btn-bridge').addEventListener('click', () => { audio.ui(); buildBridge(run); });
$('btn-share').addEventListener('click', () => { Sdk.share({ title: CONFIG.langNames.en, text: t('shareText') }); });
$('btn-mute').addEventListener('click', () => {
  const m = !save.get('muted', false);
  save.set('muted', m);
  audio.setMuted(m);
  ui.applyLang();
});
for (const sel of [$('lang-select'), $('lang-select-pause')]) {
  sel.addEventListener('change', (e) => ui.setLang(e.target.value));
}

function updateRotate() {
  const portrait = innerHeight > innerWidth;
  const show = isTouch && portrait && !save.get('rotateDismissed', false);
  $('rotate').classList.toggle('hidden', !show);
}
$('btn-rotate-skip').addEventListener('click', () => { save.set('rotateDismissed', true); updateRotate(); });

function resize() {
  renderer.stage.resize();
  const s = Math.min(innerWidth / 1280, innerHeight / 720);
  const stage = $('stage');
  stage.style.transform = `translate(-50%, -50%) scale(${s})`;
}
window.addEventListener('resize', () => { resize(); updateRotate(); });

document.addEventListener('visibilitychange', () => { if (document.hidden) { keys.clear(); if (state === 'playing') pauseGame(); } });
window.addEventListener('pagehide', () => Sdk.track('session_end', { best: save.get('best', 0) }));

// ---------------------------------------------------------------- 启动
audio.setMuted(save.get('muted', false));
Sdk.ready().then(() => Sdk.track('load', {}));
ui.applyLang();
ui.showTitle();
renderer.setView(viewMode);
resize();
updateRotate();
lastTime = performance.now();
requestAnimationFrame(loop);

// ---------------------------------------------------------------- 标准调试口
window.G = { Game: { startRun, pauseGame, resumeGame }, UI: ui, Render: renderer, Audio: audio, Save: save };
window.__ll = {
  get state() { return { phase: state, simPhase: run.phase, lang: ui.lang, dir: ui.dir }; },
  get run() { return run; },
  get hud() { return getHud(run); },
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
  setSlot: (i) => { slot = clamp(i | 0, 0, HOTBAR.length - 1); },
  setView: (v) => { viewMode = v; renderer.setView(v); },
  demo: {
    win: () => { if (state !== 'playing') startRun(); forceWin(run); endRun(); },
    ending: () => { if (state !== 'playing') startRun(); forceWin(run); endRun(); },
  },
  save: () => save,
  ui: () => ui,
  lang: () => ui.lang,
  setLang: (l) => ui.setLang(l),
};
