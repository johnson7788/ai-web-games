// src/main.js — 装配：固定步长 / 输入 / 事件分发 / 状态机 / SDK / BGM（Lead 所有）
import { STEP, WORLD } from '../config/game.config.js';
import { OFFLINE, formatMoney } from '../config/gameplay.js';
import { createRun } from './game/sim.js';
import { createRender } from './render/index.js';
import { createUI } from './ui/index.js';
import { createAudio } from './core/audio.js';
import { i18n } from './core/i18n.js';
import Sdk from './core/sdk.js';

// ---------- 装配 ----------
const canvas = document.getElementById('canvas');
const uiRoot = document.getElementById('ui-root');
const loadingEl = document.getElementById('loading');

const renderer = createRender(canvas);
const audio = createAudio();
const ui = createUI(uiRoot, {
  onStart: () => startGame(),
  onResume: () => resumeGame(),
  onRestart: () => toTitle(),
  onHow: () => { /* 重看引导 */ },
  onShare: () => shareResult(),
});

// ---------- 状态 ----------
let state = 'boot';             // boot | title | playing | paused
let run = null;
let lastTime = 0;
let accumulator = 0;
let bestNetWorth = 0;
const queue = [];               // 玩家动作队列（边沿触发）

// ---------- 输入 ----------
function tapAt(clientX, clientY) {
  if (state !== 'playing') return;
  audio.unlock();
  queue.push({ tap: true, x: clientX, y: clientY });
}

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  tapAt(e.clientX, e.clientY);
});

// 键盘：空格/回车点击，Esc 暂停，C 收取
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'Enter') {
    if (state === 'title') startGame();
    else if (state === 'playing') { audio.unlock(); queue.push({ tap: true }); }
    if (e.code === 'Space') e.preventDefault();
  }
  if (e.code === 'KeyC' && state === 'playing') queue.push({ collect: true });
  if (e.code === 'KeyL' && state === 'playing') queue.push({ loan: true });
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
});

// ---------- 产业按钮（事件委托） ----------
ui.els.panelList.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn || state !== 'playing') return;
  audio.unlock();
  if (btn.id.startsWith('btn-buy-')) queue.push({ buy: parseInt(btn.id.slice(8), 10) });
  else if (btn.id.startsWith('btn-upgrade-')) queue.push({ upgrade: parseInt(btn.id.slice(12), 10) });
  else if (btn.id.startsWith('btn-hire-')) queue.push({ hire: parseInt(btn.id.slice(9), 10) });
  else return;
  audio.event('ui', {});
});

ui.els.btnCollect.addEventListener('click', () => { audio.unlock(); queue.push({ collect: true }); audio.event('ui', {}); });
ui.els.btnLoan.addEventListener('click', () => { audio.unlock(); queue.push({ loan: true }); audio.event('ui', {}); });
ui.els.btnRepay.addEventListener('click', () => { audio.unlock(); queue.push({ repay: true }); audio.event('ui', {}); });
ui.els.btnAllInUp.addEventListener('click', () => { audio.unlock(); queue.push({ allIn: true, allInUp: true }); audio.event('ui', {}); });
ui.els.btnAllInDown.addEventListener('click', () => { audio.unlock(); queue.push({ allIn: true, allInUp: false }); audio.event('ui', {}); });

function drainInput() {
  const input = {};
  let tapX = null;
  let tapY = null;
  for (const a of queue) {
    if (a.tap) { input.tap = true; tapX = a.x; tapY = a.y; }
    if (a.buy != null) input.buy = a.buy;
    if (a.upgrade != null) input.upgrade = a.upgrade;
    if (a.hire != null) input.hire = a.hire;
    if (a.collect) input.collect = true;
    if (a.allIn) { input.allIn = true; input.allInUp = a.allInUp; }
    if (a.loan) input.loan = true;
    if (a.repay) input.repay = true;
  }
  queue.length = 0;
  return { input, tapX, tapY };
}

// ---------- 音频设置 ----------
function applyAudioSettings() {
  const muted = Sdk.load('muted', false);
  const vol = Sdk.load('volume', 0.8);
  audio.setMuted(!!muted);
  audio.setVolume(vol);
}

// ---------- 游戏流转 ----------
function startGame() {
  audio.unlock();
  run = createRun({ seed: (Date.now() & 0xffff) * 2654435761 >>> 0, saveData: loadedSave, offlineSec: loadedOfflineSec });
  // 一次性处理离线收益等初始事件
  for (const ev of run.drainEvents()) {
    if (ev.type === 'offlineIncome') ui.showOffline(ev.amount);
  }
  state = 'playing';
  accumulator = 0;
  lastTime = performance.now();
  ui.show('playing');
  Sdk.newRun({ zone: 1 });
  setBgm('main');
  applyAudioSettings();
  Sdk.track('start', {});
}

function togglePause() {
  if (state === 'playing') { state = 'paused'; ui.show('paused'); setBgm(null); }
  else if (state === 'paused') { resumeGame(); }
}
function resumeGame() {
  if (state === 'paused') { state = 'playing'; ui.show('playing'); lastTime = performance.now(); setBgm('main'); }
}

function toTitle() {
  state = 'title';
  run = null;
  ui.show('title');
  renderer.draw(null, 1, 0);
  setBgm(null);
  Sdk.track('restart', {});
}

async function shareResult() {
  const worth = run ? run.getHud().netWorth : 0;
  await Sdk.share({
    title: 'TYCOON EMPIRE',
    text: `${i18n.lang === 'zh' ? `我的商业帝国身家 ${formatMoney(worth)}！` : `My empire is worth ${formatMoney(worth)}!`} TYCOON EMPIRE`,
  });
  Sdk.track('share', { worth: Math.floor(worth) });
}

function setBgm(kind) {
  if (kind) audio.playBgm(kind);
  else audio.stopBgm();
}

// ---------- 事件分发 ----------
function dispatchEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);

    if (ev.type === 'tap') renderer.burst(ev.x ?? 430, ev.y ?? 480, 'coin');
    else if (ev.type === 'tapCombo') renderer.burst(430, 480, 'gold');
    else if (ev.type === 'buy' || ev.type === 'upgrade' || ev.type === 'hire') renderer.burst(430, 420, 'gold');
    else if (ev.type === 'buildingUp') renderer.burst(430, 300, 'chain');
    else if (ev.type === 'collect' || ev.type === 'offlineIncome') renderer.burst(430, 520, 'coin');
    else if (ev.type === 'stockResolve') renderer.burst(430, 300, 'gold');
    else if (ev.type === 'bankrupt') ui.showBankrupt();

    if (state === 'playing') ui.tutorial.onGameEvent(ev, performance.now());

    // 关键埋点（失败不影响玩法）
    if (ev.type === 'buy') Sdk.track('buy', { industry: ev.industry });
    else if (ev.type === 'upgrade') Sdk.track('upgrade', { industry: ev.industry });
    else if (ev.type === 'hire') Sdk.track('hire', { industry: ev.industry });
    else if (ev.type === 'stockDay') Sdk.track('stockDay', { industry: ev.industry });
    else if (ev.type === 'allIn') Sdk.track('allIn', { up: ev.up });
    else if (ev.type === 'loan') Sdk.track('loan', { amount: Math.floor(ev.amount) });
    else if (ev.type === 'bankrupt') Sdk.track('bankrupt', {});
  }
}

// ---------- 主循环 ----------
function loop(now) {
  requestAnimationFrame(loop);

  if (state !== 'playing') {
    const dtMs = now - lastTime;
    renderer.draw(state === 'paused' ? run : null, 1, dtMs / 1000);
    return;
  }

  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  accumulator += dt;

  let steps = 0;
  while (accumulator >= STEP && steps < 6) {
    const { input } = drainInput();
    run.step(input);
    accumulator -= STEP;
    steps++;
    dispatchEvents(run.drainEvents());
  }

  const hud = run.getHud();
  ui.setHud(hud);
  renderer.draw(run, accumulator / STEP, dt);
  ui.tutorial.tick(now);

  // 股市日切行情 BGM
  setBgm(hud.stock.betting ? 'market' : 'main');

  if (hud.netWorth > bestNetWorth) bestNetWorth = hud.netWorth;
}

// ---------- 失焦自动暂停 + 存档 ----------
function persist() {
  if (!run) return;
  Sdk.save('save', run.serialize());
  Sdk.save('lastSeen', Date.now());
  Sdk.save('bestNetWorth', Math.max(bestNetWorth, run.stats.highestNetWorth));
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'playing') togglePause();
  persist();
});
window.addEventListener('beforeunload', persist);
setInterval(() => { if (state === 'playing') persist(); }, 5000);

// ---------- 广告期间静音 ----------
Sdk.onAdStart(() => audio.setMuted(true));
Sdk.onAdEnd(() => { audio.setMuted(!!Sdk.load('muted', false)); });

// ---------- 启动 ----------
let loadedSave = null;
let loadedOfflineSec = 0;

(async () => {
  bestNetWorth = Math.floor(Sdk.load('bestNetWorth', 0)) || 0;
  ui.setBest(bestNetWorth);
  applyAudioSettings();
  loadedSave = Sdk.load('save', null);
  const lastSeen = Sdk.load('lastSeen', null);
  const elapsed = (loadedSave && lastSeen) ? (Date.now() - lastSeen) / 1000 : 0;
  loadedOfflineSec = elapsed >= OFFLINE.minSec ? Math.min(elapsed, OFFLINE.capSec) : 0;
  await Sdk.ready();
  Sdk.track('load', { lang: i18n.lang });
  // 玩家可能在 boot 期间已点 Start（异步 SDK 加载窗口）；只在还没开局时才显示标题
  if (state === 'boot') { state = 'title'; ui.show('title'); }
  renderer.draw(null, 1, 0);
  loadingEl.classList.add('hidden');
  lastTime = performance.now();
  requestAnimationFrame(loop);
})();

// ---------- 标准调试契约 ----------
window.G = {
  get run() { return run; },
  ui,
  renderer,
  audio,
  Sdk,
  get state() { return state; },
};

window.__ll = {
  get state() { return { phase: state, lang: i18n.lang, dir: i18n.dir }; },
  lang: () => i18n.lang,
  setLang: (l) => { i18n.setLang(l); ui.applyLang(); },
  get run() { return run; },
  start: startGame,
  pause: togglePause,
  resume: resumeGame,
  restart: toTitle,
  tutorial: {
    get active() { return ui.tutorial.active; },
    get step() { return ui.tutorial.step; },
    get steps() { return ui.tutorial.steps; },
    get current() { return ui.tutorial.current; },
    skip: () => ui.tutorial.skip(),
  },
  save: () => Sdk.save,
  ui: () => ui,
  debug: {
    layout: () => ({ viewport: [canvas.clientWidth, canvas.clientHeight] }),
    // 截图/验收用：按贪心策略快进 N 秒（不跳过游戏循环，直接驱动 sim）
    advance(seconds) {
      if (!run || state !== 'playing') return 0;
      const n = Math.round(seconds * 60);
      for (let k = 0; k < n; k += 1) {
        const input = { tap: k % 30 !== 0 };
        const hud = run.getHud();
        const buyable = hud.industries.filter((i) => i.unlocked && !i.owned).sort((a, b) => a.buyCost - b.buyCost);
        const hireable = hud.industries.filter((i) => i.owned && !i.manager).sort((a, b) => a.managerCost - b.managerCost);
        if (buyable.length && run.cash >= buyable[0].buyCost) input.buy = buyable[0].index;
        else if (hireable.length && run.cash >= hireable[0].managerCost) input.hire = hireable[0].index;
        else {
          const owned = hud.industries.filter((i) => i.owned);
          let best = null;
          let bestScore = -Infinity;
          for (const o of owned) {
            const gain = (o.rate * 1.12) - o.rate;
            const cost = o.upgradeCost;
            const score = gain / Math.max(1, cost);
            if (score > bestScore && run.cash >= cost) { bestScore = score; best = o.index; }
          }
          if (best != null) input.upgrade = best;
          else if (owned.some((i) => i.pending > 0)) input.collect = true;
        }
        run.step(input);
        run.drainEvents();
      }
      ui.setHud(run.getHud());
      return run.unlockedCount;
    },
  },
};
