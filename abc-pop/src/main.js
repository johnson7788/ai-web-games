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
let state = 'boot';             // boot | title | playing | paused | result
let run = null;
let lastTime = 0;
let accumulator = 0;
let tapQueue = [];
let bestScore = 0;
let bestStreak = 0;
let bgmScene = null;

// ---------- 输入（点击泡泡；触屏同） ----------
function canvasToWorld(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(rect.width / WORLD.WIDTH, rect.height / WORLD.HEIGHT);
  const ox = (rect.width - WORLD.WIDTH * scale) / 2;
  const oy = (rect.height - WORLD.HEIGHT * scale) / 2;
  return { x: (clientX - rect.left - ox) / scale, y: (clientY - rect.top - oy) / scale };
}

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  const w = canvasToWorld(e.clientX, e.clientY);
  if (state === 'playing') tapQueue.push(w);
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'Enter' && state === 'title') startGame();
});
window.addEventListener('keyup', () => {});

// ---------- UI ----------
const ui = createUI(uiRoot, {
  onPlay: () => startGame(),
  onResume: () => resumeGame(),
  onRestart: () => toTitle(),
  onShare: () => shareResult(),
});
ui.onTutorial((result) => {
  Sdk.track('tutorial_done', { skipped: !!result?.skipped });
});
ui.setBest(bestScore);

// ---------- 音频设置持久化（只走 Sdk） ----------
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
  tapQueue = [];
  accumulator = 0;
  lastTime = performance.now();
  ui.show('playing');
  Sdk.newRun({ zone: 1 });
  applyAudioSettings();
  setBgm(run.getHud().scene);
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
  renderer.draw(null);
  audio.stopBgm();
  bgmScene = null;
  Sdk.track('restart', {});
}

function onCleared() {
  state = 'result';
  const stats = run.getHud();
  const score = stats.score;
  const isRecord = score > bestScore;
  if (isRecord) {
    bestScore = score;
    Sdk.save('bestScore', bestScore);
  }
  bestStreak = Math.max(stats.maxStreak, Sdk.load('bestStreak', 0));
  Sdk.save('bestStreak', bestStreak);
  ui.setBest(bestScore);
  ui.show('result', { score, maxStreak: stats.maxStreak });
  Sdk.track('cleared', { score, maxStreak: stats.maxStreak });
  audio.stopBgm();
  bgmScene = null;
}

// ---------- BGM 切换 ----------
function setBgm(scene) {
  if (bgmScene === scene) return;
  bgmScene = scene;
  audio.playBgm(scene);
}

async function shareResult() {
  const score = Math.floor(run?.getHud?.().score ?? 0);
  await Sdk.share({
    title: 'ABC POP',
    text: i18n.lang === 'zh' ? `我在 ABC POP 点破了 ${score} 个字母泡泡！` : `I popped ${score} letter bubbles in ABC POP!`,
  });
  Sdk.track('share', { score });
}

// ---------- 事件分发 ----------
function dispatchEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);

    if (ev.type === 'bubblePop') {
      const hue = ((ev.letter || 'A').toUpperCase().charCodeAt(0) - 65) * 137.5 % 360;
      renderer.burst(ev.x, ev.y, `hsl(${hue}, 90%, 62%)`);
    } else if (ev.type === 'bubbleMiss') {
      renderer.burst(ev.x, ev.y, 'rgba(120,120,120,0.8)');
    } else if (ev.type === 'bridge') {
      renderer.flashBridge();
    }

    if (state === 'playing') ui.tutorial.onGameEvent(ev);

    if (ev.type === 'bridge') Sdk.track('bridge', { streak: ev.streak });
    else if (ev.type === 'roundClear') Sdk.track('roundClear', { level: ev.level });
    else if (ev.type === 'letterClear') {
      Sdk.track('letterClear', { letter: ev.letter });
      Sdk.levelCleared({ letter: ev.letter });
    }
  }
}

// ---------- 主循环 ----------
function loop(now) {
  requestAnimationFrame(loop);

  if (state !== 'playing') {
    renderer.draw(state === 'paused' ? run : null);
    return;
  }

  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  accumulator += dt;

  let steps = 0;
  while (accumulator >= STEP && steps < 6) {
    const tap = tapQueue.length ? tapQueue.shift() : null;
    run.step({ tap });
    accumulator -= STEP;
    steps++;
    dispatchEvents(run.drainEvents());
    if (run.phase === 'cleared') { onCleared(); return; }
  }

  const hud = run.getHud();
  setBgm(hud.scene);
  renderer.draw(run);
  ui.setHud(hud);
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
  bestScore = Math.floor(Sdk.load('bestScore', 0)) || 0;
  bestStreak = Math.floor(Sdk.load('bestStreak', 0)) || 0;
  ui.setBest(bestScore);
  applyAudioSettings();
  await Sdk.ready();
  Sdk.track('load', { lang: i18n.lang });
  // boot 竞态守卫：玩家可能在 boot 期间已点 Play，只在还没开局时才显示标题
  if (state === 'boot') { state = 'title'; ui.show('title'); }
  renderer.draw(null);
  loadingEl.classList.add('hidden');
  lastTime = performance.now();
  requestAnimationFrame(loop);
})();

window.addEventListener('beforeunload', () => {
  try { Sdk.track('session_end', { score: run?.getHud?.().score ?? 0 }); } catch { /* noop */ }
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
  debug: {
    layout: () => ({ viewport: [canvas.clientWidth, canvas.clientHeight] }),
    jump: (letterIndex, round = 0) => { if (run && state === 'playing') run.jump(letterIndex, round); },
  },
};
