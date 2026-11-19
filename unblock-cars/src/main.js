// UNBLOCK CARS · 主入口：60Hz 固定步长 + 标题/选关/游戏/暂停/结算 + 拖动交互 + 教程 + SDK
// 装配：sim（纯逻辑） / render（canvas 霓虹） / ui（语言与屏幕） / audio（WebAudio synthwave）
// 契约：window.__ll 调试口（见文件尾部）；教程 DOM 带 data-tutorial / data-tutorial-skip。
import { STEP, GAME } from '../config/game.config.js';
import { LEVEL_COUNT, COLS, ROWS } from './game/levels.js';
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
let phase = 'title'; // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let fpsSamples = [];
let tutorialStep = -1;
let dragCar = null;
let dragStart = null;
let dragStartCoord = 0;

const reducedMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const view = {
  hoverCar: null,
  drag: null,
  cursor: { x: 0, y: 0 },
  fx: [],
  shake: 0,
  reducedMotion,
};

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let unlocked = Math.max(1, Sdk.load('unlocked', 1) | 0);
let starsByLevel = Sdk.load('stars', {}) || {};
let bestMoves = Sdk.load('bestMoves', {}) || {};
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
  Sdk.save('bestMoves', bestMoves);
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
  run = createRun(idx);
  dragCar = null;
  view.drag = null;
  view.hoverCar = null;
  view.fx = [];
  setPhase('playing');
  ui.showGame();
  hideResult();
  hideTutorial();
  updateHud();
  audio.startBgm();
  Sdk.track('start', { level: idx + 1 });
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
  hideResult();
  ui.showTitle();
  buildLevelGrid();
  audio.stopBgm();
}

// ---------- HUD / 关卡格 / 结算 ----------
function fmtClock(sec) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

function updateHud() {
  if (!run) return;
  const h = run.getHud();
  $('hud-level').textContent = `${t('level')} ${h.level}`;
  $('hud-time').textContent = `${t('time')} ${fmtClock(h.elapsed)}`;
  $('hud-moves').textContent = `${t('moves')} ${h.moves}/${h.maxMoves}`;
  $('hud-par').textContent = `${t('par')} ${h.par}`;
  $('hud-score').textContent = `${t('score')} ${h.score}`;
  const comboEl = $('hud-combo');
  comboEl.textContent = h.combo >= 2 ? `${t('combo')} ×${h.combo}` : '';
  comboEl.style.opacity = h.combo >= 2 ? '1' : '0.35';
  $('hud-moves').classList.toggle('moves-low', h.moves >= h.maxMoves - Math.max(4, h.maxMoves * 0.15));
  $('hint-badge').textContent = h.hintsLeft;
  $('btn-hint').disabled = h.hintsLeft <= 0;
  $('btn-undo').disabled = run.state.history.length === 0;
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
  $('stars-total').textContent = `★ ${totalStars()}`;
}

function showResult(res) {
  const { won, stars, score, moves, par, best, hasNext } = res;
  $('result-title').textContent = won ? t('winTitle') : t('loseTitle');
  $('result-title').classList.toggle('lose', !won);
  $('result-stars').innerHTML = won
    ? `<span class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>${stars >= 3 ? `<em>${t('perfect')}</em>` : ''}`
    : '';
  $('result-meta').textContent = won
    ? `${t('score')} ${score} · ${t('moves')} ${moves} / ${t('par')} ${par} · ${t('best')} ${best}`
    : t('stalled');
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
  let best = null;
  if (won) {
    const idx = st.level;
    starsByLevel[idx] = Math.max(starsByLevel[idx] | 0, stars);
    if (idx < LEVEL_COUNT) unlocked = Math.max(unlocked, idx + 1);
    const prevBest = bestMoves[idx];
    if (prevBest == null || st.moves < prevBest) bestMoves[idx] = st.moves;
    best = bestMoves[idx];
    buildLevelGrid();
  }
  persist();
  Sdk.track(won ? 'win' : 'fail', { level: st.level, stars, moves: st.moves, par: st.par, score: st.score });
  if (won) Sdk.levelCleared({ level: st.level, stars, moves: st.moves });
  else Sdk.gameOver({ level: st.level, reason: ev.reason });
  showResult({
    won, stars, score: st.score, moves: st.moves, par: st.par, best,
    hasNext: st.level < LEVEL_COUNT,
  });
  audio.event(won ? 'win' : 'lose');
}

// ---------- 教程 ----------
const TUT_STEPS = () => [
  { text: t('tutStep1'), spot: 'board' },
  { text: t('tutStep2'), spot: 'board' },
  { text: t('tutStep3'), spot: 'hud' },
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
  const card = $('tut-card');
  if (s && s.spot === 'board') {
    const lay = renderer.debugLayout();
    const b = lay.board;
    spot.style.display = 'block';
    spot.style.left = `${b.x - 10}px`;
    spot.style.top = `${b.y - 10}px`;
    spot.style.width = `${b.w + 20}px`;
    spot.style.height = `${b.h + 20}px`;
  } else {
    spot.style.display = 'none';
  }
  card.style.left = '';
  card.style.top = '';
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
  tutorialStep = -1;
  const el = $('tutorial');
  if (el) el.classList.add('hidden');
}

// ---------- 事件消费 ----------
function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    switch (ev.type) {
      case 'move': {
        const car = run.state.cars.find((c) => c.id === ev.carId);
        if (car) {
          const r = renderer.debugLayout().carRect(car);
          spawnBurst(r.x + r.w / 2, r.y + r.h / 2, car.hero ? '#1ffcff' : '#ff3ea5', 6);
        }
        if (tutorialStep >= 0) endTutorial(); // 首次真实操作即结束引导
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

function spawnBurst(x, y, color, n) {
  if (reducedMotion || view.fx.length > 80) return;
  for (let i = 0; i < n; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const sp = 40 + Math.random() * 90;
    view.fx.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 0.4 + Math.random() * 0.3,
      ttl: 0.4 + Math.random() * 0.3,
      size: 2 + Math.random() * 3,
      color,
    });
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

function pickCar(p) {
  if (!run) return null;
  const lay = renderer.debugLayout();
  // hero 最后画（置顶），因此反向命中
  for (let i = run.state.cars.length - 1; i >= 0; i -= 1) {
    const car = run.state.cars[i];
    const r = lay.carRect(car);
    if (p.x >= r.x - 4 && p.x <= r.x + r.w + 4 && p.y >= r.y - 4 && p.y <= r.y + r.h + 4) return car;
  }
  return null;
}

canvas.addEventListener('pointermove', (e) => {
  view.cursor = canvasPos(e);
  if (dragCar) {
    const car = run.state.cars.find((c) => c.id === dragCar);
    if (car) {
      const lay = renderer.debugLayout();
      const key = car.o === 'H' ? 'col' : 'row';
      const cells = (car.o === 'H' ? view.cursor.x - dragStart.x : view.cursor.y - dragStart.y) / lay.cell;
      const raw = Math.round(dragStartCoord + cells);
      const max = car.o === 'H' ? COLS - car.len : ROWS - car.len;
      view.drag = { carId: dragCar, to: Math.max(0, Math.min(max, raw)) };
    }
  } else {
    view.hoverCar = (run && phase === 'playing') ? (pickCar(view.cursor) ? pickCar(view.cursor).id : null) : null;
  }
});

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (!run || phase !== 'playing') return;
  const p = canvasPos(e);
  view.cursor = p;
  const car = pickCar(p);
  if (!car) return;
  dragCar = car.id;
  dragStart = p;
  dragStartCoord = car.o === 'H' ? car.col : car.row;
  view.drag = { carId: car.id, to: dragStartCoord };
});

function endDrag() {
  if (dragCar == null) return;
  const to = view.drag ? view.drag.to : dragStartCoord;
  const carId = dragCar;
  dragCar = null;
  view.drag = null;
  if (run && phase === 'playing') {
    run.moveCar(carId, to);
    handleEvents(run.drainEvents());
    if (run && phase === 'playing') updateHud();
  }
}

canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('pointerleave', () => {
  if (!dragCar) view.hoverCar = null;
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
  if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'result')) restartLevel();
  if (e.code === 'KeyM') toggleMute();
  if (e.code === 'KeyH' && phase === 'playing') doHint();
  if (e.code === 'KeyU' && phase === 'playing') doUndo();
  if ((e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'ArrowUp' || e.code === 'ArrowDown') && phase === 'playing' && run) {
    e.preventDefault();
    // 键盘：优先移动 hero 车
    const car = run.state.cars.find((c) => c.hero);
    if (car) {
      const dir = e.code === 'ArrowLeft' ? 'left' : e.code === 'ArrowRight' ? 'right' : e.code === 'ArrowUp' ? 'up' : 'down';
      run.nudge(car.id, dir);
      handleEvents(run.drainEvents());
      updateHud();
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

function doHint() {
  if (!run || phase !== 'playing') return;
  audio.event('click');
  const res = run.hint();
  if (res.ok) Sdk.track('hint', { level: run.state.level });
  handleEvents(run.drainEvents());
  updateHud();
}

function doUndo() {
  if (!run || phase !== 'playing') return;
  audio.event('click');
  const res = run.undo();
  if (res.ok) Sdk.track('undo', { level: run.state.level });
  handleEvents(run.drainEvents());
  updateHud();
}

// ---------- UI 绑定 ----------
function bind() {
  const on = (id, fn) => {
    const el = $(id);
    if (el) el.addEventListener('click', () => { audio.unlock(); audio.event('click'); fn(); });
  };
  on('btn-start', () => startLevel(lastLevel || 0));
  on('btn-resume', resumeGame);
  on('btn-restart', restartLevel);
  on('btn-restart2', restartLevel);
  on('btn-retry', restartLevel);
  on('btn-next', () => startLevel((run ? run.state.level : lastLevel)));
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-hint', doHint);
  on('btn-undo', doUndo);
  on('btn-tut-replay', () => {
    if (phase === 'paused') resumeGame();
    if (phase === 'playing') startTutorial();
  });
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result') startTutorial(); });
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);

  $('level-grid')?.addEventListener('click', (e) => {
    const idx = e.target.closest('[data-level]')?.dataset.level;
    if (idx == null) return;
    const i = +idx;
    if (i + 1 > unlocked) return;
    audio.unlock();
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

  if (view.shake > 0) view.shake = Math.max(0, view.shake - dt * 18);
  for (const p of view.fx) {
    if (p.ttl > 0) {
      p.ttl -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 120 * dt;
    }
  }
  view.fx = view.fx.filter((p) => p.ttl > 0);

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
  restart: () => restartLevel(),
  home: () => goHome(),
  sim: () => (run ? run.state : null),
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['drag', 'exit', 'par']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
  },
  startTutorial: () => startTutorial(),
  save: (k, v) => Sdk.save(k, v),
  load: (k, f) => Sdk.load(k, f),
  share: (p) => Sdk.share(p || {}),
  ui,
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: () => {
      if (!run) return null;
      const st = run.state;
      return {
        phase: st.phase,
        level: st.level,
        moves: st.moves,
        par: st.par,
        maxMoves: st.maxMoves,
        cars: st.cars.length,
        rocks: st.rocks.length,
        hasRocks: st.rocks.length > 0,
        heroRow: st.heroRow,
        stars: st.stars,
        score: st.score,
        hintsLeft: st.hintsLeft,
      };
    },
    layout: () => { try { return renderer.debugLayout(); } catch { return null; } },
    loadLevel: (i) => startLevel(i),
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    solve: () => (run ? (run.solve() || []).length : 0),
    autoSolve: () => {
      if (!run) return false;
      const sol = run.solve();
      if (!sol || !sol.length) return false;
      for (const m of sol) run.moveCar(m.carId, m.to);
      handleEvents(run.drainEvents());
      return run.state.phase === 'won';
    },
    moveHero: (dir) => {
      if (!run) return false;
      const car = run.state.cars.find((c) => c.hero);
      if (!car) return false;
      return run.nudge(car.id, dir).ok;
    },
    hint: () => { if (run) run.hint(); handleEvents(run.drainEvents()); return true; },
  },
};

// ---------- 启动 ----------
renderer.resize();
window.addEventListener('resize', () => renderer.resize());
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
