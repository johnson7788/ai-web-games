// src/main.js — 装配：固定步长 / 输入 / 事件分发 / 状态机 / SDK / BGM（Lead 所有）
import { STEP, WORLD } from '../config/game.config.js';
import { createRun } from './game/sim.js';
import { createRender } from './render/index.js';
import { createUI } from './ui/index.js';
import { createAudio } from './core/audio.js';
import { i18n } from './core/i18n.js';
import Sdk from './core/sdk.js';

// ---------- 装配 ----------
const canvas = document.getElementById('canvas');
const uiRoot = document.getElementById('ui-root');
const btnStop = document.getElementById('btn-stop');
const loadingEl = document.getElementById('loading');

const renderer = createRender(canvas);
const audio = createAudio();

// ---------- 状态 ----------
let state = 'boot';             // boot | title | playing | paused | dead | revive
let run = null;
let lastTime = 0;
let accumulator = 0;
let stopHeld = false;
let inputDir = 0;               // -1 | 0 | +1（边沿触发，每步消费一次）
let bestDistance = 0;

// ---------- 输入（边沿检测归 main） ----------
const keys = { left: false, right: false };

window.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') { inputDir = -1; audio.unlock(); }
  if (e.code === 'ArrowRight' || e.code === 'KeyD') { inputDir = 1; audio.unlock(); }
  if (e.code === 'Space') { stopHeld = true; audio.unlock(); e.preventDefault(); }
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'KeyR' && (state === 'dead' || state === 'revive')) startGame();
  if (e.code === 'Enter' && state === 'title') startGame();
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
  if (e.code === 'Space') stopHeld = false;
});

function canvasWorldX(clientX) {
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(rect.width / WORLD.WIDTH, rect.height / WORLD.HEIGHT);
  const ox = (rect.width - WORLD.WIDTH * scale) / 2;
  return (clientX - rect.left - ox) / scale;
}

// 触屏/鼠标：点左半边向左换道，右半边向右换道
canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (state !== 'playing') return;
  const wx = canvasWorldX(e.clientX);
  inputDir = wx < WORLD.WIDTH / 2 ? -1 : 1;
});

// 触屏 STOP 按钮（粗指针设备显示）
if (window.matchMedia && matchMedia('(pointer: coarse)').matches) btnStop.hidden = false;
btnStop.addEventListener('pointerdown', (e) => { e.preventDefault(); audio.unlock(); stopHeld = true; });
btnStop.addEventListener('pointerup', () => { stopHeld = false; });
btnStop.addEventListener('pointercancel', () => { stopHeld = false; });
btnStop.addEventListener('pointerleave', () => { stopHeld = false; });

// ---------- UI ----------
const ui = createUI(uiRoot, {
  onDive: () => startGame(),
  onResume: () => resumeGame(),
  onRestart: () => startGame(),
  onShare: () => shareResult(),
  onRevive: () => doRevive(),
  onGiveup: () => showResult(),
  onHow: () => { /* 标题重看引导：仅展示覆盖层 */ },
});
ui.onTutorial((result) => {
  Sdk.track('tutorial_done', { skipped: !!result?.skipped });
});
ui.setBest(bestDistance);

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
  state = 'playing';
  stopHeld = false;
  inputDir = 0;
  accumulator = 0;
  lastTime = performance.now();
  ui.show('playing');
  Sdk.newRun({ zone: 1 });
  audio.playBgm();
  applyAudioSettings();
}

function togglePause() {
  if (state === 'playing') { state = 'paused'; ui.show('paused'); audio.setMuted(Sdk.load('muted', false)); }
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

function doRevive() {
  if (!run || !run.reviveAvailable()) { showResult(); return; }
  run.revive();
  state = 'playing';
  stopHeld = false;
  inputDir = 0;
  lastTime = performance.now();
  ui.show('playing');
  Sdk.track('revive');
}

function showResult() {
  state = 'dead';
  const stats = run?.stats || {};
  const distance = Math.floor(stats.distance ?? 0);
  const gems = Math.floor(stats.gems ?? 0);
  const station = Math.max(1, Math.floor(stats.stationReached ?? 1));
  const isRecord = distance > bestDistance;
  if (isRecord) {
    bestDistance = distance;
    Sdk.save('bestDistance', bestDistance);
  }
  ui.setBest(bestDistance);
  ui.show('dead', {
    distance,
    gems,
    station,
    stationName: run ? run.getHud().stationName : 'depot',
    best: bestDistance,
    newRecord: isRecord,
  });
  Sdk.gameOver({ distance, gems, station });
  Sdk.track('session_end', { distance, gems, station });
  audio.stopBgm();
}

async function shareResult() {
  const distance = Math.floor(run?.stats?.distance ?? 0);
  await Sdk.share({
    title: 'GOOSE LANE',
    text: `${i18n.lang === 'zh' ? `我通勤了 ${distance}m！` : `I commuted ${distance}m!`} GOOSE LANE`,
  });
  Sdk.track('share', { distance });
}

// ---------- 事件分发 ----------
function dispatchEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);

    if (ev.type === 'gem') renderer.burst(WORLD.LANE_X[ev.lane] ?? 640, WORLD.PLAYER_Y - 10, '#35d0c9', 8, 160);
    else if (ev.type === 'balloonGain') renderer.burst(WORLD.LANE_X[ev.lane] ?? 640, WORLD.PLAYER_Y - 10, '#ff6b9d', 8, 150);
    else if (ev.type === 'balloonSave') renderer.burst(run.laneX, WORLD.PLAYER_Y, '#ffd23f', 14, 220);
    else if (ev.type === 'balloonPop') renderer.burst(run.laneX, WORLD.PLAYER_Y - 40, '#ffffff', 6, 120);
    else if (ev.type === 'smoothTransfer') renderer.dove(run.laneX - 20, WORLD.PLAYER_Y - 60);
    else if (ev.type === 'hit') renderer.burst(run.laneX, WORLD.PLAYER_Y, '#ff5d73', 16, 260);
    else if (ev.type === 'death') renderer.burst(run.laneX, WORLD.PLAYER_Y, '#ff5d73', 20, 300);
    else if (ev.type === 'gateOpen') renderer.burst(WORLD.WIDTH / 2, WORLD.PLAYER_Y - 40, '#37c96a', 10, 160);

    if (state === 'playing') ui.tutorial.onGameEvent(ev);

    // 关键埋点（失败不影响玩法）
    if (ev.type === 'gem') Sdk.track('gem', { gems: ev.gems });
    else if (ev.type === 'balloonGain') Sdk.track('balloonGain', { balloons: ev.balloons });
    else if (ev.type === 'stationEnter') {
      Sdk.track('stationEnter', { station: ev.station });
      if (ev.station >= 12) { Sdk.levelCleared({ levelIndex: 12 }); }
    } else if (ev.type === 'smoothTransfer') Sdk.track('smoothTransfer', { total: ev.total });
    else if (ev.type === 'gateOpen') Sdk.track('gateOpen', {});
  }
}

// ---------- 主循环 ----------
function loop(now) {
  requestAnimationFrame(loop);

  if (state !== 'playing') {
    renderer.draw(state === 'paused' || state === 'dead' || state === 'revive' ? run : null, 1);
    return;
  }

  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  accumulator += dt;

  let steps = 0;
  while (accumulator >= STEP && steps < 6) {
    run.step({ dir: inputDir, stop: stopHeld });
    inputDir = 0;
    accumulator -= STEP;
    steps++;
    dispatchEvents(run.drainEvents());
    if (run.phase === 'dead') {
      if (run.reviveAvailable()) { state = 'revive'; ui.show('revive'); }
      else showResult();
      return;
    }
  }

  renderer.draw(run, accumulator / STEP);
  ui.setHud(run.getHud());
  ui.tutorial.tick();
}

// ---------- 失焦自动暂停 ----------
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'playing') togglePause();
});

// ---------- 广告期间静音 ----------
Sdk.onAdStart(() => audio.setMuted(true));
Sdk.onAdEnd(() => { audio.setMuted(!!Sdk.load('muted', false)); });

// ---------- 启动 ----------
(async () => {
  bestDistance = Math.floor(Sdk.load('bestDistance', 0)) || 0;
  ui.setBest(bestDistance);
  applyAudioSettings();
  await Sdk.ready();
  Sdk.track('load', { lang: i18n.lang });
  // boot 竞态守卫：只在本就还在 boot 时才显示标题，否则会顶掉玩家在 boot 期点的 Start
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
  debug: { layout: () => ({ viewport: [canvas.clientWidth, canvas.clientHeight], stop: !btnStop.hidden }) },
};
