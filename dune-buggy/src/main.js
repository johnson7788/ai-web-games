// src/main.js — 装配：固定步长 / 输入 / 事件分发 / 状态机 / SDK / 音频（Lead 所有）
import { STEP, WORLD } from '../config/game.config.js';
import { STAGE_COUNT, stageAt } from '../config/levels.js';
import { createRun } from './game/sim.js';
import { createRender } from './render/index.js';
import { createUI } from './ui/index.js';
import { createAudio } from './core/audio.js';
import { i18n } from './core/i18n.js';
import Sdk from './core/sdk.js';

// ---------- 装配 ----------
const canvas = document.getElementById('canvas');
const uiRoot = document.getElementById('ui-root');
const loadingEl = document.getElementById('loading');
const stageToast = document.getElementById('stage-toast');

const renderer = createRender(canvas);
const audio = createAudio();

// ---------- 状态 ----------
let state = 'boot';             // boot | title | playing | paused | win | dead
let run = null;
let lastTime = 0;
let accumulator = 0;
let bestStage = 1;
let bestTime = 0;
let toastTimer = null;

// ---------- 输入状态 ----------
const keys = { up: false, down: false, left: false, right: false };
const touch = { up: false, down: false, left: false, right: false };
let tuneHeld = false;
let steerHeld = false;
let throttleHeld = false;

// ---------- 输入（边沿检测归 main） ----------
function buildInput() {
  // 物料录制 / 无人值守调试：自动驾驶保持居中并满油门（仅显式开启）
  if (window.__ll && window.__ll.debug && window.__ll.debug.autopilot && run) {
    const steer = Math.max(-1, Math.min(1, -run.playerX * 5));
    return { steer, throttle: 1, brake: 0, tune: false };
  }
  const left = keys.left || touch.left;
  const right = keys.right || touch.right;
  const steer = (right ? 1 : 0) - (left ? 1 : 0);
  const throttle = (keys.up || touch.up) ? 1 : 0;
  const brake = (keys.down || touch.down) ? 1 : 0;
  return { steer, throttle, brake, tune: tuneHeld };
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowUp' || e.code === 'KeyW') keys.up = true;
  if (e.code === 'ArrowDown' || e.code === 'KeyS') keys.down = true;
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;
  if (e.code === 'KeyT') { tuneHeld = true; }
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'KeyR' && (state === 'dead' || state === 'win')) retryOrNext();
  if (e.code === 'Enter' && state === 'title') startGame();
  if (e.code === 'KeyN' && state === 'win') startGame();
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowUp' || e.code === 'KeyW') keys.up = false;
  if (e.code === 'ArrowDown' || e.code === 'KeyS') keys.down = false;
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
  if (e.code === 'KeyT') tuneHeld = false;
});

// ---------- 触屏按钮 ----------
function bindTouchBtn(id, key) {
  const btn = document.getElementById(id);
  if (!btn) return;
  const on = (e) => { e.preventDefault(); audio.unlock(); touch[key] = true; };
  const off = (e) => { e.preventDefault(); touch[key] = false; };
  btn.addEventListener('pointerdown', on);
  btn.addEventListener('pointerup', off);
  btn.addEventListener('pointercancel', off);
  btn.addEventListener('pointerleave', off);
}
bindTouchBtn('btn-left', 'left');
bindTouchBtn('btn-right', 'right');
bindTouchBtn('btn-gas', 'up');
bindTouchBtn('btn-brake', 'down');
const btnTune = document.getElementById('btn-tune');
if (btnTune) {
  btnTune.addEventListener('pointerdown', (e) => { e.preventDefault(); audio.unlock(); tuneHeld = !tuneHeld; });
}

if (window.matchMedia && matchMedia('(pointer: coarse)').matches) {
  document.getElementById('touch-controls').classList.remove('touch-only');
}

// ---------- UI ----------
const ui = createUI(uiRoot, {
  onDive: () => startGame(),
  onResume: () => resumeGame(),
  onRestart: () => toTitle(),
  onRetry: () => startGame(),
  onNext: () => startGame(),
  onShare: () => shareResult(),
  onHow: () => {},
});
ui.onTutorial((result) => {
  Sdk.track('tutorial_done', { skipped: !!result?.skipped });
});
ui.setBest(bestStage, bestTime);

// ---------- 音频设置持久化 ----------
function applyAudioSettings() {
  const muted = Sdk.load('muted', false);
  const vol = Sdk.load('volume', 0.8);
  audio.setMuted(!!muted);
  audio.setVolume(vol);
}

// ---------- 游戏流转 ----------
function startGame() {
  audio.unlock();
  run = createRun({ seed: (Date.now() & 0xffff) * 2654435761 >>> 0, stageIndex: 1 });
  state = 'playing';
  accumulator = 0;
  lastTime = performance.now();
  steerHeld = false;
  throttleHeld = false;
  ui.show('playing');
  Sdk.newRun({ stage: 1 });
  applyAudioSettings();
}

function togglePause() {
  if (state === 'playing') { state = 'paused'; ui.show('paused'); }
  else if (state === 'paused') { resumeGame(); }
}
function resumeGame() {
  if (state === 'paused') { state = 'playing'; ui.show('playing'); lastTime = performance.now(); }
}

function toTitle() {
  state = 'title';
  run = null;
  ui.show('title');
  renderer.draw(null, 1);
}

function retryOrNext() {
  if (state === 'dead' || state === 'win') startGame();
}

function onDeath() {
  state = 'dead';
  const stats = run.stats || {};
  const stage = Math.max(1, stats.maxStage || run.stage || 1);
  const fastest = Math.max(0, stats.fastestStage || 0);
  const newRecord = stage > bestStage;
  if (newRecord) { bestStage = stage; Sdk.save('bestStage', bestStage); }
  if (fastest > 0 && (bestTime === 0 || fastest < bestTime)) { bestTime = fastest; Sdk.save('bestTime', bestTime); }
  ui.setBest(bestStage, bestTime);
  ui.show('dead', {
    mode: 'dnf',
    stage,
    time: run.stageTime,
    parSec: stageAt(run.stage).parSec,
    rating: 'finish',
    best: bestTime,
    newRecord,
  });
  Sdk.gameOver({ stage, time: run.stageTime });
}

function onWin() {
  state = 'win';
  const stats = run.stats || {};
  const stage = STAGE_COUNT;
  const fastest = Math.max(0, stats.fastestStage || 0);
  const newRecord = stage > bestStage;
  if (newRecord) { bestStage = stage; Sdk.save('bestStage', bestStage); }
  if (fastest > 0 && (bestTime === 0 || fastest < bestTime)) { bestTime = fastest; Sdk.save('bestTime', bestTime); }
  ui.setBest(bestStage, bestTime);
  ui.show('win', {
    mode: 'champion',
    stage,
    time: fastest,
    parSec: 0,
    rating: 'gold',
    totalTime: stats.totalTime || run.time,
    best: bestTime,
    newRecord,
  });
  Sdk.levelCleared({ stage });
  audio.event('champion', {});
}

function showStageToast(stage, time, rating) {
  const key = 'rating.' + (rating || 'finish');
  stageToast.textContent = `${i18n.get(stageAt(stage).name)} · ${time.toFixed(1)}s · ${i18n.get(key)}`;
  stageToast.classList.remove('hidden');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => stageToast.classList.add('hidden'), 1400);
}

async function shareResult() {
  const stage = run?.stats?.maxStage ?? bestStage ?? 1;
  await Sdk.share({
    title: 'DUNE BUGGY',
    text: i18n.get('share.text', { stage }),
  });
  Sdk.track('share', { stage });
}

// ---------- 事件分发 ----------
function dispatchEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);

    if (ev.type === 'jump') renderer.burst(WORLD.WIDTH / 2, 560, 'jump');
    else if (ev.type === 'land') renderer.burst(WORLD.WIDTH / 2, 620, 'land');

    if (ev.type === 'stageClear') showStageToast(ev.stage, ev.time, ev.rating);

    if (state === 'playing') ui.tutorial.onGameEvent(ev, performance.now());

    if (ev.type === 'stageClear') Sdk.track('stageClear', { stage: ev.stage, rating: ev.rating });
    else if (ev.type === 'checkpoint') Sdk.track('checkpoint', { stage: run.stage });
    else if (ev.type === 'ridgeBoost') Sdk.track('ridgeBoost', { stage: run.stage });
  }
}

// ---------- 教程输入转发 ----------
function forwardInputTutorial(input) {
  if (state !== 'playing') return;
  const steering = Math.abs(input.steer) > 0;
  if (steering && !steerHeld) {
    steerHeld = true;
    ui.tutorial.onGameEvent({ type: 'steer' }, performance.now());
    audio.event('steer', {});
  } else if (!steering) {
    steerHeld = false;
  }

  const throttling = input.throttle > 0;
  if (throttling && !throttleHeld) {
    throttleHeld = true;
    ui.tutorial.onGameEvent({ type: 'throttle' }, performance.now());
    audio.event('throttle', {});
  } else if (!throttling) {
    throttleHeld = false;
  }
}

// ---------- 主循环 ----------
function loop(now) {
  requestAnimationFrame(loop);

  if (state !== 'playing') {
    renderer.draw(state === 'paused' || state === 'win' || state === 'dead' ? run : null, 1);
    return;
  }

  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  accumulator += dt;

  let steps = 0;
  while (accumulator >= STEP && steps < 6) {
    const input = buildInput();
    run.step(input);
    accumulator -= STEP;
    steps++;
    forwardInputTutorial(input);
    dispatchEvents(run.drainEvents());
    if (run.phase === 'won') { onWin(); return; }
    if (run.phase === 'dead') { onDeath(); return; }
  }

  const hud = run.getHud();
  renderer.draw(run, accumulator / STEP);
  ui.setHud(hud);
  ui.tutorial.tick(performance.now());
}

// ---------- 失焦自动暂停 ----------
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'playing') togglePause();
});

// ---------- 广告期间静音 ----------
Sdk.onAdStart(() => audio.setMuted(true));
Sdk.onAdEnd(() => { audio.setMuted(!!Sdk.load('muted', false)); });

// ---------- 启动 ----------
(async () => {
  bestStage = Math.max(1, Math.floor(Sdk.load('bestStage', 1)) || 1);
  bestTime = Math.max(0, Number(Sdk.load('bestTime', 0)) || 0);
  ui.setBest(bestStage, bestTime);
  applyAudioSettings();
  await Sdk.ready();
  Sdk.track('load', { lang: i18n.lang });
  if (state === 'boot') { state = 'title'; ui.show('title'); }
  renderer.draw(null, 1);
  loadingEl.classList.add('hidden');
  lastTime = performance.now();
  requestAnimationFrame(loop);
})();

// ---------- 标准调试契约 ----------
window.G = {
  get run() { return run; },
  ui,
  renderer,
  audio,
  Sdk,
  get state() { return state; },
};

window.__ll = {
  get state() { return { phase: state, lang: i18n.lang, dir: i18n.dir }; },
  lang: () => i18n.lang,
  setLang: (l) => { i18n.setLang(l); ui.applyLang(); },
  get run() { return run; },
  start: startGame,
  pause: togglePause,
  resume: resumeGame,
  restart: toTitle,
  tutorial: {
    get active() { return ui.tutorial.active; },
    get step() { return ui.tutorial.step; },
    get steps() { return ui.tutorial.steps; },
    get current() { return ui.tutorial.current; },
    skip: () => ui.tutorial.skip(),
  },
  save: () => Sdk.save,
  ui: () => ui,
  debug: {
    autopilot: false,
    layout: () => ({ viewport: [canvas.clientWidth, canvas.clientHeight], touch: !document.getElementById('touch-controls').classList.contains('touch-only') }),
  },
};
