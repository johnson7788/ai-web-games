// src/main.js — 装配：固定步长 / 输入 / 事件分发 / 状态机 / SDK / BGM（Lead 所有）
import { WORLD, STEP } from '../config/game.config.js';
import { createRun } from './game/engine.js';
import { createRender, handLayout } from './render/index.js';
import { createUI } from './ui/index.js';
import { createAudio } from './core/audio.js';
import { i18n } from './core/i18n.js';
import Sdk from './core/sdk.js';

const canvas = document.getElementById('canvas');
const uiRoot = document.getElementById('ui-root');
const loadingEl = document.getElementById('loading');

const renderer = createRender(canvas);
const audio = createAudio();

// ---------- 状态 ----------
let state = 'boot';            // boot | title | playing | paused | dead
let run = null;
let lastTime = 0;
let accumulator = 0;
let selectedIds = new Set();
let bestTier = 0;

// ---------- UI ----------
const ui = createUI(uiRoot, {
  onStart: () => startGame(),
  onHow: () => replayTutorial(),
  onResume: () => resumeGame(),
  onRestart: () => toTitle(),
  onReplay: () => startGame(),
  onNext: () => nextRound(),
  onMute: (on) => audio.setMuted(!on),
  onLang: (lang) => { if (i18n.setLang(lang)) ui.applyLang(); },
  onAction: (input) => applyInput(input),
  onTutorialDone: () => { Sdk.track('tutorial_done', {}); },
}, Sdk);

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
  selectedIds = new Set();
  state = 'playing';
  ui.show('playing');
  ui.setBest(bestTier);
  Sdk.newRun({ tier: run.tier });
  audio.playBgm('table');
  applyAudioSettings();
  // 首次进入弹交互引导
  if (ui.tutorial.begin()) ui.tutorialOverlay.show();
  updateView();
}

function nextRound() {
  if (!run) return;
  run.advance();
  selectedIds = new Set();
  state = 'playing';
  ui.show('playing');
  updateView();
}

function toTitle() {
  state = 'title';
  run = null;
  selectedIds = new Set();
  ui.show('title', { best: bestTier });
  ui.tutorialOverlay.hide();
  audio.stopBgm();
  renderer.draw(null);
  Sdk.track('restart', {});
}

function togglePause() {
  if (state === 'playing') { state = 'paused'; ui.show('paused'); }
  else if (state === 'paused') { resumeGame(); }
}
function resumeGame() {
  if (state === 'paused') { state = 'playing'; ui.show('playing'); lastTime = performance.now(); }
}

function replayTutorial() {
  ui.tutorial.replay();
  ui.tutorialOverlay.show();
}

// ---------- 输入 ----------
function canvasToWorld(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(rect.width / WORLD.WIDTH, rect.height / WORLD.HEIGHT);
  const ox = (rect.width - WORLD.WIDTH * scale) / 2;
  const oy = (rect.height - WORLD.HEIGHT * scale) / 2;
  return { x: (clientX - rect.left - ox) / scale, y: (clientY - rect.top - oy) / scale };
}

function handleCanvasTap(e) {
  if (state !== 'playing' || !run) return;
  audio.unlock();
  const p = canvasToWorld(e.clientX, e.clientY);
  const hud = run.getHud();
  if (hud.roundPhase !== 'playing' && hud.roundPhase !== 'doubling') return;
  const hand = hud.hand;
  const L = handLayout(hand.length);
  if (p.y < L.baseY || p.y > L.baseY + L.h) return;
  // 从右向左命中（后画的牌在上层）
  for (let i = hand.length - 1; i >= 0; i -= 1) {
    const left = L.xOf(i);
    const right = left + (i === hand.length - 1 ? L.w : L.gap);
    if (p.x >= left && p.x <= right) {
      const id = hand[i].id;
      if (selectedIds.has(id)) selectedIds.delete(id);
      else selectedIds.add(id);
      ui.tutorial.onGameEvent({ type: 'select' });
      updateView();
      return;
    }
  }
}

canvas.addEventListener('pointerdown', (e) => handleCanvasTap(e));

// ---------- 输入：键盘 ----------
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'KeyR' && state === 'dead') startGame();
  if (e.code === 'Enter' && state === 'title') startGame();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'playing') togglePause();
});

// ---------- 出牌动作 ----------
function currentHand() {
  return run ? run.getHud().hand : [];
}

function applyInput(input) {
  if (state !== 'playing' || !run) return;
  if (input.action === 'hint') {
    const c = run.hint();
    selectedIds = new Set(c ? c.map((x) => x.id) : []);
    audio.event('hint', {});
    updateView();
    return;
  }
  if (input.action === 'play') {
    const cards = (input.cards && input.cards.length)
      ? input.cards
      : currentHand().filter((c) => selectedIds.has(c.id));
    if (!cards.length) return;
    input = { action: 'play', cards };
  }
  run.step(input);
  const events = run.drainEvents();
  dispatch(events);
  const invalid = events.some((e) => e.type === 'invalid');
  if (!invalid && (input.action === 'play' || input.action === 'pass' || input.action === 'bid' || input.action === 'double')) {
    selectedIds = new Set();
  }
  afterStep();
  updateView();
}

function afterStep() {
  if (!run) return;
  if (run.roundPhase !== 'done') return;
  const result = run.round.result;
  if (!result) return;
  if (result.humanWon) {
    ui.showResult(result, run.stats);
    Sdk.levelCleared({ tier: run.tier, points: result.points });
  } else {
    state = 'dead';
    bestTier = Math.max(bestTier, run.tier);
    Sdk.save('bestTier', bestTier);
    ui.setBest(bestTier);
    ui.showResult(result, run.stats);
    Sdk.gameOver({ tier: run.tier, points: result.points });
    Sdk.track('session_end', { tier: run.tier });
    audio.stopBgm();
  }
}

// ---------- 事件分发 ----------
function dispatch(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    if (ev.type === 'bomb' || ev.type === 'rocket') renderer.bomb();
    if (ev.type === 'bid' && ev.seat === 0) ui.tutorial.onGameEvent({ type: 'humanBid' });
    if (ev.type === 'play' && ev.seat === 0) ui.tutorial.onGameEvent({ type: 'humanPlay' });
    if (ev.type === 'roundWin') ui.tutorial.onGameEvent({ type: 'roundWin' });
    if (ev.type === 'roundWin') Sdk.track('win', { tier: run.tier });
    if (ev.type === 'roundLose') Sdk.track('fail', { tier: run.tier });
    if (ev.type === 'bomb' || ev.type === 'rocket') Sdk.track('bomb', { kind: ev.type });
  }
}

// ---------- 渲染更新 ----------
function updateView() {
  if (!run) { renderer.draw(null); return; }
  const hud = run.getHud();
  const isHumanTurn = hud.phase === 'playing' && hud.turn === 0
    && ['bidding', 'doubling', 'playing'].includes(hud.roundPhase)
    && hud.roundPhase !== 'done';
  ui.setHud(hud, { selectedIds, isHumanTurn });
  renderer.draw({ hud, selectedIds });
}

// ---------- 主循环 ----------
function loop(now) {
  requestAnimationFrame(loop);
  if (state === 'playing') updateView();
  else if (state === 'paused' || state === 'dead') { /* 保留最后一帧 */ }
  else if (state === 'title') { /* 标题帧由 toTitle 画一次 */ }
  void now;
}

// ---------- 启动 ----------
(async () => {
  bestTier = Math.floor(Sdk.load('bestTier', 0)) || 0;
  ui.setBest(bestTier);
  ui.applyLang();
  applyAudioSettings();
  await Sdk.ready();
  Sdk.track('load', { lang: i18n.lang });
  // boot 竞态守卫：异步 SDK 加载期间玩家可能已点 Start
  if (state === 'boot') { state = 'title'; ui.show('title', { best: bestTier }); }
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
    get current() { return ui.tutorial.currentId; },
    skip: () => ui.tutorial.skip(),
  },
  save: () => Sdk.save,
  ui: () => ui,
  act: (input) => applyInput(input),
  selectHint: () => { const c = run ? run.hint() : null; selectedIds = new Set(c ? c.map((x) => x.id) : []); updateView(); },
  debug: { layout: () => ({ viewport: [canvas.clientWidth, canvas.clientHeight] }) },
};
