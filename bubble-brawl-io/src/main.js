// BUBBLE BRAWL IO · 主入口：60Hz 固定步长装配 sim / render / ui / audio / sdk。
import { STEP } from '../config/game.config.js';
import { LEVELS } from '../config/levels.js';
import { createRun } from './game/sim.js';
import { createRenderer } from './render/index.js';
import { ui, tutorial } from './ui/ui.js';
import { createAudio } from './core/audio.js';
import { Sdk } from './core/sdk.js';
import { save } from './core/save.js';
import { i18n } from './core/i18n.js';

const canvas = document.getElementById('canvas');
const renderer = createRenderer(canvas);
const audio = createAudio();

let run = createRun(0);
let phase = 'title'; // title | playing | paused | result
let levelIndex = 0;
let lastTime = 0;
let accumulator = 0;
let muted = false;
let pendingFire = false;

const input = { left: false, right: false };

// ---------- 阶段切换 ----------
function beginLevel(idx) {
  levelIndex = Math.max(0, Math.min(LEVELS.length - 1, idx));
  run = createRun(levelIndex, { seed: (Date.now() & 0xffff) ^ levelIndex });
  phase = 'playing';
  ui.showGame();
  audio.unlock();
  audio.startBgm();
  Sdk.newRun({ level: levelIndex + 1 });
  renderer.render(run.state, 0, []);
}

function startGame(idx = 0) {
  beginLevel(idx);
  if (!tutorial.seen) tutorial.show();
}

function restartLevel() {
  beginLevel(levelIndex);
  tutorial.hide();
}

function goTitle() {
  phase = 'title';
  tutorial.hide();
  audio.stopBgm();
  ui.showTitle(save.getBest());
  renderer.render(null, 0, []);
}

function pauseGame() {
  if (phase === 'playing') { phase = 'paused'; ui.showPause(); }
}

function resumeGame() {
  if (phase === 'paused') { phase = 'playing'; ui.hidePause(); lastTime = performance.now(); }
}

function onEnd(won) {
  phase = 'result';
  const score = run.state.score;
  const stars = run.state.stars;
  const best = save.getBest();
  const isNew = score > best;
  if (isNew) save.setBest(score);
  if (won) {
    Sdk.levelCleared({ level: levelIndex + 1, score });
    const unlocked = Math.max(save.getUnlocked(), levelIndex + 2);
    save.setUnlocked(unlocked);
  } else {
    Sdk.gameOver({ level: levelIndex + 1, score });
  }
  ui.showResult({
    won,
    stars,
    score,
    best: Math.max(best, score),
    isNew,
    canNext: won && levelIndex + 1 < LEVELS.length,
  });
  audio.stopBgm();
}

// ---------- 输入 ----------
function fireInput() {
  if (phase === 'playing' && !tutorial.active) pendingFire = true;
}

function keyToDir(e) {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') return -1;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') return 1;
  return 0;
}

window.addEventListener('keydown', (e) => {
  const d = keyToDir(e);
  if (d < 0) input.left = true;
  if (d > 0) input.right = true;
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); fireInput(); }
  if (e.code === 'Escape') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
  if (e.code === 'KeyR') { e.preventDefault(); restartLevel(); }
  if ((e.code === 'Space' || e.code === 'Enter') && phase === 'result') { e.preventDefault(); restartLevel(); }
});
window.addEventListener('keyup', (e) => {
  const d = keyToDir(e);
  if (d < 0) input.left = false;
  if (d > 0) input.right = false;
});

// 触屏/鼠标：左 1/3 左移，右 1/3 右移，中间发射
function pointerDir(clientX) {
  const rect = canvas.getBoundingClientRect();
  const x = (clientX - rect.left) / rect.width;
  if (x < 0.28) return -1;
  if (x > 0.72) return 1;
  return 0;
}
let activePointerDir = 0;
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  const d = pointerDir(e.clientX);
  if (d === 0) fireInput();
  else { activePointerDir = d; input.left = d < 0; input.right = d > 0; }
});
window.addEventListener('pointerup', () => { if (activePointerDir < 0) input.left = false; if (activePointerDir > 0) input.right = false; activePointerDir = 0; });
window.addEventListener('pointercancel', () => { input.left = false; input.right = false; activePointerDir = 0; });

// ---------- UI 事件 ----------
ui.els.btnStart.addEventListener('click', () => startGame(0));
ui.els.btnResume.addEventListener('click', resumeGame);
ui.els.btnNext.addEventListener('click', () => startGame(levelIndex + 1));
document.getElementById('btn-restart').addEventListener('click', restartLevel);
document.getElementById('btn-restart2').addEventListener('click', restartLevel);
document.getElementById('btn-pause').addEventListener('click', pauseGame);
document.getElementById('btn-mute').addEventListener('click', () => {
  muted = audio.setMuted(!muted);
  ui.setMuted(muted);
});
for (const id of ['btn-home', 'btn-home2', 'btn-home3']) {
  const b = document.getElementById(id);
  if (b) b.addEventListener('click', goTitle);
}
for (const sel of ui.els.langSelects) {
  if (sel) sel.addEventListener('change', (e) => ui.setLang(e.target.value));
}
document.getElementById('tut-skip').addEventListener('click', () => tutorial.skip());
document.getElementById('tut-next').addEventListener('click', () => tutorial.next());
for (const replay of document.querySelectorAll('[data-tutorial-replay]')) {
  replay.addEventListener('click', () => tutorial.show());
}
document.getElementById('btn-retry').addEventListener('click', restartLevel);

// ---------- 主循环 ----------
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  const playing = phase === 'playing' && !tutorial.active;
  if (playing) {
    accumulator += dt;
    while (accumulator >= STEP) {
      if (pendingFire) { run.fire(); pendingFire = false; }
      run.setInput(input);
      run.step(STEP);
      accumulator -= STEP;
    }
  } else {
    accumulator = 0;
  }

  const events = run.drainEvents();
  for (const e of events) audio.event(e.type, e);

  if (playing && (run.state.phase === 'won' || run.state.phase === 'lost')) {
    onEnd(run.state.phase === 'won');
  }

  renderer.render(run.state, dt, events);
  ui.updateHUD(run.getHud());
}

// ---------- 启动 ----------
ui.applyLang();
ui.showTitle(save.getBest());
ui.setMuted(muted);
renderer.render(null, 0, []);
lastTime = performance.now();
requestAnimationFrame(loop);

// SDK 就绪（加载 vendored pipysdk，为 sdk-check 提供 window.PipyGames）
Sdk.ready();

// ---------- 标准调试契约 ----------
window.G = {
  run: () => run,
  state: () => run.state,
  save,
};

window.__ll = {
  get state() {
    return { phase, lang: i18n.lang, dir: i18n.dir };
  },
  lang: () => i18n.lang,
  setLang: (lang) => ui.setLang(lang),
  get run() { return run; },
  start: (idx = 0) => startGame(idx),
  startAct: (idx = 0) => startGame(idx),
  pause: pauseGame,
  resume: resumeGame,
  restart: goTitle,
  save: () => save,
  ui: () => ui,
  debug: {
    state: () => run.state,
    startSeeded: (seed, idx = 0) => {
      levelIndex = idx; run = createRun(idx, { seed }); phase = 'playing'; ui.showGame();
    },
  },
  tutorial: {
    get active() { return tutorial.active; },
    get step() { return tutorial.step; },
    get steps() { return tutorial.steps; },
    get current() { return tutorial.current; },
    skip: () => tutorial.skip(),
  },
  startTutorial: () => tutorial.show(),
};
