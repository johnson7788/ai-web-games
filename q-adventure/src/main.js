// src/main.js — 装配：固定步长 / 输入 / 事件分发 / 状态机 / SDK / BGM（Lead 所有）
import { STEP } from '../config/game.config.js';
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
const btnLeft = document.getElementById('btn-left');
const btnRight = document.getElementById('btn-right');
const btnJump = document.getElementById('btn-jump');

const renderer = createRender(canvas);
const audio = createAudio();

// ---------- 状态 ----------
let state = 'boot';             // boot | title | playing | paused | dead | won
let run = null;
let lastTime = 0;
let accumulator = 0;
let bestStars = 0;

// ---------- 输入 ----------
const keys = { left: false, right: false };
const touch = { left: false, right: false };
let jumpQueued = false;
let jumpHeld = false;
let movedSignal = false;

function leftActive() { return keys.left || touch.left; }
function rightActive() { return keys.right || touch.right; }

window.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
    e.preventDefault();
    if (!jumpHeld) jumpQueued = true;
    jumpHeld = true;
  }
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'KeyR' && (state === 'dead' || state === 'won')) startGame();
  if (e.code === 'Enter' && state === 'title') startGame();
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') jumpHeld = false;
});

function bindHold(el, setter) {
  if (!el) return;
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); audio.unlock(); setter(true); });
  el.addEventListener('pointerup', () => setter(false));
  el.addEventListener('pointercancel', () => setter(false));
  el.addEventListener('pointerleave', () => setter(false));
}
bindHold(btnLeft, (v) => { touch.left = v; });
bindHold(btnRight, (v) => { touch.right = v; });
if (btnJump) {
  btnJump.addEventListener('pointerdown', (e) => { e.preventDefault(); audio.unlock(); if (!jumpHeld) jumpQueued = true; jumpHeld = true; });
  btnJump.addEventListener('pointerup', () => { jumpHeld = false; });
  btnJump.addEventListener('pointercancel', () => { jumpHeld = false; });
}

// 触屏按钮显示（非精确指针 / 触屏设备）
const coarsePointer = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || (navigator.maxTouchPoints > 0);
if (coarsePointer) {
  btnLeft.hidden = false;
  btnRight.hidden = false;
  if (btnJump) btnJump.hidden = false;
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
ui.setBest(bestStars);

function applyAudioSettings() {
  const muted = Sdk.load('audioMuted', false);
  const vol = Sdk.load('audioVolume', 0.7);
  audio.setMuted(!!muted);
  audio.setVolume(vol);
}

// ---------- 游戏流转 ----------
function startGame(level = 1) {
  audio.unlock();
  run = createRun({ seed: (Date.now() & 0xffff) * 2654435761 >>> 0, level });
  state = 'playing';
  jumpQueued = false;
  jumpHeld = false;
  accumulator = 0;
  lastTime = performance.now();
  ui.show('playing');
  Sdk.newRun({ level });
  setBgmForPack(run.level.pack);
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
  setBgm('bgmTitle');
}

function onRunEnd(win) {
  state = win ? 'won' : 'dead';
  const stats = run.stats || {};
  const stars = Math.floor(stats.stars ?? 0);
  const isRecord = stars > bestStars;
  if (isRecord) {
    bestStars = stars;
    Sdk.save('bestStars', bestStars);
  }
  ui.setBest(bestStars);
  ui.show(win ? 'won' : 'dead', {
    win,
    level: run.levelIndex,
    stars,
    coins: Math.floor(stats.coins ?? 0),
    best: bestStars,
    newRecord: isRecord,
  });
  if (win) {
    Sdk.levelCleared({ level: run.levelIndex, stars });
    Sdk.track('win', { level: run.levelIndex });
  } else {
    Sdk.gameOver({ level: run.levelIndex, stars, coins: Math.floor(stats.coins ?? 0) });
  }
  setBgm('bgmTitle');
}

async function shareResult() {
  const stars = Math.floor(run?.stats?.stars ?? 0);
  await Sdk.share({
    title: 'Q ADVENTURE',
    text: i18n.lang === 'zh' ? `我在 Q ADVENTURE 收集了 ${stars} 颗星星！` : `I collected ${stars} stars in Q ADVENTURE!`,
  });
  Sdk.track('share', { stars });
}

// ---------- BGM ----------
function setBgmForPack(pack) {
  const name = pack === 2 ? 'bgmCloud' : pack === 3 ? 'bgmNight' : 'bgmCandy';
  setBgm(name);
}
let bgmName = null;
function setBgm(name) {
  if (bgmName === name) return;
  bgmName = name;
  audio.stopBgm();
  audio.playBgm(name);
}

// ---------- 事件分发 ----------
function dispatchEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);

    if (ev.type === 'coinGet') renderer.burst(ev.x, ev.y, 'coin');
    else if (ev.type === 'starGet') renderer.burst(ev.x, ev.y, 'star');
    else if (ev.type === 'stomp' || ev.type === 'enemyDefeat') renderer.burst(ev.x, ev.y, 'stomp');
    else if (ev.type === 'beatJump') renderer.burst(ev.x, ev.y, 'beat');
    else if (ev.type === 'death') renderer.burst(ev.x ?? 640, ev.y ?? 360, 'death');

    if (state === 'playing') ui.tutorial.onGameEvent(ev);

    if (ev.type === 'levelClear') {
      ui.screens.showBanner(i18n.get('banner.clear'));
      Sdk.levelCleared({ level: ev.level, stars: ev.stars });
      Sdk.track('levelClear', { level: ev.level });
      setBgmForPack(run ? run.level.pack : 1);
    } else if (ev.type === 'gameComplete') {
      ui.screens.showBanner(i18n.get('banner.complete'));
      Sdk.track('win', { level: 12 });
    } else if (ev.type === 'coinGet') Sdk.track('coinGet', {});
    else if (ev.type === 'starGet') Sdk.track('starGet', {});
    else if (ev.type === 'goalReached') Sdk.track('goalReached', { level: ev.level });
    else if (ev.type === 'stomp') Sdk.track('stomp', {});
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
    const input = { left: leftActive(), right: rightActive(), jump: jumpQueued };
    jumpQueued = false;
    run.step(input);
    accumulator -= STEP;
    steps++;

    if ((leftActive() || rightActive()) && Math.abs(run.player.vx) > 4) movedSignal = true;
    if (movedSignal) {
      ui.tutorial.onGameEvent({ type: 'move' });
      movedSignal = false;
    }
    dispatchEvents(run.drainEvents());
    if (run.phase === 'dead') { onRunEnd(false); return; }
    if (run.phase === 'won') { onRunEnd(true); return; }
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
Sdk.onAdEnd(() => { audio.setMuted(!!Sdk.load('audioMuted', false)); });

// ---------- 启动 ----------
(async () => {
  bestStars = Math.floor(Sdk.load('bestStars', 0)) || 0;
  ui.setBest(bestStars);
  applyAudioSettings();
  await Sdk.ready();
  Sdk.track('load', { lang: i18n.lang });
  // 玩家可能在 boot 期间已点 Start（异步 SDK 加载窗口）；只在还没开局时才显示标题
  if (state === 'boot') { state = 'title'; ui.show('title'); }
  setBgm('bgmTitle');
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
  start: () => startGame(),
  startLevel: (n) => startGame(n),
  startAct: (n) => startGame(n),
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
  debug: { layout: () => ({ viewport: [canvas.clientWidth, canvas.clientHeight], touch: !btnLeft.hidden, jump: !btnJump.hidden }) },
};
