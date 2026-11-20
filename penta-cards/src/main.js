// src/main.js — 装配：固定步长 / 输入 / 事件分发 / 状态机 / SDK / BGM（Lead 所有）。
import { STEP, WORLD } from '../config/game.config.js';
import { ROUNDS } from '../config/rules.js';
import { createRun, step, drainEvents, greedyDecide, getHud } from './game/sim.js';
import { createRender } from './render/index.js';
import { createUI } from './ui/ui.js';
import { createAudio } from './core/audio.js';
import { i18n, t, syncDocumentLang } from './core/i18n.js';
import { TutorialMachine, createTutorialOverlay } from './ui/tutorial.js';
import Sdk from './core/sdk.js';

// ---------- 装配 ----------
const canvas = document.getElementById('canvas');
const root = document.getElementById('game-container');
const loadingEl = document.getElementById('loading');

const renderer = createRender(canvas);
const audio = createAudio();

// ---------- 状态 ----------
let state = 'boot'; // boot | title | playing | paused | roundEnd | sessionEnd
let run = null;
let lastTime = 0;
let aiActAt = 0;
let swapMode = false;
let hoverTile = null;
let autoplay = false;
let bestRank = 0;
let view = { hud: emptyHud(), scene: 'observatory', selected: null, pendingDiscard: false, constellation: [], peeks: [], time: 0 };

const AI_DELAY = 620;

// ---------- UI ----------
let settingsFrom = 'title';
const ui = createUI(root, {
  onAction: handleAction,
  onStart: () => startGame(),
  onHow: () => replayTutorial(),
  onResume: () => resumeGame(),
  onRestart: () => toTitle(),
  onSettings: () => { settingsFrom = state; ui.show('settings'); },
  onCloseSettings: () => { ui.show(settingsFrom === 'playing' ? 'playing' : settingsFrom === 'paused' ? 'paused' : 'title'); },
  onNext: () => advanceFromRoundEnd(),
  onLang: (l) => { i18n.setLang(l); ui.applyLang(); },
});
ui.setBest(bestRank);

// ---------- 教程 ----------
const tutorial = new TutorialMachine({
  save: (k, v) => Sdk.save(k, v),
  load: (k, d) => Sdk.load(k, d),
});
tutorial.onDone = () => Sdk.track('tutorial_done', {});
const tutorialOverlay = createTutorialOverlay(root, tutorial, { canvas });

// ---------- 音频设置 ----------
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
  swapMode = false;
  lastTime = performance.now();
  aiActAt = lastTime + 400;
  ui.show('playing');
  ui.setBest(bestRank);
  Sdk.newRun({ zone: 1 });
  setBgm(run.conf.scene);
  applyAudioSettings();
  updateFromRun();
  if (tutorial.begin()) {
    tutorialOverlay.show();
  }
}

function resumeGame() {
  if (state !== 'paused') return;
  state = 'playing';
  ui.show('playing');
  lastTime = performance.now();
  aiActAt = performance.now() + 300;
}

function toTitle() {
  state = 'title';
  run = null;
  swapMode = false;
  ui.show('title');
  ui.hideActionBar();
  tutorialOverlay.hide();
  setBgm(null);
  renderer.draw({ ...view, hud: emptyHud(), scene: 'observatory' });
}

function replayTutorial() {
  tutorial.replay();
  if (state !== 'playing') {
    // 标题点 How：直接开一局进入引导
    startGame();
  }
  tutorialOverlay.show();
}

function togglePause() {
  if (state === 'playing') { state = 'paused'; ui.show('paused'); }
  else if (state === 'paused') { resumeGame(); }
}

function emptyHud() {
  return { round: 1, totalRounds: 12, scene: 'observatory', baseBet: 1, chips: 0, wallRemaining: 0, stargazeLeft: 0, swapLeft: 0, peeks: [], phase: 'idle', state: 'idle', pendingKind: null, isPlayerTurn: false, turn: 0, player: { holds: [], pengs: [], gangs: [], folds: [], score: 0, ting: [], shanten: 8 }, opponents: [] };
}

// ---------- 输入 ----------
function canvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(rect.width / WORLD.WIDTH, rect.height / WORLD.HEIGHT);
  const ox = (rect.width - WORLD.WIDTH * scale) / 2;
  const oy = (rect.height - WORLD.HEIGHT * scale) / 2;
  return { x: (e.clientX - rect.left - ox) / scale, y: (e.clientY - rect.top - oy) / scale };
}

canvas.addEventListener('pointermove', (e) => {
  const pt = canvasPoint(e);
  const hit = renderer.hitTest(pt.x, pt.y, view);
  hoverTile = hit && hit.type === 'tile' ? hit.tile : null;
});
canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (state !== 'playing') return;
  const pt = canvasPoint(e);
  const hit = renderer.hitTest(pt.x, pt.y, view);
  if (hit && hit.type === 'tile') handleTileClick(hit.tile);
});
canvas.addEventListener('pointerleave', () => { hoverTile = null; });

function handleTileClick(tile) {
  if (state !== 'playing' || !run || run.phase !== 'playing') return;
  const p = run.pending;
  if (!p || p.seat !== 0) return;
  if (swapMode) {
    swapMode = false;
    step(run, { action: 'swap', tile });
    afterStep();
    return;
  }
  if (p.kind === 'discard') {
    step(run, { action: 'discard', tile });
    afterStep();
  }
}

function handleAction(action) {
  if (state !== 'playing' || !run) return;
  audio.unlock();
  const p = run.pending;
  if (!p || p.seat !== 0) return;
  if (action === 'swap') {
    swapMode = true;
    ui.setStatus(t('act.swap') + ' — ' + t('act.discard'));
    return;
  }
  if (action === 'stargaze') { step(run, { action: 'stargaze' }); }
  else if (action === 'draw') { step(run, { action: 'draw' }); }
  else if (action === 'hu') { step(run, { action: 'hu' }); }
  else if (action === 'gang') { step(run, { action: 'gang', tile: p.options.gangPai?.[0] }); }
  else if (action === 'peng') { step(run, { action: 'peng' }); }
  else if (action === 'pass') { step(run, { action: 'pass' }); }
  swapMode = false;
  afterStep();
}

function afterStep() {
  processEvents();
  updateFromRun();
  if (!tutorial.active && tutorialOverlay.visible) tutorialOverlay.hide();
}

// ---------- 事件分发 ----------
function processEvents() {
  if (!run) return;
  for (const ev of drainEvents(run)) {
    audio.event(ev.type, ev);
    if (ev.type === 'discard' && ev.player) tutorial.onGameEvent(ev);
    else if (ev.type === 'stargaze') tutorial.onGameEvent(ev);
    else if (ev.type === 'swap') tutorial.onGameEvent(ev);
    else if (ev.type === 'win') Sdk.track('hu', { fan: ev.fan, isZimo: ev.isZimo });
    else if (ev.type === 'roundEnd') onRoundEnd(ev);
    else if (ev.type === 'sessionEnd') onSessionEnd(ev);
  }
}

function onRoundEnd(ev) {
  if (!run) return;
  const hud = getHud(run);
  state = 'roundEnd';
  const draw = !!ev.draw;
  const won = ev.playerWon === true;
  ui.setRoundResult({
    won,
    draw,
    fan: draw ? 0 : (ev.fan || 0),
    score: hud.player.score,
    chips: hud.chips,
    round: run.round - 1 > 0 ? run.round - 1 : run.round,
    totalRounds: ROUNDS.length,
  });
  ui.hideActionBar();
  ui.show('roundEnd');
  tutorialOverlay.hide();
}

function onSessionEnd(ev) {
  if (!run) return;
  state = 'sessionEnd';
  const rank = run.stats.roundsWon;
  const isRecord = rank > bestRank;
  if (isRecord) {
    bestRank = rank;
    Sdk.save('bestRank', bestRank);
  }
  ui.setBest(bestRank);
  ui.setSessionResult({ rank, chips: run.stats.totalScore, maxFan: run.stats.maxFan, isRecord });
  ui.show('sessionEnd');
  ui.hideActionBar();
  Sdk.gameOver({ rank, chips: run.stats.totalScore });
  Sdk.track('session_end', { rank, roundsWon: run.stats.roundsWon });
  setBgm(null);
}

function advanceFromRoundEnd() {
  if (state !== 'roundEnd' || !run) return;
  if (run.phase === 'sessionEnd') { onSessionEnd(run.events.find((e) => e.type === 'sessionEnd') || {}); return; }
  step(run, null); // finishRound → startRound
  state = 'playing';
  ui.show('playing');
  setBgm(run.conf.scene);
  updateFromRun();
}

// ---------- BGM ----------
function setBgm(scene) {
  audio.stopBgm();
  if (scene) audio.playBgm(scene);
}

// ---------- 视图更新 ----------
function updateFromRun() {
  if (!run) return;
  const hud = getHud(run);
  view.hud = hud;
  view.scene = hud.scene;
  view.pendingDiscard = run.pending?.seat === 0 && run.pending?.kind === 'discard';
  view.selected = hoverTile;
  view.peeks = hud.peeks;

  ui.setHud(hud);
  const p = run.pending;
  if (p && p.seat === 0) {
    ui.setActionBar(p.kind, p.options);
    if (p.kind === 'discard') ui.setStatus(t('act.discard'));
    else if (p.kind === 'claim') ui.setStatus(t('act.claim'));
    else ui.setStatus(t('hud.turn'));
  } else if (run.state === 'roundEnd') {
    ui.hideActionBar();
  } else {
    ui.hideActionBar();
    ui.setStatus(t('hud.wait'));
  }
  // 观星揭示更新
  if (tutorialOverlay.visible) tutorialOverlay.render();
}

// ---------- 主循环 ----------
function loop(now) {
  requestAnimationFrame(loop);
  view.time = now;

  if (state === 'playing' && run && run.phase === 'playing') {
    const p = run.pending;
    if (!p) {
      step(run, null);
      afterStep();
    } else if (p.seat !== 0 || (autoplay && p.seat === 0)) {
      if (now >= aiActAt) {
        step(run, autoplay && p.seat === 0 ? greedyDecide(run, p) : null);
        aiActAt = now + AI_DELAY;
        afterStep();
      }
    }
    // player's turn → wait for input (unless autoplay)
  }

  renderer.draw(view);
  if (state === 'boot') {
    loadingEl.classList.add('hidden');
  }
}

// ---------- 键盘 ----------
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'Enter' && state === 'title') startGame();
  if (e.code === 'KeyR' && state === 'roundEnd') advanceFromRoundEnd();
  if (e.code === 'KeyR' && state === 'sessionEnd') toTitle();
});

// ---------- 失焦自动暂停 ----------
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'playing') togglePause();
});

// ---------- 广告静音 ----------
Sdk.onAdStart(() => audio.setMuted(true));
Sdk.onAdEnd(() => { audio.setMuted(!!Sdk.load('muted', false)); });

// ---------- 启动 ----------
(async () => {
  syncDocumentLang();
  ui.applyLang();
  bestRank = Math.floor(Sdk.load('bestRank', 0)) || 0;
  ui.setBest(bestRank);
  applyAudioSettings();
  await Sdk.ready();
  Sdk.track('load', { lang: i18n.lang });
  // boot 竞态守卫：异步 SDK 加载期间玩家可能已点 Start，只在仍未开局时切标题
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
  step: (input) => { if (run && run.phase === 'playing' && state === 'playing') { step(run, input); afterStep(); } },
  start: startGame,
  pause: togglePause,
  resume: resumeGame,
  restart: toTitle,
  tutorial: {
    get active() { return tutorial.active; },
    get step() { return tutorial.step; },
    get steps() { return ['discard', 'stargaze', 'swap']; },
    get current() { return tutorial.currentId; },
    skip: () => tutorial.skip(),
  },
  save: () => Sdk.save,
  ui: () => ui,
  debug: {
    layout: () => ({ viewport: [canvas.clientWidth, canvas.clientHeight], actionBar: !document.getElementById('action-bar').classList.contains('hidden') }),
    setAutoplay: (on) => { autoplay = !!on; },
    playToRoundEnd: () => {
      if (!run) return;
      let guard = 0;
      while (run.state !== 'roundEnd' && run.phase === 'playing' && guard < 4000) {
        if (run.pending?.seat === 0) step(run, greedyDecide(run, run.pending));
        else step(run, null);
        guard += 1;
      }
      afterStep();
    },
    stepN: (n) => {
      if (!run) return;
      for (let i = 0; i < n && run.phase === 'playing' && run.state !== 'roundEnd'; i += 1) {
        if (run.pending?.seat === 0) step(run, greedyDecide(run, run.pending));
        else step(run, null);
      }
      afterStep();
    },
    playToSessionEnd: () => {
      if (!run) return;
      let guard = 0;
      while (run.phase === 'playing' && guard < 50000) {
        if (run.pending?.seat === 0) step(run, greedyDecide(run, run.pending));
        else step(run, null);
        guard += 1;
      }
      afterStep();
    },
  },
};
