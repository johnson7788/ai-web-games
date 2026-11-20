// src/main.js — 装配：固定步长 / 输入 / 事件分发 / 状态机 / SDK / BGM（Lead 所有）
import { STEP, WORLD } from '../config/game.config.js';
import { createRun } from './game/sim.js';
import { createRender } from './render/index.js';
import { createUI } from './ui/index.js';
import { createAudio } from './core/audio.js';
import { i18n } from './core/i18n.js';
import Sdk from './core/sdk.js';

const canvas = document.getElementById('canvas');
const uiRoot = document.getElementById('ui-root');
const loadingEl = document.getElementById('loading');

const renderer = createRender(canvas);
const audio = createAudio();

// ---------- 状态 ----------
let state = 'boot';             // boot | title | playing | paused | dead | won
let run = null;
let lastTime = 0;
let accumulator = 0;
let bestStage = 0;
let steerMoved = false;         // 教程：真实移动信号

// ---------- 输入 ----------
const keys = { l: false, r: false, u: false, d: false };
let pointerX = null;            // 鼠标世界坐标
let pointerY = null;
let joyActive = false;
let joyDir = { x: 0, y: 0 };

function worldFromClient(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(rect.width / WORLD.WIDTH, rect.height / WORLD.HEIGHT);
  const ox = (rect.width - WORLD.WIDTH * scale) / 2;
  const oy = (rect.height - WORLD.HEIGHT * scale) / 2;
  return {
    x: (clientX - rect.left - ox) / scale,
    y: (clientY - rect.top - oy) / scale,
  };
}

function currentTarget() {
  if (!run) return null;
  // 键盘：朝方向恒定偏移（方向控制）
  let dx = 0;
  let dy = 0;
  if (keys.l) dx -= 1;
  if (keys.r) dx += 1;
  if (keys.u) dy -= 1;
  if (keys.d) dy += 1;
  if (dx || dy) {
    const len = Math.hypot(dx, dy);
    return { x: run.player.x + (dx / len) * 320, y: run.player.y + (dy / len) * 320 };
  }
  // 触屏摇杆
  if (joyActive && (joyDir.x || joyDir.y)) {
    return { x: run.player.x + joyDir.x * 320, y: run.player.y + joyDir.y * 320 };
  }
  // 鼠标跟随
  if (pointerX != null && pointerY != null) return { x: pointerX, y: pointerY };
  return null;
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.l = true;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.r = true;
  if (e.code === 'ArrowUp' || e.code === 'KeyW') keys.u = true;
  if (e.code === 'ArrowDown' || e.code === 'KeyS') keys.d = true;
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'KeyR' && (state === 'dead' || state === 'won')) startGame();
  if (e.code === 'Enter' && state === 'title') startGame();
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.l = false;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.r = false;
  if (e.code === 'ArrowUp' || e.code === 'KeyW') keys.u = false;
  if (e.code === 'ArrowDown' || e.code === 'KeyS') keys.d = false;
});

canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'touch') {
    if (joyActive) {
      const w = worldFromClient(e.clientX, e.clientY);
      const rect = canvas.getBoundingClientRect();
      const scale = Math.min(rect.width / WORLD.WIDTH, rect.height / WORLD.HEIGHT);
      joyDir = {
        x: (e.clientX - joyOrigin.cx) / scale / 320,
        y: (e.clientY - joyOrigin.cy) / scale / 320,
      };
      const m = Math.hypot(joyDir.x, joyDir.y);
      if (m > 1) { joyDir.x /= m; joyDir.y /= m; }
      if (state === 'playing') steerMoved = true;
    }
    return;
  }
  const w = worldFromClient(e.clientX, e.clientY);
  pointerX = w.x;
  pointerY = w.y;
  if (state === 'playing') steerMoved = true;
});
canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (e.pointerType === 'touch') {
    const rect = canvas.getBoundingClientRect();
    joyOrigin = { cx: e.clientX, cy: e.clientY };
    joyDir = { x: 0, y: 0 };
    joyActive = true;
    e.preventDefault();
  } else {
    const w = worldFromClient(e.clientX, e.clientY);
    pointerX = w.x;
    pointerY = w.y;
    if (state === 'playing') steerMoved = true;
  }
});
function endPointer(e) {
  if (e.pointerType === 'touch') { joyActive = false; joyDir = { x: 0, y: 0 }; }
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('pointerleave', () => { pointerX = null; pointerY = null; });

// ---------- UI ----------
const ui = createUI(uiRoot, {
  onPlay: () => startGame(),
  onResume: () => resumeGame(),
  onRestart: () => startGame(),
  onShare: () => shareResult(),
  onHow: () => { /* 重看引导：标题屏点进来时直接开一局更顺 */ },
});
ui.onTutorial((result) => {
  Sdk.track('tutorial_done', { skipped: !!result?.skipped });
});
ui.setBest(bestStage);

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
  run = createRun({ seed: (Date.now() & 0xffff) * 2654435761 >>> 0 });
  state = 'playing';
  pointerX = null;
  pointerY = null;
  joyActive = false;
  joyDir = { x: 0, y: 0 };
  accumulator = 0;
  lastTime = performance.now();
  ui.show('playing');
  Sdk.newRun({ zone: 1 });
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
  const stage = stats.maxStage || run.player.stage || 0;
  const isRecord = stage > bestStage;
  if (isRecord) {
    bestStage = stage;
    Sdk.save('bestStage', bestStage);
  }
  ui.setBest(bestStage);
  ui.show('dead', {
    stage,
    mass: stats.maxMass || 0,
    score: stats.score || 0,
    best: bestStage,
    newRecord: isRecord,
    won: false,
  });
  Sdk.gameOver({ stage, mass: Math.round(stats.maxMass || 0), score: Math.round(stats.score || 0) });
  audio.stopBgm();
}

function onWin() {
  state = 'won';
  const stats = run.stats || {};
  const stage = stats.maxStage || run.player.stage || 0;
  const isRecord = stage > bestStage;
  if (isRecord) {
    bestStage = stage;
    Sdk.save('bestStage', bestStage);
  }
  ui.setBest(bestStage);
  ui.show('won', {
    stage,
    mass: stats.maxMass || 0,
    score: stats.score || 0,
    best: bestStage,
    newRecord: isRecord,
    won: true,
  });
  Sdk.levelCleared({ stage, score: Math.round(stats.score || 0) });
  Sdk.track('win', { stage });
  audio.stopBgm();
}

async function shareResult() {
  const stage = Math.floor(run?.stats?.maxStage ?? 0);
  await Sdk.share({
    title: 'FOOD CHAIN',
    text: `${i18n.lang === 'zh' ? `我进化到了第 ${stage} 阶段！` : `I evolved to stage ${stage}!`} FOOD CHAIN`,
  });
  Sdk.track('share', { stage });
}

// ---------- 事件分发 ----------
function dispatchEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);

    if (ev.type === 'eatFood') renderer.burst(ev.x, ev.y, 'eatFood');
    else if (ev.type === 'eatPrey') renderer.burst(ev.x, ev.y, 'eatPrey');
    else if (ev.type === 'eatToxic') renderer.burst(ev.x, ev.y, 'eatToxic');
    else if (ev.type === 'lightChain') renderer.burst(ev.x, ev.y, 'lightChain');
    else if (ev.type === 'evolve') renderer.burst(run.player.x, run.player.y, 'evolve');
    else if (ev.type === 'stingGain') renderer.burst(run.player.x, run.player.y, 'stingGain');
    else if (ev.type === 'stingUse') renderer.burst(ev.x, ev.y, 'stingUse');
    else if (ev.type === 'death') renderer.burst(run.player.x, run.player.y, 'death');

    if (state === 'playing') ui.tutorial.onGameEvent(ev, performance.now());

    if (ev.type === 'evolve') Sdk.track('evolve', { stage: ev.to });
    else if (ev.type === 'lightChain') Sdk.track('lightChain', { stage: ev.stage });
  }
}

// ---------- 主循环 ----------
function loop(now) {
  requestAnimationFrame(loop);

  if (state !== 'playing') {
    renderer.draw(state === 'paused' || state === 'dead' || state === 'won' ? run : null, 1);
    return;
  }

  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  accumulator += dt;

  let steps = 0;
  while (accumulator >= STEP && steps < 6) {
    const t = currentTarget();
    run.step({ steerX: t ? t.x : null, steerY: t ? t.y : null });
    accumulator -= STEP;
    steps++;
    if (steerMoved) {
      ui.tutorial.onGameEvent({ type: 'steer' }, performance.now());
      steerMoved = false;
    }
    dispatchEvents(run.drainEvents());
    if (run.phase === 'dead') { onDeath(); return; }
    if (run.phase === 'won') { onWin(); return; }
  }

  renderer.draw(run, accumulator / STEP);
  ui.setHud(run.getHud());
  ui.tutorial.tick(performance.now());
}

// ---------- 失焦自动暂停 ----------
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'playing') togglePause();
});

// ---------- 广告期间静音 ----------
Sdk.onAdStart(() => audio.setMuted(true));
Sdk.onAdEnd(() => { audio.setMuted(!!Sdk.load('muted', false)); });

// ---------- 降噪动效 ----------
if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) {
  renderer.setReducedMotion(true);
}

// ---------- 启动 ----------
(async () => {
  bestStage = Math.floor(Sdk.load('bestStage', 0)) || 0;
  ui.setBest(bestStage);
  applyAudioSettings();
  await Sdk.ready();
  Sdk.track('load', { lang: i18n.lang });
  // boot 竞态守卫：玩家可能在 boot 期间已点开始；只在还没开局时才显示标题
  if (state === 'boot') { state = 'title'; ui.show('title'); }
  renderer.draw(null, 1);
  loadingEl.classList.add('hidden');
  lastTime = performance.now();
  requestAnimationFrame(loop);
})();

window.addEventListener('beforeunload', () => {
  Sdk.track('session_end', { bestStage });
});

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
