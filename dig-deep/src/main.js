// src/main.js — DIG DEEP 装配：固定步长 / 输入 / 事件分发 / 状态机 / SDK / BGM
import { STEP, WORLD } from '../config/game.config.js';
import { TOOLS } from '../config/gameplay.js';
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
let state = 'boot'; // boot | title | playing | paused | dead | core
let run = null;
let lastTime = 0;
let accumulator = 0;
let moveIntent = 0;
let digHeld = false;
let tool = 0;
let bestDepth = 0;
let bestScore = 0;
let pointerDown = false;
let pointerTargetCol = null;

const { SHAFT_X, SHAFT_W, CELL } = WORLD;

function canvasToCol(clientX) {
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(rect.width / WORLD.WIDTH, rect.height / WORLD.HEIGHT);
  const ox = (rect.width - WORLD.WIDTH * scale) / 2;
  const x = (clientX - rect.left - ox) / scale;
  const col = Math.floor((x - SHAFT_X) / CELL);
  return Math.max(0, Math.min(WORLD.COLS - 1, col));
}

// ---------- UI ----------
const ui = createUI(uiRoot, {
  onStart: () => startGame(),
  onResume: () => resumeGame(),
  onTitle: () => toTitle(),
  onHow: () => { startGame(); ui.tutorial.show(); },
  onTool: (idx) => { tool = idx; },
  onLang: (lang) => { i18n.setLang(lang); ui.applyLang(); },
});
ui.tutorial.onDone((result) => {
  Sdk.track('tutorial_done', { skipped: !!result?.skipped });
});
ui.setBest(bestDepth);

// ---------- 音频设置 ----------
function applyAudioSettings() {
  audio.setMuted(!!Sdk.load('audioMuted', false));
  audio.setVolume(Number(Sdk.load('audioVolume', 0.7)));
}

// ---------- 输入（边沿检测归 main） ----------
const keys = { left: false, right: false, dig: false };

window.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;
  if (e.code === 'Space' || e.code === 'KeyS' || e.code === 'ArrowDown') { keys.dig = true; e.preventDefault(); }
  if (e.code === 'Digit1') tool = 0;
  if (e.code === 'Digit2') tool = 1;
  if (e.code === 'Digit3') tool = 2;
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if ((e.code === 'KeyR' || e.code === 'Enter') && state === 'dead') startGame();
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
  if (e.code === 'Space' || e.code === 'KeyS' || e.code === 'ArrowDown') keys.dig = false;
});

// 指针：点击 = 挖当前列；按住拖动 = 换列
canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  pointerDown = true;
  digHeld = true;
  pointerTargetCol = canvasToCol(e.clientX);
});
canvas.addEventListener('pointermove', (e) => {
  if (!pointerDown) return;
  pointerTargetCol = canvasToCol(e.clientX);
});
canvas.addEventListener('pointerup', () => { pointerDown = false; digHeld = false; pointerTargetCol = null; });
canvas.addEventListener('pointercancel', () => { pointerDown = false; digHeld = false; pointerTargetCol = null; });
canvas.addEventListener('pointerleave', () => { if (!pointerDown) digHeld = false; });

// ---------- 游戏流转 ----------
function startGame() {
  audio.unlock();
  run = createRun({ seed: (Date.now() & 0xffff) * 2654435761 >>> 0 });
  state = 'playing';
  moveIntent = 0;
  digHeld = false;
  tool = 0;
  accumulator = 0;
  lastTime = performance.now();
  ui.show('playing');
  ui.setBest(bestDepth);
  Sdk.newRun({ layer: 1 });
  setBgm('dig');
  applyAudioSettings();
  if (ui.tutorial.shouldAutoShow()) ui.tutorial.show();
}

function togglePause() {
  if (state === 'playing') { state = 'paused'; ui.show('paused'); audio.stopBgm(); }
  else if (state === 'paused') { resumeGame(); }
}
function resumeGame() {
  if (state === 'paused') { state = 'playing'; ui.show('playing'); lastTime = performance.now(); setBgm(themeBgm()); }
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
  const hud = run.getHud();
  const depth = hud.depth;
  const score = hud.score;
  const isRecord = depth > bestDepth || score > bestScore;
  if (depth > bestDepth) { bestDepth = depth; Sdk.save('bestDepth', bestDepth); }
  if (score > bestScore) { bestScore = score; Sdk.save('bestScore', bestScore); }
  ui.setBest(bestDepth);
  ui.show('dead', { depth, score, best: bestDepth, reason: hud.deadReason, newRecord: isRecord });
  Sdk.gameOver({ depth, score, reason: hud.deadReason });
  audio.stopBgm();
}

function onCore() {
  state = 'core';
  const hud = run.getHud();
  ui.show('core');
  Sdk.levelCleared({ depth: hud.depth, score: hud.score });
  audio.stopBgm();
}

function themeBgm() {
  const hud = run ? run.getHud() : null;
  return hud && hud.theme === 2 ? 'core' : 'dig';
}

function setBgm(mode) {
  audio.playBgm(mode);
}

async function shareResult() {
  const hud = run ? run.getHud() : { depth: 0 };
  await Sdk.share({
    title: 'DIG DEEP',
    text: i18n.get('share.text', { depth: Math.floor(hud.depth) }),
  });
  Sdk.track('share', { depth: Math.floor(hud.depth) });
}

// ---------- 事件分发 ----------
function dispatchEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    const x = SHAFT_X + (ev.col ?? run.col) * CELL + CELL / 2;
    const y = 150 + CELL / 2;
    if (ev.type === 'diamond') renderer.burst(x, y, 'diamond');
    else if (ev.type === 'fossil') renderer.burst(x, y, 'fossil');
    else if (ev.type === 'collapse' || ev.type === 'cellBreak') renderer.burst(x, y, 'collapse');
    else if (ev.type === 'cellBreak') renderer.burst(x, y, 'break');
    if (state === 'playing') ui.tutorial.onGameEvent(ev);
    // 首局漏斗埋点（失败不影响玩法）
    if (ev.type === 'layerEnter') Sdk.track('layer_enter', { layer: ev.layer });
    else if (ev.type === 'coreReach') Sdk.track('core_reach', {});
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
    // 输入合成：键盘方向 > 指针拖动
    let move = 0;
    if (keys.left) move = -1;
    else if (keys.right) move = 1;
    else if (pointerTargetCol != null && run) move = Math.sign(pointerTargetCol - run.col);
    moveIntent = move;

    run.step({ move: moveIntent, dig: digHeld || keys.dig, tool });
    accumulator -= STEP;
    steps += 1;
    dispatchEvents(run.drainEvents());
    if (run.phase === 'dead') { onDeath(); return; }
    if (run.coreReached && state === 'playing') { onCore(); return; }
  }

  const hud = run.getHud();
  setBgm(hud.theme === 2 ? 'core' : 'dig');
  renderer.draw(run, accumulator / STEP);
  ui.setHud(hud);
  ui.tutorial.onGameEvent({ type: 'tick' });
}

// ---------- 失焦自动暂停 ----------
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'playing') togglePause();
});

Sdk.onAdStart(() => audio.setMuted(true));
Sdk.onAdEnd(() => audio.setMuted(!!Sdk.load('audioMuted', false)));

// ---------- 启动 ----------
(async () => {
  bestDepth = Math.floor(Sdk.load('bestDepth', 0)) || 0;
  bestScore = Math.floor(Sdk.load('bestScore', 0)) || 0;
  ui.setBest(bestDepth);
  applyAudioSettings();
  await Sdk.ready();
  Sdk.track('load', { lang: i18n.lang });
  // boot 竞态守卫：异步 SDK 加载期间玩家可能已点 Start
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
  share: shareResult,
  tutorial: {
    get active() { return ui.tutorial.active; },
    get step() { return ui.tutorial.step; },
    get steps() { return ui.tutorial.steps; },
    get current() { return ui.tutorial.current; },
    skip: () => ui.tutorial.skip(),
  },
  save: () => Sdk.save,
  ui: () => ui,
  debug: { layout: () => ({ viewport: [canvas.clientWidth, canvas.clientHeight], tools: TOOLS.length }) },
};
