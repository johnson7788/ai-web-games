// src/main.js — 装配：固定步长 / 输入（按住倒水）/ 事件分发 / 状态机 / SDK / BGM（Lead 所有）
import { STEP, WORLD } from '../config/game.config.js';
import { createRun } from './game/sim.js';
import { createRender } from './render/index.js';
import { createUI } from './ui/index.js';
import { createAudio } from './core/audio.js';
import { i18n } from './core/i18n.js';
import Sdk from './core/sdk.js';

const canvas = document.getElementById('canvas');
const uiRoot = document.getElementById('ui-root');
const loadingEl = document.getElementById('loading');
const btnSkip = document.getElementById('btn-skip');

const renderer = createRender(canvas);
const audio = createAudio();

const CUP_SURFACE = { cx: 560, mouthY: 250, bottomY: 540 };

let state = 'boot';            // boot | title | playing | paused | shop | result
let run = null;
let lastTime = 0;
let accumulator = 0;
let pouring = false;
let skipQueued = false;
let runEnded = 'dead';        // dead | won
let best = { days: 0, coins: 0 };

// ---------- 输入（边沿检测归 main） ----------
const keys = { space: false };

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') { keys.space = true; if (state === 'playing') pouring = true; e.preventDefault(); }
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'KeyR' && state === 'result') startGame();
  if (e.code === 'Enter' && state === 'title') startGame();
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'Space') { keys.space = false; if (state === 'playing') pouring = false; }
});

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (state === 'playing') pouring = true;
});
canvas.addEventListener('pointerup', () => { if (state === 'playing') pouring = false; });
canvas.addEventListener('pointercancel', () => { if (state === 'playing') pouring = false; });
canvas.addEventListener('pointerleave', () => { if (state === 'playing') pouring = false; });

if (btnSkip) {
  btnSkip.addEventListener('click', () => {
    audio.unlock();
    if (state === 'playing' && run) { run.skip(); audio.event('orderSkipped'); }
  });
}

// ---------- UI ----------
const ui = createUI(uiRoot, {
  onStart: () => startGame(),
  onResume: () => resumeGame(),
  onRestart: () => startGame(),
  onShare: () => shareResult(),
  onHow: () => {},
  onNextDay: () => nextDay(),
  onBuy: (id) => { if (run && state === 'shop') { run.buyUpgrade(id); ui.setHud(run.getHud()); } },
});
ui.onTutorial((result) => {
  Sdk.track('tutorial_done', { skipped: !!result?.skipped });
});
ui.setBest(best);

function applyAudioSettings() {
  const muted = Sdk.load('muted', false);
  const vol = Sdk.load('volume', 0.8);
  audio.setMuted(!!muted);
  audio.setVolume(vol);
}

// ---------- 游戏流转 ----------
function startGame() {
  audio.unlock();
  run = createRun({ seed: (Date.now() & 0xffff) * 2654435761 >>> 0 });
  runEnded = 'dead';
  state = 'playing';
  pouring = false;
  skipQueued = false;
  accumulator = 0;
  lastTime = performance.now();
  ui.show('playing');
  Sdk.newRun({ zone: 1 });
  audio.playBgm();
  applyAudioSettings();
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
  Sdk.track('restart', {});
}

function onShop() {
  state = 'shop';
  ui.setHud(run.getHud());
  ui.show('shop');
}

function nextDay() {
  if (state !== 'shop' || !run) return;
  audio.event('ui');
  run.nextDay();
  if (run.phase === 'won') { finishRun('won'); return; }
  state = 'playing';
  lastTime = performance.now();
  ui.show('playing');
}

function finishRun(ended) {
  runEnded = ended;
  state = 'result';
  const stats = run.stats || {};
  const days = stats.maxDay || run.day;
  const coins = run.coins;
  const isRecord = ended === 'won' && (days > best.days || (days === best.days && coins > best.coins));
  if (isRecord) {
    best = { days, coins };
    Sdk.save('bestDays', days);
    Sdk.save('bestCoins', coins);
  }
  const rating = ratingFor(run);
  ui.setBest(best);
  ui.show('dead', {
    days,
    perfects: run.perfects,
    fullHouses: run.fullHouses,
    coins,
    rating,
    bestDays: best.days,
    newRecord: isRecord,
  });
  audio.stopBgm();
  if (ended === 'won') {
    Sdk.levelCleared({ days, coins, perfects: run.perfects });
    audio.event('win');
  } else {
    Sdk.gameOver({ days, coins });
    audio.event('death');
  }
}

function ratingFor(r) {
  if (!r.perfects) return 'ok';
  const ratio = r.perfects / Math.max(1, r.orderIndex);
  if (ratio >= 0.85) return 'perfect';
  if (ratio >= 0.6) return 'good';
  return 'ok';
}

async function shareResult() {
  const days = run?.stats?.maxDay ?? run?.day ?? 0;
  await Sdk.share({
    title: 'WATER RITUAL',
    text: i18n.lang === 'zh'
      ? `我把茶馆经营了 ${days} 天！来试试你的倒水手感`
      : `I ran the teahouse for ${days} days! WATER RITUAL`,
  });
  Sdk.track('share', { days });
}

// ---------- 事件分发 ----------
function dispatchEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);

    // 视觉特效
    if (ev.type === 'perfect') {
      const hud = run.getHud();
      const lv = hud.pour ? hud.pour.level : 0;
      const sy = CUP_SURFACE.bottomY - lv * (CUP_SURFACE.bottomY - CUP_SURFACE.mouthY);
      renderer.burst(CUP_SURFACE.cx, sy, 'ripple');
    } else if (ev.type === 'orderScored') {
      renderer.burst(640, 300, 'coin');
    }

    // 教程
    if (state === 'playing') ui.tutorial.onGameEvent(ev, performance.now());

    // 关键埋点（失败不影响玩法）
    if (ev.type === 'orderScored') Sdk.track('orderScored', { accuracy: ev.accuracy, rating: ev.rating });
    else if (ev.type === 'perfect') Sdk.track('perfect', {});
    else if (ev.type === 'fullHouse') Sdk.track('fullHouse', {});
  }
}

// ---------- 主循环 ----------
function loop(now) {
  requestAnimationFrame(loop);

  if (state !== 'playing') {
    renderer.draw(state === 'paused' || state === 'shop' || state === 'result' ? run : null, 1);
    return;
  }

  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  accumulator += dt;

  let steps = 0;
  while (accumulator >= STEP && steps < 6) {
    run.step({ pouring, skip: skipQueued });
    skipQueued = false;
    accumulator -= STEP;
    steps++;
    dispatchEvents(run.drainEvents());
    if (run.phase === 'dead') { finishRun('dead'); return; }
    if (run.phase === 'shop') { onShop(); return; }
  }

  renderer.draw(run, accumulator / STEP);
  ui.setHud(run.getHud());
  ui.tutorial.tick(performance.now());
}

// ---------- 失焦自动暂停 ----------
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'playing') togglePause();
});
window.addEventListener('pagehide', () => { Sdk.track('session_end', {}); });

// ---------- 广告期间静音 ----------
Sdk.onAdStart(() => audio.setMuted(true));
Sdk.onAdEnd(() => { audio.setMuted(!!Sdk.load('muted', false)); });

// ---------- 启动 ----------
(async () => {
  best = {
    days: Math.floor(Sdk.load('bestDays', 0)) || 0,
    coins: Math.floor(Sdk.load('bestCoins', 0)) || 0,
  };
  ui.setBest(best);
  applyAudioSettings();
  await Sdk.ready();
  Sdk.track('load', { lang: i18n.lang });
  // 玩家可能在 boot 期间已点 Start（异步 SDK 加载窗口）；只在还没开局时才显示标题
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
  debug: { layout: () => ({ viewport: [canvas.clientWidth, canvas.clientHeight], skip: !!btnSkip && !btnSkip.hidden }) },
};
