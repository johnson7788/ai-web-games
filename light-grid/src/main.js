// src/main.js — LIGHT GRID · 装配：固定步长 / 输入 / 事件分发 / 状态机 / SDK / BGM。
import { STEP } from '../config/game.config.js';
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
let state = 'boot';            // boot | title | playing | paused | solved | dead
let run = null;
let lastTime = 0;
let accumulator = 0;
let cursor = [0, 0];           // 键盘光标
let hover = null;              // 指针悬停格

// ---------- 音频设置（持久化走 Sdk） ----------
function applyAudioSettings() {
  audio.setMuted(!!Sdk.load('muted', false));
  audio.setVolume(Number(Sdk.load('volume', 0.7)) || 0.7);
}

// ---------- 输入（边沿检测归 main） ----------
canvas.addEventListener('pointermove', (e) => {
  const rc = cellFromPointer(e);
  hover = rc;
  renderer.setHover(rc);
});
canvas.addEventListener('pointerleave', () => { hover = null; renderer.setHover(null); });
canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  const rc = cellFromPointer(e);
  if (rc && state === 'playing') {
    cursor = rc;
    run.press(rc[0], rc[1]);
  }
});

function cellFromPointer(e) {
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(rect.width / 1280, rect.height / 720);
  const ox = (rect.width - 1280 * scale) / 2;
  const oy = (rect.height - 720 * scale) / 2;
  const px = (e.clientX - rect.left - ox) / scale;
  const py = (e.clientY - rect.top - oy) / scale;
  return renderer.cellAt(px, py);
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') { togglePause(); return; }
  if (e.code === 'KeyR' && (state === 'dead' || state === 'solved')) { retryLevel(); return; }
  if (e.code === 'Enter' && state === 'solved') { nextLevel(); return; }
  if (state !== 'playing') return;
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') { moveCursor(0, -1); e.preventDefault(); }
  else if (e.code === 'ArrowRight' || e.code === 'KeyD') { moveCursor(0, 1); e.preventDefault(); }
  else if (e.code === 'ArrowUp' || e.code === 'KeyW') { moveCursor(-1, 0); e.preventDefault(); }
  else if (e.code === 'ArrowDown' || e.code === 'KeyS') { moveCursor(1, 0); e.preventDefault(); }
  else if (e.code === 'Enter' || e.code === 'Space') {
    run.press(cursor[0], cursor[1]);
    e.preventDefault();
  }
});

function moveCursor(dr, dc) {
  const N = run ? run.N : 5;
  cursor = [
    Math.max(0, Math.min(N - 1, cursor[0] + dr)),
    Math.max(0, Math.min(N - 1, cursor[1] + dc)),
  ];
  renderer.setHover(cursor);
}

// ---------- UI ----------
const ui = createUI(uiRoot, {
  onStart: () => startGame(),
  onResume: () => resumeGame(),
  onRestart: () => toTitle(),
  onNext: () => nextLevel(),
  onAgain: () => retryLevel(),
  onShare: () => shareResult(),
  onMute: (m) => { audio.setMuted(m); Sdk.save('muted', m); },
});
ui.onTutorial((result) => {
  Sdk.track('tutorial_done', { skipped: !!result?.skipped });
});

// ---------- 游戏流转 ----------
function startGame() {
  audio.unlock();
  const startLevel = Math.max(0, Math.floor(Sdk.load('bestLevel', 1)) - 1);
  run = createRun({ level: startLevel, seed: (Date.now() & 0xffff) * 2654435761 >>> 0 });
  state = 'playing';
  cursor = [0, 0];
  hover = null;
  renderer.setHover(null);
  renderer.clearHint();
  accumulator = 0;
  lastTime = performance.now();
  ui.setBest({ stars: Sdk.load('bestStars', 0), level: Sdk.load('bestLevel', 1) });
  ui.show('playing');
  Sdk.newRun({ level: run.levelIndex + 1 });
  applyAudioSettings();
  audio.playBgm('bgm');
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
  renderer.setHover(null);
  renderer.clearHint();
  ui.show('title');
  ui.setBest({ stars: Sdk.load('bestStars', 0), level: Sdk.load('bestLevel', 1) });
  audio.stopBgm();
}

function startLevel(n) {
  audio.unlock();
  run = createRun({ level: Math.max(0, Math.min(n, 35)), seed: (Date.now() & 0xffff) * 2654435761 >>> 0 });
  state = 'playing';
  cursor = [0, 0];
  hover = null;
  renderer.setHover(null);
  renderer.clearHint();
  accumulator = 0;
  lastTime = performance.now();
  ui.show('playing');
  Sdk.newRun({ level: run.levelIndex + 1 });
  applyAudioSettings();
  audio.playBgm('bgm');
}

function retryLevel() {
  const idx = run ? run.levelIndex : 0;
  run = createRun({ level: idx, seed: (Date.now() & 0xffff) * 2654435761 >>> 0 });
  state = 'playing';
  cursor = [0, 0];
  renderer.setHover(null);
  renderer.clearHint();
  accumulator = 0;
  lastTime = performance.now();
  ui.show('playing');
  Sdk.newRun({ level: idx + 1 });
  applyAudioSettings();
  audio.playBgm('bgm');
}

function nextLevel() {
  if (!run || state !== 'solved') return;
  if (run.nextLevel()) {
    state = 'playing';
    cursor = [0, 0];
    renderer.setHover(null);
    renderer.clearHint();
    accumulator = 0;
    lastTime = performance.now();
    ui.show('playing');
  } else {
    toTitle();
  }
}

function onSolved() {
  const hud = run.getHud();
  const prevBest = Sdk.load('bestStars', 0);
  const prevLevel = Sdk.load('bestLevel', 1);
  const isRecord = run.stars > prevBest;
  if (isRecord) Sdk.save('bestStars', run.stars);
  if (hud.level >= prevLevel) Sdk.save('bestLevel', Math.min(hud.level + 1, 36));
  state = 'solved';
  renderer.flashSolved(renderer.serpentineOrder(run.N));
  ui.setBest({ stars: Sdk.load('bestStars', 0), level: Sdk.load('bestLevel', 1) });
  ui.show('result', {
    win: true, steps: hud.steps, par: hud.par, stars: run.stars,
    bestStars: Sdk.load('bestStars', 0), newRecord: isRecord,
  });
  Sdk.levelCleared({ level: hud.level, stars: run.stars, steps: hud.steps });
}

function onOverload() {
  const hud = run.getHud();
  state = 'dead';
  ui.show('result', { win: false, steps: hud.steps, par: hud.par, stars: 0, bestStars: Sdk.load('bestStars', 0), newRecord: false });
  Sdk.gameOver({ level: hud.level, steps: hud.steps });
}

async function shareResult() {
  const level = run ? run.levelIndex + 1 : 1;
  await Sdk.share({
    title: 'LIGHT GRID',
    text: i18n.lang === 'zh' ? `我点亮了第 ${level} 块电路！LIGHT GRID` : `I powered board ${level}! LIGHT GRID`,
  });
  Sdk.track('share', { level });
}

// ---------- 事件分发 ----------
function dispatchEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    if (ev.type === 'signature') renderer.flashSolved(renderer.serpentineOrder(run ? run.N : 5));
    if (state === 'playing') ui.tutorial.onGameEvent(ev);
  }
}

// ---------- 主循环 ----------
function loop(now) {
  requestAnimationFrame(loop);

  if (state !== 'playing') {
    renderer.draw(state === 'paused' || state === 'solved' || state === 'dead' ? run : null, 1, now);
    return;
  }

  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  accumulator += dt;

  let steps = 0;
  while (accumulator >= STEP && steps < 6) {
    run.step({});
    accumulator -= STEP;
    steps += 1;
    dispatchEvents(run.drainEvents());
    if (run.phase !== 'playing') {
      if (run.phase === 'solved') onSolved();
      else if (run.phase === 'dead') onOverload();
      else if (run.phase === 'complete') toTitle();
      break;
    }
  }

  renderer.draw(run, accumulator / STEP, now);
  ui.setHud(run.getHud());
  ui.tutorial.tick(now);
}

// ---------- 失焦自动暂停 ----------
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'playing') togglePause();
});

// ---------- 广告期间静音 ----------
Sdk.onAdStart(() => audio.setMuted(true));
Sdk.onAdEnd(() => audio.setMuted(!!Sdk.load('muted', false)));

// ---------- 启动 ----------
(async () => {
  applyAudioSettings();
  ui.setBest({ stars: Sdk.load('bestStars', 0), level: Sdk.load('bestLevel', 1) });
  await Sdk.ready();
  Sdk.track('load', { lang: i18n.lang });
  // boot 竞态守卫：异步 SDK 加载期间玩家可能已点 Start；只在还没开局时才显示标题
  if (state === 'boot') { state = 'title'; ui.show('title'); }
  renderer.draw(null, 1, 0);
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
  startLevel,
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
