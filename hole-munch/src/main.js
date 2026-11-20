// src/main.js — 装配：固定步长 / 输入 / 事件分发 / 状态机 / SDK / BGM（Lead 所有）
import { STEP, WORLD, CONFIG } from '../config/game.config.js';
import { UPGRADES, MATCH } from '../config/gameplay.js';
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

// ---------- 状态 ----------
let state = 'boot';             // boot | title | playing | paused | result
let run = null;
let lastTime = 0;
let accumulator = 0;
let bestRank = 6;
let steerMoved = false;

// ---------- 输入 ----------
const keys = new Set();
let pointerTarget = null;       // 鼠标：绝对目标点
let touchOrigin = null;         // 触屏摇杆：起点
let touchDelta = { dx: 0, dy: 0 };
let touchActive = false;
const KB_TARGET = { x: WORLD.WIDTH / 2, y: WORLD.HEIGHT / 2 };
const KB_SPEED = 640;           // 键盘虚拟目标移动速度 px/s

function canvasToWorld(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(rect.width / WORLD.WIDTH, rect.height / WORLD.HEIGHT);
  const ox = (rect.width - WORLD.WIDTH * scale) / 2;
  const oy = (rect.height - WORLD.HEIGHT * scale) / 2;
  return { x: (clientX - rect.left - ox) / scale, y: (clientY - rect.top - oy) / scale };
}

function clampW(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function computeSteer() {
  if (!run || run.phase !== 'playing') return {};
  // 键盘优先
  let kx = 0;
  let ky = 0;
  if (keys.has('ArrowLeft') || keys.has('KeyA')) kx -= 1;
  if (keys.has('ArrowRight') || keys.has('KeyD')) kx += 1;
  if (keys.has('ArrowUp') || keys.has('KeyW')) ky -= 1;
  if (keys.has('ArrowDown') || keys.has('KeyS')) ky += 1;
  if (kx !== 0 || ky !== 0) {
    const d = Math.hypot(kx, ky) || 1;
    KB_TARGET.x = clampW(KB_TARGET.x + (kx / d) * KB_SPEED * STEP, 40, WORLD.WIDTH - 40);
    KB_TARGET.y = clampW(KB_TARGET.y + (ky / d) * KB_SPEED * STEP, 40, WORLD.HEIGHT - 40);
    return { steerX: KB_TARGET.x, steerY: KB_TARGET.y };
  }
  if (touchActive) {
    return {
      steerX: clampW(run.player.x + touchDelta.dx * 2.6, 40, WORLD.WIDTH - 40),
      steerY: clampW(run.player.y + touchDelta.dy * 2.6, 40, WORLD.HEIGHT - 40),
    };
  }
  if (pointerTarget) return { steerX: pointerTarget.x, steerY: pointerTarget.y };
  return {};
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') { togglePause(); return; }
  if (e.code === 'KeyR' && (state === 'result')) { startGame(); return; }
  if (e.code === 'Enter' && state === 'title') { startGame(); return; }
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) {
    keys.add(e.code);
    steerMoved = true;
    e.preventDefault();
  }
});
window.addEventListener('keyup', (e) => {
  keys.delete(e.code);
});

// 鼠标指针跟随
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'touch') {
    if (touchActive && touchOrigin) {
      const p = canvasToWorld(e.clientX, e.clientY);
      touchDelta = { dx: p.x - touchOrigin.x, dy: p.y - touchOrigin.y };
      steerMoved = true;
    }
    return;
  }
  const p = canvasToWorld(e.clientX, e.clientY);
  pointerTarget = p;
  if (state === 'playing' && (keys.size === 0)) steerMoved = true;
});
canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (e.pointerType === 'touch') {
    touchOrigin = canvasToWorld(e.clientX, e.clientY);
    touchDelta = { dx: 0, dy: 0 };
    touchActive = true;
    steerMoved = true;
    e.preventDefault();
  } else {
    pointerTarget = canvasToWorld(e.clientX, e.clientY);
  }
});
canvas.addEventListener('pointerup', (e) => {
  if (e.pointerType === 'touch') { touchActive = false; touchOrigin = null; }
});
canvas.addEventListener('pointercancel', (e) => {
  if (e.pointerType === 'touch') { touchActive = false; touchOrigin = null; }
});
canvas.addEventListener('pointerleave', () => { pointerTarget = null; });

// ---------- UI ----------
const ui = createUI(uiRoot, {
  onStart: () => startGame(),
  onResume: () => resumeGame(),
  onRestart: () => startGame(),
  onRetry: () => retryMatch(),
  onUpgrade: (id) => upgradeAndAdvance(id),
  onShare: () => shareResult(),
  onHow: () => { /* 重看引导 */ },
  onToggleMute: () => { audio.setMuted(!audio.muted); ui.setMute(audio.muted); },
  onVolume: (v) => audio.setVolume(v),
});
ui.onTutorial((result) => {
  Sdk.track('tutorial_done', { skipped: !!result?.skipped });
});
ui.setBest(bestRank);

// ---------- 音频设置持久化 ----------
function applyAudioSettings() {
  const muted = Sdk.load('muted', false);
  const vol = Sdk.load('volume', 0.7);
  audio.setMuted(!!muted);
  audio.setVolume(vol);
  ui.setMute(!!muted);
  if (ui.els.volSlider) ui.els.volSlider.value = String(Math.round(vol * 100));
}

// ---------- 游戏流转 ----------
function startGame(seed) {
  audio.unlock();
  run = createRun({ seed: seed == null ? ((Date.now() & 0xffff) * 2654435761 >>> 0) : (seed >>> 0), startLevel: 1 });
  state = 'playing';
  pointerTarget = null;
  touchActive = false;
  touchOrigin = null;
  KB_TARGET.x = WORLD.WIDTH / 2;
  KB_TARGET.y = WORLD.HEIGHT / 2;
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
}

function retryMatch() {
  if (!run) return;
  run.retry();
  state = 'playing';
  accumulator = 0;
  lastTime = performance.now();
  ui.show('playing');
  Sdk.newRun({ zone: run.level });
}

function upgradeAndAdvance(id) {
  if (!run) return;
  run.advance(id);
  if (run.phase === 'playing') {
    state = 'playing';
    accumulator = 0;
    lastTime = performance.now();
    ui.show('playing');
    Sdk.newRun({ zone: run.level });
  } else if (run.phase === 'campaignComplete') {
    onCampaignComplete();
  }
}

function onMatchEnd() {
  state = 'result';
  const res = run.result || {};
  const qualified = !!res.qualified;
  const campaign = qualified && run.level >= MATCH.TOTAL_MATCHES;
  const rank = res.rank;
  const newBest = rank < bestRank;
  if (newBest) {
    bestRank = rank;
    Sdk.save('bestRank', bestRank);
  }
  ui.setBest(bestRank);
  ui.show('result', {
    rank,
    score: res.score,
    bestRank,
    qualified,
    campaign,
    newBest,
    level: run.level,
    upgrades: pickUpgrades(run.level),
  });
  if (qualified) Sdk.levelCleared({ level: run.level, rank });
  else Sdk.gameOver({ level: run.level, rank });
  audio.event('matchEnd', {});
  audio.stopBgm();
}

function onCampaignComplete() {
  state = 'result';
  const res = run.result || {};
  ui.show('result', {
    rank: res.rank,
    score: res.score,
    bestRank,
    qualified: true,
    campaign: true,
    newBest: false,
    level: run.level,
    upgrades: [],
  });
  Sdk.levelCleared({ level: run.level, rank: res.rank, campaign: true });
  audio.event('newRecord', {});
  audio.stopBgm();
}

function pickUpgrades(level) {
  const n = UPGRADES.length;
  const a = UPGRADES[(level - 1) % n];
  const b = UPGRADES[level % n];
  const c = UPGRADES[(level + 1) % n];
  return [a, b, c];
}

async function shareResult() {
  const rank = run?.result?.rank ?? 6;
  await Sdk.share({
    title: 'HOLE MUNCH',
    text: i18n.lang === 'zh' ? `我在午夜城市吞到了第 ${rank} 名！` : `I devoured my way to rank #${rank} in the midnight city!`,
  });
  Sdk.track('share', { rank });
}

// ---------- 事件分发 ----------
function dispatchEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);

    // 视觉粒子
    if (ev.type === 'swallow' || ev.type === 'meteorGain') renderer.burst(ev.x, ev.y, 'swallow');
    else if (ev.type === 'building') renderer.burst(ev.x, ev.y, 'building');
    else if (ev.type === 'kill') renderer.burst(ev.x, ev.y, 'kill');
    else if (ev.type === 'death') renderer.burst(ev.x, ev.y, 'death');

    // 教程
    if (state === 'playing') ui.tutorial.onGameEvent(ev);

    // 关键埋点（失败不影响玩法）
    if (ev.type === 'building') Sdk.track('building', { kind: ev.kind });
    else if (ev.type === 'chain') Sdk.track('chain', {});
    else if (ev.type === 'meteorRain') Sdk.track('meteorRain', {});
    else if (ev.type === 'kill') Sdk.track('kill', {});
    else if (ev.type === 'death') Sdk.track('death', {});
  }
}

// ---------- 主循环 ----------
function loop(now) {
  requestAnimationFrame(loop);

  if (state !== 'playing') {
    renderer.draw(state === 'paused' || state === 'result' ? run : null, 1);
    return;
  }

  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  accumulator += dt;

  let steps = 0;
  while (accumulator >= STEP && steps < 6) {
    const input = computeSteer();
    run.step(input);
    accumulator -= STEP;
    steps++;
    if (steerMoved) {
      ui.tutorial.onGameEvent({ type: 'steer' });
      steerMoved = false;
    }
    dispatchEvents(run.drainEvents());
    if (run.phase === 'matchEnd') { onMatchEnd(); return; }
    if (run.phase === 'campaignComplete') { onCampaignComplete(); return; }
  }

  renderer.draw(run, accumulator / STEP);
  ui.setHud(run.getHud());
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
  bestRank = Number(Sdk.load('bestRank', 6)) || 6;
  ui.setBest(bestRank);
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
  debug: {
    layout: () => ({ viewport: [canvas.clientWidth, canvas.clientHeight], joystick: touchActive }),
    setTutorialDone: () => ui.tutorial.skip(),
    startSeeded: (seed) => startGame(seed),
    steerWorld: (x, y) => { pointerTarget = { x: clampW(x, 40, WORLD.WIDTH - 40), y: clampW(y, 40, WORLD.HEIGHT - 40) }; },
  },
};
