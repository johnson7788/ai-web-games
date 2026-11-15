// src/main.js — 装配：60Hz 固定步长 + 状态机 + 事件分发 + SDK 漏斗 + 标准调试口。
import { STEP, CONFIG } from '../config/game.config.js';
import { createSim, updateSim, getHud, drainEvents } from './game/sim.js';
import { createRenderer } from './render/index.js';
import { ui } from './ui/ui.js';
import { save } from './core/save.js';
import { Sdk } from './core/sdk.js';
import { createAudio } from './core/audio.js';
import { t } from './core/i18n.js';

const canvas = document.getElementById('canvas');
const stage = document.getElementById('stage');
const renderer = createRenderer(canvas);
const audio = createAudio();
const $ = (id) => document.getElementById(id);
const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

let state = 'title'; // title | playing | paused | results
let run = createSim({ seed: 1 });
run.hud = getHud(run);
let lastTime = 0, accumulator = 0, ended = false;

// ---------------- 输入 ----------------
const input = { pitch: 0, yaw: 0, boost: false, brake: false };
const keys = new Set();

window.addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  keys.add(e.code);
  if (e.code === 'Escape') {
    if (state === 'playing') pauseGame();
    else if (state === 'paused') resumeGame();
  }
  if (e.code === 'KeyC' && state === 'playing') renderer.switchCamera();
  if (e.code === 'KeyR' && (state === 'playing' || state === 'results')) { startRun(); }
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => { keys.clear(); if (state === 'playing') pauseGame(); });

function readInput() {
  if (window.__AUTO) {
    const a = window.__AUTO;
    input.pitch = a.pitch || 0; input.yaw = a.yaw || 0;
    input.boost = !!a.boost; input.brake = !!a.brake;
    return;
  }
  input.pitch = 0; input.yaw = 0;
  if (keys.has('KeyW') || keys.has('ArrowDown')) input.pitch -= 1; // 俯冲
  if (keys.has('KeyS') || keys.has('ArrowUp')) input.pitch += 1;   // 爬升
  if (keys.has('KeyA') || keys.has('ArrowLeft')) input.yaw -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) input.yaw += 1;
  if (ui.touch.pitch) input.pitch = ui.touch.pitch;
  if (ui.touch.yaw) input.yaw = ui.touch.yaw;
  input.boost = keys.has('ShiftLeft') || keys.has('ShiftRight') || ui.touch.boost;
  input.brake = keys.has('Space') || ui.touch.brake;
}

// ---------------- 流程 ----------------
function startRun() {
  run = createSim({ seed: (Math.random() * 1e9) | 0, trackIndex: ui.getTrack() });
  run.hud = getHud(run);
  ended = false;
  state = 'playing';
  ui.showGame();
  audio.ensure(); audio.resume();
  Sdk.newRun({ track: ui.getTrack() });
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
  const time = run.player.finishTime ?? run.time;
  const best = save.get('best', 0);
  const isRecord = !best || time < best;
  if (isRecord) save.set('best', time);
  Sdk.levelCleared({ rank: run.rank, rating: run.rating });
  audio.stopAll();
  ui.showResults(run, { time, rank: run.rank, rating: run.rating, best: isRecord ? time : best, isRecord });
}

// ---------------- 事件分发 ----------------
function onInputTutorial() {
  const t = ui.tutorial;
  if (!t.active) return;
  if (t.step === 0 && input.pitch !== 0) t.next();
  else if (t.step === 1 && input.yaw !== 0) t.next();
}

function dispatch(ev) {
  audio.event(ev.type);
  ui.popup(ev);
  renderer.onEvent(ev);
  if (ev.type === 'ringPass') Sdk.track('ringPass', { n: ev.n });
  if (ev.type === 'crash') Sdk.track('crash', {});
  const t = ui.tutorial;
  if (t.active) {
    if (t.step === 2 && ev.type === 'boostStart') t.next();
    else if (t.step === 3 && ev.type === 'ringPass') t.next();
  }
}

// ---------------- 主循环 ----------------
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - lastTime) / 1000, 0.5);
  lastTime = now;

  if (state === 'playing') {
    accumulator += dt;
    let guard = 0;
    while (accumulator >= STEP && guard++ < 60) {
      readInput();
      updateSim(run, input);
      onInputTutorial();
      run.hud = getHud(run);
      for (const ev of drainEvents(run)) dispatch(ev);
      accumulator -= STEP;
      if (run.phase === 'finished') { if (!ended) endRun(); break; }
    }
    audio.setEngine(Math.min(1, run.player.speed / 70), run.player.boosting);
    ui.updateHUD(run.hud);
    ui.updateCountdown(run.hud);
  }
  renderer.render(state === 'title' ? null : run, dt);
}

// ---------------- UI 接线 ----------------
$('btn-start').addEventListener('click', () => { audio.ui(); startRun(); });
$('btn-resume').addEventListener('click', () => { audio.ui(); resumeGame(); });
$('btn-restart-pause').addEventListener('click', () => { audio.ui(); Sdk.track('restart'); startRun(); });
$('btn-menu-pause').addEventListener('click', () => { audio.ui(); toMenu(); });
$('btn-restart').addEventListener('click', () => { audio.ui(); Sdk.track('restart'); startRun(); });
$('btn-menu').addEventListener('click', () => { audio.ui(); toMenu(); });
$('btn-howto').addEventListener('click', () => { audio.ui(); ui.tutorial.start(); });
$('btn-share').addEventListener('click', () => { Sdk.share({ title: CONFIG.title, text: t('shareText', { rank: run.rank }) }); });
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
  renderer.resize(innerWidth, innerHeight);
  const s = Math.min(innerWidth / 1280, innerHeight / 720);
  stage.style.transform = `translate(-50%, -50%) scale(${s})`;
}
window.addEventListener('resize', () => { resize(); updateRotate(); });

document.addEventListener('visibilitychange', () => {
  if (document.hidden) { keys.clear(); if (state === 'playing') pauseGame(); }
});
window.addEventListener('pagehide', () => Sdk.track('session_end', { best: save.get('best', 0) }));

// ---------------- 启动 ----------------
audio.setMuted(save.get('muted', false));
Sdk.ready().then(() => Sdk.track('load', { appId: CONFIG.appId }));
ui.applyLang();
ui.showTitle();
resize();
updateRotate();
lastTime = performance.now();
requestAnimationFrame(loop);

// ---------------- 标准调试口 ----------------
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
