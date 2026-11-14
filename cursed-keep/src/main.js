// 主入口：CURSED KEEP。状态机 title → playing ⇄ paused → won/lost。
// 60Hz 定步长战斗 + 建塔/升级 + 波次。
import { WORLD, STEP, COLORS, TOWERS, RULES, CONFIG } from '../config/game.config.js';
import { SPOTS } from '../config/map.js';
import {
  createRun, tick, placeTower, upgradeTower, sellTower, sendWave, towerStats,
  upgradeCost, towerAtSpot, getHud, drainEvents, WAVE_COUNT,
} from './game/sim.js';
import { createRenderer } from './render/index.js';
import { preload } from './render/art.js';
import { ui } from './ui/ui.js';
import { audio } from './audio.js';
import Sdk from './core/sdk.js';
import { t, i18n } from './core/i18n.js';

const canvas = document.getElementById('canvas');
const renderer = createRenderer(canvas);
const towerById = Object.fromEntries(TOWERS.map((x) => [x.id, x]));

let run = createRun();
let state = 'boot';
let selectedType = null;
let selectedTower = null;
let hoverSpot = null;
let best = Sdk.load('best', 0);
let lastTime = performance.now();
let accumulator = 0;

const llState = { phase: 'boot', lang: ui.lang, dir: ui.dir };
const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Segoe UI",sans-serif';

function syncLl() {
  llState.phase = state;
  llState.lang = ui.lang;
  llState.dir = ui.dir;
}

function sellValue(tower) {
  const base = towerById[tower.type];
  let invested = base.cost;
  for (let lv = 1; lv < tower.level; lv += 1) invested += Math.floor(base.cost * RULES.upgradeCostFactor * lv);
  return Math.floor(invested * RULES.sellRefund);
}

function syncUi() {
  const lang = i18n.lang;
  ui.updateHUD(getHud(run));
  ui.updateBuildBar({
    selectedType,
    towers: TOWERS.map((b) => ({ id: b.id, name: b.name[lang] || b.name.en, cost: b.cost, canBuy: run.gold >= b.cost })),
  });
  if (selectedTower != null) {
    const tower = run.towers.find((x) => x.id === selectedTower);
    if (!tower) { selectedTower = null; ui.hideTowerPanel(); return; }
    const stats = towerStats(tower);
    const maxed = tower.level >= RULES.maxTowerLevel;
    const cost = upgradeCost(tower);
    ui.showTowerPanel({
      name: towerById[tower.type].name[lang] || towerById[tower.type].name.en,
      level: tower.level,
      damage: Math.round(stats.damage),
      range: Math.round(stats.range),
      maxed,
      upgradeCost: cost,
      canUpgrade: run.gold >= cost,
      sellValue: sellValue(tower),
    });
  }
}

// ---- 事件 → 表现 ---------------------------------------------------------
function processEvents() {
  for (const ev of drainEvents(run)) {
    if (ev.type === 'kill') {
      audio.kill();
      renderer.burst(ev.x, ev.y, COLORS.gold, 8);
    } else if (ev.type === 'splash') {
      audio.splash();
      renderer.splash(ev.x, ev.y, ev.r);
    } else if (ev.type === 'leak') {
      audio.leak();
    } else if (ev.type === 'build') {
      audio.build();
    } else if (ev.type === 'upgrade') {
      audio.upgrade();
    } else if (ev.type === 'win') {
      onWin();
    } else if (ev.type === 'lose') {
      onLose(ev.wave);
    }
  }
}

// ---- 状态机 --------------------------------------------------------------
function startGame() {
  run = createRun();
  selectedType = null;
  selectedTower = null;
  renderer.clearEffects();
  ui.hideTowerPanel();
  state = 'playing';
  syncLl();
  Sdk.newRun({ mode: 'defense' });
  ui.showGame();
  syncUi();
  lastTime = performance.now();
  accumulator = 0;
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
function saveBest(wave) {
  if (wave > best) { best = wave; Sdk.save('best', best); }
}
function onWin() {
  state = 'won';
  syncLl();
  saveBest(WAVE_COUNT);
  Sdk.levelCleared({ wave: WAVE_COUNT, kills: run.kills });
  ui.showWin(run.kills);
  audio.win();
}
function onLose(wave) {
  state = 'lost';
  syncLl();
  saveBest(wave);
  Sdk.gameOver({ wave, kills: run.kills });
  ui.showLose(wave);
  audio.lose();
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
function spotAt(x, y) {
  for (let i = 0; i < SPOTS.length; i += 1) {
    if (Math.hypot(x - SPOTS[i].x, y - SPOTS[i].y) <= 30) return i;
  }
  return null;
}

canvas.addEventListener('pointermove', (e) => {
  const p = canvasPos(e);
  hoverSpot = spotAt(p.x, p.y);
});
canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (state !== 'playing') return;
  const p = canvasPos(e);
  const spot = spotAt(p.x, p.y);
  if (spot == null) {
    selectedTower = null;
    ui.hideTowerPanel();
    return;
  }
  const existing = towerAtSpot(run, spot);
  if (existing) {
    selectedTower = existing.id;
    selectedType = null;
    audio.click();
    syncUi();
  } else if (selectedType) {
    const r = placeTower(run, spot, selectedType);
    if (r.ok) {
      Sdk.track('build', { type: selectedType });
      processEvents();
    } else {
      audio.click();
    }
    syncUi();
  }
});

// ---- 按钮 ----------------------------------------------------------------
for (const id of ['arrow', 'cannon', 'frost']) {
  ui.buildBtns[id].addEventListener('click', () => {
    audio.unlock();
    selectedType = selectedType === id ? null : id;
    selectedTower = null;
    ui.hideTowerPanel();
    audio.click();
    syncUi();
  });
}
ui.btnWave.addEventListener('click', () => { sendWave(run); audio.click(); syncUi(); });
ui.btnUpgrade.addEventListener('click', () => {
  if (selectedTower == null) return;
  const r = upgradeTower(run, selectedTower);
  if (r.ok) { Sdk.track('build', { upgrade: true }); processEvents(); }
  syncUi();
});
ui.btnSell.addEventListener('click', () => {
  if (selectedTower == null) return;
  sellTower(run, selectedTower);
  selectedTower = null;
  ui.hideTowerPanel();
  processEvents();
  syncUi();
});
ui.btnClose.addEventListener('click', () => { selectedTower = null; ui.hideTowerPanel(); });

ui.btnStart.addEventListener('click', () => { audio.unlock(); startGame(); });
ui.btnResume.addEventListener('click', resumeGame);
ui.btnRestart.addEventListener('click', startGame);
ui.btnAgain.addEventListener('click', startGame);
ui.btnAgain2.addEventListener('click', startGame);
ui.btnTitle.addEventListener('click', backToTitle);
ui.btnTitle2.addEventListener('click', backToTitle);
ui.btnMute.addEventListener('click', doMute);
ui.btnPause.addEventListener('click', () => { if (state === 'playing') pauseGame(); });
for (const sel of ui.langSelects) {
  if (sel) sel.addEventListener('change', (e) => { ui.setLang(e.target.value); syncLl(); syncUi(); });
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (state === 'playing') pauseGame();
    else if (state === 'paused') resumeGame();
  }
  if (state === 'playing') {
    if (e.code === 'Digit1') { selectedType = 'arrow'; syncUi(); }
    if (e.code === 'Digit2') { selectedType = 'cannon'; syncUi(); }
    if (e.code === 'Digit3') { selectedType = 'frost'; syncUi(); }
    if (e.code === 'Space') { sendWave(run); e.preventDefault(); }
  }
});
window.addEventListener('blur', () => { if (state === 'playing') pauseGame(); });

Sdk.onAdStart(() => pauseGame());
Sdk.onAdEnd(() => resumeGame());

// ---- 主循环（定步长战斗） ------------------------------------------------
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
  }
  processEvents();
  renderer.update(dt);
  renderer.render({ run, selectedType, selectedTower, hoverSpot });
  if (state === 'playing') syncUi();
}

// ---- 初始化 --------------------------------------------------------------
function drawLoading(p) {
  const c = canvas.getContext('2d');
  c.fillStyle = COLORS.bg;
  c.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
  c.fillStyle = COLORS.accent;
  c.font = `800 42px ${FONT}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('CURSED KEEP', WORLD.WIDTH / 2, WORLD.HEIGHT / 2 - 40);
  c.fillStyle = COLORS.spot;
  c.fillRect(WORLD.WIDTH / 2 - 200, WORLD.HEIGHT / 2 + 10, 400, 14);
  c.fillStyle = COLORS.accent;
  c.fillRect(WORLD.WIDTH / 2 - 200, WORLD.HEIGHT / 2 + 10, 400 * Math.max(0, Math.min(1, p)), 14);
}

async function boot() {
  ui.titleScreen.classList.add('hidden');
  drawLoading(0);
  await preload(drawLoading);
  state = 'title';
  syncLl();
  ui.applyLang();
  ui.showTitle();
  ui.updateBest(best);
  ui.updateMute(audio.muted);
  syncUi();
  requestAnimationFrame(loop);
}

Sdk.ready();
audio.setMuted(Sdk.load('muted', false));
boot();

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
    build: (spot, type) => { const r = placeTower(run, spot, type); processEvents(); syncUi(); return r; },
    upgrade: (id) => { const r = upgradeTower(run, id); processEvents(); syncUi(); return r; },
    sendWave: () => { sendWave(run); return getHud(run); },
    addGold: (n) => { run.gold += n; syncUi(); return run.gold; },
    step: (sec) => { const n = Math.ceil(sec * 60); for (let i = 0; i < n; i += 1) tick(run, 1 / 60); processEvents(); syncUi(); return getHud(run); },
    towers: () => run.towers.map((x) => ({ id: x.id, type: x.type, level: x.level, spot: x.spotIndex })),
  },
};