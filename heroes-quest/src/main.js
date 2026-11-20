// src/main.js — 装配：固定步长 / 输入 / 事件分发 / 状态机 / SDK / BGM / 教程（Lead 所有）
import { STEP, WORLD } from '../config/game.config.js';
import { createRun } from './game/sim.js';
import { createRender } from './render/index.js';
import { createUI } from './ui/index.js';
import { createAudio } from './core/audio.js';
import { i18n, syncDocumentLang } from './core/i18n.js';
import { sceneOf } from './render/scene.js';
import Sdk from './core/sdk.js';

const canvas = document.getElementById('canvas');
const uiRoot = document.getElementById('ui-root');
const loadingEl = document.getElementById('loading');

const renderer = createRender(canvas);
const audio = createAudio();

let state = 'boot';              // boot | title | playing | paused | dead | won
let run = null;
let lastTime = 0;
let accumulator = 0;
let pendingInput = {};
let bestNodes = 0;
let bgmScene = null;

// ---------- UI ----------
const ui = createUI(uiRoot, {
  onStart: () => startGame(),
  onResume: () => resumeGame(),
  onRestart: () => startGame(),
  onShare: () => shareResult(),
  onHow: () => replayTutorial(),
  onBack: () => (state === 'playing' ? showPause() : showTitle()),
  onLangChange: (l) => { i18n.setLang(l); syncDocumentLang(); ui.applyLang(); },
  onChooseNode: (id) => { pendingInput.chooseNode = id; },
  onConfirmFormation: (f) => { pendingInput.confirmFormation = f; },
  onAction: (a) => { pendingInput.action = a; },
  onChoice: (i) => { pendingInput.choice = i; },
  onUpgrade: (id) => { pendingInput.upgrade = id; },
  onContinue: () => { pendingInput.continue = true; },
  save: (k, v) => Sdk.save(k, v),
  load: (k, d) => Sdk.load(k, d),
});
ui.onTutorial((r) => {
  Sdk.track('tutorial_done', { skipped: !!r?.skipped });
});

function replayTutorial() {
  if (state !== 'playing') startGame();
  if (ui.machine.replay()) ui.showTutorial();
}
function showTitle() { state = 'title'; run = null; ui.show('title'); renderer.draw(null, 1, performance.now()); setBgm(null); }
function showPause() { state = 'paused'; ui.show('paused'); }

// ---------- 输入：键盘 ----------
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'KeyR' && (state === 'dead' || state === 'won')) startGame();
  if (e.code === 'Enter' && state === 'title') startGame();
});
function togglePause() {
  if (state === 'playing') { state = 'paused'; ui.show('paused'); }
  else if (state === 'paused') resumeGame();
}
function resumeGame() {
  if (state === 'paused') { state = 'playing'; ui.show('playing'); lastTime = performance.now(); }
}

// ---------- 输入：指针（地图选节点 / 战斗选目标） ----------
function clientToCanvas(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  const s = Math.min(r.width / WORLD.WIDTH, r.height / WORLD.HEIGHT);
  const ox = (r.width - WORLD.WIDTH * s) / 2;
  const oy = (r.height - WORLD.HEIGHT * s) / 2;
  return { x: (clientX - r.left - ox) / s, y: (clientY - r.top - oy) / s };
}

function canvasClick(clientX, clientY) {
  audio.unlock();
  if (state !== 'playing' || !run) return;
  const p = clientToCanvas(clientX, clientY);

  if (run.mode === 'map') {
    let best = null; let bd = 1e9;
    for (const rect of renderer.nodeRects(run)) {
      const d = Math.hypot(p.x - rect.x, p.y - rect.y);
      if (d < bd && d < rect.r + 10) { bd = d; best = rect; }
    }
    if (best) pendingInput.chooseNode = best.id;
  } else if (run.mode === 'battle' && ui.isAwaitingTarget()) {
    const side = ui.pendingSkill.side;
    const skill = ui.pendingSkill.skill;
    const pos = renderer.battlePositions(run);
    let best = null; let bd = 1e9;
    for (const u of run.battle.units) {
      if (u.side !== side || !u.alive) continue;
      const q = pos[u.id];
      if (!q) continue;
      const d = Math.hypot(p.x - q.x, p.y - q.y);
      if (d < bd && d < 64) { bd = d; best = u; }
    }
    if (best) {
      ui.clearPendingSkill();
      pendingInput.action = { skill, target: best.id };
    }
  }
}
canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  canvasClick(e.clientX, e.clientY);
});

// ---------- 游戏流转 ----------
function startGame() {
  audio.unlock();
  run = createRun({ seed: (Date.now() & 0xffff) * 2654435761 >>> 0 });
  state = 'playing';
  pendingInput = {};
  accumulator = 0;
  lastTime = performance.now();
  ui.reset();
  ui.show('playing');
  ui.setHud(run.getHud());
  setBgm(sceneOf(run.chapter));
  Sdk.newRun({ chapter: 1 });
  applyAudioSettings();
  if (ui.machine.begin()) ui.showTutorial();
}

function toTitle() {
  showTitle();
}

function onDeath() {
  state = 'dead';
  const nodes = run.stats.nodesCompleted || 0;
  const isRecord = nodes > bestNodes;
  if (isRecord) { bestNodes = nodes; Sdk.save('bestNodes', bestNodes); }
  ui.setBest(bestNodes);
  ui.showResult({
    won: false, nodes, supplies: run.supplies, battles: run.stats.battlesWon, best: bestNodes, newRecord: isRecord,
  });
  Sdk.gameOver({ nodes, battles: run.stats.battlesWon });
  setBgm(null);
}

function onWin() {
  state = 'won';
  const nodes = run.stats.nodesCompleted || 0;
  const isRecord = nodes > bestNodes;
  if (isRecord) { bestNodes = nodes; Sdk.save('bestNodes', bestNodes); }
  ui.setBest(bestNodes);
  ui.showResult({
    won: true, nodes, supplies: run.supplies, battles: run.stats.battlesWon, best: bestNodes, newRecord: isRecord,
  });
  Sdk.levelCleared({ nodes, battles: run.stats.battlesWon });
  setBgm(null);
}

async function shareResult() {
  const nodes = run?.stats?.nodesCompleted ?? 0;
  await Sdk.share({
    title: 'HEROES QUEST',
    text: i18n.lang === 'zh' ? `我在《英雄远征》推进了 ${nodes} 个节点！` : `I cleared ${nodes} nodes in HEROES QUEST!`,
  });
  Sdk.track('share', { nodes });
}

function setBgm(scene) {
  if (bgmScene === scene) return;
  bgmScene = scene;
  audio.stopBgm();
  if (scene) audio.playBgm(scene);
}

function applyAudioSettings() {
  audio.setMuted(!!Sdk.load('muted', false));
  audio.setVolume(Sdk.load('volume', 0.7));
}

// ---------- 事件分发 ----------
function dispatchEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    if (state === 'playing') ui.onGameEvent(ev);
    if (ev.type === 'battleStart') Sdk.track('battleStart', { chapter: run.chapter });
    else if (ev.type === 'battleWin') Sdk.track('battleWin', { node: run.nodeId });
    else if (ev.type === 'nodeMarch') Sdk.track('nodeMarch', { nodeId: ev.nodeId });
    else if (ev.type === 'signature') Sdk.track('signature', {});
  }
}

// ---------- 主循环 ----------
function loop(now) {
  requestAnimationFrame(loop);
  const t = performance.now();

  if (state !== 'playing') {
    renderer.draw(run, 1, t);
    return;
  }

  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  accumulator += dt;

  let steps = 0;
  while (accumulator >= STEP && steps < 6) {
    run.step(pendingInput);
    pendingInput = {};
    accumulator -= STEP;
    steps += 1;
    dispatchEvents(run.drainEvents());
    if (run.mode === 'defeat') { onDeath(); return; }
    if (run.mode === 'victory') { onWin(); return; }
  }

  setBgm(sceneOf(run.chapter));
  renderer.draw(run, accumulator / STEP, t);
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
  bestNodes = Math.floor(Sdk.load('bestNodes', 0)) || 0;
  ui.setBest(bestNodes);
  syncDocumentLang();
  ui.applyLang();
  applyAudioSettings();
  await Sdk.ready();
  Sdk.track('load', { lang: i18n.lang });
  if (state === 'boot') { state = 'title'; ui.show('title'); }
  renderer.draw(null, 1, performance.now());
  loadingEl.classList.add('hidden');
  lastTime = performance.now();
  requestAnimationFrame(loop);
})();

// ---------- 标准调试契约 ----------
window.G = {
  get run() { return run; },
  ui, renderer, audio, Sdk,
  get state() { return state; },
};

window.__ll = {
  get state() { return { phase: state, lang: i18n.lang, dir: i18n.dir }; },
  lang: () => i18n.lang,
  setLang: (l) => { i18n.setLang(l); syncDocumentLang(); ui.applyLang(); },
  get run() { return run; },
  start: startGame,
  pause: togglePause,
  resume: resumeGame,
  restart: toTitle,
  save: () => Sdk.save,
  ui: () => ui,
  tutorial: {
    get active() { return ui.tutorial.active; },
    get step() { return ui.tutorial.step; },
    get steps() { return ui.tutorial.steps; },
    get current() { return ui.tutorial.current; },
    skip: () => ui.tutorial.skip(),
  },
  debug: {
    layout: () => renderer.layout(),
    chooseNode: (id) => { pendingInput.chooseNode = id; },
    confirmFormation: (f) => { pendingInput.confirmFormation = f; },
    action: (a) => { pendingInput.action = a; },
    upgrade: (id) => { pendingInput.upgrade = id; },
    choice: (i) => { pendingInput.choice = i; },
    continue: () => { pendingInput.continue = true; },
  },
};
