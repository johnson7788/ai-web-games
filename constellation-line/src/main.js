// src/main.js — 装配：固定步长 / 输入 / 事件分发 / 状态机 / SDK / BGM（Lead 所有）
import { STEP, WORLD } from '../config/game.config.js';
import { INPUT } from '../config/gameplay.js';
import { LEVEL_COUNT } from '../config/levels.js';
import { createRun, flattenLevel } from './game/sim.js';
import { edgeKey } from './game/euler.js';
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
let state = 'boot';           // boot | title | playing | paused | won | failed
let run = null;
let lastTime = 0;
let accumulator = 0;
let levelIndex = 0;           // 当前要玩的关卡（0-based）
let progress = 0;             // 已通关数（持久化）
let starsArr = [];
let bestArr = [];
let bestScore = 0;            // 当前关卡历史最佳
let pointerDown = false;
let dragging = false;
let lastHover = null;

// ---------- 存档（只经 Sdk） ----------
function loadSave() {
  progress = Math.max(0, Math.floor(Sdk.load('progress', 0) || 0));
  starsArr = Sdk.load('stars', []) || [];
  if (!Array.isArray(starsArr)) starsArr = [];
  bestArr = Sdk.load('best', []) || [];
  if (!Array.isArray(bestArr)) bestArr = [];
  bestScore = Math.round(bestArr[levelIndex] || 0);
}

function persistProgress() {
  Sdk.save('progress', progress);
  Sdk.save('stars', starsArr);
  Sdk.save('best', bestArr);
}

function totalStars() {
  return starsArr.reduce((s, v) => s + (Number(v) || 0), 0);
}

// ---------- 音频设置持久化 ----------
function applyAudioSettings() {
  const muted = Sdk.load('muted', false);
  const vol = Sdk.load('volume', 0.8);
  audio.setMuted(!!muted);
  audio.setVolume(vol);
}

// ---------- 游戏流转 ----------
function startLevel(idx) {
  audio.unlock();
  idx = Math.max(0, Math.min(LEVEL_COUNT - 1, idx));
  levelIndex = idx;
  bestScore = Math.round(bestArr[levelIndex] || 0);
  run = createRun({ levelIndex, seed: (Date.now() & 0xffff) * 2654435761 >>> 0 });
  state = 'playing';
  pointerDown = false;
  dragging = false;
  lastHover = null;
  accumulator = 0;
  lastTime = performance.now();
  ui.show('playing');
  Sdk.newRun({ level: levelIndex + 1 });
  audio.playBgm('bgm');
  applyAudioSettings();
}

function startGame() {
  levelIndex = Math.max(0, Math.min(LEVEL_COUNT - 1, progress));
  startLevel(levelIndex);
}

function restartLevel() {
  startLevel(levelIndex);
}

function nextLevel() {
  startLevel(Math.min(LEVEL_COUNT - 1, levelIndex + 1));
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
  levelIndex = Math.max(0, Math.min(LEVEL_COUNT - 1, progress));
  ui.show('title');
  ui.setBest(totalStars(), progress, LEVEL_COUNT);
  renderer.draw(null, performance.now());
  audio.stopBgm();
}

// ---------- 胜利 / 失败 ----------
function onWin() {
  state = 'won';
  const stats = run.stats;
  const prevBest = starsArr[levelIndex] || 0;
  const isRecord = stats.stars > prevBest;
  if (isRecord) starsArr[levelIndex] = stats.stars;
  const prevScore = bestArr[levelIndex] || 0;
  const isScoreRecord = stats.score > prevScore;
  if (isScoreRecord) bestArr[levelIndex] = stats.score;
  progress = Math.max(progress, levelIndex + 1);
  persistProgress();
  bestScore = Math.round(bestArr[levelIndex] || 0);
  ui.setResult({
    won: true,
    stars: stats.stars,
    score: stats.score,
    time: stats.time,
    steps: stats.steps,
    mistakes: stats.mistakes,
    best: bestScore,
    newRecord: isScoreRecord,
  });
  ui.show('won');
  Sdk.levelCleared({ level: levelIndex + 1, stars: stats.stars, score: stats.score });
  audio.stopBgm();
  renderer.burst(WORLD.WIDTH / 2, WORLD.HEIGHT / 2, 'win');
}

function onFail() {
  state = 'failed';
  ui.setResult({
    won: false,
    time: run.time,
    steps: run.steps,
    mistakes: run.mistakes,
    score: 0,
    stars: 0,
    best: bestScore,
    newRecord: false,
  });
  ui.show('failed');
  Sdk.gameOver({ level: levelIndex + 1, reason: 'timeout' });
  audio.stopBgm();
}

// ---------- 分享 ----------
async function shareResult() {
  const lv = run ? run.levelIndex + 1 : levelIndex + 1;
  await Sdk.share({
    title: 'CONSTELLATION LINE',
    text: i18n.lang === 'zh'
      ? `我点亮了第 ${lv} 座星座！来试试星座连线。`
      : `I lit constellation ${lv}! Try CONSTELLATION LINE.`,
  });
  Sdk.track('share', { level: lv });
}

// ---------- 输入（canvas 命中检测 → 拖动/点击连线） ----------
function canvasToLogical(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const sx = WORLD.PLAY_W / (rect.width || 1);
  const sy = WORLD.PLAY_H / (rect.height || 1);
  const x = (clientX - rect.left) * sx + WORLD.PLAY_X;
  const y = (clientY - rect.top) * sy + WORLD.PLAY_Y;
  return { x, y };
}

function hitStar(clientX, clientY) {
  if (!run || !run.nodes) return null;
  const p = canvasToLogical(clientX, clientY);
  // 把画布坐标转回逻辑坐标（renderer 的逆变换）
  const scale = renderer.scale;
  const flat = flattenLevel(run.level);
  // 直接从画布坐标用屏幕距离判定，避免两次变换误差
  let best = null;
  let bestD = INPUT.HIT_RADIUS * renderer.scale * 1.6;
  for (let i = 0; i < run.nodes.length; i += 1) {
    const c = renderer.toCanvas(run.nodes[i].x, run.nodes[i].y);
    const d = Math.hypot(c.x - p.x, c.y - p.y);
    if (d < bestD) { bestD = d; best = i; }
  }
  void scale; void flat;
  return best;
}

function attemptTo(gi) {
  if (gi == null || run.phase !== 'playing') return;
  run.step({ to: gi });
  flushRun();
}

function flushRun() {
  dispatchEvents(run.drainEvents());
  if (run.phase === 'won') onWin();
  else if (run.phase === 'failed') onFail();
  ui.setHud(run.getHud());
}

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (state !== 'playing' || !run) return;
  pointerDown = true;
  dragging = true;
  run.beginSegment();
  const gi = hitStar(e.clientX, e.clientY);
  lastHover = gi;
  if (gi != null && gi !== run.current) attemptTo(gi);
});

canvas.addEventListener('pointermove', (e) => {
  if (state !== 'playing' || !run || !dragging) return;
  const gi = hitStar(e.clientX, e.clientY);
  if (gi === lastHover) return;
  lastHover = gi;
  if (gi == null || gi === run.current) return;
  // 拖动：只对「当前点相邻」的星做尝试（有效边=走；已用边=走错重置），不相邻忽略
  const key = edgeKey(run.current, gi);
  const edge = run.edges.find((ed) => ed.key === key);
  if (edge) attemptTo(gi);
});

canvas.addEventListener('pointerup', () => {
  pointerDown = false;
  dragging = false;
  lastHover = null;
  if (run && run.phase === 'playing') run.endSegment();
});
canvas.addEventListener('pointercancel', () => {
  pointerDown = false;
  dragging = false;
  lastHover = null;
  if (run && run.phase === 'playing') run.endSegment();
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'Enter') {
    if (state === 'title') startGame();
    else if (state === 'won') nextLevel();
    else if (state === 'failed') restartLevel();
  }
  if (e.code === 'KeyR' && (state === 'won' || state === 'failed')) restartLevel();
});

// ---------- UI ----------
const ui = createUI(uiRoot, {
  onStart: () => startGame(),
  onResume: () => resumeGame(),
  onRestart: () => restartLevel(),
  onNext: () => nextLevel(),
  onShare: () => shareResult(),
  onHow: () => { /* 重看引导 */ },
});
ui.onTutorial((result) => {
  Sdk.track('tutorial_done', { skipped: !!result?.skipped });
});

// ---------- 事件分发 ----------
function dispatchEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);

    if (ev.type === 'edge') {
      const n = run.nodes[ev.to];
      const p = renderer.toCanvas(n.x, n.y);
      renderer.burst(p.x, p.y, 'edge');
    } else if (ev.type === 'win') {
      renderer.burst(WORLD.WIDTH / 2, WORLD.HEIGHT / 2, 'win');
    }

    if (state === 'playing') ui.tutorial.onGameEvent(ev, performance.now());

    if (ev.type === 'win') Sdk.track('win', { level: levelIndex + 1, stars: ev.stars });
    else if (ev.type === 'fail') Sdk.track('fail', { level: levelIndex + 1 });
    else if (ev.type === 'waypoint') Sdk.track('waypoint', { level: levelIndex + 1 });
  }
}

// ---------- 主循环 ----------
function loop(now) {
  requestAnimationFrame(loop);

  if (state === 'playing') {
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;
    accumulator += dt;
    let steps = 0;
    while (accumulator >= STEP && steps < 6) {
      run.step({});
      accumulator -= STEP;
      steps++;
      dispatchEvents(run.drainEvents());
      if (run.phase === 'won') { onWin(); break; }
      if (run.phase === 'failed') { onFail(); break; }
    }
    if (run && run.phase === 'playing') {
      ui.setHud(run.getHud());
      ui.tutorial.tick(performance.now());
    }
    renderer.draw(run, now);
  } else if (state === 'paused' || state === 'won' || state === 'failed') {
    renderer.draw(run, now);
  } else {
    renderer.draw(null, now);
  }
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
  loadSave();
  levelIndex = Math.max(0, Math.min(LEVEL_COUNT - 1, progress));
  ui.setBest(totalStars(), progress, LEVEL_COUNT);
  applyAudioSettings();
  await Sdk.ready();
  Sdk.track('load', { lang: i18n.lang });
  // boot 竞态守卫：异步 SDK 加载期间玩家可能已点 Start；只在还没开局时才显示标题
  if (state === 'boot') { state = 'title'; ui.show('title'); }
  renderer.draw(null, performance.now());
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
  get levelIndex() { return levelIndex; },
  start: startGame,
  pause: togglePause,
  resume: resumeGame,
  restart: toTitle,
  retry: restartLevel,
  next: nextLevel,
  jump: (i) => startLevel(i),
  save: (k, v) => Sdk.save(k, v),
  ui: () => ui,
  tutorial: {
    get active() { return ui.tutorial.active; },
    get step() { return ui.tutorial.step; },
    get steps() { return ui.tutorial.steps; },
    get current() { return ui.tutorial.current; },
    skip: () => ui.tutorial.skip(),
  },
  debug: { layout: () => ({ viewport: [canvas.clientWidth, canvas.clientHeight], levelIndex }) },
};
