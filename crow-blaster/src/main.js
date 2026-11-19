// src/main.js — 装配：固定步长 / 输入 / 事件分发 / 状态机 / SDK / BGM。
import { STEP, WORLD } from '../config/game.config.js';
import { LAUNCHER, clampAim } from '../config/gameplay.js';
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
let aim = 0;                    // 从竖直方向角度（度）
let pressed = false;
let shootQueued = false;
let bestScore = 0;
let bestLevel = 1;
let bestStars = 0;

// ---------- 坐标转换（canvas → 世界 1280×720） ----------
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

function pointerToAim(clientX, clientY) {
  const w = canvasToWorld(clientX, clientY);
  const dx = w.x - LAUNCHER.X;
  const dy = LAUNCHER.Y - w.y; // 向上为正
  const deg = Math.atan2(dx, dy) * 180 / Math.PI;
  return clampAim(deg);
}

// ---------- 键盘 ----------
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'Enter' && state === 'title') startGame();
  if (e.code === 'ArrowLeft') { aim = clampAim(aim - 3); notifyAim(); }
  if (e.code === 'ArrowRight') { aim = clampAim(aim + 3); notifyAim(); }
  if (e.code === 'Space') {
    if (state === 'playing') { shootQueued = true; e.preventDefault(); }
    else if (state === 'title') startGame();
  }
  if (e.code === 'KeyR') {
    if (state === 'dead' || state === 'won') startGame();
  }
});

// ---------- 指针：瞄准 / 射击（鼠标 hover 瞄准 + 点击发射；触屏拖拽瞄准 + 松开发射） ----------
canvas.addEventListener('pointermove', (e) => {
  aim = pointerToAim(e.clientX, e.clientY);
  if (state === 'playing') notifyAim();
});
canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  aim = pointerToAim(e.clientX, e.clientY);
  pressed = true;
  if (state === 'playing') notifyAim();
});
canvas.addEventListener('pointerup', (e) => {
  aim = pointerToAim(e.clientX, e.clientY);
  if (pressed && state === 'playing') shootQueued = true;
  pressed = false;
});
canvas.addEventListener('pointercancel', () => { pressed = false; });

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
ui.setBest(bestScore, bestLevel, bestStars);

// ---------- 音频设置持久化 ----------
function applyAudioSettings() {
  const muted = Sdk.load('muted', false);
  const vol = Sdk.load('volume', 0.7);
  audio.setMuted(!!muted);
  audio.setVolume(vol);
}

// ---------- 游戏流转 ----------
function startGame() {
  audio.unlock();
  run = createRun({ seed: (Date.now() & 0xffff) * 2654435761 >>> 0 });
  state = 'playing';
  aim = 0;
  pressed = false;
  shootQueued = false;
  accumulator = 0;
  lastTime = performance.now();
  ui.show('playing');
  Sdk.newRun({ level: run.level });
  audio.playBgm();
  applyAudioSettings();
}

function notifyAim() {
  ui.tutorial.onGameEvent({ type: 'aim' }, performance.now());
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
  renderer.draw(null, 1, performance.now());
  audio.stopBgm();
}

function onRunEnd(win) {
  const stats = run.stats || {};
  const score = Math.floor(run.score ?? 0);
  const level = Math.max(1, Math.floor(stats.levelReached ?? run.level ?? 1));
  const stars = Math.floor(run.stars ?? 0);
  const isRecord = score > bestScore;
  if (isRecord) {
    bestScore = score;
    Sdk.save('bestScore', bestScore);
  }
  if (level > bestLevel) {
    bestLevel = level;
    Sdk.save('bestLevel', bestLevel);
  }
  if (stars > bestStars) {
    bestStars = stars;
    Sdk.save('bestStars', bestStars);
  }
  ui.setBest(bestScore, bestLevel, bestStars);

  state = win ? 'won' : 'dead';
  ui.show(win ? 'won' : 'dead', {
    score,
    maxCombo: stats.maxCombo || 0,
    levelReached: level,
    stars,
    best: bestScore,
    newRecord: isRecord,
    win,
  });
  if (win) Sdk.levelCleared({ score, level, stars });
  else Sdk.gameOver({ score, level });
  audio.stopBgm();
}

async function shareResult() {
  const score = Math.floor(run?.score ?? 0);
  await Sdk.share({
    title: 'CROW BLASTER',
    text: i18n.lang === 'zh' ? `我在霓虹夜空得了 ${score} 分！CROW BLASTER` : `I scored ${score} blasting neon crows! CROW BLASTER`,
  });
  Sdk.track('share', { score });
}

// ---------- 事件分发 ----------
function dispatchEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);

    if (ev.type === 'hit' || ev.type === 'tankHit' || ev.type === 'goldenHit' || ev.type === 'ghostHit' || ev.type === 'kill') {
      renderer.burst(ev.x, ev.y, ev.type);
    } else if (ev.type === 'shot') {
      renderer.burst(ev.x, ev.y, 'muzzle');
    }

    if (state === 'playing') ui.tutorial.onGameEvent(ev, performance.now());

    if (ev.type === 'kill') Sdk.track('kill', { kind: ev.kind });
    else if (ev.type === 'goldenHit') Sdk.track('golden', {});
  }
}

// ---------- 主循环 ----------
function loop(now) {
  requestAnimationFrame(loop);

  if (state !== 'playing') {
    renderer.draw(state === 'paused' || state === 'dead' || state === 'won' ? run : null, 1, now);
    return;
  }

  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  accumulator += dt;

  let steps = 0;
  while (accumulator >= STEP && steps < 6) {
    const shoot = shootQueued;
    shootQueued = false;
    run.step({ aim, shoot });
    accumulator -= STEP;
    steps++;
    dispatchEvents(run.drainEvents());
    if (run.phase === 'dead') { onRunEnd(false); return; }
    if (run.phase === 'won') { onRunEnd(true); return; }
  }

  renderer.setAim(run.aim);
  renderer.draw(run, accumulator / STEP, now);
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
// SDK 异步就绪不能阻塞开局：先隐藏 loading 并进入标题屏，SDK 就绪后再打 load 埋点。
(async () => {
  bestScore = Math.floor(Sdk.load('bestScore', 0)) || 0;
  bestLevel = Math.floor(Sdk.load('bestLevel', 1)) || 1;
  bestStars = Math.floor(Sdk.load('bestStars', 0)) || 0;
  ui.setBest(bestScore, bestLevel, bestStars);
  applyAudioSettings();
  if (state === 'boot') { state = 'title'; ui.show('title'); }
  renderer.draw(null, 1, performance.now());
  loadingEl.classList.add('hidden');
  lastTime = performance.now();
  requestAnimationFrame(loop);
  Sdk.ready().then(() => Sdk.track('load', { lang: i18n.lang })).catch(() => {});
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
  startTutorial: () => { startGame(); ui.tutorial.machine.replay(); },
  tutorial: {
    get active() { return ui.tutorial.active; },
    get step() { return ui.tutorial.step; },
    get steps() { return ui.tutorial.steps; },
    get current() { return ui.tutorial.current; },
    skip: () => ui.tutorial.skip(),
  },
  save: () => Sdk.save,
  ui: () => ui,
  debug: { layout: () => ({ viewport: [canvas.clientWidth, canvas.clientHeight], launcher: [LAUNCHER.X, LAUNCHER.Y] }) },
};
