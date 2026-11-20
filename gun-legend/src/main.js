// src/main.js — 装配：固定步长 / 输入 / 事件分发 / 状态机 / SDK / 程序化 BGM（Lead 所有）
import { WORLD, STEP } from '../config/game.config.js';
import { createRun } from './game/sim.js';
import { createRender } from './render/index.js';
import { createUI } from './ui/index.js';
import { createAudio } from './core/audio.js';
import { i18n } from './core/i18n.js';
import Sdk from './core/sdk.js';
import { sceneForRound } from '../config/levels.js';

// ---------- 装配 ----------
const canvas = document.getElementById('canvas');
const uiRoot = document.getElementById('ui-root');
const btnRoll = document.getElementById('btn-roll');
const loadingEl = document.getElementById('loading');

const renderer = createRender(canvas);
const audio = createAudio();

// ---------- 状态 ----------
let state = 'boot';              // boot | title | playing | paused | dead | won
let run = null;
let lastTime = 0;
let accumulator = 0;
let aimX = null;                 // 世界坐标指针
let aimY = null;
let fireHeld = false;
let rollHeld = false;
let reloadHeld = false;
let bgmKind = 'none';
let bestRound = 1;
let aimMoved = false;            // 教程：真实瞄准信号

// ---------- 坐标换算（letterbox） ----------
function canvasToWorld(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(rect.width / WORLD.WIDTH, rect.height / WORLD.HEIGHT);
  const ox = (rect.width - WORLD.WIDTH * scale) / 2;
  const oy = (rect.height - WORLD.HEIGHT * scale) / 2;
  return { x: (clientX - rect.left - ox) / scale, y: (clientY - rect.top - oy) / scale };
}

// ---------- 输入 ----------
window.addEventListener('keydown', (e) => {
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') { rollHeld = true; e.preventDefault(); }
  if (e.code === 'KeyR') {
    if (state === 'dead' || state === 'won') startGame();
    else reloadHeld = true;
  }
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'Enter' && state === 'title') startGame();
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') rollHeld = false;
  if (e.code === 'KeyR') reloadHeld = false;
});

function onPointerMove(e) {
  const p = canvasToWorld(e.clientX, e.clientY);
  aimX = p.x;
  aimY = p.y;
  if (state === 'playing') aimMoved = true;
}
canvas.addEventListener('pointermove', onPointerMove);
canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  const p = canvasToWorld(e.clientX, e.clientY);
  aimX = p.x;
  aimY = p.y;
  fireHeld = true;
  if (state === 'playing') aimMoved = true;
});
canvas.addEventListener('pointerup', () => { fireHeld = false; });
canvas.addEventListener('pointercancel', () => { fireHeld = false; });
canvas.addEventListener('pointerleave', () => { /* 保留最后瞄准 */ });

// 触屏翻滚按钮（非精确指针设备显示）
if (window.matchMedia && matchMedia('(pointer: coarse)').matches) btnRoll.hidden = false;
btnRoll.addEventListener('pointerdown', (e) => { e.preventDefault(); audio.unlock(); rollHeld = true; });
btnRoll.addEventListener('pointerup', () => { rollHeld = false; });
btnRoll.addEventListener('pointercancel', () => { rollHeld = false; });

// ---------- UI ----------
const ui = createUI(uiRoot, {
  onDive: () => startGame(),
  onResume: () => resumeGame(),
  onRestart: () => startGame(),
  onShare: () => shareResult(),
  onHow: () => { /* 重看引导 */ },
});
ui.onTutorial((result) => {
  Sdk.track('tutorial_done', { skipped: !!result?.skipped });
});
ui.setBest(bestRound);

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
  aimX = null;
  aimY = null;
  fireHeld = false;
  rollHeld = false;
  reloadHeld = false;
  accumulator = 0;
  lastTime = performance.now();
  ui.show('playing');
  Sdk.newRun({ zone: 1 });
  setBgm(sceneForRound(run.round).id);
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
  renderer.draw(null, 1);
  setBgm('none');
}

function onEnd(phase) {
  state = phase;
  const stats = run.stats || {};
  const round = Math.max(1, Math.floor(stats.roundReached ?? run.round ?? 1));
  const isRecord = round > bestRound;
  if (isRecord) {
    bestRound = round;
    Sdk.save('bestRound', bestRound);
  }
  const bestCombo = Math.max(stats.maxCombo || 0, Sdk.load('bestCombo', 0));
  const bestScore = Math.max(stats.score || 0, Sdk.load('bestScore', 0));
  Sdk.save('bestCombo', bestCombo);
  Sdk.save('bestScore', bestScore);
  ui.setBest(bestRound);
  ui.show('dead', {
    round,
    score: stats.score || 0,
    maxCombo: stats.maxCombo || 0,
    best: bestRound,
    newRecord: isRecord,
    victory: phase === 'won',
  });
  Sdk.gameOver({ round, score: stats.score || 0, maxCombo: stats.maxCombo || 0 });
  setBgm('none');
}

async function shareResult() {
  const round = Math.max(1, Math.floor(run?.stats?.roundReached ?? 0));
  await Sdk.share({
    title: 'GUN LEGEND',
    text: `${i18n.lang === 'zh' ? `我在雨巷站到了第 ${round} 场！` : `I reached round ${round} in the alley!`} GUN LEGEND`,
  });
  Sdk.track('share', { round });
}

function setBgm(kind) {
  if (bgmKind === kind) return;
  bgmKind = kind;
  audio.stopBgm();
  if (kind !== 'none') audio.playBgm(kind);
}

// ---------- 事件分发 ----------
function dispatchEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);

    if (ev.type === 'shot') renderer.burst(run.player.x, run.player.y, 'muzzle');
    else if (ev.type === 'hit') renderer.burst(ev.x, ev.y, 'hit');
    else if (ev.type === 'kill') { renderer.burst(ev.x, ev.y, 'kill'); renderer.setShake(4); Sdk.track('kill', { enemy: ev.enemy, combo: ev.combo }); }
    else if (ev.type === 'playerHit') renderer.setShake(6);
    else if (ev.type === 'explosion') { renderer.burst(ev.x, ev.y, 'kill'); renderer.setShake(7); }
    else if (ev.type === 'dove') { renderer.burst(640, 220, 'dove'); renderer.setShake(3); ui.showBanner('dove.title', 'dove.sub'); Sdk.track('dove', {}); }
    else if (ev.type === 'roundCleared') Sdk.levelCleared({ round: ev.round });
    else if (ev.type === 'sceneEnter' && run && run.round > 1) ui.showBanner(ev.name);
    else if (ev.type === 'weaponUnlock' && run && run.round > 1) ui.showBanner(ev.name);

    if (state === 'playing') ui.tutorial.onGameEvent(ev, performance.now());
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
    run.step({ aimX, aimY, fire: fireHeld, roll: rollHeld, reload: reloadHeld });
    accumulator -= STEP;
    steps++;
    if (aimMoved) {
      ui.tutorial.onGameEvent({ type: 'aim' }, performance.now());
      aimMoved = false;
    }
    dispatchEvents(run.drainEvents());
    if (run.phase === 'dead') { onEnd('dead'); return; }
    if (run.phase === 'won') { onEnd('won'); return; }
  }

  const hud = run.getHud();
  renderer.draw(run, accumulator / STEP);
  ui.setHud(hud);
  ui.tutorial.tick(performance.now());
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
  bestRound = Math.max(1, Math.floor(Sdk.load('bestRound', 1))) || 1;
  ui.setBest(bestRound);
  applyAudioSettings();
  await Sdk.ready();
  Sdk.track('load', { lang: i18n.lang });
  // boot 竞态守卫：只在还没开局时才显示标题
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
  debug: { layout: () => ({ viewport: [canvas.clientWidth, canvas.clientHeight], roll: !btnRoll.hidden }) },
};
