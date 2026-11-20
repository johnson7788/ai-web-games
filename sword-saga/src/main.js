// src/main.js — 装配：固定步长 / 输入 / 事件分发 / 状态机 / SDK / 教程 / 程序化 BGM（Lead 所有）
import { STEP } from '../config/game.config.js';
import { createRun } from './game/sim.js';
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

let state = 'boot';              // boot | title | playing | paused | victory | dead
let run = null;
let lastTime = 0;
let accumulator = 0;
let moveDir = { x: 0, y: 0 };
let menuCommand = null;          // 战斗菜单命令（UI 点击写入，逐帧消费）
let advanceHeld = false;         // 对话推进
let bestChapter = 1;
let bgmMode = null;

// ---------- 输入（边沿检测归 main） ----------
const keys = { left: false, right: false, up: false, down: false };
const touch = { left: false, right: false, up: false, down: false };

function updateMoveDir() {
  moveDir = {
    x: (keys.right || touch.right ? 1 : 0) - (keys.left || touch.left ? 1 : 0),
    y: (keys.down || touch.down ? 1 : 0) - (keys.up || touch.up ? 1 : 0),
  };
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;
  if (e.code === 'ArrowUp' || e.code === 'KeyW') keys.up = true;
  if (e.code === 'ArrowDown' || e.code === 'KeyS') keys.down = true;
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'KeyR' && (state === 'dead' || state === 'victory')) startGame();
  if ((e.code === 'Enter' || e.code === 'Space') && state === 'title') startGame();
  if ((e.code === 'Enter' || e.code === 'Space') && state === 'playing' && run?.mode === 'dialog') advanceHeld = true;
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
  if (e.code === 'ArrowUp' || e.code === 'KeyW') keys.up = false;
  if (e.code === 'ArrowDown' || e.code === 'KeyS') keys.down = false;
});

// 触屏方向键
const touchPad = document.getElementById('touch-pad');
if (touchPad) {
  const dirFrom = (d) => ({ up: 'up', down: 'down', left: 'left', right: 'right' }[d]);
  const setTouch = (d, on) => { const k = dirFrom(d); if (k) touch[k] = on; };
  touchPad.addEventListener('pointerdown', (e) => {
    const btn = e.target.closest('.tp-btn');
    if (btn) { e.preventDefault(); audio.unlock(); setTouch(btn.dataset.dir, true); }
  });
  touchPad.addEventListener('pointerup', (e) => {
    const btn = e.target.closest('.tp-btn');
    if (btn) setTouch(btn.dataset.dir, false);
  });
  touchPad.addEventListener('pointercancel', () => { touch.left = touch.right = touch.up = touch.down = false; });
  touchPad.addEventListener('pointerleave', () => { touch.left = touch.right = touch.up = touch.down = false; });
}

// 触屏/点击：对话推进；地图点击也推进（宽松交互）
canvas.addEventListener('pointerdown', () => {
  audio.unlock();
  if (state === 'playing' && run?.mode === 'dialog') advanceHeld = true;
});

// ---------- UI ----------
const ui = createUI(uiRoot, {
  onStart: () => startGame(),
  onResume: () => resumeGame(),
  onRestart: () => startGame(),
  onShare: () => shareResult(),
  onHow: () => { /* 重看引导 */ },
  onBattleCommand: (cmd) => { menuCommand = cmd; },
  onDialogAdvance: () => { advanceHeld = true; },
}, { canvas });
ui.onTutorial((result) => {
  Sdk.track('tutorial_done', { skipped: !!result?.skipped });
});
ui.setBest(bestChapter);

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
  accumulator = 0;
  lastTime = performance.now();
  menuCommand = null;
  advanceHeld = false;
  ui.show('playing');
  Sdk.newRun({ chapter: 1 });
  setBgmForRun();
  applyAudioSettings();
  ui.setHud(run.getHud());
}

function togglePause() {
  if (state === 'playing') { state = 'paused'; ui.show('paused'); }
  else if (state === 'paused') resumeGame();
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
  bgmMode = null;
}

function onEnd(victory) {
  state = victory ? 'victory' : 'dead';
  const chapter = Math.max(1, run.stats.chaptersCleared || run.chapter);
  if (chapter > bestChapter) { bestChapter = chapter; Sdk.save('bestChapter', bestChapter); }
  ui.setBest(bestChapter);
  ui.show(victory ? 'victory' : 'dead', { victory, chapter });
  if (victory) Sdk.levelCleared({ chapter });
  else Sdk.gameOver({ chapter });
  audio.stopBgm();
  bgmMode = null;
}

async function shareResult() {
  const chapter = Math.max(1, run?.stats?.chaptersCleared || 0);
  await Sdk.share({
    title: 'SWORD SAGA',
    text: i18n.lang === 'zh' ? `我在《云隐剑歌》通关了第 ${chapter} 章！` : `I cleared chapter ${chapter} in SWORD SAGA!`,
  });
  Sdk.track('share', { chapter });
}

function setBgmForRun() {
  const scene = run?.scene || 1;
  const name = scene === 1 ? 'bamboo' : scene === 2 ? 'snow' : 'tower';
  const isBossBattle = run?.mode === 'battle' && run.battle?.boss;
  const want = isBossBattle ? 'boss' : name;
  if (bgmMode === want) return;
  bgmMode = want;
  audio.playBgm(want);
}

// ---------- 事件分发 ----------
function dispatchEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);

    if (ev.type === 'inkWash') renderer.ink(ev.element);

    if (state === 'playing') ui.tutorial.onGameEvent(ev);

    if (ev.type === 'chapterStart') Sdk.track('chapterStart', { chapter: ev.chapter });
    else if (ev.type === 'victory') Sdk.track('battleWin', { chapter: ev.chapter, boss: !!ev.boss });
    else if (ev.type === 'enemyDown' && ev.boss) Sdk.track('bossDefeated', { chapter: run.chapter });
  }
}

// ---------- 主循环 ----------
function loop(now) {
  requestAnimationFrame(loop);

  if (state !== 'playing') {
    renderer.draw(state === 'paused' || state === 'victory' || state === 'dead' ? run : null, 1);
    return;
  }

  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  accumulator += dt;

  let steps = 0;
  while (accumulator >= STEP && steps < 6) {
    updateMoveDir();
    run.step({ dir: moveDir, menu: menuCommand, advance: advanceHeld });
    menuCommand = null;
    advanceHeld = false;
    accumulator -= STEP;
    steps++;

    dispatchEvents(run.drainEvents());

    if (run.phase === 'victory') { onEnd(true); return; }
    if (run.phase === 'dead') { onEnd(false); return; }
  }

  setBgmForRun();
  renderer.draw(run, accumulator / STEP);
  ui.setHud(run.getHud());
  ui.tutorial.tick();
}

// ---------- 失焦自动暂停 ----------
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'playing') togglePause();
});

Sdk.onAdStart(() => audio.setMuted(true));
Sdk.onAdEnd(() => { audio.setMuted(!!Sdk.load('muted', false)); });

// ---------- 启动 ----------
(async () => {
  bestChapter = Math.floor(Sdk.load('bestChapter', 1)) || 1;
  ui.setBest(bestChapter);
  applyAudioSettings();
  await Sdk.ready();
  Sdk.track('load', { lang: i18n.lang });
  // boot 竞态守卫：异步 boot 完成后只在还没开局时才显示标题
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
  debug: { layout: () => ({ viewport: [canvas.clientWidth, canvas.clientHeight], mode: run?.mode || 'title' }) },
};
