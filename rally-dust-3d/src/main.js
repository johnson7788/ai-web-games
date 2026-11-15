// src/main.js — 装配：60Hz 固定步长 + 状态机 + 事件分发 + SDK 漏斗 + 标准调试口。
import { STEP, CONFIG, CAR } from '../config/game.config.js';
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
const isTouch = ui.isTouch;
const RANK = { S: 4, A: 3, B: 2, C: 1 };

let state = 'title'; // title | playing | paused | results
let run = createSim({ seed: 1 });
run.hud = getHud(run);
let lastTime = 0, accumulator = 0;

// ---------------------------------------------------------------- 输入
const input = { throttle: false, brake: false, steer: 0, handbrake: false, shiftDown: false };
const keys = new Set();
let touchSteer = 0, touchThrottle = false, touchBrake = false, touchHandbrake = false;
let firstInputDone = false;

window.addEventListener('keydown', (e) => {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
  keys.add(e.code);
  if (e.code === 'Escape') {
    if (state === 'playing') pauseGame();
    else if (state === 'paused') resumeGame();
  }
  if (e.code === 'KeyC' && state === 'playing') toggleCamera();
  if (e.code === 'KeyR' && (state === 'results' || state === 'playing')) startRun();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => { keys.clear(); if (state === 'playing') pauseGame(); });

let camMode = 'chase';
function toggleCamera() {
  camMode = camMode === 'chase' ? 'hood' : 'chase';
  renderer.setCamera(camMode);
  audio.ui();
}

function readInput() {
  if (window.__AUTO) {
    const a = window.__AUTO;
    input.throttle = !!a.throttle; input.brake = !!a.brake; input.handbrake = !!a.handbrake;
    input.shiftDown = !!a.shiftDown; input.steer = a.steer || 0;
  } else {
    input.throttle = keys.has('KeyW') || keys.has('ArrowUp') || touchThrottle;
    input.brake = keys.has('KeyS') || keys.has('ArrowDown') || touchBrake;
    input.handbrake = keys.has('Space') || touchHandbrake;
    input.shiftDown = keys.has('ShiftLeft') || keys.has('ShiftRight');
    input.steer = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) input.steer -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) input.steer += 1;
    if (touchSteer) input.steer = touchSteer;
  }
  if (!firstInputDone && (input.throttle || input.brake || input.steer || input.handbrake)) {
    firstInputDone = true;
    Sdk.track('first_input', { ms: Math.round(performance.now()) });
  }
}

// 触屏：左转向滑条，右油门/刹车/手刹（≥44px 不遮 HUD）
if (isTouch) {
  $('touch').classList.remove('hidden');
  const slider = $('steer-slider');
  const knob = $('steer-knob');
  const setSteer = (clientX) => {
    const r = slider.getBoundingClientRect();
    touchSteer = Math.max(-1, Math.min(1, ((clientX - r.left) / r.width) * 2 - 1));
    knob.style.left = `${((touchSteer + 1) / 2) * 100}%`;
  };
  slider.addEventListener('pointerdown', (e) => { slider.setPointerCapture(e.pointerId); setSteer(e.clientX); });
  slider.addEventListener('pointermove', (e) => { if (e.buttons) setSteer(e.clientX); });
  const reset = () => { touchSteer = 0; knob.style.left = '50%'; };
  slider.addEventListener('pointerup', reset);
  slider.addEventListener('pointercancel', reset);
  const bind = (elm, set) => {
    elm.addEventListener('pointerdown', (e) => { e.preventDefault(); elm.classList.add('active'); set(true); });
    const up = (e) => { e.preventDefault(); elm.classList.remove('active'); set(false); };
    elm.addEventListener('pointerup', up);
    elm.addEventListener('pointercancel', up);
    elm.addEventListener('pointerleave', up);
  };
  bind($('btn-throttle'), (v) => (touchThrottle = v));
  bind($('btn-brake'), (v) => (touchBrake = v));
  bind($('btn-handbrake'), (v) => (touchHandbrake = v));
}

// ---------------------------------------------------------------- 流程
function startRun() {
  run = createSim({ seed: (Math.random() * 1e9) | 0 });
  run.hud = getHud(run);
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

function endRun(ev) {
  state = 'results';
  const win = ev.type === 'finished';
  const score = Math.round(run.score);
  const rating = ev.rating || 'C';
  const bestScore = save.get('bestScore', 0);
  const bestRating = save.get('bestRating', '');
  const isRecord = score > bestScore && win;
  if (isRecord || RANK[rating] > RANK[bestRating] || !bestRating) {
    save.set('bestScore', Math.max(bestScore, score));
    if (win && RANK[rating] > RANK[bestRating]) save.set('bestRating', rating);
  }
  if (win) Sdk.levelCleared({ level: CONFIG.stages, score, rating, time: run.totalTime });
  else Sdk.gameOver({ score, rating });
  audio.stopAll();
  ui.showResults(run, { score, rating, best: save.get('bestScore', 0), isRecord });
}

// 路书副驾 TTS（无 voice / headless 时静默降级为图标+音效）
function speakPace(ev) {
  try {
    if (!('speechSynthesis' in window) || state !== 'playing') return;
    const dir = ev.dir === 'L' ? ui.t('paceLeft') : ui.t('paceRight');
    const into = ev.next ? ` ${ui.t('paceInto')} ${ev.next.dir === 'L' ? ui.t('paceLeft') : ui.t('paceRight')} ${ev.next.gear}` : '';
    const u = new SpeechSynthesisUtterance(`${dir} ${ev.gear}${into}`);
    u.lang = ui.lang === 'zh' ? 'zh-CN' : 'en-US';
    u.rate = 1.15; u.volume = 0.7;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch { /* TTS 不可用，静默 */ }
}

function dispatch(ev) {
  audio.event(ev.type);
  ui.popup(ev);
  renderer.onEvent(ev);
  if (ev.type === 'paceNote') { ui.flashPace(); speakPace(ev); }
  if (ev.type === 'stageClear') {
    ui.showStagecard(run.track.spec.name);
    const t = run.stageTimes[run.stageTimes.length - 1];
    const best = save.get('bestTimes', {});
    if (!best[ev.stage] || t < best[ev.stage]) { best[ev.stage] = Math.round(t * 10) / 10; save.set('bestTimes', best); }
  }
  if (ev.type === 'hit') Sdk.track('hit', { kind: ev.kind });
  if (ev.type === 'driftStart') Sdk.track('driftStart', {});
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
      if (run.phase === 'busted' || run.phase === 'finished') { endRun({ type: run.phase, rating: run.phase === 'busted' ? 'DNF' : ratingFor(run.score, false) }); break; }
    }
    audio.setEngine(Math.min(1, run.player.speed / CAR.maxSpeed));
    audio.setSkid(run.player.drifting, Math.min(1, Math.abs(run.player.angle) * 1.8));
    ui.updateHUD(run);
    ui.setChips({ throttle: input.throttle, steer: !!input.steer, drift: input.handbrake, camera: camMode === 'hood' });
    ui.tutorial.update(run);
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
  Sdk.share({ title: CONFIG.title, text: ui.t('shareText', { rating: save.get('bestRating', 'C') }) });
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
window.addEventListener('pagehide', () => Sdk.track('session_end', { best: save.get('bestScore', 0) }));

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
  // 调试/验收用：快进到结算（走 updateSim/completeStage，不直接改 phase）
  finish: () => {
    while (run.phase === 'driving') {
      run.player.s = run.track.length;
      updateSim(run, { throttle: true });
    }
    endRun({ type: run.phase, rating: run.phase === 'busted' ? 'DNF' : ratingFor(run.score, false) });
  },
};
