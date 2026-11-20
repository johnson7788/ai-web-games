// src/main.js — 装配：固定步长 / 输入 / 事件分发 / 状态机 / SDK / BGM。
import { STEP, WORLD } from '../config/game.config.js';
import { createRun } from './game/sim.js';
import { createRender } from './render/index.js';
import { createUI } from './ui/index.js';
import { createAudio } from './core/audio.js';
import { i18n } from './core/i18n.js';
import Sdk from './core/sdk.js';
import { MAGAZINE } from '../config/gameplay.js';
import { levelAt } from '../config/levels.js';

// ---------- 装配 ----------
const canvas = document.getElementById('canvas');
const uiRoot = document.getElementById('ui-root');
const btnReload = document.getElementById('btn-reload');
const loadingEl = document.getElementById('loading');

const renderer = createRender(canvas);
const audio = createAudio();

// ---------- 状态 ----------
let state = 'boot';             // boot | title | playing | paused | dead | won
let run = null;
let lastTime = 0;
let accumulator = 0;
let aimX = WORLD.WIDTH / 2;
let aimY = WORLD.HEIGHT / 2;
let bestScore = 0;
let bestLevel = 1;
let reloadQueued = false;
let wheelTimer = null;

const shotQueue = [];

// ---------- 坐标转换（canvas → 世界 1280×720） ----------
function canvasToWorld(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(rect.width / WORLD.WIDTH, rect.height / WORLD.HEIGHT);
  const ox = (rect.width - WORLD.WIDTH * scale) / 2;
  const oy = (rect.height - WORLD.HEIGHT * scale) / 2;
  return {
    x: (clientX - rect.left - ox) / scale,
    y: (clientY - rect.top - oy) / scale,
  };
}

// ---------- 键盘 ----------
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'Enter' && state === 'title') startGame();
  if (e.code === 'KeyR') {
    if (state === 'playing') reloadQueued = true;
    else if (state === 'dead' || state === 'won') startGame();
  }
});
window.addEventListener('keyup', () => {});

// ---------- 指针：瞄准 / 射击 ----------
canvas.addEventListener('pointermove', (e) => {
  const w = canvasToWorld(e.clientX, e.clientY);
  aimX = w.x;
  aimY = w.y;
  if (state === 'playing') ui.tutorial.onGameEvent({ type: 'aim' }, performance.now());
});
canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  const w = canvasToWorld(e.clientX, e.clientY);
  aimX = w.x;
  aimY = w.y;
  if (state === 'playing') shotQueue.push(w);
});
canvas.addEventListener('pointerleave', () => {});

// 触屏换弹按钮（非精确指针设备显示）
if (window.matchMedia && matchMedia('(pointer: coarse)').matches) btnReload.hidden = false;
btnReload.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  audio.unlock();
  if (state === 'playing') reloadQueued = true;
});

// ---------- UI ----------
const ui = createUI(uiRoot, {
  onStart: () => startGame(),
  onResume: () => resumeGame(),
  onRestart: () => startGame(),
  onShare: () => shareResult(),
  onHow: () => { /* 重看引导 */ },
});
ui.onTutorial((result) => {
  Sdk.track('tutorial_done', { skipped: !!result?.skipped });
});
ui.setBest(bestScore, bestLevel);

// ---------- 音频设置持久化 ----------
function applyAudioSettings() {
  const muted = Sdk.load('muted', false);
  const vol = Sdk.load('volume', 0.7);
  audio.setMuted(!!muted);
  audio.setVolume(vol);
}

// ---------- 游戏流转 ----------
function startGame() {
  audio.unlock();
  run = createRun({ seed: (Date.now() & 0xffff) * 2654435761 >>> 0 });
  state = 'playing';
  aimX = WORLD.WIDTH / 2;
  aimY = WORLD.HEIGHT / 2;
  shotQueue.length = 0;
  reloadQueued = false;
  accumulator = 0;
  lastTime = performance.now();
  ui.show('playing');
  Sdk.newRun({ level: run.level });
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
  renderer.draw(null, 1, performance.now());
  audio.stopBgm();
}

function onRunEnd(win) {
  const stats = run.stats || {};
  const score = Math.floor(run.score ?? 0);
  const level = Math.max(1, Math.floor(stats.levelReached ?? run.level ?? 1));
  const isRecord = score > bestScore;
  if (isRecord) {
    bestScore = score;
    Sdk.save('bestScore', bestScore);
  }
  if (level > bestLevel) {
    bestLevel = level;
    Sdk.save('bestLevel', bestLevel);
  }
  ui.setBest(bestScore, bestLevel);
  const need = win ? 0 : Math.max(0, levelAt(run.level).targetScore - (run.levelScore ?? 0));

  state = win ? 'won' : 'dead';
  ui.show(win ? 'won' : 'dead', {
    score,
    maxCombo: stats.maxCombo || 0,
    levelReached: level,
    best: bestScore,
    newRecord: isRecord,
    win,
    need,
  });
  if (win) Sdk.levelCleared({ score, level });
  else Sdk.gameOver({ score, level });
  audio.stopBgm();
}

// ---------- BGM / 分享 ----------
async function shareResult() {
  const score = Math.floor(run?.score ?? 0);
  await Sdk.share({
    title: 'CARNIVAL SHOT',
    text: `${i18n.lang === 'zh' ? `我在夜市灯笼庙会得了 ${score} 分！` : `I scored ${score} at the lantern fair!`} CARNIVAL SHOT`,
  });
  Sdk.track('share', { score });
}

// ---------- 事件分发 ----------
function dispatchEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);

    if (ev.type === 'hit' || ev.type === 'goldenHit') {
      renderer.burst(ev.x, ev.y, ev.type === 'goldenHit' ? 'gold' : 'hit');
    } else if (ev.type === 'ghostHit') {
      renderer.burst(ev.x, ev.y, 'ghost');
    } else if (ev.type === 'shot') {
      renderer.burst(ev.x, ev.y, 'muzzle');
    } else if (ev.type === 'lanternRain') {
      renderer.lanternRain();
    } else if (ev.type === 'reward') {
      ui.showWheel(ev.kind);
      if (wheelTimer) clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => ui.hideWheel(), 1400);
    }

    if (state === 'playing') ui.tutorial.onGameEvent(ev, performance.now());

    if (ev.type === 'hit' || ev.type === 'goldenHit') Sdk.track('hit', { kind: ev.kind });
    else if (ev.type === 'lanternRain') Sdk.track('lanternRain', {});
  }
}

// ---------- 主循环 ----------
function loop(now) {
  requestAnimationFrame(loop);

  if (state !== 'playing') {
    renderer.draw(state === 'paused' || state === 'dead' || state === 'won' ? run : null, 1, now);
    return;
  }

  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  accumulator += dt;

  let steps = 0;
  while (accumulator >= STEP && steps < 6) {
    const shoot = shotQueue.length ? shotQueue.shift() : null;
    run.step({ shoot, reload: reloadQueued });
    reloadQueued = false;
    accumulator -= STEP;
    steps++;
    dispatchEvents(run.drainEvents());
    if (run.phase === 'dead') { onRunEnd(false); return; }
    if (run.phase === 'won') { onRunEnd(true); return; }
  }

  renderer.setAim(aimX, aimY);
  renderer.draw(run, accumulator / STEP, now);
  ui.setHud(run.getHud());
  ui.tutorial.tick(performance.now());
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
  bestScore = Math.floor(Sdk.load('bestScore', 0)) || 0;
  bestLevel = Math.floor(Sdk.load('bestLevel', 1)) || 1;
  ui.setBest(bestScore, bestLevel);
  applyAudioSettings();
  await Sdk.ready();
  Sdk.track('load', { lang: i18n.lang });
  // boot 竞态守卫：玩家可能在 boot 期间已点 Play（异步 SDK 加载窗口）
  if (state === 'boot') { state = 'title'; ui.show('title'); }
  renderer.draw(null, 1, performance.now());
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
  debug: { layout: () => ({ viewport: [canvas.clientWidth, canvas.clientHeight], reload: !btnReload.hidden, magSize: MAGAZINE.SIZE }) },
};
