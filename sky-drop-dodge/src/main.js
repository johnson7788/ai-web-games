// src/main.js — 装配：固定步长 / 输入 / 事件分发 / 状态机 / SDK / BGM（Lead 所有）
import { STEP, WORLD } from '../config/game.config.js';
import { gradeFor } from '../config/gameplay.js';
import { createRun } from './game/sim.js';
import { createRender } from './render/index.js';
import { createUI } from './ui/index.js';
import { createAudio } from './core/audio.js';
import { i18n } from './core/i18n.js';
import Sdk from './core/sdk.js';

const canvas = document.getElementById('canvas');
const uiRoot = document.getElementById('ui-root');
const btnBlock = document.getElementById('btn-block');
const loadingEl = document.getElementById('loading');

const renderer = createRender(canvas);
const audio = createAudio();

let state = 'boot';             // boot | title | playing | paused | dead
let run = null;
let lastTime = 0;
let accumulator = 0;
let steerX = null;
let blockHeld = false;
let bestWave = 0;
let bestGrade = 'D';
let steerMoved = false;
let prevPlayerX = null;

// ---------- 输入（边沿检测归 main） ----------
const keys = { left: false, right: false, block: false };
let keyVelX = 0;
let pointerX = null;

function canvasToWorldX(clientX) {
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(rect.width / WORLD.WIDTH, rect.height / WORLD.HEIGHT);
  const ox = (rect.width - WORLD.WIDTH * scale) / 2;
  return (clientX - rect.left - ox) / scale;
}

function updateSteerFromInputs() {
  if (keys.left || keys.right) {
    keyVelX += (keys.right ? 1 : 0) * 14 - (keys.left ? 1 : 0) * 14;
    keyVelX = Math.max(-26, Math.min(26, keyVelX));
    if (steerX == null) steerX = WORLD.WIDTH / 2;
    steerX = Math.max(0, Math.min(WORLD.WIDTH, steerX + keyVelX));
    if (Math.abs(keyVelX) > 2) steerMoved = true;
  } else {
    keyVelX = 0;
    if (pointerX != null) steerX = pointerX;
  }
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;
  if (e.code === 'Space') { keys.block = true; e.preventDefault(); }
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'KeyR' && state === 'dead') startGame();
  if (e.code === 'Enter' && state === 'title') startGame();
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
  if (e.code === 'Space') keys.block = false;
});

// 指针：桌面 hover / 拖动都转向
canvas.addEventListener('pointermove', (e) => {
  pointerX = canvasToWorldX(e.clientX);
  if (pointerX != null && state === 'playing') steerMoved = true;
});
canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  pointerX = canvasToWorldX(e.clientX);
});
canvas.addEventListener('pointerleave', () => { pointerX = null; });

// 触屏举伞按钮（非精确指针设备显示）
if (window.matchMedia && matchMedia('(pointer: coarse)').matches) btnBlock.hidden = false;
btnBlock.addEventListener('pointerdown', (e) => { e.preventDefault(); audio.unlock(); blockHeld = true; });
btnBlock.addEventListener('pointerup', () => { blockHeld = false; });
btnBlock.addEventListener('pointercancel', () => { blockHeld = false; });

// ---------- UI ----------
const ui = createUI(uiRoot, {
  onDive: () => startGame(),
  onResume: () => resumeGame(),
  onRestart: () => startGame(),
  onShare: () => shareResult(),
  onHow: () => {},
});
ui.onTutorial((result) => {
  Sdk.track('tutorial_done', { skipped: !!result?.skipped });
});
ui.setBest(bestWave, bestGrade);

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
  steerX = WORLD.WIDTH / 2;
  pointerX = null;
  blockHeld = false;
  accumulator = 0;
  lastTime = performance.now();
  prevPlayerX = run.player.x;
  ui.show('playing');
  Sdk.newRun({ zone: 1 });
  audio.playBgm('bgm');
  applyAudioSettings();
}

function togglePause() {
  if (state === 'playing') { state = 'paused'; ui.show('paused'); audio.stopBgm(); }
  else if (state === 'paused') { resumeGame(); }
}
function resumeGame() {
  if (state === 'paused') { state = 'playing'; ui.show('playing'); lastTime = performance.now(); audio.playBgm('bgm'); }
}

function toTitle() {
  state = 'title';
  run = null;
  ui.show('title');
  renderer.draw(null, 1);
  audio.stopBgm();
}

function onEnd(won) {
  state = 'dead';
  const stats = run.stats || {};
  const wave = stats.waveReached || run.waveIndex || 1;
  const style = Math.floor(stats.style ?? run.style ?? 0);
  const grade = gradeFor(style);
  const isRecord = wave > bestWave;
  if (isRecord) {
    bestWave = wave;
    bestGrade = grade;
    Sdk.save('bestWave', bestWave);
    Sdk.save('bestGrade', bestGrade);
  }
  ui.setBest(bestWave, bestGrade);
  ui.show('dead', {
    wave,
    style,
    grade,
    won,
    bestWave,
    bestGrade,
    newRecord: isRecord,
  });
  if (won) Sdk.levelCleared({ wave, style, grade });
  else Sdk.gameOver({ wave, style, grade });
  audio.stopBgm();
}

function onDeath() { onEnd(false); }
function onWin() { onEnd(true); }

async function shareResult() {
  const wave = run?.stats?.waveReached ?? 1;
  const grade = gradeFor(run?.stats?.style ?? 0);
  await Sdk.share({
    title: 'SKY DROP DODGE',
    text: i18n.get('result.shareText', { wave, grade }),
  });
  Sdk.track('share', { wave, grade });
}

// ---------- 事件分发 ----------
function dispatchEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);

    if (ev.type === 'blockSmall') renderer.burst(ev.x, ev.y, 'block');
    else if (ev.type === 'blockBig') renderer.burst(ev.x, ev.y, 'break');
    else if (ev.type === 'umbrellaBreak') renderer.burst(WORLD.WIDTH / 2, WORLD.GROUND_Y - 80, 'break');
    else if (ev.type === 'hit') renderer.burst(ev.x, ev.y, 'pop');
    else if (ev.type === 'ripple') renderer.burst(ev.x, ev.y, 'gold');
    else if (ev.type === 'win') renderer.burst(WORLD.WIDTH / 2, WORLD.GROUND_Y - 120, 'gold');

    if (state === 'playing') ui.tutorial.onGameEvent(ev);

    if (ev.type === 'waveEnter') Sdk.track('wave_enter', { wave: ev.wave });
    else if (ev.type === 'ripple') Sdk.track('ripple', { style: run?.style ?? 0 });
  }
}

// ---------- 主循环 ----------
function loop(now) {
  requestAnimationFrame(loop);

  if (state !== 'playing') {
    renderer.draw(state === 'paused' || state === 'dead' ? run : null, 1);
    return;
  }

  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  accumulator += dt;

  let steps = 0;
  while (accumulator >= STEP && steps < 6) {
    updateSteerFromInputs();
    blockHeld = blockHeld || keys.block;
    run.step({ steerX, block: blockHeld });
    accumulator -= STEP;
    steps++;

    // 教程第 1 步：真实移动信号
    if (steerMoved && prevPlayerX != null && Math.abs(run.player.x - prevPlayerX) > 2) {
      ui.tutorial.onGameEvent({ type: 'steer' });
      steerMoved = false;
    }
    prevPlayerX = run.player.x;

    dispatchEvents(run.drainEvents());
    if (run.phase === 'dead') { onDeath(); return; }
    if (run.phase === 'won') { onWin(); return; }
  }

  const hud = run.getHud();
  renderer.draw(run, accumulator / STEP);
  ui.setHud(hud);
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
  bestWave = Math.floor(Sdk.load('bestWave', 0)) || 0;
  bestGrade = Sdk.load('bestGrade', 'D') || 'D';
  ui.setBest(bestWave, bestGrade);
  applyAudioSettings();
  await Sdk.ready();
  Sdk.track('load', { lang: i18n.lang });
  // boot 竞态守卫：异步 SDK 加载期间玩家可能已点 Start；只在还没开局时显示标题
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
  debug: { layout: () => ({ viewport: [canvas.clientWidth, canvas.clientHeight], block: !btnBlock.hidden }) },
};
