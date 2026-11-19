// 主入口：60Hz 固定步长 + 标题→游戏→暂停/结算 + 教程 + i18n + 标准调试契约。
import { WORLD, STEP, SHIP, UPGRADES } from '../config/game.config.js';
import { createRun } from './game/sim.js';
import { createRenderer } from './render/index.js';
import { ui } from './ui/ui.js';
import { i18n } from './core/i18n.js';
import { save } from './core/save.js';
import { Sdk } from './core/sdk.js';
import { createAudio } from './core/audio.js';

const canvas = document.getElementById('canvas');
const renderer = createRenderer(canvas);
const audio = createAudio();

// ---------- 存档（统一走 Sdk/save 封装） ----------
let muted = !!save.get('muted', false);
let tutorialDone = !!save.get('tutorialDone', false);
let persistentGold = save.get('gold', 0) | 0;
let upgrades = { ...{ firePower: 1, fireRate: 1, goldValue: 1, shield: 0, nukeStart: 0 }, ...(save.get('upgrades', null) || {}) };

Sdk.ready(); // 不 await，不阻塞首屏；sdk-check 靠它注入本地 SDK

function persist() {
  save.set('muted', muted);
  save.set('tutorialDone', tutorialDone);
  save.set('gold', persistentGold);
  save.set('upgrades', upgrades);
}

// ---------- 阶段状态机 ----------
let phase = 'title'; // title | playing | paused | result
let run = null;
let shopFrom = 'title';
let lastTime = 0;
let accumulator = 0;

// ---------- 输入 ----------
const input = { x: WORLD.WIDTH / 2, firing: false };
const keys = { left: false, right: false, fire: false };
const KEY_SPEED = 720;

function setPhase(p) { phase = p; }

function startLevel(idx) {
  idx = Math.max(0, idx | 0);
  run = createRun(idx, { seed: (Date.now() % 2147483647) || 1, upgrades });
  input.x = WORLD.WIDTH / 2;
  input.firing = false;
  setPhase('playing');
  ui.showGame();
  ui.hideResult();
  ui.hideShop();
  updateHud();
  audio.startBgm();
  Sdk.newRun({ level: idx + 1 });
  if (!tutorialDone && idx === 0) startTutorial();
}

function pauseGame() {
  if (phase !== 'playing') return;
  setPhase('paused');
  audio.stopBgm();
  ui.showPause();
}

function resumeGame() {
  if (phase !== 'paused') return;
  setPhase('playing');
  ui.hidePause();
  audio.startBgm();
  lastTime = performance.now();
}

function restartLevel() {
  if (run) Sdk.track('restart', { level: run.state.level });
  startLevel(run ? run.state.level - 1 : 0);
}

function goHome() {
  run = null;
  setPhase('title');
  ui.hideResult();
  ui.hideShop();
  audio.stopBgm();
  ui.showTitle();
}

// ---------- 结算 ----------
function finishWin(ev) {
  persistentGold += ev.gold | 0;
  persist();
  Sdk.levelCleared({ level: ev.level, gold: ev.gold, stars: ev.stars });
  setPhase('result');
  audio.stopBgm();
  ui.showResult('win', { stars: ev.stars, gold: ev.gold, combo: ev.combo });
}

function finishLose(ev) {
  persistentGold += ev.gold | 0;
  persist();
  Sdk.gameOver({ level: run ? run.state.level : 1 });
  setPhase('result');
  audio.stopBgm();
  ui.showResult('lose', { stars: 0, gold: ev.gold, combo: ev.combo });
}

// ---------- HUD ----------
function updateHud() {
  if (run) ui.updateHud(run.getHud());
}

// ---------- 教程 ----------
const TUT_STEPS = ['tut1', 'tut2', 'tut3'];
const TUT_TRIGGER = ['shot', 'kill', 'coin'];
let tutorialStep = -1;

function startTutorial() {
  tutorialStep = 0;
  ui.showTutorial();
  ui.renderTutorialStep(TUT_STEPS[0], TUT_STEPS);
}

function endTutorial() {
  tutorialStep = -1;
  tutorialDone = true;
  persist();
  ui.hideTutorial();
}

function tutorialNext() {
  tutorialStep += 1;
  if (tutorialStep >= TUT_STEPS.length) { endTutorial(); return; }
  ui.renderTutorialStep(TUT_STEPS[tutorialStep], TUT_STEPS);
}

function tutorialAdvance(evType) {
  if (tutorialStep < 0 || tutorialStep >= TUT_TRIGGER.length) return;
  if (TUT_TRIGGER[tutorialStep] !== evType) return;
  tutorialNext();
}

// ---------- 事件消费 ----------
function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    tutorialAdvance(ev.type);
    switch (ev.type) {
      case 'kill':
        renderer.addFx('burst', { x: ev.x, y: ev.y, color: '#4fd8ff' });
        renderer.addFx('coin', { x: ev.x, y: ev.y });
        break;
      case 'coin':
        renderer.addFx('coin', { x: ev.x, y: ev.y });
        break;
      case 'hit':
        renderer.addFx('burst', { x: ev.x, y: ev.y, color: '#ff4fd8' });
        break;
      case 'shield':
        renderer.addFx('ring', { x: ev.x, y: ev.y, color: '#7a3bff' });
        renderer.shake = 4;
        break;
      case 'powerup':
        renderer.addFx('ring', { x: ev.x, y: ev.y, color: '#ffd94f' });
        break;
      case 'bomb':
        renderer.addFx('ring', { x: ev.x, y: ev.y, color: '#ff3b5c' });
        renderer.shake = 8;
        break;
      case 'lose':
        renderer.shake = 10;
        break;
      case 'win':
        finishWin(ev);
        return;
      case 'gameover':
        finishLose(ev);
        return;
      default:
        break;
    }
  }
}

// ---------- 商店 ----------
function shopCost(id, level) {
  const u = UPGRADES[id];
  if (!u) return 0;
  return Math.round(u.baseCost * Math.pow(u.costGrowth, level - 1));
}

function buildShopState() {
  const defs = [
    { id: 'firePower', label: () => ui.lang === 'zh' ? '火力' : 'Fire Power' },
    { id: 'fireRate', label: () => ui.lang === 'zh' ? '射速' : 'Fire Rate' },
    { id: 'goldValue', label: () => ui.lang === 'zh' ? '金币价值' : 'Gold Value' },
    { id: 'shield', label: () => ui.lang === 'zh' ? '护盾' : 'Shield' },
  ];
  const rows = defs.map((d) => {
    const level = upgrades[d.id] || 1;
    const max = UPGRADES[d.id].max;
    const maxed = level >= max;
    const cost = shopCost(d.id, level);
    return {
      name: `${d.label()} [${level}]`,
      level,
      max,
      maxed,
      cost,
      onBuy: () => {
        if (persistentGold >= cost && !maxed) {
          persistentGold -= cost;
          upgrades[d.id] = level + 1;
          persist();
          renderShop();
        }
      },
    };
  });
  return { gold: persistentGold, rows };
}

function renderShop() {
  ui.showShop(buildShopState());
}

function openShop(from) {
  shopFrom = from;
  if (from === 'pause') ui.hidePause();
  renderShop();
}

function closeShop() {
  ui.hideShop();
  if (shopFrom === 'pause' && phase === 'paused') ui.showPause();
}

// ---------- 输入事件绑定 ----------
function canvasWorldX(clientX) {
  const rect = canvas.getBoundingClientRect();
  return ((clientX - rect.left) / rect.width) * WORLD.WIDTH;
}

let pointerDown = false;
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  pointerDown = true;
  input.firing = true;
  input.x = canvasWorldX(e.clientX);
  audio.unlock();
  if (phase === 'playing' && run) run.setInput(input.x, true);
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!pointerDown) return;
  input.x = canvasWorldX(e.clientX);
  if (phase === 'playing' && run) run.setInput(input.x, true);
});
function pointerUp(e) {
  pointerDown = false;
  input.firing = false;
  if (phase === 'playing' && run) run.setInput(input.x, false);
}
canvas.addEventListener('pointerup', pointerUp);
canvas.addEventListener('pointercancel', pointerUp);

window.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;
  if (e.code === 'Space') { keys.fire = true; e.preventDefault(); }
  if (e.code === 'KeyB') { if (run) run.bomb(); }
  if (e.code === 'KeyM') toggleMute();
  if (e.code === 'Escape') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
  if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'result')) restartLevel();
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
  if (e.code === 'Space') keys.fire = false;
});

// ---------- UI 按钮 ----------
ui.btnStart.addEventListener('click', () => startLevel(0));
ui.btnResume.addEventListener('click', resumeGame);
ui.btnNext.addEventListener('click', () => {
  if (run && run.nextLevel()) {
    setPhase('playing');
    ui.hideResult();
    ui.showGame();
    updateHud();
    audio.startBgm();
    Sdk.newRun({ level: run.state.level });
  }
});
ui.btnRetry.addEventListener('click', restartLevel);
ui.shopClose.addEventListener('click', closeShop);
for (const sel of ui.langSelects) {
  if (sel) sel.addEventListener('change', (e) => ui.setLang(e.target.value));
}
const bind = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
bind('btn-restart', restartLevel);
bind('btn-restart2', restartLevel);
bind('btn-home', goHome);
bind('btn-home2', goHome);
bind('btn-home3', goHome);
bind('btn-shop', () => { if (phase === 'playing') pauseGame(); openShop('pause'); });
bind('btn-shop-title', () => openShop('title'));
bind('btn-shop2', () => openShop('pause'));
bind('btn-howto', () => { if (phase === 'playing' || phase === 'result' || phase === 'title') startTutorial(); });
bind('btn-howto-title', () => startTutorial());
bind('btn-tut-replay', () => startTutorial());
bind('btn-mute', toggleMute);
bind('tut-next', tutorialNext);
bind('tut-skip', () => endTutorial());
bind('btn-rotate-skip', () => { document.getElementById('rotate-screen').style.display = 'none'; });

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  ui.setMuted(muted);
  save.set('muted', muted);
}

// ---------- 主循环 ----------
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  if (phase === 'playing') {
    accumulator += dt;
    while (accumulator >= STEP) {
      if (run) {
        // 键盘移动叠加到 input.x（与指针共用目标 x）
        if (keys.left) input.x -= KEY_SPEED * STEP;
        if (keys.right) input.x += KEY_SPEED * STEP;
        input.x = Math.max(0, Math.min(WORLD.WIDTH, input.x));
        run.setInput(input.x, input.firing || keys.fire);
        run.step(STEP);
        const evs = run.drainEvents();
        if (evs.length) handleEvents(evs);
        if (phase !== 'playing') { accumulator = 0; break; }
      }
      accumulator -= STEP;
    }
    if (run) {
      updateHud();
      // 死亡复活倒计时
      if (!run.state.ship.alive && run.state.phase === 'playing') {
        ui.showRevive(Math.max(1, Math.ceil(run.state.deadTimer)));
      } else {
        ui.hideRevive();
      }
    }
    renderer.render(run, now / 1000);
  } else if (phase === 'paused') {
    renderer.render(run, now / 1000);
  } else {
    // title / result：环境背景（无 run）
    renderer.render(null, now / 1000);
  }
}

// ---------- 初始化 ----------
function init() {
  ui.setMuted(muted);
  audio.setMuted(muted);
  ui.showTitle();
  requestAnimationFrame(loop);
}

init();

// ---------- 标准调试契约 ----------
const debugState = () => (run ? run.state : { phase, level: 0 });

window.G = { get run() { return run; }, state: () => phase, ui, save };

window.__ll = {
  get state() { return { phase, lang: ui.lang, dir: ui.dir }; },
  lang: () => ui.lang,
  setLang: (lang) => ui.setLang(lang),
  get run() { return run; },
  start: (idx = 0) => startLevel(idx),
  startAct: (idx = 0) => startLevel(idx),
  pause: pauseGame,
  resume: resumeGame,
  restart: restartLevel,
  save: () => save,
  ui: () => ui,
  get tutorial() {
    return {
      get active() { return tutorialStep >= 0; },
      get step() { return tutorialStep; },
      get steps() { return TUT_STEPS.slice(); },
      get current() { return tutorialStep >= 0 ? TUT_STEPS[tutorialStep] : null; },
      skip: () => endTutorial(),
    };
  },
  startTutorial: () => startTutorial(),
  debug: {
    state: debugState,
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    endTutorial: () => endTutorial(),
    winLevel: () => {
      if (run && run.state.phase === 'playing') {
        run.state.phase = 'won';
        run.state.result = { type: 'win', stars: 3, gold: run.state.gold, combo: run.state.maxCombo, level: run.state.level };
        finishWin(run.state.result);
      }
    },
    loadLevel: (n) => startLevel(Math.max(0, (n | 0) - 1)),
    phase: () => phase,
  },
};
