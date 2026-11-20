// src/main.js — 装配：固定步长 / 输入 / 事件分发 / 状态机 / SDK / BGM（Lead 所有）
import { STEP, WORLD } from '../config/game.config.js';
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

const renderer = createRender(canvas);
const audio = createAudio();

// ---------- 状态 ----------
let state = 'boot';             // boot | title | playing | paused | dead
let run = null;
let lastTime = 0;
let accumulator = 0;
let bestDepth = 0;
let rotatedThisStep = false;    // 教程：真实旋转信号

// ---------- 输入（边沿检测归 main） ----------
const keys = { left: false, right: false };
let pointerActive = false;
let lastPointerX = null;
let dragVel = 0;

function computeRotate() {
  let r = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  if (r === 0 && Math.abs(dragVel) > 0.01) r = dragVel;
  dragVel *= 0.86;
  return Math.max(-1, Math.min(1, r));
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'KeyR' && state === 'dead') startGame();
  if (e.code === 'Enter' && state === 'title') startGame();
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
});

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  pointerActive = true;
  lastPointerX = e.clientX;
  canvas.setPointerCapture?.(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!pointerActive || lastPointerX == null) return;
  const dx = e.clientX - lastPointerX;
  lastPointerX = e.clientX;
  dragVel = Math.max(-1, Math.min(1, dragVel + dx * 0.05));
});
canvas.addEventListener('pointerup', () => { pointerActive = false; lastPointerX = null; });
canvas.addEventListener('pointercancel', () => { pointerActive = false; lastPointerX = null; });

// ---------- UI ----------
const ui = createUI(uiRoot, {
  onStart: () => startGame(),
  onResume: () => resumeGame(),
  onRestart: () => startGame(),
  onShare: () => shareResult(),
  onHow: () => { /* 重看引导 */ },
});
ui.onTutorial((result) => {
  Sdk.track('tutorial_done', { skipped: !!result?.skipped });
});
ui.setBest(bestDepth);

function applyAudioSettings() {
  const muted = Sdk.load('muted', false);
  const vol = Sdk.load('volume', 0.8);
  audio.setMuted(!!muted);
  audio.setVolume(vol);
}

// ---------- 游戏流转 ----------
function startGame() {
  audio.unlock();
  run = createRun({ seed: (Date.now() & 0xffff) * 2654435761 >>> 0 });
  state = 'playing';
  dragVel = 0;
  pointerActive = false;
  lastPointerX = null;
  accumulator = 0;
  lastTime = performance.now();
  ui.show('playing');
  Sdk.newRun({ zone: 1 });
  audio.playBgm();
  applyAudioSettings();
}

function togglePause() {
  if (state === 'playing') { state = 'paused'; ui.show('paused'); audio.setMuted(true); }
  else if (state === 'paused') { resumeGame(); }
}
function resumeGame() {
  if (state === 'paused') {
    state = 'playing';
    ui.show('playing');
    applyAudioSettings();
    lastTime = performance.now();
  }
}

function toTitle() {
  state = 'title';
  run = null;
  ui.show('title');
  renderer.draw(null, 1);
  audio.stopBgm();
  applyAudioSettings();
}

function onDeath() {
  state = 'dead';
  const depth = Math.floor(run.stats.depth ?? run.currentLayer ?? 0);
  const score = Math.floor(run.stats.score ?? run.score ?? 0);
  const isRecord = depth > bestDepth;
  if (isRecord) {
    bestDepth = depth;
    Sdk.save('bestDepth', bestDepth);
  }
  ui.setBest(bestDepth);
  ui.show('dead', { depth, score, best: bestDepth, newRecord: isRecord });
  Sdk.gameOver({ depth, score });
  audio.event('death', {});
  audio.stopBgm();
}

async function shareResult() {
  const depth = Math.floor(run?.stats?.depth ?? 0);
  await Sdk.share({
    title: 'HELIX ORBIT',
    text: `${i18n.lang === 'zh' ? `我坠到了 ${depth} 层！` : `I dropped ${depth} layers deep!`} HELIX ORBIT`,
  });
  Sdk.track('share', { depth });
}

// ---------- 事件分发 ----------
function dispatchEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    renderer.onEvent(ev);
    if (state === 'playing') ui.tutorial.onGameEvent(ev);
    if (ev.type === 'meteorSmash') Sdk.track('meteor_smash', { depth: run.currentLayer });
    else if (ev.type === 'layerPass') Sdk.track('layer_pass', { depth: run.currentLayer });
  }
}

// ---------- 主循环 ----------
function loop(now) {
  requestAnimationFrame(loop);

  if (state !== 'playing') {
    renderer.draw(state === 'paused' || state === 'dead' ? run : null, 1);
    return;
  }

  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  accumulator += dt;

  let steps = 0;
  while (accumulator >= STEP && steps < 6) {
    const rotate = computeRotate();
    run.step({ rotate });
    accumulator -= STEP;
    steps++;
    if (Math.abs(rotate) > 0.05) rotatedThisStep = true;
    if (rotatedThisStep) {
      ui.tutorial.onGameEvent({ type: 'rotate' });
      rotatedThisStep = false;
    }
    dispatchEvents(run.drainEvents());
    if (run.phase === 'dead') { onDeath(); return; }
  }

  renderer.draw(run, accumulator / STEP);
  ui.setHud(run.getHud());
  ui.tutorial.tick();
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
  bestDepth = Math.floor(Sdk.load('bestDepth', 0)) || 0;
  ui.setBest(bestDepth);
  applyAudioSettings();
  await Sdk.ready();
  Sdk.track('load', { lang: i18n.lang });
  // boot 竞态守卫：玩家可能在 boot 期间已点 Start；只在还没开局时才显示标题
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
  debug: { layout: () => ({ viewport: [canvas.clientWidth, canvas.clientHeight] }) },
};
