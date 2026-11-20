// src/main.js — OCEAN DASH 装配：固定步长 / 输入 / 事件分发 / 状态机 / SDK / BGM（Lead 所有）
import { WORLD, STEP } from '../config/game.config.js';
import { createRun } from './game/sim.js';
import { createRender } from './render/index.js';
import { createUI } from './ui/index.js';
import { createAudio } from './core/audio.js';
import { i18n } from './core/i18n.js';
import Sdk from './core/sdk.js';

const canvas = document.getElementById('canvas');
const uiRoot = document.getElementById('ui-root');
const btnGather = document.getElementById('btn-gather');
const btnJump = document.getElementById('btn-jump');
const loadingEl = document.getElementById('loading');

const renderer = createRender(canvas);
const audio = createAudio();

// ---------- 状态 ----------
let state = 'boot';           // boot | title | playing | paused | result
let run = null;
let lastTime = 0;
let accumulator = 0;
let steerY = null;            // 目标 y（0..720）
let gatherHeld = false;
let jumpHeld = false;
let jumpQueued = false;
let bgmScene = null;
let bestSegment = 1;
let steerMoved = false;

// ---------- 输入 ----------
const keys = { up: false, down: false };
let keyVelY = 0;
let pointerY = null;

function canvasToWorldY(clientY) {
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(rect.width / WORLD.WIDTH, rect.height / WORLD.HEIGHT);
  const oy = (rect.height - WORLD.HEIGHT * scale) / 2;
  return (clientY - rect.top - oy) / scale;
}

function updateSteerFromInputs() {
  if (keys.up || keys.down) {
    keyVelY += (keys.down ? 1 : 0) * 14 - (keys.up ? 1 : 0) * 14;
    keyVelY = Math.max(-26, Math.min(26, keyVelY));
    if (steerY == null) steerY = WORLD.HEIGHT / 2;
    steerY = Math.max(160, Math.min(660, steerY + keyVelY));
    if (Math.abs(keyVelY) > 2) steerMoved = true;
  } else {
    keyVelY = 0;
    if (pointerY != null) steerY = pointerY;
  }
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowUp' || e.code === 'KeyW') keys.up = true;
  if (e.code === 'ArrowDown' || e.code === 'KeyS') keys.down = true;
  if (e.code === 'Space') { gatherHeld = true; e.preventDefault(); }
  if (e.code === 'KeyJ' || e.code === 'KeyK') {
    if (!jumpHeld) jumpQueued = true;
    jumpHeld = true;
    e.preventDefault();
  }
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'KeyR' && state === 'result') startGame();
  if (e.code === 'Enter' && state === 'title') startGame();
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowUp' || e.code === 'KeyW') keys.up = false;
  if (e.code === 'ArrowDown' || e.code === 'KeyS') keys.down = false;
  if (e.code === 'Space') gatherHeld = false;
  if (e.code === 'KeyJ' || e.code === 'KeyK') jumpHeld = false;
});

// 指针：移动 = 上下转向（桌面 hover / 触屏拖动）
canvas.addEventListener('pointermove', (e) => {
  pointerY = canvasToWorldY(e.clientY);
  if (pointerY != null && state === 'playing') steerMoved = true;
});
canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  pointerY = canvasToWorldY(e.clientY);
  // 鼠标点击画布 = 跳跃/滑翔；触屏拖动只转向，跳跃走 #btn-jump
  if (e.pointerType === 'mouse' && state === 'playing') {
    jumpQueued = true;
    jumpHeld = true;
  }
});
window.addEventListener('pointerup', () => { jumpHeld = false; });
canvas.addEventListener('pointerleave', () => { pointerY = null; });

// 触屏按钮（非精确指针设备显示）
if (window.matchMedia && matchMedia('(pointer: coarse)').matches) {
  btnGather.hidden = false;
  btnJump.hidden = false;
}
btnGather.addEventListener('pointerdown', (e) => { e.preventDefault(); audio.unlock(); gatherHeld = true; });
btnGather.addEventListener('pointerup', () => { gatherHeld = false; });
btnGather.addEventListener('pointercancel', () => { gatherHeld = false; });
btnJump.addEventListener('pointerdown', (e) => { e.preventDefault(); audio.unlock(); if (!jumpHeld) jumpQueued = true; jumpHeld = true; });
btnJump.addEventListener('pointerup', () => { jumpHeld = false; });
btnJump.addEventListener('pointercancel', () => { jumpHeld = false; });

// ---------- UI ----------
const ui = createUI(uiRoot, {
  onStart: () => startGame(),
  onResume: () => resumeGame(),
  onRestart: () => startGame(),
  onShare: () => shareResult(),
});
ui.onTutorial((result) => {
  Sdk.track('tutorial_done', { skipped: !!result?.skipped });
});
ui.setBest(bestSegment);

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
  steerY = null;
  pointerY = null;
  gatherHeld = false;
  jumpHeld = false;
  jumpQueued = false;
  accumulator = 0;
  lastTime = performance.now();
  ui.show('playing');
  Sdk.newRun({ zone: 1 });
  setBgm(run.getHud().scene);
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
  setBgm(null);
}

function onDeath() {
  finishRun({ win: false, rank: 4 });
}

function onFinish(phase) {
  finishRun({ win: phase === 'completed', rank: run.stats.lastRank });
}

function finishRun({ win, rank }) {
  state = 'result';
  const reached = run.stats.segmentReached || 1;
  const isRecord = reached > bestSegment;
  if (isRecord) {
    bestSegment = reached;
    Sdk.save('bestSegment', bestSegment);
  }
  ui.setBest(bestSegment);
  ui.show('result', {
    win,
    segment: run.segment,
    rank,
    fish: run.fish,
    best: bestSegment,
    newRecord: isRecord,
  });
  Sdk.gameOver({ segment: run.segment, rank, fish: run.fish });
  setBgm(null);
}

// ---------- BGM（按场景切换） ----------
async function shareResult() {
  const seg = run?.stats?.segmentReached ?? 1;
  await Sdk.share({
    title: 'OCEAN DASH',
    text: `${i18n.lang === 'zh' ? `我在 OCEAN DASH 洄游到了第 ${seg} 赛段！` : `I reached segment ${seg} in OCEAN DASH!`}`,
  });
  Sdk.track('share', { segment: seg });
}

function setBgm(sceneId) {
  if (bgmScene === sceneId) return;
  bgmScene = sceneId;
  audio.stopBgm();
  if (sceneId) audio.playBgm(sceneId);
}

// ---------- 事件分发 ----------
function dispatchEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);

    if (ev.type === 'bubbleGain') renderer.burst(WORLD.PLAYER_X, ev.y ?? 300, 'pop');
    else if (ev.type === 'currentBoost') renderer.burst(WORLD.PLAYER_X, run.player.y, 'boost');
    else if (ev.type === 'obstacleHit') renderer.burst(WORLD.PLAYER_X, run.player.y, 'hit');
    else if (ev.type === 'glideStart') renderer.burst(WORLD.PLAYER_X, WORLD.SURFACE_Y, 'spray');

    if (state === 'playing') ui.tutorial.onGameEvent(ev, performance.now());

    if (ev.type === 'segmentEnter') setBgm(ev.name);
    else if (ev.type === 'segmentClear') {
      if (ev.rank <= 2) ui.toast('result.win');
      Sdk.track('segmentClear', { segment: ev.segment, rank: ev.rank });
    } else if (ev.type === 'currentBoost') Sdk.track('currentBoost', {});
    else if (ev.type === 'nearMiss') Sdk.track('nearMiss', {});
  }
}

// ---------- 主循环 ----------
function loop(now) {
  requestAnimationFrame(loop);

  if (state !== 'playing') {
    renderer.draw(state === 'paused' || state === 'result' ? run : null, 1);
    return;
  }

  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  accumulator += dt;

  let steps = 0;
  while (accumulator >= STEP && steps < 6) {
    updateSteerFromInputs();
    run.step({ steerY, gather: gatherHeld, jump: jumpQueued, glide: jumpHeld });
    jumpQueued = false;
    accumulator -= STEP;
    steps++;
    if (steerMoved) {
      ui.tutorial.onGameEvent({ type: 'steer' }, performance.now());
      steerMoved = false;
    }
    dispatchEvents(run.drainEvents());
    if (run.phase === 'dead') { onDeath(); return; }
    if (run.phase === 'failed' || run.phase === 'completed') { onFinish(run.phase); return; }
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

// ---------- 启动 ----------
(async () => {
  bestSegment = Math.floor(Sdk.load('bestSegment', 0)) || 1;
  ui.setBest(bestSegment);
  applyAudioSettings();
  await Sdk.ready();
  Sdk.track('load', { lang: i18n.lang });
  // 玩家可能在 boot 期间已点 Start（异步 SDK 加载窗口）；只在还没开局时才显示标题
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
  debug: { layout: () => ({ viewport: [canvas.clientWidth, canvas.clientHeight], gather: !btnGather.hidden, jump: !btnJump.hidden }) },
};
