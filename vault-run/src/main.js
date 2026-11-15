// src/main.js — 装配：60Hz 固定步长 + 状态机 + 事件分发 + SDK 漏斗 + 标准调试口。
import { STEP, CONFIG } from '../config/game.config.js';
import { createSim, updateSim, getHud, drainEvents, ratingFor } from './game/sim.js';
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

let state = 'title'; // title | playing | paused | results
let run = createSim({ seed: (Math.random() * 1e9) | 0 });
run.hud = getHud(run);
let lastTime = 0, accumulator = 0, ended = false, firstInputTracked = false;

// ---------------------------------------------------------------- 输入
const keys = new Set();
let actionQueued = false, touchSteer = 0, touchSprint = false, prevSprint = false;

function onFirstInput() {
  audio.unlock();
  if (!firstInputTracked) { firstInputTracked = true; Sdk.track('first_input', { ms: Math.round(performance.now()) }); }
}

window.addEventListener('keydown', (e) => {
  if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Tab'].includes(e.code)) e.preventDefault();
  if (e.code === 'Space' && !e.repeat) actionQueued = true;
  keys.add(e.code);
  onFirstInput();
  if (e.code === 'Escape') {
    if (state === 'playing') pauseGame();
    else if (state === 'paused') resumeGame();
  }
  if (e.code === 'KeyR' && state === 'results') startRun();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => { keys.clear(); if (state === 'playing') pauseGame(); });

function readInput() {
  let steer = 0, sprint = false, action = false;
  if (window.__AUTO) {
    const a = window.__AUTO;
    steer = a.steer || 0; sprint = !!a.sprint;
    action = !!a.action; a.action = false;
    if (action || steer || sprint) onFirstInput();
    if (sprint && !prevSprint) ui.tutorial.advance('sprint');
    prevSprint = sprint;
    return { steer, sprint, action };
  }
  steer = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
  if (touchSteer) steer = touchSteer;
  sprint = keys.has('ShiftLeft') || keys.has('ShiftRight') || touchSprint;
  action = actionQueued; actionQueued = false;
  if (action || steer || sprint) onFirstInput();
  if (sprint && !prevSprint) ui.tutorial.advance('sprint');
  prevSprint = sprint;
  return { steer, sprint, action };
}

if (isTouch) {
  $('touch').classList.remove('hidden');
  const swipe = $('touch-swipe');
  let sx = null, active = false;
  swipe.addEventListener('pointerdown', (e) => { sx = e.clientX; active = true; onFirstInput(); });
  swipe.addEventListener('pointermove', (e) => { if (active && sx != null) { touchSteer = Math.max(-1, Math.min(1, (e.clientX - sx) / 60)); } });
  const endSwipe = () => { active = false; sx = null; touchSteer = 0; };
  swipe.addEventListener('pointerup', endSwipe); swipe.addEventListener('pointercancel', endSwipe);
  const bind = (elm, set) => {
    elm.addEventListener('pointerdown', (e) => { e.preventDefault(); onFirstInput(); elm.classList.add('active'); set(true); });
    const up = (e) => { e.preventDefault(); elm.classList.remove('active'); set(false); };
    elm.addEventListener('pointerup', up); elm.addEventListener('pointercancel', up); elm.addEventListener('pointerleave', up);
  };
  bind($('btn-action'), (v) => { if (v) actionQueued = true; });
  bind($('btn-sprint'), (v) => { touchSprint = v; });
}

// ---------------------------------------------------------------- 流程
function startRun() {
  run = createSim({ seed: (Math.random() * 1e9) | 0 });
  run.hud = getHud(run);
  ended = false;
  state = 'playing';
  ui.showGame();
  audio.unlock(); audio.resume();
  Sdk.newRun({});
  if (!save.get('tutDone', false)) ui.tutorial.start();
  lastTime = performance.now();
  accumulator = 0;
}

function pauseGame() { if (state !== 'playing') return; state = 'paused'; ui.showPause(); audio.stopAll(); }
function resumeGame() { if (state !== 'paused') return; state = 'playing'; ui.hidePause(); audio.resume(); lastTime = performance.now(); }
function toMenu() { state = 'title'; ui.showTitle(); audio.stopAll(); }

function endRun() {
  ended = true;
  state = 'results';
  const score = Math.round(run.score);
  const best = Math.max(save.get('best', 0), score);
  const isRecord = score > save.get('best', 0) && score > 0;
  save.set('best', best);
  const rating = ratingFor(score);
  if (run.win) Sdk.levelCleared({ score, rating });
  else Sdk.gameOver({ score, rating });
  audio.stopAll();
  ui.showResults(run, { score, best, isRecord, rating });
  if (run.win) audio.play('win'); else audio.play('fail');
}

// ---------------------------------------------------------------- 事件分发
function dispatch(ev) {
  audio.event(ev.type, ev);
  ui.popup(ev);
  renderer.onEvent(ev);
  if (ev.type === 'vault' || ev.type === 'slide' || ev.type === 'wallrun' || ev.type === 'fall') Sdk.track(ev.type, {});
  const t = ui.tutorial;
  if (t.active) t.advance(ev.type);
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
      const input = readInput();
      updateSim(run, input);
      run.hud = getHud(run);
      for (const ev of drainEvents(run)) dispatch(ev);
      accumulator -= STEP;
      if (run.phase !== 'running') { if (!ended) endRun(); break; }
    }
    ui.updateHUD(run);
  }
  renderer.render(state === 'title' ? null : run, dt);
}

// ---------------------------------------------------------------- UI 接线
$('btn-start').addEventListener('click', () => { audio.play('ui_click'); startRun(); });
$('btn-resume').addEventListener('click', () => { audio.play('ui_click'); resumeGame(); });
$('btn-restart-pause').addEventListener('click', () => { audio.play('ui_click'); Sdk.track('restart'); startRun(); });
$('btn-menu-pause').addEventListener('click', () => { audio.play('ui_back'); toMenu(); });
$('btn-restart').addEventListener('click', () => { audio.play('ui_click'); Sdk.track('restart'); startRun(); });
$('btn-menu').addEventListener('click', () => { audio.play('ui_back'); toMenu(); });
$('btn-howto').addEventListener('click', () => { audio.play('ui_click'); ui.tutorial.start(); });
$('btn-share').addEventListener('click', () => {
  Sdk.share({ title: CONFIG.title, text: t('shareText', { m: Math.floor(run.player.z) }) });
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
  $('rotate').classList.toggle('hidden', !(isTouch && portrait && !save.get('rotateDismissed', false)));
}
$('btn-rotate-skip').addEventListener('click', () => { save.set('rotateDismissed', true); updateRotate(); });

function resize() {
  const s = Math.min(innerWidth / 1280, innerHeight / 720);
  $('view').style.transform = `translate(-50%, -50%) scale(${s})`;
}
window.addEventListener('resize', () => { resize(); updateRotate(); });

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
  telemetry: () => ({
    durationSec: +run.time.toFixed(2),
    firstInputSec: firstInputTracked ? 0 : null,
    firstSuccessSec: null,
    deaths: run.stats.falls,
    levelsReached: run.section,
    completed: run.phase === 'finished',
    score: Math.round(run.score),
  }),
};
