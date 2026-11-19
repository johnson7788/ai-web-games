// 主入口：60Hz 固定步长 + 标题/游戏/暂停/结算/商店 + 教程引导 + SDK 统一出口 + 调试契约
import { STEP } from '../config/game.config.js';
import { createRun } from './game/sim.js';
import { autoPlay } from './game/bot.js';
import { GAME } from '../config/maps.js';
import { createRenderer } from './render/index.js';
import { createAudio } from './core/audio.js';
import { ui } from './ui/ui.js';
import { i18n, t, syncDocumentLang } from './core/i18n.js';
import Sdk from './core/sdk.js';

const $ = (id) => document.getElementById(id);
const canvas = $('canvas');
const renderer = createRenderer(canvas);
const audio = createAudio();

let run = null;
let preview = createRun({ seed: 1 });
let phase = 'title';       // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let fpsSamples = [];
let muted = !!Sdk.load('muted', false);
let tutorialStep = -1;
let tutorialDone = !!Sdk.load('tutorialDone', false);
let bestFloor = Sdk.load('bestFloor', 0) | 0;
let lastFloor = Sdk.load('lastFloor', 1) | 0;
let shopOpen = false;
let lastStepSfx = 0;
let toastTimer = null;

Sdk.ready();
audio.setMuted(muted);
ui.applyLang();
$('btn-mute').classList.toggle('is-muted', muted);

function persist() {
  Sdk.save('muted', muted);
  Sdk.save('tutorialDone', tutorialDone);
  Sdk.save('bestFloor', bestFloor);
  Sdk.save('lastFloor', lastFloor);
}

function setPhase(p) { phase = p; }

function startGame(floor) {
  floor = Math.max(1, Math.min(5, floor | 0));
  lastFloor = floor;
  run = createRun({ seed: (Date.now() % 2147483647) || 1 });
  run.state.floor = floor;
  // 从指定层开始：把英雄放到该层的下楼楼梯（无则 (1,1)）
  const f = run.state.floors[floor - 1];
  let placed = false;
  for (let y = 0; y < f.rows && !placed; y++) {
    for (let x = 0; x < f.cols && !placed; x++) {
      const t = f.grid[y][x];
      if (t.kind === 'stair' && t.dir === 'down') { run.state.pos = { x, y }; run.state.prevPos = { x, y }; placed = true; }
    }
  }
  if (!placed) { run.state.pos = { x: 1, y: 1 }; run.state.prevPos = { x: 1, y: 1 }; }
  shopOpen = false;
  setPhase('playing');
  ui.showGame();
  hideResult();
  updateHud();
  audio.startBgm();
  Sdk.track('start', { floor });
  if (floor === 1 && !tutorialDone) startTutorial();
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
}

function restartLevel() {
  if (run) Sdk.track('restart', { floor: run.state.floor });
  startGame(run ? run.state.floor : lastFloor);
}

function goHome() {
  run = null;
  setPhase('title');
  ui.showTitle();
  hideResult();
}

function updateHud() {
  if (!run) return;
  const h = run.state.hero;
  $('hud-goal').textContent = run.state.floor >= 5 ? t('goalBoss') : t('goalStairs');
  $('hud-floor').textContent = `${t('floor')} ${run.state.floor}/5`;
  $('hud-hp').textContent = `${t('hp')} ${h.hp}`;
  $('hud-atk').textContent = `${t('atk')} ${h.atk}`;
  $('hud-def').textContent = `${t('def')} ${h.def}`;
  $('hud-gold').textContent = `${t('gold')} ${h.gold}`;
  const k = run.state.keys;
  $('hud-keys').textContent = `🔑 Y${k.yellow} B${k.blue} R${k.red}${run.state.pick > 0 ? ' ⛏' + run.state.pick : ''}`;
  $('hud-combo').textContent = run.state.combo > 0 ? `×${run.state.combo}` : '';
}

function showToast(msg, ms = 1600) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), ms);
}

function handleEvents(events) {
  for (const ev of events) {
    const now = performance.now();
    if (ev.type === 'step') {
      if (now - lastStepSfx > 70) { audio.event('step'); lastStepSfx = now; }
    } else {
      audio.event(ev.type, ev);
    }
    switch (ev.type) {
      case 'blocked':
        if (ev.monster) showToast(t('toastCannotBeat'));
        else if (ev.door) showToast(t('toastNoKey'));
        else if (ev.crystal) showToast(t('toastNoPick'));
        break;
      case 'combo':
        showToast(`${t('toastPerfect')} ×${ev.combo}`);
        break;
      case 'spike':
        showToast(t('toastSpike'));
        break;
      case 'kill':
        showToast(`+${ev.gold} ${t('gold')}`);
        break;
      case 'talk':
        showToast(t('hint' + (ev.hint + 1)), 2600);
        break;
      case 'shop':
        openShop();
        break;
      case 'win':
      case 'lose':
        finishRun(ev);
        return;
      default:
        break;
    }
  }
}

function finishRun(ev) {
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  const st = run.state;
  const won = ev.type === 'win';
  if (won) {
    bestFloor = Math.max(bestFloor, 5);
    persist();
  }
  Sdk.track(won ? 'win' : 'fail', { floor: st.floor, kills: st.kills, combo: st.bestCombo });
  showResult({ won });
  audio.event(won ? 'win' : 'lose');
}

function showResult({ won }) {
  const st = run.state;
  $('result-title').textContent = won ? t('winTitle') : t('loseTitle');
  $('result-title').classList.toggle('lose', !won);
  const stars = won ? (st.bestCombo >= 3 ? 3 : st.bestCombo >= 1 ? 2 : 1) : 0;
  $('result-stars').innerHTML = won
    ? `<span>${'★'.repeat(stars)}</span>${stars >= 3 ? `<em>${t('perfect')}</em>` : ''}`
    : '';
  $('result-meta').innerHTML = won
    ? `${t('resultGold')}: ${st.hero.gold} · ${t('resultCombo')}: ×${st.bestCombo} · ${t('resultKills')}: ${st.kills}`
    : t('loseReason');
  ui.showResult();
}

function hideResult() {
  $('screen-result').classList.add('hidden');
}

// ---------- 商店 ----------
function openShop() {
  if (!run) return;
  shopOpen = true;
  ui.showShop();
  $('shop-title').textContent = t('shopTitle');
  $('btn-buy-hp').textContent = `${t('shopBuyHp')} (+${GAME.SHOP.hp})`;
  $('btn-buy-atk').textContent = `${t('shopBuyAtk')} (+${GAME.SHOP.atk})`;
  $('btn-buy-def').textContent = `${t('shopBuyDef')} (+${GAME.SHOP.def})`;
  refreshShop();
}

function refreshShop() {
  const price = GAME.SHOP.beginGold + GAME.SHOP.ratio * run.state.shopCount;
  $('shop-cost').textContent = `${t('shopCost')}: ${price} ${t('gold')}  (${t('gold')} ${run.state.hero.gold})`;
  const afford = run.state.hero.gold >= price;
  for (const id of ['btn-buy-hp', 'btn-buy-atk', 'btn-buy-def']) {
    $(id).disabled = !afford;
    $(id).style.opacity = afford ? '1' : '0.5';
  }
}

function buyShop(attr) {
  if (!run || !shopOpen) return;
  const res = run.buy(attr);
  if (res.ok) {
    updateHud();
    refreshShop();
    showToast(`+${attr === 'hp' ? GAME.SHOP.hp : attr === 'atk' ? GAME.SHOP.atk : GAME.SHOP.def}`);
  }
}

function closeShop() {
  shopOpen = false;
  ui.hideShop();
  updateHud();
}

// ---------- 教程 ----------
const TUT_STEPS = () => [
  { key: 'move', text: t('tutStep1') },
  { key: 'loot', text: t('tutStep2') },
  { key: 'climb', text: t('tutStep3') },
];

function startTutorial() {
  tutorialStep = 0;
  renderTutorialStep();
}

function renderTutorialStep() {
  const el = $('tutorial');
  if (tutorialStep < 0) { el.classList.add('hidden'); return; }
  const steps = TUT_STEPS();
  const s = steps[tutorialStep] || steps[0];
  el.classList.remove('hidden');
  $('tut-title').textContent = t('tutTitle');
  $('tut-text').textContent = s.text;
  $('tut-skip').textContent = t('tutSkip');
  $('tut-next').textContent = t('tutNext');
  const lay = renderer.debugLayout();
  const spot = $('tut-spotlight');
  if (lay && lay.board) {
    spot.style.display = 'block';
    spot.style.left = `${lay.board.x + 8}px`;
    spot.style.top = `${lay.board.y + 8}px`;
    spot.style.width = `${lay.board.w - 16}px`;
    spot.style.height = `${lay.board.h - 16}px`;
  } else {
    spot.style.display = 'none';
  }
}

function tutorialNext() {
  tutorialStep += 1;
  if (tutorialStep >= TUT_STEPS().length) endTutorial();
  else renderTutorialStep();
}

function endTutorial() {
  tutorialStep = -1;
  tutorialDone = true;
  persist();
  renderTutorialStep();
}

// ---------- 输入 ----------
function canvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (1280 / rect.width),
    y: (e.clientY - rect.top) * (720 / rect.height),
  };
}

function pickTile(p) {
  const lay = renderer.debugLayout();
  if (!lay || !lay.board) return null;
  const c = Math.floor((p.x - lay.board.x) / lay.cell);
  const r = Math.floor((p.y - lay.board.y) / lay.cell);
  if (r < 0 || r >= 11 || c < 0 || c >= 11) return null;
  return { x: c, y: r };
}

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (!run || phase !== 'playing' || shopOpen) return;
  const p = canvasPos(e);
  const tile = pickTile(p);
  if (!tile) return;
  const res = run.moveTo(tile.x, tile.y);
  handleEvents(run.drainEvents());
  updateHud();
  if (run.state.phase === 'playing' && res.arrived === false && res.reason) {
    // toast 已由 blocked 事件处理
  }
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
  if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'result')) restartLevel();
  if (e.code === 'KeyM') toggleMute();
});

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  $('btn-mute').classList.toggle('is-muted', muted);
  persist();
}

// ---------- UI 绑定 ----------
function bind() {
  const on = (id, fn) => {
    const el = $(id);
    if (el) el.addEventListener('click', () => { audio.unlock(); fn(); });
  };
  on('btn-start', () => startGame(1));
  on('btn-resume', resumeGame);
  on('btn-restart', restartLevel);
  on('btn-restart2', restartLevel);
  on('btn-retry', restartLevel);
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-howto', () => { if (phase === 'playing' || phase === 'paused' || phase === 'result') startTutorial(); });
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);
  on('btn-buy-hp', () => buyShop('hp'));
  on('btn-buy-atk', () => buyShop('atk'));
  on('btn-buy-def', () => buyShop('def'));
  on('btn-shop-leave', closeShop);
  for (const sel of ['lang-select', 'lang-select-pause']) {
    const el = $(sel);
    if (el) el.addEventListener('change', () => {
      ui.setLang(el.value);
      renderTutorialStep();
      updateHud();
    });
  }
}

// ---------- 主循环 ----------
function frame(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;

  if (phase === 'playing' && run) {
    accumulator += dt;
    while (accumulator >= STEP) {
      run.step(STEP);
      accumulator -= STEP;
    }
    handleEvents(run.drainEvents());
    updateHud();
  }

  try {
    renderer.draw(run ? run.state : preview.state, dt, null);
  } catch (err) {
    console.warn('render error', err);
  }

  if (fpsSamples.length < 600 && dt > 0) fpsSamples.push(1 / dt);
  requestAnimationFrame(frame);
}

// ---------- 调试契约 ----------
window.__ll = {
  state: {
    get phase() { return phase; },
    get lang() { return i18n.lang; },
  },
  get run() { return run; },
  start: (f) => startGame(f == null ? 1 : f),
  pause: pauseGame,
  resume: resumeGame,
  restart: restartLevel,
  home: goHome,
  sim: () => (run ? run.state : null),
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['move', 'loot', 'climb']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: endTutorial,
  },
  startTutorial,
  save: (k, v) => Sdk.save(k, v),
  ui,
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: () => (run ? run.state : null),
    layout: () => { try { return renderer.debugLayout(); } catch { return null; } },
    moveTo: (x, y) => {
      if (!run) return false;
      const res = run.moveTo(x, y);
      handleEvents(run.drainEvents());
      updateHud();
      return res;
    },
    autoWin: () => {
      if (!run) startGame(1);
      autoPlay(run, 3000);
      handleEvents(run.drainEvents());
      updateHud();
      if (run.state.phase === 'won' || run.state.phase === 'dead') finishRun({ type: run.state.phase === 'won' ? 'win' : 'lose' });
      return run.state.phase;
    },
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    startTutorial,
    tutorialStep: () => tutorialStep,
  },
};

// ---------- 启动 ----------
bind();
syncDocumentLang();
ui.applyLang();
ui.showTitle();
$('btn-mute').classList.toggle('is-muted', muted);
Sdk.track('load', {});
requestAnimationFrame(frame);
