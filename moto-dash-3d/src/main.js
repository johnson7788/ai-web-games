// src/main.js — 装配：60Hz 固定步长 + 状态机 + 事件分发 + SDK 漏斗 + 标准调试口。
import { STEP, VIEW, CONFIG, clamp } from '../config/game.config.js';
import { createSim, updateSim, getHud, drainEvents, crashNow, ratingFor } from './game/sim.js';
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
let run = newRun();
let demo = newRun();
let lastTime = performance.now(), accumulator = 0, ended = false;

function newRun() {
  const r = createSim({ seed: (Math.random() * 1e9) | 0 });
  r.hud = getHud(r);
  r.step = (inp) => updateSim(r, inp);
  r.getHud = () => getHud(r);
  r.drainEvents = () => drainEvents(r);
  return r;
}

// ---------------------------------------------------------------- 输入
const input = { steer: 0, throttle: false, brake: false, nitro: false };
const keys = new Set();
let touchSteer = 0, touchThrottle = false, touchNitro = false;

window.addEventListener('keydown', (e) => {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
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
    input.steer = a.steer || 0; input.throttle = !!a.throttle;
    input.brake = !!a.brake; input.nitro = !!a.nitro;
    return;
  }
  input.steer = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0);
  if (touchSteer) input.steer = touchSteer;
  input.throttle = keys.has('KeyW') || keys.has('ArrowUp') || touchThrottle;
  input.brake = keys.has('KeyS') || keys.has('ArrowDown');
  input.nitro = keys.has('Space') || touchNitro;
  if (ui.tutorial.active && ui.tutorial.step === 0 && input.throttle) ui.tutorial.next();
}

// 触屏：左半屏滑动转向 + 右下油门 + 氮气按钮（≥44px，不遮 HUD）
if (isTouch) {
  const zone = $('steer-zone');
  let origin = null;
  zone.addEventListener('pointerdown', (e) => { origin = e.clientX; touchSteer = 0; zone.setPointerCapture?.(e.pointerId); });
  zone.addEventListener('pointermove', (e) => { if (origin == null) return; touchSteer = clamp((e.clientX - origin) / 50, -1, 1); });
  const endSteer = () => { origin = null; touchSteer = 0; };
  zone.addEventListener('pointerup', endSteer);
  zone.addEventListener('pointercancel', endSteer);
  const bind = (elm, set) => {
    elm.addEventListener('pointerdown', (e) => { e.preventDefault(); elm.classList.add('active'); set(true); });
    const up = (e) => { e.preventDefault(); elm.classList.remove('active'); set(false); };
    elm.addEventListener('pointerup', up);
    elm.addEventListener('pointercancel', up);
    elm.addEventListener('pointerleave', up);
  };
  bind($('btn-throttle'), (v) => { touchThrottle = v; });
  bind($('btn-nitro'), (v) => { touchNitro = v; });
}

// ---------------------------------------------------------------- 流程
function startRun() {
  run = newRun();
  ended = false;
  state = 'playing';
  ui.showGame();
  audio.unlock(); audio.play('start');
  Sdk.newRun({});
  if (!save.get('tutDone', false)) ui.tutorial.start(false);
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
  const dist = Math.floor(run.player.distance);
  const score = run.score;
  const best = Math.max(save.get('best', 0), dist);
  const isRecord = dist > save.get('best', 0) && dist > 0;
  save.set('best', best);
  save.set('bestCombo', Math.max(save.get('bestCombo', 0), run.topCombo));
  const rating = ratingFor(dist);
  Sdk.gameOver({ score, distance: dist, rating });
  if (isRecord) Sdk.track('win', { score, distance: dist, rating });
  audio.play('fail');
  audio.stopAll();
  ui.showResults(run, { score, best, isRecord, rating, distance: dist, nearMisses: run.nearMisses, topCombo: run.topCombo, time: run.time });
}

// ---------------------------------------------------------------- 事件分发
function dispatch(ev) {
  audio.play(ev.type);
  ui.popup(ev);
  renderer.onEvent(ev);
  if (ev.type === 'nearMiss') Sdk.track('nearMiss', { bonus: ev.bonus });
  else if (ev.type === 'combo') Sdk.track('combo', { n: ev.n });
  else if (ev.type === 'crash') Sdk.track('crash', { reason: ev.reason });
  const tut = ui.tutorial;
  if (tut.active) {
    if (tut.step === 1 && ev.type === 'lane') tut.next();
    else if (tut.step === 2 && ev.type === 'boost') tut.next();
    else if (tut.step === 3 && (ev.type === 'nearMiss' || ev.type === 'checkpoint')) tut.next();
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
    while (accumulator >= STEP && guard++ < 120) {
      readInput();
      updateSim(run, input);
      run.hud = getHud(run);
      for (const ev of drainEvents(run)) dispatch(ev);
      accumulator -= STEP;
      if (run.phase === 'over' && !ended) { endRun(); break; }
    }
    ui.updateHUD(run);
    renderer.render(run, dt, 'game');
  } else if (state === 'title') {
    updateSim(demo, {});
    if (demo.phase === 'over') demo = newRun();
    renderer.render(demo, dt, 'title');
  } else {
    renderer.render(run, dt, 'game');
  }
}

// ---------------------------------------------------------------- UI 接线
$('btn-start').addEventListener('click', () => { audio.play('ui_click'); startRun(); });
$('btn-howto').addEventListener('click', () => { audio.play('ui_click'); ui.tutorial.start(true); });
$('btn-resume').addEventListener('click', () => { audio.play('ui_click'); resumeGame(); });
$('btn-restart-pause').addEventListener('click', () => { audio.play('ui_click'); Sdk.track('restart'); startRun(); });
$('btn-menu-pause').addEventListener('click', () => { audio.play('ui_back'); toMenu(); });
$('btn-restart').addEventListener('click', () => { audio.play('ui_click'); Sdk.track('restart'); startRun(); });
$('btn-menu').addEventListener('click', () => { audio.play('ui_back'); toMenu(); });
$('btn-share').addEventListener('click', () => {
  Sdk.share({ title: CONFIG.title, text: `I weaved ${Math.floor(run.player.distance)}m in MOTO DASH 3D!` });
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
$('tut-next').addEventListener('click', () => tutorialNext());
$('tut-skip').addEventListener('click', () => ui.tutorial.skip());
function tutorialNext() { audio.play('ui_click'); ui.tutorial.next(); }

function updateRotate() {
  const portrait = innerHeight > innerWidth;
  const show = isTouch && portrait && !save.get('rotateDismissed', false);
  $('rotate').classList.toggle('hidden', !show);
}
$('btn-rotate-skip').addEventListener('click', () => { save.set('rotateDismissed', true); updateRotate(); });

function layout() {
  const ww = innerWidth, wh = innerHeight;
  let w = ww, h = ww * 9 / 16;
  if (h > wh) { h = wh; w = wh * 16 / 9; }
  w = Math.round(w); h = Math.round(h);
  const s = w / VIEW.W;
  canvas.style.position = 'absolute';
  canvas.style.left = `${(ww - w) / 2}px`;
  canvas.style.top = `${(wh - h) / 2}px`;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const stage = $('stage');
  stage.style.left = '50%'; stage.style.top = '50%';
  stage.style.transform = `translate(-50%, -50%) scale(${s})`;
  renderer.resize(w, h);
}
window.addEventListener('resize', () => { layout(); updateRotate(); });

document.addEventListener('visibilitychange', () => {
  if (document.hidden) { keys.clear(); if (state === 'playing') pauseGame(); }
});
window.addEventListener('pagehide', () => Sdk.track('session_end', { best: save.get('best', 0) }));

// ---------------------------------------------------------------- 启动
audio.setMuted(save.get('muted', false));
Sdk.ready().then(() => Sdk.track('load', { appId: CONFIG.appId }));
ui.applyLang();
ui.showTitle();
layout();
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
  crash: () => crashNow(run),
  setInput: (obj) => { window.__AUTO = obj; },
  startTutorial: () => ui.tutorial.start(true),
  get tutorial() {
    const t = ui.tutorial;
    return { active: t.active, step: t.step, steps: t.steps, current: t.current, skip: () => t.skip() };
  },
  save: () => save,
  ui: () => ui,
  lang: () => ui.lang,
  setLang: (l) => ui.setLang(l),
  debug: { layout: () => ({ stage: $('stage').getBoundingClientRect(), viewport: [innerWidth, innerHeight] }) },
};
