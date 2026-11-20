// src/main.js — 装配：固定步长 / 输入 / 事件分发 / 状态机 / SDK / 音频（Lead 所有）
import { STEP } from '../config/game.config.js';
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
const joy = document.getElementById('joy');
const joyKnob = document.getElementById('joy-knob');
const btnFire = document.getElementById('btn-fire');
const btnHeavy = document.getElementById('btn-heavy');
const btnWeldTouch = document.getElementById('btn-weld-touch');

const renderer = createRender(canvas);
const audio = createAudio();

// ---------- 状态 ----------
let state = 'boot';             // boot | title | playing | paused | dead | win
let run = null;
let lastTime = 0;
let accumulator = 0;
let bestWave = 1;
let upgradeShowing = false;

// ---------- 输入 ----------
const keys = { up: false, down: false, left: false, right: false, fire: false, heavy: false };
let repairPressed = false;
let touchDir = null;

window.addEventListener('keydown', (e) => {
  switch (e.code) {
    case 'ArrowUp': case 'KeyW': keys.up = true; e.preventDefault(); break;
    case 'ArrowDown': case 'KeyS': keys.down = true; e.preventDefault(); break;
    case 'ArrowLeft': case 'KeyA': keys.left = true; e.preventDefault(); break;
    case 'ArrowRight': case 'KeyD': keys.right = true; e.preventDefault(); break;
    case 'Space': case 'KeyJ': keys.fire = true; e.preventDefault(); break;
    case 'KeyK': keys.heavy = true; break;
    case 'KeyE': repairPressed = true; break;
    case 'Escape': case 'KeyP': togglePause(); break;
    case 'KeyR': if (state === 'dead' || state === 'win') startGame(); break;
    case 'Enter': if (state === 'title') startGame(); break;
    default: break;
  }
});
window.addEventListener('keyup', (e) => {
  switch (e.code) {
    case 'ArrowUp': case 'KeyW': keys.up = false; break;
    case 'ArrowDown': case 'KeyS': keys.down = false; break;
    case 'ArrowLeft': case 'KeyA': keys.left = false; break;
    case 'ArrowRight': case 'KeyD': keys.right = false; break;
    case 'Space': case 'KeyJ': keys.fire = false; break;
    case 'KeyK': keys.heavy = false; break;
    default: break;
  }
});

// ---------- UI ----------
const ui = createUI(uiRoot, {
  onStart: () => startGame(),
  onResume: () => resumeGame(),
  onRestart: () => startGame(),
  onShare: () => shareResult(),
  onMute: (m) => audio.setMuted(m),
  onUpgrade: (i) => chooseUpgrade(i),
});
ui.onTutorial((result) => {
  Sdk.track('tutorial_done', { skipped: !!result?.skipped });
});
ui.setBest(bestWave);

// 焊修按钮（桌面 HUD + 触屏）
ui.hud.weldBtn.addEventListener('click', () => { repairPressed = true; });
btnWeldTouch.addEventListener('pointerdown', (e) => { e.preventDefault(); repairPressed = true; });
btnFire.addEventListener('pointerdown', (e) => { e.preventDefault(); keys.fire = true; });
btnFire.addEventListener('pointerup', () => { keys.fire = false; });
btnFire.addEventListener('pointercancel', () => { keys.fire = false; });
btnHeavy.addEventListener('pointerdown', (e) => { e.preventDefault(); keys.heavy = true; });
btnHeavy.addEventListener('pointerup', () => { keys.heavy = false; });
btnHeavy.addEventListener('pointercancel', () => { keys.heavy = false; });

// ---------- 触屏摇杆 ----------
if (window.matchMedia && matchMedia('(pointer: coarse)').matches) touchControls.classList.remove('hidden');

(function setupJoystick() {
  let active = false;
  const center = () => ({ x: joy.offsetWidth / 2, y: joy.offsetHeight / 2 });
  function setKnob(dx, dy) {
    const c = center();
    const max = c.x - 26;
    const d = Math.hypot(dx, dy);
    const k = d > max ? max / d : 1;
    joyKnob.style.transform = `translate(calc(-50% + ${dx * k}px), calc(-50% + ${dy * k}px))`;
  }
  function resetKnob() { joyKnob.style.transform = 'translate(-50%, -50%)'; touchDir = null; }
  function onMove(e) {
    if (!active) return;
    const r = joy.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    setKnob(dx, dy);
    if (Math.abs(dx) > Math.abs(dy)) touchDir = dx > 0 ? 'right' : 'left';
    else touchDir = dy > 0 ? 'down' : 'up';
  }
  joy.addEventListener('pointerdown', (e) => { active = true; joy.setPointerCapture(e.pointerId); onMove(e); });
  joy.addEventListener('pointermove', onMove);
  joy.addEventListener('pointerup', () => { active = false; resetKnob(); });
  joy.addEventListener('pointercancel', () => { active = false; resetKnob(); });
})();

// ---------- 音频设置 ----------
function applyAudioSettings() {
  const muted = Sdk.load('audioMuted', false);
  const vol = Sdk.load('audioVolume', 0.7);
  audio.setMuted(!!muted);
  audio.setVolume(vol);
  ui.setMuted(!!muted);
}

// ---------- 游戏流转 ----------
function startGame() {
  audio.unlock();
  run = createRun({ seed: (Date.now() & 0xffff) * 2654435761 >>> 0 });
  state = 'playing';
  upgradeShowing = false;
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
  if (state === 'paused') { state = 'playing'; ui.show('playing'); lastTime = performance.now(); }
}

function toTitle() {
  state = 'title';
  run = null;
  upgradeShowing = false;
  ui.show('title');
  renderer.draw(null);
}

function chooseUpgrade(i) {
  if (!upgradeShowing || !run) return;
  run.chooseUpgrade(i);
  upgradeShowing = false;
  ui.show('playing');
  lastTime = performance.now();
}

function onUpgradeOffer() {
  upgradeShowing = true;
  ui.showUpgrade(run.pendingUpgrade);
}

function onDeath() {
  state = 'dead';
  const wave = run.wave || 1;
  const score = run.score || 0;
  const kills = run.stats?.kills || 0;
  const isRecord = wave > bestWave;
  if (isRecord) { bestWave = wave; Sdk.save('bestWave', bestWave); }
  ui.setBest(bestWave);
  ui.show('dead', { wave, score, kills, best: bestWave, newRecord: isRecord, win: false });
  Sdk.gameOver({ wave, score, kills });
}

function onWin() {
  state = 'win';
  const wave = 12;
  const score = run.score || 0;
  const kills = run.stats?.kills || 0;
  bestWave = 12;
  Sdk.save('bestWave', bestWave);
  ui.setBest(bestWave);
  ui.show('win', { wave, score, kills, best: bestWave, newRecord: true, win: true });
  Sdk.levelCleared({ wave, score, kills });
}

async function shareResult() {
  const wave = run?.wave ?? 0;
  await Sdk.share({
    title: 'IRON SIEGE',
    text: i18n.lang === 'zh' ? `我在钢铁围城守到了第 ${wave} 波！` : `I held the Core Furnace to wave ${wave}!`,
  });
  Sdk.track('share', { wave });
}

// ---------- 事件分发 ----------
function dispatchEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    if (state === 'playing') ui.tutorial.onGameEvent(ev);
    if (ev.type === 'waveClear') Sdk.track('waveClear', { wave: ev.wave });
    else if (ev.type === 'kill') Sdk.track('kill', { type: ev.type });
    else if (ev.type === 'furnaceHit') Sdk.track('furnaceHit', { hp: ev.hp });
  }
}

// ---------- 主循环 ----------
function currentInput() {
  const up = keys.up || touchDir === 'up';
  const down = keys.down || touchDir === 'down';
  const left = keys.left || touchDir === 'left';
  const right = keys.right || touchDir === 'right';
  return { up, down, left, right, fire: keys.fire, heavy: keys.heavy, repair: repairPressed };
}

function loop(now) {
  requestAnimationFrame(loop);

  if (state !== 'playing') {
    renderer.draw(state === 'paused' || state === 'dead' || state === 'win' ? run : null);
    return;
  }

  if (upgradeShowing) {
    renderer.draw(run);
    ui.setHud(run.getHud());
    return;
  }

  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  accumulator += dt;

  let steps = 0;
  while (accumulator >= STEP && steps < 6) {
    const inp = currentInput();
    repairPressed = false;
    run.step(inp);
    accumulator -= STEP;
    steps++;
    dispatchEvents(run.drainEvents());
    if (run.phase === 'dead') { onDeath(); return; }
    if (run.phase === 'win') { onWin(); return; }
    if (run.pendingUpgrade) { onUpgradeOffer(); break; }
  }

  renderer.draw(run, accumulator / STEP);
  ui.setHud(run.getHud());
  ui.tutorial.tick(performance.now());
}

// ---------- 失焦自动暂停 ----------
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'playing') togglePause();
});

// ---------- 广告期间静音 ----------
Sdk.onAdStart(() => audio.setMuted(true));
Sdk.onAdEnd(() => { audio.setMuted(!!Sdk.load('audioMuted', false)); });

// ---------- 启动 ----------
(async () => {
  bestWave = Math.floor(Sdk.load('bestWave', 1)) || 1;
  ui.setBest(bestWave);
  applyAudioSettings();
  await Sdk.ready();
  Sdk.track('load', { lang: i18n.lang });
  // boot 竞态守卫：玩家可能在 boot 期间已点 Deploy；只在还没开局时才显示标题
  if (state === 'boot') { state = 'title'; ui.show('title'); }
  renderer.draw(null);
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
  debug: { layout: () => ({ viewport: [canvas.clientWidth, canvas.clientHeight], touch: !touchControls.classList.contains('hidden') }) },
};
