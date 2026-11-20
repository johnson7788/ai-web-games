// src/main.js — CAKE KART 装配：固定步长 / 输入 / 事件分发 / 状态机 / SDK / BGM。
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

const renderer = createRender(canvas);
const audio = createAudio();
const ui = createUI(uiRoot, {
  onRace: () => startGame(),
  onResume: () => resumeGame(),
  onRestart: () => startGame(),
  onShare: () => shareResult(),
  onHow: () => {},
});

ui.onTutorial((result) => {
  Sdk.track('tutorial_done', { skipped: !!result?.skipped });
});

// ---------- 状态 ----------
let state = 'boot';   // boot | title | playing | paused | finished
let run = null;
let lastTime = 0;
let accumulator = 0;
let bestFinish = 0;
let station = 1;

// ---------- 输入 ----------
const keys = { left: false, right: false, up: false, drift: false, item: false };

function steerValue() {
  return (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
}

function bindKey(e, down) {
  switch (e.code) {
    case 'ArrowLeft': case 'KeyA': keys.left = down; break;
    case 'ArrowRight': case 'KeyD': keys.right = down; break;
    case 'ArrowUp': case 'KeyW': keys.up = down; break;
    case 'ShiftLeft': case 'ShiftRight': keys.drift = down; if (down) e.preventDefault(); break;
    case 'Space': keys.item = down; if (down) e.preventDefault(); break;
    default: return;
  }
}

window.addEventListener('keydown', (e) => {
  bindKey(e, true);
  if ((e.code === 'ArrowLeft' || e.code === 'KeyA' || e.code === 'ArrowRight' || e.code === 'KeyD') && state === 'playing') {
    ui.tutorial.onGameEvent({ type: 'steer' });
  }
  if ((e.code === 'ArrowUp' || e.code === 'KeyW') && state === 'playing') {
    ui.tutorial.onGameEvent({ type: 'throttle' });
  }
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'KeyR' && state === 'finished') startGame();
  if (e.code === 'Enter' && state === 'title') startGame();
});
window.addEventListener('keyup', (e) => bindKey(e, false));

// ---------- 触屏按钮 ----------
const touchBtns = ['left', 'right', 'up', 'drift', 'item'];
function bindTouch(id, key) {
  const el = document.getElementById('btn-' + id);
  if (!el) return;
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); audio.unlock(); keys[key] = true; if (key === 'left' || key === 'right') ui.tutorial.onGameEvent({ type: 'steer' }); if (key === 'up') ui.tutorial.onGameEvent({ type: 'throttle' }); });
  el.addEventListener('pointerup', () => { keys[key] = false; });
  el.addEventListener('pointercancel', () => { keys[key] = false; });
  el.addEventListener('pointerleave', () => { keys[key] = false; });
}
for (const [id, key] of [['left', 'left'], ['right', 'right'], ['up', 'up'], ['drift', 'drift'], ['item', 'item']]) bindTouch(id, key);

// ---------- 音频 ----------
function applyAudioSettings() {
  const muted = Sdk.load('muted', false);
  const vol = Sdk.load('volume', 0.8);
  audio.setMuted(!!muted);
  audio.setVolume(vol);
}

// ---------- 流转 ----------
function startGame() {
  audio.unlock();
  run = createRun({ seed: (Date.now() & 0xffff) * 2654435761 >>> 0, station });
  state = 'playing';
  accumulator = 0;
  lastTime = performance.now();
  ui.setStation(station);
  ui.show('playing');
  Sdk.newRun({ station });
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

function onFinish() {
  state = 'finished';
  const rank = run.player.rank;
  const time = run.player.finishTime ?? run.time;
  const isRecord = bestFinish === 0 || rank < bestFinish;
  if (isRecord && rank > 0) {
    bestFinish = rank;
    Sdk.save('bestFinish', bestFinish);
  }
  ui.setBest(bestFinish);
  ui.show('finished', {
    rank,
    time,
    best: bestFinish,
    newRecord: isRecord,
  });
  Sdk.levelCleared({ rank, time, station });
  Sdk.track('finish', { rank, time, station });
  audio.event('finish', {});
  audio.event('newRecord', {});
  audio.stopBgm();
}

async function shareResult() {
  const rank = run?.player?.rank ?? 1;
  await Sdk.share({
    title: 'CAKE KART',
    text: i18n.lang === 'zh' ? `我在蛋糕飞车拿了第 ${rank} 名！` : `I finished ${rank}${rank === 1 ? 'st' : rank === 2 ? 'nd' : rank === 3 ? 'rd' : 'th'} in CAKE KART!`,
  });
  Sdk.track('share', { rank });
}

// ---------- 事件分发 ----------
function dispatchEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    if (state === 'playing') ui.tutorial.onGameEvent(ev);
    if (ev.type === 'lap') Sdk.track('lap', { lap: ev.lap });
    else if (ev.type === 'boost') Sdk.track('boost', {});
  }
}

// ---------- 主循环 ----------
function loop(now) {
  requestAnimationFrame(loop);

  if (state !== 'playing') {
    renderer.draw(state === 'paused' || state === 'finished' ? run : null, 1);
    return;
  }

  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  accumulator += dt;

  let steps = 0;
  while (accumulator >= STEP && steps < 6) {
    run.step({
      steer: steerValue(),
      throttle: keys.up ? 1 : 0,
      drift: keys.drift,
      item: keys.item,
    });
    accumulator -= STEP;
    steps += 1;
    dispatchEvents(run.drainEvents());
    if (run.phase === 'finished') { onFinish(); return; }
  }

  const hud = run.getHud();
  // 引擎声随速度变化
  if (Math.random() < 0.3) audio.event('engine', { rpm: hud.speed / 150 });
  renderer.draw(run, accumulator / STEP);
  ui.setHud(hud);
}

// ---------- 失焦自动暂停 ----------
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'playing') togglePause();
});

// ---------- 会话结束埋点 ----------
window.addEventListener('beforeunload', () => {
  Sdk.track('session_end', {});
});

Sdk.onAdStart(() => audio.setMuted(true));
Sdk.onAdEnd(() => { audio.setMuted(!!Sdk.load('muted', false)); });

// ---------- 启动（boot 竞态守卫）----------
(async () => {
  bestFinish = Math.floor(Sdk.load('bestFinish', 0)) || 0;
  ui.setBest(bestFinish);
  ui.setStation(station);
  applyAudioSettings();
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
  debug: { layout: () => ({ viewport: [canvas.clientWidth, canvas.clientHeight], touch: !!document.getElementById('btn-drift') }) },
};
