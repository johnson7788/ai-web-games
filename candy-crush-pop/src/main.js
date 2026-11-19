// CANDY CRUSH POP · 主入口：60Hz 固定步长 + 标题/选关/游戏/暂停/结算 + 教程引导 + SDK 统一出口。
// 契约：window.__ll 调试口（§4）；教程 DOM 带 data-tutorial/data-tutorial-skip；竖屏提示带内联 onclick。
// 装配：sim(M1) / render+ui(M2) / audio(M4)。
import { STEP, LAYOUT, GAME } from '../config/game.config.js';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';
import { createRun, comboMult } from './game/sim.js';
import { createRenderer, CANDY } from './render/index.js';
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
let tutorialStep = -1;    // -1 = 未激活
let drag = null;          // {r,c,x,y}
let selectedCell = null;  // 点选待交换

const view = {
  hoverCell: null,
  cursor: { x: 0, y: 0 },
  fxQueue: [],
  hintCells: [],          // {r,c,ttl}
  shake: 0,
};

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let unlocked = Math.max(1, Sdk.load('unlocked', 1) | 0);
let starsByLevel = Sdk.load('stars', {}) || {};
let tutorialDone = !!Sdk.load('tutorialDone', false);
let lastLevel = Sdk.load('lastLevel', 0) | 0;
let bestByLevel = Sdk.load('best', {}) || {};

Sdk.ready();
audio.setMuted(muted);
ui.setMuted(muted);

function persist() {
  Sdk.save('unlocked', unlocked);
  Sdk.save('stars', starsByLevel);
  Sdk.save('muted', muted);
  Sdk.save('tutorialDone', tutorialDone);
  Sdk.save('lastLevel', lastLevel);
  Sdk.save('best', bestByLevel);
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
  view.fxQueue = [];
  view.hintCells = [];
  selectedCell = null;
  drag = null;
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
  if (run) Sdk.track('restart', { level: run.state.level + 1 });
  startLevel(run ? run.state.level - 1 : lastLevel);
}

function goHome() {
  run = null;
  setPhase('title');
  hideResult();
  ui.showTitle();
  buildLevelGrid();
}

// ---------- HUD / 侧栏 / 关卡格 ----------
function updateHud() {
  if (!run) return;
  const h = run.getHud();
  const lv = LEVELS[run.state.level - 1] || {};
  $('hud-level').textContent = `${t('level')} ${run.state.level}`;
  $('hud-moves').textContent = `${t('moves')} ${h.movesLeft}`;
  $('hud-moves').classList.toggle('move-low', h.movesLeft <= 3);
  const secs = Math.max(0, Math.ceil(h.timeLeft));
  $('hud-time').textContent = `${t('time')} ${secs}s`;
  $('hud-time').classList.toggle('time-low', secs <= 10);

  // 侧栏
  $('side-score').textContent = `${h.score}`;
  const pct = Math.max(0, Math.min(100, Math.round((h.score / Math.max(1, h.target)) * 100)));
  $('side-target-bar').style.width = `${pct}%`;
  $('side-target-text').textContent = `${t('target')} ${h.target} · ${pct}%`;
  const pips = document.querySelectorAll('#combo-meter .combo-pip');
  const onCount = Math.min(3, Math.max(0, h.combo));
  pips.forEach((p, i) => p.classList.toggle('on', i < onCount));
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
  const { won, stars, score, target, reason, hasNext } = res;
  $('result-title').textContent = won ? t('winTitle') : t('loseTitle');
  $('result-title').classList.toggle('lose', !won);
  const starsEl = $('result-stars');
  starsEl.innerHTML = won
    ? `<span class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>${stars >= 3 ? `<em>${t('perfect')}</em>` : ''}`
    : '';
  $('result-meta').textContent = won
    ? `${t('score')} ${score} / ${t('target')} ${target}`
    : (reason === 'timeOut' ? t('timeOut') : t('outOfMoves'));
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
    bestByLevel[idx] = Math.max(bestByLevel[idx] | 0, st.score);
    if (idx < LEVEL_COUNT) unlocked = Math.max(unlocked, idx + 1);
    buildLevelGrid();
  }
  persist();
  Sdk.track(won ? 'win' : 'fail', {
    level: st.level, stars, score: st.score, target: st.target,
    movesLeft: st.movesLeft, reason: ev.reason || null,
  });
  showResult({
    won, stars, score: st.score, target: st.target,
    reason: ev.reason || null, hasNext: st.level + 1 < LEVEL_COUNT,
  });
  audio.event(won ? 'win' : 'lose');
}

// ---------- 教程 ----------
const TUT_STEPS = () => [
  { text: t('tutStep1'), spot: 'grid' },
  { text: t('tutStep2'), spot: 'grid' },
  { text: t('tutStep3'), spot: 'grid' },
];

function layoutRect(which) {
  try {
    const lay = renderer.debugLayout();
    if (which === 'grid') return lay && lay.grid ? lay.grid : null;
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
    spot.style.left = `${rect.x - 6}px`;
    spot.style.top = `${rect.y - 6}px`;
    spot.style.width = `${rect.w + 12}px`;
    spot.style.height = `${rect.h + 12}px`;
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

const TUT_TRIGGER = ['swapStart', 'match', 'win'];

function tutorialAdvance(evType) {
  if (tutorialStep < 0 || tutorialStep >= TUT_TRIGGER.length) return;
  if (TUT_TRIGGER[tutorialStep] !== evType) return;
  tutorialStep += 1;
  if (tutorialStep >= TUT_TRIGGER.length) endTutorial();
  else renderTutorialStep();
}

// ---------- 事件消费 ----------
function cellPx(r, c) {
  const lay = renderer.debugLayout();
  if (!lay || !lay.grid) return null;
  return {
    x: lay.grid.x + c * lay.cell + lay.cell / 2,
    y: lay.grid.y + r * lay.cell + lay.cell / 2,
  };
}

function burst(r, c, color, count = 6) {
  const p = cellPx(r, c);
  if (!p) return;
  for (let i = 0; i < count; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const sp = 40 + Math.random() * 90;
    view.fxQueue.push({
      x: p.x, y: p.y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30,
      r: 2 + Math.random() * 3.5, color,
      ttl: 0.4 + Math.random() * 0.3, maxTtl: 0.6,
    });
  }
}

function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    tutorialAdvance(ev.type);
    switch (ev.type) {
      case 'match': {
        const c = CANDY[run.state.grid[ev.r]?.[ev.c]?.type] || CANDY[0];
        burst(ev.r, ev.c, c.color, Math.min(8, 3 + ev.len));
        view.shake = 2;
        break;
      }
      case 'rockBreak': {
        burst(ev.r, ev.c, '#BFE3FF', 8);
        view.shake = 3;
        break;
      }
      case 'comboBonus': {
        view.shake = 4;
        break;
      }
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
  if (!lay || !run) return null;
  const { grid } = lay;
  const c = Math.floor((p.x - grid.x) / lay.cell);
  const r = Math.floor((p.y - grid.y) / lay.cell);
  if (r < 0 || r >= run.state.rows || c < 0 || c >= run.state.cols) return null;
  return { r, c };
}

function trySwap(a, b) {
  if (!run || phase !== 'playing') return;
  const res = run.swap(a, b);
  if (res.ok) { selectedCell = null; updateHud(); }
}

const DRAG_DIST = 0.3; // 以 cell 为单位

canvas.addEventListener('pointermove', (e) => {
  view.cursor = canvasPos(e);
  view.hoverCell = (run && phase === 'playing') ? pickCell(view.cursor) : null;
});

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (!run || phase !== 'playing') return;
  const p = canvasPos(e);
  view.cursor = p;
  const cell = pickCell(p);
  if (cell) {
    drag = { r: cell.r, c: cell.c, x: p.x, y: p.y };
    selectedCell = null;
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (!drag || !run) return;
  const p = canvasPos(e);
  const lay = renderer.debugLayout();
  if (!lay) return;
  const dx = p.x - drag.x;
  const dy = p.y - drag.y;
  const th = lay.cell * DRAG_DIST;
  if (dx * dx + dy * dy < th * th) return;
  const from = { r: drag.r, c: drag.c };
  drag = null;
  const horizontal = Math.abs(dx) > Math.abs(dy);
  let target;
  if (horizontal) target = { r: from.r, c: from.c + (dx > 0 ? 1 : -1) };
  else target = { r: from.r + (dy > 0 ? 1 : -1), c: from.c };
  if (target.r < 0 || target.r >= run.state.rows || target.c < 0 || target.c >= run.state.cols) return;
  trySwap(from, target);
});

canvas.addEventListener('pointerup', (e) => {
  if (!drag || !run) return;
  const from = { r: drag.r, c: drag.c };
  drag = null;
  const p = canvasPos(e);
  const cell = pickCell(p);
  if (cell) {
    if (selectedCell) {
      const dr = Math.abs(selectedCell.r - cell.r);
      const dc = Math.abs(selectedCell.c - cell.c);
      if (dr + dc === 1) trySwap(selectedCell, cell);
      else selectedCell = cell;
    } else {
      selectedCell = cell;
    }
  }
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
  on('btn-next', () => startLevel((run ? run.state.level : lastLevel + 1)));
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-hint', () => {
    if (!run || phase !== 'playing') return;
    const h = run.hint();
    if (h) {
      view.hintCells = [{ r: h.a.r, c: h.a.c, ttl: 0.9 }, { r: h.b.r, c: h.b.c, ttl: 0.9 }];
    }
  });
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

  if (view.shake > 0) view.shake = Math.max(0, view.shake - dt * 16);
  for (const fx of view.fxQueue) {
    if (fx.ttl > 0) {
      fx.ttl -= dt;
      fx.x += (fx.vx || 0) * dt;
      fx.y += (fx.vy || 0) * dt;
      fx.vy = (fx.vy || 0) + 260 * dt;
    }
  }
  for (const hc of view.hintCells) if (hc.ttl > 0) hc.ttl -= dt;

  // 悬停高亮与提示高亮合并到 view.hintCells 由 render 画
  try {
    renderer.draw(run ? run.state : null, dt, { ...view, shake: view.shake });
  } catch (err) {
    console.warn('render error', err);
  }
  view.fxQueue = view.fxQueue.filter((fx) => fx.ttl > 0);
  view.hintCells = view.hintCells.filter((hc) => hc.ttl > 0);

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
  restart: () => restartLevel(),
  home: () => goHome(),
  sim: () => (run ? run.state : null),
  save: (k, v) => Sdk.save(k, v),
  ui,
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['swap', 'match', 'target']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
  },
  startTutorial: () => startTutorial(),
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: () => {
      if (!run) return null;
      const st = run.state;
      let rockCount = 0;
      for (const row of st.grid) for (const cell of row) if (cell.rock > 0) rockCount++;
      return { ...st, grid: st.grid, rockCount };
    },
    layout: () => { try { return renderer.debugLayout(); } catch { return null; } },
    loadLevel: (i) => startLevel(i),
    startSeeded: (i, seed) => {
      const idx = Math.max(0, Math.min(LEVEL_COUNT - 1, i | 0));
      lastLevel = idx;
      run = createRun(idx, { seed: seed | 0 || 1 });
      view.fxQueue = [];
      view.hintCells = [];
      selectedCell = null;
      drag = null;
      setPhase('playing');
      ui.showGame();
      hideResult();
      updateHud();
      return true;
    },
    hint: () => (run ? run.hint() : null),
    // 贪婪自动玩一局（与 tools/selfplay.mjs 同策略），返回是否通关
    autoPlay: () => {
      if (!run) return false;
      let guard = 0;
      while (run.state.phase === 'playing' && guard++ < 200000) {
        if (run.state.action === 'idle') {
          const h = run.hint();
          if (!h) break;
          run.swap(h.a, h.b);
        }
        run.step(1 / 60);
      }
      handleEvents(run.drainEvents());
      updateHud();
      return run.state.phase;
    },
    fastForward: () => window.__ll.debug.autoPlay(),
    giveUp: () => window.__ll.debug.autoPlay(),
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
