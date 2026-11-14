// 主入口：WORD TRAILS。状态机 title → playing ⇄ paused → clear。
// 字母环拖拽拼词 + 关卡进度 + 提示/重排。
import { WORLD, RING, COLORS, RULES, CONFIG } from '../config/game.config.js';
import { LEVELS } from '../config/levels.js';
import {
  createRun, submitWord, useHint, shuffleRing, getHud, drainEvents, computeStars, LEVEL_COUNT,
} from './game/sim.js';
import { createRenderer } from './render/index.js';
import { ui } from './ui/ui.js';
import { audio } from './audio.js';
import Sdk from './core/sdk.js';
import { t as t2 } from './core/i18n.js';

const canvas = document.getElementById('canvas');
const renderer = createRenderer(canvas);
const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

let run = createRun({ levelIndex: 0, seed: 1 });
let state = 'title'; // title | playing | paused | clear
let selection = [];
let dragging = false;
let pointer = null;
let foundFlash = null;
let lastTime = performance.now();

let progress = Sdk.load('progress', { level: 0, best: 0, stars: {} });
if (!progress || typeof progress.level !== 'number') progress = { level: 0, best: 0, stars: {} };

const llState = { phase: 'title', lang: ui.lang, dir: ui.dir };

function syncLl() {
  llState.phase = state;
  llState.lang = ui.lang;
  llState.dir = ui.dir;
}
function syncUi() {
  ui.updateHUD(getHud(run));
  ui.updateHint(RULES.hintLimit - run.hintsUsed);
}
function saveProgress() {
  Sdk.save('progress', progress);
}

// ---- 事件 → 表现 ---------------------------------------------------------
function processEvents() {
  const now = performance.now();
  for (const ev of drainEvents(run)) {
    if (ev.type === 'found') {
      audio.found(ev.streak);
      const wi = run.words.indexOf(ev.word);
      const row = renderer.wordRowRect(run, wi);
      const cx = row.x + row.w / 2;
      const cy = row.y + row.h / 2;
      renderer.burst(cx, cy, COLORS.tileFound, 16);
      renderer.popup(`+${ev.gained}`, cx, cy - 26, COLORS.accent);
      if (ev.streak > 1) renderer.popup(`${t2('streak')} ×${ev.streak}`, cx, cy + 30, COLORS.gold);
      foundFlash = { wordIdx: wi, until: now + 420 };
      Sdk.track('word_found', { word: ev.word, streak: ev.streak });
    } else if (ev.type === 'clear') {
      onLevelClear(ev);
    } else if (ev.type === 'hint') {
      audio.hint();
    } else if (ev.type === 'shuffle') {
      audio.shuffle();
    }
  }
}

// 轻量文案出口（避免在事件里反复 import）

function doSubmit(word) {
  const r = submitWord(run, word);
  if (r.kind === 'invalid') {
    audio.invalid();
    if (!REDUCED) renderer.shake(6);
    renderer.popup(t2('notWord'), RING.CX, RING.WORD_Y - 60, COLORS.danger);
  } else if (r.kind === 'short') {
    audio.invalid();
    renderer.popup(t2('tooShort'), RING.CX, RING.WORD_Y - 60, COLORS.danger);
  } else if (r.kind === 'already') {
    audio.click();
    renderer.popup(t2('already'), RING.CX, RING.WORD_Y - 60, COLORS.gold);
  }
  processEvents();
  syncUi();
  return r;
}

// ---- 状态机 --------------------------------------------------------------
function startGame(levelIndex = progress.level) {
  const idx = Math.max(0, Math.min(levelIndex, LEVEL_COUNT - 1));
  run = createRun({ levelIndex: idx, seed: Math.floor(Math.random() * 0x7fffffff) });
  selection = [];
  dragging = false;
  foundFlash = null;
  renderer.clearEffects();
  state = 'playing';
  syncLl();
  Sdk.newRun({ mode: 'levels', level: idx });
  ui.showGame();
  syncUi();
  lastTime = performance.now();
}

function backToTitle() {
  selection = [];
  dragging = false;
  state = 'title';
  syncLl();
  ui.showTitle();
  ui.updateBest(progress.best, Math.min(progress.level + 1, LEVEL_COUNT));
}

function pauseGame() {
  if (state !== 'playing') return;
  state = 'paused';
  dragging = false;
  selection = [];
  syncLl();
  ui.showPause();
}
function resumeGame() {
  if (state !== 'paused') return;
  state = 'playing';
  syncLl();
  ui.hidePause();
  lastTime = performance.now();
}

function onLevelClear(ev) {
  state = 'clear';
  selection = [];
  dragging = false;
  syncLl();
  const stars = computeStars(run.hintsUsed);
  const prev = progress.stars[run.levelIndex] || 0;
  progress.stars[run.levelIndex] = Math.max(prev, stars);
  progress.level = Math.max(progress.level, Math.min(run.levelIndex + 1, LEVEL_COUNT - 1));
  progress.best = Math.max(progress.best, run.score);
  saveProgress();
  Sdk.levelCleared({ level: run.levelIndex + 1, stars, score: run.score });
  const isLast = run.levelIndex >= LEVEL_COUNT - 1;
  ui.showClear(stars, run.score, isLast);
  audio.clear();
}

function nextLevel() {
  if (run.levelIndex >= LEVEL_COUNT - 1) startGame(0);
  else startGame(run.levelIndex + 1);
}

function doHint() {
  const h = useHint(run);
  if (h) {
    processEvents();
    const row = renderer.wordRowRect(run, h.wordIdx);
    renderer.popup(h.char, row.x + h.pos * 46 + 20, row.y - 16, COLORS.gold);
    syncUi();
  } else {
    renderer.popup(t2('noHints'), RING.CX, RING.WORD_Y - 60, COLORS.danger);
  }
}
function doShuffle() {
  shuffleRing(run);
  selection = [];
  processEvents();
}
function doMute() {
  audio.setMuted(!audio.muted);
  Sdk.save('muted', audio.muted);
  ui.updateMute(audio.muted);
}

// ---- 环形拖拽输入 --------------------------------------------------------
function canvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (canvas.width / rect.width),
    y: (e.clientY - rect.top) * (canvas.height / rect.height),
  };
}

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (state !== 'playing') return;
  const p = canvasPos(e);
  const idx = renderer.hitRing(p.x, p.y, run.ring.length);
  if (idx >= 0) {
    dragging = true;
    selection = [idx];
    pointer = p;
    audio.select(0);
    try { canvas.setPointerCapture(e.pointerId); } catch { /* noop */ }
  }
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const p = canvasPos(e);
  pointer = p;
  const idx = renderer.hitRing(p.x, p.y, run.ring.length);
  if (idx >= 0 && !selection.includes(idx)) {
    selection.push(idx);
    audio.select(selection.length - 1);
  }
});
function endDrag(e) {
  if (!dragging) return;
  dragging = false;
  pointer = null;
  try { canvas.releasePointerCapture(e.pointerId); } catch { /* noop */ }
  const word = selection.map((i) => run.ring[i]).join('');
  selection = [];
  if (word) doSubmit(word);
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', () => { dragging = false; selection = []; pointer = null; });

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (state === 'playing') pauseGame();
    else if (state === 'paused') resumeGame();
  }
});
window.addEventListener('blur', () => { if (state === 'playing') pauseGame(); });

// ---- 按钮 ----------------------------------------------------------------
ui.btnStart.addEventListener('click', () => { audio.unlock(); startGame(progress.level); });
ui.btnResume.addEventListener('click', resumeGame);
ui.btnRestart.addEventListener('click', () => startGame(run.levelIndex));
ui.btnNext.addEventListener('click', nextLevel);
ui.btnTitle.addEventListener('click', backToTitle);
ui.btnHint.addEventListener('click', doHint);
ui.btnShuffle.addEventListener('click', doShuffle);
ui.btnMute.addEventListener('click', doMute);
ui.btnPause.addEventListener('click', () => { if (state === 'playing') pauseGame(); });
for (const sel of ui.langSelects) {
  if (sel) sel.addEventListener('change', (e) => { ui.setLang(e.target.value); syncLl(); });
}

Sdk.onAdStart(() => pauseGame());
Sdk.onAdEnd(() => resumeGame());

// ---- 主循环 --------------------------------------------------------------
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  if (state === 'playing' || state === 'clear') renderer.update(dt);
  renderer.render({
    run,
    selection,
    pointer: dragging ? pointer : null,
    currentWord: selection.map((i) => run.ring[i]).join(''),
    panelTitle: t2('findWords'),
    wordPlaceholder: '· · ·',
    ringHint: '',
    foundFlash,
    now,
  });
  if (state === 'playing') syncUi();
}

// ---- 初始化 --------------------------------------------------------------
Sdk.ready();
audio.setMuted(Sdk.load('muted', false));
ui.applyLang();
ui.showTitle();
ui.updateBest(progress.best, Math.min(progress.level + 1, LEVEL_COUNT));
ui.updateMute(audio.muted);
syncLl();
syncUi();
requestAnimationFrame(loop);

// ---- 调试契约 ------------------------------------------------------------
window.G = { run: () => run, state: () => state, ui };

window.__ll = {
  state: llState,
  start: () => startGame(progress.level),
  pause: pauseGame,
  resume: resumeGame,
  restart: backToTitle,
  startAct: (n) => startGame(n || 0),
  sim: run,
  save: (k, v) => Sdk.save(k, v),
  load: (k, d) => Sdk.load(k, d),
  ui: () => ui,
  debug: {
    state: () => ({ ...getHud(run), words: run.words, found: [...run.found], ring: run.ring }),
    submit: (w) => doSubmit(w),
    hint: () => { const h = useHint(run); processEvents(); syncUi(); return h; },
    shuffle: () => { shuffleRing(run); processEvents(); return run.ring; },
    setLevel: (n) => startGame(n),
    solveLevel: () => {
      for (const w of [...run.words]) {
        if (!run.found.has(w)) doSubmit(w);
      }
      return getHud(run);
    },
  },
};