// src/main.js — 主入口：60Hz 固定步长装配 sim/render/ui/audio/sdk + 调试契约。
import { STEP, WORLD, GAME } from '../config/game.config.js';
import { createRun } from './game/sim.js';
import { createRenderer } from './render/index.js';
import { ui } from './ui/ui.js';
import { i18n } from './core/i18n.js';
import { LEVELS } from '../config/levels.js';
import Sdk from './core/sdk.js';
import { createAudio } from './core/audio.js';

const canvas = document.getElementById('canvas');
const container = document.getElementById('game-container');
const renderer = createRenderer(canvas);
const audio = createAudio();
ui.init();

const reducedMotion = typeof matchMedia === 'function'
  && matchMedia('(prefers-reduced-motion: reduce)').matches;

let phase = 'title'; // title | playing | paused | result
let run = null;
let levelIndex = 0;
let accumulator = 0;
let lastNow = performance.now();
let ended = false;

const tutorial = { active: false, step: 0, steps: [] };
const previewState = createRun(0).state; // 标题屏静态场景

// ---- 存档（Sdk 封装，localStorage 仅降级） ----
function loadNum(key, fallback) {
  const v = Sdk.load(key, fallback);
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}
function store(key, value) { Sdk.save(key, value); }
function tutorialDone() { return Sdk.load(GAME.TUTORIAL_KEY, false) === true; }
function markTutorialDone() { store(GAME.TUTORIAL_KEY, true); }

const SOIL_COLOR = '#3b4fd8';
const ROCK_COLOR = '#ff2d78';
const GEM_COLOR = '#ffd23e';

function shake() {
  if (reducedMotion) return;
  container.style.transform = 'translate(-3px, 0)';
  setTimeout(() => { container.style.transform = 'translate(3px, 0)'; }, 30);
  setTimeout(() => { container.style.transform = ''; }, 60);
}

// ---- 教程 ----
function updateTutCard() {
  const el = ui.el;
  el['tut-text'].textContent = tutorial.steps[tutorial.step] || '';
  el['tut-next'].textContent = tutorial.step >= tutorial.steps.length - 1 ? i18n.get('start') : i18n.get('tutNext');
  positionSpotlight();
}

function positionSpotlight() {
  const spot = ui.el['tut-spotlight'];
  if (!run || !spot) return;
  const st = run.state;
  let wx;
  let wy;
  let w = 120;
  let h = 120;
  if (tutorial.step === 0) { wx = st.level.startX; wy = st.level.startY; }
  else if (tutorial.step === 1) {
    const rock = st.level.rocks[0] || { x: 300, y: 300 };
    wx = rock.x; wy = rock.y; w = 130; h = 130;
  } else { wx = st.level.goalX; wy = st.level.goalY; w = 140; h = 140; }
  const cRect = canvas.getBoundingClientRect();
  const gRect = container.getBoundingClientRect();
  const sx = cRect.width / WORLD.WIDTH;
  const sy = cRect.height / WORLD.HEIGHT;
  spot.style.left = `${(cRect.left - gRect.left) + (wx - w / 2) * sx}px`;
  spot.style.top = `${(cRect.top - gRect.top) + (wy - h / 2) * sy}px`;
  spot.style.width = `${w * sx}px`;
  spot.style.height = `${h * sy}px`;
}

function showTutorial() {
  tutorial.active = true;
  tutorial.step = 0;
  tutorial.steps = [i18n.get('tutStep1'), i18n.get('tutStep2'), i18n.get('tutStep3')];
  ui.el['tutorial'].classList.remove('hidden');
  updateTutCard();
}

function finishTutorial() {
  tutorial.active = false;
  ui.el['tutorial'].classList.add('hidden');
  markTutorialDone();
}

function advanceTutorial() {
  tutorial.step += 1;
  if (tutorial.step >= tutorial.steps.length) { finishTutorial(); return; }
  updateTutCard();
}

// ---- 关卡 / 状态 ----
function startLevel(i, opts = {}) {
  levelIndex = ((i % LEVELS.length) + LEVELS.length) % LEVELS.length;
  run = createRun(levelIndex);
  ended = false;
  renderer.particles.length = 0;
  phase = 'playing';
  ui.showGame();
  audio.startBgm();
  Sdk.newRun({ level: levelIndex + 1 });
  if (opts.tutorial) showTutorial();
}

function startGame() {
  if (!tutorialDone()) startLevel(0, { tutorial: true });
  else startLevel(Math.min(loadNum('bestLevel', 0), LEVELS.length - 1));
}

function restart() { startLevel(levelIndex); }

function pause() {
  if (phase === 'playing') { phase = 'paused'; ui.showPause(); }
}

function resume() {
  if (phase === 'paused') { phase = 'playing'; ui.hidePause(); lastNow = performance.now(); }
}

function home() {
  phase = 'title';
  ui.showTitle();
  audio.stopBgm();
}

function nextLevel() {
  if (levelIndex >= LEVELS.length - 1) { home(); return; }
  startLevel(levelIndex + 1);
}

function toggleMute() {
  const m = audio.setMuted(!audioMuted());
  store('muted', m);
  ui.setMuteIcon(m);
}
function audioMuted() { return Sdk.load('muted', false) === true; }

function onWin() {
  const s = run.state;
  const stars = loadNum('stars', [0, 0, 0, 0]);
  stars[s.levelIndex] = Math.max(stars[s.levelIndex] || 0, s.stars);
  store('stars', stars);
  store('bestLevel', Math.max(loadNum('bestLevel', 0), s.levelIndex + 1));
  store('best', Math.max(loadNum('best', 0), s.score));
  store('totalStars', stars.reduce((a, b) => a + b, 0));
  Sdk.levelCleared({ level: s.levelIndex + 1, stars: s.stars, score: s.score });
}

function onEnd() {
  ended = true;
  const s = run.state;
  if (s.phase === 'won') onWin();
  else Sdk.gameOver({ level: s.levelIndex + 1, reason: s.loseReason });
  phase = 'result';
  audio.stopBgm();
  const isNewBest = s.phase === 'won' && s.score > 0 && s.score >= loadNum('best', 0);
  const meta = s.phase === 'won'
    ? `${i18n.get('resultTime', { s: Math.round(s.time) })} · ${i18n.get('resultGems', { g: s.gemsCollected, t: s.gemsTotal })} · ${i18n.get('score')} ${s.score}${isNewBest ? ` · ${i18n.get('newBest')}` : ''}`
    : (s.loseReason === 'timeOut' ? i18n.get('timeOut') : i18n.get('fellOut'));
  ui.showResult(s.stars, { phase: s.phase }, meta);
}

function drainEvents() {
  if (!run) return;
  for (const e of run.drainEvents()) {
    switch (e.type) {
      case 'start': audio.event('start'); break;
      case 'carve':
        audio.event('carve');
        renderer.burst(e.x, e.y, SOIL_COLOR, reducedMotion ? 3 : 7, 150);
        break;
      case 'rock':
        audio.event('rock');
        renderer.burst(e.x, e.y, ROCK_COLOR, reducedMotion ? 4 : 12, 220);
        shake();
        break;
      case 'gem':
        audio.event('gem');
        renderer.burst(e.x, e.y, GEM_COLOR, reducedMotion ? 6 : 16, 200);
        break;
      case 'combo': audio.event('combo'); break;
      case 'fall': audio.event('fall'); break;
      case 'win': audio.event('win'); break;
      case 'lose': audio.event('lose'); break;
      default: break;
    }
  }
}

function stepOnce() {
  run.step(STEP);
  drainEvents();
  if (run.state.phase !== 'playing' && !ended) onEnd();
}

// ---- 输入：拖动挖隧道 ----
function clientToWorld(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left) / rect.width * WORLD.WIDTH,
    y: (clientY - rect.top) / rect.height * WORLD.HEIGHT,
  };
}

let pointerDown = false;
canvas.addEventListener('pointerdown', (e) => {
  if (phase !== 'playing' || tutorial.active) return;
  pointerDown = true;
  canvas.setPointerCapture?.(e.pointerId);
  const p = clientToWorld(e.clientX, e.clientY);
  run.carve(p.x, p.y);
});
canvas.addEventListener('pointermove', (e) => {
  if (!pointerDown || phase !== 'playing' || tutorial.active) return;
  const p = clientToWorld(e.clientX, e.clientY);
  run.carve(p.x, p.y);
});
window.addEventListener('pointerup', () => { pointerDown = false; });
canvas.addEventListener('pointercancel', () => { pointerDown = false; });

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') {
    if (phase === 'playing') pause();
    else if (phase === 'paused') resume();
  }
  if (e.code === 'KeyR' || e.code === 'Space') {
    if (phase === 'playing' || phase === 'paused' || phase === 'result') {
      if (phase === 'paused') { resume(); }
      restart();
      e.preventDefault();
    }
  }
});

// ---- UI 绑定 ----
ui.el['btn-start'].addEventListener('click', startGame);
ui.el['btn-resume'].addEventListener('click', resume);
ui.el['btn-restart'].addEventListener('click', restart);
ui.el['btn-restart2'].addEventListener('click', () => { resume(); restart(); });
ui.el['btn-home'].addEventListener('click', home);
ui.el['btn-home3'].addEventListener('click', home);
ui.el['btn-home2'].addEventListener('click', home);
ui.el['btn-retry'].addEventListener('click', restart);
ui.el['btn-next'].addEventListener('click', nextLevel);
ui.el['btn-mute'].addEventListener('click', toggleMute);
ui.el['btn-howto'].addEventListener('click', () => { if (phase === 'playing') showTutorial(); });
ui.el['btn-tut-replay'].addEventListener('click', () => { if (phase === 'paused') { resume(); showTutorial(); } });
ui.el['tut-next'].addEventListener('click', advanceTutorial);
ui.el['tut-skip'].addEventListener('click', finishTutorial);
for (const sel of [ui.el['lang-select'], ui.el['lang-select-pause']]) {
  if (sel) sel.addEventListener('change', (e) => ui.setLang(e.target.value));
}

// ---- 主循环 ----
function loop(now) {
  requestAnimationFrame(loop);
  let dt = Math.min((now - lastNow) / 1000, 0.1);
  lastNow = now;

  if (phase === 'playing') {
    if (!tutorial.active) {
      accumulator += dt;
      while (accumulator >= STEP) { stepOnce(); accumulator -= STEP; if (phase !== 'playing') break; }
    }
    renderer.render(run.state, tutorial.active ? 0 : dt, run.state.time);
    ui.updateHUD(run.getHud());
  } else if (phase === 'paused' || phase === 'result') {
    renderer.render(run ? run.state : previewState, 0, run ? run.state.time : 0);
  } else {
    renderer.render(previewState, dt, now / 1000);
  }
}

// ---- 调试契约 ----
function debugCarveRect(x0, y0, x1, y1) {
  if (!run) return 0;
  let n = 0;
  const step = 16;
  const x0n = Math.min(x0, x1);
  const x1n = Math.max(x0, x1);
  const y0n = Math.min(y0, y1);
  const y1n = Math.max(y0, y1);
  for (let y = y0n; y <= y1n; y += step) {
    for (let x = x0n; x <= x1n; x += step) {
      const r = run.carve(x, y);
      if (r.ok) n += 1;
    }
  }
  return n;
}

window.__ll = {
  get state() { return { phase, lang: ui.lang, dir: ui.dir }; },
  lang: () => ui.lang,
  setLang: (lang) => ui.setLang(lang),
  get run() { return run; },
  start: (n) => startLevel(n == null ? levelIndex : n),
  startAct: (n) => startLevel(n == null ? levelIndex : n),
  startTutorial: () => showTutorial(),
  pause,
  resume,
  restart,
  home,
  save: () => Sdk,
  ui: () => ui,
  tutorial: {
    get active() { return tutorial.active; },
    get step() { return tutorial.step; },
    get steps() { return tutorial.steps; },
    get current() { return tutorial.steps[tutorial.step] || null; },
    skip: finishTutorial,
  },
  debug: {
    state: () => run ? run.state : null,
    loadLevel: (n) => startLevel(n),
    carve: (x, y) => run && run.carve(x, y),
    carveRect: debugCarveRect,
    step: (dt) => run && run.step(dt),
    winNow: () => {
      if (!run) return;
      run.state.phase = 'won';
      run.state.stars = 3;
      run.state.score = Math.max(run.state.score, 300);
      run.state.events.push({ type: 'win', t: run.state.time, stars: 3, score: run.state.score, gems: run.state.gemsTotal });
    },
  },
};

window.G = {
  get sim() { return run; },
  state: () => phase,
  ui,
  audio,
  createRun,
};

// ---- 启动 ----
ui.applyLang();
ui.showTitle();
if (audioMuted()) { audio.setMuted(true); ui.setMuteIcon(true); }
requestAnimationFrame(loop);
Sdk.ready();
