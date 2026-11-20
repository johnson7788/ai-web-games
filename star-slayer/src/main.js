// src/main.js — 装配：固定步长 / 输入 / 事件分发 / 状态机 / SDK / BGM（Lead 所有）
import { STEP, WORLD, CONFIG } from '../config/game.config.js';
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
const touchControls = document.getElementById('touch-controls');
const joystick = document.getElementById('joystick');
const knob = document.getElementById('joystick-knob');
const btnFire = document.getElementById('btn-fire');
const btnSkill = document.getElementById('btn-skill');
const btnSync = document.getElementById('btn-sync');

const renderer = createRender(canvas);
const audio = createAudio();
const ui = createUI(uiRoot, {
  onStart: () => startGame(),
  onResume: () => resumeGame(),
  onRestart: () => startGame(),
  onShare: () => shareResult(),
  onHow: () => {},
  onCardPick: (i) => { if (run && run.phase === 'playing') run.chooseCard(i); },
});
ui.onTutorial((result) => {
  Sdk.track('tutorial_done', { skipped: !!result?.skipped });
});

// ---------- 状态 ----------
let state = 'boot';       // boot | title | playing | paused | dead | won
let run = null;
let lastTime = 0;
let accumulator = 0;
let bestWave = 0;
let bgmMode = 'none';

// 输入状态
const keys = { up: false, down: false, left: false, right: false, fire: false };
let skillQueued = false;
let syncQueued = false;
let fireTap = false;
let joyActive = false;
let joyX = 0;
let joyY = 0;
let movedFlag = false;

// ---------- 键盘 ----------
window.addEventListener('keydown', (e) => {
  const c = e.code;
  if (c === 'ArrowLeft' || c === 'KeyA') keys.left = true;
  if (c === 'ArrowRight' || c === 'KeyD') keys.right = true;
  if (c === 'ArrowUp' || c === 'KeyW') keys.up = true;
  if (c === 'ArrowDown' || c === 'KeyS') keys.down = true;
  if (c === 'KeyJ' || c === 'Space') { keys.fire = true; fireTap = true; e.preventDefault(); }
  if (c === 'KeyK' && !e.repeat) skillQueued = true;
  if (c === 'KeyL' && !e.repeat) syncQueued = true;
  if (c === 'Escape' || c === 'KeyP') togglePause();
  if (c === 'KeyR' && (state === 'dead' || state === 'won')) startGame();
  if (c === 'Enter' && state === 'title') startGame();
});
window.addEventListener('keyup', (e) => {
  const c = e.code;
  if (c === 'ArrowLeft' || c === 'KeyA') keys.left = false;
  if (c === 'ArrowRight' || c === 'KeyD') keys.right = false;
  if (c === 'ArrowUp' || c === 'KeyW') keys.up = false;
  if (c === 'ArrowDown' || c === 'KeyS') keys.down = false;
  if (c === 'KeyJ' || c === 'Space') keys.fire = false;
});

// ---------- 触屏（coarse pointer 显示） ----------
if (window.matchMedia && matchMedia('(pointer: coarse)').matches) touchControls.hidden = false;

function bindJoystick() {
  const rect = () => joystick.getBoundingClientRect();
  const cx = () => rect().left + rect().width / 2;
  const cy = () => rect().top + rect().height / 2;
  const R = 44;
  function setKnob(dx, dy) {
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
  }
  joystick.addEventListener('pointerdown', (e) => {
    joyActive = true;
    joystick.setPointerCapture(e.pointerId);
    updateJoy(e);
  });
  joystick.addEventListener('pointermove', (e) => {
    if (joyActive) updateJoy(e);
  });
  function updateJoy(e) {
    const dx = e.clientX - cx();
    const dy = e.clientY - cy();
    const m = Math.hypot(dx, dy) || 1;
    const cl = Math.min(m, R);
    joyX = (dx / m) * (cl / R);
    joyY = (dy / m) * (cl / R);
    setKnob(dx / m * cl, dy / m * cl);
  }
  function endJoy(e) {
    joyActive = false;
    joyX = 0; joyY = 0;
    setKnob(0, 0);
  }
  joystick.addEventListener('pointerup', endJoy);
  joystick.addEventListener('pointercancel', endJoy);
}
bindJoystick();

btnFire.addEventListener('pointerdown', (e) => { e.preventDefault(); audio.unlock(); keys.fire = true; });
btnFire.addEventListener('pointerup', () => { keys.fire = false; });
btnFire.addEventListener('pointercancel', () => { keys.fire = false; });
btnSkill.addEventListener('pointerdown', (e) => { e.preventDefault(); audio.unlock(); skillQueued = true; });
btnSync.addEventListener('pointerdown', (e) => { e.preventDefault(); audio.unlock(); syncQueued = true; });

// ---------- 音频设置 ----------
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
  accumulator = 0;
  lastTime = performance.now();
  skillQueued = false;
  syncQueued = false;
  joyX = 0; joyY = 0;
  ui.show('playing');
  Sdk.newRun({ zone: 1 });
  applyAudioSettings();
  setBgm('bgm1');
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

function onDeath() {
  state = 'dead';
  const wave = Math.max(0, run.stats.waveReached || run.wave || 0);
  const isRecord = wave > bestWave;
  if (isRecord) { bestWave = wave; Sdk.save('bestWave', bestWave); }
  ui.setBest(bestWave);
  ui.show('dead', {
    won: false,
    wave,
    kills: run.stats.kills || 0,
    best: bestWave,
    newRecord: isRecord,
  });
  Sdk.gameOver({ wave, kills: run.stats.kills || 0 });
  setBgm('none');
}

function onWin() {
  state = 'won';
  const wave = WAVE_COUNT_FALLBACK;
  const isRecord = wave > bestWave;
  if (isRecord) { bestWave = wave; Sdk.save('bestWave', bestWave); }
  ui.setBest(bestWave);
  ui.show('won', {
    won: true,
    wave,
    kills: run.stats.kills || 0,
    best: bestWave,
    newRecord: isRecord,
  });
  Sdk.levelCleared({ wave, kills: run.stats.kills || 0 });
  setBgm('none');
}

// 12 波上限（避免 main 引入 levels 依赖；sim 内已保证）
const WAVE_COUNT_FALLBACK = 12;

async function shareResult() {
  const wave = Math.floor(run?.stats?.waveReached ?? 0);
  await Sdk.share({
    title: 'STAR SLAYER',
    text: `${i18n.lang === 'zh' ? `我在 STAR SLAYER 守到了第 ${wave} 波！` : `I defended the deck to wave ${wave} in STAR SLAYER!`}`,
  });
  Sdk.track('share', { wave });
}

function setBgm(mode) {
  if (bgmMode === mode) return;
  bgmMode = mode;
  audio.stopBgm();
  if (mode !== 'none') audio.playBgm(mode);
}

function sceneBgm(sceneIdx) {
  return sceneIdx === 1 ? 'bgm2' : sceneIdx === 2 ? 'bgm3' : 'bgm1';
}

// ---------- 输入装配 ----------
function buildInput() {
  const mx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0) + joyX;
  const my = (keys.down ? 1 : 0) - (keys.up ? 1 : 0) + joyY;
  const input = {
    mx: Math.max(-1, Math.min(1, mx)),
    my: Math.max(-1, Math.min(1, my)),
    fire: keys.fire || fireTap,
    skill: skillQueued,
    sync: syncQueued,
  };
  fireTap = false;
  skillQueued = false;
  syncQueued = false;
  if (input.mx !== 0 || input.my !== 0) movedFlag = true;
  return input;
}

// ---------- 事件分发 ----------
function dispatchEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);

    if (ev.type === 'kill') renderer.burst(ev.x, ev.y, 'kill');
    else if (ev.type === 'hit') renderer.burst(ev.x, ev.y, 'hit');
    else if (ev.type === 'coreCopy') renderer.burst(ev.x, ev.y, 'coreCopy');
    else if (ev.type === 'phaseSync') { renderer.burst(ev.x, ev.y, 'sync'); renderer.flash('sync', '84,231,255'); }
    else if (ev.type === 'overload') { renderer.burst(ev.x, ev.y, 'overload'); renderer.flash('overload', '255,255,255'); }
    else if (ev.type === 'bossBreak') { renderer.burst(ev.x, ev.y, 'boss'); renderer.flash('bossBreak', '255,93,115'); }
    else if (ev.type === 'playerHurt') renderer.flash('hurt', '255,93,115');

    if (state === 'playing') ui.tutorial.onGameEvent(ev);

    if (ev.type === 'waveStart') Sdk.track('wave_start', { wave: ev.wave });
    else if (ev.type === 'waveClear') Sdk.track('waveClear', { wave: ev.wave });
    else if (ev.type === 'bossBreak') Sdk.track('bossBreak', { wave: run?.wave });
    else if (ev.type === 'cardPick') Sdk.track('cardPick', { id: ev.id });
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
    const input = buildInput();
    run.step(input);
    accumulator -= STEP;
    steps++;
    if (movedFlag) {
      ui.tutorial.onGameEvent({ type: 'move' });
      movedFlag = false;
    }
    dispatchEvents(run.drainEvents());
    if (run.phase === 'dead') { onDeath(); return; }
    if (run.phase === 'won') { onWin(); return; }
  }

  const hud = run.getHud();
  setBgm(hud.bossHp > 0 ? 'bgmBoss' : sceneBgm(hud.scene));
  renderer.setOverloadReady(hud.overloadReady);
  renderer.draw(run, accumulator / STEP);
  ui.setHud(hud);
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
  bestWave = Math.floor(Sdk.load('bestWave', 0)) || 0;
  ui.setBest(bestWave);
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
  save: () => Sdk.save,
  ui: () => ui,
  tutorial: {
    get active() { return ui.tutorial.active; },
    get step() { return ui.tutorial.step; },
    get steps() { return ui.tutorial.steps; },
    get current() { return ui.tutorial.current; },
    skip: () => ui.tutorial.skip(),
  },
  debug: { layout: () => ({ viewport: [canvas.clientWidth, canvas.clientHeight], touch: !touchControls.hidden }) },
};
