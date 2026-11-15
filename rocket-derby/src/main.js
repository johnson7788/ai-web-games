// src/main.js — 装配：60Hz 固定步长 + 状态机 + 事件分发 + SDK 漏斗 + 标准调试口。
import { STEP, CONFIG, MATCH } from '../config/game.config.js';
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
let level = 1;
let totalWins = 0;
let champion = false;
let run = createSim({ seed: (Math.random() * 1e9) | 0, level });
run.hud = getHud(run);
let lastTime = 0, accumulator = 0, ended = false;

// ---------------------------------------------------------------- 输入
const keys = new Set();
let jumpQueued = false;
let touchSteer = 0, touchThrottle = 0, touchBoost = false;

window.addEventListener('keydown', (e) => {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) e.preventDefault();
  if (e.code === 'Space' && !e.repeat) jumpQueued = true;
  keys.add(e.code);
  audio.unlock();
  if (e.code === 'Escape') {
    if (state === 'playing') pauseGame();
    else if (state === 'paused') resumeGame();
  }
  if (e.code === 'KeyR') {
    if (state === 'playing') startRun(level);
    else if (state === 'results') primaryAction();
  }
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => { keys.clear(); if (state === 'playing') pauseGame(); });

function readInput() {
  if (window.__AUTO) {
    const a = window.__AUTO;
    return { throttle: a.throttle || 0, steer: a.steer || 0, boost: !!a.boost, jump: !!a.jump };
  }
  let throttle = 0, steer = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) throttle = 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) throttle = -1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) steer -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) steer += 1;
  if (touchSteer) steer = touchSteer;
  if (touchThrottle && throttle === 0) throttle = touchThrottle;
  const boost = keys.has('ShiftLeft') || keys.has('ShiftRight') || touchBoost;
  const jump = jumpQueued;
  jumpQueued = false;
  return { throttle, steer, boost, jump };
}

if (isTouch) {
  document.querySelectorAll('#touch .steer').forEach((elm) => {
    const dir = +elm.dataset.steer;
    const on = (e) => { e.preventDefault(); audio.unlock(); touchSteer = dir; elm.classList.add('active'); };
    const off = (e) => { e.preventDefault(); if (touchSteer === dir) touchSteer = 0; elm.classList.remove('active'); };
    elm.addEventListener('pointerdown', on);
    elm.addEventListener('pointerup', off);
    elm.addEventListener('pointercancel', off);
    elm.addEventListener('pointerleave', off);
  });
  const bind = (elm, set) => {
    elm.addEventListener('pointerdown', (e) => { e.preventDefault(); audio.unlock(); elm.classList.add('active'); set(true); });
    const up = (e) => { e.preventDefault(); elm.classList.remove('active'); set(false); };
    elm.addEventListener('pointerup', up);
    elm.addEventListener('pointercancel', up);
    elm.addEventListener('pointerleave', up);
  };
  bind($('btn-boost'), (v) => (touchBoost = v));
  bind($('btn-throttle'), (v) => (touchThrottle = v ? 1 : 0));
  $('btn-jump').addEventListener('pointerdown', (e) => { e.preventDefault(); audio.unlock(); jumpQueued = true; });
}

// ---------------------------------------------------------------- 流程
function startRun(lv) {
  level = lv;
  run = createSim({ seed: (Math.random() * 1e9) | 0, level });
  run.hud = getHud(run);
  ended = false;
  state = 'playing';
  ui.showGame();
  audio.unlock();
  Sdk.newRun({ level });
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
  audio.unlock();
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
  const playedLevel = level;
  const win = run.result === 'win';
  champion = win && level === MATCH.MAX_LEVELS;
  if (win) {
    totalWins++;
    if (level < MATCH.MAX_LEVELS) level++;
    save.set('wins', totalWins);
    const prevBest = save.get('bestGoal', 0);
    if (run.bestGoalSpeed > prevBest) save.set('bestGoal', run.bestGoalSpeed);
    Sdk.levelCleared({ level: playedLevel, score: Math.round(run.score), rating: ratingFor(run.score) });
  } else {
    Sdk.gameOver({ level: playedLevel });
  }
  audio.stopAll();
  audio.play(win ? 'win' : 'fail');
  ui.showResults({
    result: run.result, champion, level: playedLevel,
    rating: ratingFor(run.score), score: run.score,
    scoreP: run.scoreP, scoreO: run.scoreO, bestGoalSpeed: run.bestGoalSpeed,
  });
}

function primaryAction() {
  audio.unlock(); audio.play('ui_click');
  if (champion) { champion = false; level = 1; toMenu(); }
  else startRun(level);
}

// ---------------------------------------------------------------- 事件分发
function dispatch(ev) {
  audio.play(ev.type);
  ui.popup(ev);
  renderer.onEvent(ev);
  if (ev.type === 'goal') Sdk.track('goal', { speed: ev.speed });
  if (ev.type === 'demo') Sdk.track('demo', {});
  // 教学：真实动作推进
  const tut = ui.tutorial;
  if (tut.active) {
    if (tut.step === 0 && (ev.type === 'hit' || ev.type === 'boostStart' || ev.type === 'pickup')) tut.next();
    else if (tut.step === 1 && ev.type === 'boostStart') tut.next();
    else if (tut.step === 2 && ev.type === 'goal') tut.next();
    else if (tut.step === 3 && (ev.type === 'aerial' || ev.type === 'demo' || ev.type === 'goal')) tut.next();
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
      updateSim(run, input);
      run.hud = getHud(run);
      for (const ev of drainEvents(run)) dispatch(ev);
      accumulator -= STEP;
      if (run.phase === 'end' && !ended) { endRun(); break; }
    }
    ui.updateHUD(run.hud);
  }
  renderer.render(state === 'title' ? null : run, dt);
}

// ---------------------------------------------------------------- UI 接线
$('btn-start').addEventListener('click', () => { audio.unlock(); audio.play('ui_click'); champion = false; level = 1; startRun(1); });
$('btn-howto').addEventListener('click', () => { audio.unlock(); audio.play('ui_click'); ui.tutorial.start(); });
$('btn-resume').addEventListener('click', () => { audio.play('ui_click'); resumeGame(); });
$('btn-restart-pause').addEventListener('click', () => { audio.play('ui_click'); Sdk.track('restart'); startRun(level); });
$('btn-menu-pause').addEventListener('click', () => { audio.play('ui_click'); toMenu(); });
$('btn-res-primary').addEventListener('click', primaryAction);
$('btn-menu-res').addEventListener('click', () => { audio.play('ui_click'); champion = false; level = 1; toMenu(); });
$('btn-share').addEventListener('click', () => {
  Sdk.share({ title: CONFIG.title, text: `I scored ${run.scoreP} goals in ROCKET DERBY!` });
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
  renderer.resize(innerWidth, innerHeight);
  const s = Math.min(innerWidth / 1280, innerHeight / 720);
  $('stage').style.transform = `translate(-50%, -50%) scale(${s})`;
}
window.addEventListener('resize', () => { resize(); updateRotate(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { keys.clear(); if (state === 'playing') pauseGame(); }
});
window.addEventListener('pagehide', () => Sdk.track('session_end', { best: save.get('bestGoal', 0) }));

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
  start: () => startRun(level),
  pause: pauseGame,
  resume: resumeGame,
  restart: toMenu,
  startAct: (n) => startRun(n ?? level),
  get tutorial() {
    const t = ui.tutorial;
    return { active: t.active, step: t.step, steps: t.steps, current: t.current, skip: () => t.skip() };
  },
  save: () => save,
  ui: () => ui,
  lang: () => ui.lang,
  setLang: (l) => ui.setLang(l),
  setInput: (obj) => { window.__AUTO = obj; },
  telemetry: () => ({
    durationSec: run.time, scoreP: run.scoreP, scoreO: run.scoreO,
    level, bestGoalSpeed: run.bestGoalSpeed, phase: run.phase,
  }),
};
