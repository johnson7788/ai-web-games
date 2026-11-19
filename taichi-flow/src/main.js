// TAICHI FLOW · 主入口：60Hz 固定步长 + 标题/选关/游戏/暂停/结算 + 教程 + SDK 统一出口。
// 装配：sim（纯逻辑）/ render（canvas 霓虹）/ ui（DOM 屏幕）/ audio（WebAudio）/ Sdk。
import { STEP, GAME } from '../config/game.config.js';
import { LEVELS, LEVEL_COUNT, SIZE } from '../config/levels.js';
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
const reducedMotion = (typeof matchMedia === 'function') && matchMedia('(prefers-reduced-motion: reduce)').matches;

let run = null;
let phase = 'title'; // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let tutorialStep = -1;

// 存档（统一走 Sdk）
let muted = !!Sdk.load('muted', false);
let unlocked = Math.max(1, Sdk.load('unlocked', 1) | 0);
let starsByLevel = Sdk.load('stars', {}) || {};
let tutorialDone = !!Sdk.load('tutorialDone', false);
let lastLevel = Sdk.load('lastLevel', 0) | 0;

const view = {
  hoverCell: null,
  cursor: { x: 0, y: 0 },
  shake: 0,
  time: 0,
};

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

// ---------- 阶段状态机 ----------
function setPhase(p) { phase = p; }

function startLevel(idx) {
  idx = Math.max(0, Math.min(LEVEL_COUNT - 1, idx | 0));
  lastLevel = idx;
  run = createRun(idx, {});
  view.hoverCell = null;
  view.shake = 0;
  setPhase('playing');
  ui.showGame();
  ui.hideResult();
  updateHud();
  audio.startBgm();
  Sdk.newRun({ level: idx + 1 });
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
  ui.hideResult();
  ui.showTitle();
  buildLevelGrid();
}

// ---------- HUD / 关卡格 / 结算 ----------
function updateHud() {
  if (!run) return;
  const h = run.getHud();
  const lv = LEVELS[run.state.level - 1] || {};
  const lvName = lv.name ? (lv.name[i18n.lang] || lv.name.en || '') : '';
  $('hud-level').textContent = `${t('level')} ${run.state.level}${lvName ? ' · ' + lvName : ''}`;
  $('hud-moves').textContent = `${t('moves')} ${h.moves}/${h.par}`;
  $('hud-goal').textContent = `${t('goal')} ${h.matched}/${h.targetCount}`;
  $('hud-combo').textContent = h.bestCombo >= 2 ? `${t('combo')} ×${h.bestCombo}` : '';
  $('hud-stars').textContent = '★'.repeat(h.stars) + '☆'.repeat(Math.max(0, 3 - h.stars));
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
    cell.innerHTML =
      `<span class="lv-num">${i + 1}</span>` +
      `<span class="lv-stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>`;
    cell.setAttribute('aria-label', `${t('level')} ${i + 1}${i + 1 > unlocked ? ' ' + t('locked') : ''}`);
    grid.appendChild(cell);
  }
  $('stars-total').textContent = `★ ${totalStars()} / ${LEVEL_COUNT * 3}`;
}

function showResult(res) {
  const { won, stars, moves, par, reason } = res;
  $('result-title').textContent = won ? t('winTitle') : t('loseTitle');
  $('result-title').classList.toggle('lose', !won);
  $('result-stars').innerHTML = won
    ? `<span class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>${stars >= 3 ? `<em>${t('perfect')}</em>` : ''}`
    : '';
  $('result-time').textContent = won ? `${t('moves')} ${moves} / ${t('par')} ${par}` : '';
  $('result-meta').textContent = won ? '' : (reason === 'movesOut' ? t('movesOut') : '');
  $('btn-next').style.display = won && run.state.level < LEVEL_COUNT ? '' : 'none';
  ui.showResult();
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
  const stars = won ? (st.stars || 1) : 0;
  if (won) {
    const idx = st.level;
    starsByLevel[idx] = Math.max(starsByLevel[idx] | 0, stars);
    if (idx < LEVEL_COUNT) unlocked = Math.max(unlocked, idx + 1);
    buildLevelGrid();
    Sdk.levelCleared({ level: idx, stars, moves: st.moves });
  } else {
    Sdk.gameOver({ level: st.level, moves: st.moves });
  }
  persist();
  audio.event(won ? 'win' : 'lose');
  showResult({ won, stars, moves: st.moves, par: st.par, reason: ev.reason });
}

// ---------- 教程 ----------
const TUT_STEPS = () => [
  { id: 'tap', text: t('tutStep1'), spot: 'cell' },
  { id: 'match', text: t('tutStep2'), spot: 'grid' },
  { id: 'star', text: t('tutStep3'), spot: 'hud' },
];

function startTutorial() {
  tutorialStep = 0;
  renderTutorialStep();
}

function tutorialRect(spot) {
  try {
    const lay = renderer.debugLayout();
    if (spot === 'grid') return { x: lay.grid.x, y: lay.grid.y, w: lay.grid.board, h: lay.grid.board };
    if (spot === 'cell') {
      const r = renderer.cellRect(24);
      return { x: r.x, y: r.y, w: r.w, h: r.h };
    }
    if (spot === 'hud') return { x: 12, y: 8, w: 320, h: 44 };
  } catch { /* noop */ }
  return null;
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
  const rect = s && tutorialRect(s.spot);
  const spot = $('tut-spotlight');
  const card = $('tut-card');
  if (rect) {
    spot.style.display = 'block';
    spot.style.left = `${rect.x - 8}px`;
    spot.style.top = `${rect.y - 8}px`;
    spot.style.width = `${rect.w + 16}px`;
    spot.style.height = `${rect.h + 16}px`;
  } else {
    spot.style.display = 'none';
  }
  card.style.left = '50%';
  card.style.top = 'auto';
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
  if (tutorialStep < 0 || tutorialStep >= TUT_STEPS().length) return;
  if (evType !== 'tap') return;
  tutorialStep += 1;
  if (tutorialStep >= TUT_STEPS().length) endTutorial();
  else renderTutorialStep();
}

// ---------- 事件消费 ----------
function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    tutorialAdvance(ev.type);
    switch (ev.type) {
      case 'swap':
        view.shake = GAME.SHAKE_AMP;
        break;
      case 'combo':
        view.shake = GAME.SHAKE_AMP + 3;
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

function pickCell(p) {
  const lay = renderer.debugLayout();
  const { grid } = lay;
  const c = Math.floor((p.x - grid.x) / (grid.cell + grid.gap));
  const r = Math.floor((p.y - grid.y) / (grid.cell + grid.gap));
  if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return null;
  const idx = r * SIZE + c;
  const rect = renderer.cellRect(idx);
  const inside = p.x >= rect.x && p.x <= rect.x + rect.w && p.y >= rect.y && p.y <= rect.y + rect.h;
  return inside ? idx : null;
}

canvas.addEventListener('pointermove', (e) => {
  view.cursor = canvasPos(e);
  view.hoverCell = (run && phase === 'playing') ? pickCell(view.cursor) : null;
});

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (!run || phase !== 'playing') return;
  const p = canvasPos(e);
  const idx = pickCell(p);
  if (idx == null) return;
  const res = run.click(idx);
  if (res.ok) {
    const cell = run.state.cells[idx];
    cell.flash = 0.3;
    handleEvents(run.drainEvents());
    updateHud();
  }
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
  if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'result')) restartLevel();
  if (e.code === 'KeyM') toggleMute();
  if (e.code === 'KeyZ' && phase === 'playing') doUndo();
});

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  ui.setMuted(muted);
  persist();
}

function doUndo() {
  if (!run || phase !== 'playing') return;
  const res = run.undo();
  if (res.ok) {
    handleEvents(run.drainEvents());
    updateHud();
  }
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
  on('btn-next', () => startLevel((run ? run.state.level : lastLevel + 1) - 1));
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-undo', doUndo);
  on('btn-howto', () => { if (phase !== 'playing') startTutorial(); else startTutorial(); });
  on('btn-tut-replay', () => { if (phase === 'paused') resumeGame(); startTutorial(); });
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);
  on('btn-rotate-skip', () => {
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
  if (!reducedMotion) view.time += dt;

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
  if (run) for (const c of run.state.cells) if (c.flash > 0) c.flash -= dt;

  try {
    renderer.draw(phase === 'title' ? null : (run ? run.state : null), dt, view);
  } catch (err) {
    console.warn('render error', err);
  }

  requestAnimationFrame(frame);
}

// ---------- 调试契约 ----------
window.__ll = {
  state: {
    get phase() { return phase; },
    get lang() { return i18n.lang; },
    get dir() { return i18n.dir; },
  },
  lang: () => i18n.lang,
  setLang: (lang) => ui.setLang(lang),
  run: () => run,
  start: (i) => startLevel(i == null ? lastLevel : i),
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
    get steps() { return ['tap', 'match', 'star']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
  },
  startTutorial: () => startTutorial(),
  debug: {
    state: () => {
      if (!run) return null;
      const st = run.state;
      return {
        level: st.level,
        phase: st.phase,
        size: st.size,
        moves: st.moves,
        par: st.par,
        stars: st.stars,
        matched: st.matched,
        targetCount: st.targetCount,
        cells: st.cells.map((c) => c.color),
        rocks: st.rocks.length,
        target: st.target.length,
        scramble: st.scramble.length,
      };
    },
    layout: () => { try { return renderer.debugLayout(); } catch { return null; } },
    loadLevel: (i) => startLevel(i),
    startSeeded: (i) => startLevel(i),
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    autoSolve: () => {
      if (!run || phase !== 'playing') return false;
      const seq = [...run.state.scramble].reverse();
      for (const idx of seq) run.click(idx);
      handleEvents(run.drainEvents());
      return run.state.phase === 'won';
    },
    fastForward: () => {
      if (!run) return false;
      return window.__ll.debug.autoSolve();
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
$('btn-mute').classList.toggle('is-muted', muted);
Sdk.track('load', {});
requestAnimationFrame(frame);
