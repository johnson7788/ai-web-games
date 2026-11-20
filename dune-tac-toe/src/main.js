// 主入口：60Hz 固定步长 + 标题/选关/无尽/游戏/暂停/结算 + 教程引导 + SDK 统一出口
// 契约见 docs/README.md。装配：sim(M1) / render(M2) / ui(M3) / audio(M4) / Lead 集成。
import { STEP, GAME } from '../config/game.config.js';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';
import { createRun, createEndless, X, O, winner, winningMoves, drawingMoves, greedyMove } from './game/sim.js';
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
let phase = 'title';        // title | levels | endless | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let fpsSamples = [];
let tutorialStep = -1;      // -1 = 未激活
let lastPuzzle = 0;         // 最近谜题（0 基）
let lastEndlessMode = 'random';

const view = {
  hoverCell: null,
  cursor: { x: 0, y: 0 },
  fxQueue: [],
  shake: 0,
};

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let unlocked = Math.max(1, Sdk.load('unlocked', 1) | 0);
let stars = Sdk.load('stars', {}) || {};
let tutorialDone = !!Sdk.load('tutorialDone', false);
let record = Sdk.load('record', { w: 0, d: 0, l: 0 }) || { w: 0, d: 0, l: 0 };

Sdk.ready();
Sdk.onAdStart(() => { if (phase === 'playing') pauseGame(true); });
Sdk.onAdEnd(() => { if (phase === 'paused') resumeGame(); });
audio.setMuted(muted);
ui.setMuted(muted);

function persist() {
  Sdk.save('unlocked', unlocked);
  Sdk.save('stars', stars);
  Sdk.save('muted', muted);
  Sdk.save('tutorialDone', tutorialDone);
  Sdk.save('record', record);
}

function totalStars() {
  return Object.values(stars).reduce((a, b) => a + (b | 0), 0);
}

// ---------- 阶段状态机 ----------
function setPhase(p) {
  phase = p;
  updateOverlay();
}

function startPuzzle(idx) {
  idx = Math.max(0, Math.min(LEVEL_COUNT - 1, idx | 0));
  lastPuzzle = idx;
  run = createRun(idx, { seed: (Date.now() % 2147483647) || 1 });
  view.hoverCell = null;
  view.fxQueue = [];
  setPhase('playing');
  ui.showGame();
  hideResult();
  updateHud();
  audio.startBgm();
  Sdk.track('start', { mode: 'puzzle', level: idx + 1 });
}

function startEndless(mode) {
  lastEndlessMode = mode;
  run = createEndless(mode, { seed: (Date.now() % 2147483647) || 1 });
  view.hoverCell = null;
  view.fxQueue = [];
  setPhase('playing');
  ui.showGame();
  hideResult();
  updateHud();
  audio.startBgm();
  Sdk.track('start', { mode: 'endless', ai: mode });
  if (!tutorialDone && mode === 'random') startTutorial();
}

function pauseGame(silent) {
  if (phase !== 'playing') return;
  setPhase('paused');
  audio.stopBgm();
  if (!silent) ui.showPause();
  updateOverlay();
}

function resumeGame() {
  if (phase !== 'paused') return;
  setPhase('playing');
  ui.hidePause();
  audio.startBgm();
  updateOverlay();
}

function restartGame() {
  if (!run) return;
  if (run.state.mode === 'puzzle') startPuzzle(run.state.level - 1);
  else startEndless(run.state.ai);
}

function goHome() {
  run = null;
  setPhase('title');
  hideResult();
  ui.showTitle();
  buildLevelGrid();
  updateRecord();
}

function showLevels() {
  setPhase('levels');
  ui.show('levels');
  buildLevelGrid();
}

function showEndless() {
  setPhase('endless');
  ui.show('endless');
}

// ---------- 棋盘覆盖层（Tab+Enter 可达的 9 个透明按钮） ----------
function updateOverlay() {
  const el = $('board-overlay');
  if (!el) return;
  const active = phase === 'playing';
  el.classList.toggle('hidden', !active);
  if (!active) return;
  const lay = renderer.debugLayout();
  el.style.left = `${lay.grid.x}px`;
  el.style.top = `${lay.grid.y}px`;
  el.style.width = `${lay.grid.w}px`;
  el.style.height = `${lay.grid.h}px`;
}

// ---------- HUD / 关卡格 / 结算 ----------
function updateHud() {
  if (!run) return;
  const s = run.state;
  const lv = s.mode === 'puzzle' ? LEVELS[s.level - 1] : null;
  if (s.mode === 'puzzle') {
    $('hud-level').textContent = `${t('level')} ${s.level}${lv ? ' · ' + (lv.name ? lv.name[i18n.lang] || lv.name.en || '' : '') : ''}`;
    $('hud-goal').textContent = s.goal === 'draw' ? t('drawGoal') : t('winGoal', { n: s.movesLimit });
    $('hud-moves').textContent = t('movesLabel', { n: s.movesMade, m: s.movesLimit });
  } else {
    const modeLabel = s.ai === '2p' ? t('twoPlayer') : (s.ai === 'perfect' ? t('vsPerfect') : s.ai === 'greedy' ? t('vsGreedy') : t('vsRandom'));
    $('hud-level').textContent = `${t('endless')} · ${modeLabel}`;
    $('hud-goal').textContent = t('subtitle');
    $('hud-moves').textContent = t('movesLabel', { n: s.movesMade, m: 9 });
  }
  if (s.ai === '2p') {
    $('hud-turn').textContent = s.turn === X ? t('turnP1') : t('turnP2');
    $('hud-turn').classList.toggle('turn-o', s.turn === O);
  } else {
    $('hud-turn').textContent = s.phase === 'playing' ? t('turnYou') : '';
    $('hud-turn').classList.remove('turn-o');
  }
}

function buildLevelGrid() {
  const grid = $('level-grid');
  if (!grid) return;
  grid.innerHTML = '';
  for (let i = 0; i < LEVEL_COUNT; i += 1) {
    const cell = document.createElement('button');
    cell.className = 'level-cell' + (i + 1 > unlocked ? ' locked' : '');
    cell.dataset.level = i;
    const st = stars[i + 1] | 0;
    cell.innerHTML =
      `<span class="lv-num">${i + 1}</span>` +
      `<span class="lv-goal">${LEVELS[i].goal === 'draw' ? '½' : LEVELS[i].movesLimit}</span>` +
      `<span class="lv-stars">${st >= 3 ? '★' : '·'}</span>`;
    cell.setAttribute('aria-label', `${t('level')} ${i + 1}${i + 1 > unlocked ? ' ' + t('locked') : ''}`);
    grid.appendChild(cell);
  }
  $('stars-total').textContent = t('starsTotal', { n: totalStars() });
}

function updateRecord() {
  $('record-text').textContent = t('record', { w: record.w | 0, l: record.l | 0, d: record.d | 0 });
}

function showResult() {
  const s = run.state;
  const outcome = s.result ? s.result.outcome : (s.phase === 'draw' ? 'draw' : s.phase === 'won' ? 'win' : 'lose');
  $('result-title').textContent = outcome === 'win' ? t('winTitle') : outcome === 'draw' ? t('drawTitle') : t('loseTitle');
  $('result-title').classList.toggle('lose', outcome === 'lose');
  $('result-tag').textContent = '';
  if (s.mode === 'puzzle') {
    $('result-meta').textContent = outcome === 'win'
      ? `${t('levelCleared', { n: s.level })} · ${t('solvedIn', { n: s.movesMade })}`
      : (s.result && s.result.reason === 'outOfMoves' ? t('loseTitle') : t('loseTitle'));
  } else {
    $('result-meta').textContent = s.ai === 'perfect' && outcome === 'win' ? t('perfectTag') : t('record', { w: record.w | 0, l: record.l | 0, d: record.d | 0 });
    if (s.ai === 'perfect' && outcome === 'win') $('result-tag').textContent = t('perfectTag');
  }
  const hasNext = s.mode === 'puzzle' && outcome === 'win' && s.level < LEVEL_COUNT;
  $('btn-next').style.display = hasNext ? '' : 'none';
  $('screen-result').classList.remove('hidden');
}

function hideResult() {
  $('screen-result').classList.add('hidden');
}

function finishRun(ev) {
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  const s = run.state;
  const outcome = ev.type === 'win' ? 'win' : ev.type === 'draw' ? 'draw' : 'lose';
  if (s.mode === 'puzzle') {
    if (outcome === 'win') {
      stars[s.level] = 3;
      if (s.level < LEVEL_COUNT) unlocked = Math.max(unlocked, s.level + 1);
      buildLevelGrid();
    }
    Sdk.track(outcome === 'win' ? 'win' : 'fail', { mode: 'puzzle', level: s.level, movesMade: s.movesMade, reason: ev.reason });
  } else {
    if (outcome === 'win') record.w = (record.w | 0) + 1;
    else if (outcome === 'draw') record.d = (record.d | 0) + 1;
    else record.l = (record.l | 0) + 1;
    updateRecord();
    Sdk.track(outcome === 'win' ? 'win' : outcome === 'draw' ? 'draw' : 'fail', { mode: 'endless', ai: s.ai, outcome });
  }
  persist();
  showResult();
  audio.event(outcome === 'win' ? 'win' : outcome === 'draw' ? 'draw' : 'lose');
}

// ---------- 教程引导（首次自动弹，可跳过，可重看，持久化） ----------
const TUT_TRIGGERS = ['cactus', 'scorpion', 'final'];
const TUT_STEPS = () => [
  { text: t('tutStep1'), spot: 'grid' },
  { text: t('tutStep2'), spot: 'grid' },
  { text: t('tutStep3'), spot: 'grid' },
];

function layoutRect(which) {
  try {
    const lay = renderer.debugLayout();
    return lay && lay[which] ? lay[which] : null;
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
  if (tutorialStep >= TUT_TRIGGERS.length) endTutorial();
  else renderTutorialStep();
}

function endTutorial() {
  tutorialStep = -1;
  tutorialDone = true;
  persist();
  renderTutorialStep();
}

function tutorialAdvance(evType) {
  if (tutorialStep < 0 || tutorialStep >= TUT_TRIGGERS.length) return;
  if (TUT_TRIGGERS[tutorialStep] !== evType) return;
  tutorialStep += 1;
  if (tutorialStep >= TUT_TRIGGERS.length) endTutorial();
  else renderTutorialStep();
}

// ---------- 事件消费 ----------
function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    switch (ev.type) {
      case 'place':
        view.fxQueue.push({ type: 'place', cell: ev.cell, ttl: 0.4 });
        view.shake = ev.player === X ? 3 : 2;
        tutorialAdvance(ev.player === X ? 'cactus' : 'scorpion');
        break;
      case 'win':
      case 'lose':
      case 'draw':
        finishRun(ev);
        return;
      default:
        break;
    }
  }
}

// ---------- 输入 ----------
function cellFromEvent(e) {
  const btn = e.target.closest('.cell-btn');
  return btn ? Number(btn.dataset.cell) : null;
}

$('board-overlay').addEventListener('click', (e) => {
  const i = cellFromEvent(e);
  if (i == null) return;
  audio.unlock();
  if (!run || phase !== 'playing') return;
  const res = run.place(i);
  if (!res.ok) audio.event('click');
  updateHud();
  view.hoverCell = null;
});

$('board-overlay').addEventListener('mouseover', (e) => {
  const i = cellFromEvent(e);
  if (i != null) view.hoverCell = i;
});
$('board-overlay').addEventListener('mouseout', (e) => {
  const i = cellFromEvent(e);
  if (i != null && view.hoverCell === i) view.hoverCell = null;
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
  if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'result')) restartGame();
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
  on('btn-start', () => startEndless('random'));
  on('btn-puzzle', showLevels);
  on('btn-endless', showEndless);
  on('btn-levels-back', goHome);
  on('btn-endless-back', goHome);
  on('btn-vs-random', () => startEndless('random'));
  on('btn-vs-greedy', () => startEndless('greedy'));
  on('btn-vs-perfect', () => startEndless('perfect'));
  on('btn-two-player', () => startEndless('2p'));
  on('btn-resume', resumeGame);
  on('btn-restart', restartGame);
  on('btn-restart2', restartGame);
  on('btn-retry', restartGame);
  on('btn-next', () => startPuzzle(run ? run.state.level : lastPuzzle));
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-tut-replay', () => { if (phase === 'paused') resumeGame(); if (phase === 'playing') startTutorial(); });
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result') startTutorial(); });
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);
  on('btn-rotate-skip', () => { const rs = $('rotate-screen'); if (rs) rs.style.display = 'none'; });

  $('level-grid')?.addEventListener('click', (e) => {
    const idx = e.target.closest('[data-level]')?.dataset.level;
    if (idx == null) return;
    const i = +idx;
    if (i + 1 > unlocked) return;
    startPuzzle(i);
  });

  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = $(id);
    if (!sel) continue;
    sel.addEventListener('change', () => {
      ui.setLang(sel.value);
      renderTutorialStep();
      buildLevelGrid();
      updateRecord();
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

  if (view.shake > 0) view.shake = Math.max(0, view.shake - dt * 18);
  for (const fx of view.fxQueue) if (fx.ttl > 0) fx.ttl -= dt;

  try {
    renderer.draw(run ? run.state : null, dt, view);
  } catch (err) {
    console.warn('render error', err);
  }
  view.fxQueue = view.fxQueue.filter((fx) => fx.ttl > 0);

  if (fpsSamples.length < 600 && dt > 0) fpsSamples.push(1 / dt);
  requestAnimationFrame(frame);
}

// ---------- 调试契约（截图/验收脚本通用） ----------
window.__ll = {
  state: {
    get phase() { return phase; },
    get lang() { return i18n.lang; },
  },
  run: () => run,
  start: (i) => startPuzzle(i == null ? lastPuzzle : i),
  startEndless: (mode) => startEndless(mode || 'random'),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => restartGame(),
  home: () => goHome(),
  sim: () => (run ? run.state : null),
  save: (k, v) => Sdk.save(k, v),
  ui: () => ui,
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return TUT_TRIGGERS; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip() { endTutorial(); },
  },
  startTutorial: () => startTutorial(),
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: () => (run ? { ...run.state, board: run.state.board.slice() } : null),
    layout: () => { try { return renderer.debugLayout(); } catch { return null; } },
    loadLevel: (i) => startPuzzle(i),
    startSeeded: (i, seed) => {
      const idx = Math.max(0, Math.min(LEVEL_COUNT - 1, i | 0));
      lastPuzzle = idx;
      run = createRun(idx, { seed: seed | 0 || 1 });
      view.hoverCell = null;
      view.fxQueue = [];
      setPhase('playing');
      ui.showGame();
      hideResult();
      updateHud();
      return true;
    },
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    startTutorial: () => startTutorial(),
    tutorialStep: () => tutorialStep,
    // 自动解出当前谜题（win-in-N：走必胜格；draw：走逼平格），返回是否走到终局
    autoPlaceSolution: () => {
      if (!run || run.state.mode !== 'puzzle') return false;
      const s = run.state;
      let guard = 20;
      while (s.phase === 'playing' && guard-- > 0) {
        if (s.goal === 'draw') {
          const dm = drawingMoves(s.board);
          if (!dm.length) return false;
          run.place(dm[0]);
        } else {
          const k = s.movesLimit - s.movesMade;
          const wm = winningMoves(s.board, k);
          if (!wm.length) return false;
          const imm = wm.find((e) => { const nb = s.board.slice(); nb[e] = X; return winner(nb) === X; });
          run.place(imm != null ? imm : wm[0]);
        }
      }
      return s.phase !== 'playing';
    },
    fastForward: () => {
      if (!run) return false;
      if (run.state.mode !== 'puzzle') return false;
      return window.__ll.debug.autoPlaceSolution();
    },
    // 无尽模式演示：X 走 greedy（供录 gif 用）
    greedyPlace: () => {
      if (!run || run.state.mode !== 'endless') return false;
      if (run.state.phase !== 'playing') return false;
      const s = run.state;
      if (s.ai === '2p') {
        const es = s.board.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
        if (es.length) run.place(es[0]);
        return true;
      }
      if (s.turn !== X) return false;
      const mv = greedyMove(s.board, X, Math.random);
      if (mv == null) return false;
      run.place(mv);
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
buildLevelGrid();
updateRecord();
$('btn-mute').classList.toggle('is-muted', muted);
updateOverlay();
Sdk.track('load', {});
requestAnimationFrame(frame);
