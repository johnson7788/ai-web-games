// src/main.js — DONKEY HURDLE · 装配：固定步长 / 输入 / 事件分发 / 状态机 / SDK / BGM
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
const btnDrop = document.getElementById('btn-drop');
const loadingEl = document.getElementById('loading');

const renderer = createRender(canvas);
const audio = createAudio();

// ---------- 状态 ----------
let state = 'boot';             // boot | title | playing | paused | dead
let run = null;
let lastTime = 0;
let accumulator = 0;
let jumpHeld = false;
let jumpQueued = false;   // keydown/pointerdown 的脉冲：即使 down+up 在一帧内完成也保证跳一下
let dropQueued = false;
let bestDist = 0;

// ---------- 输入 ----------
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
    jumpHeld = true;
    jumpQueued = true;
    e.preventDefault();
  }
  if (e.code === 'KeyK') {
    dropQueued = true;
    audio.unlock();
    e.preventDefault();
  }
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'KeyR' && state === 'dead') startGame();
  if (e.code === 'Enter' && state === 'title') startGame();
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') jumpHeld = false;
});

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  jumpHeld = true;
  jumpQueued = true;
});
canvas.addEventListener('pointerup', () => { jumpHeld = false; });
canvas.addEventListener('pointercancel', () => { jumpHeld = false; });
canvas.addEventListener('pointerleave', () => { jumpHeld = false; });

// 触屏卸货跳按钮（非精确指针设备显示）
const isTouch = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || (navigator.maxTouchPoints > 0);
if (isTouch) btnDrop.hidden = false;
btnDrop.addEventListener('pointerdown', (e) => { e.preventDefault(); audio.unlock(); dropQueued = true; });

// ---------- UI ----------
const ui = createUI(uiRoot, {
  onDive: () => startGame(),
  onResume: () => resumeGame(),
  onRestart: () => startGame(),
  onShare: () => shareResult(),
  onHow: () => {},
});
ui.onTutorial((result) => {
  Sdk.track('tutorial_done', { skipped: !!result?.skipped });
});
ui.setBest(bestDist);

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
  jumpHeld = false;
  jumpQueued = false;
  dropQueued = false;
  accumulator = 0;
  lastTime = performance.now();
  ui.show('playing');
  Sdk.newRun({ zone: 1 });
  audio.playBgm('bgm');
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
  const dist = Math.floor(stats.distance ?? run.distance ?? 0);
  const isRecord = dist > bestDist;
  if (isRecord) {
    bestDist = dist;
    Sdk.save('bestDist', bestDist);
  }
  ui.setBest(bestDist);
  ui.show('dead', {
    distance: dist,
    jars: Math.max(0, run.jars),
    segment: stats.segmentReached || run.segment || 1,
    best: bestDist,
    newRecord: isRecord,
  });
  Sdk.gameOver({ distance: dist, segment: stats.segmentReached || 1 });
  audio.stopBgm();
}

async function shareResult() {
  const dist = Math.floor(run?.stats?.distance ?? 0);
  await Sdk.share({
    title: 'DONKEY HURDLE',
    text: `${i18n.lang === 'zh' ? `我的商队跑了 ${dist}m！` : `My caravan ran ${dist}m on the Silk Road!`} DONKEY HURDLE`,
  });
  Sdk.track('share', { distance: dist });
}

// ---------- 事件分发 ----------
function dispatchEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);

    // 视觉粒子
    if (ev.type === 'jump') renderer.burst(WORLD.PLAYER_X, WORLD.GROUND_Y, 'dust', 6);
    else if (ev.type === 'land') renderer.burst(WORLD.PLAYER_X, WORLD.GROUND_Y, 'dust', 10);
    else if (ev.type === 'hit' || ev.type === 'fell') renderer.burst(WORLD.PLAYER_X, run.player.y - 30, 'shard', 14);
    else if (ev.type === 'jarDrop') renderer.burst(WORLD.PLAYER_X, run.player.y - 40, 'shard', 8);
    else if (ev.type === 'superJump') renderer.burst(WORLD.PLAYER_X, run.player.y, 'gold', 12);
    else if (ev.type === 'fullArc') renderer.goldArc(WORLD.PLAYER_X, run.player.y - 40);
    else if (ev.type === 'jarGain') renderer.burst(WORLD.PLAYER_X, run.player.y - 40, 'gold', 10);
    else if (ev.type === 'obstacleClear') renderer.burst(WORLD.PLAYER_X, WORLD.GROUND_Y, 'dust', 4);
    else if (ev.type === 'death') renderer.burst(WORLD.PLAYER_X, run.player.y - 30, 'shard', 20);

    // 教程
    if (state === 'playing') ui.tutorial.onGameEvent(ev, performance.now());

    // 关键埋点（失败不影响玩法）
    if (ev.type === 'segmentEnter') Sdk.track('segment_enter', { segment: ev.segment });
    else if (ev.type === 'jarDrop') Sdk.track('jar_drop', { jars: ev.jars });
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
    run.step({ jump: jumpHeld || jumpQueued, dropJump: dropQueued });
    jumpQueued = false;
    dropQueued = false;
    accumulator -= STEP;
    steps++;
    dispatchEvents(run.drainEvents());
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
  bestDist = Math.floor(Sdk.load('bestDist', 0)) || 0;
  ui.setBest(bestDist);
  applyAudioSettings();
  await Sdk.ready();
  Sdk.track('load', { lang: i18n.lang });
  // boot 竞态守卫：异步 boot 完成后，只在还没开局时才显示标题
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
  debug: { layout: () => ({ viewport: [canvas.clientWidth, canvas.clientHeight], drop: !btnDrop.hidden }) },
};
