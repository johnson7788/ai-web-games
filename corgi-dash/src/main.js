// src/main.js — 装配：固定步长 / 输入 / 事件分发 / 状态机 / SDK / 程序化 BGM（Lead 所有）
import { STEP, WORLD } from '../config/game.config.js';
import { PLAYER } from '../config/gameplay.js';
import { createRun } from './game/sim.js';
import { createRender } from './render/index.js';
import { createUI } from './ui/index.js';
import { createAudio } from './core/audio.js';
import { i18n } from './core/i18n.js';
import Sdk from './core/sdk.js';

// ---------- 装配 ----------
const canvas = document.getElementById('canvas');
const uiRoot = document.getElementById('ui-root');
const btnWhistle = document.getElementById('btn-whistle');
const loadingEl = document.getElementById('loading');

const renderer = createRender(canvas);
const audio = createAudio();

// ---------- 状态 ----------
let state = 'boot';            // boot | title | playing | paused | dead
let run = null;
let lastTime = 0;
let accumulator = 0;
let jumpHeld = false;
let jumpPressedEdge = false;
let whistleEdge = false;
let lastTapAt = 0;
let bestScore = 0;
let muted = false;
let shakeOn = true;

// ---------- 输入（边沿检测归 main） ----------
function onJumpDown() {
  audio.unlock();
  const now = performance.now();
  if (now - lastTapAt < 320) {          // 双击 = 吹哨（不跳）
    whistleEdge = true;
    lastTapAt = 0;
  } else {
    lastTapAt = now;
    jumpPressedEdge = true;
    jumpHeld = true;
  }
}
function onJumpUp() { jumpHeld = false; }

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
    if (!e.repeat) onJumpDown();
    e.preventDefault();
  }
  if (e.code === 'KeyS' || e.code === 'ArrowDown') {
    if (!e.repeat) { audio.unlock(); whistleEdge = true; }
    e.preventDefault();
  }
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'KeyR' && state === 'dead') startGame();
  if (e.code === 'Enter' && state === 'title') startGame();
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') onJumpUp();
});

// 指针 / 触屏：点击跳，双击吹哨
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  onJumpDown();
});
canvas.addEventListener('pointerup', () => onJumpUp());
canvas.addEventListener('pointercancel', () => onJumpUp());
canvas.addEventListener('pointerleave', () => onJumpUp());

// 触屏吹哨按钮（非精确指针设备显示）
if (window.matchMedia && matchMedia('(pointer: coarse)').matches) btnWhistle.hidden = false;
btnWhistle.addEventListener('pointerdown', (e) => { e.preventDefault(); audio.unlock(); whistleEdge = true; });

// ---------- UI ----------
const ui = createUI(uiRoot, {
  onStart: () => startGame(),
  onResume: () => resumeGame(),
  onRestart: () => startGame(),
  onShare: () => shareResult(),
  onHow: () => { /* 重看引导入口 */ },
  onToggleMute: () => { muted = !muted; applyAudioSettings(); ui.setAudioState(muted, shakeOn); },
  onToggleShake: () => { shakeOn = !shakeOn; Sdk.save('shakeOn', shakeOn); ui.setAudioState(muted, shakeOn); },
});
ui.onTutorial((result) => {
  Sdk.track('tutorial_done', { skipped: !!result?.skipped });
});
ui.setBest(bestScore);

// ---------- 音频设置 ----------
function applyAudioSettings() {
  muted = !!Sdk.load('muted', false);
  const vol = Sdk.load('volume', 0.7);
  audio.setMuted(muted);
  audio.setVolume(vol);
  Sdk.save('muted', muted);
  ui.setAudioState(muted, shakeOn);
}

// ---------- 游戏流转 ----------
function startGame() {
  audio.unlock();
  run = createRun({ seed: (Date.now() & 0xffff) * 2654435761 >>> 0 });
  state = 'playing';
  jumpHeld = false;
  jumpPressedEdge = false;
  whistleEdge = false;
  accumulator = 0;
  lastTime = performance.now();
  ui.show('playing');
  Sdk.newRun({ segment: 1 });
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
  const score = Math.floor(stats.score ?? 0);
  const isRecord = score > bestScore;
  if (isRecord) {
    bestScore = score;
    Sdk.save('bestScore', bestScore);
  }
  const bestFlock = Math.max(stats.maxFlock || 0, Sdk.load('bestFlock', 0));
  Sdk.save('bestFlock', bestFlock);
  ui.setBest(bestScore);
  ui.show('dead', {
    distance: Math.floor(stats.distance ?? 0),
    score,
    flock: stats.maxFlock || 0,
    segmentReached: stats.segmentReached || 1,
    best: bestScore,
    newRecord: isRecord,
  });
  Sdk.gameOver({ score, distance: Math.floor(stats.distance ?? 0), flock: stats.maxFlock || 0, segment: stats.segmentReached || 1 });
  audio.stopBgm();
}

async function shareResult() {
  const score = Math.floor(run?.stats?.score ?? 0);
  await Sdk.share({
    title: 'CORGI DASH',
    text: `${i18n.lang === 'zh' ? `我在柯基冲刺赶到了 ${score} 分！` : `I herded my way to ${score} points in CORGI DASH!`}`,
  });
  Sdk.track('share', { score });
}

// ---------- 事件分发 ----------
function dispatchEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);

    if (ev.type === 'land') renderer.burst(WORLD.PLAYER_X, WORLD.GROUND_Y - 6, 'dust');
    else if (ev.type === 'sheepGain') renderer.burst(ev.x, ev.y, 'spark');
    else if (ev.type === 'perfectLand') renderer.burst(WORLD.PLAYER_X + 30, WORLD.GROUND_Y - PLAYER.H, 'perfect');
    else if (ev.type === 'sheepSurge') renderer.surge(WORLD.PLAYER_X, WORLD.GROUND_Y - PLAYER.H);
    else if (ev.type === 'obstacleHit') { renderer.shake(5); renderer.burst(WORLD.PLAYER_X, WORLD.GROUND_Y - 20, 'dust'); }
    else if (ev.type === 'death') renderer.shake(11);

    if (state === 'playing') ui.tutorial.onGameEvent(ev);

    if (ev.type === 'sheepGain') Sdk.track('sheep_gain', { flock: ev.flock });
    else if (ev.type === 'sheepSurge') Sdk.track('sheep_surge', { flock: ev.flock });
    else if (ev.type === 'segmentEnter') Sdk.track('segment_enter', { segment: ev.segment });
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
    run.step({ jump: jumpHeld, jumpPressed: jumpPressedEdge, whistle: whistleEdge });
    jumpPressedEdge = false;
    whistleEdge = false;
    accumulator -= STEP;
    steps++;
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
Sdk.onAdEnd(() => { audio.setMuted(muted); });

// ---------- 启动 ----------
(async () => {
  bestScore = Math.floor(Sdk.load('bestScore', 0)) || 0;
  shakeOn = Sdk.load('shakeOn', true) !== false;
  ui.setBest(bestScore);
  applyAudioSettings();
  await Sdk.ready();
  Sdk.track('load', { lang: i18n.lang });
  // boot 竞态守卫：异步 SDK 加载窗口内玩家可能已点 Start，只在还没开局时才显示标题
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
  debug: { layout: () => ({ viewport: [canvas.clientWidth, canvas.clientHeight], whistle: !btnWhistle.hidden }) },
};
