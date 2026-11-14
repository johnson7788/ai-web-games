// 主入口：PLANET CLICKER。状态机 title → playing ⇄ paused（无尽放置）。
import { WORLD, STEP, PLANET, COLORS, UPGRADES, PLANETS, CONFIG } from '../config/game.config.js';
import {
  createRun, click, tick, buy, upgradeCost, clickPower, eps, planetMult,
  currentPlanet, nextPlanetProgress, getHud, drainEvents, serialize,
} from './game/sim.js';
import { createRenderer } from './render/index.js';
import { preload } from './render/art.js';
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
let best = Sdk.load('best', 0);

const llState = { phase: 'title', lang: ui.lang, dir: ui.dir };

function syncLl() {
  llState.phase = state;
  llState.lang = ui.lang;
  llState.dir = ui.dir;
}
function planetName() {
  const p = currentPlanet(run);
  return p.name[i18n.lang] || p.name.en;
}
function syncUi() {
  const lang = i18n.lang;
  ui.updateHUD({ planetName: planetName(), totalEnergy: run.totalEnergy });
  ui.updatePanel({
    energy: run.energy,
    clickPower: clickPower(run),
    eps: eps(run),
    planetMult: planetMult(run),
    planetName: planetName(),
    progress: nextPlanetProgress(run),
    upgrades: UPGRADES.map((u) => ({
      id: u.id,
      name: u.name[lang] || u.name.en,
      desc: u.desc[lang] || u.desc.en,
      level: run.levels[u.id],
      cost: upgradeCost(run, u.id),
      canBuy: run.energy >= upgradeCost(run, u.id),
    })),
  });
}
function saveProgress() {
  Sdk.save('progress', serialize(run));
  if (run.totalEnergy > best) { best = Math.floor(run.totalEnergy); Sdk.save('best', best); }
}

// ---- 事件 → 表现 ---------------------------------------------------------
function processEvents() {
  for (const ev of drainEvents(run)) {
    if (ev.type === 'click') {
      audio.click();
      renderer.hit();
      renderer.popup(`+${fmt(ev.gained)}`, PLANET.CX + (Math.random() - 0.5) * 120, PLANET.CY - PLANET.R - 10, COLORS.gold);
      Sdk.track('click', { gained: ev.gained });
    } else if (ev.type === 'upgrade') {
      audio.buy();
      Sdk.track('upgrade', { id: ev.id, level: ev.level });
    } else if (ev.type === 'planet') {
      audio.planet();
      renderer.burst(PLANET.CX, PLANET.CY, currentPlanet(run).color, 30);
      renderer.popup(`${t('unlocked')} ${planetName()}`, PLANET.CX, PLANET.CY - PLANET.R - 40, COLORS.accent, true);
      Sdk.track('planet', { planetIndex: ev.planetIndex });
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
  ui.updateBest(best);
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
  const dx = p.x - PLANET.CX;
  const dy = p.y - PLANET.CY;
  if (dx * dx + dy * dy <= (PLANET.R + 24) ** 2) click(run);
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
for (const id of ['click', 'solar', 'drone', 'fusion']) {
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
  renderer.render({ run, now });
  if (state === 'playing') syncUi();
}

// ---- 初始化 --------------------------------------------------------------
Sdk.ready();
preload();
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
    click: () => { const r = click(run); processEvents(); syncUi(); return r; },
    buy: (id) => { const ok = buy(run, id); processEvents(); syncUi(); return ok; },
    addEnergy: (n) => { run.energy += n; run.totalEnergy += n; syncUi(); return run.energy; },
    setPlanet: (n) => { run.planetIndex = n; syncUi(); return run.planetIndex; },
  },
};

function fmt(n) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(Math.floor(n));
}