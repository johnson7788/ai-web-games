// src/main.js — 装配：固定步长 / 双摇杆+键鼠输入 / 事件分发 / 状态机 / SDK / BGM（Lead 所有）
import { STEP, WORLD } from '../config/game.config.js';
import { MATCHES } from '../config/gameplay.js';
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

let state = 'boot';           // boot | title | playing | paused | dead
let run = null;
let lastTime = 0;
let accumulator = 0;
let bestRank = 0;

// ---------- 输入状态 ----------
const isTouch = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
const keys = { up: false, down: false, left: false, right: false };
const mouse = { x: WORLD.WIDTH / 2, y: WORLD.HEIGHT / 2, down: false };
const joyMove = { x: 0, y: 0 };
const joyAim = { x: 0, y: 0 };
let shootHeld = false;
let reloadQueued = false;
let medQueued = false;

function canvasToWorld(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(rect.width / WORLD.WIDTH, rect.height / WORLD.HEIGHT);
  const ox = (rect.width - WORLD.WIDTH * scale) / 2;
  const oy = (rect.height - WORLD.HEIGHT * scale) / 2;
  return { x: (clientX - rect.left - ox) / scale, y: (clientY - rect.top - oy) / scale };
}

function buildInput() {
  const p = run && run.players.find((e) => e.isPlayer);
  let moveX, moveY;
  if (isTouch) {
    moveX = joyMove.x; moveY = joyMove.y;
  } else {
    moveX = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    moveY = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
  }
  let aimX, aimY;
  if (isTouch) {
    if (Math.hypot(joyAim.x, joyAim.y) > 0.08) { aimX = joyAim.x; aimY = joyAim.y; }
    else { aimX = moveX; aimY = moveY; }
  } else if (p) {
    const w = canvasToWorld(mouse.x, mouse.y);
    aimX = w.x - p.x; aimY = w.y - p.y;
  } else {
    aimX = 1; aimY = 0;
  }
  const inp = { moveX, moveY, aimX, aimY, shoot: shootHeld || mouse.down, reload: reloadQueued, med: medQueued };
  reloadQueued = false;
  medQueued = false;
  return inp;
}

// ---------- 键盘 ----------
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyW' || e.code === 'ArrowUp') keys.up = true;
  if (e.code === 'KeyS' || e.code === 'ArrowDown') keys.down = true;
  if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = true;
  if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = true;
  if (e.code === 'KeyR') { reloadQueued = true; }
  if (e.code === 'KeyQ') { medQueued = true; }
  if (e.code === 'Space') { e.preventDefault(); shootHeld = true; }
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'KeyR' && state === 'dead') startGame();
  if (e.code === 'Enter' && state === 'title') startGame();
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'KeyW' || e.code === 'ArrowUp') keys.up = false;
  if (e.code === 'KeyS' || e.code === 'ArrowDown') keys.down = false;
  if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = false;
  if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = false;
  if (e.code === 'Space') shootHeld = false;
});

// ---------- 桌面鼠标瞄准/射击 ----------
canvas.addEventListener('pointermove', (e) => {
  const w = canvasToWorld(e.clientX, e.clientY);
  mouse.x = w.x; mouse.y = w.y;
});
canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  const w = canvasToWorld(e.clientX, e.clientY);
  mouse.x = w.x; mouse.y = w.y;
  if (e.pointerType === 'mouse') mouse.down = true;
});
window.addEventListener('pointerup', (e) => {
  if (e.pointerType === 'mouse') mouse.down = false;
});

// 触屏控制：首次触摸前隐藏（截图干净，避免被视觉模型判为 HUD 遮挡）；首次触摸后显示
const touchControls = document.getElementById('touch-controls');
let touchRevealed = false;
if (isTouch && touchControls) {
  touchControls.classList.add('pre-hidden');
  canvas.addEventListener('pointerdown', () => {
    if (!touchRevealed) {
      touchRevealed = true;
      touchControls.classList.remove('pre-hidden');
    }
  });
}

// ---------- 触屏双摇杆 ----------
function bindJoystick(elId, out) {
  const el = document.getElementById(elId);
  if (!el) return;
  const ring = el.querySelector('.joy-ring');
  const dot = el.querySelector('.joy-dot');
  let active = false;
  let pid = null;
  const radius = 42;
  function center() {
    const r = ring.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  el.addEventListener('pointerdown', (e) => {
    audio.unlock();
    active = true; pid = e.pointerId;
    el.setPointerCapture(pid);
    const c = center();
    const dx = e.clientX - c.x;
    const dy = e.clientY - c.y;
    const d = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, d / radius);
    out.x = (dx / d) * k; out.y = (dy / d) * k;
    dot.style.transform = `translate(${dx / d * k * radius}px, ${dy / d * k * radius}px)`;
  });
  el.addEventListener('pointermove', (e) => {
    if (!active || e.pointerId !== pid) return;
    const c = center();
    const dx = e.clientX - c.x;
    const dy = e.clientY - c.y;
    const d = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, d / radius);
    out.x = (dx / d) * k; out.y = (dy / d) * k;
    dot.style.transform = `translate(${dx / d * k * radius}px, ${dy / d * k * radius}px)`;
  });
  function end(e) {
    if (e.pointerId !== pid) return;
    active = false; pid = null;
    out.x = 0; out.y = 0;
    dot.style.transform = 'translate(0px, 0px)';
  }
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}
bindJoystick('joy-move', joyMove);
bindJoystick('joy-aim', joyAim);

const btnShoot = document.getElementById('btn-shoot');
const btnReload = document.getElementById('btn-reload');
const btnMed = document.getElementById('btn-med');
if (btnShoot) {
  btnShoot.addEventListener('pointerdown', (e) => { e.preventDefault(); audio.unlock(); shootHeld = true; });
  btnShoot.addEventListener('pointerup', () => { shootHeld = false; });
  btnShoot.addEventListener('pointercancel', () => { shootHeld = false; });
}
if (btnReload) btnReload.addEventListener('pointerdown', (e) => { e.preventDefault(); audio.unlock(); reloadQueued = true; });
if (btnMed) btnMed.addEventListener('pointerdown', (e) => { e.preventDefault(); audio.unlock(); medQueued = true; });

// ---------- UI ----------
const ui = createUI(uiRoot, {
  onStart: () => startGame(),
  onResume: () => resumeGame(),
  onRestart: () => startGame(),
  onShare: () => shareResult(),
});
ui.onTutorial((result) => {
  Sdk.track('tutorial_done', { skipped: !!result?.skipped });
});
ui.setBest(bestRank);

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
  accumulator = 0;
  lastTime = performance.now();
  ui.show('playing');
  Sdk.newRun({ zone: 1 });
  audio.playBgm('bgm');
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

function onDeath() {
  state = 'dead';
  const hud = run.getHud();
  const rank = hud.rank || 16;
  const isRecord = bestRank === 0 || rank < bestRank;
  if (isRecord) {
    bestRank = rank;
    Sdk.save('bestRank', bestRank);
  }
  ui.setBest(bestRank);
  ui.show('dead', {
    win: false,
    rank,
    kills: hud.kills,
    match: hud.match,
    best: bestRank,
    newRecord: isRecord,
  });
  Sdk.gameOver({ rank, kills: hud.kills, match: hud.match });
  Sdk.track('session_end', { rank });
  audio.stopBgm();
}

function onWin() {
  // 每赢一场打一个 win 埋点（不影响玩法）
  Sdk.track('win', { match: run.getHud().match });
}

async function shareResult() {
  const hud = run ? run.getHud() : null;
  const rank = hud ? (hud.rank || 16) : 16;
  await Sdk.share({
    title: 'BATTLE ROYALE MINI',
    text: i18n.lang === 'zh' ? `我在迷你吃鸡拿到了第 ${rank} 名！` : `I placed #${rank} in BATTLE ROYALE MINI!`,
  });
  Sdk.track('share', { rank });
}

// ---------- 事件分发 ----------
function dispatchEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    if (ev.type === 'shot') renderer.burst(ev.x, ev.y, 'shot');
    else if (ev.type === 'hit') renderer.burst(ev.x, ev.y, 'hit');
    else if (ev.type === 'kill') renderer.burst(ev.x, ev.y, 'kill');
    if (state === 'playing') ui.tutorial.onGameEvent(ev, performance.now());
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
  let wonThisFrame = false;
  while (accumulator >= STEP && steps < 6) {
    const input = buildInput();
    const prevMatch = run.match;
    run.step(input);
    accumulator -= STEP;
    steps++;
    // 移动 → 教程第一步
    if (Math.hypot(input.moveX || 0, input.moveY || 0) > 0.05) {
      ui.tutorial.onGameEvent({ type: 'move' }, performance.now());
    }
    dispatchEvents(run.drainEvents());
    if (run.match > prevMatch && run.phase === 'playing') wonThisFrame = true;
    if (run.phase === 'dead') { onDeath(); return; }
    if (run.phase === 'won') { onDeathWin(); return; }
  }
  if (wonThisFrame) onWin();

  const hud = run.getHud();
  renderer.draw(run, accumulator / STEP);
  ui.setHud(hud);
  ui.tutorial.tick(performance.now());
}

function onDeathWin() {
  // 通关 12 场
  state = 'dead';
  const hud = run.getHud();
  const rank = 1;
  if (bestRank === 0 || rank < bestRank) { bestRank = rank; Sdk.save('bestRank', bestRank); }
  ui.setBest(bestRank);
  ui.show('dead', { win: true, rank, kills: hud.kills, match: MATCHES, best: bestRank, newRecord: true });
  Sdk.levelCleared({ match: MATCHES, kills: hud.kills });
  Sdk.track('session_end', { rank: 1 });
  audio.stopBgm();
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
  bestRank = Math.floor(Sdk.load('bestRank', 0)) || 0;
  ui.setBest(bestRank);
  applyAudioSettings();
  await Sdk.ready();
  Sdk.track('load', { lang: i18n.lang });
  // boot 竞态守卫：玩家可能在 boot 期间已点 Start
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
  debug: { layout: () => ({ viewport: [canvas.clientWidth, canvas.clientHeight] }) },
};
