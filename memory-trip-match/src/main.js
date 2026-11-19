// MEMORY TRIP MATCH · 主入口：60Hz 固定步长 + 标题/选关/游戏/暂停/结算 + 教程 + SDK。
import { STEP, GAME } from '../config/game.config.js';
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

let run = null;
let phase = 'title';        // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let fpsSamples = [];
let tutorialStep = -1;

const view = { fx: [], shake: 0 };

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let unlocked = Math.max(1, Sdk.load('unlocked', 1) | 0);
let starsByLevel = Sdk.load('stars', {}) || {};
let tutorialDone = !!Sdk.load('tutorialDone', false);
let best = Sdk.load('best', 0) | 0;
let lastLevel = Sdk.load('lastLevel', 0) | 0;

Sdk.ready();
Sdk.onAdStart(() => { if (phase === 'playing') pauseGame(true); });
Sdk.onAdEnd(() => { if (phase === 'paused') resumeGame(); });
audio.setMuted(muted);
ui.setMuted(muted);

function persist() {
  Sdk.save('unlocked', unlocked);
  Sdk.save('stars', starsByLevel);
  Sdk.save('muted', muted);
  Sdk.save('tutorialDone', tutorialDone);
  Sdk.save('best', best);
  Sdk.save('lastLevel', lastLevel);
}

function totalStars() {
  return Object.values(starsByLevel).reduce((a, b) => a + (b | 0), 0);
}

// ---------- 阶段状态机 ----------
function setPhase(p) { phase = p; }

function loadRun(idx, opts = {}) {
  idx = Math.max(0, Math.min(LEVEL_COUNT - 1, idx | 0));
  lastLevel = idx;
  const seed = opts.seed != null ? opts.seed : ((Date.now() % 2147483647) || 1);
  run = createRun(idx, { seed });
  view.fx = [];
  view.shake = 0;
  setPhase('playing');
  ui.showGame();
  hideResult();
  hideTutorial();
  updateHud();
  audio.startBgm();
  Sdk.track('start', { level: idx + 1 });
  if (opts.skipPreview) {
    run.state.previewLeft = 0;
    run.step(STEP);
  }
  if (!tutorialDone && idx === 0 && !opts.noTutorial) startTutorial();
}

function startLevel(idx) {
  loadRun(idx, {});
}

function restartLevel() {
  if (run) Sdk.track('restart', { level: run.state.level });
  loadRun(run ? run.state.levelIndex : lastLevel, {});
}

function goHome() {
  run = null;
  setPhase('title');
  hideResult();
  hideTutorial();
  ui.showTitle();
  buildLevelGrid();
  updateStarsTotal();
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
  lastTime = performance.now();
}

// ---------- HUD / 关卡格 / 结算 ----------
function updateHud() {
  if (!run) return;
  const h = run.getHud();
  const solved = run.state.cards.reduce((n, c) => n + (c.solved ? 1 : 0), 0);
  $('hud-level').textContent = `${t('level')} ${h.level}`;
  $('hud-goal').textContent = run.state.phase === 'preview'
    ? `◆ ${t('preview')} ${t('previewHint')}`
    : `◆ ${t('goal')}`;
  $('hud-pairs').textContent = `${t('pairs')} ${solved}/${run.state.pairs}`;
  $('hud-moves').textContent = `${t('moves')} ${h.moves}/${h.moveBudget}`;
  $('hud-combo').textContent = h.combo >= 2 ? `${t('combo')} ×${h.combo}` : '';
  $('hud-score').textContent = `${h.score}`;
  $('hud-best').textContent = `${t('best')} ${best}`;
  $('btn-hint').textContent = t('hintLeft', { n: h.hintsLeft });
  $('hud-moves').classList.toggle('time-low', h.moveBudget - h.moves <= 3);
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
    cell.innerHTML =
      `<span class="lv-num">${i + 1}</span>` +
      `<span class="lv-stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>`;
    cell.setAttribute('aria-label', `${t('level')} ${i + 1}${i + 1 > unlocked ? ' ' + t('locked') : ''}`);
    grid.appendChild(cell);
  }
}

function updateStarsTotal() {
  const el = $('stars-total');
  if (el) el.textContent = t('starsTotal', { n: totalStars(), total: LEVEL_COUNT * 3 });
}

function showResult(ev) {
  const won = ev.type === 'win';
  const st = run.state;
  $('result-title').textContent = won ? t('winTitle') : t('loseTitle');
  $('result-title').classList.toggle('lose', !won);
  const starsEl = $('result-stars');
  starsEl.innerHTML = won
    ? `<span class="stars">${'★'.repeat(st.stars)}${'☆'.repeat(3 - st.stars)}</span>${st.stars >= 3 ? `<em>${t('perfect')}</em>` : ''}`
    : '';
  $('result-meta').textContent = won
    ? `${t('resultMoves')} ${st.moves} · ${t('resultScore')} ${st.score} · ${t('resultCombo')} ×${st.maxCombo}`
    : t('outOfMoves');
  $('btn-next').style.display = won && st.levelIndex + 1 < LEVEL_COUNT ? '' : 'none';
  ui.showResult();
}

function hideResult() {
  ui.hideResult();
}

function finishRun(ev) {
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  const st = run.state;
  const won = ev.type === 'win';
  if (won) {
    const idx = st.level;
    starsByLevel[idx] = Math.max(starsByLevel[idx] | 0, st.stars);
    if (idx < LEVEL_COUNT) unlocked = Math.max(unlocked, idx + 1);
    if (st.score > best) { best = st.score; }
  }
  persist();
  Sdk.track(won ? 'win' : 'fail', {
    level: st.level, stars: st.stars, moves: st.moves, score: st.score,
    durationMs: Math.round(st.time * 1000),
  });
  showResult(ev);
  audio.event(won ? 'win' : 'lose');
  buildLevelGrid();
  updateStarsTotal();
}

// ---------- 教程 ----------
const TUT_STEPS = () => [
  { id: 'flip', text: t('tutStep1'), spot: 'grid' },
  { id: 'match', text: t('tutStep2'), spot: 'grid' },
  { id: 'clear', text: t('tutStep3'), spot: 'grid' },
];

function gridRect() {
  if (!run) return null;
  const lay = renderer.debugLayout(run.state);
  if (!lay) return null;
  return {
    x: lay.gridX,
    y: lay.gridY,
    w: lay.cell * lay.cols,
    h: lay.cell * lay.rows,
  };
}

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
  ui.tutTitle.textContent = t('tutTitle');
  ui.tutText.textContent = s ? s.text : '';
  ui.tutSkip.textContent = t('tutSkip');
  ui.tutNext.textContent = t('tutNext');
  const rect = s && s.spot === 'grid' ? gridRect() : null;
  const spot = $('tut-spotlight');
  if (rect) {
    spot.style.display = 'block';
    spot.style.left = `${rect.x - 8}px`;
    spot.style.top = `${rect.y - 8}px`;
    spot.style.width = `${rect.w + 16}px`;
    spot.style.height = `${rect.h + 16}px`;
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

function hideTutorial() {
  $('tutorial').classList.add('hidden');
}

const TUT_TRIGGER = ['reveal', 'match'];
function tutorialAdvance(evType) {
  if (tutorialStep < 0 || tutorialStep >= TUT_TRIGGER.length) return;
  if (TUT_TRIGGER[tutorialStep] !== evType) return;
  tutorialStep += 1;
  if (tutorialStep >= TUT_TRIGGER.length) endTutorial();
  else renderTutorialStep();
}

// ---------- 事件消费 ----------
function spawnSpark(cardId, color) {
  if (!run) return;
  const rect = renderer.cardRect(run.state, cardId);
  if (!rect) return;
  for (let i = 0; i < 10; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const sp = Math.random() * 90 + 40;
    view.fx.push({
      type: 'spark', x: rect.cx, y: rect.cy,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      r: 2 + Math.random() * 2.5, color, ttl: 0.5, age: 0,
    });
  }
}

function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    tutorialAdvance(ev.type);
    if (ev.type === 'match') {
      const { shape, color } = renderer.shapeFor(ev.symbol);
      for (const c of run.state.cards) {
        if (c.symbol === ev.symbol && c.solved) spawnSpark(c.id, color);
      }
      view.shake = Math.max(view.shake, 2);
      void shape;
    } else if (ev.type === 'mismatch') {
      view.shake = Math.max(view.shake, 1);
    } else if (ev.type === 'win' || ev.type === 'lose') {
      finishRun(ev);
      return;
    }
  }
}

// ---------- 输入 ----------
function canvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (1280 / rect.width),
    y: (e.clientY - rect.top) * (720 / rect.height),
  };
}

function pickCard(p) {
  if (!run) return null;
  const lay = renderer.debugLayout(run.state);
  if (!lay) return null;
  const c = Math.floor((p.x - lay.gridX) / lay.cell);
  const r = Math.floor((p.y - lay.gridY) / lay.cell);
  if (r < 0 || r >= lay.rows || c < 0 || c >= lay.cols) return null;
  const id = r * lay.cols + c;
  if (id < 0 || id >= run.state.cards.length) return null;
  return id;
}

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (!run || phase !== 'playing') return;
  if (run.state.phase !== 'playing') {
    // 预览阶段点按 = 跳过预览
    if (run.state.phase === 'preview') { run.state.previewLeft = 0; }
    return;
  }
  const id = pickCard(canvasPos(e));
  if (id == null) return;
  const res = run.flip(id);
  if (!res.ok) return;
  updateHud();
  handleEvents(run.drainEvents());
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
  if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'result')) restartLevel();
  if (e.code === 'KeyM') toggleMute();
  if (e.code === 'KeyH' && phase === 'playing') doHint();
});

function doHint() {
  if (!run || phase !== 'playing') return;
  const res = run.hint();
  if (res.ok) updateHud();
}

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  ui.setMuted(muted);
  $('btn-mute').classList.toggle('is-muted', muted);
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
  on('btn-next', () => startLevel((run ? run.state.levelIndex : lastLevel) + 1));
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-hint', doHint);
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result') startTutorial(); });
  on('btn-tut-replay', () => {
    if (phase === 'paused') resumeGame();
    if (phase === 'playing') startTutorial();
  });
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
      updateStarsTotal();
      if (run) updateHud();
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
  view.fx = view.fx.filter((fx) => fx.age < fx.ttl);

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
  sim: () => (run ? run.state : null),
  start: (i) => startLevel(i == null ? (lastLevel || 0) : i),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => restartLevel(),
  home: () => goHome(),
  startTutorial: () => startTutorial(),
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['flip', 'match', 'clear']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  save: (key, value) => Sdk.save(key, value),
  load: (key, fallback) => Sdk.load(key, fallback),
  share: async (payload = {}) => Sdk.share(payload),
  ui: () => ui,
  debug: {
    state: () => (run ? run.state : null),
    layout: () => (run ? renderer.debugLayout(run.state) : null),
    loadLevel: (i) => startLevel(i),
    startSeeded: (i, seed) => loadRun(i, { seed: seed | 0 || 1, skipPreview: true, noTutorial: true }),
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    autoSolve: () => {
      if (!run) return false;
      if (run.state.phase === 'preview') { run.state.previewLeft = 0; run.step(STEP); }
      const bySymbol = new Map();
      for (const c of run.state.cards) {
        if (!bySymbol.has(c.symbol)) bySymbol.set(c.symbol, []);
        bySymbol.get(c.symbol).push(c.id);
      }
      for (const [, ids] of bySymbol) {
        for (const id of ids) {
          let guard = 0;
          while (!run.state.cards[id].revealed && !run.state.cards[id].solved && guard++ < 4) {
            run.flip(id);
          }
        }
      }
      return true;
    },
    fastForward: () => {
      if (!run) return false;
      let guard = 600;
      while (guard-- > 0 && (run.state.phase === 'preview')) run.step(STEP);
      return true;
    },
  },
};

// ---------- 启动 ----------
bind();
syncDocumentLang();
ui.applyLang();
buildLevelGrid();
updateStarsTotal();
$('btn-mute').classList.toggle('is-muted', muted);
Sdk.track('load', {});
requestAnimationFrame(frame);
