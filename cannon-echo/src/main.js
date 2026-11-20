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
const loadingEl = document.getElementById('loading');

const renderer = createRender(canvas);
const audio = createAudio({
  save: (k, v) => Sdk.save(k, v),
  load: (k, d) => Sdk.load(k, d),
});

// ---------- 状态 ----------
let state = 'boot';             // boot | title | playing | paused | dead | won
let run = null;
let lastTime = 0;
let accumulator = 0;
let aimX = WORLD.CANNON_X;
let aimY = 0;
let firing = false;
let aimMoved = false;
let bestScore = 0;
let lastScreen = null;
let bgmScene = -1;

// ---------- 输入 ----------
function clientToWorld(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return { x: WORLD.CANNON_X, y: 0 };
  return {
    x: (clientX - rect.left) * (WORLD.WIDTH / rect.width),
    y: (clientY - rect.top) * (WORLD.HEIGHT / rect.height),
  };
}

canvas.addEventListener('pointermove', (e) => {
  const w = clientToWorld(e.clientX, e.clientY);
  aimX = w.x;
  aimY = Math.min(w.y, WORLD.CANNON_Y - 10);
  if (state === 'playing') aimMoved = true;
});
canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  const w = clientToWorld(e.clientX, e.clientY);
  aimX = w.x;
  aimY = Math.min(w.y, WORLD.CANNON_Y - 10);
  firing = true;
  if (state === 'playing') aimMoved = true;
});
window.addEventListener('pointerup', () => { firing = false; });
window.addEventListener('pointercancel', () => { firing = false; });

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    if (state === 'playing') { firing = true; e.preventDefault(); }
  }
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if ((e.code === 'KeyR') && (state === 'dead' || state === 'won')) startGame();
  if (e.code === 'Enter' && state === 'title') startGame();
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'Space') firing = false;
});

// ---------- UI ----------
const ui = createUI(uiRoot, {
  onStart: () => startGame(),
  onResume: () => resumeGame(),
  onRestart: () => startGame(),
  onShare: () => shareResult(),
  onHow: () => { /* 标题屏重看引导 */ },
  onUpgrade: (idx) => {
    if (run && run.phase === 'upgrade') {
      const id = run.upgradeChoices[idx];
      run.chooseUpgrade(id);
      lastScreen = null;
    }
  },
});
ui.onTutorial((result) => {
  Sdk.track('tutorial_done', { skipped: !!result?.skipped });
});
ui.setBest(bestScore);

// ---------- 音频设置持久化 ----------
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
  lastScreen = null;
  aimX = WORLD.CANNON_X;
  aimY = 0;
  firing = false;
  accumulator = 0;
  lastTime = performance.now();
  ui.show('playing');
  Sdk.newRun({ zone: 1 });
  applyAudioSettings();
}

function togglePause() {
  if (state === 'playing') { state = 'paused'; ui.show('paused'); }
  else if (state === 'paused') { resumeGame(); }
}
function resumeGame() {
  if (state === 'paused') { state = 'playing'; lastScreen = null; ui.show('playing'); lastTime = performance.now(); }
}

function toTitle() {
  state = 'title';
  run = null;
  lastScreen = null;
  ui.show('title');
  renderer.draw(null, 1);
  setBgm(-1);
}

function onDeath() {
  state = 'dead';
  const score = Math.floor(run.stats.score);
  const isRecord = score > bestScore;
  if (isRecord) {
    bestScore = score;
    Sdk.save('bestScore', bestScore);
  }
  ui.setBest(bestScore);
  ui.show('dead', { score, wave: run.wave, best: bestScore, won: false, newRecord: isRecord });
  Sdk.gameOver({ score, wave: run.wave });
  setBgm(-1);
}

function onWin() {
  state = 'won';
  const score = Math.floor(run.stats.score);
  const isRecord = score > bestScore;
  if (isRecord) {
    bestScore = score;
    Sdk.save('bestScore', bestScore);
  }
  ui.setBest(bestScore);
  ui.show('won', { score, wave: run.wave, best: bestScore, won: true, newRecord: isRecord });
  Sdk.levelCleared({ score, wave: run.wave });
  setBgm(-1);
}

async function shareResult() {
  const score = Math.floor(run?.stats?.score ?? 0);
  await Sdk.share({
    title: 'CANNON ECHO',
    text: `${i18n.lang === 'zh' ? `我在回声山谷拿到了 ${score} 分！` : `I scored ${score} in the echo canyon!`} CANNON ECHO`,
  });
  Sdk.track('share', { score });
}

// ---------- BGM ----------
function setBgm(scene) {
  if (scene === bgmScene) return;
  bgmScene = scene;
  audio.stopBgm();
  if (scene === 0) audio.playBgm('bgmMorning');
  else if (scene === 1) audio.playBgm('bgmSnow');
  else if (scene === 2) audio.playBgm('bgmLava');
}

// ---------- 事件分发 ----------
function dispatchEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);

    if (ev.type === 'shot') renderer.burst(ev.x, ev.y, 'shot');
    else if (ev.type === 'hit') renderer.burst(ev.x, ev.y, 'hit');
    else if (ev.type === 'break') renderer.burst(ev.x, ev.y, 'break');
    else if (ev.type === 'echoBounce') renderer.burst(ev.x, ev.y, 'echo');
    else if (ev.type === 'echoRoar') renderer.burst(ev.x, ev.y, 'break');

    if (state === 'playing') ui.tutorial.onGameEvent(ev, performance.now());

    if (ev.type === 'break') Sdk.track('break', { targetType: ev.targetType, echo: !!ev.echo });
    else if (ev.type === 'waveEnter') Sdk.track('waveEnter', { wave: ev.wave });
    else if (ev.type === 'echoBounce') Sdk.track('echoBounce', {});
  }
}

// ---------- 屏幕同步（playing 内的 upgrade 切换） ----------
function syncScreen() {
  if (state !== 'playing') return;
  const want = run && run.phase === 'upgrade' ? 'upgrade' : 'playing';
  if (lastScreen !== want) {
    lastScreen = want;
    if (want === 'upgrade') ui.show('upgrade', { choices: run.upgradeChoices });
    else ui.show('playing');
  }
}

// ---------- 主循环 ----------
function loop(now) {
  requestAnimationFrame(loop);

  if (state !== 'playing') {
    renderer.draw(state === 'paused' || state === 'dead' || state === 'won' ? run : null, 1);
    return;
  }

  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  accumulator += dt;

  let steps = 0;
  while (accumulator >= STEP && steps < 6) {
    run.step({ aimX, aimY, fire: firing });
    accumulator -= STEP;
    steps++;
    if (aimMoved) {
      ui.tutorial.onGameEvent({ type: 'aim' }, performance.now());
      aimMoved = false;
    }
    dispatchEvents(run.drainEvents());
    if (run.phase === 'dead') { onDeath(); return; }
    if (run.phase === 'won') { onWin(); return; }
  }

  syncScreen();
  const hud = run.getHud();
  setBgm(hud.scene);
  renderer.draw(run, accumulator / STEP);
  ui.setHud(hud);
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
  ui.setBest(bestScore);
  applyAudioSettings();
  await Sdk.ready();
  Sdk.track('load', { lang: i18n.lang });
  // boot 竞态守卫：异步 SDK 加载窗口内玩家可能已点 Start；只在还没开局时才显示标题
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
  debug: { layout: () => ({ viewport: [canvas.clientWidth, canvas.clientHeight], cannon: [WORLD.CANNON_X, WORLD.CANNON_Y] }) },
};
