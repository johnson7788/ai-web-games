// 主入口：60Hz 固定步长 + 标题/游戏/暂停/结算 + 教程引导 + SDK 统一出口
// 契约见 docs/batch3/draw-truck-path.md。装配：sim / render / ui / audio。
import { STEP, GAME, WORLD } from '../config/game.config.js';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';
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

const reducedMotion = typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let run = null;
let phase = 'title'; // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let fpsSamples = [];
let tutorialStep = -1;
let muted = false;
let unlocked = 1;
let starsByLevel = {};
let tutorialDone = false;
let lastLevel = 0;

const view = { shake: 0 };

// ---------- 存档（统一走 Sdk） ----------
muted = !!Sdk.load('muted', false);
unlocked = Math.max(1, Sdk.load('unlocked', 1) | 0);
starsByLevel = Sdk.load('stars', {}) || {};
tutorialDone = !!Sdk.load('tutorialDone', false);
lastLevel = Sdk.load('lastLevel', 0) | 0;

Sdk.ready();
Sdk.onAdStart(() => { if (phase === 'playing') pauseGame(); });
Sdk.onAdEnd(() => { if (phase === 'paused') resumeGame(); });
audio.setMuted(muted);

function persist() {
  Sdk.save('unlocked', unlocked);
  Sdk.save('stars', starsByLevel);
  Sdk.save('muted', muted);
  Sdk.save('tutorialDone', tutorialDone);
  Sdk.save('lastLevel', lastLevel);
}

function totalStars() {
  return Object.values(starsByLevel).reduce((a, b) => a + (b | 0), 0);
}

// ---------- 阶段状态机 ----------
function setPhase(p) { phase = p; }

function startLevel(idx) {
  idx = Math.max(0, Math.min(LEVEL_COUNT - 1, idx | 0));
  lastLevel = idx;
  run = createRun(idx, { seed: (Date.now() % 2147483647) || 1 });
  setPhase('playing');
  view.shake = 0;
  ui.showGame();
  ui.hideResult();
  updateHud();
  audio.startBgm();
  Sdk.track('start', { level: idx + 1 });
  if (!tutorialDone && idx === 0) startTutorial();
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

function restartLevel() {
  if (run) Sdk.track('restart', { level: run.state.level });
  startLevel(run ? run.state.level - 1 : lastLevel);
}

function goHome() {
  run = null;
  setPhase('title');
  ui.hideResult();
  ui.showTitle();
  buildLevelGrid();
}

// ---------- HUD / 关卡格 / 结算 ----------
function updateHud() {
  if (!run) return;
  const h = run.getHud();
  const lv = LEVELS[run.state.level - 1] || {};
  $('hud-level').textContent = `${t('level')} ${run.state.level}${lv.name ? ' · ' + (lv.name[i18n.lang] || lv.name.en || '') : ''}`;
  $('hud-time').textContent = Math.max(0, Math.ceil(h.timeLeft)) + 's';
  $('hud-time').classList.toggle('time-low', h.timeLeft <= 10);
  $('hud-ink').textContent = `${t('ink')}: ${h.ink}`;
  const coresEl = $('hud-cores');
  coresEl.textContent = `◈ ${h.collected}/${h.totalCores}`;
  coresEl.style.display = h.totalCores > 0 ? '' : 'none';
  $('btn-mute').textContent = muted ? '🔇' : '🔊';
}

function buildLevelGrid() {
  const grid = $('level-grid');
  if (!grid) return;
  grid.innerHTML = '';
  for (let i = 0; i < LEVEL_COUNT; i += 1) {
    const cell = document.createElement('button');
    cell.className = 'level-cell' + (i + 1 > unlocked ? ' locked' : '');
    cell.dataset.level = i;
    const s = starsByLevel[i + 1] | 0;
    cell.innerHTML = `<span class="lv-num">${i + 1}</span><span class="lv-stars">${'★'.repeat(s)}${'☆'.repeat(3 - s)}</span>`;
    cell.setAttribute('aria-label', `${t('level')} ${i + 1}${i + 1 > unlocked ? ' ' + t('locked') : ''}`);
    grid.appendChild(cell);
  }
  $('stars-total').textContent = `★ ${totalStars()} / ${LEVEL_COUNT * 3}`;
}

function showResult(ev) {
  const won = ev.type === 'win';
  const stars = won ? (ev.stars || run.state.stars || 1) : 0;
  $('result-title').textContent = won ? t('winTitle') : t('loseTitle');
  $('result-title').classList.toggle('lose', !won);
  const starsEl = $('result-stars');
  starsEl.innerHTML = won
    ? `<span class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>${stars >= 3 ? `<em>${t('perfect')}</em>` : ''}`
    : '';
  const reason = ev.reason || null;
  $('result-meta').textContent = won
    ? t('starsEarned', { n: stars })
    : (reason === 'spark' ? t('loseSpark') : reason === 'time' ? t('loseTime') : t('loseFell'));
  $('btn-next').style.display = (won && run.state.level < LEVEL_COUNT) ? '' : 'none';
  ui.showResult();
}

function finishRun(ev) {
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  const won = ev.type === 'win';
  const stars = won ? (ev.stars || run.state.stars || 1) : 0;
  if (won) {
    const idx = run.state.level;
    starsByLevel[idx] = Math.max(starsByLevel[idx] | 0, stars);
    if (idx < LEVEL_COUNT) unlocked = Math.max(unlocked, idx + 1);
    buildLevelGrid();
  }
  persist();
  Sdk.track(won ? 'win' : 'fail', { level: run.state.level, stars, reason: ev.reason || null });
  showResult(ev);
  audio.event(won ? 'win' : 'lose');
}

// ---------- 教程引导（首次自动弹，可跳过，完成/跳过后持久化不再自动弹） ----------
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
  const s = steps[tutorialStep];
  el.classList.remove('hidden');
  $('tut-title').textContent = t('tutTitle');
  $('tut-text').textContent = s ? s.text : '';
  $('tut-skip').textContent = t('tutSkip');
  $('tut-next').textContent = t('tutNext');
  const spot = $('tut-spotlight');
  spot.style.display = 'none';
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

// 教学步骤推进（真实动作驱动）：0=draw 1=drive/launch 2=win
function tutorialAdvance(evType) {
  if (tutorialStep < 0 || tutorialStep >= 3) return;
  if (tutorialStep === 0 && evType === 'draw') { tutorialStep = 1; renderTutorialStep(); return; }
  if (tutorialStep === 1 && (evType === 'drive' || evType === 'launch')) { tutorialStep = 2; renderTutorialStep(); return; }
  if (tutorialStep === 2 && evType === 'win') endTutorial();
}

function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    tutorialAdvance(ev.type);
    switch (ev.type) {
      case 'draw':
        view.shake = 2;
        break;
      case 'pickup':
        view.shake = 3;
        break;
      case 'nearMiss':
        view.shake = 1;
        break;
      case 'win':
      case 'lose':
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

let drawing = false;
canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (!run || phase !== 'playing') return;
  const p = canvasPos(e);
  if (run.beginStroke(p.x, p.y).ok) { drawing = true; canvas.setPointerCapture(e.pointerId); }
});

canvas.addEventListener('pointermove', (e) => {
  if (!drawing || !run || phase !== 'playing') return;
  const p = canvasPos(e);
  run.moveStroke(p.x, p.y);
});

function endDraw() {
  if (!drawing || !run) return;
  drawing = false;
  run.endStroke();
  updateHud();
}
canvas.addEventListener('pointerup', endDraw);
canvas.addEventListener('pointercancel', endDraw);

function setDrive(dir) {
  if (!run || phase !== 'playing') return;
  run.setDrive(dir);
}

function bindDriveButtons() {
  const on = (id, dir) => {
    const el = $(id);
    if (!el) return;
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); audio.unlock(); setDrive(dir); });
    el.addEventListener('pointerup', () => setDrive(0));
    el.addEventListener('pointercancel', () => setDrive(0));
    el.addEventListener('pointerleave', () => setDrive(0));
  };
  on('btn-left', -1);
  on('btn-right', 1);
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
  if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'result')) restartLevel();
  if (e.code === 'KeyM') toggleMute();
  if (e.code === 'KeyA' || e.code === 'ArrowLeft') { setDrive(-1); e.preventDefault(); }
  if (e.code === 'KeyD' || e.code === 'ArrowRight') { setDrive(1); e.preventDefault(); }
  if (e.code === 'Space') {
    e.preventDefault();
    if (run && phase === 'playing') setDrive(run.state.inputDir === 0 ? 1 : 0);
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'KeyA' || e.code === 'ArrowLeft') setDrive(0);
  if (e.code === 'KeyD' || e.code === 'ArrowRight') setDrive(0);
});

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  $('btn-mute').textContent = muted ? '🔇' : '🔊';
  persist();
}

// ---------- UI 绑定 ----------
function bind() {
  const on = (id, fn) => {
    const el = $(id);
    if (el) el.addEventListener('click', () => { audio.unlock(); fn(); });
  };
  on('btn-start', () => startLevel(lastLevel || 0));
  on('btn-resume', resumeGame);
  on('btn-restart', restartLevel);
  on('btn-restart2', restartLevel);
  on('btn-retry', restartLevel);
  on('btn-next', () => startLevel(run ? run.state.level : lastLevel + 1));
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-tut-replay', () => { if (phase === 'paused') resumeGame(); if (phase === 'playing' || phase === 'result') startTutorial(); });
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result') startTutorial(); });
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);

  $('level-grid')?.addEventListener('click', (e) => {
    const idx = e.target.closest('[data-level]')?.dataset.level;
    if (idx == null) return;
    const i = +idx;
    if (i + 1 > unlocked) return;
    startLevel(i);
  });

  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = $(id);
    if (!sel) continue;
    sel.addEventListener('change', () => {
      ui.setLang(sel.value);
      renderTutorialStep();
      buildLevelGrid();
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

  if (view.shake > 0) view.shake = Math.max(0, view.shake - dt * 20);

  const drawNow = reducedMotion ? 0 : performance.now();
  try {
    renderer.draw(phase === 'title' ? null : (run ? run.state : null), drawNow, view);
  } catch (err) {
    console.warn('render error', err);
  }

  if (fpsSamples.length < 600 && dt > 0) fpsSamples.push(1 / dt);
  requestAnimationFrame(frame);
}

// ---------- 调试契约 ----------
const SOLUTIONS = [
  [{ x: 200, y: 470 }, { x: 1085, y: 470 }],
  [{ x: 200, y: 470 }, { x: 520, y: 250 }, { x: 760, y: 250 }, { x: 1085, y: 470 }],
  [{ x: 200, y: 470 }, { x: 350, y: 260 }, { x: 560, y: 260 }, { x: 700, y: 540 }, { x: 860, y: 540 }, { x: 1085, y: 470 }],
];

window.__ll = {
  state: {
    get phase() { return phase; },
    get lang() { return i18n.lang; },
  },
  run: () => run,
  start: (i) => startLevel(i == null ? (lastLevel || 0) : i),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => restartLevel(),
  home: () => goHome(),
  sim: () => (run ? run.state : null),
  save: (k, v) => Sdk.save(k, v),
  load: (k, f) => Sdk.load(k, f),
  ui: () => ui,
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['draw', 'drive', 'win']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: () => {
      if (!run) return null;
      const st = run.state;
      return {
        ...st,
        truck: { ...st.truck },
        trackCount: st.tracks.length,
        beamCount: st.beams.length,
        coreCount: st.cores.length,
      };
    },
    loadLevel: (i) => startLevel(i),
    startSeeded: (i, seed) => {
      const idx = Math.max(0, Math.min(LEVEL_COUNT - 1, i | 0));
      lastLevel = idx;
      run = createRun(idx, { seed: seed | 0 || 1 });
      setPhase('playing');
      ui.showGame();
      ui.hideResult();
      updateHud();
      return true;
    },
    drawPath: (points) => (run ? run.drawPath(points) : { ok: false }),
    autoSolve: () => {
      if (!run) return false;
      const idx = run.state.level - 1;
      const pts = SOLUTIONS[idx] || SOLUTIONS[0];
      run.drawPath(pts);
      run.setDrive(1);
      return true;
    },
    fastForward: () => {
      if (!run) return false;
      let guard = 4000;
      while (guard-- > 0 && run.state.phase === 'playing') {
        run.step(0.5);
        handleEvents(run.drainEvents());
      }
      return true;
    },
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
  },
};

// ---------- 启动 ----------
bind();
bindDriveButtons();
syncDocumentLang();
ui.applyLang();
{
  const rt = $('rotate-text');
  const rb = $('btn-rotate-skip');
  if (rt) rt.textContent = t('rotateHint');
  if (rb) rb.textContent = t('rotateSkip');
}
buildLevelGrid();
$('btn-mute').textContent = muted ? '🔇' : '🔊';
Sdk.track('load', {});
requestAnimationFrame(frame);
