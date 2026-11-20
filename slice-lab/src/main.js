// SLICE LAB · 主入口：60Hz 固定步长 + 标题/关卡/暂停/结算 + 教程 + SDK 统一出口
import { STEP, WORLD } from '../config/game.config.js';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';
import { createRun, BISECT_DIRECTIONS } from './game/sim.js';
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
let lastLevel = 0;
let combo = 0;
let tutorialStep = -1;
let tutorialDone = false;
let muted = false;
let unlocked = 1;
let starsByLevel = {};
let bestLevel = 1;

const view = {
  cursor: { x: 0, y: 0 },
  dragging: false,
  dragStart: null,
  dragEnd: null,
  preview: null,
  fx: [],
  shake: 0,
};

// ---------- 存档（统一走 Sdk） ----------
muted = !!Sdk.load('muted', false);
unlocked = Math.max(1, Sdk.load('unlocked', 1) | 0);
starsByLevel = Sdk.load('stars', {}) || {};
tutorialDone = !!Sdk.load('tutorialDone', false);
bestLevel = Sdk.load('bestLevel', 1) | 0 || 1;

Sdk.ready();
audio.setMuted(muted);

function persist() {
  Sdk.save('unlocked', unlocked);
  Sdk.save('stars', starsByLevel);
  Sdk.save('muted', muted);
  Sdk.save('tutorialDone', tutorialDone);
  Sdk.save('bestLevel', bestLevel);
}

function totalStars() {
  return Object.values(starsByLevel).reduce((a, b) => a + (b | 0), 0);
}

// ---------- 阶段状态机 ----------
function startLevel(idx) {
  idx = Math.max(0, Math.min(LEVEL_COUNT - 1, idx | 0));
  lastLevel = idx;
  run = createRun(idx, { seed: (Date.now() % 2147483647) || 1, combo });
  view.dragging = false;
  view.dragStart = null;
  view.dragEnd = null;
  view.preview = null;
  view.fx = [];
  view.shake = 0;
  phase = 'playing';
  ui.showGame();
  ui.hideResult();
  updateHud();
  audio.startBgm();
  Sdk.track('start', { level: idx + 1 });
  if (idx === 0 && !tutorialDone) startTutorial();
}

function pauseGame() {
  if (phase !== 'playing') return;
  phase = 'paused';
  audio.stopBgm();
  ui.showPause();
}

function resumeGame() {
  if (phase !== 'paused') return;
  phase = 'playing';
  ui.hidePause();
  audio.startBgm();
}

function retryLevel() {
  startLevel(lastLevel);
}

function goHome() {
  run = null;
  phase = 'title';
  audio.stopBgm();
  ui.hideResult();
  ui.showTitle();
  buildLevelGrid();
}

// ---------- HUD / 关卡格 / 结算 ----------
function updateHud() {
  if (!run) return;
  const h = run.getHud();
  const lv = LEVELS[run.state.level - 1] || {};
  const name = lv.name ? (lv.name[i18n.lang] || lv.name.en) : '';
  $('hud-level').textContent = `${t('level')} ${run.state.level}${name ? ' · ' + name : ''}`;
  const secs = Math.max(0, Math.ceil(h.timeLeft));
  const timeEl = $('hud-time');
  timeEl.textContent = `${secs}s`;
  timeEl.classList.toggle('time-low', secs <= 10);
  const scoreEl = $('hud-score');
  if (view.preview && view.preview.valid) scoreEl.textContent = `${view.preview.score}%`;
  else scoreEl.textContent = t('hint');
  const comboEl = $('hud-combo');
  const c = (run.state.combo | 0) || combo;
  comboEl.style.display = c >= 2 ? '' : 'none';
  comboEl.textContent = `${t('combo')} ×${c}`;
}

function buildLevelGrid() {
  const grid = $('level-grid');
  if (!grid) return;
  grid.innerHTML = '';
  for (let i = 0; i < LEVEL_COUNT; i += 1) {
    const cell = document.createElement('button');
    cell.className = 'level-cell' + (i + 1 > unlocked ? ' locked' : '');
    cell.dataset.level = i;
    const stars = starsByLevel[i + 1] | 0;
    cell.innerHTML = `<span class="lv-num">${i + 1}</span><span class="lv-stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>`;
    cell.setAttribute('aria-label', `${t('level')} ${i + 1}`);
    grid.appendChild(cell);
  }
  $('stars-total').textContent = `★ ${totalStars()} / ${LEVEL_COUNT * 3}`;
}

function showResult(won, ev) {
  $('result-title').textContent = won ? t('winTitle') : t('loseTitle');
  $('result-title').classList.toggle('lose', !won);
  $('result-score').textContent = `${ev.score ?? run.state.score}%`;
  const stars = won ? (run.state.stars || 1) : 0;
  $('result-stars').innerHTML = won
    ? `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}${ev.score === 100 ? `<em>${t('perfect')}</em>` : ''}`
    : '';
  const meta = [];
  if (won) meta.push(`${t('resultScore')} ${ev.score ?? run.state.score}%`);
  if (ev.reason === 'timeout') meta.push(t('timeOut'));
  else if (ev.reason === 'uneven') meta.push(t('resultScore') + ' ' + (ev.score ?? 0) + '%');
  if (won && (run.state.combo | 0) >= 2) meta.push(`${t('resultCombo')} ×${run.state.combo}`);
  $('result-meta').textContent = meta.join(' · ');
  $('btn-next').style.display = won && run.state.level < LEVEL_COUNT ? '' : 'none';
  ui.showResult();
}

function finishRun(ev) {
  phase = 'result';
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  const won = ev.type === 'win';
  const idx = run.state.level - 1;
  if (won) {
    starsByLevel[idx + 1] = Math.max(starsByLevel[idx + 1] | 0, run.state.stars);
    if (idx + 1 < LEVEL_COUNT) unlocked = Math.max(unlocked, idx + 2);
    combo = run.state.combo;
    bestLevel = Math.max(bestLevel, idx + 1);
  } else {
    combo = 0;
  }
  persist();
  Sdk.track(won ? 'win' : 'fail', {
    level: run.state.level, score: ev.score ?? run.state.score, stars: run.state.stars,
    combo: run.state.combo, reason: ev.reason || null,
  });
  showResult(won, ev);
  buildLevelGrid();
}

// ---------- 事件消费 ----------
function spawnBurst(x, y, color, n = 14) {
  for (let i = 0; i < n; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const sp = 60 + Math.random() * 160;
    view.fx.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      r0: 2 + Math.random() * 3,
      color,
      life: 0.5 + Math.random() * 0.4,
      ttl: 0.5 + Math.random() * 0.4,
    });
  }
}

function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    tutorialAdvance(ev.type);
    switch (ev.type) {
      case 'cut':
        if (run.state.lastCut) {
          const m = { x: (run.state.lastCut.p1.x + run.state.lastCut.p2.x) / 2, y: (run.state.lastCut.p1.y + run.state.lastCut.p2.y) / 2 };
          spawnBurst(m.x, m.y, '#7dff6a');
        }
        break;
      case 'split':
        view.shake = 4;
        break;
      case 'rockHit':
        view.shake = 7;
        spawnBurst(view.cursor.x, view.cursor.y, '#ff5566', 20);
        break;
      case 'star':
      case 'perfect':
        spawnBurst(WORLD.WIDTH / 2, 260, '#ffd76a', 18);
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

// ---------- 教程 ----------
const TUT_STEPS = () => [
  { id: 'cut', text: t('tutStep1') },
  { id: 'aim', text: t('tutStep2') },
  { id: 'avoid', text: t('tutStep3') },
];

function startTutorial() {
  tutorialStep = 0;
  renderTutorialStep();
}

function renderTutorialStep() {
  const el = $('tutorial');
  if (tutorialStep < 0) { el.classList.add('hidden'); return; }
  const s = TUT_STEPS()[tutorialStep];
  el.classList.remove('hidden');
  $('tut-title').textContent = t('tutTitle');
  $('tut-text').textContent = s ? s.text : '';
  $('tut-skip').textContent = t('tutSkip');
  $('tut-next').textContent = t('tutNext');
  const spot = $('tut-spotlight');
  const lay = renderer.debugLayout();
  if (lay && lay.crystal) {
    const r = lay.crystal;
    spot.style.display = 'block';
    spot.style.left = `${r.x - 10}px`;
    spot.style.top = `${r.y - 10}px`;
    spot.style.width = `${r.w + 20}px`;
    spot.style.height = `${r.h + 20}px`;
  } else {
    spot.style.display = 'none';
  }
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
  if (tutorialStep < 0) return;
  // 真实动作推进：第一次有效 cut 推进第 1 步；win 推进第 2 步（瞄准）；此后自然结束
  if (tutorialStep === 0 && evType === 'cut') tutorialNext();
  else if (tutorialStep === 1 && evType === 'settle') tutorialNext();
}

// ---------- 输入 ----------
function canvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (WORLD.WIDTH / rect.width),
    y: (e.clientY - rect.top) * (WORLD.HEIGHT / rect.height),
  };
}

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (!run || phase !== 'playing' || run.state.phase !== 'drawing') return;
  view.dragging = true;
  view.dragStart = canvasPos(e);
  view.dragEnd = view.dragStart;
  view.preview = null;
});

canvas.addEventListener('pointermove', (e) => {
  view.cursor = canvasPos(e);
  if (view.dragging && run && phase === 'playing') {
    view.dragEnd = view.cursor;
    view.preview = run.preview(view.dragStart.x, view.dragStart.y, view.dragEnd.x, view.dragEnd.y);
    updateHud();
  }
});

canvas.addEventListener('pointerup', (e) => {
  if (!view.dragging) return;
  view.dragging = false;
  if (run && phase === 'playing' && run.state.phase === 'drawing' && view.dragStart && view.dragEnd) {
    const res = run.cut(view.dragStart.x, view.dragStart.y, view.dragEnd.x, view.dragEnd.y);
    if (!res.ok) {
      audio.event('miss', {});
      updateHud();
    }
  }
  view.preview = null;
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  } else if (e.code === 'KeyR') {
    if (phase === 'playing' || phase === 'paused' || phase === 'result') retryLevel();
  } else if (e.code === 'KeyM') {
    toggleMute();
  }
});

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  $('btn-mute').classList.toggle('is-muted', muted);
  $('btn-mute').textContent = muted ? '×' : '♪';
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
  on('btn-restart', retryLevel);
  on('btn-restart2', retryLevel);
  on('btn-retry', retryLevel);
  on('btn-next', () => startLevel((run ? run.state.level : lastLevel)));
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-tut-replay', () => { if (phase === 'paused') resumeGame(); startTutorial(); });
  on('btn-howto', startTutorial);
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
      applyStaticText();
      renderTutorialStep();
      buildLevelGrid();
      if (run) updateHud();
    });
  }
}

// ---------- 主循环 ----------
let lastTime = performance.now();
let accumulator = 0;
let fpsSamples = [];

function frame(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;

  if (phase === 'playing' && run) {
    accumulator += dt;
    while (accumulator >= STEP) {
      run.step(STEP);
      handleEvents(run.drainEvents());
      accumulator -= STEP;
      if (phase !== 'playing') break;
    }
    if (run && phase === 'playing') updateHud();
  }

  if (view.shake > 0) view.shake = Math.max(0, view.shake - dt * 18);
  for (const fx of view.fx) fx.ttl -= dt;
  view.fx = view.fx.filter((fx) => fx.ttl > 0);

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
  start: (i) => startLevel(i == null ? (lastLevel || 0) : i),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => goHome(),
  retry: () => retryLevel(),
  home: () => goHome(),
  sim: () => (run ? run.state : null),
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['cut', 'aim', 'avoid']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  save: () => Sdk,
  ui: () => ui,
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: () => (run ? run.state : null),
    loadLevel: (i) => startLevel(i),
    startSeeded: (i, seed) => {
      const idx = Math.max(0, Math.min(LEVEL_COUNT - 1, i | 0));
      lastLevel = idx;
      run = createRun(idx, { seed: seed | 0 || 1, combo });
      view.dragging = false; view.dragStart = null; view.dragEnd = null; view.preview = null; view.fx = []; view.shake = 0;
      phase = 'playing';
      ui.showGame();
      ui.hideResult();
      updateHud();
      return true;
    },
    autoSlice: () => {
      if (!run) return false;
      let line = null;
      for (const d of BISECT_DIRECTIONS) {
        const l = run.bisect(d);
        if (l) { line = l; break; }
      }
      if (!line) return false;
      run.cut(line.p1.x, line.p1.y, line.p2.x, line.p2.y);
      return true;
    },
    fastForward: () => {
      if (!run) return false;
      let guard = 6000;
      while (guard-- > 0 && (run.state.phase === 'drawing' || run.state.phase === 'splitting')) {
        run.step(1 / 60);
        handleEvents(run.drainEvents());
      }
      return run.state.phase === 'won';
    },
    giveUp: () => window.__ll.debug.fastForward(),
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
  },
};

// ---------- 启动 ----------
function applyStaticText() {
  const rt = $('rotate-text');
  const rb = $('btn-rotate-skip');
  if (rt) rt.textContent = t('rotateHint');
  if (rb) rb.textContent = t('rotateSkip');
  const hb = $('btn-howto');
  if (hb) hb.textContent = t('howto');
}

bind();
syncDocumentLang();
ui.applyLang();
applyStaticText();
$('btn-mute').textContent = muted ? '×' : '♪';
buildLevelGrid();
Sdk.track('load', {});
requestAnimationFrame(frame);
