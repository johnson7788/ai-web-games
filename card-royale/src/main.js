// 主入口：60Hz 固定步长 + 标题/选关/游戏/暂停/结算 + 教程引导 + SDK 统一出口。
// 装配：sim / solver / render / audio / ui / sdk。契约见 docs/README.md。
import { STEP, GAME, LAYOUT } from '../config/game.config.js';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';
import { createRun } from './game/sim.js';
import { findWin } from './game/solver.js';
import { createRenderer } from './render/index.js';
import { createAudio } from './core/audio.js';
import { ui } from './ui/ui.js';
import { i18n, t } from './core/i18n.js';
import Sdk from './core/sdk.js';

const $ = (id) => document.getElementById(id);
const canvas = $('canvas');
const renderer = createRenderer(canvas);
const audio = createAudio();

let run = null;            // 当前对局
let phase = 'title';       // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let fpsSamples = [];
let tutorialStep = -1;     // -1 = 未激活

// 视图状态传给 renderer
const view = {
  hover: null,
  sceneKey: 'candle-hall',
  royalStreakTtl: 0,
  t: 0,
};

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let unlocked = Math.max(1, Sdk.load('unlocked', 1) | 0);
let starsByLevel = Sdk.load('stars', {}) || {};
let tutorialDone = !!Sdk.load('tutorialDone', false);
let bestScore = Sdk.load('bestScore', 0) | 0;
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
  Sdk.save('bestScore', bestScore);
  Sdk.save('lastLevel', lastLevel);
}

function totalStars() {
  return Object.values(starsByLevel).reduce((a, b) => a + (b | 0), 0);
}

// ---------- 阶段状态机 ----------
function setPhase(p) { phase = p; }

function startLevel(idx, seed) {
  idx = Math.max(0, Math.min(LEVEL_COUNT - 1, idx | 0));
  lastLevel = idx;
  run = createRun(idx, { seed: (seed != null ? seed : ((Date.now() % 2147483647) || 1)) >>> 0 });
  view.sceneKey = (LEVELS[idx] && LEVELS[idx].scene) || 'candle-hall';
  view.hover = null;
  view.royalStreakTtl = 0;
  setPhase('playing');
  ui.showGame();
  hideResult();
  updateHud();
  audio.startBgm();
  Sdk.track('start', { level: idx + 1 });
  if (!tutorialDone && idx === 0) startTutorial();
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
  if (run) Sdk.track('restart', { level: run.state.level });
  startLevel(run ? run.state.level - 1 : lastLevel);
}

function goHome() {
  run = null;
  setPhase('title');
  hideResult();
  ui.showTitle();
  buildLevelGrid();
}

// ---------- HUD / 关卡格 / 结算 ----------
function updateHud() {
  if (!run) return;
  view.labels = {
    goal: t('goal'),
    stock: t('stock'),
    active: t('active'),
  };
  const h = run.getHud();
  const lv = LEVELS[run.state.level - 1] || {};
  $('hud-level').textContent = `${t('level')} ${run.state.level} · ${lv.name ? (lv.name[i18n.lang] || lv.name.en || '') : ''}`;
  const timeEl = $('hud-time');
  if (h.timeLeft != null) {
    timeEl.style.display = '';
    timeEl.textContent = `${Math.max(0, Math.ceil(h.timeLeft))}s`;
    timeEl.classList.toggle('time-low', h.timeLeft <= 10);
  } else {
    timeEl.style.display = 'none';
  }
  $('hud-score').textContent = `✦ ${h.score}`;
  $('hud-streak').textContent = `⚡ ${h.streak}`;
  $('hud-streak').style.display = h.streak >= 2 ? '' : 'none';
  $('hud-redeals').textContent = `↻ ${h.redeals}`;
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
  $('stars-total').textContent = `★ ${totalStars()} / ${LEVEL_COUNT * 3}`;
}

function showResult(res) {
  const { won, stars, score, hasNext, reason, timeLeft } = res;
  $('result-title').textContent = won ? t('winTitle') : t('loseTitle');
  $('result-title').classList.toggle('lose', !won);
  const starsEl = $('result-stars');
  starsEl.innerHTML = won
    ? `<span class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>${stars >= 3 ? `<em>${t('perfect')}</em>` : ''}`
    : '';
  $('result-score').textContent = won ? `${t('score')} ${score}` : '';
  $('result-meta').textContent = won
    ? (timeLeft != null ? t('timeLeft', { s: Math.ceil(timeLeft) }) : '')
    : (reason === 'timeOut' ? t('timeOut') : t('deadEnd'));
  $('btn-next').style.display = won && hasNext ? '' : 'none';
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
  const won = ev.type === 'win';
  const stars = won ? (ev.stars || st.stars || 1) : 0;
  if (won) {
    const idx = st.level;
    starsByLevel[idx] = Math.max(starsByLevel[idx] | 0, stars);
    if (idx < LEVEL_COUNT) unlocked = Math.max(unlocked, idx + 1);
    bestScore = Math.max(bestScore, st.score);
    buildLevelGrid();
  }
  persist();
  Sdk.track(won ? 'win' : 'fail', {
    level: st.level, stars, score: st.score, redeals: st.redeals, bestStreak: st.bestStreak,
  });
  showResult({
    won, stars, score: st.score, timeLeft: st.timeLeft,
    reason: ev.reason || st.result?.reason || null, hasNext: st.level < LEVEL_COUNT,
  });
  audio.event(won ? 'win' : 'lose');
}

// ---------- 教程引导 ----------
const TUT_STEPS = () => [
  { text: t('tutStep1'), spot: 'waste' },
  { text: t('tutStep2'), spot: 'board' },
  { text: t('tutStep3'), spot: 'stock' },
  { text: t('tutStep4'), spot: null },
];

function layoutRect(which) {
  try {
    const lay = renderer.debugLayout();
    if (!lay) return null;
    if (which === 'waste' && lay.waste) return lay.waste;
    if (which === 'stock' && lay.stock) return lay.stock;
    if (which === 'board') {
      const playable = lay.board.find((p) => p.playable) || lay.board[0];
      return playable || null;
    }
    return null;
  } catch { return null; }
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
  $('tut-title').textContent = t('tutTitle');
  $('tut-text').textContent = s ? s.text : '';
  $('tut-skip').textContent = t('tutSkip');
  $('tut-next').textContent = t('tutNext');
  const rect = s && s.spot && layoutRect(s.spot);
  const spot = $('tut-spotlight');
  if (rect) {
    spot.style.display = 'block';
    spot.style.left = `${rect.x - 10}px`;
    spot.style.top = `${rect.y - 10}px`;
    spot.style.width = `${rect.w + 20}px`;
    spot.style.height = `${rect.h + 20}px`;
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

const TUT_TRIGGER = ['play', 'play', 'draw', 'royalStreak'];
function tutorialAdvance(evType) {
  if (tutorialStep < 0 || tutorialStep >= TUT_TRIGGER.length) return;
  if (TUT_TRIGGER[tutorialStep] !== evType) return;
  tutorialStep += 1;
  if (tutorialStep >= TUT_TRIGGER.length) endTutorial();
  else renderTutorialStep();
}

// ---------- 事件消费 ----------
function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    tutorialAdvance(ev.type);
    switch (ev.type) {
      case 'royalStreak':
        view.royalStreakTtl = 2.2;
        break;
      case 'play':
        view.royalStreakTtl = Math.max(view.royalStreakTtl, 0.15);
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
    x: (e.clientX - rect.left) * (1280 / rect.width),
    y: (e.clientY - rect.top) * (720 / rect.height),
  };
}

function onPointerDown(e) {
  audio.unlock();
  if (!run || phase !== 'playing') return;
  const p = canvasPos(e);
  const hit = renderer.hitTest(p.x, p.y);
  if (!hit) return;
  if (hit.kind === 'stock') {
    run.draw();
    updateHud();
    return;
  }
  if (hit.kind === 'card') {
    const card = run.state.board.find((c) => c.id === hit.id);
    if (!card) return;
    if (card.frozen && !card.thawed && run.isUncovered(card)) {
      run.thaw(card.id);
      return;
    }
    const res = run.play(card.id);
    if (!res.ok && res.reason !== 'covered') audio.event('play', { fail: true });
    updateHud();
  }
}

canvas.addEventListener('pointermove', (e) => {
  const p = canvasPos(e);
  view.hover = (run && phase === 'playing') ? renderer.hitTest(p.x, p.y) : null;
});
canvas.addEventListener('pointerdown', onPointerDown);

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
  if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'result')) restartLevel();
  if (e.code === 'KeyM') toggleMute();
});

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
  on('btn-next', () => startLevel((run ? run.state.level - 1 : lastLevel) + 1));
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-tut-replay', () => {
    if (phase === 'paused') resumeGame();
    if (phase === 'playing') startTutorial();
  });
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result') startTutorial(); });
  on('btn-rotate-skip', () => {
    const rs = $('rotate-screen');
    if (rs) rs.style.display = 'none';
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
      if (run) updateHud();
    });
  }
}

// ---------- 主循环 ----------
function frame(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;
  view.t += dt;
  if (view.royalStreakTtl > 0) view.royalStreakTtl = Math.max(0, view.royalStreakTtl - dt);

  if (phase === 'playing' && run) {
    accumulator += dt;
    while (accumulator >= STEP) {
      run.step(STEP);
      accumulator -= STEP;
    }
    handleEvents(run.drainEvents());
    if (run && phase === 'playing') updateHud();
  }

  // 教程高亮跟随真实 UI
  if (tutorialStep >= 0 && phase === 'playing') renderTutorialStep();

  try {
    renderer.draw(run, dt, view);
  } catch (err) {
    console.warn('render error', err);
  }

  if (fpsSamples.length < 600 && dt > 0) fpsSamples.push(1 / dt);
  requestAnimationFrame(frame);
}

// ---------- 调试契约 ----------
function autoPlaceSolution() {
  if (!run) return false;
  const moves = findWin(run.snapshot());
  if (!moves) return false;
  for (const mv of moves) {
    if (run.state.phase !== 'playing') break;
    run.executeMove(mv);
  }
  handleEvents(run.drainEvents());
  return true;
}

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
  save: (key, value) => Sdk.save(key, value),
  load: (key, fallback) => Sdk.load(key, fallback),
  ui,
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['play', 'play', 'draw', 'royalStreak']; },
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
        boardLen: st.board.length,
        stockLen: st.stock.length,
        wasteLen: st.waste.length,
        redeals: st.redeals,
        playable: run.playableCards().length,
        frozenCount: st.board.filter((c) => c.frozen).length,
      };
    },
    layout: () => { try { return renderer.debugLayout(); } catch { return null; } },
    loadLevel: (i) => startLevel(i),
    startSeeded: (i, seed) => {
      startLevel(i, seed);
      return true;
    },
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    startTutorial: () => startTutorial(),
    tutorialStep: () => tutorialStep,
    autoPlaceSolution,
    solverMoves: () => (run ? findWin(run.snapshot()) : null),
    fastForward: () => autoPlaceSolution(),
    giveUp: () => autoPlaceSolution(),
  },
};

window.G = {
  get run() { return run; },
  state: () => phase,
  ui,
  i18n,
  t,
};

// ---------- 启动 ----------
bind();
ui.applyLang();
buildLevelGrid();
$('btn-mute').classList.toggle('is-muted', muted);
Sdk.track('load', {});
requestAnimationFrame(frame);
