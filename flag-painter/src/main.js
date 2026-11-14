// 主入口：FLAG PAINTER。状态机 title → playing ⇄ paused → done。
import { WORLD, FLAG, PALETTE, COLORS, COLOR_KEYS, RULES, CONFIG } from '../config/game.config.js';
import {
  createRun, currentFlag, selectColor, paintBand, check, clearFlag, nextFlag, getHud, drainEvents, FLAG_COUNT,
} from './game/sim.js';
import { createRenderer } from './render/index.js';
import { preload } from './render/art.js';
import { ui } from './ui/ui.js';
import { audio } from './audio.js';
import Sdk from './core/sdk.js';
import { t, i18n } from './core/i18n.js';

const canvas = document.getElementById('canvas');
const renderer = createRenderer(canvas);

let run = createRun({ seed: 1 });
let state = 'title';
let best = Sdk.load('best', 0);
let lastTime = performance.now();

const llState = { phase: 'title', lang: ui.lang, dir: ui.dir };

function syncLl() {
  llState.phase = state;
  llState.lang = ui.lang;
  llState.dir = ui.dir;
}
function countryName() {
  const c = currentFlag(run).country;
  return c[i18n.lang] || c.en;
}
function refreshFlag() {
  ui.setCountry(t('paintThis'), countryName());
  ui.renderPalette(run.selectedColor);
  ui.setControls(run.phase);
  ui.setFeedback('', '');
}
function syncUi() {
  ui.updateHUD(getHud(run));
}

// ---- 事件 → 表现 ---------------------------------------------------------
function processEvents() {
  for (const ev of drainEvents(run)) {
    if (ev.type === 'done') {
      onDone();
    }
  }
}

function doPaint(index) {
  if (run.phase !== 'playing') return;
  paintBand(run, index);
  audio.paint();
  syncUi();
}
function doCheck() {
  const r = check(run);
  if (!r.ok) return;
  if (r.correct) {
    audio.correct();
    renderer.flashCorrect();
    ui.setFeedback(t('correct'), 'good');
    Sdk.track('correct', { score: run.score });
  } else {
    audio.wrong();
    renderer.flashWrong();
    ui.setFeedback(t('wrong'), 'bad');
  }
  ui.setControls(run.phase);
  processEvents();
  syncUi();
}
function doClear() {
  clearFlag(run);
  audio.click();
  ui.setControls(run.phase);
  ui.setFeedback('', '');
  syncUi();
}
function doNext() {
  nextFlag(run);
  processEvents();
  if (run.phase !== 'done') {
    refreshFlag();
    syncUi();
  }
}

// ---- 状态机 --------------------------------------------------------------
function startGame() {
  run = createRun({ seed: Math.floor(Math.random() * 0x7fffffff) });
  renderer.clearEffects();
  state = 'playing';
  syncLl();
  Sdk.newRun({ mode: 'flags' });
  ui.showGame();
  refreshFlag();
  syncUi();
  lastTime = performance.now();
}
function backToTitle() {
  state = 'title';
  syncLl();
  ui.showTitle();
  ui.updateBest(best);
}
function pauseGame() {
  if (state !== 'playing') return;
  state = 'paused';
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
function onDone() {
  state = 'done';
  syncLl();
  if (run.score > best) { best = run.score; Sdk.save('best', best); }
  Sdk.levelCleared({ score: run.score, flags: run.solved });
  ui.showDone(run.score);
  audio.done();
}
function doMute() {
  audio.setMuted(!audio.muted);
  Sdk.save('muted', audio.muted);
  ui.updateMute(audio.muted);
}

// ---- 输入 ----------------------------------------------------------------
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
  const band = renderer.hitBand(p.x, p.y, run, currentFlag(run).orient);
  if (band >= 0) doPaint(band);
});
ui.palette.addEventListener('click', (e) => {
  const btn = e.target.closest('.swatch');
  if (!btn) return;
  selectColor(run, btn.dataset.color);
  audio.click();
  ui.renderPalette(run.selectedColor);
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (state === 'playing') pauseGame();
    else if (state === 'paused') resumeGame();
  }
  if (state === 'playing') {
    if (e.code === 'Enter') { if (run.phase === 'correct') doNext(); else doCheck(); }
    const n = Number(e.key);
    if (n >= 1 && n <= 7) { selectColor(run, COLOR_KEYS[n - 1]); ui.renderPalette(run.selectedColor); }
  }
});
window.addEventListener('blur', () => { if (state === 'playing') pauseGame(); });

// ---- 按钮 ----------------------------------------------------------------
ui.btnStart.addEventListener('click', () => { audio.unlock(); startGame(); });
ui.btnResume.addEventListener('click', resumeGame);
ui.btnRestart.addEventListener('click', startGame);
ui.btnAgain.addEventListener('click', startGame);
ui.btnTitle.addEventListener('click', backToTitle);
ui.btnCheck.addEventListener('click', doCheck);
ui.btnClear.addEventListener('click', doClear);
ui.btnNext.addEventListener('click', doNext);
ui.btnMute.addEventListener('click', doMute);
ui.btnPause.addEventListener('click', () => { if (state === 'playing') pauseGame(); });
for (const sel of ui.langSelects) {
  if (sel) sel.addEventListener('change', (e) => { ui.setLang(e.target.value); syncLl(); if (state === 'playing') refreshFlag(); });
}

Sdk.onAdStart(() => pauseGame());
Sdk.onAdEnd(() => resumeGame());

// ---- 主循环 --------------------------------------------------------------
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  renderer.update(dt);
  renderer.render({ run, orient: currentFlag(run).orient });
}

// ---- 初始化 --------------------------------------------------------------
preload();
Sdk.ready();
audio.setMuted(Sdk.load('muted', false));
ui.applyLang();
ui.showTitle();
ui.updateBest(best);
ui.updateMute(audio.muted);
syncLl();
syncUi();
requestAnimationFrame(loop);

// ---- 调试契约 ------------------------------------------------------------
window.G = { run: () => run, state: () => state, ui };

window.__ll = {
  state: llState,
  start: startGame,
  pause: pauseGame,
  resume: resumeGame,
  restart: backToTitle,
  startAct: startGame,
  sim: run,
  save: (k, v) => Sdk.save(k, v),
  load: (k, d) => Sdk.load(k, d),
  ui: () => ui,
  debug: {
    state: () => getHud(run),
    select: (color) => { selectColor(run, color); ui.renderPalette(run.selectedColor); return run.selectedColor; },
    paint: (i) => { doPaint(i); return getHud(run); },
    check: () => { doCheck(); return getHud(run); },
    next: () => { doNext(); return getHud(run); },
    solve: () => {
      const flag = currentFlag(run);
      flag.colors.forEach((c, i) => { selectColor(run, c); paintBand(run, i); });
      doCheck();
      return getHud(run);
    },
    solveAll: () => {
      for (let i = 0; i < FLAG_COUNT; i += 1) {
        const flag = currentFlag(run);
        flag.colors.forEach((c, j) => { selectColor(run, c); paintBand(run, j); });
        check(run);
        nextFlag(run);
      }
      processEvents();
      syncUi();
      return getHud(run);
    },
  },
};