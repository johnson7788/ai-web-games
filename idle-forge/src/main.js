// IDLE FORGE · 主入口：60Hz 固定步长 + 标题/游戏/暂停/结算 + 离线收益 + 教程引导 + SDK 统一出口。
// 装配：sim(M1) / render(M2) / audio(M4) / Lead 集成。
// 职责：HUD/升级栏/结算/教学/离线卡的 DOM 由这里直写；ui.js 只做语言与屏幕显隐。
import { STEP, GAME, LAYOUT } from '../config/game.config.js';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';
import { createRun, offlineEarnings } from './game/sim.js';
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
let phase = 'title';       // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let fpsSamples = [];
let tutorialStep = -1;
let toastTimer = null;

const view = {
  fxQueue: [],             // {type:'spark', x, y, ttl, seed}
  shake: 0,
  flash: 0,
};

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let tutorialDone = !!Sdk.load('tutorialDone', false);
let coins = Sdk.load('coins', 0) | 0;
let upgrades = Sdk.load('upgrades', { power: 0, speed: 0, temp: 0, apprentice: 0 }) || { power: 0, speed: 0, temp: 0, apprentice: 0 };
let bestLevel = Math.max(1, Sdk.load('bestLevel', 1) | 0);
let lastLevel = Math.max(1, Sdk.load('lastLevel', 1) | 0);
let lastSeen = Sdk.load('lastSeen', 0) | 0;
let offlinePending = 0;

Sdk.ready(); // 不 await，不阻塞首屏
Sdk.onAdStart(() => { if (phase === 'playing') pauseGame(true); });
Sdk.onAdEnd(() => { if (phase === 'paused') resumeGame(); });
audio.setMuted(muted);
ui.setMuted(muted);

function persist() {
  Sdk.save('muted', muted);
  Sdk.save('tutorialDone', tutorialDone);
  Sdk.save('coins', coins);
  Sdk.save('upgrades', upgrades);
  Sdk.save('bestLevel', bestLevel);
  Sdk.save('lastLevel', lastLevel);
  Sdk.save('lastSeen', Date.now());
}

function syncProgress() {
  if (run) {
    coins = run.state.coins;
    upgrades = { ...run.state.upgrades };
    lastLevel = run.state.level;
    if (run.state.level > bestLevel) bestLevel = run.state.level;
  }
}

// 离线收益结算（只在有历史存档时弹，封顶 8h）
function settleOffline() {
  if (!lastSeen) return;
  const now = Date.now();
  const elapsed = Math.max(0, (now - lastSeen) / 1000);
  if (elapsed < 10) return;
  const probe = createRun(Math.max(0, lastLevel - 1), {});
  probe.state.coins = coins;
  probe.state.upgrades = { ...upgrades };
  const earned = offlineEarnings(probe.state, elapsed);
  if (earned > 0) {
    offlinePending = earned;
    coins += earned;
    $('offline-earned').textContent = `+${fmt(earned)} ${t('coins').toLowerCase()}`;
    $('offline-card').classList.remove('hidden');
  }
}

// ---------- 阶段状态机 ----------
function setPhase(p) { phase = p; }

function startLevel(idx) {
  idx = Math.max(0, Math.min(LEVEL_COUNT - 1, idx | 0));
  lastLevel = idx + 1;
  run = createRun(idx, {});
  run.state.coins = coins;
  run.state.upgrades = { ...upgrades };
  run.state.totalCoins = coins;
  view.fxQueue = [];
  view.flash = 0;
  setPhase('playing');
  ui.showGame();
  hideResult();
  hideToast();
  updateHud();
  updateUpgradeBar();
  audio.startBgm();
  Sdk.track('start', { level: run.state.level });
  if (!tutorialDone && idx === 0) startTutorial();
}

function pauseGame(silent) {
  if (phase !== 'playing') return;
  setPhase('paused');
  audio.stopBgm();
  if (!silent) ui.showPause();
}

function resumeGame() {
  if (phase !== 'paused') return;
  setPhase('playing');
  ui.hidePause();
  audio.startBgm();
}

function restartRun() {
  if (run) Sdk.track('restart', { level: run.state.level });
  startLevel(run ? run.state.level - 1 : lastLevel - 1);
}

function goHome() {
  syncProgress();
  persist();
  run = null;
  setPhase('title');
  hideResult();
  hideToast();
  ui.showTitle();
}

// ---------- HUD / 升级栏 / 结算 ----------
function fmt(n) {
  n = Math.floor(n || 0);
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e4) return `${(n / 1e3).toFixed(1)}K`;
  return `${n}`;
}

const LINE_LABELS = { power: 'upPower', speed: 'upSpeed', temp: 'upTemp', apprentice: 'upApprentice' };
const LINE_EFFECTS = {
  power: () => `+${Math.round(GAME.POWER_PER_LV * 100)}% 🪙`,
  speed: () => `÷${(1 + GAME.SPEED_PER_LV).toFixed(2)} ⏱`,
  temp: () => `+${Math.round(GAME.TEMP_COIN_PER_LV * 100)}% 🪙 · +${Math.round(GAME.TEMP_PROG_PER_LV * 100)}% ✦`,
  apprentice: () => `+${Math.round(GAME.APPRENTICE_YIELD_PER_LV * 100)}% 🪙/s`,
};

function updateHud() {
  if (!run) return;
  const h = run.getHud();
  const lv = LEVELS[h.level - 1] || {};
  const lvName = lv.name ? (lv.name[i18n.lang] || lv.name.en) : '';
  $('hud-level').textContent = `${t('level')} ${h.level} · ${lvName}`;
  $('hud-coins').textContent = `🪙 ${fmt(h.coins)}`;
  const rate = h.forgeInterval > 0 ? (1 / h.forgeInterval).toFixed(1) : '0';
  $('hud-rate').textContent = `⚒ ${rate}/s`;
}

function updateUpgradeBar() {
  if (!run) return;
  const h = run.getHud();
  for (const line of ['power', 'speed', 'temp', 'apprentice']) {
    const el = $(`up-${line}`);
    if (!el) continue;
    const lv = h.upgrades[line] || 0;
    const cost = upgradeCostOf(line, lv);
    const afford = h.coins >= cost;
    el.classList.toggle('can-afford', afford);
    el.innerHTML =
      `<span class="up-name">${t(LINE_LABELS[line])}</span>` +
      `<span class="up-lv">Lv ${lv}</span>` +
      `<span class="up-effect">${LINE_EFFECTS[line]()}</span>` +
      `<span class="up-cost ${afford ? '' : 'poor'}">🪙 ${fmt(cost)}</span>`;
  }
  $('btn-stoke').classList.toggle('hidden', !h.furnaceWindow);
  $('btn-appease').classList.toggle('hidden', !h.strike);
}

function upgradeCostOf(line, lv) {
  // 与 sim.upgradeCost 同源（含短缺涨价）
  const base = GAME.UPGRADE_BASE[line];
  const level = run ? LEVELS[run.state.level - 1] : LEVELS[0];
  let cost = Math.round(base * Math.pow(GAME.UPGRADE_GROWTH, lv));
  if (level.mechanic === 'shortage' && level.shortage === line) cost = Math.round(cost * GAME.SHORTAGE_MULT);
  if (level.mechanic === 'all' && (line === 'temp' || line === 'speed')) cost = Math.round(cost * GAME.SHORTAGE_MULT);
  return cost;
}

function showToast(titleKey, sub) {
  $('toast-title').textContent = t(titleKey);
  $('toast-sub').textContent = sub || '';
  $('masterpiece-toast').classList.remove('hidden');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, 2400);
}

function hideToast() {
  $('masterpiece-toast').classList.add('hidden');
  if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
}

function showResult(st) {
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  $('result-title').textContent = t('masterpieceDone');
  $('result-meta').textContent =
    `${t('level')} ${st.level} · ${t('coins')}: ${fmt(st.totalCoins)} · ⚒ ${st.totalForges}`;
  $('screen-result').classList.remove('hidden');
  persist();
  Sdk.levelCleared({ level: st.level, coins: st.totalCoins });
}

function hideResult() {
  $('screen-result').classList.add('hidden');
}

// ---------- 教程引导（首次自动弹，可跳过，完成/跳过后持久化不再自动弹） ----------
const TUT_STEPS = () => [
  { text: t('tutStep1'), spot: 'anvil' },
  { text: t('tutStep2'), spot: 'power' },
  { text: t('tutStep3'), spot: 'progress' },
];

function worldRect(which) {
  try {
    if (which === 'power') return domRect('up-power');
    if (which === 'anvil' || which === 'progress') {
      const lay = renderer.debugLayout();
      return lay && lay[which] ? lay[which] : null;
    }
  } catch { return null; }
  return null;
}

function domRect(id) {
  const el = document.getElementById(id);
  const c = document.getElementById('game-container');
  if (!el || !c) return null;
  const r = el.getBoundingClientRect();
  const cr = c.getBoundingClientRect();
  const k = 1280 / (cr.width || 1280);
  return { x: (r.left - cr.left) * k, y: (r.top - cr.top) * k, w: r.width * k, h: r.height * k };
}

function startTutorial() {
  tutorialStep = 0;
  renderTutorialStep();
}

function renderTutorialStep() {
  const el = $('tutorial');
  if (tutorialStep < 0) { el.classList.add('hidden'); return; }
  const steps = TUT_STEPS();
  const s = steps[tutorialStep];
  el.classList.remove('hidden');
  $('tut-title').textContent = t('tutTitle');
  $('tut-text').textContent = s ? s.text : '';
  $('tut-skip').textContent = t('tutSkip');
  $('tut-next').textContent = t('tutNext');
  const rect = s && worldRect(s.spot);
  const spot = $('tut-spotlight');
  if (rect) {
    spot.style.display = 'block';
    spot.style.left = `${rect.x - 8}px`;
    spot.style.top = `${rect.y - 8}px`;
    spot.style.width = `${rect.w + 16}px`;
    spot.style.height = `${rect.h + 16}px`;
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

const TUT_TRIGGER = ['tap', 'upgrade', 'forge'];
function tutorialAdvance(evType) {
  if (tutorialStep < 0 || tutorialStep >= TUT_TRIGGER.length) return;
  if (TUT_TRIGGER[tutorialStep] !== evType) return;
  tutorialStep += 1;
  if (tutorialStep >= TUT_TRIGGER.length) endTutorial();
  else renderTutorialStep();
}

// ---------- 事件消费 ----------
function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    tutorialAdvance(ev.type);
    switch (ev.type) {
      case 'forge':
        sparkBurst();
        break;
      case 'tap':
        sparkBurst();
        view.shake = Math.max(view.shake, 2);
        break;
      case 'upgrade':
        view.shake = Math.max(view.shake, 1.5);
        break;
      case 'masterpiece': {
        syncProgress();
        const lv = LEVELS[ev.level - 1] || {};
        const nm = lv.name ? (lv.name[i18n.lang] || lv.name.en) : '';
        const sub = ev.bonus ? `${t('orderBonus')} +${fmt(ev.bonus)}` : '';
        view.flash = 1;
        view.shake = 4;
        showToast('masterpieceDone', nm + (sub ? ` · ${sub}` : ''));
        persist();
        break;
      }
      case 'win':
        syncProgress();
        showResult(run.state);
        audio.event('win', ev);
        return;
      case 'orderDone':
      case 'furnaceWindow':
      case 'furnaceClose':
      case 'strike':
      case 'strikeEnd':
      case 'vein':
      case 'appease':
        updateUpgradeBar();
        break;
      default:
        break;
    }
  }
}

function sparkBurst() {
  view.fxQueue.push({
    type: 'spark',
    x: LAYOUT.ANVIL_X + (Math.random() * 40 - 20),
    y: LAYOUT.ANVIL_Y - 20,
    ttl: 0.5,
    seed: Math.random() * 6,
  });
}

// ---------- 输入 ----------
function canvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (1280 / rect.width),
    y: (e.clientY - rect.top) * (720 / rect.height),
  };
}

function hitAnvil(p) {
  const lay = renderer.debugLayout();
  if (!lay || !lay.anvil) return false;
  const a = lay.anvil;
  const pad = 40;
  return p.x >= a.x - pad && p.x <= a.x + a.w + pad && p.y >= a.y - pad && p.y <= a.y + a.h + pad;
}

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (!run || phase !== 'playing') return;
  const p = canvasPos(e);
  if (hitAnvil(p)) {
    run.tap();
  }
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
  if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'result')) restartRun();
  if (e.code === 'KeyM') toggleMute();
  if (e.code === 'Space') { e.preventDefault(); if (run && phase === 'playing') run.tap(); }
  if (e.code === 'Digit1') buyLine('power');
  if (e.code === 'Digit2') buyLine('speed');
  if (e.code === 'Digit3') buyLine('temp');
  if (e.code === 'Digit4') buyLine('apprentice');
  if (e.code === 'KeyF' && run && phase === 'playing') run.stoke();
  if (e.code === 'KeyA' && run && phase === 'playing') run.appease();
});

function buyLine(line) {
  if (!run || phase !== 'playing') return;
  const res = run.buy(line);
  if (res.ok) {
    audio.unlock();
    view.shake = Math.max(view.shake, 1.5);
  }
}

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  ui.setMuted(muted);
  $('btn-mute').classList.toggle('is-muted', muted);
  persist();
}

// ---------- UI 绑定 ----------
function bind() {
  const on = (id, fn) => {
    const el = $(id);
    if (el) el.addEventListener('click', () => { audio.unlock(); fn(); });
  };
  on('btn-start', () => startLevel(lastLevel - 1));
  on('btn-resume', resumeGame);
  on('btn-restart', restartRun);
  on('btn-restart2', restartRun);
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-stoke', () => { if (run && phase === 'playing') run.stoke(); });
  on('btn-appease', () => { if (run && phase === 'playing') run.appease(); });
  on('btn-offline-collect', () => { $('offline-card').classList.add('hidden'); persist(); });
  on('btn-tut-replay', () => {
    if (phase === 'paused') resumeGame();
    if (phase === 'playing') startTutorial();
  });
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result') startTutorial(); });
  on('btn-rotate-skip', () => { const rs = $('rotate-screen'); if (rs) rs.style.display = 'none'; });
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);

  for (const line of ['power', 'speed', 'temp', 'apprentice']) {
    const el = $(`up-${line}`);
    if (el) el.addEventListener('click', () => { audio.unlock(); buyLine(line); });
  }

  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = $(id);
    if (!sel) continue;
    sel.addEventListener('change', () => {
      ui.setLang(sel.value);
      renderTutorialStep();
      updateUpgradeBar();
      if (run) updateHud();
      const rt = $('rotate-text');
      const rb = $('btn-rotate-skip');
      if (rt) rt.textContent = t('rotateHint');
      if (rb) rb.textContent = t('rotateSkip');
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
    if (run && phase === 'playing') { updateHud(); updateUpgradeBar(); }
  }

  if (view.shake > 0) view.shake = Math.max(0, view.shake - dt * 18);
  if (view.flash > 0) view.flash = Math.max(0, view.flash - dt * 1.6);
  for (const fx of view.fxQueue) if (fx.ttl > 0) fx.ttl -= dt;

  try {
    renderer.draw(run ? run.state : null, dt, view);
  } catch (err) {
    console.warn('render error', err);
  }
  view.fxQueue = view.fxQueue.filter((fx) => fx.ttl > 0);

  if (fpsSamples.length < 600 && dt > 0) fpsSamples.push(1 / dt);
  requestAnimationFrame(frame);
}

// ---------- 调试契约 ----------
window.__ll = {
  state: {
    get phase() { return phase; },
    get lang() { return i18n.lang; },
  },
  run: () => run,
  start: (i) => startLevel(i == null ? (lastLevel - 1) : i),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => restartRun(),
  home: () => goHome(),
  sim: () => (run ? run.state : null),
  save: (k, v) => { if (k === 'coins') coins = v | 0; Sdk.save(k, v); },
  ui,
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return TUT_TRIGGER; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: () => {
      if (!run) return null;
      return { ...run.state, ...run.getHud() };
    },
    layout: () => { try { return renderer.debugLayout(); } catch { return null; } },
    loadLevel: (i) => startLevel(i),
    startSeeded: (i, seed) => {
      const idx = Math.max(0, Math.min(LEVEL_COUNT - 1, i | 0));
      lastLevel = idx + 1;
      run = createRun(idx, { seed: seed | 0 || 1 });
      run.state.coins = coins;
      run.state.upgrades = { ...upgrades };
      run.state.totalCoins = coins;
      view.fxQueue = [];
      view.flash = 0;
      setPhase('playing');
      ui.showGame();
      hideResult();
      hideToast();
      updateHud();
      updateUpgradeBar();
      return true;
    },
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    startTutorial: () => startTutorial(),
    tutorialStep: () => tutorialStep,
    // 验收辅助：greedy 自动玩（买得起就买最便宜的升级，否则点铁砧，抢炉候/安抚罢工），推进到第 3 关
    autoForge: (targetLevel = 3) => {
      if (!run) return false;
      let guard = 4000;
      while (guard-- > 0 && run.state.phase === 'active' && run.state.level < (targetLevel || 3)) {
        const s = run.state;
        if (s.strike.active && s.coins >= Math.round((s.yield || 1) * GAME.APPEASE_COST_MULT)) run.appease();
        if (s.furnaceWindow.active) run.stoke();
        let bought = false;
        for (const line of ['power', 'speed', 'temp', 'apprentice']) {
          if (run.buy(line).ok) { bought = true; break; }
        }
        if (!bought) run.tap();
        run.step(1 / 60);
        handleEvents(run.drainEvents());
      }
      return true;
    },
    // 快进：把本关推到大师之作，并一路推进（供验收结算到 result）
    fastForward: () => {
      if (!run) return false;
      try {
        let guard = 24000;
        while (guard-- > 0 && run.state.phase === 'active') {
          run.step(0.25);
          handleEvents(run.drainEvents());
          if (run.state.phase !== 'active') break;
        }
        if (run.state.phase === 'won' && phase !== 'result') showResult(run.state);
        return true;
      } catch { return false; }
    },
    giveUp: () => window.__ll.debug.fastForward(),
    autoPlaceSolution: () => window.__ll.debug.autoForge(3),
  },
};

// ---------- 启动 ----------
bind();
syncDocumentLang();
ui.applyLang();
{
  const rt = $('rotate-text');
  const rb = $('btn-rotate-skip');
  if (rt) rt.textContent = t('rotateHint');
  if (rb) rb.textContent = t('rotateSkip');
  $('offline-title').textContent = t('offlineTitle');
  $('offline-body').textContent = t('offlineBody');
  $('offline-cap').textContent = t('offlineCap');
  $('btn-offline-collect').textContent = t('collect');
}
$('btn-mute').classList.toggle('is-muted', muted);
settleOffline();
Sdk.track('load', {});
requestAnimationFrame(frame);
