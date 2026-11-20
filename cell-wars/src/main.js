// src/main.js — 装配：固定步长 / 输入 / 事件分发 / 状态机 / SDK / BGM（Lead 所有）
import { STEP, WORLD } from '../config/game.config.js';
import { OWNER } from '../config/gameplay.js';
import { createRun } from './game/sim.js';
import { listFrontier } from './game/board.js';
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
let state = 'boot';             // boot | title | playing | paused | cleared | dead | won
let run = null;
let lastTime = 0;
let accumulator = 0;
let pendingAction = null;       // 点击产生的本回合动作（下一步消费）
let hover = null;               // { r, c } 当前悬停格
let validTargets = [];
let bestDish = 0;

// ---------- UI ----------
const ui = createUI(uiRoot, {
  onStart: () => startGame(),
  onResume: () => resumeGame(),
  onRestart: () => startGame(),
  onContinue: () => continueRun(),
  onShare: () => shareResult(),
  onHow: () => {},
  onSound: () => toggleSound(),
  onPhage: () => togglePhageMode(),
});
ui.onTutorial((result) => {
  Sdk.track('tutorial_done', { skipped: !!result?.skipped });
});
ui.setBest(bestDish);

// ---------- 音频设置持久化 ----------
function applyAudioSettings() {
  const muted = Sdk.load('audioMuted', false);
  const vol = Sdk.load('audioVolume', 0.7);
  audio.setMuted(!!muted);
  audio.setVolume(vol);
  ui.setSoundLabel(!!muted);
}

function toggleSound() {
  audio.setMuted(!Sdk.load('audioMuted', false));
  applyAudioSettings();
}

function setBgm(mode) {
  if (mode === 'bgm') audio.playBgm('bgm');
  else audio.stopBgm();
}

// ---------- 坐标换算 ----------
function canvasPoint(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(rect.width / WORLD.WIDTH, rect.height / WORLD.HEIGHT);
  const ox = (rect.width - WORLD.WIDTH * scale) / 2;
  const oy = (rect.height - WORLD.HEIGHT * scale) / 2;
  return { x: (clientX - rect.left - ox) / scale, y: (clientY - rect.top - oy) / scale };
}

function updateHover(clientX, clientY) {
  if (!run || run.turn !== 'player') { hover = null; return; }
  const p = canvasPoint(clientX, clientY);
  hover = renderer.cellAt(p.x, p.y, run.size);
}

function handleClick(clientX, clientY) {
  if (!run || state !== 'playing' || run.turn !== 'player') return;
  const p = canvasPoint(clientX, clientY);
  const cell = renderer.cellAt(p.x, p.y, run.size);
  if (!cell) return;
  const { r, c } = cell;
  const owner = run.board[r][c].o;

  if (ui.hud.phageMode) {
    if (run.playerPhage.ready) {
      pendingAction = { kind: 'phage', r, c };
      ui.hud.setPhageMode(false);
      audio.event('ui', {});
    }
    return;
  }

  if (owner === OWNER.PLAYER) {
    if (run.playerNutrientAvailable) pendingAction = { kind: 'nutrient', r, c };
  } else if (owner !== OWNER.VOID) {
    pendingAction = { kind: 'infect', r, c };
  }
}

function togglePhageMode() {
  if (!run || state !== 'playing' || run.turn !== 'player') return;
  if (!run.playerPhage.ready) return;
  ui.hud.setPhageMode(!ui.hud.phageMode);
  audio.event('ui', {});
}

// ---------- 输入 ----------
canvas.addEventListener('pointermove', (e) => updateHover(e.clientX, e.clientY));
canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  handleClick(e.clientX, e.clientY);
});
canvas.addEventListener('pointerleave', () => { hover = null; });

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'KeyR' && (state === 'dead' || state === 'won')) startGame();
  if (e.code === 'Enter' && state === 'title') startGame();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'playing') togglePause();
});

// ---------- 游戏流转 ----------
function startGame() {
  audio.unlock();
  run = createRun({ seed: (Date.now() & 0xffff) * 2654435761 >>> 0 });
  state = 'playing';
  pendingAction = null;
  hover = null;
  accumulator = 0;
  lastTime = performance.now();
  ui.show('playing');
  Sdk.newRun({ zone: 1 });
  setBgm('bgm');
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
  pendingAction = null;
  hover = null;
  ui.show('title');
  renderer.draw(null);
  setBgm(null);
}

function continueRun() {
  if (state !== 'cleared' || !run) return;
  run.continue();
  state = 'playing';
  ui.show('playing');
  lastTime = performance.now();
}

function onCleared() {
  state = 'cleared';
  ui.show('cleared', { dish: run.dish });
  Sdk.levelCleared({ dish: run.dish });
  Sdk.track('dish_clear', { dish: run.dish });
}

function onDeath() {
  state = 'dead';
  const dish = run.dish;
  const cleared = run.stats.dishesCleared;
  const isRecord = dish > bestDish;
  if (isRecord) {
    bestDish = dish;
    Sdk.save('bestDish', bestDish);
  }
  ui.setBest(bestDish);
  ui.show('dead', { dish, cleared, best: bestDish, newRecord: isRecord });
  Sdk.gameOver({ dish, cleared });
  setBgm(null);
}

function onVictory() {
  state = 'won';
  if (run.dish > bestDish) {
    bestDish = run.dish;
    Sdk.save('bestDish', bestDish);
  }
  ui.setBest(bestDish);
  ui.show('victory');
  Sdk.levelCleared({ dish: run.dish, all: true });
  setBgm(null);
}

async function shareResult() {
  const dish = run?.dish ?? 0;
  await Sdk.share({
    title: 'CELL WARS',
    text: `${i18n.lang === 'zh' ? `我打通到第 ${dish} 皿！` : `I conquered dish ${dish} in CELL WARS!`}`,
  });
  Sdk.track('share', { dish });
}

// ---------- 事件分发 ----------
function dispatchEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    if (state === 'playing') ui.tutorial.onGameEvent(ev);
    if (ev.type === 'bigChain') Sdk.track('big_chain', { count: ev.count });
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
      const action = pendingAction;
      pendingAction = null;
      run.step({ action });
      accumulator -= STEP;
      steps += 1;
      dispatchEvents(run.drainEvents());
      if (run.phase === 'lost') { onDeath(); return; }
      if (run.phase === 'victory') { onVictory(); return; }
      if (run.phase === 'cleared') { onCleared(); return; }
    }

    validTargets = run.turn === 'player'
      ? listFrontier(run.board, run.size, OWNER.PLAYER).map(([r, c]) => ({ r, c }))
      : [];
    renderer.draw(run, { hover, validTargets });
    ui.setHud(run.getHud());
  } else if (state === 'paused' || state === 'cleared' || state === 'dead' || state === 'won') {
    renderer.draw(run, {});
  }
}

// ---------- 广告期间静音 ----------
Sdk.onAdStart(() => audio.setMuted(true));
Sdk.onAdEnd(() => { audio.setMuted(!!Sdk.load('audioMuted', false)); });

// ---------- 启动 ----------
(async () => {
  bestDish = Math.floor(Sdk.load('bestDish', 0)) || 0;
  ui.setBest(bestDish);
  applyAudioSettings();
  await Sdk.ready();
  Sdk.track('load', { lang: i18n.lang });
  // boot 竞态守卫：异步 SDK 加载窗口内玩家点 Start 不应被顶掉
  if (state === 'boot') { state = 'title'; ui.show('title'); }
  renderer.draw(null);
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
  debug: { layout: () => ({ viewport: [canvas.clientWidth, canvas.clientHeight] }) },
};
