// src/main.js — 装配：60Hz 固定步长 + 状态机 + 事件分发 + SDK 漏斗 + 标准调试口。
// 状态机：title → playing → levelclear → (playing…) / results；pause 可在 playing 时暂停。
import { STEP, CONFIG } from '../config/game.config.js';
import { createSim, updateSim, advanceLevel, getHud, drainEvents } from './game/sim.js';
import { createRenderer } from './render/index.js';
import { ui } from './ui/ui.js';
import { save } from './core/save.js';
import { Sdk } from './core/sdk.js';
import { createAudio } from './core/audio.js';

const canvas = document.getElementById('canvas');
const renderer = createRenderer(canvas);
const audio = createAudio();
const $ = (id) => document.getElementById(id);
const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

let state = 'title'; // title | playing | levelclear | paused | results
let run = createSim({ seed: (Math.random() * 1e9) | 0 });
run.hud = getHud(run);
let lastTime = 0;
let accumulator = 0;
let lastClear = null;

// ---------------------------------------------------------------- 输入
const keys = new Set();
let jumpQueued = false;
let respawnQueued = false;
let touchMove = { x: 0, y: 0 };
let touchJump = false;
let touchBrake = false;

window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (e.code === 'Space' && !e.repeat) jumpQueued = true;
  if (e.code === 'KeyR' && !e.repeat) respawnQueued = true;
  keys.add(e.code);
  if (e.code === 'Escape') {
    if (state === 'playing') pauseGame();
    else if (state === 'paused') resumeGame();
  }
  if (e.code === 'KeyR' && state === 'results') startRun();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => { keys.clear(); if (state === 'playing') pauseGame(); });

function readInput() {
  if (window.__AUTO) {
    const a = window.__AUTO;
    return { moveX: a.moveX || 0, moveZ: a.moveZ || 0, jump: !!a.jump, brake: !!a.brake, respawn: !!a.respawn };
  }
  let moveX = 0, moveZ = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) moveZ += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) moveZ -= 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) moveX -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) moveX += 1;
  const jump = jumpQueued; jumpQueued = false;
  const respawn = respawnQueued; respawnQueued = false;
  const brake = keys.has('ShiftLeft') || keys.has('ShiftRight') || touchBrake;
  if (touchMove.x !== 0 || touchMove.y !== 0) { moveX = touchMove.x; moveZ = -touchMove.y; }
  return { moveX, moveZ, jump, brake, respawn };
}

// 触屏：摇杆 + 跳/刹按钮
function setupTouch() {
  $('touch').classList.remove('hidden');
  const joy = $('joy'), knob = $('joy-knob');
  let joyId = null, cx = 0, cy = 0;
  const jr = 52;
  const onDown = (e) => { joyId = e.pointerId; const r = joy.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; joy.setPointerCapture(e.pointerId); };
  const onMove = (e) => {
    if (e.pointerId !== joyId) return;
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const len = Math.hypot(dx, dy);
    if (len > jr) { dx *= jr / len; dy *= jr / len; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    touchMove.x = dx / jr; touchMove.y = dy / jr;
  };
  const onUp = (e) => {
    if (e.pointerId !== joyId) return;
    joyId = null; knob.style.transform = 'translate(0,0)'; touchMove.x = 0; touchMove.y = 0;
  };
  joy.addEventListener('pointerdown', onDown);
  joy.addEventListener('pointermove', onMove);
  joy.addEventListener('pointerup', onUp);
  joy.addEventListener('pointercancel', onUp);
  const bind = (elm, set) => {
    const on = (e) => { e.preventDefault(); set(true); elm.classList.add('active'); };
    const off = (e) => { e.preventDefault(); set(false); elm.classList.remove('active'); };
    elm.addEventListener('pointerdown', on);
    elm.addEventListener('pointerup', off);
    elm.addEventListener('pointercancel', off);
    elm.addEventListener('pointerleave', off);
  };
  bind($('btn-jump'), (v) => { if (v) jumpQueued = true; touchJump = v; });
  bind($('btn-brake'), (v) => { touchBrake = v; });
}

// ---------------------------------------------------------------- 流程
function startRun(levelIndex = 0) {
  run = createSim({ seed: (Math.random() * 1e9) | 0, levelIndex });
  run.hud = getHud(run);
  lastClear = null;
  state = 'playing';
  ui.showGame();
  audio.unlock();
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

function nextLevel() {
  advanceLevel(run);
  run.hud = getHud(run);
  state = 'playing';
  ui.showGame();
  lastTime = performance.now();
  accumulator = 0;
}

function endRun() {
  state = 'results';
  const totalTime = Math.round(run.totalTime * 10) / 10;
  const best = save.get('best', 0);
  const isRecord = !best || totalTime < best;
  if (isRecord) save.set('best', totalTime);
  const rating = run.rating || 'C';
  Sdk.levelCleared({ rating, time: totalTime });
  audio.stopAll();
  ui.showResults({ rating, time: totalTime, bananas: run.totalBananas, deaths: run.deaths, isRecord });
}

// ---------------------------------------------------------------- 事件分发
function dispatch(ev) {
  if (!ev) return;
  audio.event(ev.type);
  renderer.onEvent(ev);
  ui.tutorial.onEvent(ev.type);
  if (ev.type === 'pickup') Sdk.track('pickup', { bananas: ev.bananas });
  else if (ev.type === 'fall') Sdk.track('fall', { deaths: ev.deaths });
  else if (ev.type === 'hammerHit') Sdk.track('hammerHit', {});
  else if (ev.type === 'levelCleared') Sdk.track('levelCleared', { level: ev.level });
}

// ---------------------------------------------------------------- 主循环
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - lastTime) / 1000, 0.5);
  lastTime = now;

  if (state === 'playing') {
    accumulator += dt;
    let guard = 0;
    while (accumulator >= STEP && guard++ < 60) {
      updateSim(run, readInput());
      run.hud = getHud(run);
      for (const ev of drainEvents(run)) {
        dispatch(ev);
        if (ev.type === 'levelCleared' && run.phase === 'levelclear') lastClear = ev;
      }
      accumulator -= STEP;
      if (run.phase === 'levelclear') { state = 'levelclear'; ui.showLevelClear(lastClear || { rating: 'C', time: run.time, bananas: run.bananas }); break; }
      if (run.phase === 'finished') { endRun(); break; }
    }
    ui.updateHudLive(run.hud);
  }
  renderer.render(state === 'title' ? null : run, dt);
}

// ---------------------------------------------------------------- UI 接线
$('btn-start').addEventListener('click', () => { audio.unlock(); audio.play('start'); startRun(); });
$('btn-howto').addEventListener('click', () => { audio.unlock(); audio.play('ui_click'); ui.tutorial.start('title'); });
$('btn-resume').addEventListener('click', () => { audio.play('ui_click'); resumeGame(); });
$('btn-restart-pause').addEventListener('click', () => { audio.play('ui_click'); Sdk.track('restart'); startRun(); });
$('btn-menu-pause').addEventListener('click', () => { audio.play('ui_back'); toMenu(); });
$('btn-next').addEventListener('click', () => { audio.play('ui_click'); nextLevel(); });
$('btn-restart').addEventListener('click', () => { audio.play('ui_click'); Sdk.track('restart'); startRun(); });
$('btn-menu').addEventListener('click', () => { audio.play('ui_back'); toMenu(); });
$('btn-share').addEventListener('click', () => { Sdk.share({ title: CONFIG.title, text: `I cleared ${run.levelIndex + 1} levels in MONKEY MARBLE!` }); });
$('btn-mute').addEventListener('click', () => {
  const m = !save.get('muted', false);
  save.set('muted', m);
  audio.setMuted(m);
  ui.applyLang();
});
$('tut-next').addEventListener('click', () => { audio.play('ui_click'); ui.tutorial.next(); });
$('tut-skip').addEventListener('click', () => { audio.play('ui_back'); ui.tutorial.skip(); });
for (const sel of ui.langSelects) {
  if (sel) sel.addEventListener('change', (e) => ui.setLang(e.target.value));
}

// ---------------------------------------------------------------- 启动
if (isTouch) setupTouch();
audio.setMuted(save.get('muted', false));
Sdk.ready().then(() => Sdk.track('load', { appId: CONFIG.title }));
ui.applyLang();
ui.showTitle();
lastTime = performance.now();
requestAnimationFrame(loop);

window.addEventListener('pagehide', () => Sdk.track('session_end', { best: save.get('best', 0) }));
document.addEventListener('visibilitychange', () => { if (document.hidden) { keys.clear(); if (state === 'playing') pauseGame(); } });

// ---------------------------------------------------------------- 标准调试口
window.G = { Game: { startRun, pauseGame, resumeGame }, UI: ui, Render: renderer, Audio: audio, Save: save };
window.__ll = {
  get state() { return { phase: state, simPhase: run.phase, lang: ui.lang, dir: ui.dir }; },
  get run() { return run; },
  get hud() { return run.hud; },
  start: () => startRun(),
  pause: pauseGame,
  resume: resumeGame,
  restart: toMenu,
  startAct: (n) => startRun(n ?? 0),
  startTutorial: () => { state = 'title'; ui.showTitle(); ui.tutorial.start('title'); },
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
