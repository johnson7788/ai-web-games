// 主入口：COLOR TAP。状态机 title → playing ⇄ paused → complete。
import { WORLD, GRID, PALETTE, COLORS, RULES, CONFIG } from '../config/game.config.js';
import { PICTURES } from '../config/pictures.js';
import { createRun, selectColor, tapCell, useHint, getHud, drainEvents, PICTURE_COUNT } from './game/sim.js';
import { createRenderer } from './render/index.js';
import { preload } from './render/art.js';
import { ui } from './ui/ui.js';
import { audio } from './audio.js';
import Sdk from './core/sdk.js';
import { t, i18n } from './core/i18n.js';

const canvas = document.getElementById('canvas');
const renderer = createRenderer(canvas);
preload((p) => renderer.setLoading(p));

let pictureIndex = 0;
let run = createRun({ pictureIndex: 0 });
let state = 'title';
let done = Sdk.load('done', 0);
let lastTime = performance.now();

const llState = { phase: 'title', lang: ui.lang, dir: ui.dir };

function syncLl() {
  llState.phase = state;
  llState.lang = ui.lang;
  llState.dir = ui.dir;
}
function pictureName() {
  return run.name[i18n.lang] || run.name.en;
}
function syncUi() {
  ui.updateHUD(getHud(run), pictureName());
  ui.renderPalette(run);
}

// ---- 事件 → 表现 ---------------------------------------------------------
function processEvents() {
  for (const ev of drainEvents(run)) {
    if (ev.type === 'fill') {
      audio.fill(run.filledCount);
      Sdk.track('fill', { color: ev.color });
    } else if (ev.type === 'complete') {
      onComplete();
    }
  }
}

function doTap(r, c) {
  const res = tapCell(run, r, c);
  if (res.kind === 'wrong') {
    audio.wrong();
    renderer.flashWrong(r, c);
  }
  processEvents();
  syncUi();
  return res;
}

// ---- 状态机 --------------------------------------------------------------
function startPicture(idx) {
  pictureIndex = idx % PICTURE_COUNT;
  run = createRun({ pictureIndex });
  renderer.clearEffects();
  state = 'playing';
  syncLl();
  Sdk.newRun({ mode: 'colorbynumber', picture: pictureIndex });
  ui.showGame();
  syncUi();
  lastTime = performance.now();
}
function startGame() {
  startPicture(pictureIndex);
}
function nextPicture() {
  startPicture(pictureIndex + 1);
}
function backToTitle() {
  state = 'title';
  syncLl();
  ui.showTitle();
  ui.updateBest(done);
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
function onComplete() {
  state = 'complete';
  syncLl();
  done += 1;
  Sdk.save('done', done);
  Sdk.levelCleared({ picture: pictureIndex });
  ui.showComplete(pictureName());
  audio.complete();
}
function doHint() {
  const h = useHint(run);
  if (h) {
    processEvents();
    syncUi();
  } else {
    audio.wrong();
  }
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
  const cell = renderer.hitCell(p.x, p.y, run);
  if (cell) doTap(cell.r, cell.c);
});
ui.palette.addEventListener('click', (e) => {
  const btn = e.target.closest('.swatch');
  if (!btn || btn.disabled) return;
  selectColor(run, Number(btn.dataset.color));
  audio.select();
  syncUi();
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (state === 'playing') pauseGame();
    else if (state === 'paused') resumeGame();
  }
  if (state === 'playing') {
    const n = Number(e.key);
    if (n >= 1 && n <= 9 && run.colors.includes(n)) { selectColor(run, n); audio.select(); syncUi(); }
    if (e.code === 'KeyH') doHint();
  }
});
window.addEventListener('blur', () => { if (state === 'playing') pauseGame(); });

// ---- 按钮 ----------------------------------------------------------------
ui.btnStart.addEventListener('click', () => { audio.unlock(); startGame(); });
ui.btnResume.addEventListener('click', resumeGame);
ui.btnRestart.addEventListener('click', () => startPicture(pictureIndex));
ui.btnNext.addEventListener('click', nextPicture);
ui.btnTitle.addEventListener('click', backToTitle);
ui.btnHint.addEventListener('click', doHint);
ui.btnMute.addEventListener('click', doMute);
ui.btnPause.addEventListener('click', () => { if (state === 'playing') pauseGame(); });
for (const sel of ui.langSelects) {
  if (sel) sel.addEventListener('change', (e) => { ui.setLang(e.target.value); syncLl(); syncUi(); });
}

Sdk.onAdStart(() => pauseGame());
Sdk.onAdEnd(() => resumeGame());

// ---- 主循环 --------------------------------------------------------------
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  renderer.update(dt);
  renderer.render({ run, phase: state });
}

// ---- 初始化 --------------------------------------------------------------
Sdk.ready();
audio.setMuted(Sdk.load('muted', false));
ui.applyLang();
ui.showTitle();
ui.updateBest(done);
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
  startAct: (n) => startPicture(n || 0),
  sim: run,
  save: (k, v) => Sdk.save(k, v),
  load: (k, d) => Sdk.load(k, d),
  ui: () => ui,
  debug: {
    state: () => getHud(run),
    select: (color) => { selectColor(run, color); syncUi(); return run.selectedColor; },
    tap: (r, c) => doTap(r, c),
    hint: () => { const h = useHint(run); processEvents(); syncUi(); return h; },
    solve: () => {
      for (let r = 0; r < run.size; r += 1) {
        for (let c = 0; c < run.size; c += 1) {
          const v = run.grid[r][c];
          if (v > 0 && !run.filled[r][c]) { selectColor(run, v); tapCell(run, r, c); }
        }
      }
      processEvents();
      syncUi();
      return getHud(run);
    },
    setPicture: (n) => { startPicture(n); return getHud(run); },
  },
};