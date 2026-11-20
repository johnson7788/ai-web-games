// src/main.js — ALIEN SIEGE · 装配：固定步长 / 输入 / 事件分发 / 状态机 / SDK / BGM（Lead 所有）
import { STEP } from '../config/game.config.js';
import { ENEMIES, normAngle } from '../config/gameplay.js';
import { createRun } from './game/sim.js';
import { createRender } from './render/index.js';
import { createUI } from './ui/index.js';
import { createAudio } from './core/audio.js';
import { i18n } from './core/i18n.js';
import Sdk from './core/sdk.js';

// ---------- 装配 ----------
const canvas = document.getElementById('canvas');
const uiRoot = document.getElementById('ui-root');
const loadingEl = document.getElementById('loading');
const touchLayer = document.getElementById('touch-layer');

const renderer = createRender(canvas);
const audio = createAudio();

// ---------- 状态 ----------
let state = 'boot';        // boot | title | playing | paused | dead | win
let run = null;
let demoRun = null;        // 标题屏背后的演示场景
let lastTime = 0;
let accumulator = 0;
let bestWave = 0;
let moveActive = false;    // 教程：真实移动信号

// ---------- 输入状态 ----------
const keys = { w: false, a: false, s: false, d: false, left: false, right: false, q: false, space: false };
const input = { moveX: 0, moveY: 0, turn: 0, shoot: false, reload: false, shield: false, mark: false };
let mouseDown = false;
let mouseTurn = 0;         // 鼠标/右摇杆累积转向（弧度）
let reloadPressed = false;
let markPressed = false;

// ---------- UI ----------
const ui = createUI(uiRoot, {
  onStart: () => startGame(),
  onResume: () => resumeGame(),
  onRestart: () => startGame(),
  onShare: () => shareResult(),
  onHow: () => { /* 标题/暂停点 How 会重看引导 */ },
});
ui.onTutorial((result) => {
  Sdk.track('tutorial_done', { skipped: !!result?.skipped });
  // 教程结束（含跳过）：若第一波还没来，立即开始（画面上必须有敌人=目标）
  if (run && run.wave === 0) {
    run.spawnTimer = 0;
  }
});
ui.setBest(bestWave);

// ---------- 音频设置持久化 ----------
function applyAudioSettings() {
  const muted = Sdk.load('audioMuted', false);
  const vol = Sdk.load('audioVolume', 0.7);
  audio.setMuted(!!muted);
  audio.setVolume(vol);
}

// ---------- 键盘 ----------
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyW' || e.code === 'ArrowUp') keys.w = true;
  if (e.code === 'KeyA') keys.a = true;
  if (e.code === 'KeyS' || e.code === 'ArrowDown') keys.s = true;
  if (e.code === 'KeyD') keys.d = true;
  if (e.code === 'ArrowLeft') keys.left = true;
  if (e.code === 'ArrowRight') keys.right = true;
  if (e.code === 'KeyQ') keys.q = true;
  if (e.code === 'Space') { keys.space = true; e.preventDefault(); }

  if (e.code === 'KeyR') {
    if (state === 'playing') reloadPressed = true;
    else if (state === 'dead' || state === 'win') startGame();
  }
  if (e.code === 'KeyE') {
    if (state === 'playing') markPressed = true;
  }
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'Enter' && state === 'title') startGame();
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'KeyW' || e.code === 'ArrowUp') keys.w = false;
  if (e.code === 'KeyA') keys.a = false;
  if (e.code === 'KeyS' || e.code === 'ArrowDown') keys.s = false;
  if (e.code === 'KeyD') keys.d = false;
  if (e.code === 'ArrowLeft') keys.left = false;
  if (e.code === 'ArrowRight') keys.right = false;
  if (e.code === 'KeyQ') keys.q = false;
  if (e.code === 'Space') keys.space = false;
});

// ---------- 鼠标 ----------
canvas.addEventListener('mousemove', (e) => {
  if (state !== 'playing') return;
  if (e.movementX != null) mouseTurn += e.movementX * 0.0028;
});
canvas.addEventListener('mousedown', (e) => {
  audio.unlock();
  if (state === 'playing') { mouseDown = true; e.preventDefault(); }
});
window.addEventListener('mouseup', () => { mouseDown = false; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// ---------- 触屏（双摇杆 + 按钮） ----------
function setupTouch() {
  const moveZone = document.getElementById('touch-move');
  const lookZone = document.getElementById('touch-look');
  let moveOrigin = null;
  let lookOrigin = null;

  moveZone.addEventListener('pointerdown', (e) => {
    audio.unlock();
    moveZone.setPointerCapture(e.pointerId);
    moveOrigin = { x: e.clientX, y: e.clientY };
  });
  moveZone.addEventListener('pointermove', (e) => {
    if (!moveOrigin) return;
    const dx = e.clientX - moveOrigin.x;
    const dy = e.clientY - moveOrigin.y;
    const mag = Math.hypot(dx, dy);
    const dead = 14;
    if (mag < dead) { input.moveX = 0; input.moveY = 0; return; }
    const s = Math.min(1, (mag - dead) / 60);
    input.moveX = (dx / mag) * s;
    input.moveY = -(dy / mag) * s;
  });
  moveZone.addEventListener('pointerup', () => { moveOrigin = null; input.moveX = 0; input.moveY = 0; });
  moveZone.addEventListener('pointercancel', () => { moveOrigin = null; input.moveX = 0; input.moveY = 0; });

  lookZone.addEventListener('pointerdown', (e) => {
    audio.unlock();
    lookZone.setPointerCapture(e.pointerId);
    lookOrigin = { x: e.clientX, y: e.clientY };
  });
  lookZone.addEventListener('pointermove', (e) => {
    if (!lookOrigin) return;
    const dx = e.clientX - lookOrigin.x;
    mouseTurn += dx * 0.004;
    lookOrigin = { x: e.clientX, y: e.clientY };
  });
  lookZone.addEventListener('pointerup', () => { lookOrigin = null; });

  const fireBtn = document.getElementById('btn-fire');
  fireBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); audio.unlock(); mouseDown = true; });
  fireBtn.addEventListener('pointerup', () => { mouseDown = false; });
  fireBtn.addEventListener('pointercancel', () => { mouseDown = false; });
  document.getElementById('btn-reload').addEventListener('pointerdown', (e) => { e.preventDefault(); if (state === 'playing') reloadPressed = true; });
  document.getElementById('btn-mark').addEventListener('pointerdown', (e) => { e.preventDefault(); if (state === 'playing') markPressed = true; });
  const shieldBtn = document.getElementById('btn-shield');
  shieldBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); audio.unlock(); keys.q = true; });
  shieldBtn.addEventListener('pointerup', () => { keys.q = false; });
  shieldBtn.addEventListener('pointercancel', () => { keys.q = false; });
}
setupTouch();

// ---------- 游戏流转 ----------
function makeDemoRun() {
  const r = createRun({ seed: 7 });
  r.wave = 1;
  r.waveState = 'active';
  r.player.angle = -0.6;
  const specC = ENEMIES.crawler;
  const specF = ENEMIES.floater;
  r.enemies = [
    { id: 901, type: 'crawler', x: 9, y: 9, hp: specC.hp, maxHp: specC.hp, speed: 0, radius: specC.radius, damage: specC.damage, attackRange: specC.attackRange, attackCooldown: 1, drift: 0, score: 0, attackCd: 0, driftPhase: 0, spawnCd: 0, marked: true, markedUntil: Infinity },
    { id: 902, type: 'floater', x: 15, y: 10.5, hp: specF.hp, maxHp: specF.hp, speed: 0, radius: specF.radius, damage: specF.damage, attackRange: specF.attackRange, attackCooldown: 1, drift: 1.7, score: 0, attackCd: 0, driftPhase: 1, spawnCd: 0, marked: false, markedUntil: 0 },
  ];
  return r;
}

function startGame() {
  audio.unlock();
  run = createRun({ seed: (Date.now() & 0xffff) * 2654435761 >>> 0 });
  state = 'playing';
  accumulator = 0;
  lastTime = performance.now();
  mouseTurn = 0;
  mouseDown = false;
  input.moveX = 0; input.moveY = 0; input.turn = 0; input.shoot = false; input.shield = false; input.reload = false; input.mark = false;
  reloadPressed = false; markPressed = false;
  ui.show('playing');
  Sdk.newRun({ zone: 1 });
  audio.playBgm();
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
  renderer.draw(demoRun, 1);
  audio.stopBgm();
}

function onDeath() {
  state = 'dead';
  const stats = run.stats || {};
  const wave = Math.max(1, stats.waveReached || run.wave || 1);
  const isRecord = wave > bestWave;
  if (isRecord) {
    bestWave = wave;
    Sdk.save('bestWave', bestWave);
  }
  ui.setBest(bestWave);
  ui.show('dead', {
    win: false,
    wave,
    kills: stats.kills || 0,
    score: stats.score || 0,
    best: bestWave,
    newRecord: isRecord,
  });
  Sdk.gameOver({ wave, kills: stats.kills || 0, score: stats.score || 0 });
  audio.stopBgm();
}

function onWin() {
  state = 'win';
  const stats = run.stats || {};
  const wave = stats.waveReached || run.wave || 12;
  const isRecord = wave > bestWave;
  if (isRecord) {
    bestWave = wave;
    Sdk.save('bestWave', bestWave);
  }
  ui.setBest(bestWave);
  ui.show('dead', {
    win: true,
    wave,
    kills: stats.kills || 0,
    score: stats.score || 0,
    best: bestWave,
    newRecord: isRecord,
  });
  Sdk.levelCleared({ wave, kills: stats.kills || 0, score: stats.score || 0 });
  audio.stopBgm();
}

async function shareResult() {
  const wave = Math.max(1, Math.floor(run?.stats?.waveReached ?? bestWave));
  await Sdk.share({
    title: 'ALIEN SIEGE',
    text: i18n.lang === 'zh' ? `我在异星围攻守到了第 ${wave} 波！` : `I held wave ${wave} in ALIEN SIEGE!`,
  });
  Sdk.track('share', { wave });
}

// ---------- 事件分发 ----------
function dispatchEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);

    if (ev.type === 'splat') renderer.splatBurst();
    else if (ev.type === 'shoot') renderer.muzzleFlash();
    else if (ev.type === 'hit') renderer.burstWorld(ev.x, ev.y, 'hit');
    else if (ev.type === 'kill') renderer.burstWorld(ev.x, ev.y, 'kill');

    if (state === 'playing') ui.tutorial.onGameEvent(ev);

    if (ev.type === 'waveStart') Sdk.track('waveEnter', { wave: ev.wave });
    else if (ev.type === 'kill') Sdk.track('kill', { type: ev.type });
  }
}

// ---------- 主循环 ----------
function loop(now) {
  requestAnimationFrame(loop);

  if (state !== 'playing') {
    renderer.draw(state === 'paused' || state === 'dead' || state === 'win' ? run : demoRun, 1);
    return;
  }

  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  accumulator += dt;

  // 每帧读取键盘/触屏 → 输入（边沿键在 step 后清零）
  input.moveY = (keys.w ? 1 : 0) - (keys.s ? 1 : 0);
  input.moveX = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
  input.turn = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  input.shoot = mouseDown || keys.space;
  input.shield = keys.q;
  input.reload = reloadPressed;
  input.mark = markPressed;

  if (Math.abs(input.moveX) > 0.01 || Math.abs(input.moveY) > 0.01) moveActive = true;

  let steps = 0;
  while (accumulator >= STEP && steps < 6) {
    if (mouseTurn !== 0 && run) {
      run.player.angle = normAngle(run.player.angle + mouseTurn);
      mouseTurn = 0;
    }
    run.step(input);
    accumulator -= STEP;
    steps++;
    reloadPressed = false;
    markPressed = false;
    dispatchEvents(run.drainEvents());

    if (moveActive) {
      ui.tutorial.onGameEvent({ type: 'move' });
      moveActive = false;
    }

    if (run.phase === 'dead') { onDeath(); return; }
    if (run.phase === 'win') { onWin(); return; }
  }
  if (mouseTurn !== 0) mouseTurn = 0;

  renderer.draw(run, accumulator / STEP);
  ui.setHud(run.getHud());
  ui.tutorial.tick();
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
  bestWave = Math.floor(Sdk.load('bestWave', 0)) || 0;
  ui.setBest(bestWave);
  demoRun = makeDemoRun();
  applyAudioSettings();
  await Sdk.ready();
  Sdk.track('load', { lang: i18n.lang });
  // 玩家可能在 boot 期间已点 Start（异步 SDK 加载窗口）；只在还没开局时才显示标题
  if (state === 'boot') { state = 'title'; ui.show('title'); }
  renderer.draw(demoRun, 1);
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
  debug: { layout: () => ({ viewport: [canvas.clientWidth, canvas.clientHeight], touch: !!touchLayer }) },
};
