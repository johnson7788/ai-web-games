// 主入口：LEEK FACTORY。状态机 title → playing ⇄ paused（无尽放置）。
// 60Hz 定步长产线 + 手动收割 + 升级经济 + 存档。
import { WORLD, STEP, HARVEST, COLORS, STATIONS, UPGRADES, RULES, CONFIG } from '../config/game.config.js';
import {
  createRun, click, tick, buy, upgradeCost, throughput, bottleneck, valuePerLeek,
  clickValue, getHud, drainEvents, serialize,
} from './game/sim.js';
import { createRenderer } from './render/index.js';
import { ui } from './ui/ui.js';
import { audio } from './audio.js';
import Sdk from './core/sdk.js';
import { t, i18n } from './core/i18n.js';

const canvas = document.getElementById('canvas');
const renderer = createRenderer(canvas);

let run = createRun({ seed: 1, saved: Sdk.load('progress', null) });
let state = 'title';
let lastTime = performance.now();
let accumulator = 0;
let saveTimer = 0;

const llState = { phase: 'title', lang: ui.lang, dir: ui.dir };

function syncLl() {
  llState.phase = state;
  llState.lang = ui.lang;
  llState.dir = ui.dir;
}
function syncUi() {
  const lang = i18n.lang;
  const bn = bottleneck(run);
  ui.updateHUD({ coins: Math.floor(run.coins), totalSold: Math.floor(run.totalSold) });
  ui.updatePanel({
    coins: Math.floor(run.coins),
    throughput: throughput(run),
    valuePerLeek: valuePerLeek(run),
    upgrades: UPGRADES.map((u) => ({
      id: u.id,
      name: u.name[lang] || u.name.en,
      desc: u.desc[lang] || u.desc.en,
      level: run.levels[u.id],
      cost: upgradeCost(run, u.id),
      canBuy: run.coins >= upgradeCost(run, u.id),
      isBottleneck: u.id === bn,
    })),
  });
}
function saveProgress() {
  Sdk.save('progress', serialize(run));
}

// ---- 事件 → 表现 ---------------------------------------------------------
function processEvents() {
  for (const ev of drainEvents(run)) {
    if (ev.type === 'harvest') {
      audio.harvest();
      renderer.hit();
      renderer.popup(`+${ev.gained} 🪙`, HARVEST.CX, HARVEST.CY - HARVEST.R - 10, COLORS.gold);
      renderer.burst(HARVEST.CX, HARVEST.CY, COLORS.leek, 10);
      Sdk.track('harvest', { gained: ev.gained });
    } else if (ev.type === 'upgrade') {
      audio.buy();
      Sdk.track('upgrade', { id: ev.id, level: ev.level });
    }
  }
}

// ---- 状态机 --------------------------------------------------------------
function startGame() {
  state = 'playing';
  syncLl();
  Sdk.newRun({ mode: 'idle' });
  ui.showGame();
  syncUi();
  lastTime = performance.now();
}
function backToTitle() {
  saveProgress();
  state = 'title';
  syncLl();
  ui.showTitle();
}
function pauseGame() {
  if (state !== 'playing') return;
  state = 'paused';
  syncLl();
  saveProgress();
  ui.showPause();
}
function resumeGame() {
  if (state !== 'paused') return;
  state = 'playing';
  syncLl();
  ui.hidePause();
  lastTime = performance.now();
}
function resetSave() {
  run = createRun({ seed: 1 });
  saveProgress();
  renderer.clearEffects();
  state = 'playing';
  syncLl();
  ui.hidePause();
  syncUi();
  lastTime = performance.now();
}
function doBuy(id) {
  if (!buy(run, id)) audio.deny();
  syncUi();
}
function doMute() {
  audio.setMuted(!audio.muted);
  Sdk.save('muted', audio.muted);
  ui.updateMute(audio.muted);
}

// ---- 收割输入 ------------------------------------------------------------
function canvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (canvas.width / rect.width),
    y: (e.clientY - rect.top) * (canvas.height / rect.height),
  };
}
function doHarvest() {
  click(run);
}
canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (state !== 'playing') return;
  const p = canvasPos(e);
  const dx = p.x - HARVEST.CX;
  const dy = p.y - HARVEST.CY;
  if (dx * dx + dy * dy <= (HARVEST.R + 20) ** 2) doHarvest();
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (state === 'playing') pauseGame();
    else if (state === 'paused') resumeGame();
  }
  if (e.code === 'Space' && state === 'playing') { doHarvest(); e.preventDefault(); }
});
window.addEventListener('blur', () => { if (state === 'playing') pauseGame(); });
window.addEventListener('beforeunload', saveProgress);

// ---- 按钮 ----------------------------------------------------------------
ui.btnStart.addEventListener('click', () => { audio.unlock(); startGame(); });
ui.btnResume.addEventListener('click', resumeGame);
ui.btnReset.addEventListener('click', resetSave);
ui.btnTitle.addEventListener('click', backToTitle);
ui.btnMute.addEventListener('click', doMute);
ui.btnPause.addEventListener('click', () => { if (state === 'playing') pauseGame(); });
for (const id of ['grow', 'process', 'pack', 'value']) {
  ui.upBtns[id].addEventListener('click', () => doBuy(id));
}
for (const sel of ui.langSelects) {
  if (sel) sel.addEventListener('change', (e) => { ui.setLang(e.target.value); syncLl(); syncUi(); });
}

Sdk.onAdStart(() => pauseGame());
Sdk.onAdEnd(() => resumeGame());

// ---- 主循环（定步长放置） ------------------------------------------------
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  if (state === 'playing') {
    accumulator += dt;
    while (accumulator >= STEP) {
      tick(run, STEP);
      accumulator -= STEP;
    }
    saveTimer += dt;
    if (saveTimer >= 5) { saveTimer = 0; saveProgress(); }
  }
  processEvents();
  renderer.update(dt, state === 'playing' ? run : null);
  renderer.render({
    run,
    lang: i18n.lang,
    levelLabel: t('level'),
    bottleneckLabel: t('bottleneck'),
    harvestLabel: t('harvest'),
    clickHint: `+${clickValue(run)} 🪙`,
  });
  if (state === 'playing') syncUi();
}

// ---- 初始化 --------------------------------------------------------------
Sdk.ready();
audio.setMuted(Sdk.load('muted', false));
ui.applyLang();
ui.showTitle();
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
    harvest: () => { const r = click(run); processEvents(); syncUi(); return r; },
    buy: (id) => { const ok = buy(run, id); processEvents(); syncUi(); return ok; },
    addCoins: (n) => { run.coins += n; syncUi(); return run.coins; },
    setLevel: (id, n) => { run.levels[id] = n; syncUi(); return run.levels[id]; },
  },
};