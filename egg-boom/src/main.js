// src/main.js — 装配：固定步长 / 输入 / 事件分发 / 状态机 / SDK / 音效（Lead 所有）
import { WORLD, STEP } from '../config/game.config.js';
import { createRun } from './game/sim.js';
import { createRender } from './render/index.js';
import { createUI } from './ui/index.js';
import { createAudio } from './core/audio.js';
import { i18n } from './core/i18n.js';
import Sdk from './core/sdk.js';

const TAP_MS = 150; // 短按（<150ms）= 手动加射；长按 = 蓄力跳

// ---------- 装配 ----------
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
let bestScore = 0;

let spaceDown = false;
let pointerDown = false;
let pointerDownAt = 0;
let manualShotPending = false;
const activePointers = new Set();

// ---------- 输入 ----------
function currentHeld() {
  return spaceDown || (pointerDown && performance.now() - pointerDownAt >= TAP_MS);
}

function updateInputs() {
  return {
    charge: currentHeld(),
    shoot: manualShotPending,
  };
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    spaceDown = true;
    e.preventDefault();
  }
  if (e.code === 'KeyF' || e.code === 'KeyJ') manualShotPending = true;
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'KeyR' && (state === 'dead' || state === 'won')) startGame();
  if (e.code === 'Enter' && state === 'title') startGame();
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'Space') spaceDown = false;
});

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (activePointers.size === 0) {
    pointerDown = true;
    pointerDownAt = performance.now();
  }
  activePointers.add(e.pointerId);
});
canvas.addEventListener('pointerup', (e) => {
  activePointers.delete(e.pointerId);
  if (activePointers.size === 0) {
    if (performance.now() - pointerDownAt < TAP_MS) manualShotPending = true;
    pointerDown = false;
  }
});
canvas.addEventListener('pointercancel', (e) => {
  activePointers.delete(e.pointerId);
  if (activePointers.size === 0) pointerDown = false;
});

// ---------- UI ----------
const ui = createUI(uiRoot, {
  onDive: () => startGame(),
  onResume: () => resumeGame(),
  onRestart: () => startGame(),
  onShare: () => shareResult(),
  onHow: () => { /* 重看引导 */ },
});
ui.onTutorial((result) => {
  Sdk.track('tutorial_done', { skipped: !!result?.skipped });
});
ui.setBest(bestScore);

// ---------- 音频设置 ----------
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
  accumulator = 0;
  lastTime = performance.now();
  spaceDown = false;
  pointerDown = false;
  manualShotPending = false;
  ui.show('playing');
  Sdk.newRun({ zone: 1 });
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

function onEnd(won) {
  state = won ? 'won' : 'dead';
  const stats = run.stats || {};
  const score = Math.floor(stats.score ?? 0);
  const isRecord = score > bestScore;
  if (isRecord) {
    bestScore = score;
    Sdk.save('bestScore', bestScore);
  }
  ui.setBest(bestScore);
  ui.show('dead', {
    score,
    level: won ? 12 : (run.level || 1),
    maxCombo: stats.maxCombo || 0,
    best: bestScore,
    newRecord: isRecord,
    won,
  });
  if (won) Sdk.levelCleared({ score, level: 12 });
  else Sdk.gameOver({ score, level: run.level || 1, maxCombo: stats.maxCombo || 0 });
}

async function shareResult() {
  const score = Math.floor(run?.stats?.score ?? 0);
  await Sdk.share({
    title: 'EGG BOOM',
    text: i18n.lang === 'zh'
      ? `我在 EGG BOOM 打到了 ${score} 分！`
      : `I scored ${score} in EGG BOOM!`,
  });
  Sdk.track('share', { score });
}

// ---------- 事件分发 ----------
function dispatchEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);

    if (ev.type === 'doughBreak') renderer.burst(ev.x, ev.y, 'pop');
    else if (ev.type === 'rackClear') renderer.burst(ev.x, ev.y, 'confetti');
    else if (ev.type === 'yolkFired') { renderer.burst(ev.x, ev.y, 'yolk'); renderer.shakeScreen(); }
    else if (ev.type === 'shellBreak') renderer.shakeScreen();
    else if (ev.type === 'propGain') renderer.burst(ev.x, ev.y, 'pop');

    if (state === 'playing') ui.tutorial.onGameEvent(ev, performance.now());

    if (ev.type === 'levelEnter') Sdk.track('levelEnter', { level: ev.level });
    else if (ev.type === 'rackClear') Sdk.track('rackClear', {});
    else if (ev.type === 'doughBreak') Sdk.track('doughBreak', { combo: ev.combo });
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
    const input = updateInputs();
    run.step(input);
    manualShotPending = false;
    accumulator -= STEP;
    steps++;
    dispatchEvents(run.drainEvents());
    if (run.phase === 'dead') { onEnd(false); return; }
    if (run.phase === 'won') { onEnd(true); return; }
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
  bestScore = Math.floor(Sdk.load('bestScore', 0)) || 0;
  ui.setBest(bestScore);
  applyAudioSettings();
  await Sdk.ready();
  Sdk.track('load', { lang: i18n.lang });
  // boot 竞态守卫：异步 SDK 加载窗口内点 Start 也会被保留
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
    layout: () => ({ viewport: [canvas.clientWidth, canvas.clientHeight], hud: !document.getElementById('hud').classList.contains('hidden') }),
    jumpLevel: (n) => { if (run) run.jumpLevel(n); },
    testJump: () => {
      if (!run) return false;
      const y0 = run.egg.y;
      for (let i = 0; i < 30; i += 1) { run.step({ charge: true }); run.drainEvents(); }
      run.step({ charge: false });
      run.drainEvents();
      for (let i = 0; i < 10; i += 1) { run.step({}); run.drainEvents(); }
      return run.egg.y < y0;
    },
  },
};
