// src/main.js — 装配：固定步长 / 输入 / 事件分发 / 状态机 / SDK / BGM（Lead 所有）
import { STEP } from '../config/game.config.js';
import { CANNON as C, WORLD as GAME_WORLD, clamp } from '../config/gameplay.js';
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
let aiming = false;
let aimAngle = null;
let fireQueued = false;
let bestScore = 0;

// ---------- 输入（边沿检测归 main） ----------
function canvasToWorld(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const sx = GAME_WORLD.WIDTH / Math.max(1, rect.width);
  const sy = GAME_WORLD.HEIGHT / Math.max(1, rect.height);
  return { x: (clientX - rect.left) * sx, y: (clientY - rect.top) * sy };
}

function pointerAngle(clientX, clientY) {
  const p = canvasToWorld(clientX, clientY);
  const dx = p.x - C.X;
  const dy = p.y - C.Y;
  const angle = Math.atan2(dx, -dy);
  return clamp(angle, -C.AIM_MAX_ANGLE, C.AIM_MAX_ANGLE);
}

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  aiming = true;
  aimAngle = pointerAngle(e.clientX, e.clientY);
  e.preventDefault();
});
canvas.addEventListener('pointermove', (e) => {
  if (aiming) aimAngle = pointerAngle(e.clientX, e.clientY);
});
function endAim() {
  if (aiming) {
    aiming = false;
    fireQueued = true;
  }
}
canvas.addEventListener('pointerup', endAim);
canvas.addEventListener('pointercancel', () => { aiming = false; });
canvas.addEventListener('pointerleave', () => { if (aiming) { aiming = false; } });

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'KeyR' && state === 'dead') startGame();
  if (e.code === 'Enter' && state === 'title') startGame();
});
window.addEventListener('keyup', () => {});

// ---------- UI ----------
const ui = createUI(uiRoot, {
  onDive: () => startGame(),
  onResume: () => resumeGame(),
  onRestart: () => startGame(),
  onShare: () => shareResult(),
  onHow: () => { /* 重看引导：标题屏点进来时直接开一局更顺 */ },
});
ui.onTutorial((result) => {
  Sdk.track('tutorial_done', { skipped: !!result?.skipped });
});
ui.setBest(bestScore);

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
  aiming = false;
  fireQueued = false;
  accumulator = 0;
  lastTime = performance.now();
  ui.show('playing');
  Sdk.newRun({ wave: 1 });
  audio.playBgm();
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
  audio.stopBgm();
}

function onDeath() {
  state = 'dead';
  const stats = run.stats || {};
  const score = Math.floor(run.score ?? 0);
  const isRecord = score > bestScore;
  if (isRecord) {
    bestScore = score;
    Sdk.save('best', bestScore);
  }
  ui.setBest(bestScore);
  ui.show('dead', {
    score,
    wave: run.wave,
    best: bestScore,
    newRecord: isRecord,
  });
  Sdk.gameOver({ score, wave: run.wave });
  audio.stopBgm();
  if (isRecord) audio.event('newRecord', {});
}

async function shareResult() {
  const score = Math.floor(run?.score ?? 0);
  await Sdk.share({
    title: 'BALL ORBIT',
    text: i18n.lang === 'zh' ? `我在 BALL ORBIT 清除了 ${score} 硬度！` : `I cleared ${score} hardness in BALL ORBIT!`,
  });
  Sdk.track('share', { score });
}

// ---------- 事件分发 ----------
function dispatchEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    if (ev.type === 'asteroidBreak') renderer.burst(ev.x, ev.y, 'break');
    else if (ev.type === 'cometFire') renderer.burst(C.X, C.BALL_Y, 'comet');
    else if (ev.type === 'addBall') renderer.burst(ev.x, ev.y, 'addBall');

    if (state === 'playing') ui.tutorial.onGameEvent(ev);

    if (ev.type === 'asteroidBreak') Sdk.track('asteroidBreak', { wave: run.wave });
    else if (ev.type === 'waveEnter') Sdk.track('waveEnter', { wave: ev.wave });
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
    const fire = fireQueued;
    fireQueued = false;
    run.step({ aimAngle: aiming ? aimAngle : null, fire });
    accumulator -= STEP;
    steps++;
    dispatchEvents(run.drainEvents());
    if (run.phase === 'dead') { onDeath(); return; }
  }

  renderer.draw(run, accumulator / STEP);
  ui.setHud(run.getHud());
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
  bestScore = Math.floor(Sdk.load('best', 0)) || 0;
  ui.setBest(bestScore);
  applyAudioSettings();
  await Sdk.ready();
  Sdk.track('load', { lang: i18n.lang });
  // boot 竞态守卫：玩家可能在 boot 期间已点 Launch；只在还没开局时才显示标题
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
  debug: { layout: () => ({ viewport: [canvas.clientWidth, canvas.clientHeight], wave: run ? run.wave : 0 }) },
};
