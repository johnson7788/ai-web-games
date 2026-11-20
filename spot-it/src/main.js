// src/main.js — 装配：固定步长 / 输入（手电扫动 + 点击拾取）/ 事件分发 / 状态机 / SDK / BGM。
import { STEP, WORLD } from '../config/game.config.js';
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

let state = 'boot';             // boot | title | playing | paused | result
let run = null;
let lastTime = 0;
let accumulator = 0;
let pointerX = WORLD.WIDTH / 2;
let pointerY = WORLD.HEIGHT / 2;
let pendingClick = null;
let sweepMoved = false;
let bestLevel = 1;
let bestScore = 0;
let bgmMode = 'none';

// ---------- 输入：世界坐标换算（letterbox） ----------
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

canvas.addEventListener('pointermove', (e) => {
  const p = canvasToWorld(e.clientX, e.clientY);
  pointerX = p.x;
  pointerY = p.y;
  if (state === 'playing') sweepMoved = true;
});
canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  const p = canvasToWorld(e.clientX, e.clientY);
  pointerX = p.x;
  pointerY = p.y;
  if (state === 'playing') pendingClick = { x: p.x, y: p.y };
});

// 键盘
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  else if (e.code === 'Enter' && state === 'title') startGame();
  else if (e.code === 'KeyR' && state === 'result') startGame();
});

// ---------- UI ----------
const ui = createUI(uiRoot, {
  onStart: () => startGame(),
  onResume: () => resumeGame(),
  onRestart: () => startGame(),
  onShare: () => shareResult(),
  onHow: () => { /* 重看引导：overlay 已在 replay() 里显示 */ },
});
ui.onTutorial((result) => {
  Sdk.track('tutorial_done', { skipped: !!result?.skipped });
});
ui.setBest(bestLevel, bestScore);

// ---------- 音频设置持久化 ----------
function applyAudioSettings() {
  const muted = Sdk.load('audioMuted', false);
  const vol = Sdk.load('audioVolume', 0.7);
  audio.setMuted(!!muted);
  audio.setVolume(vol);
}

// ---------- 流转 ----------
function startGame() {
  audio.unlock();
  run = createRun({ seed: (Date.now() & 0xffff) * 2654435761 >>> 0 });
  state = 'playing';
  pointerX = WORLD.WIDTH / 2;
  pointerY = WORLD.HEIGHT / 2;
  pendingClick = null;
  accumulator = 0;
  lastTime = performance.now();
  ui.show('playing');
  Sdk.newRun({ level: 1 });
  setBgm('play');
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
  setBgm('menu');
}

function onEnd(won) {
  state = 'result';
  const stats = run.stats || {};
  const level = run.level || 1;
  const score = Math.floor(run.score || 0);
  const isRecord = score > bestScore || level > bestLevel;
  if (isRecord) {
    if (level > bestLevel) bestLevel = level;
    if (score > bestScore) bestScore = score;
    Sdk.save('bestLevel', bestLevel);
    Sdk.save('bestScore', bestScore);
  }
  ui.setBest(bestLevel, bestScore);
  ui.show('result', { won, level, score, newRecord: isRecord });
  if (won) {
    Sdk.levelCleared({ level, score });
    Sdk.track('win', { level, score });
  } else {
    Sdk.gameOver({ level, score });
  }
  Sdk.track('session_end', { won, level, score });
  setBgm('none');
}

async function shareResult() {
  const level = run ? run.level : bestLevel;
  const score = run ? Math.floor(run.score || 0) : bestScore;
  await Sdk.share({
    title: 'SPOT IT',
    text: i18n.lang === 'zh'
      ? `我在深夜跳蚤市场找齐到了第 ${level} 关，${score} 分！`
      : `I lit up the flea market to level ${level} with ${score} points!`,
  });
  Sdk.track('share', { level, score });
}

function setBgm(mode) {
  if (bgmMode === mode) return;
  bgmMode = mode;
  if (mode === 'play') audio.playBgm('play');
  else if (mode === 'menu') audio.playBgm('menu');
  else audio.stopBgm();
}

// ---------- 事件分发 ----------
function dispatchEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);

    if (ev.type === 'find') renderer.burst(ev.x, ev.y);
    if (ev.type === 'levelClear') {
      renderer.lightUp(run?.levelData?.scenePack ?? 0);
      Sdk.levelCleared({ level: ev.level, score: ev.score });
    }
    if (ev.type === 'decoy') Sdk.track('decoy', { level: run?.level, itemId: ev.itemId });
    if (ev.type === 'find') Sdk.track('find', { level: run?.level, streak: ev.streak });

    if (state === 'playing') ui.tutorial.onGameEvent(ev);
  }
}

// ---------- 主循环 ----------
function loop(now) {
  requestAnimationFrame(loop);

  if (state !== 'playing') {
    renderer.draw(state === 'paused' || state === 'result' ? run : null, { x: pointerX, y: pointerY }, 1);
    return;
  }

  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  accumulator += dt;

  let steps = 0;
  while (accumulator >= STEP && steps < 6) {
    const input = {};
    if (pendingClick) {
      input.click = pendingClick;
      pendingClick = null;
    }
    run.step(input);
    accumulator -= STEP;
    steps++;
    if (sweepMoved) {
      ui.tutorial.onGameEvent({ type: 'sweep' });
      sweepMoved = false;
    }
    dispatchEvents(run.drainEvents());
    if (run.phase === 'won') { onEnd(true); return; }
    if (run.phase === 'failed') { onEnd(false); return; }
  }

  const hud = run.getHud();
  renderer.draw(run, { x: pointerX, y: pointerY }, accumulator / STEP);
  ui.setHud(hud);
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
  bestLevel = Math.max(1, Math.floor(Sdk.load('bestLevel', 1)) || 1);
  bestScore = Math.max(0, Math.floor(Sdk.load('bestScore', 0)) || 0);
  ui.setBest(bestLevel, bestScore);
  applyAudioSettings();
  await Sdk.ready();
  Sdk.track('load', { lang: i18n.lang });
  if (state === 'boot') { state = 'title'; ui.show('title'); }
  renderer.draw(null, { x: pointerX, y: pointerY }, 1);
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
  },
};
