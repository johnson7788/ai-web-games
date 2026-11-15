// src/main.js — 装配：60Hz 固定步长 + 状态机 + 事件分发 + SDK 漏斗 + 标准调试口。
import { STEP, CONFIG } from '../config/game.config.js';
import { createSim, updateSim, getHud, drainEvents, ratingFor } from './game/sim.js';
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

let state = 'title'; // title | playing | paused | results
let run = createSim({ car: ui.getCar() });
run.hud = getHud(run);
let lastTime = 0, accumulator = 0, ended = false;

// ---------------------------------------------------------------- 输入
const input = { throttle: 0, steer: 0, flip: 0, yaw: 0, nitro: false };
const keys = new Set();
let touchThrottle = 0, touchSteer = 0, touchFlip = 0, touchNitro = false;

window.addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
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
    input.throttle = a.throttle || 0; input.steer = a.steer || 0;
    input.flip = a.flip || 0; input.yaw = a.yaw || 0; input.nitro = !!a.nitro;
    return;
  }
  input.throttle = (keys.has('KeyW') || keys.has('ArrowUp')) ? 1 : ((keys.has('KeyS') || keys.has('ArrowDown')) ? -1 : 0);
  input.steer = (keys.has('KeyA') ? -1 : 0) + (keys.has('KeyD') ? 1 : 0);
  input.flip = (keys.has('ArrowLeft') ? -1 : 0) + (keys.has('ArrowRight') ? 1 : 0);
  input.yaw = (keys.has('KeyQ') ? -1 : 0) + (keys.has('KeyE') ? 1 : 0);
  input.nitro = keys.has('Space');
  if (touchThrottle !== 0) input.throttle = touchThrottle;
  input.steer += touchSteer;
  input.flip += touchFlip;
  input.nitro = input.nitro || touchNitro;
}

// ---------------------------------------------------------------- 触屏
function bindBtn(elm, set) {
  if (!elm) return;
  const on = (e) => { e.preventDefault(); elm.classList.add('active'); set(1); };
  const off = (e) => { e.preventDefault(); elm.classList.remove('active'); set(0); };
  elm.addEventListener('pointerdown', on);
  elm.addEventListener('pointerup', off);
  elm.addEventListener('pointercancel', off);
  elm.addEventListener('pointerleave', off);
}
if (isTouch) {
  $('touch').classList.remove('hidden');
  bindBtn($('btn-gas'), (v) => (touchThrottle = v));
  bindBtn($('btn-brake'), (v) => (touchThrottle = -v));
  bindBtn($('btn-steer-l'), (v) => (touchSteer = -v));
  bindBtn($('btn-steer-r'), (v) => (touchSteer = v));
  bindBtn($('btn-flip-l'), (v) => (touchFlip = -v));
  bindBtn($('btn-flip-r'), (v) => (touchFlip = v));
  bindBtn($('btn-nitro'), (v) => (touchNitro = !!v));
}

// ---------------------------------------------------------------- 流程
function startRun() {
  run = createSim({ car: ui.getCar() });
  run.hud = getHud(run);
  ended = false;
  state = 'playing';
  ui.showGame();
  audio.unlock(); audio.resume();
  Sdk.newRun({ car: ui.getCar() });
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
  const score = Math.round(run.score);
  const best = save.get('best', 0);
  const isRecord = score > best && score > 0;
  save.set('best', Math.max(best, score));
  save.set('coins', (save.get('coins', 0) || 0) + run.currency);
  if (run.stats.topCombo > (save.get('bestCombo', 0) || 0)) save.set('bestCombo', run.stats.topCombo);
  if (run.stats.farthestFlip > (save.get('farthestFlip', 0) || 0)) save.set('farthestFlip', run.stats.farthestFlip);
  const rating = ratingFor(score);
  Sdk.levelCleared({ score, rating });
  audio.stopAll();
  ui.showResults(run, { score, best: Math.max(best, score), isRecord, rating });
}

// ---------------------------------------------------------------- 事件分发
function dispatch(ev) {
  audio.play(ev.type);
  ui.popup(ev);
  renderer.onEvent(ev);
  if (ev.type === 'perfect' || ev.type === 'coin' || ev.type === 'wreck' || ev.type === 'nitro') Sdk.track(ev.type, { score: Math.round(run.score) });
  const tut = ui.tutorial;
  if (tut.active) {
    if (tut.step === 0 && ev.type === 'launch') tut.next();
    else if (tut.step === 1 && (ev.type === 'flip' || ev.type === 'perfect' || ev.type === 'badLand')) tut.next();
    else if (tut.step === 2 && (ev.type === 'coin' || ev.type === 'nitro')) tut.next();
    else if (tut.step === 3 && (ev.type === 'zone' || ev.type === 'perfect')) tut.next();
  }
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
      readInput();
      updateSim(run, input);
      run.hud = getHud(run);
      for (const ev of drainEvents(run)) dispatch(ev);
      accumulator -= STEP;
      if (run.phase === 'finished') { if (!ended) endRun(); break; }
    }
    audio.setEngine(Math.min(1, run.player.vz / 34), run.boostT > 0);
    ui.updateHUD(run);
  }
  renderer.render(state === 'title' ? null : run, dt);
}

// ---------------------------------------------------------------- UI 接线
$('btn-start').addEventListener('click', () => { audio.ui(); startRun(); });
$('btn-resume').addEventListener('click', () => { audio.ui(); resumeGame(); });
$('btn-restart-pause').addEventListener('click', () => { audio.ui(); Sdk.track('restart'); startRun(); });
$('btn-menu-pause').addEventListener('click', () => { audio.ui(); toMenu(); });
$('btn-restart').addEventListener('click', () => { audio.ui(); Sdk.track('restart'); startRun(); });
$('btn-menu').addEventListener('click', () => { audio.ui(); toMenu(); });
$('btn-howto').addEventListener('click', () => { audio.ui(); ui.tutorial.start(); });
$('btn-share').addEventListener('click', () => {
  Sdk.share({ title: CONFIG.title, text: `I scored ${Math.round(run.score)} in CITY STUNT DRIVE!` });
});
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
  const ww = innerWidth, wh = innerHeight;
  let w = ww, h = ww * 9 / 16;
  if (h > wh) { h = wh; w = wh * 16 / 9; }
  renderer.resize(Math.round(w), Math.round(h));
  const s = Math.min(ww / 1280, wh / 720);
  $('stage').style.transform = `translate(-50%, -50%) scale(${s})`;
}
window.addEventListener('resize', () => { resize(); updateRotate(); });

document.addEventListener('visibilitychange', () => { if (document.hidden) { keys.clear(); if (state === 'playing') pauseGame(); } });
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
