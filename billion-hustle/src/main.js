// src/main.js — 装配：固定步长 / 输入 / 事件分发 / 状态机 / SDK / BGM（Lead 所有）
import { STEP, WORLD } from '../config/game.config.js';
import { createRun } from './game/sim.js';
import { createRender, LAYOUT } from './render/index.js';
import { createUI } from './ui/index.js';
import { createAudio } from './core/audio.js';
import { i18n } from './core/i18n.js';
import { save } from './core/save.js';
import Sdk from './core/sdk.js';

// ---------- 装配 ----------
const canvas = document.getElementById('canvas');
const uiRoot = document.getElementById('ui-root');
const loadingEl = document.getElementById('loading');

const renderer = createRender(canvas);
const audio = createAudio();

// ---------- 状态 ----------
let state = 'boot';             // boot | title | playing | paused | won
let run = null;
let lastTime = 0;
let accumulator = 0;
let bgmMode = 'none';
let bestValuation = 0;
let fundTimer = null;

// ---------- UI ----------
const ui = createUI(uiRoot, {
  onStart: () => startGame(),
  onResume: () => resumeGame(),
  onRestart: () => toTitle(),
  onShare: () => shareResult(),
  onHow: () => { /* 重看引导 */ },
  onMute: (muted) => {
    audio.setMuted(muted);
    return muted;
  },
  getMuted: () => !!save.get('audioMuted', false),
  onTap: () => {
    audio.unlock();
    if (state === 'playing' && run) run.click();
  },
  onBurn: () => {
    audio.unlock();
    if (state === 'playing' && run) run.toggleBurn();
  },
  onUpgrade: (id) => {
    audio.unlock();
    if (state === 'playing' && run) run.buyUpgrade(id);
  },
  onPartner: (id) => {
    audio.unlock();
    if (state === 'playing' && run) run.hirePartner(id);
  },
  onBet: (index) => {
    audio.unlock();
    if (state === 'playing' && run) run.placeBet(index);
  },
});
ui.onTutorial((result) => {
  Sdk.track('tutorial_done', { skipped: !!result?.skipped });
});
ui.setBest(bestValuation);

// ---------- 游戏流转 ----------
function startGame() {
  audio.unlock();
  run = createRun({ seed: (Date.now() & 0xffff) * 2654435761 >>> 0 });
  state = 'playing';
  accumulator = 0;
  lastTime = performance.now();
  ui.show('playing');
  Sdk.newRun({ zone: 1 });
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
  setBgm('none');
}

function onWin() {
  state = 'won';
  const stats = run.stats || {};
  const valuation = Math.floor(stats.totalEarned ?? 0);
  const best = Math.max(valuation, Sdk.load('bestValuation', 0));
  Sdk.save('bestValuation', best);
  bestValuation = best;
  ui.setBest(best);
  ui.show('won', {
    valuation,
    income: Math.floor(stats.maxIncomeRate ?? 0),
    clicks: stats.clicks ?? 0,
  });
  Sdk.levelCleared({ valuation, round: run.round });
  setBgm('none');
}

async function shareResult() {
  const valuation = Math.floor(run?.stats?.totalEarned ?? 0);
  await Sdk.share({
    title: 'BILLION HUSTLE',
    text: `${i18n.lang === 'zh' ? `我把一家车库公司做成了 ¥${valuation} 估值！` : `I flipped a garage startup to ¥${valuation} valuation!`} BILLION HUSTLE`,
  });
  Sdk.track('share', { valuation });
}

function setBgm(mode) {
  if (bgmMode === mode) return;
  bgmMode = mode;
  if (mode === 'none') audio.stopBgm();
  else audio.playBgm(mode);
}

// ---------- 事件分发 ----------
function dispatchEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);

    // 视觉反馈
    if (ev.type === 'click') renderer.burst(LAYOUT.tapX, LAYOUT.tapY, 'coin');
    else if (ev.type === 'fund') {
      renderer.burst(WORLD.WIDTH / 2, WORLD.HEIGHT / 2, 'confetti');
      ui.showFunding(ev);
      if (fundTimer) clearTimeout(fundTimer);
      fundTimer = setTimeout(() => ui.hideFunding(), 1700);
    } else if (ev.type === 'valuationFlip') ui.flashValuation();
    else if (ev.type === 'won') renderer.burst(WORLD.WIDTH / 2, 220, 'confetti');

    // 教程
    if (state === 'playing') ui.tutorial.onGameEvent(ev, performance.now());

    // 关键埋点（失败不影响玩法）
    if (ev.type === 'fund') Sdk.track('fund', { round: ev.round, key: ev.key });
    else if (ev.type === 'won') Sdk.track('win', {});
  }
}

// ---------- 键盘 ----------
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'Enter' && state === 'title') startGame();
  if (e.code === 'Space') {
    if (state === 'title') startGame();
    else if (state === 'playing') { e.preventDefault(); audio.unlock(); run?.click(); }
  }
  if (e.code === 'KeyR' && state === 'won') startGame();
});

// ---------- 主循环 ----------
function loop(now) {
  requestAnimationFrame(loop);

  if (state !== 'playing') {
    renderer.draw(state === 'paused' || state === 'won' ? run : null, 1, state);
    return;
  }

  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  accumulator += dt;

  let steps = 0;
  while (accumulator >= STEP && steps < 6) {
    run.step();
    accumulator -= STEP;
    steps++;
    dispatchEvents(run.drainEvents());
    if (run.phase === 'won') { onWin(); return; }
  }

  const hud = run.getHud();
  setBgm(hud.sceneId);
  renderer.draw(run, accumulator / STEP, state);
  ui.setHud(hud);
  ui.tutorial.tick(performance.now());
}

// ---------- 失焦自动暂停 ----------
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'playing') togglePause();
});

// ---------- 广告期间静音 ----------
Sdk.onAdStart(() => audio.setMuted(true));
Sdk.onAdEnd(() => { audio.setMuted(!!save.get('audioMuted', false)); });

// ---------- 启动 ----------
(async () => {
  bestValuation = Math.floor(Sdk.load('bestValuation', 0)) || 0;
  ui.setBest(bestValuation);
  await Sdk.ready();
  Sdk.track('load', { lang: i18n.lang });
  // 玩家可能在 boot 期间已点 Start（异步 SDK 加载窗口）；只在还没开局时才显示标题
  if (state === 'boot') { state = 'title'; ui.show('title'); }
  renderer.draw(null, 1, state);
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
  debug: { layout: () => ({ viewport: [canvas.clientWidth, canvas.clientHeight], tap: [LAYOUT.tapX, LAYOUT.tapY] }) },
};
