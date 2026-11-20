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
let state = 'boot';             // boot | title | playing | paused | dead | won
let run = null;
let lastTime = 0;
let accumulator = 0;
let aimX = WORLD.WIDTH / 2;
let aimY = 240;
let tier = 1;
let fireUntil = 0;              // 点击/空格后短暂保持开火（tap latch）
let electricQueued = false;
let bestStage = 1;

// ---------- 输入（边沿检测归 main） ----------
const keys = { left: false, right: false, up: false, down: false, space: false };

function canvasToWorld(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(rect.width / WORLD.WIDTH, rect.height / WORLD.HEIGHT);
  const ox = (rect.width - WORLD.WIDTH * scale) / 2;
  const oy = (rect.height - WORLD.HEIGHT * scale) / 2;
  return {
    x: (clientX - rect.left - ox) / scale,
    y: (clientY - rect.top - oy) / scale,
  };
}

function setAim(clientX, clientY) {
  const p = canvasToWorld(clientX, clientY);
  aimX = Math.max(0, Math.min(WORLD.WIDTH, p.x));
  aimY = Math.max(20, Math.min(WORLD.CANNON_Y - 30, p.y));
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;
  if (e.code === 'ArrowUp' || e.code === 'KeyW') keys.up = true;
  if (e.code === 'ArrowDown' || e.code === 'KeyS') keys.down = true;
  if (e.code === 'Space') { keys.space = true; e.preventDefault(); }
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'KeyR' && (state === 'dead' || state === 'won')) startGame();
  if (e.code === 'Enter' && state === 'title') startGame();
  if (e.code === 'KeyE') electricQueued = true;
  if (e.code === 'BracketLeft') changeTier(-1);
  if (e.code === 'BracketRight') changeTier(1);
  if (e.code.startsWith('Digit') || e.code.startsWith('Numpad')) {
    const n = Number(e.code.replace(/\D/g, ''));
    if (n >= 1 && n <= 7) setTier(n);
  }
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
  if (e.code === 'ArrowUp' || e.code === 'KeyW') keys.up = false;
  if (e.code === 'ArrowDown' || e.code === 'KeyS') keys.down = false;
  if (e.code === 'Space') keys.space = false;
});

canvas.addEventListener('pointermove', (e) => {
  setAim(e.clientX, e.clientY);
});
canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  setAim(e.clientX, e.clientY);
  fireUntil = performance.now() + 160; // tap latch
});
canvas.addEventListener('pointerup', () => {});
canvas.addEventListener('pointercancel', () => {});

// ---------- UI ----------
const ui = createUI(uiRoot, {
  onDive: () => startGame(),
  onResume: () => resumeGame(),
  onRestart: () => startGame(),
  onShare: () => shareResult(),
  onHow: () => {},
  onTierChange: (delta) => changeTier(delta),
});
ui.onTutorial((result) => {
  Sdk.track('tutorial_done', { skipped: !!result?.skipped });
});
ui.setBest(bestStage);

function changeTier(delta) {
  setTier(tier + delta);
}
function setTier(n) {
  tier = Math.max(1, Math.min(7, Math.floor(n)));
}

// ---------- 音频设置持久化 ----------
function applyAudioSettings() {
  const muted = Sdk.load('muted', false);
  const vol = Sdk.load('volume', 0.8);
  audio.setMuted(!!muted);
  audio.setVolume(vol);
}

// ---------- 游戏流转 ----------
function startGame(startStage = 1) {
  audio.unlock();
  run = createRun({ seed: (Date.now() & 0xffff) * 2654435761 >>> 0, startStage });
  state = 'playing';
  aimX = WORLD.WIDTH / 2;
  aimY = 240;
  tier = 1;
  fireUntil = 0;
  electricQueued = false;
  accumulator = 0;
  lastTime = performance.now();
  ui.show('playing');
  Sdk.newRun({ zone: startStage });
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
  const stage = stats.maxStageReached || run.stage || 1;
  const isRecord = stage > bestStage;
  if (isRecord) {
    bestStage = stage;
    Sdk.save('bestStage', bestStage);
  }
  ui.setBest(bestStage);
  ui.show('dead', {
    stage,
    revenue: stats.totalRevenue || 0,
    catches: stats.catches || 0,
    best: bestStage,
    won: false,
    newRecord: isRecord,
  });
  Sdk.gameOver({ stage, revenue: stats.totalRevenue || 0, catches: stats.catches || 0 });
  audio.stopBgm();
}

function onWin() {
  state = 'won';
  const stats = run.stats || {};
  const stage = stats.maxStageReached || run.stage || 1;
  const isRecord = stage > bestStage;
  if (isRecord) {
    bestStage = stage;
    Sdk.save('bestStage', bestStage);
  }
  ui.setBest(bestStage);
  ui.show('won', {
    stage,
    revenue: stats.totalRevenue || 0,
    catches: stats.catches || 0,
    best: bestStage,
    won: true,
    newRecord: isRecord,
  });
  Sdk.gameOver({ stage, revenue: stats.totalRevenue || 0, catches: stats.catches || 0, won: true });
  audio.stopBgm();
}

// ---------- 分享 ----------
async function shareResult() {
  const stage = Math.floor(run?.stats?.maxStageReached ?? 0);
  await Sdk.share({
    title: 'FISH FRENZY',
    text: `${i18n.lang === 'zh' ? `我打到了第 ${stage} 场！` : `I cleared ${stage} stages!`} FISH FRENZY`,
  });
  Sdk.track('share', { stage });
}

// ---------- 事件分发 ----------
function dispatchEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);

    if (ev.type === 'shot') renderer.burst(ev.x, ev.y, 'net');
    else if (ev.type === 'netBurst') renderer.burst(ev.x, ev.y, ev.electric ? 'electric' : 'net');
    else if (ev.type === 'catch') {
      renderer.burst(ev.x, ev.y, 'catch');
      renderer.burst(ev.x, ev.y, 'coin');
    } else if (ev.type === 'electricFire') renderer.burst(ev.x, ev.y, 'electric');

    if (state === 'playing') ui.tutorial.onGameEvent(ev, performance.now());

    if (ev.type === 'catch') Sdk.track('catch', { species: ev.species, value: ev.value });
    else if (ev.type === 'stageClear') Sdk.levelCleared({ levelIndex: ev.stage });
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

  // 键盘持续移动瞄准
  if (keys.left) aimX -= 10;
  if (keys.right) aimX += 10;
  if (keys.up) aimY -= 8;
  if (keys.down) aimY += 8;
  aimX = Math.max(0, Math.min(WORLD.WIDTH, aimX));
  aimY = Math.max(20, Math.min(WORLD.CANNON_Y - 30, aimY));

  const fireNow = keys.space || performance.now() < fireUntil;

  let steps = 0;
  while (accumulator >= STEP && steps < 6) {
    const input = {
      aimX,
      aimY,
      fire: fireNow,
      tier,
      electric: electricQueued,
    };
    electricQueued = false;
    run.step(input);
    accumulator -= STEP;
    steps++;
    dispatchEvents(run.drainEvents());
    if (run.phase === 'dead') { onDeath(); return; }
    if (run.phase === 'won') { onWin(); return; }
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
Sdk.onAdEnd(() => { audio.setMuted(!!Sdk.load('muted', false)); });

// ---------- 启动 ----------
(async () => {
  bestStage = Math.floor(Sdk.load('bestStage', 1)) || 1;
  ui.setBest(bestStage);
  applyAudioSettings();
  await Sdk.ready();
  Sdk.track('load', { lang: i18n.lang });
  // 玩家可能在 boot 期间已点 Dive（异步 SDK 加载窗口）；只在还没开局时才显示标题
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
    layout: () => ({ viewport: [canvas.clientWidth, canvas.clientHeight] }),
    // 营销/验收专用：跳过引导 / 指定场次开一局
    setTutorialDone: (v) => { Sdk.save('tutorial-done', !!v); },
    startStage: (n) => { startGame(n || 1); },
  },
};
