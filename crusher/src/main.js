// 主入口：CRUSHER。状态机 title → playing ⇄ paused（无尽放置）。
// 60Hz 定步长自动粉碎 + 点击粉碎 + 升级经济 + 存档。
import { WORLD, STEP, OBJECT, COLORS, UPGRADES, RULES, CONFIG } from '../config/game.config.js';
import {
  createRun, click, tick, buy, upgradeCost, clickPower, dps, critChance,
  currentTier, tierIndex, getHud, drainEvents, serialize,
} from './game/sim.js';
import { createRenderer } from './render/index.js';
import { ui } from './ui/ui.js';
import { audio } from './audio.js';
import Sdk from './core/sdk.js';
import { t, i18n } from './core/i18n.js';

const canvas = document.getElementById('canvas');
const renderer = createRenderer(canvas);
const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

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
  ui.updateHUD({ tierName: currentTier(run).name[lang] || currentTier(run).name.en, crushed: run.crushed });
  ui.updatePanel({
    coins: Math.floor(run.coins),
    clickPower: clickPower(run),
    dps: dps(run),
    critChance: critChance(run),
    upgrades: UPGRADES.map((u) => ({
      id: u.id,
      name: u.name[lang] || u.name.en,
      desc: u.desc[lang] || u.desc.en,
      level: run.levels[u.id],
      cost: upgradeCost(run, u.id),
      canBuy: run.coins >= upgradeCost(run, u.id),
    })),
  });
}
function saveProgress() {
  Sdk.save('progress', serialize(run));
}

// ---- 事件 → 表现 ---------------------------------------------------------
function processEvents() {
  for (const ev of drainEvents(run)) {
    if (ev.type === 'click') {
      renderer.hit();
      if (ev.crit) {
        audio.crit();
        renderer.popup(t('critical'), OBJECT.CX, OBJECT.CY - OBJECT.R - 20, COLORS.gold, true);
      } else {
        audio.click();
      }
      renderer.popup(`-${ev.damage}`, OBJECT.CX + (Math.random() - 0.5) * 120, OBJECT.CY - 40, ev.crit ? COLORS.gold : COLORS.ink);
    } else if (ev.type === 'crush') {
      audio.crush();
      if (!REDUCED) renderer.shake(10);
      renderer.burst(OBJECT.CX, OBJECT.CY, currentTier(run).color, 26);
      renderer.popup(`+${ev.value} 🪙`, OBJECT.CX, OBJECT.CY - OBJECT.R - 30, COLORS.gold, true);
      Sdk.track('crush', { value: ev.value, tier: ev.tier });
    } else if (ev.type === 'tier_up') {
      audio.tier();
      const lang = i18n.lang;
      const name = currentTier(run).name[lang] || currentTier(run).name.en;
      renderer.popup(`${name}!`, OBJECT.CX, OBJECT.CY, COLORS.accent, true);
      Sdk.track('tier_up', { tier: ev.tier });
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

// ---- 点击输入 ------------------------------------------------------------
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
  const dx = p.x - OBJECT.CX;
  const dy = p.y - OBJECT.CY;
  if (dx * dx + dy * dy <= (OBJECT.R + 24) ** 2) {
    click(run);
  }
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (state === 'playing') pauseGame();
    else if (state === 'paused') resumeGame();
  }
  if (e.code === 'Space' && state === 'playing') { click(run); e.preventDefault(); }
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
for (const id of ['click', 'auto', 'crit']) {
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
  renderer.update(dt);
  renderer.render({ run, nextTierLabel: t('nextTier') });
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
    state: () => ({ ...getHud(run), levels: { ...run.levels } }),
    click: () => { const r = click(run); processEvents(); syncUi(); return r; },
    buy: (id) => { const ok = buy(run, id); processEvents(); syncUi(); return ok; },
    addCoins: (n) => { run.coins += n; syncUi(); return run.coins; },
    crush: () => { run.hp = 1; const r = click(run); processEvents(); syncUi(); return r; },
    setTier: (n) => { run.crushed = n * RULES.objectsPerTier; run.maxHp = 1; run.hp = 1; syncUi(); return tierIndex(run); },
  },
};