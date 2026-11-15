// src/main.js — 装配：60Hz 固定步长 + 状态机 + 事件分发 + SDK 漏斗 + 标准调试口。
// 共享入口只由 Lead 改。契约见 README。
import { STEP, CONFIG, MATCH } from '../config/game.config.js';
import { createSim, updateSim, getHud, drainEvents, pickUpgrade, ratingFor } from './game/sim.js';
import { createRenderer } from './render/index.js';
import { ui } from './ui/ui.js';
import { save } from './core/save.js';
import { Sdk } from './core/sdk.js';
import { createAudio } from './core/audio.js';
import { THREE } from './core/base3d.js';

const canvas = document.getElementById('canvas');
const renderer = createRenderer(canvas);
const audio = createAudio();
const $ = (id) => document.getElementById(id);
const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

// 场上标记：玩家（YOU）与敌人（▼）——让「敌我/目标」一眼可辨。
const markersLayer = $('markers');
const markers = [];
for (let i = 0; i < MATCH.fighters; i++) {
  const m = document.createElement('div');
  m.className = 'marker';
  markersLayer.appendChild(m);
  markers.push(m);
}
function updateMarkers() {
  const playing = state === 'playing';
  markersLayer.classList.toggle('hidden', !playing);
  if (!playing) return;
  const cam = renderer.camera;
  for (let i = 0; i < markers.length; i++) {
    const f = run.fighters[i];
    const m = markers[i];
    if (!f || !f.alive || f.gone) { m.style.display = 'none'; continue; }
    const v = new THREE.Vector3(f.x, f.y + 2.4, f.z).project(cam);
    if (v.z > 1 || Math.abs(v.x) > 1.3 || Math.abs(v.y) > 1.3) { m.style.display = 'none'; continue; }
    m.style.display = 'block';
    m.style.left = `${((v.x + 1) * 0.5) * 1280}px`;
    m.style.top = `${((1 - v.y) * 0.5) * 720}px`;
    if (i === 0) { m.textContent = '▼ YOU'; m.className = 'marker you'; }
    else { m.textContent = '▼'; m.className = 'marker foe'; }
  }
}

let state = 'title'; // title | playing | paused | results
let run = createSim({ seed: 1 });
run.hud = getHud(run);
let lastTime = 0, accumulator = 0;
let totalTime = 0;
let upgradeActive = false;

// ---------------------------------------------------------------- 输入
const keys = new Set();
const pressed = new Set();
let camYaw = 0;
let touchMove = { x: 0, y: 0 };

window.addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  if (!keys.has(e.code)) pressed.add(e.code);
  keys.add(e.code);
  if (e.code === 'Escape') {
    if (state === 'playing') pauseGame();
    else if (state === 'paused') resumeGame();
  }
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => { keys.clear(); if (state === 'playing') pauseGame(); });

// 鼠标拖拽旋转视角
let dragging = false, lastX = 0;
canvas.addEventListener('mousedown', (e) => { dragging = true; lastX = e.clientX; });
window.addEventListener('mousemove', (e) => { if (dragging) camYaw -= (e.clientX - lastX) * 0.005; lastX = e.clientX; });
window.addEventListener('mouseup', () => { dragging = false; });

function readInput() {
  if (window.__AUTO) {
    const a = window.__AUTO;
    return { mx: a.mx || 0, mz: a.mz || 0, punch: !!a.punch, grab: !!a.grab, ult: !!a.ult };
  }
  const f = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
  const r = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
  let fwd = f, right = r;
  if (isTouch && (touchMove.x || touchMove.y)) { fwd = -touchMove.y; right = touchMove.x; }
  const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
  const rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
  const mx = fx * fwd + rx * right;
  const mz = fz * fwd + rz * right;
  const len = Math.hypot(mx, mz);
  return {
    mx: len > 1 ? mx / len : mx,
    mz: len > 1 ? mz / len : mz,
    punch: pressed.has('KeyJ'),
    grab: pressed.has('KeyK'),
    ult: pressed.has('KeyL'),
  };
}

// 触屏：摇杆 + 按钮
if (isTouch) {
  const joy = $('joy'), knob = $('joy-knob');
  let joyId = null, jx = 0, jy = 0, lookId = null, lx = 0;
  joy.addEventListener('touchstart', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (joyId === null) { joyId = t.identifier; jx = t.clientX; jy = t.clientY; }
    }
  }, { passive: false });
  joy.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === joyId) {
        touchMove.x = Math.max(-1, Math.min(1, (t.clientX - jx) / 46));
        touchMove.y = Math.max(-1, Math.min(1, (t.clientY - jy) / 46));
        knob.style.transform = `translate(calc(-50% + ${touchMove.x * 34}px), calc(-50% + ${touchMove.y * 34}px))`;
      }
    }
  }, { passive: false });
  const joyEnd = (e) => { for (const t of e.changedTouches) if (t.identifier === joyId) { joyId = null; touchMove.x = 0; touchMove.y = 0; knob.style.transform = 'translate(-50%, -50%)'; } };
  joy.addEventListener('touchend', joyEnd); joy.addEventListener('touchcancel', joyEnd);

  // 右侧滑动转视角
  const stage = $('stage');
  stage.addEventListener('touchstart', (e) => {
    for (const t of e.changedTouches) {
      if (t.clientX > window.innerWidth * 0.5 && lookId === null) { lookId = t.identifier; lx = t.clientX; }
    }
  }, { passive: false });
  stage.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === lookId) { camYaw -= (t.clientX - lx) * 0.006; lx = t.clientX; }
    }
  }, { passive: false });
  const lookEnd = (e) => { for (const t of e.changedTouches) if (t.identifier === lookId) lookId = null; };
  stage.addEventListener('touchend', lookEnd); stage.addEventListener('touchcancel', lookEnd);

  const bind = (elm, key) => {
    elm.addEventListener('pointerdown', (e) => { e.preventDefault(); pressed.add(key); keys.add(key); });
    elm.addEventListener('pointerup', () => keys.delete(key));
    elm.addEventListener('pointercancel', () => keys.delete(key));
  };
  bind($('btn-touch-punch'), 'KeyJ');
  bind($('btn-touch-grab'), 'KeyK');
  bind($('btn-touch-ult'), 'KeyL');
}

// ---------------------------------------------------------------- 流程
function startRun() {
  run = createSim({ seed: (Math.random() * 1e9) | 0 });
  run.hud = getHud(run);
  totalTime = 0;
  upgradeActive = false;
  state = 'playing';
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
  state = 'results';
  const score = run.stats.score;
  const best = Math.max(save.get('best', 0), score);
  const isRecord = score > save.get('best', 0) && score > 0;
  save.set('best', best);
  const rating = ratingFor(score);
  const won = run.phase === 'won';
  if (won) Sdk.levelCleared({ score, rating });
  else Sdk.gameOver({ score, rating });
  audio.stopAll();
  audio.event(won ? 'win' : 'fail');
  run.totalTime = totalTime;
  ui.showResults(run, { score, best, isRecord, rating, won });
}

function pickUpgradeChoice(id) {
  if (pickUpgrade(run, id)) {
    upgradeActive = false;
    ui.showGame();
    audio.event('pickup');
    lastTime = performance.now();
  }
}

// ---------------------------------------------------------------- 事件分发
function dispatch(ev) {
  audio.event(ev.type);
  ui.popup(ev);
  renderer.onEvent(ev);
  if (ev.type === 'nearMiss') Sdk.track('nearMiss', {});
  const tut = ui.tutorial;
  if (tut.active) {
    if (tut.step === 1 && ev.type === 'punch' && ev.from === 0) tut.next();
    else if (tut.step === 2 && (ev.type === 'grab' || ev.type === 'throw') && ev.from === 0) tut.next();
    else if (tut.step === 3 && (ev.type === 'kill' || ev.type === 'fall') && ev.by === 0) tut.next();
  }
}

// ---------------------------------------------------------------- 主循环
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - lastTime) / 1000, 0.25);
  lastTime = now;

  if (state === 'playing' && !upgradeActive) {
    accumulator += dt;
    let guard = 0;
    while (accumulator >= STEP && guard++ < 60) {
      const inp = readInput();
      if (inp.mx || inp.mz) { if (ui.tutorial.active && ui.tutorial.step === 0) ui.tutorial.next(); }
      updateSim(run, inp);
      run.hud = getHud(run);
      totalTime += STEP;
      for (const ev of drainEvents(run)) dispatch(ev);
      pressed.clear();
      accumulator -= STEP;
      if (run.phase === 'won' || run.phase === 'lost') { endRun(); break; }
      if (run.phase === 'upgrade') { upgradeActive = true; ui.showUpgrade(run, pickUpgradeChoice); break; }
    }
    ui.updateHUD(run);
  } else {
    pressed.clear();
  }

  renderer.render(run, dt, { yaw: camYaw, title: state === 'title' });
  updateMarkers();
}

// ---------------------------------------------------------------- UI 接线
$('btn-start').addEventListener('click', () => { audio.event('ui_click'); startRun(); });
$('btn-resume').addEventListener('click', () => { audio.event('ui_click'); resumeGame(); });
$('btn-restart-pause').addEventListener('click', () => { audio.event('ui_click'); Sdk.track('restart'); startRun(); });
$('btn-menu-pause').addEventListener('click', () => { audio.event('ui_back'); toMenu(); });
$('btn-restart').addEventListener('click', () => { audio.event('ui_click'); Sdk.track('restart'); startRun(); });
$('btn-share').addEventListener('click', () => Sdk.share({ title: CONFIG.title, text: `I scored ${run.stats.score} in ARENA 8!` }));
$('btn-menu').addEventListener('click', () => { audio.event('ui_back'); toMenu(); });
$('btn-howto').addEventListener('click', () => { audio.event('ui_click'); ui.tutorial.start('title'); });
$('btn-mute').addEventListener('click', () => {
  const m = !save.get('muted', false);
  save.set('muted', m);
  audio.setMuted(m);
  ui.applyLang();
});
for (const sel of [$('lang-select'), $('lang-select-pause')]) {
  sel.addEventListener('change', (e) => ui.setLang(e.target.value));
}

function resize() {
  const ww = innerWidth, wh = innerHeight;
  let w = ww, h = ww * 9 / 16;
  if (h > wh) { h = wh; w = wh * 16 / 9; }
  const s = Math.min(ww / 1280, wh / 720);
  $('stage').style.transform = `translate(-50%, -50%) scale(${s})`;
}
window.addEventListener('resize', resize);

function updateRotate() {
  const portrait = innerHeight > innerWidth;
  const show = isTouch && portrait && !save.get('rotateDismissed', false);
  $('rotate').classList.toggle('hidden', !show);
}
$('btn-rotate-skip').addEventListener('click', () => { save.set('rotateDismissed', true); updateRotate(); });

document.addEventListener('visibilitychange', () => {
  if (document.hidden) { keys.clear(); if (state === 'playing') pauseGame(); }
});
window.addEventListener('pagehide', () => Sdk.track('session_end', { best: save.get('best', 0) }));

// ---------------------------------------------------------------- 启动
audio.setMuted(save.get('muted', false));
Sdk.ready().then(() => Sdk.track('load', { appId: CONFIG.appId }));
ui.applyLang();
ui.showTitle();
resize();
updateRotate();
lastTime = performance.now();
requestAnimationFrame(loop);

// ---------------------------------------------------------------- 标准调试口
window.G = { Game: { startRun, pauseGame, resumeGame }, UI: ui, Render: renderer, Audio: audio, Save: save };
window.__ll = {
  get state() { return { phase: state, simPhase: run.phase, lang: ui.lang, dir: ui.dir }; },
  get run() { return run; },
  get hud() { return run.hud; },
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
};
