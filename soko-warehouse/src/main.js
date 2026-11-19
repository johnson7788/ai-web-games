// 主入口：60Hz 固定步长 + 标题/选关/游戏/暂停/结算 + 教程引导 + SDK 统一出口
// 契约见 brief §4。装配：sim / render / audio / ui。
import { STEP, LAYOUT } from '../config/game.config.js';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';
import { createRun } from './game/sim.js';
import { solveLevel } from './game/level.js';
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
let phase = 'title'; // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let fpsSamples = [];
let tutorialStep = -1; // -1 = 未激活

const view = {
  time: 0,
  sceneKey: 'crate-yard',
  facing: 'down',
  fxQueue: [],
  shake: 0,
  cursor: { x: 0, y: 0 },
  hoverCell: null,
};

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let unlocked = Math.max(1, Sdk.load('unlocked', 1) | 0);
let starsByLevel = Sdk.load('stars', {}) || {};
let tutorialDone = !!Sdk.load('tutorialDone', false);
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
  Sdk.save('lastLevel', lastLevel);
}

function totalStars() {
  return Object.values(starsByLevel).reduce((a, b) => a + (b | 0), 0);
}

function countRocks(st) {
  let n = 0;
  for (const row of st.terrain) for (const cell of row) if (cell.kind === 'rock') n += 1;
  return n;
}

// ---------- 阶段状态机 ----------
function setPhase(p) { phase = p; }

function startLevel(idx) {
  idx = Math.max(0, Math.min(LEVEL_COUNT - 1, idx | 0));
  lastLevel = idx;
  run = createRun(idx, { seed: (Date.now() % 2147483647) || 1 });
  view.sceneKey = LEVELS[idx].scene || 'crate-yard';
  view.facing = 'down';
  view.fxQueue = [];
  view.shake = 0;
  setPhase('playing');
  ui.showGame();
  hideResult();
  updateHud();
  audio.startBgm();
  Sdk.track('start', { level: idx + 1 });
  persist();
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
  const h = run.getHud();
  const lv = LEVELS[run.state.level - 1] || {};
  $('hud-level').textContent = `${t('level')} ${h.level}${lv.name ? ' · ' + (lv.name[i18n.lang] || lv.name.en || '') : ''}`;
  const movesEl = $('hud-moves');
  movesEl.textContent = `${t('moves')} ${h.moves}/${h.moveLimit}`;
  movesEl.classList.toggle('warn', h.moveLimit - h.moves <= 3);
  $('hud-boxes').textContent = `${t('cargo')} ${h.boxesOnTarget}/${h.boxTotal}`;
  const comboEl = $('hud-combo');
  if (h.combo >= 2) { comboEl.classList.remove('hidden'); comboEl.textContent = `${t('combo')} ×${h.combo}`; }
  else comboEl.classList.add('hidden');
  $('btn-undo').textContent = `↩${h.undoLeft}`;
  $('btn-undo').disabled = h.undoLeft <= 0;
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
    cell.setAttribute('aria-label', `${t('level')} ${i + 1}${i + 1 > unlocked ? ' ' + t('locked') : ''}`);
    grid.appendChild(cell);
  }
  $('stars-total').textContent = `★ ${totalStars()} / ${LEVEL_COUNT * 3}`;
}

function showResult(res) {
  const { won, stars, moves, par, combo, hasNext } = res;
  const titleEl = $('result-title');
  titleEl.textContent = won ? t('winTitle') : t('loseTitle');
  titleEl.classList.toggle('lose', !won);
  const starsEl = $('result-stars');
  starsEl.innerHTML = won
    ? `<span class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>${stars >= 3 ? `<em>${t('perfect')}</em>` : ''}`
    : '';
  $('result-meta').textContent = won
    ? `${t('resultMoves')} ${moves} · ${t('parLabel')} ${par} · ${t('resultCombo')} ×${combo}`
    : t('outOfMoves');
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
    buildLevelGrid();
  }
  persist();
  Sdk.track(won ? 'win' : 'fail', { level: st.level, stars, moves: st.moves, combo: st.maxCombo });
  showResult({ won, stars, moves: st.moves, par: st.par, combo: st.maxCombo, hasNext: st.level < LEVEL_COUNT });
  audio.event(won ? 'win' : 'lose');
}

// ---------- 教程引导 ----------
const TUT_STEPS = () => [
  { text: t('tutStep1'), spot: 'player' },
  { text: t('tutStep2'), spot: 'box' },
  { text: t('tutStep3'), spot: 'target' },
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
    spot.style.left = `${rect.x - 6}px`;
    spot.style.top = `${rect.y - 6}px`;
    spot.style.width = `${rect.w + 12}px`;
    spot.style.height = `${rect.h + 12}px`;
  } else {
    spot.style.display = 'none';
  }
  $('tut-card').style.left = '';
  $('tut-card').style.top = '';
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

const TUT_TRIGGER = ['move', 'push', 'target'];
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
    if (ev.type === 'win' || ev.type === 'lose') {
      audio.event(ev.type, ev);
      finishRun(ev);
      return;
    }
    switch (ev.type) {
      case 'move':
        audio.event('move');
        tutorialAdvance('move');
        view.facing = ev.dir;
        break;
      case 'push':
        audio.event('push');
        tutorialAdvance('push');
        view.facing = ev.dir;
        view.shake = 2;
        view.fxQueue.push({ type: 'dust', r: ev.r, c: ev.c, ttl: 0.3, maxTtl: 0.3, color: '#fbbf24' });
        break;
      case 'target':
        audio.event('target');
        view.fxQueue.push({ type: 'flash', r: ev.r, c: ev.c, ttl: 0.45, maxTtl: 0.45, color: '#34d399' });
        view.shake = 3;
        break;
      case 'offTarget':
        audio.event('offTarget');
        break;
      case 'combo':
        audio.event('combo', { combo: ev.combo });
        view.fxQueue.push({ type: 'flash', r: ev.r, c: ev.c, ttl: 0.35, maxTtl: 0.35, color: '#fb923c' });
        break;
      case 'undo':
        audio.event('undo');
        break;
      default:
        break;
    }
  }
}

// ---------- 输入 ----------
function moveBy(dir) {
  if (!run || phase !== 'playing') return;
  const res = run.move(dir);
  if (res.ok) {
    handleEvents(run.drainEvents());
    updateHud();
  }
}

function canvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (1280 / rect.width),
    y: (e.clientY - rect.top) * (720 / rect.height),
  };
}

function pickCell(p) {
  const lay = renderer.debugLayout();
  if (!lay || !run) return null;
  const cell = lay.cell;
  const board = lay.board;
  const c = Math.floor((p.x - board.x) / cell);
  const r = Math.floor((p.y - board.y) / cell);
  if (r < 0 || r >= run.state.rows || c < 0 || c >= run.state.cols) return null;
  return { r, c };
}

function directionFromPlayer(p) {
  const lay = renderer.debugLayout();
  if (!lay || !run) return null;
  const pr = lay.player;
  const px = pr.x + pr.w / 2;
  const py = pr.y + pr.h / 2;
  const dx = p.x - px;
  const dy = p.y - py;
  if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return null;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (!run || phase !== 'playing') return;
  const p = canvasPos(e);
  const dir = directionFromPlayer(p);
  if (dir) moveBy(dir);
});

window.addEventListener('keydown', (e) => {
  const map = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    w: 'up', s: 'down', a: 'left', d: 'right',
  };
  const dir = map[e.key];
  if (dir && phase === 'playing') { e.preventDefault(); audio.unlock(); moveBy(dir); return; }
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
  if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'result')) restartLevel();
  if (e.code === 'KeyM') toggleMute();
  if (e.code === 'KeyZ' && phase === 'playing') doUndo();
});

function doUndo() {
  if (!run || phase !== 'playing') return;
  const res = run.undo();
  if (res.ok) {
    handleEvents(run.drainEvents());
    updateHud();
  }
}

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
  on('btn-undo', doUndo);
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result') startTutorial(); });
  on('btn-tut-replay', () => { if (phase === 'paused') resumeGame(); if (phase === 'playing') startTutorial(); });
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);

  $('btn-rotate-skip')?.addEventListener('click', () => {
    const rs = $('rotate-screen');
    if (rs) rs.style.display = 'none';
  });

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
      $('rotate-text').textContent = t('rotateHint');
      $('btn-rotate-skip').textContent = t('rotateSkip');
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
    }
    handleEvents(run.drainEvents());
    if (run && phase === 'playing') updateHud();
  }

  if (view.shake > 0) view.shake = Math.max(0, view.shake - dt * 16);
  for (const fx of view.fxQueue) if (fx.ttl > 0) fx.ttl -= dt;
  view.fxQueue = view.fxQueue.filter((fx) => fx.ttl > 0);

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
  ui: { share: (payload) => Sdk.share(payload || {}) },
  start: (i) => startLevel(i == null ? (lastLevel || 0) : i),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => restartLevel(),
  home: () => goHome(),
  sim: () => (run ? run.state : null),
  save: (k, v) => Sdk.save(k, v),
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['move', 'push', 'dock']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip() { endTutorial(); },
  },
  startTutorial: () => startTutorial(),
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: () => {
      if (!run) return null;
      const st = run.state;
      return {
        rows: st.rows, cols: st.cols, phase: st.phase, level: st.level,
        boxes: st.boxes.length, targets: st.targets.size, rocks: countRocks(st),
        moves: st.moves, moveLimit: st.moveLimit, boxesOnTarget: st.boxesOnTarget,
        par: st.par, stars: st.stars, player: { ...st.player },
      };
    },
    loadLevel: (i) => startLevel(i),
    solve: () => {
      if (!run) return false;
      const sol = solveLevel(run._level);
      if (!sol) return false;
      for (const m of sol.moves) run.move(m);
      handleEvents(run.drainEvents());
      return run.state.phase === 'won' || run.state.phase === 'result';
    },
    move: (dir) => moveBy(dir),
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
  },
};

// ---------- 启动 ----------
bind();
syncDocumentLang();
ui.applyLang();
$('rotate-text').textContent = t('rotateHint');
$('btn-rotate-skip').textContent = t('rotateSkip');
buildLevelGrid();
$('btn-mute').textContent = muted ? '🔇' : '🔊';
$('btn-mute').classList.toggle('is-muted', muted);
Sdk.track('load', {});
requestAnimationFrame(frame);
