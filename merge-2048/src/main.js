// src/main.js — 装配：输入 / 事件分发 / 状态机 / SDK / BGM / 调试契约
import { WORLD } from '../config/game.config.js';
import { createRun, loadBoardValues } from './game/sim.js';
import { bestMove } from './game/ai.js';
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

let state = 'boot';           // boot | title | playing | paused | won | dead
let run = null;
let lastTime = 0;
let bestScore = 0;
let warpSelecting = false;
let warpSel = [];             // 选中的 [[r,c],...]
let touchStart = null;

const ui = createUI(uiRoot, {
  onStart: () => startGame(),
  onResume: () => resumeGame(),
  onRestart: () => startGame(),
  onContinue: () => continueAfterWin(),
  onShare: () => shareResult(),
  onMute: (m) => audio.setMuted(m),
  onHow: () => {},
});
ui.setBest(bestScore);
ui.onTutorial((result) => {
  Sdk.track('tutorial_done', { skipped: !!result?.skipped });
});

// ---------- 音频设置持久化 ----------
function applyAudioSettings() {
  audio.setMuted(!!Sdk.load('muted', false));
  audio.setVolume(Sdk.load('volume', 0.75));
}

// ---------- 画布坐标换算 ----------
function canvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(rect.width / WORLD.WIDTH, rect.height / WORLD.HEIGHT);
  const ox = (rect.width - WORLD.WIDTH * scale) / 2;
  const oy = (rect.height - WORLD.HEIGHT * scale) / 2;
  return { x: (e.clientX - rect.left - ox) / scale, y: (e.clientY - rect.top - oy) / scale };
}

// ---------- 输入 ----------
const DIR_KEYS = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
};

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (state === 'playing') {
    if (DIR_KEYS[e.code]) {
      e.preventDefault();
      if (warpSelecting) exitWarp();
      move(DIR_KEYS[e.code]);
      return;
    }
    if (e.code === 'KeyE') { toggleWarp(); return; }
  }
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'KeyR' && (state === 'dead' || state === 'won')) startGame();
  if (e.code === 'Enter' && state === 'title') startGame();
});

// 触屏滑动
canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (state !== 'playing') return;
  const p = canvasPoint(e);
  if (warpSelecting) {
    handleWarpTap(p);
    return;
  }
  if (e.pointerType === 'touch') touchStart = { x: p.x, y: p.y };
});

canvas.addEventListener('pointerup', (e) => {
  if (state !== 'playing' || warpSelecting || !touchStart || e.pointerType !== 'touch') return;
  const p = canvasPoint(e);
  const dx = p.x - touchStart.x;
  const dy = p.y - touchStart.y;
  touchStart = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return; // 点击不算滑动
  const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
  move(dir);
});

canvas.addEventListener('pointercancel', () => { touchStart = null; });

// ---------- 跃迁选择 ----------
function toggleWarp() {
  if (state !== 'playing') return;
  warpSelecting = !warpSelecting;
  warpSel = [];
  ui.hud.setSelecting(warpSelecting);
  if (warpSelecting) {
    ui.hud.warpBtn.textContent = i18n.get('btn.close');
  } else {
    ui.setHud(run.getHud());
  }
  renderer.setSelection(warpSel);
  audio.event('ui', {});
}

function exitWarp() {
  warpSelecting = false;
  warpSel = [];
  ui.hud.setSelecting(false);
  ui.setHud(run.getHud());
  renderer.setSelection([]);
}

function handleWarpTap(p) {
  const cell = renderer.cellAt(p.x, p.y);
  if (!cell) return;
  const t = run.grid[cell.r][cell.c];
  if (!t) return;
  if (warpSel.length === 0) {
    warpSel = [[cell.r, cell.c]];
  } else if (warpSel.length === 1) {
    const [r0, c0] = warpSel[0];
    if (r0 === cell.r && c0 === cell.c) { warpSel = []; }
    else if (run.grid[r0][c0].value === t.value) {
      move({ warp: [r0, c0, cell.r, cell.c] });
      return;
    } else {
      warpSel = [[cell.r, cell.c]];
    }
  }
  renderer.setSelection(warpSel);
}

function move(action) {
  if (state !== 'playing') return;
  run.step(typeof action === 'string' ? { dir: action } : action);
  const events = run.drainEvents();
  dispatchEvents(events);
  ui.setHud(run.getHud());
  if (run.phase === 'dead') onDeath();
  else if (run.phase === 'won') onWin();
}

// ---------- 事件分发 ----------
function dispatchEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    renderer.onEvent(ev);
    if (state === 'playing') ui.tutorial.onGameEvent(ev);
    if (ev.type === 'merge') Sdk.track('merge', { value: ev.value });
    else if (ev.type === 'warp') Sdk.track('warp', { value: ev.value });
    else if (ev.type === 'gravityLock') Sdk.track('gravityLock', {});
    else if (ev.type === 'levelClear') {
      Sdk.levelCleared({ level: ev.level });
    } else if (ev.type === 'unlock') Sdk.track('unlock', { value: ev.value });
  }
}

// ---------- 游戏流转 ----------
function startGame(levelIndex = 1) {
  audio.unlock();
  run = createRun({ seed: (Date.now() & 0xffff) * 2654435761 >>> 0, levelIndex });
  state = 'playing';
  warpSelecting = false;
  warpSel = [];
  ui.hud.setSelecting(false);
  renderer.setSelection([]);
  lastTime = performance.now();
  ui.show('playing');
  renderer.setRun(run);
  Sdk.newRun({ level: levelIndex });
  applyAudioSettings();
  audio.playBgm();
}

function continueAfterWin() {
  if (state !== 'won') return;
  run.phase = 'playing';
  run.won = true;
  state = 'playing';
  ui.show('playing');
  audio.playBgm();
}

function togglePause() {
  if (state === 'playing') { state = 'paused'; ui.show('paused'); audio.stopBgm(); }
  else if (state === 'paused') { resumeGame(); }
}

function resumeGame() {
  if (state === 'paused') { state = 'playing'; ui.show('playing'); lastTime = performance.now(); audio.playBgm(); }
}

function toTitle() {
  state = 'title';
  run = null;
  warpSelecting = false;
  warpSel = [];
  renderer.setSelection([]);
  ui.show('title');
  renderer.setRun(null);
  audio.stopBgm();
}

function saveBestIfRecord() {
  const score = run?.score ?? 0;
  const isRecord = score > bestScore;
  if (isRecord) {
    bestScore = score;
    Sdk.save('bestScore', bestScore);
  }
  ui.setBest(bestScore);
  return isRecord;
}

function onDeath() {
  state = 'dead';
  const isRecord = saveBestIfRecord();
  ui.show('dead', {
    win: false,
    score: run.score,
    bestTile: run.runBest,
    level: run.levelIndex,
    newRecord: isRecord,
  });
  Sdk.gameOver({ score: run.score, level: run.levelIndex, bestTile: run.runBest });
  Sdk.track('session_end', { result: 'dead' });
  audio.stopBgm();
}

function onWin() {
  state = 'won';
  const isRecord = saveBestIfRecord();
  ui.show('won', {
    win: true,
    score: run.score,
    bestTile: run.runBest,
    level: run.levelIndex,
    newRecord: isRecord,
  });
  Sdk.gameOver({ score: run.score, level: run.levelIndex, bestTile: run.runBest });
  Sdk.track('session_end', { result: 'won' });
  audio.stopBgm();
  audio.event('win', {});
}

async function shareResult() {
  const score = run?.score ?? 0;
  const best = run?.runBest ?? 0;
  await Sdk.share({
    title: 'MERGE 2048',
    text: i18n.lang === 'zh' ? `我在星际殖民地 2048 打到 ${score} 分（最大舰 ${best}t）！` : `I scored ${score} in MERGE 2048 (biggest ship ${best}t)!`,
  });
  Sdk.track('share', { score });
}

// ---------- 主循环（60fps 渲染；玩法为离散回合） ----------
function loop(now) {
  requestAnimationFrame(loop);
  if (state !== 'playing' && state !== 'paused') {
    renderer.draw();
    return;
  }
  lastTime = now;
  renderer.draw();
  ui.setHud(run.getHud());
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
  bestScore = Math.floor(Sdk.load('bestScore', 0)) || 0;
  ui.setBest(bestScore);
  applyAudioSettings();
  await Sdk.ready();
  Sdk.track('load', { lang: i18n.lang });
  if (state === 'boot') { state = 'title'; ui.show('title'); }
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
  startAct: (n) => startGame(n || 1),
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
    layout: () => ({ viewport: [canvas.clientWidth, canvas.clientHeight], board: renderer.debugLayout().board }),
    setBoard: (values, levelIndex) => {
      if (!run) startGame(levelIndex || 1);
      loadBoardValues(run, values);
      renderer.setRun(run);
      ui.setHud(run.getHud());
      run.drainEvents();
    },
    greedyMove: () => {
      if (!run || state !== 'playing') return null;
      const dir = bestMove(run.grid, { rows: run.rows, cols: run.cols, blocked: run.blocked, gravity: run.gravity });
      if (dir) move(dir);
      return dir;
    },
  },
};
