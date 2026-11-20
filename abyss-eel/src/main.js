// src/main.js — 装配：固定步长 / 输入 / 事件分发 / 状态机 / SDK / BGM（Lead 所有）
import { STEP, WORLD } from '../config/game.config.js';
import { createRun } from './game/sim.js';
import { createRender } from './render/index.js';
import { createUI } from './ui/index.js';
import { createAudio } from './core/audio.js';
import { i18n } from './core/i18n.js';
import Sdk from './core/sdk.js';

// ---------- 装配 ----------
const canvas = document.getElementById('canvas');
const uiRoot = document.getElementById('ui-root');
const btnDash = document.getElementById('btn-dash');
const loadingEl = document.getElementById('loading');

const renderer = createRender(canvas);
const audio = createAudio();

// ---------- 状态 ----------
let state = 'boot';             // boot | title | playing | dead
let run = null;
let lastTime = 0;
let accumulator = 0;
let steerX = null;              // 绝对目标 x（0..1280）
let dashHeld = false;
let bgmMode = 'none';           // none | main | boss
let bestDepth = 0;
let steerMoved = false;         // 教程：真实拖动信号

// ---------- 输入（边沿检测归 main） ----------
const keys = { left: false, right: false };
let keyVelX = 0;                // 键盘虚拟目标
let pointerX = null;

function canvasToWorldX(clientX) {
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(rect.width / WORLD.WIDTH, rect.height / WORLD.HEIGHT);
  const ox = (rect.width - WORLD.WIDTH * scale) / 2;
  return (clientX - rect.left - ox) / scale;
}

function updateSteerFromInputs() {
  // 优先级：键盘方向 > 指针位置
  if (keys.left || keys.right) {
    keyVelX += (keys.right ? 1 : 0) * 14 - (keys.left ? 1 : 0) * 14;
    keyVelX = Math.max(-26, Math.min(26, keyVelX));
    if (steerX == null) steerX = WORLD.WIDTH / 2;
    steerX = Math.max(0, Math.min(WORLD.WIDTH, steerX + keyVelX));
    if (Math.abs(keyVelX) > 2) steerMoved = true;
  } else {
    keyVelX = 0;
    if (pointerX != null) steerX = pointerX;
  }
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;
  if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
    dashHeld = true;
    e.preventDefault();
  }
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'KeyR' && state === 'dead') startGame();
  if (e.code === 'Enter' && state === 'title') startGame();
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
  if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') dashHeld = false;
});

// 指针：桌面 hover / 拖动都转向
canvas.addEventListener('pointermove', (e) => {
  pointerX = canvasToWorldX(e.clientX);
  if (pointerX != null && state === 'playing') steerMoved = true;
});
canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  pointerX = canvasToWorldX(e.clientX);
  if (e.pointerType === 'touch') {
    // 单指按下即转向；第二指按下 = 冲刺
    if (activePointers.size === 1) dashHeld = true;
  }
});
const activePointers = new Set();
canvas.addEventListener('pointerdown', (e) => activePointers.add(e.pointerId));
canvas.addEventListener('pointerup', (e) => {
  activePointers.delete(e.pointerId);
  if (activePointers.size <= 1) dashHeld = false;   // 多指松到一指以下即停冲刺
});
canvas.addEventListener('pointercancel', (e) => {
  activePointers.delete(e.pointerId);
  if (activePointers.size <= 1) dashHeld = false;
});
canvas.addEventListener('pointerleave', () => { pointerX = null; });

// 触屏冲刺按钮（非精确指针设备显示）
if (window.matchMedia && matchMedia('(pointer: coarse)').matches) btnDash.hidden = false;
btnDash.addEventListener('pointerdown', (e) => { e.preventDefault(); audio.unlock(); dashHeld = true; });
btnDash.addEventListener('pointerup', () => { dashHeld = false; });
btnDash.addEventListener('pointercancel', () => { dashHeld = false; });

// ---------- UI ----------
const ui = createUI(uiRoot, {
  onDive: () => startGame(),
  onResume: () => resumeGame(),
  onRestart: () => startGame(),
  onShare: () => shareResult(),
  onHow: () => { /* 重看引导：标题屏点进来时直接开一局更顺 */ },
});
ui.onTutorial((result) => {
  // 教程完成/跳过 → 持久化在 TutorialMachine 内部已做
  Sdk.track('tutorial_done', { skipped: !!result?.skipped });
});
ui.setBest(bestDepth);

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
  steerX = WORLD.WIDTH / 2;
  pointerX = null;
  dashHeld = false;
  accumulator = 0;
  lastTime = performance.now();
  ui.show('playing');
  Sdk.newRun({ zone: 1 });
  setBgm('main');
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
  // 回标题（死→R 键直接重潜的路径在 keydown 里独立处理）
  state = 'title';
  run = null;
  ui.show('title');
  renderer.draw(null, 1);
  setBgm('none');
}

function onDeath() {
  state = 'dead';
  const stats = run.stats || {};
  const depth = Math.floor(stats.depth ?? run.depth ?? 0);
  const isRecord = depth > bestDepth;
  if (isRecord) {
    bestDepth = depth;
    Sdk.save('bestDepth', bestDepth);
  }
  const bestCombo = Math.max(stats.maxCombo || 0, Sdk.load('bestCombo', 0));
  Sdk.save('bestCombo', bestCombo);
  ui.setBest(bestDepth);
  ui.show('dead', {
    depth,
    maxCombo: stats.maxCombo || 0,
    zoneReached: stats.zoneReached || 1,
    best: bestDepth,
    newRecord: isRecord,
  });
  Sdk.gameOver({ depth, maxCombo: stats.maxCombo || 0, zone: stats.zoneReached || 1 });
  setBgm('none');
}

// ---------- BGM 切换 ----------
async function shareResult() {
  const depth = Math.floor(run?.stats?.depth ?? 0);
  await Sdk.share({
    title: 'ABYSS EEL',
    text: `${i18n.lang === 'zh' ? `我潜到了 ${depth}m 深处！` : `I dove to ${depth}m in the abyss!`} ABYSS EEL`,
  });
  Sdk.track('share', { depth });
}

function setBgm(mode) {
  if (bgmMode === mode) return;
  bgmMode = mode;
  audio.stopBgm();
  if (mode === 'main') audio.playBgm('assets/audio/bgm-main.mp3');
  else if (mode === 'boss') audio.playBgm('assets/audio/bgm-boss.mp3');
}

// ---------- 事件分发 ----------
function dispatchEvents(events) {
  for (const ev of events) {
    // 音效（M4 内部去重）
    audio.event(ev.type, ev);

    // 视觉粒子
    if (ev.type === 'wallBreak') renderer.burst(ev.x, ev.y, 'pop');
    else if (ev.type === 'orbGain') renderer.burst(ev.x, ev.y, ev.kind === 'gold' ? 'gold' : 'pop');
    else if (ev.type === 'urchinCut') renderer.burst(ev.x, ev.y, 'cut');
    else if (ev.type === 'bossBreak') renderer.burst(ev.x, ev.y, 'boss');

    // 教程
    if (state === 'playing') ui.tutorial.onGameEvent(ev, performance.now());

    // 关键埋点（失败不影响玩法）
    if (ev.type === 'zoneEnter') Sdk.track('zone_enter', { zone: ev.zone });
    else if (ev.type === 'bossBreak') Sdk.track('boss_break', { depth: Math.floor(run.depth) });
  }
}

// ---------- 主循环 ----------
function loop(now) {
  requestAnimationFrame(loop);

  if (state !== 'playing') {
    renderer.draw(state === 'paused' || state === 'dead' ? run : null, 1);
    return;
  }

  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  accumulator += dt;

  let steps = 0;
  while (accumulator >= STEP && steps < 6) {
    updateSteerFromInputs();
    run.step({ steerX, dash: dashHeld });
    accumulator -= STEP;
    steps++;
    if (steerMoved) {
      ui.tutorial.onGameEvent({ type: 'steer' }, performance.now());
      steerMoved = false;
    }
    dispatchEvents(run.drainEvents());
    if (run.phase === 'dead') { onDeath(); return; }
  }

  // Boss 出现切 BGM
  const hud = run.getHud();
  setBgm(hud.bossHp > 0 ? 'boss' : 'main');

  renderer.setDash(!!hud.dashActive || dashHeld);
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
  bestDepth = Math.floor(Sdk.load('bestDepth', 0)) || 0;
  ui.setBest(bestDepth);
  applyAudioSettings();
  await Sdk.ready();
  Sdk.track('load', { lang: i18n.lang });
  // 玩家可能在 boot 期间已点 Dive（异步 SDK 加载窗口）；只在还没开局时才显示标题
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
  debug: { layout: () => ({ viewport: [canvas.clientWidth, canvas.clientHeight], dash: !btnDash.hidden }) },
};
