// 主入口：60Hz 固定步长 + 标题→教程→游戏→暂停→结算 + i18n + 标准调试契约。
// 输入：指针滑动（鼠标/触屏统一走 Pointer Events），每段轨迹触发 sim.cut。
import { STEP, WORLD } from '../config/game.config.js';
import { createRun } from './game/sim.js';
import { createRenderer } from './render/index.js';
import { ui } from './ui/ui.js';
import { i18n } from './core/i18n.js';
import { save } from './core/save.js';
import { Sdk } from './core/sdk.js';
import { createAudio } from './core/audio.js';

const canvas = document.getElementById('canvas');
const renderer = createRenderer(canvas);
const audio = createAudio();

let sim = createRun();
let phase = 'title'; // title | tutorial | playing | paused | gameover
let best = save.best();
let tutStep = 0;
const TUTORIAL_STEPS = ['slice', 'bomb', 'chain'];

const fx = { trails: [], popups: [], flash: 0 };
let lastTime = performance.now();
let accumulator = 0;
let hintTimer = null;

// ---------- 音频 ----------
audio.setMuted(save.muted());
Sdk.ready().then(() => Sdk.track('load', { app: 'fruit-frenzy-blade' })).catch(() => {});

// ---------- 指针输入 ----------
const pointer = { active: false, id: -1, lastX: 0, lastY: 0 };

function toCanvas(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  const x = r.width ? (clientX - r.left) / r.width * WORLD.WIDTH : clientX;
  const y = r.height ? (clientY - r.top) / r.height * WORLD.HEIGHT : clientY;
  return { x, y };
}

function addTrail(x0, y0, x1, y1) {
  fx.trails.push({ x0, y0, x1, y1, ttl: 0.24 });
  if (fx.trails.length > 48) fx.trails.shift();
}

function pushPopup(x, y, text) {
  fx.popups.push({ x, y, text, ttl: 0.7 });
  if (fx.popups.length > 24) fx.popups.shift();
}

function doSlice(x0, y0, x1, y1) {
  const prev = sim.state.score;
  sim.cut(x0, y0, x1, y1);
  const delta = sim.state.score - prev;
  addTrail(x0, y0, x1, y1);
  if (delta > 0) pushPopup((x0 + x1) / 2, (y0 + y1) / 2, `+${delta}`);
}

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  audio.startBgm();
  if (phase !== 'playing') return;
  const p = toCanvas(e.clientX, e.clientY);
  pointer.active = true;
  pointer.id = e.pointerId;
  pointer.lastX = p.x;
  pointer.lastY = p.y;
  try { canvas.setPointerCapture(e.pointerId); } catch { /* noop */ }
  e.preventDefault();
});

window.addEventListener('pointermove', (e) => {
  if (!pointer.active || e.pointerId !== pointer.id) return;
  const p = toCanvas(e.clientX, e.clientY);
  const dx = p.x - pointer.lastX;
  const dy = p.y - pointer.lastY;
  const dist = Math.hypot(dx, dy);
  if (dist >= 6) {
    doSlice(pointer.lastX, pointer.lastY, p.x, p.y);
    pointer.lastX = p.x;
    pointer.lastY = p.y;
  }
  e.preventDefault();
});

function endPointer(e) {
  if (e.pointerId === pointer.id) pointer.active = false;
}
window.addEventListener('pointerup', endPointer);
window.addEventListener('pointercancel', endPointer);

// ---------- 状态机 ----------
function beginPlay() {
  sim = createRun({ seed: (Date.now() % 2147483647) || 1 });
  sim.spawnFruit(); // 开局立即抛出一颗，避免空场
  phase = 'playing';
  best = save.best();
  ui.showGame();
  ui.updateHUD(sim.getHud(), best);
  Sdk.newRun();
  fx.trails = [];
  fx.popups = [];
  fx.flash = 0;
  lastTime = performance.now();
  accumulator = 0;
  ui.showHint();
  if (hintTimer) clearTimeout(hintTimer);
  hintTimer = setTimeout(() => ui.hideHint(), 5000);
}

// 调试/验收辅助：切中一颗屏幕中部的可得分目标（避开 HUD），并留下可见刀光。
function debugSlice() {
  let target = null;
  for (const f of sim.state.fruits) {
    if (f.state !== 'flying' || (f.type !== 'fruit' && f.type !== 'golden')) continue;
    if (f.y > 240 && f.y < 600) {
      target = f;
      break;
    }
  }
  if (!target) return false;
  const x0 = Math.max(0, target.x - 90);
  const x1 = Math.min(WORLD.WIDTH, target.x + 90);
  doSlice(x0, target.y, x1, target.y);
  return true;
}

function start() {
  if (phase === 'playing' || phase === 'tutorial') return;
  if (!save.tutorialDone()) {
    startTutorial();
    return;
  }
  beginPlay();
}

function startTutorial() {
  tutStep = 0;
  phase = 'tutorial';
  ui.showScreen('none');
  ui.showTutorial(0, TUTORIAL_STEPS.length);
}

function nextTutorial() {
  if (tutStep < TUTORIAL_STEPS.length - 1) {
    tutStep += 1;
    ui.setTutorialStep(tutStep, TUTORIAL_STEPS.length);
  } else {
    completeTutorial();
  }
}

function skipTutorial() {
  completeTutorial();
}

function completeTutorial() {
  ui.hideTutorial();
  save.markTutorialDone();
  beginPlay();
}

function replayTutorial() {
  if (phase === 'playing' || phase === 'paused') {
    pause();
  }
  startTutorial();
}

function pause() {
  if (phase === 'playing') {
    phase = 'paused';
    ui.showPause();
  }
}

function resume() {
  if (phase === 'paused') {
    phase = 'playing';
    ui.hidePause();
    lastTime = performance.now();
  }
}

function restart() {
  sim = createRun();
  phase = 'title';
  best = save.best();
  ui.showTitle();
  ui.refreshBest(best);
  ui.hideHint();
  if (hintTimer) { clearTimeout(hintTimer); hintTimer = null; }
  fx.trails = [];
  fx.popups = [];
  fx.flash = 0;
}

function retry() {
  beginPlay();
}

function onGameOver() {
  if (phase !== 'playing') return;
  phase = 'gameover';
  const hud = sim.getHud();
  best = save.setBest(hud.score);
  ui.showResult(hud);
  ui.refreshBest(best);
  Sdk.gameOver({ score: hud.score, wave: hud.wave });
  fx.flash = Math.max(fx.flash, 0.5);
}

// ---------- 事件 → 音频 / 特效 ----------
function consumeEvents() {
  for (const e of sim.drainEvents()) {
    audio.event(e.type, e);
    if (e.type === 'bombHit') fx.flash = 1;
    if (e.type === 'gameOver') fx.flash = Math.max(fx.flash, 0.7);
  }
}

// ---------- 主循环 ----------
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  if (phase === 'playing') {
    accumulator += dt;
    while (accumulator >= STEP) {
      sim.step(STEP);
      accumulator -= STEP;
    }
    consumeEvents();
    if (sim.state.phase === 'gameover') onGameOver();
  }

  // 拖尾 / 飘字 / 闪白衰减
  for (let i = fx.trails.length - 1; i >= 0; i -= 1) {
    fx.trails[i].ttl -= dt;
    if (fx.trails[i].ttl <= 0) fx.trails.splice(i, 1);
  }
  for (let i = fx.popups.length - 1; i >= 0; i -= 1) {
    fx.popups[i].ttl -= dt;
    fx.popups[i].y -= dt * 44;
    if (fx.popups[i].ttl <= 0) fx.popups.splice(i, 1);
  }
  if (fx.flash > 0) fx.flash = Math.max(0, fx.flash - dt * 1.8);

  renderer.render(sim, { phase, fx });
  if (phase === 'playing' || phase === 'paused') ui.updateHUD(sim.getHud(), best);
}

// ---------- UI 绑定 ----------
ui.btnStart.addEventListener('click', () => { audio.unlock(); audio.startBgm(); start(); });
ui.btnHowto.addEventListener('click', replayTutorial);
ui.btnResume.addEventListener('click', resume);
ui.btnRestart.addEventListener('click', restart);
ui.btnHome.addEventListener('click', restart);
ui.btnRetry.addEventListener('click', retry);
ui.btnHome2.addEventListener('click', restart);
ui.btnPause.addEventListener('click', pause);
ui.btnMute.addEventListener('click', () => {
  const m = audio.setMuted(!save.muted());
  save.setMuted(m);
  ui.btnMute.textContent = m ? '🔇' : '🔊';
  ui.btnMute.setAttribute('aria-label', m ? 'Unmute' : 'Mute');
});
ui.tutSkip.addEventListener('click', skipTutorial);
ui.tutNext.addEventListener('click', nextTutorial);
for (const sel of ui.langSelects) {
  if (sel) sel.addEventListener('change', (e) => ui.setLang(e.target.value));
}

// 键盘：Esc 暂停/继续，R 重开
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') {
    if (phase === 'playing') pause();
    else if (phase === 'paused') resume();
  } else if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'gameover')) {
    retry();
  }
});

// ---------- 启动 ----------
ui.btnMute.textContent = save.muted() ? '🔇' : '🔊';
ui.showTitle();
ui.refreshBest(best);
renderer.render(sim, { phase: 'title', fx });
requestAnimationFrame(loop);

// ---------- 标准调试契约 ----------
window.G = {
  get sim() { return sim; },
  ui,
  save,
  Sdk,
  audio,
  state: () => phase,
};

window.__ll = {
  get state() { return { phase, lang: i18n.lang, dir: i18n.dir }; },
  get run() { return sim; },
  start,
  pause,
  resume,
  restart,
  retry,
  startTutorial,
  tutorial: {
    get active() { return phase === 'tutorial'; },
    get step() { return tutStep; },
    get steps() { return TUTORIAL_STEPS; },
    get current() { return TUTORIAL_STEPS[tutStep] || null; },
    skip: skipTutorial,
    next: nextTutorial,
  },
  save: () => Sdk,
  ui: () => ui,
  debugSlice,
};
