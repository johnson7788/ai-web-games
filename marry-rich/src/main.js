// src/main.js — MARRY RICH · 装配：固定步长 / 输入 / 事件分发 / 屏幕状态机 / SDK / BGM。
// 阶段：boot → title → playing → paused/ending。剧情 sim 是纯逻辑（src/game/sim.js）。
import { STEP, WORLD } from '../config/game.config.js';
import { createRun } from './game/sim.js';
import { createRender } from './render/index.js';
import { createUI } from './ui/index.js';
import { createAudio } from './core/audio.js';
import { i18n } from './core/i18n.js';
import Sdk from './core/sdk.js';
import { ENDINGS } from '../config/endings.js';

const canvas = document.getElementById('canvas');
const uiRoot = document.getElementById('ui-root');
const loadingEl = document.getElementById('loading');

const renderer = createRender(canvas);
const audio = createAudio();

// ---------- 状态 ----------
let state = 'boot'; // boot | title | playing | paused | ending
let run = null;
let lastTime = 0;
let accumulator = 0;
let pendingChoice = null;
let pendingAdvance = false;
let discovered = [];

// 屏幕/章节变化去重（避免每帧重建 DOM）
let lastNodeId = null;
let lastStage = null;
let lastChoice = null;

// ---------- 输入 ----------
function unlockAudio() {
  audio.unlock();
}

window.addEventListener('pointerdown', unlockAudio, { once: true });

window.addEventListener('keydown', (e) => {
  if (e.code === 'Enter' && state === 'title') startGame();
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'KeyR' && state === 'ending') startGame();
  if ((e.code === 'Digit1' || e.code === 'Numpad1') && state === 'playing') pendingChoice = 0;
  if ((e.code === 'Digit2' || e.code === 'Numpad2') && state === 'playing') pendingChoice = 1;
  if ((e.code === 'Digit3' || e.code === 'Numpad3') && state === 'playing') pendingChoice = 2;
  if ((e.code === 'Space' || e.code === 'Enter') && state === 'playing' && run?.stage === 'result') {
    pendingAdvance = true;
    e.preventDefault();
  }
});

// ---------- UI ----------
const ui = createUI(uiRoot, {
  onStart: () => startGame(),
  onResume: () => resumeGame(),
  onRestart: () => toTitle(),
  onShare: () => shareResult(),
  onHow: () => {},
  onChoice: (idx) => { if (state === 'playing' && run?.stage === 'choice') pendingChoice = idx; },
  onContinue: () => { if (state === 'playing' && run?.stage === 'result') pendingAdvance = true; },
  onMemory: () => { ui.renderMemory(run?.history || []); ui.show('memory'); },
  onMemoryClose: () => ui.show('ending'),
  onTutorial: (result) => {
    Sdk.track('tutorial_done', { skipped: !!result?.skipped });
  },
});

// ---------- 音频设置持久化 ----------
function applyAudioSettings() {
  const muted = Sdk.load('muted', false);
  const vol = Sdk.load('volume', 0.8);
  audio.setMuted(!!muted);
  audio.setVolume(vol);
}

// ---------- 游戏流转 ----------
function startGame() {
  unlockAudio();
  run = createRun({ seed: (Date.now() & 0xffff) * 2654435761 >>> 0 });
  state = 'playing';
  pendingChoice = null;
  pendingAdvance = false;
  lastNodeId = null;
  lastStage = null;
  lastChoice = null;
  accumulator = 0;
  lastTime = performance.now();
  ui.show('play');
  const hud = run.getHud();
  ui.setHud(hud);
  ui.setPlay(hud);
  Sdk.newRun({ zone: 1 });
  setBgm(hud.scene);
  applyAudioSettings();
}

function togglePause() {
  if (state === 'playing') { state = 'paused'; ui.show('paused'); }
  else if (state === 'paused') { resumeGame(); }
}
function resumeGame() {
  if (state === 'paused') { state = 'playing'; ui.show('play'); lastTime = performance.now(); }
}

function toTitle() {
  state = 'title';
  run = null;
  ui.show('title');
  renderer.draw(null, 1, 0);
  setBgm(null);
}

function onEnding() {
  state = 'ending';
  const ending = run.ending;
  const id = ending?.id;
  if (id && !discovered.includes(id)) {
    discovered.push(id);
    Sdk.save('endingsDiscovered', discovered);
  }
  ui.setEndingsFound(discovered.length);
  ui.renderEnding(ending, discovered.length);
  ui.show('ending');
  Sdk.gameOver({ ending: id });
  setBgm(null);
}

async function shareResult() {
  const ending = run?.ending;
  const name = ending ? (ending.title[i18n.lang] || ending.title.en) : 'MARRY RICH';
  await Sdk.share({
    title: 'MARRY RICH',
    text: i18n.get('share.text', { ending: name }) + ' MARRY RICH',
  });
  Sdk.track('share', { ending: ending?.id });
}

function setBgm(scene) {
  if (scene === 'town' || scene === 'city' || scene === 'peak') audio.playBgm(scene);
  else audio.stopBgm();
}

// ---------- 事件分发 ----------
function dispatchEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    if (ev.type === 'scaleTilt') renderer.tilt(ev.lean);
    if (ev.type === 'choiceMade') Sdk.track('choiceMade', { chapter: ev.chapter, timedOut: ev.timedOut });
    if (ev.type === 'ending') Sdk.track('ending', { endingId: ev.endingId });
    if (state === 'playing') ui.tutorial.onGameEvent(ev);
  }
}

// ---------- 主循环 ----------
function loop(now) {
  requestAnimationFrame(loop);
  const tSec = now / 1000;

  if (state !== 'playing') {
    renderer.draw(state === 'paused' || state === 'ending' ? run : null, 1, tSec);
    return;
  }

  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  accumulator += dt;

  let steps = 0;
  while (accumulator >= STEP && steps < 6) {
    const input = { choice: pendingChoice, advance: pendingAdvance };
    pendingChoice = null;
    pendingAdvance = false;
    run.step(input);
    accumulator -= STEP;
    steps += 1;
    dispatchEvents(run.drainEvents());
    if (run.phase === 'ended') { onEnding(); return; }
  }

  const hud = run.getHud();
  ui.setHud(hud);

  // 章节/阶段/选项变化时重建玩法面板
  if (hud.nodeId !== lastNodeId || hud.stage !== lastStage || hud.curChoice !== lastChoice) {
    lastNodeId = hud.nodeId;
    lastStage = hud.stage;
    lastChoice = hud.curChoice;
    ui.setPlay(hud);
  }

  renderer.setTimed(!!(hud.timed && hud.stage === 'choice'));
  renderer.draw(run, accumulator / STEP, tSec);
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
  discovered = Array.isArray(Sdk.load('endingsDiscovered', [])) ? Sdk.load('endingsDiscovered', []) : [];
  ui.setEndingsFound(discovered.length);
  applyAudioSettings();
  await Sdk.ready();
  Sdk.track('load', { lang: i18n.lang });
  if (state === 'boot') { state = 'title'; ui.show('title'); }
  renderer.draw(null, 1, 0);
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
    layout: () => ({
      viewport: [canvas.clientWidth, canvas.clientHeight],
      scene: run ? run.getHud().scene : 'title',
      endings: discovered.length,
    }),
    startSeeded: (path) => {
      // 验收/物料专用：按给定选择序列直接跑完（数组 0/1/2），供截图与录 GIF 使用。
      startGame();
      const indices = Array.isArray(path) ? path : [];
      for (const idx of indices) {
        run.step({ choice: idx });
        run.step({ advance: true });
      }
      const hud = run.getHud();
      ui.setHud(hud);
      ui.setPlay(hud);
      if (run.phase === 'ended') onEnding();
    },
  },
};
