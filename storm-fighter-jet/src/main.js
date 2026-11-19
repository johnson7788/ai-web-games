// 主入口：60Hz 固定步长 + 标题/游戏/暂停/结算 + 教程引导 + SDK 统一出口
// 装配：sim / render+ui / audio / sdk。职责：ui.js 只做语言与屏幕显隐；HUD/结算/教程 DOM 这里直写。
import { STEP, GAME } from '../config/game.config.js';
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
let fpsSamples = [];
let tutorialStep = -1;     // -1 = 未激活
let mutePress = false;

const view = {
  cursor: { x: 0, y: 0 },
  fxQueue: [],
  shake: 0,
  flash: 0,
};

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let best = Sdk.load('best', 0) | 0;
let tutorialDone = !!Sdk.load('tutorialDone', false);

Sdk.ready(); // 不 await，不阻塞首屏
audio.setMuted(muted);

function persist() {
  Sdk.save('best', best);
  Sdk.save('muted', muted);
  Sdk.save('tutorialDone', tutorialDone);
}

// ---------- 阶段状态机 ----------
function setPhase(p) { phase = p; }

function startLevel() {
  run = createRun((Date.now() % 2147483647) || 1);
  setPhase('playing');
  ui.showGame();
  hideResult();
  {
    const h = document.getElementById('action-hint');
    if (h) { h.classList.remove('hidden'); h.textContent = t('actionHint'); h.style.opacity = '1'; clearTimeout(h._t); h._t = setTimeout(() => { h.style.opacity = '0'; }, 6000); }
  }
  updateHud();
  audio.startBgm();
  Sdk.newRun({ level: 1 });
  Sdk.track('start', {});
  if (!tutorialDone) startTutorial();
}

function pauseGame(silent) {
  if (phase !== 'playing') return;
  setPhase('paused');
  audio.stopBgm();
  if (!silent) ui.showPause();
}

function resumeGame() {
  if (phase !== 'paused') return;
  setPhase('playing');
  ui.hidePause();
  audio.startBgm();
}

function restartLevel() {
  startLevel();
}

function goHome() {
  run = null;
  setPhase('title');
  hideResult();
  ui.showTitle();
  $('best-value').textContent = best;
  endTutorial();
}

// ---------- HUD / 结算 ----------
function updateHud() {
  if (!run) return;
  const h = run.getHud();
  $('hud-level').textContent = `${t('level')} ${h.level}`;
  $('hud-score').textContent = `${t('score')} ${h.score}`;
  $('hud-best').textContent = `${t('best')} ${best}`;
  $('hud-combo').textContent = h.comboMult > 1 ? `×${h.comboMult} ${t('combo')}` : t('combo');
  $('hud-threats').textContent = `${t('threats')} ${h.threats}`;
  const sh = $('hud-shield');
  sh.textContent = h.shield ? `${t('shield')} ✓` : t('shield');
  sh.classList.toggle('shield-on', !!h.shield);
}

function showResult(res) {
  const stars = res.stars || 0;
  $('result-stars').innerHTML = '★'.repeat(stars) + '<span class="off">' + '★'.repeat(3 - stars) + '</span>';
  $('result-score').textContent = `${t('finalScore')}  ${res.score}`;
  $('result-meta').textContent = res.isNewBest ? t('newBest') : '';
  $('screen-result').classList.remove('hidden');
}

function hideResult() {
  $('screen-result').classList.add('hidden');
}

function finishRun(ev) {
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  const score = Math.floor(ev.score ?? run.state.score);
  const isNewBest = score > best && score > 0;
  if (isNewBest) best = score;
  persist();
  Sdk.gameOver({ score, stars: ev.stars || 0, level: ev.level || run.state.level });
  showResult({ score, stars: ev.stars || 0, isNewBest });
}

// ---------- 教程 ----------
const TUT_STEPS = () => [
  { text: t('tutStep1') },
  { text: t('tutStep2') },
  { text: t('tutStep3') },
];

function startTutorial() {
  tutorialStep = 0;
  renderTutorialStep();
}

function renderTutorialStep() {
  const el = $('tutorial');
  if (tutorialStep < 0) { el.classList.add('hidden'); return; }
  const steps = TUT_STEPS();
  const s = steps[tutorialStep] || steps[steps.length - 1];
  el.classList.remove('hidden');
  $('tut-title').textContent = t('tutTitle');
  $('tut-text').textContent = s.text;
  $('tut-skip').textContent = t('tutSkip');
  $('tut-next').textContent = t('tutNext');
}

function tutorialNext() {
  tutorialStep += 1;
  if (tutorialStep >= TUT_STEPS().length) endTutorial();
  else renderTutorialStep();
}

function endTutorial() {
  tutorialStep = -1;
  tutorialDone = true;
  persist();
  renderTutorialStep();
}

function tutorialAdvance(evType) {
  if (tutorialStep === 0 && evType === 'steer') tutorialNext();
}

// ---------- 事件消费 ----------
function spawnBurst(x, y, color, n) {
  for (let i = 0; i < n; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const sp = 40 + Math.random() * 120;
    view.fxQueue.push({
      x, y, r: 2 + Math.random() * 3, color,
      ttl: 0.35 + Math.random() * 0.35, age: 0,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
    });
  }
}

function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    tutorialAdvance(ev.type);
    switch (ev.type) {
      case 'explosion':
        spawnBurst(ev.x || run.state.plane.x, ev.y || run.state.plane.y, '#ffd84e', 14);
        view.shake = Math.max(view.shake, 4);
        break;
      case 'shieldBreak':
        spawnBurst(run.state.plane.x, run.state.plane.y, '#52f2ff', 18);
        view.shake = Math.max(view.shake, 7);
        break;
      case 'die':
        spawnBurst(run.state.plane.x, run.state.plane.y, '#ff4d5e', 26);
        view.shake = 12;
        view.flash = 0.5;
        break;
      case 'nearMiss':
        view.flash = Math.max(view.flash, 0.12);
        break;
      case 'coin':
        spawnBurst(run.state.plane.x, run.state.plane.y, '#ffd84e', 6);
        break;
      case 'levelUp':
        view.flash = Math.max(view.flash, 0.2);
        break;
      case 'over':
        finishRun(ev);
        return;
      default:
        break;
    }
  }
}

// ---------- 输入 ----------
let pointerAnchor = null;

function steerFromPointer(x, y) {
  const dx = x - pointerAnchor.x;
  const dy = y - pointerAnchor.y;
  if (Math.hypot(dx, dy) > 10) run.steer(dx, dy);
  else run.state.plane.target = null;
}

function canvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (1280 / rect.width),
    y: (e.clientY - rect.top) * (720 / rect.height),
  };
}

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (!run || phase !== 'playing') return;
  const p = canvasPos(e);
  pointerAnchor = p;
  canvas.setPointerCapture?.(e.pointerId);
});

canvas.addEventListener('pointermove', (e) => {
  const p = canvasPos(e);
  view.cursor = p;
  if (pointerAnchor && run && phase === 'playing') steerFromPointer(p.x, p.y);
});

function clearPointer(e) {
  pointerAnchor = null;
  if (run) run.state.plane.target = null;
}
canvas.addEventListener('pointerup', clearPointer);
canvas.addEventListener('pointercancel', clearPointer);

const keys = new Set();
const KEY_DIRS = {
  ArrowLeft: [-1, 0], KeyA: [-1, 0],
  ArrowRight: [1, 0], KeyD: [1, 0],
  ArrowUp: [0, -1], KeyW: [0, -1],
  ArrowDown: [0, 1], KeyS: [0, 1],
};
function applyKeys() {
  if (!run || phase !== 'playing') return;
  let dx = 0, dy = 0;
  for (const k of keys) {
    const d = KEY_DIRS[k];
    if (d) { dx += d[0]; dy += d[1]; }
  }
  if (dx !== 0 || dy !== 0) run.steer(dx, dy);
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
    return;
  }
  if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'result')) { restartLevel(); return; }
  if (e.code === 'KeyM') { toggleMute(); return; }
  if (KEY_DIRS[e.code]) { keys.add(e.code); e.preventDefault(); applyKeys(); }
});
window.addEventListener('keyup', (e) => {
  if (keys.delete(e.code)) applyKeys();
});

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  $('btn-mute').classList.toggle('is-muted', muted);
  persist();
}

// ---------- UI 绑定 ----------
function bind() {
  const on = (id, fn) => {
    const el = $(id);
    if (el) el.addEventListener('click', () => { audio.unlock(); fn(); });
  };
  on('btn-start', startLevel);
  on('btn-resume', resumeGame);
  on('btn-restart', restartLevel);
  on('btn-restart2', restartLevel);
  on('btn-retry', restartLevel);
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result') startTutorial(); });
  on('btn-howto-title', () => startTutorial());
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);

  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = $(id);
    if (!sel) continue;
    sel.addEventListener('change', () => {
      ui.setLang(sel.value);
      renderTutorialStep();
      if (run) updateHud();
      const rt = $('rotate-text');
      const rb = $('btn-rotate-skip');
      if (rt) rt.textContent = t('rotateHint');
      if (rb) rb.textContent = t('rotateSkip');
    });
  }
}

// ---------- 主循环 ----------
function frame(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;

  if (phase === 'playing' && run) {
    accumulator += dt;
    while (accumulator >= STEP) {
      run.step(STEP);
      accumulator -= STEP;
    }
    handleEvents(run.drainEvents());
    if (run && phase === 'playing') updateHud();
  }

  if (view.shake > 0) view.shake = Math.max(0, view.shake - dt * 24);
  if (view.flash > 0) view.flash = Math.max(0, view.flash - dt);
  for (const fx of view.fxQueue) {
    fx.age += dt;
    fx.x += (fx.vx || 0) * dt;
    fx.y += (fx.vy || 0) * dt;
  }
  view.fxQueue = view.fxQueue.filter((fx) => fx.age < fx.ttl);

  try {
    renderer.draw(run ? run.state : null, dt, view);
  } catch (err) {
    console.warn('render error', err);
  }

  if (fpsSamples.length < 600 && dt > 0) fpsSamples.push(1 / dt);
  requestAnimationFrame(frame);
}

// ---------- 调试契约 ----------
window.__ll = {
  state: {
    get phase() { return phase; },
    get lang() { return i18n.lang; },
  },
  run: () => run,
  start: () => startLevel(),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => restartLevel(),
  home: () => goHome(),
  sim: () => (run ? run.state : null),
  save: (key, value) => Sdk.save(key, value),
  ui: () => ui,
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['steer', 'collect', 'dodge']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: () => {
      if (!run) return null;
      const s = run.state;
      return {
        phase: s.phase, level: s.level, score: Math.floor(s.score), combo: s.combo,
        comboMult: s.comboMult, shield: s.shield, time: s.time,
        missiles: s.missiles.length, rocks: s.rocks.length, coins: s.coins.length, shields: s.shields.length,
      };
    },
    die: () => { if (run && phase === 'playing') run._die(); },
    setLevel: (n) => {
      if (!run) return false;
      run.state.level = Math.max(1, n | 0);
      run._levelConfig();
      return true;
    },
    spawnRock: () => { if (run) { run._spawnRock(); return true; } return false; },
    spawnCoins: (n) => {
      if (!run) return false;
      for (let i = 0; i < (n || 8); i += 1) run.state.coins.push({
        x: 200 + Math.random() * (1280 - 400), y: 120 + Math.random() * (720 - 240),
        vx: 0, vy: 0,
      });
      return true;
    },
    startSeeded: (seed) => {
      run = createRun(seed | 0 || 1);
      setPhase('playing');
      ui.showGame();
      hideResult();
      updateHud();
      return true;
    },
    fastForward: (sec) => {
      if (!run) return false;
      let guard = Math.ceil((sec || 10) / 0.5) * 2;
      while (guard-- > 0 && run.state.phase === 'playing') {
        run.step(0.5);
        handleEvents(run.drainEvents());
      }
      if (run.state.phase === 'playing') updateHud();
      return true;
    },
  },
};

// ---------- 启动 ----------
bind();
syncDocumentLang();
ui.applyLang();
{
  const rt = $('rotate-text');
  const rb = $('btn-rotate-skip');
  if (rt) rt.textContent = t('rotateHint');
  if (rb) rb.textContent = t('rotateSkip');
}
$('best-value').textContent = best;
$('btn-mute').classList.toggle('is-muted', muted);
Sdk.track('load', {});
requestAnimationFrame(frame);
