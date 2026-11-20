// src/main.js — NEON PINBALL · 装配：固定步长 / 输入 / 事件分发 / 状态机 / SDK / BGM（Lead 所有）
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

let state = 'boot';
let run = null;
let lastTime = 0;
let accumulator = 0;
let keys = { left: false, right: false, launch: false };
let nudgeFrames = 0;
let nudgeSign = 1;
let bestScore = 0;

// ---------- 输入 ----------
window.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyZ' || e.code === 'KeyA') keys.left = true;
  if (e.code === 'ArrowRight' || e.code === 'KeyM' || e.code === 'KeyD') keys.right = true;
  if (e.code === 'Space') { keys.launch = true; e.preventDefault(); }
  if (e.code === 'KeyN') {
    const b = run?.balls?.find((x) => x.state === 'live');
    nudgeSign = b ? (b.x < 640 ? 1 : -1) : 1;
    nudgeFrames = 4;
  }
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'KeyR' && state === 'dead') startGame();
  if (e.code === 'Enter' && state === 'title') startGame();
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyZ' || e.code === 'KeyA') keys.left = false;
  if (e.code === 'ArrowRight' || e.code === 'KeyM' || e.code === 'KeyD') keys.right = false;
  if (e.code === 'Space') keys.launch = false;
});

// 触屏：左右半屏点按挡板
const touchSides = new Map();
function sideFor(x) { return x < canvas.clientWidth / 2 ? 'left' : 'right'; }
canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (e.pointerType === 'touch') touchSides.set(e.pointerId, sideFor(e.clientX));
});
canvas.addEventListener('pointerup', (e) => touchSides.delete(e.pointerId));
canvas.addEventListener('pointercancel', (e) => touchSides.delete(e.pointerId));

function touchInputs() {
  let l = false, r = false;
  for (const s of touchSides.values()) { if (s === 'left') l = true; else r = true; }
  return { left: keys.left || l, right: keys.right || r };
}

// ---------- UI ----------
const ui = createUI(uiRoot, {
  onStart: () => startGame(),
  onResume: () => resumeGame(),
  onRestart: () => startGame(),
  onShare: () => shareResult(),
  onHow: () => {},
});
ui.onTutorial((result) => {
  Sdk.track('tutorial_done', { skipped: !!result?.skipped });
});
ui.setBest(bestScore);

function applyAudioSettings() {
  audio.setMuted(!!Sdk.load('muted', false));
  audio.setVolume(Sdk.load('volume', 0.8));
}

// ---------- 流转 ----------
function startGame() {
  audio.unlock();
  run = createRun({ seed: (Date.now() & 0xffff) * 2654435761 >>> 0 });
  state = 'playing';
  accumulator = 0;
  lastTime = performance.now();
  ui.show('playing');
  Sdk.newRun({ machine: 1 });
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
  const score = Math.floor(run.score ?? 0);
  const machine = run.machine ?? 1;
  const isRecord = score > bestScore;
  if (isRecord) { bestScore = score; Sdk.save('bestScore', bestScore); }
  ui.setBest(bestScore);
  ui.show('dead', { score, machine, best: bestScore, newRecord: isRecord });
  Sdk.gameOver({ score, machine });
  audio.stopBgm();
  audio.event('gameOver');
}

async function shareResult() {
  const score = Math.floor(run?.score ?? 0);
  await Sdk.share({
    title: 'NEON PINBALL',
    text: `${i18n.lang === 'zh' ? `我在霓虹弹珠打到了 ${score} 分！` : `I scored ${score} in NEON PINBALL!`}`,
  });
  Sdk.track('share', { score });
}

// ---------- 事件分发 ----------
function dispatchEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    if (ev.type === 'bumperHit') renderer.burst(ev.x, ev.y, ev.combo > 5 ? 'gold' : 'pop');
    else if (ev.type === 'superconduct') renderer.burst(640, 360, 'super');
    else if (ev.type === 'superconductLight') renderer.burst(ev.x, ev.y, 'superLight');
    else if (ev.type === 'machineClear') renderer.burst(640, 360, 'gold');

    if (state === 'playing') ui.tutorial.onGameEvent(ev);

    if (ev.type === 'superconduct') Sdk.track('superconduct', { machine: run.machine });
    else if (ev.type === 'machineClear') Sdk.track('win', { machine: run.machine });
  }
}

// ---------- 主循环 ----------
function loop(now) {
  requestAnimationFrame(loop);
  renderer.tick(now);

  if (state !== 'playing') {
    renderer.draw(state === 'paused' || state === 'dead' ? run : null, 1);
    return;
  }

  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  accumulator += dt;

  let steps = 0;
  while (accumulator >= STEP && steps < 6) {
    const t = touchInputs();
    let nudge = 0;
    if (nudgeFrames > 0) { nudge = nudgeSign; nudgeFrames -= 1; }
    run.step({ left: t.left, right: t.right, launch: keys.launch, nudge });
    accumulator -= STEP;
    steps += 1;
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

Sdk.onAdStart(() => audio.setMuted(true));
Sdk.onAdEnd(() => { audio.setMuted(!!Sdk.load('muted', false)); });

// ---------- 启动 ----------
(async () => {
  bestScore = Math.floor(Sdk.load('bestScore', 0)) || 0;
  ui.setBest(bestScore);
  applyAudioSettings();
  await Sdk.ready();
  Sdk.track('load', { lang: i18n.lang });
  // boot 竞态守卫：异步 SDK 加载窗口内玩家点的 Start 不被顶掉
  if (state === 'boot') { state = 'title'; ui.show('title'); }
  renderer.draw(null, 1);
  loadingEl.classList.add('hidden');
  lastTime = performance.now();
  requestAnimationFrame(loop);
})();

// ---------- 标准调试契约 ----------
window.G = { get run() { return run; }, ui, renderer, audio, Sdk, get state() { return state; } };

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
