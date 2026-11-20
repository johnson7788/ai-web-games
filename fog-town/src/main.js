// src/main.js — 装配：固定步长 / 输入 / 事件分发 / 状态机 / SDK / 音频（Lead 所有）
import { STEP, WORLD } from '../config/game.config.js';
import { GRID, ratingOf } from '../config/gameplay.js';
import { createRun } from './game/sim.js';
import { greedyDir } from './game/mapgen.js';
import { createRender } from './render/index.js';
import { createUI } from './ui/index.js';
import { createAudio } from './core/audio.js';
import { i18n } from './core/i18n.js';
import Sdk from './core/sdk.js';

// ---------- 装配 ----------
const canvas = document.getElementById('canvas');
const uiRoot = document.getElementById('ui-root');
const btnEcho = document.getElementById('btn-echo');
const loadingEl = document.getElementById('loading');

const renderer = createRender(canvas);
const audio = createAudio();

// 棋盘布局（与 render/index.js 一致，供指针→格子映射）
const CELL = GRID.CELL;
const GW = GRID.COLS * CELL;
const GH = GRID.ROWS * CELL;
const OX = (WORLD.WIDTH - GW) / 2;
const OY = Math.max(52, (WORLD.HEIGHT - GH) / 2);

// ---------- 状态 ----------
let state = 'boot';             // boot | title | playing | paused | dead | won
let run = null;
let lastTime = 0;
let accumulator = 0;
let pendingDir = null;
let pendingEcho = false;
let bestBlock = 1;

// ---------- 输入（边沿检测归 main） ----------
window.addEventListener('keydown', (e) => {
  const dir = dirForCode(e.code);
  if (dir) {
    if (state === 'playing') pendingDir = dir;
    e.preventDefault();
  }
  if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') {
    if (state === 'playing') { pendingEcho = true; e.preventDefault(); }
    else if (state === 'title') startGame();
  }
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'KeyR' && (state === 'dead' || state === 'won')) startGame();
});

function dirForCode(code) {
  if (code === 'ArrowUp' || code === 'KeyW') return 'up';
  if (code === 'ArrowDown' || code === 'KeyS') return 'down';
  if (code === 'ArrowLeft' || code === 'KeyA') return 'left';
  if (code === 'ArrowRight' || code === 'KeyD') return 'right';
  return null;
}

function canvasToCell(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(rect.width / WORLD.WIDTH, rect.height / WORLD.HEIGHT);
  const ox = (rect.width - WORLD.WIDTH * scale) / 2;
  const oy = (rect.height - WORLD.HEIGHT * scale) / 2;
  const wx = (clientX - rect.left - ox) / scale;
  const wy = (clientY - rect.top - oy) / scale;
  return { x: Math.floor((wx - OX) / CELL), y: Math.floor((wy - OY) / CELL) };
}

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (state !== 'playing') return;
  const cell = canvasToCell(e.clientX, e.clientY);
  if (run) {
    const dx = cell.x - run.player.x;
    const dy = cell.y - run.player.y;
    if (Math.abs(dx) + Math.abs(dy) === 1) {
      pendingDir = (dx === 1 ? 'right' : dx === -1 ? 'left' : dy === 1 ? 'down' : 'up');
    }
  }
});

if (window.matchMedia && matchMedia('(pointer: coarse)').matches) btnEcho.hidden = false;
btnEcho.addEventListener('pointerdown', (e) => { e.preventDefault(); audio.unlock(); if (state === 'playing') pendingEcho = true; });

// ---------- UI ----------
const ui = createUI(uiRoot, {
  onStart: () => startGame(),
  onResume: () => resumeGame(),
  onRestart: () => startGame(),
  onShare: () => shareResult(),
  onHow: () => { /* 重看引导 */ },
});
ui.onTutorial((result) => {
  Sdk.track('tutorial_done', { skipped: !!result?.skipped });
});
ui.setBest(bestBlock);

// ---------- 音频设置持久化 ----------
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
  pendingDir = null;
  pendingEcho = false;
  accumulator = 0;
  lastTime = performance.now();
  ui.show('playing');
  Sdk.newRun({ zone: 1 });
  applyAudioSettings();
  audio.playBgm('main');
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

function stateForRun() {
  return { player: run.player, keyCollected: run.keyCollected, leverOn: run.leverOn, cluesCollected: run.cluesCollected, clueTaken: run.clueTaken };
}

function showResult(won) {
  const stats = run.stats;
  const block = stats.bestBlock;
  const isRecord = block > bestBlock;
  if (isRecord) {
    bestBlock = block;
    Sdk.save('bestBlock', bestBlock);
  }
  const rating = won
    ? (stats.ratings[stats.ratings.length - 1] || 'S')
    : ratingOf(run.steps, run.map.par);
  ui.setBest(bestBlock);
  ui.show(won ? 'won' : 'dead', {
    won,
    block,
    steps: stats.totalSteps,
    rating,
    best: bestBlock,
    deathReason: run.deathReason,
    newRecord: isRecord,
  });
  Sdk.gameOver({ block, steps: stats.totalSteps, won });
  audio.stopBgm();
}

function onDeath() {
  state = 'dead';
  showResult(false);
}

function onWin() {
  state = 'won';
  showResult(true);
  Sdk.track('session_end', { won: true, block: run.stats.bestBlock });
}

async function shareResult() {
  const block = run?.stats?.bestBlock ?? bestBlock;
  await Sdk.share({
    title: 'FOG TOWN',
    text: `${i18n.lang === 'zh' ? `我提灯走到了第 ${block} 街区！` : `I lit my way to block ${block}!`} FOG TOWN`,
  });
  Sdk.track('share', { block });
}

// ---------- 事件分发 ----------
function dispatchEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    if (state === 'playing') ui.tutorial.onGameEvent(ev);
    if (ev.type === 'blockClear') Sdk.levelCleared({ block: ev.block });
    else if (ev.type === 'clueGain') Sdk.track('clue_gain', { count: ev.count });
    else if (ev.type === 'truthMoment') Sdk.track('truth_moment', {});
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
    const input = { dir: pendingDir, echo: pendingEcho };
    pendingDir = null;
    pendingEcho = false;
    run.step(input);
    accumulator -= STEP;
    steps++;
    dispatchEvents(run.drainEvents());
    if (run.phase === 'dead') { onDeath(); return; }
    if (run.phase === 'won') { onWin(); return; }
  }

  const hud = run.getHud();
  renderer.draw(run, accumulator / STEP);
  ui.setHud(hud);
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
  bestBlock = Math.floor(Sdk.load('bestBlock', 1)) || 1;
  ui.setBest(bestBlock);
  applyAudioSettings();
  await Sdk.ready();
  Sdk.track('load', { lang: i18n.lang });
  // boot 竞态守卫：玩家可能在 boot 期已点 Start，只在还没开局时显示标题
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
    layout: () => ({ viewport: [canvas.clientWidth, canvas.clientHeight], echo: !btnEcho.hidden }),
    autoStep: (n) => {
      if (!run) return null;
      let dir = null;
      for (let k = 0; k < n && run.phase === 'playing'; k += 1) {
        dir = greedyDir(run.map, stateForRun());
        run.step({ dir });
        run.drainEvents();
      }
      return { dir, phase: run.phase, block: run.blockIndex + 1 };
    },
    winBlock: () => {
      if (!run) return null;
      const from = run.blockIndex;
      for (let k = 0; k < 800 && run.phase === 'playing' && run.blockIndex === from; k += 1) {
        const dir = greedyDir(run.map, stateForRun());
        run.step({ dir });
        run.drainEvents();
      }
      return { phase: run.phase, block: run.blockIndex + 1, steps: run.steps };
    },
    startAt: (n) => {
      run = createRun({ seed: (Date.now() & 0xffff) * 2654435761 >>> 0, startBlock: (n || 1) - 1 });
      state = 'playing';
      pendingDir = null;
      pendingEcho = false;
      ui.show('playing');
      renderer.draw(run, 1);
      return { phase: run.phase, block: run.blockIndex + 1 };
    },
  },
};
