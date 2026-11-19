// MY PLANET GROW · 主入口：60Hz 固定步长 + 标题/游戏/暂停/结算 + 教程引导 + SDK 出口
// 装配：sim（纯逻辑）/ render（canvas）/ audio（WebAudio）/ ui（DOM 显隐与语言）。
import { STEP, WORLD, GAME } from '../config/game.config.js';
import { createRun } from './game/sim.js';
import { createRenderer } from './render/index.js';
import { createAudio } from './core/audio.js';
import { ui } from './ui/ui.js';
import { i18n, t, syncDocumentLang } from './core/i18n.js';
import Sdk from './core/sdk.js';

const $ = (id) => document.getElementById(id);
const canvas = $('canvas');
const renderer = createRenderer(canvas);
const audio = createAudio();

let run = null;
let phase = 'title';       // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let tutorialStep = -1;     // -1 = 未激活
let fpsSamples = [];
let newBest = false;
const reduceMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const view = {
  time: 0,
  fxQueue: [],             // {x,y,ttl,max,r,color}
  shake: 0,
  comboPopup: null,        // {text,x,y,ttl,max}
  cursor: { x: WORLD.WIDTH / 2, y: WORLD.HEIGHT / 2 },
};

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let best = Sdk.load('best', 0) | 0;
let tutorialDone = !!Sdk.load('tutorialDone', false);

Sdk.ready(); // 不 await，不阻塞首屏
audio.setMuted(muted);
ui.setMuted(muted);

function persist() {
  Sdk.save('muted', muted);
  Sdk.save('best', best);
  Sdk.save('tutorialDone', tutorialDone);
}

// ---------- 阶段状态机 ----------
function setPhase(p) { phase = p; }

function startGame() {
  run = createRun((Date.now() % 2147483647) || 1);
  newBest = false;
  view.fxQueue = [];
  view.comboPopup = null;
  view.shake = 0;
  setPhase('playing');
  ui.showGame();
  ui.hide('result');
  updateHud();
  audio.startBgm();
  Sdk.newRun({});
  Sdk.track('start', {});
  if (!tutorialDone) startTutorial();
}

function pauseGame() {
  if (phase !== 'playing') return;
  setPhase('paused');
  audio.stopBgm();
  ui.showPause();
}

function resumeGame() {
  if (phase !== 'paused') return;
  setPhase('playing');
  ui.hidePause();
  audio.startBgm();
}

function restartGame() {
  if (run) Sdk.track('restart', {});
  startGame();
}

function goHome() {
  run = null;
  if (tutorialStep >= 0) endTutorial();
  setPhase('title');
  ui.hide('result');
  ui.showTitle();
}

// ---------- HUD / 结算 ----------
function updateHud() {
  if (!run) return;
  const h = run.getHud();
  $('hud-score').textContent = String(h.score);
  $('hud-best').textContent = String(Math.max(best, h.score));
  const hearts = '♥'.repeat(Math.max(0, h.hp)) + '♡'.repeat(Math.max(0, GAME.HP_MAX - h.hp));
  $('hud-hp').textContent = hearts;
  $('hud-shield').textContent = h.shields > 0 ? '🛡×' + h.shields : '';
  $('hud-combo').textContent = h.combo > 1 ? '×' + h.comboMult : '';
  $('hud-combo').classList.toggle('hot', h.combo >= 4);
  $('hud-mass').textContent = String(h.mass);
  $('hud-tier-num').textContent = String(h.tier + 1);
  $('hud-tier-fill').style.width = `${Math.min(100, (h.mass / GAME.TIER_MASS[GAME.TIER_MASS.length - 1]) * 100)}%`;
  $('hud-goal').innerHTML = `<span class="dot-catch"></span><span class="catch">${t('catchHint')}</span><span class="dot-dodge"></span><span class="dodge">${t('dodgeHint')}</span>`;
}

function showResult(res) {
  $('result-title').textContent = t('resultTitle');
  const starsEl = $('result-stars');
  const stars = res.stars || 0;
  starsEl.innerHTML = `<span class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>`;
  $('result-score').textContent = `${t('resultScore')}: ${res.score}`;
  $('result-best').textContent = `${t('resultBest')}: ${Math.max(best, res.score)}`;
  $('result-mass').textContent = `${t('resultMass')}: ${res.mass} · ${t('tier')} ${res.tier + 1}`;
  $('result-newbest').classList.toggle('hidden', !newBest);
  $('screen-result').classList.remove('hidden');
}

function hideResult() {
  $('screen-result').classList.add('hidden');
}

function finishRun(ev) {
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  const st = run.state;
  const score = ev.score ?? st.score;
  if (score > best) { best = score; newBest = true; }
  persist();
  Sdk.gameOver({ score, stars: ev.stars ?? st.stars, mass: ev.mass ?? st.mass });
  showResult({ score, stars: ev.stars ?? st.stars, mass: ev.mass ?? st.mass, tier: ev.tier ?? st.planet.tier });
}

// ---------- 教程（首次自动弹，可跳过，完成/跳过后持久化不再自动弹） ----------
const TUT_STEPS = ['drag', 'catch', 'avoid'];

function tutTextFor(step) {
  if (step === 'drag') return t('tutDrag');
  if (step === 'catch') return t('tutCatch');
  return t('tutAvoid');
}

function startTutorial() {
  tutorialStep = 0;
  renderTutorialStep();
}

function renderTutorialStep() {
  const el = $('tutorial');
  if (tutorialStep < 0) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  $('tut-title').textContent = t('tutTitle');
  $('tut-text').textContent = tutTextFor(TUT_STEPS[tutorialStep] || 'drag');
  $('tut-skip').textContent = t('tutSkip');
  $('tut-next').textContent = t('tutNext');
}

function tutorialNext() {
  tutorialStep += 1;
  if (tutorialStep >= TUT_STEPS.length) endTutorial();
  else renderTutorialStep();
}

function endTutorial() {
  tutorialStep = -1;
  tutorialDone = true;
  persist();
  renderTutorialStep();
}

function tutorialAdvance(evType) {
  if (tutorialStep < 0 || tutorialStep >= TUT_STEPS.length) return;
  const expect = TUT_STEPS[tutorialStep];
  if (expect === 'drag' && evType === 'move') tutorialNext();
  else if (expect === 'catch' && (evType === 'meteor' || evType === 'gold')) tutorialNext();
  else if (expect === 'avoid' && (evType === 'hit' || evType === 'absorb')) tutorialNext();
}

// ---------- 粒子 / 反馈 ----------
function burst(x, y, color, n, r0, speed) {
  if (reduceMotion) n = Math.max(0, Math.floor(n / 2));
  for (let i = 0; i < n; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const sp = speed * (0.4 + Math.random() * 0.8);
    view.fxQueue.push({
      x: x + Math.cos(a) * r0,
      y: y + Math.sin(a) * r0,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      ttl: 0.5 + Math.random() * 0.3,
      max: 0.8,
      r: 2 + Math.random() * 3,
      color,
    });
  }
}

function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    tutorialAdvance(ev.type);
    switch (ev.type) {
      case 'meteor':
        burst(ev.x, ev.y, '#7ef0e0', 8, 6, 120);
        view.comboPopup = { text: '+' + ev.gain, x: ev.x, y: ev.y - 10, ttl: 0.7, max: 0.7 };
        break;
      case 'gold':
        burst(ev.x, ev.y, '#ffd54a', 16, 8, 160);
        view.comboPopup = { text: '+' + ev.gain, x: ev.x, y: ev.y - 10, ttl: 0.9, max: 0.9 };
        view.shake = 2;
        break;
      case 'shield':
        burst(ev.x, ev.y, '#93c5fd', 12, 8, 130);
        view.comboPopup = { text: '🛡', x: ev.x, y: ev.y - 10, ttl: 0.8, max: 0.8 };
        break;
      case 'hit':
        burst(ev.x ?? view.cursor.x, ev.y ?? view.cursor.y, '#f87171', 14, 10, 180);
        view.shake = 7;
        break;
      case 'absorb':
        burst(ev.x ?? view.cursor.x, ev.y ?? view.cursor.y, '#c4b5fd', 10, 8, 140);
        view.shake = 3;
        break;
      case 'tierUp':
        burst(view.cursor.x || WORLD.WIDTH / 2, view.cursor.y || WORLD.HEIGHT / 2, '#fde047', 22, 12, 200);
        view.shake = 5;
        view.comboPopup = { text: `${t('tier')} ${ev.tier + 1}!`, x: WORLD.WIDTH / 2, y: 120, ttl: 1.2, max: 1.2 };
        break;
      case 'gameover':
        finishRun(ev);
        return;
      default:
        break;
    }
  }
}

// ---------- 输入 ----------
function canvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (WORLD.WIDTH / rect.width),
    y: (e.clientY - rect.top) * (WORLD.HEIGHT / rect.height),
  };
}

let dragging = false;
let lastPointer = null;
const keys = new Set();

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (!run || phase !== 'playing') return;
  dragging = true;
  lastPointer = canvasPos(e);
  canvas.setPointerCapture?.(e.pointerId);
});

canvas.addEventListener('pointermove', (e) => {
  view.cursor = canvasPos(e);
  if (!dragging || !run || phase !== 'playing') return;
  const p = canvasPos(e);
  const dx = p.x - lastPointer.x;
  const dy = p.y - lastPointer.y;
  lastPointer = p;
  if (dx !== 0 || dy !== 0) run.movePlanet(dx, dy);
});

function endDrag(e) {
  dragging = false;
  lastPointer = null;
  try { canvas.releasePointerCapture?.(e.pointerId); } catch { /* noop */ }
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
  if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'result')) restartGame();
  if (e.code === 'KeyM') toggleMute();
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS'].includes(e.code)) {
    keys.add(e.code);
    e.preventDefault();
  }
});

window.addEventListener('keyup', (e) => {
  keys.delete(e.code);
});

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  ui.setMuted(muted);
  $('btn-mute').classList.toggle('is-muted', muted);
  $('btn-mute').textContent = muted ? '🔇' : '🔊';
  persist();
}

// ---------- UI 绑定 ----------
function bind() {
  const on = (id, fn) => {
    const el = $(id);
    if (el) el.addEventListener('click', () => { audio.unlock(); fn(); });
  };
  on('btn-start', startGame);
  on('btn-resume', resumeGame);
  on('btn-restart2', restartGame);
  on('btn-retry', restartGame);
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result') startTutorial(); });
  on('btn-tut-replay', () => { if (phase === 'paused') resumeGame(); if (phase === 'playing' || phase === 'paused') startTutorial(); });
  on('btn-rotate-skip', () => {
    const rs = $('rotate-screen');
    if (rs) rs.style.display = 'none';
  });
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);

  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = $(id);
    if (!sel) continue;
    sel.addEventListener('change', () => {
      ui.setLang(sel.value);
      renderTutorialStep();
      if (run) updateHud();
    });
  }
}

// ---------- 主循环 ----------
function frame(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;
  view.time += dt;

  if (phase === 'playing' && run) {
    accumulator += dt;
    while (accumulator >= STEP) {
      run.step(STEP);
      accumulator -= STEP;
      // 键盘移动
      let kx = 0;
      let ky = 0;
      if (keys.has('ArrowLeft') || keys.has('KeyA')) kx -= 1;
      if (keys.has('ArrowRight') || keys.has('KeyD')) kx += 1;
      if (keys.has('ArrowUp') || keys.has('KeyW')) ky -= 1;
      if (keys.has('ArrowDown') || keys.has('KeyS')) ky += 1;
      if (kx || ky) {
        const s = 430 * STEP;
        run.movePlanet(kx * s, ky * s);
      }
    }
    handleEvents(run.drainEvents());
    if (run && phase === 'playing') updateHud();
  }

  // 更新粒子与震屏
  for (const f of view.fxQueue) {
    f.ttl -= dt;
    f.x += (f.vx || 0) * dt;
    f.y += (f.vy || 0) * dt;
  }
  view.fxQueue = view.fxQueue.filter((f) => f.ttl > 0);
  if (view.comboPopup) { view.comboPopup.ttl -= dt; if (view.comboPopup.ttl <= 0) view.comboPopup = null; }
  if (reduceMotion) view.shake = 0;
  else if (view.shake > 0) view.shake = Math.max(0, view.shake - dt * 16);

  try {
    renderer.draw(run ? run.state : null, dt, view);
  } catch (err) {
    console.warn('render error', err);
  }

  if (fpsSamples.length < 600 && dt > 0) fpsSamples.push(1 / dt);
  requestAnimationFrame(frame);
}

// 调试契约
window.__ll = {
  state: {
    get phase() { return phase; },
    get lang() { return i18n.lang; },
  },
  run: () => run,
  start: () => startGame(),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => restartGame(),
  home: () => goHome(),
  sim: () => (run ? run.state : null),
  save: Sdk.save.bind(Sdk),
  ui,
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return TUT_STEPS; },
    get current() { return tutorialStep >= 0 ? { step: TUT_STEPS[tutorialStep], text: tutTextFor(TUT_STEPS[tutorialStep]) } : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: () => (run ? run.state : null),
    hud: () => (run ? run.getHud() : null),
    movePlanetTo: (x, y) => (run ? run.movePlanetTo(x, y) : { ok: false }),
    movePlanet: (dx, dy) => (run ? run.movePlanet(dx, dy) : { ok: false }),
    spawn: (type, x, y) => (run ? run.spawnEntity(type, x, y) : null),
    forceScore: (s) => { if (run) { run.state.score = s | 0; } },
    kill: () => { if (run) { run.state.hp = 0; run.endRun(); } },
    fastForward: (sec) => {
      if (!run) return false;
      const n = Math.max(1, Math.round((sec || 60) * 60));
      for (let i = 0; i < n && run.state.phase === 'playing'; i += 1) run.step(1 / 60);
      return true;
    },
    startSeeded: (seed) => {
      run = createRun(seed | 0 || 1);
      view.fxQueue = [];
      view.comboPopup = null;
      setPhase('playing');
      ui.showGame();
      ui.hide('result');
      updateHud();
      return true;
    },
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    tutorialStep: () => tutorialStep,
  },
};

// ---------- 启动 ----------
bind();
syncDocumentLang();
ui.applyLang();
buildStatic();
$('btn-mute').textContent = muted ? '🔇' : '🔊';
$('btn-mute').classList.toggle('is-muted', muted);
Sdk.track('load', {});
requestAnimationFrame(frame);

function buildStatic() {
  $('btn-mute').title = t('mute');
}
