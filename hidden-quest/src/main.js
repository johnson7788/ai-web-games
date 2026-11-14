// 主入口：HIDDEN QUEST。状态机 title → playing ⇄ paused → clear。
import { WORLD, SCENE, COLORS, RULES, CONFIG } from '../config/game.config.js';
import { TYPE_BY_ID } from '../config/objects.js';
import { createRun, clickAt, useHint, nextLevel, getHud, drainEvents } from './game/sim.js';
import { createRenderer } from './render/index.js';
import { preload } from './render/art.js';
import { ui } from './ui/ui.js';
import { audio } from './audio.js';
import Sdk from './core/sdk.js';
import { t, i18n } from './core/i18n.js';

const canvas = document.getElementById('canvas');
const renderer = createRenderer(canvas);

// 一次性预载 AI 素材，画进度条；占位色块兜底，加载屏永不卡住。
const loadingEl = document.getElementById('loading');
const loadingFill = document.getElementById('loading-fill');
let loadingHidden = false;
function hideLoading() {
  if (loadingHidden) return;
  loadingHidden = true;
  if (loadingEl) loadingEl.classList.add('hidden');
}
preload((done, total) => {
  if (loadingFill) loadingFill.style.width = `${Math.round((done / total) * 100)}%`;
}).then(hideLoading);
setTimeout(hideLoading, 600); // ponytail: 素材未到位时占位色块兜底，不阻塞进入游戏

let run = createRun({ level: 1, seed: 1 });
let state = 'title';
let best = Sdk.load('best', 0);
let lastTime = performance.now();

const llState = { phase: 'title', lang: ui.lang, dir: ui.dir };

function syncLl() {
  llState.phase = state;
  llState.lang = ui.lang;
  llState.dir = ui.dir;
}
function refreshTargets() {
  ui.renderTargets(run.targets, run.found, i18n.lang);
}
function syncUi() {
  ui.updateHUD(getHud(run));
}

// ---- 事件 → 表现 ---------------------------------------------------------
function processEvents() {
  for (const ev of drainEvents(run)) {
    if (ev.type === 'find') {
      audio.find();
      renderer.burst(ev.x, ev.y, TYPE_BY_ID[ev.objectType].color, 14);
      Sdk.track('find', { type: ev.objectType });
    } else if (ev.type === 'clear') {
      onClear();
    } else if (ev.type === 'hint') {
      audio.hint();
    }
  }
}

function doClick(x, y) {
  const r = clickAt(run, x, y);
  if (r.kind === 'wrong') {
    audio.wrong();
    renderer.flashWrong(x, y);
  }
  processEvents();
  refreshTargets();
  syncUi();
  return r;
}
function doHint() {
  const h = useHint(run);
  if (!h) audio.wrong();
  processEvents();
  syncUi();
}

// ---- 状态机 --------------------------------------------------------------
function startGame() {
  run = createRun({ level: 1, seed: Math.floor(Math.random() * 0x7fffffff) });
  renderer.clearEffects();
  state = 'playing';
  syncLl();
  Sdk.newRun({ mode: 'hidden' });
  ui.showGame();
  refreshTargets();
  syncUi();
  lastTime = performance.now();
}
function doNextLevel() {
  nextLevel(run);
  renderer.clearEffects();
  state = 'playing';
  syncLl();
  ui.hideClear();
  refreshTargets();
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
function onClear() {
  state = 'clear';
  syncLl();
  if (run.score > best) { best = run.score; Sdk.save('best', best); }
  Sdk.levelCleared({ level: run.level, score: run.score });
  ui.showClear(run.score);
  audio.clear();
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
  doClick(p.x, p.y);
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (state === 'playing') pauseGame();
    else if (state === 'paused') resumeGame();
  }
  if (state === 'playing' && e.code === 'KeyH') doHint();
});
window.addEventListener('blur', () => { if (state === 'playing') pauseGame(); });

// ---- 按钮 ----------------------------------------------------------------
ui.btnStart.addEventListener('click', () => { audio.unlock(); startGame(); });
ui.btnResume.addEventListener('click', resumeGame);
ui.btnRestart.addEventListener('click', startGame);
ui.btnNext.addEventListener('click', doNextLevel);
ui.btnTitle.addEventListener('click', backToTitle);
ui.btnHint.addEventListener('click', doHint);
ui.btnMute.addEventListener('click', doMute);
ui.btnPause.addEventListener('click', () => { if (state === 'playing') pauseGame(); });
for (const sel of ui.langSelects) {
  if (sel) sel.addEventListener('change', (e) => { ui.setLang(e.target.value); syncLl(); if (state === 'playing') refreshTargets(); });
}

Sdk.onAdStart(() => pauseGame());
Sdk.onAdEnd(() => resumeGame());

// ---- 主循环 --------------------------------------------------------------
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  renderer.update(dt);
  renderer.render({ run, now, state });
}

// ---- 初始化 --------------------------------------------------------------
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
    click: (x, y) => doClick(x, y),
    find: (type) => {
      const o = run.objects.find((x) => x.isTarget && x.type === type && !x.found);
      if (o) return doClick(o.x, o.y);
      return { ok: false };
    },
    hint: () => { const h = useHint(run); processEvents(); syncUi(); return h; },
    next: () => { doNextLevel(); return getHud(run); },
    solve: () => {
      for (const o of run.objects.filter((x) => x.isTarget && !x.found)) clickAt(run, o.x, o.y);
      processEvents();
      refreshTargets();
      syncUi();
      return getHud(run);
    },
  },
};