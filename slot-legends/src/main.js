// src/main.js — SLOT LEGENDS 装配：固定步长 / 输入 / 事件分发 / 状态机 / SDK / BGM（Lead 所有）
import { STEP } from '../config/game.config.js';
import { BET_DEFAULT, escortUnlocked, levelFor } from '../config/gameplay.js';
import { createRun } from './game/sim.js';
import { createRender } from './render/index.js';
import { createUI } from './ui/index.js';
import { createAudio } from './core/audio.js';
import { i18n } from './core/i18n.js';
import Sdk from './core/sdk.js';

const canvas = document.getElementById('canvas');
const uiRoot = document.getElementById('ui-root');
const loadingEl = document.getElementById('loading');

const renderer = createRender(canvas);
const audio = createAudio();

// ---------- 状态 ----------
let state = 'boot';              // boot | title | playing | paused | dead
let run = null;
let lastTime = 0;
let accumulator = 0;

let spinQueued = false;          // 旋转边沿
let stopQueued = false;          // 停止边沿
let betSelection = BET_DEFAULT;
let escortSelection = false;

let bestBalance = 0;

// ---------- 持久化 ----------
function persist() {
  if (!run) return;
  Sdk.save('tokens', run.tokens);
  Sdk.save('totalSpins', run.totalSpins);
  Sdk.save('bestBalance', bestBalance);
}

// ---------- 输入 ----------
function pressSpinOrStop() {
  if (state !== 'playing' || !run) return;
  audio.unlock();
  if (run.phase === 'idle') spinQueued = true;
  else if (run.phase === 'spinning') stopQueued = true;
}

function setBet(v) {
  betSelection = Number(v);
  audio.event('bet', {});
}

function toggleEscort() {
  if (!run || !escortUnlocked(run.level)) return;
  escortSelection = !escortSelection;
  audio.event('escort', {});
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') { pressSpinOrStop(); e.preventDefault(); }
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'KeyR' && state === 'dead') startGame();
  if (e.code === 'Enter' && state === 'title') startGame();
});

// ---------- 音频设置 ----------
function applyAudioSettings() {
  audio.setMuted(!!Sdk.load('muted', false));
  audio.setVolume(Sdk.load('volume', 0.7));
}

// ---------- 游戏流转 ----------
function startGame() {
  audio.unlock();
  run = createRun({
    seed: (Date.now() & 0xffff) * 2654435761 >>> 0,
    tokens: Math.floor(Sdk.load('tokens', 0)) || 0,
    spins: Math.floor(Sdk.load('totalSpins', 0)) || 0,
  });
  state = 'playing';
  spinQueued = false;
  stopQueued = false;
  betSelection = run.bet;
  escortSelection = false;
  accumulator = 0;
  lastTime = performance.now();
  ui.show('playing');
  ui.setPhase(run.phase);
  Sdk.newRun({ level: run.level });
  applyAudioSettings();
  audio.playBgm();
}

function togglePause() {
  if (state === 'playing') { state = 'paused'; ui.show('paused'); }
  else if (state === 'paused') { resumeGame(); }
}
function resumeGame() {
  if (state === 'paused') { state = 'playing'; ui.show('playing'); lastTime = performance.now(); }
}

function toTitle() {
  state = 'title';
  run = null;
  ui.show('title');
  renderer.draw(null, 1);
  audio.stopBgm();
}

function onDeath() {
  state = 'dead';
  const stats = run.stats || {};
  const balance = Math.floor(run.balance ?? 0);
  const isRecord = balance > bestBalance;
  if (isRecord) bestBalance = balance;
  persist();
  ui.setBest(bestBalance);
  ui.show('dead', {
    level: run.level,
    biggestWin: stats.biggestWin || 0,
    jackpots: stats.jackpots || 0,
    spins: run.totalSpins,
    balance,
    newRecord: isRecord,
  });
  Sdk.gameOver({ level: run.level, biggestWin: stats.biggestWin || 0, spins: run.totalSpins });
  audio.stopBgm();
}

// ---------- 分享 ----------
async function shareResult() {
  const balance = Math.floor(run?.balance ?? 0);
  const level = run?.level ?? 1;
  await Sdk.share({
    title: 'SLOT LEGENDS',
    text: i18n.lang === 'zh'
      ? `我在 SLOT LEGENDS 达到了 ${level} 级，余额 ${balance} 筹码！`
      : `I reached level ${level} with ${balance} chips in SLOT LEGENDS!`,
  });
  Sdk.track('share', { level, balance });
}

// ---------- 事件分发 ----------
function dispatchEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);

    // 粒子
    if (ev.type === 'win') renderer.burst(640, 300, 'pop');
    else if (ev.type === 'bigWin') renderer.burst(640, 300, 'pop');
    else if (ev.type === 'jackpot') { renderer.burst(400, 260, 'gold'); renderer.burst(880, 320, 'gold'); }
    else if (ev.type === 'scatter') renderer.burst(640, 300, 'gold');
    else if (ev.type === 'pity') { renderer.burst(640, 300, 'gold'); renderer.burst(400, 300, 'gold'); }

    // 反馈横幅
    if (ev.type === 'win') ui.flashFeedback(i18n.get('ctl.win', { amount: ev.amount }), 'win');
    else if (ev.type === 'bigWin') ui.flashFeedback(i18n.get('ctl.bigwin'), 'bigwin');
    else if (ev.type === 'jackpot') ui.flashFeedback(i18n.get('ctl.jackpot'), 'jackpot');
    else if (ev.type === 'levelUp') ui.flashFeedback(i18n.get('ctl.levelup', { level: ev.level }), 'levelup');
    else if (ev.type === 'freeSpin') ui.flashFeedback(i18n.get('ctl.freespins', { n: ev.count }), 'freespin');
    else if (ev.type === 'pity') ui.flashFeedback(i18n.get('ctl.jackpot'), 'jackpot');

    // 教程
    if (state === 'playing') ui.tutorial.onGameEvent(ev, performance.now());

    // 埋点（失败不影响玩法）
    if (ev.type === 'jackpot') Sdk.track('jackpot', { amount: ev.amount });
    else if (ev.type === 'freeSpin') Sdk.track('freeSpin', { count: ev.count });
    else if (ev.type === 'levelUp') Sdk.track('levelUp', { level: ev.level });
  }

  // 关键事件持久化
  if (events.some((e) => ['token', 'pity', 'levelUp', 'bankrupt', 'win', 'bigWin', 'jackpot', 'freeSpin'].includes(e.type))) {
    persist();
  }
}

// ---------- 主循环 ----------
function loop(now) {
  requestAnimationFrame(loop);

  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  renderer.tick(dt);

  if (state !== 'playing') {
    renderer.draw(state === 'paused' || state === 'dead' ? run : null, 1);
    return;
  }

  accumulator += dt;
  let steps = 0;
  while (accumulator >= STEP && steps < 6) {
    run.step({ spin: spinQueued, stop: stopQueued, bet: betSelection, escort: escortSelection });
    spinQueued = false;
    stopQueued = false;
    accumulator -= STEP;
    steps += 1;
    const events = run.drainEvents();
    dispatchEvents(events);
    if (run.phase === 'dead') { onDeath(); return; }
  }

  const hud = run.getHud();
  renderer.draw(run, accumulator / STEP);
  ui.setHud(hud);
  ui.setPhase(run.phase);
  ui.tutorial.tick(performance.now());
}

// ---------- 失焦自动暂停 ----------
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'playing') togglePause();
});

// ---------- 广告期间静音 ----------
Sdk.onAdStart(() => audio.setMuted(true));
Sdk.onAdEnd(() => { audio.setMuted(!!Sdk.load('muted', false)); });

// ---------- UI ----------
const ui = createUI(uiRoot, {
  onPlay: () => startGame(),
  onResume: () => resumeGame(),
  onRestart: () => toTitle(),
  onBackToTitle: () => toTitle(),
  onShare: () => shareResult(),
  onHow: () => { /* 重看引导由 UI 内部处理 */ },
  onMute: () => {
    const next = !Sdk.load('muted', false);
    Sdk.save('muted', next);
    audio.setMuted(next);
    ui.setMuteLabel(next);
    ui.applyLang();
  },
  onBet: setBet,
  onEscort: toggleEscort,
  onSpinOrStop: pressSpinOrStop,
});
ui.onTutorial((result) => {
  Sdk.track('tutorial_done', { skipped: !!result?.skipped });
});

// ---------- 启动 ----------
(async () => {
  bestBalance = Math.floor(Sdk.load('bestBalance', 0)) || 0;
  ui.setBest(bestBalance);
  const savedSpins = Math.floor(Sdk.load('totalSpins', 0)) || 0;
  ui.setTitleLevel(levelFor(savedSpins));
  applyAudioSettings();
  ui.setMuteLabel(!!Sdk.load('muted', false));
  await Sdk.ready();
  Sdk.track('load', { lang: i18n.lang });
  if (state === 'boot') { state = 'title'; ui.show('title'); }
  renderer.draw(null, 1);
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
  spin: pressSpinOrStop,
  setBet,
  toggleEscort,
  debug: {
    layout: () => ({
      viewport: [canvas.clientWidth, canvas.clientHeight],
      spin: !!ui.hud.els.spinBtn.offsetParent,
      bet: !!ui.hud.els.betBar.offsetParent,
    }),
    setTutorialDone: () => ui.tutorial.skip(),
    setTokens: (n) => { if (run) run.tokens = Math.max(0, Math.floor(n)); },
    setSpins: (n) => {
      if (run) {
        run.totalSpins = Math.max(0, Math.floor(n));
        run.level = levelFor(run.totalSpins);
      }
    },
    setBalance: (n) => { if (run) run.balance = Math.max(0, Math.floor(n)); },
    setBetValue: (n) => { betSelection = Number(n); if (run) run.bet = Number(n); },
    setEscort: (b) => { escortSelection = !!b; if (run) run.escort = !!b; },
  },
};
