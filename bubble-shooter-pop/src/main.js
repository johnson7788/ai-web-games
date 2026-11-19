// 主入口：60Hz 固定步长 + 标题/游戏/暂停/结算 + 教程引导 + SDK 统一出口 + 调试契约
// 装配：sim(M1) / render+ui(M2) / audio(M4)。霓虹街机「BUBBLE SHOOTER POP」。
import { STEP, WORLD, GAME as G } from '../config/game.config.js';
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
let phase = 'title';          // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let fpsSamples = [];
let tutorialStep = -1;        // -1 = 未激活
let newBest = false;

const view = {
  shake: 0,
  fx: [],
};

const input = { left: false, right: false, pointerTarget: null };
let pressStart = null;

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let bestScore = Sdk.load('best', 0) | 0;
let bestStars = Sdk.load('bestStars', 0) | 0;
let tutorialDone = !!Sdk.load('tutorialDone', false);

Sdk.ready(); // 不 await，不阻塞首屏
audio.setMuted(muted);

function persist() {
  Sdk.save('muted', muted);
  Sdk.save('best', bestScore);
  Sdk.save('bestStars', bestStars);
  Sdk.save('tutorialDone', tutorialDone);
}

// ---------- 阶段状态机 ----------
function setPhase(p) { phase = p; }

function startRun(seed) {
  run = createRun({ seed: (seed ?? ((Date.now() % 2147483647) || 1)) >>> 0 });
  newBest = false;
  view.shake = 0;
  view.fx = [];
  input.left = false;
  input.right = false;
  input.pointerTarget = null;
  setPhase('playing');
  ui.showGame();
  ui.hideResult();
  updateHud();
  audio.startBgm();
  Sdk.track('start', {});
}

function startFromMenu() {
  startRun(null);
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

function restartRun() {
  const seed = run ? ((Date.now() % 2147483647) || 1) : ((Date.now() % 2147483647) || 1);
  if (tutorialStep >= 0) endTutorial();
  startRun(seed);
}

function goHome() {
  if (tutorialStep >= 0) endTutorial();
  run = null;
  setPhase('title');
  audio.stopBgm();
  ui.hideResult();
  ui.showTitle();
}

// ---------- HUD ----------
function updateHud() {
  if (!run) return;
  const h = run.getHud();
  $('hud-score').textContent = `${t('score')} ${h.score}`;
  $('hud-wave').textContent = `${t('wave')} ${h.wave}`;
  $('hud-combo').textContent = `${t('combo')} ×${h.combo}`;
  $('hud-miss').textContent = `${t('miss')} ${h.misses}/${h.missLimit}`;
  $('hud-best').textContent = `${t('best')} ${bestScore}`;
  const pips = $('hud-wavepips');
  if (+pips.dataset.n !== h.popsThisWave) {
    pips.dataset.n = h.popsThisWave;
    pips.innerHTML = '';
    for (let i = 0; i < h.popsPerWave; i += 1) {
      const d = document.createElement('span');
      d.className = 'pip' + (i < h.popsThisWave ? ' on' : '');
      pips.appendChild(d);
    }
  }
}

// ---------- 结算 ----------
function finishRun(ev) {
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  const st = run.state;
  if (st.score > bestScore) {
    bestScore = st.score;
    newBest = true;
  }
  bestStars = Math.max(bestStars, st.stars);
  persist();
  Sdk.track('fail', { score: st.score, wave: st.wave, maxCombo: st.maxCombo });

  $('result-title').textContent = t('resultTitle');
  $('result-stars').innerHTML = '★'.repeat(st.stars) + '☆'.repeat(3 - st.stars);
  const meta = [];
  meta.push(`${t('resultScore')}: ${st.score}`);
  meta.push(`${t('resultWave')}: ${st.wave - 1}`);
  meta.push(`${t('resultCombo')}: ×${st.maxCombo}`);
  meta.push(`${t('miss')}: ${st.misses}`);
  if (newBest) meta.push(`<span class="newbest">${t('newBest')}</span>`);
  $('result-meta').innerHTML = meta.join('<br>');
  $('screen-result').classList.remove('hidden');
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
  const s = steps[tutorialStep] || steps[0];
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

// ---------- 事件消费 ----------
function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    switch (ev.type) {
      case 'pop':
        view.fx.push({ kind: 'pop', bubbleKind: ev.kind, x: ev.x, y: ev.y, ttl: 0.5 });
        view.shake = 2;
        break;
      case 'hit':
        view.fx.push({ kind: 'hit', x: ev.x, y: ev.y, ttl: 0.3 });
        break;
      case 'bomb':
        view.shake = 6;
        view.fx.push({ kind: 'pop', bubbleKind: 'bomb', x: ev.x, y: ev.y, ttl: 0.55 });
        break;
      case 'miss':
        view.fx.push({ kind: 'miss', x: ev.x ?? WORLD.WIDTH / 2, y: Math.min(ev.y ?? WORLD.HEIGHT, WORLD.HEIGHT - 30), ttl: 0.6 });
        break;
      case 'powerup':
        view.fx.push({ kind: 'wave', text: ev.kind === 'rapid' ? t('powerRapid') : t('powerTriple'), ttl: 0.9 });
        break;
      case 'wave':
        view.fx.push({ kind: 'wave', text: `${t('wave')} ${ev.wave}`, ttl: 1.0 });
        break;
      case 'combo':
        view.fx.push({ kind: 'combo', text: `${t('combo')} ×${ev.combo}`, ttl: 0.9 });
        break;
      case 'lose':
        finishRun(ev);
        return;
      default:
        break;
    }
  }
}

// ---------- 输入 ----------
function canvasX(e) {
  const rect = canvas.getBoundingClientRect();
  return (e.clientX - rect.left) * (WORLD.WIDTH / rect.width);
}

function applySteer() {
  if (!run || phase !== 'playing') return;
  if (input.pointerTarget != null) {
    run.steer(input.pointerTarget);
  } else {
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    run.move(dir);
  }
}

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (!run || phase !== 'playing') return;
  const x = canvasX(e);
  input.pointerTarget = x;
  pressStart = { x, t: performance.now() };
});

canvas.addEventListener('pointermove', (e) => {
  if (input.pointerTarget == null) return;
  input.pointerTarget = canvasX(e);
});

window.addEventListener('pointerup', (e) => {
  if (input.pointerTarget == null) return;
  const dx = Math.abs(canvasX(e) - (pressStart ? pressStart.x : 0));
  const dt = performance.now() - (pressStart ? pressStart.t : 0);
  input.pointerTarget = null;
  if (run && phase === 'playing' && dx < 8 && dt < 260) run.burst();
  pressStart = null;
});

window.addEventListener('keydown', (e) => {
  audio.unlock();
  if (e.code === 'KeyA' || e.code === 'ArrowLeft') { input.left = true; input.pointerTarget = null; }
  else if (e.code === 'KeyD' || e.code === 'ArrowRight') { input.right = true; input.pointerTarget = null; }
  else if (e.code === 'Space') { e.preventDefault(); if (run && phase === 'playing') run.burst(); }
  else if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  } else if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'result')) {
    restartRun();
  } else if (e.code === 'KeyM') toggleMute();
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'KeyA' || e.code === 'ArrowLeft') input.left = false;
  if (e.code === 'KeyD' || e.code === 'ArrowRight') input.right = false;
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
  on('btn-start', startFromMenu);
  on('btn-resume', resumeGame);
  on('btn-restart', restartRun);
  on('btn-restart2', restartRun);
  on('btn-retry', restartRun);
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result') startTutorial(); });
  on('btn-tut-replay', () => { if (phase === 'paused') resumeGame(); startTutorial(); });
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
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;

  if (phase === 'playing' && run && tutorialStep < 0) {
    applySteer();
    accumulator += dt;
    while (accumulator >= STEP) {
      run.step(STEP);
      accumulator -= STEP;
    }
    handleEvents(run.drainEvents());
    if (run && phase === 'playing') updateHud();
  }

  if (view.shake > 0) view.shake = Math.max(0, view.shake - dt * 20);
  for (const fx of view.fx) fx.ttl -= dt;
  view.fx = view.fx.filter((fx) => fx.ttl > 0);

  try {
    renderer.draw(phase === 'title' ? null : (run ? run.state : null), dt, view);
  } catch (err) {
    console.warn('render error', err);
  }

  if (fpsSamples.length < 600 && dt > 0) fpsSamples.push(1 / dt);
}

// ---------- 调试契约 ----------
window.__ll = {
  state: {
    get phase() { return phase; },
    get lang() { return i18n.lang; },
  },
  get run() { return run; },
  start: (i) => startRun(i == null ? 0 : (i | 0)),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => restartRun(),
  home: () => goHome(),
  sim: () => (run ? run.state : null),
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['move', 'aim', 'wave']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
    next: () => tutorialNext(),
  },
  startTutorial: () => startTutorial(),
  save: (k, v) => Sdk.save(k, v),
  ui,
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: () => (run ? run.state : null),
    startSeeded: (i, seed) => startRun(seed | 0),
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    spawnBubble: (kind, x) => (run ? run.spawnBubble(kind, x) : { ok: false }),
    spawnPowerup: (kind, x) => (run ? run.spawnPowerup(kind, x) : { ok: false }),
    fastForward: () => {
      if (!run) return false;
      let guard = 6000;
      while (guard-- > 0 && run.state.phase === 'playing') {
        run.step(0.05);
        handleEvents(run.drainEvents());
      }
      return true;
    },
    giveUp: () => window.__ll.debug.fastForward(),
  },
};

// ---------- 启动 ----------
bind();
syncDocumentLang();
ui.applyLang();
$('btn-mute').classList.toggle('is-muted', muted);
Sdk.track('load', {});
requestAnimationFrame(frame);
