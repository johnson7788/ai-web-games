// src/main.js — 装配：60Hz 固定步长 + 标题/游戏/暂停/结算状态机 + 拖拽瞄准 + SDK + __ll 调试口。
import { STEP, GOLF, CAMERA } from '../config/game.config.js';
import { createRun, shoot, step, drainEvents, getHud, solveAim, resetShot, HOLES, totalPar } from './game/sim.js';
import { createRenderer } from './render/index.js';
import { ui } from './ui/ui.js';
import { save } from './core/save.js';
import { Sdk } from './core/sdk.js';
import { createAudio } from './core/audio.js';
import { t } from './core/i18n.js';

const canvas = document.getElementById('canvas');
const renderer = createRenderer(canvas);
const audio = createAudio();
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const POWER_DRAG_LEN = 160;

let state = 'title'; // title | playing | paused | results
let run = createRun({ seed: 1 });
let lastTime = performance.now();
let accumulator = 0;

// 遥测打点
let gameplayStart = 0;
let firstInputSec = null;
let firstSuccessSec = null;

// ---------------------------------------------------------------- 流程
function startGame() {
  run = createRun({ seed: (Date.now() % 100000) | 0 });
  state = 'playing';
  accumulator = 0;
  firstInputSec = null;
  firstSuccessSec = null;
  gameplayStart = performance.now();
  ui.showGame();
  audio.unlock();
  renderer.faceBallFromHole(run);
  Sdk.newRun({ mode: '24-hole' });
  if (!save.get('tutDone', false)) ui.tutorial.start();
  lastTime = performance.now();
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
  ui.showTitle(save.get('best', 0));
  audio.stopAll();
}

function endRun() {
  state = 'results';
  const total = run.totalStrokes;
  const best = save.get('best', 0);
  const isRecord = best === 0 || total < best;
  if (isRecord && total > 0) save.set('best', total);
  const cumAces = save.get('aces', 0) + run.aces;
  save.set('aces', cumAces);
  const info = {
    rating: run.lastRating || ratingOf(run),
    total,
    totalPar: run.totalPar,
    birdies: run.birdies,
    aces: run.aces,
    isRecord,
  };
  run.lastRating = info.rating;
  Sdk.levelCleared({ score: total, rating: info.rating });
  audio.stopAll();
  ui.showResults(run, info);
  Sdk.track('session_end', { sec: Math.round(run.time), hole: run.holeIndex + 1 });
}

function ratingOf(r) { return r.lastRating || 'B'; }

// ---------------------------------------------------------------- 事件分发
function resultText(result) {
  return t(result === 'double' ? 'doubleBogey' : result);
}

function dispatch(ev) {
  audio.event(ev.type);
  if (ev.type === 'shot') {
    Sdk.track('shot', { hole: ev.hole, strokes: ev.strokes, power: +ev.power.toFixed(2) });
    if (firstInputSec == null) firstInputSec = (performance.now() - gameplayStart) / 1000;
    if (ui.tutorial.active && ui.tutorial.step === 1) ui.tutorial.next();
  } else if (ev.type === 'hole') {
    if (firstSuccessSec == null) firstSuccessSec = (performance.now() - gameplayStart) / 1000;
    ui.toast(`${t('hole')} ${ev.hole}: ${resultText(ev.result)}`, ev.result);
    audio.event(ev.result);
    Sdk.track('hole', { hole: ev.hole, strokes: ev.strokes, result: ev.result });
    if (ui.tutorial.active && ui.tutorial.step === 2) ui.tutorial.next();
  } else if (ev.type === 'penalty') {
    ui.toast(t('waterPenalty'), 'bad');
  } else if (ev.type === 'busted') {
    ui.toast(t('busted'), 'bad');
  } else if (ev.type === 'near_miss') {
    ui.toast(t('nearMiss'), 'good');
  } else if (ev.type === 'level_clear') {
    renderer.faceBallFromHole(run);
  } else if (ev.type === 'finished') {
    run.lastRating = ev.rating;
  }
}

// ---------------------------------------------------------------- 输入（拖拽瞄准 / 滚轮缩放 / 右键旋转 / 触屏）
const pointers = new Map();
let aiming = false;
let aimStart = null;
let orbiting = false;
let lastOrbit = null;
let lastPinch = null;

function camBasis() {
  // 与 renderer 相机一致的右/前（水平面）
  const yaw = renderer.yaw;
  return { right: [Math.cos(yaw), -Math.sin(yaw)], forward: [-Math.sin(yaw), Math.cos(yaw)] };
}

function pinchDist() {
  const pts = [...pointers.values()];
  return pts.length >= 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0;
}

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  try { canvas.setPointerCapture(e.pointerId); } catch { /* noop */ }
  if (pointers.size === 2) {
    aiming = false;
    orbiting = true;
    lastPinch = pinchDist();
    lastOrbit = null;
    return;
  }
  if (e.button === 2) {
    orbiting = true;
    lastOrbit = { x: e.clientX, y: e.clientY };
    return;
  }
  if (state === 'playing' && run.phase === 'aim') {
    aiming = true;
    aimStart = { x: e.clientX, y: e.clientY };
    run.aim.active = true;
    run.aim.dirX = 1; run.aim.dirZ = 0; run.aim.power = 0;
    if (ui.tutorial.active && ui.tutorial.step === 0) ui.tutorial.next();
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size >= 2) {
    const d = pinchDist();
    if (lastPinch != null) {
      renderer.setZoom(lastPinch / d);
      const p = [...pointers.values()];
      const cx = (p[0].x + p[1].x) / 2, cy = (p[0].y + p[1].y) / 2;
      if (lastOrbit) renderer.setOrbit((cx - lastOrbit.x) * 0.006);
      lastOrbit = { x: cx, y: cy };
    }
    lastPinch = d;
    return;
  }
  if (orbiting) {
    if (lastOrbit) { renderer.setOrbit((e.clientX - lastOrbit.x) * 0.006); }
    lastOrbit = { x: e.clientX, y: e.clientY };
    return;
  }
  if (aiming && aimStart) {
    const dx = e.clientX - aimStart.x;
    const dy = e.clientY - aimStart.y;
    const { right, forward } = camBasis();
    const wx = right[0] * dx + forward[0] * dy;
    const wz = right[1] * dx + forward[1] * dy;
    let ax = -wx, az = -wz;
    const len = Math.hypot(ax, az);
    run.aim.power = clamp(len / POWER_DRAG_LEN, 0, 1);
    if (len > 0.001) { ax /= len; az /= len; }
    run.aim.dirX = ax; run.aim.dirZ = az;
  }
});

function endPointer(e) {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) lastPinch = null;
  if (aiming) {
    aiming = false;
    if (run.aim.active && run.aim.power > 0.05) {
      shoot(run, { dirX: run.aim.dirX, dirZ: run.aim.dirZ, power: run.aim.power });
    }
    run.aim.active = false;
    run.aim.power = 0;
  }
  if (orbiting && pointers.size === 0) { orbiting = false; lastOrbit = null; }
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  renderer.setZoom(e.deltaY > 0 ? 1.12 : 0.89);
}, { passive: false });

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

window.addEventListener('keydown', (e) => {
  audio.unlock();
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (state === 'playing') pauseGame();
    else if (state === 'paused') resumeGame();
    e.preventDefault();
    return;
  }
  if (state !== 'playing') return;
  if (e.code === 'KeyR' && run.phase === 'aim') {
    resetShot(run);
    e.preventDefault();
  }
});

window.addEventListener('blur', () => { if (state === 'playing') pauseGame(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'playing') pauseGame(); });
window.addEventListener('pagehide', () => Sdk.track('session_end', { best: save.get('best', 0) }));

// ---------------------------------------------------------------- UI 接线
$('btn-start').addEventListener('click', () => { audio.unlock(); startGame(); });
$('btn-resume').addEventListener('click', () => { audio.ui(); resumeGame(); });
$('btn-restart-pause').addEventListener('click', () => { audio.ui(); Sdk.track('restart'); startGame(); });
$('btn-menu-pause').addEventListener('click', () => { audio.ui(); toMenu(); });
$('btn-restart').addEventListener('click', () => { audio.ui(); Sdk.track('restart'); startGame(); });
$('btn-menu').addEventListener('click', () => { audio.ui(); toMenu(); });
$('btn-howto').addEventListener('click', () => { audio.ui(); ui.tutorial.start(); });
$('btn-share').addEventListener('click', () => {
  Sdk.share({ title: 'MEGA GOLF 3D', text: t('shareText', { score: run.totalStrokes }) });
});
$('btn-mute').addEventListener('click', () => {
  const m = !save.get('muted', false);
  save.set('muted', m);
  audio.setMuted(m);
  ui.updateMute();
});
for (const sel of [$('lang-select'), $('lang-select-pause')]) {
  sel.addEventListener('change', (e) => ui.setLang(e.target.value));
}
$('btn-rotate-skip').addEventListener('click', () => { save.set('rotateDismissed', true); ui.updateRotate(); });

function resize() { renderer.resize(); ui.updateRotate(); }
window.addEventListener('resize', resize);

// ---------------------------------------------------------------- 主循环
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;

  if (state === 'playing') {
    accumulator += dt;
    let guard = 0;
    while (accumulator >= STEP && guard++ < 60) {
      step(run, STEP);
      run.hud = getHud(run);
      for (const ev of drainEvents(run)) dispatch(ev);
      accumulator -= STEP;
      if (run.phase === 'finished') { endRun(); break; }
    }
    ui.updateHUD(run.hud || getHud(run));
  }

  renderer.render(state === 'title' ? null : run, dt);
}

// ---------------------------------------------------------------- 启动
audio.setMuted(save.get('muted', false));
Sdk.ready().then(() => Sdk.track('load', { appId: 'pipy-mega-golf-3d' }));
ui.applyLang();
ui.showTitle(save.get('best', 0));
resize();
lastTime = performance.now();
requestAnimationFrame(loop);

// ---------------------------------------------------------------- 标准调试口
window.G = { startGame, pauseGame, resumeGame, UI: ui, Render: renderer, Audio: audio, Save: save };
window.__ll = {
  get state() { return { phase: state, simPhase: run.phase, lang: ui.lang, dir: ui.dir }; },
  get run() { return run; },
  get hud() { return getHud(run); },
  start: startGame,
  pause: pauseGame,
  resume: resumeGame,
  restart: toMenu,
  startAct: startGame,
  get tutorial() {
    const tt = ui.tutorial;
    return { active: tt.active, step: tt.step, steps: tt.steps, current: tt.current, skip: () => tt.skip() };
  },
  startTutorial: () => ui.tutorial.start(),
  save: (k, v) => Sdk.save(k, v),
  load: (k) => Sdk.load(k),
  ui: () => ui,
  lang: () => ui.lang,
  setLang: (l) => ui.setLang(l),
  // 调试/机器人钩子：一键解算并击球
  autoPutt: () => { if (state === 'playing' && run.phase === 'aim') shoot(run, solveAim(run)); return run.phase; },
  debug: {
    finish: () => { run.phase = 'finished'; run.lastRating = 'B'; return true; },
  },
  telemetry() {
    return {
      durationSec: run.time,
      firstInputSec: firstInputSec == null ? null : +firstInputSec.toFixed(2),
      firstSuccessSec: firstSuccessSec == null ? null : +firstSuccessSec.toFixed(2),
      deaths: run.busts + run.penalties,
      actions: run.holeStrokes,
      levelsReached: run.holeIndex + 1,
      completed: run.phase === 'finished',
    };
  },
};
