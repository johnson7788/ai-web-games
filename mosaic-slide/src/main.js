// 主入口：60Hz 固定步长 + 标题/选关/游戏/暂停/结算 + 教程引导 + SDK 统一出口。
// 契约见 docs/README.md。装配：sim / render+ui / audio / Lead 集成。
import { STEP, GAME } from '../config/game.config.js';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';
import { createRun } from './game/sim.js';
import { solveScramble, indexToRC } from './game/solver.js';
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
let phase = 'title';       // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let fpsSamples = [];
let rotateArmed = false;
let tutorialStep = -1;     // -1 = 未激活

const view = {
  hoverCell: null,
  cursor: { x: 0, y: 0 },
  fxQueue: [],
  shake: 0,
  goalLabel: 'Goal',
  peekLabel: 'Peek',
  rotateLabel: 'Rotate',
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

function syncLabels() {
  view.goalLabel = t('goal');
  view.peekLabel = t('peek');
  view.rotateLabel = t('rotate');
}

// ---------- 阶段状态机 ----------
function setPhase(p) { phase = p; }

function startLevel(idx, opts = {}) {
  idx = Math.max(0, Math.min(LEVEL_COUNT - 1, idx | 0));
  lastLevel = idx;
  rotateArmed = false;
  run = createRun(idx, { seed: opts.seed != null ? opts.seed : ((Date.now() % 2147483647) || 1) });
  view.hoverCell = null;
  setPhase('playing');
  ui.showGame();
  hideResult();
  updateHud();
  audio.startBgm();
  Sdk.newRun({ level: idx + 1 });
  if (!tutorialDone && idx === 0 && !opts.noTutorial) startTutorial();
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
  $('hud-level').textContent = `${t('level')} ${run.state.level}`;
  $('hud-moves').textContent = `${h.moves} / ${h.movePar}`;
  const secs = Math.max(0, Math.ceil(h.timeLeft));
  const timeEl = $('hud-time');
  timeEl.textContent = secs + 's';
  timeEl.classList.toggle('time-low', secs <= 10);
  const rotBtn = $('btn-rotate');
  if (rotBtn) {
    rotBtn.style.display = h.rotate ? '' : 'none';
    rotBtn.classList.toggle('armed', rotateArmed);
  }
  const peekBtn = $('btn-peek');
  if (peekBtn) {
    peekBtn.style.display = h.blind ? '' : 'none';
    const badge = $('peek-badge');
    if (badge) badge.textContent = h.peekLeft;
  }
}

function buildLevelGrid() {
  const grid = $('level-grid');
  if (!grid) return;
  grid.innerHTML = '';
  for (let i = 0; i < LEVEL_COUNT; i += 1) {
    const cell = document.createElement('button');
    cell.className = 'level-cell' + (i + 1 > unlocked ? ' level-locked' : '');
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
  const { won, stars, moves, movePar, timeLeft, hasNext } = res;
  $('result-title').textContent = won ? t('winTitle') : t('loseTitle');
  $('result-title').classList.toggle('lose', !won);
  $('result-stars').innerHTML = won
    ? `<span class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>${stars >= 3 ? `<em>${t('perfect')}</em>` : ''}`
    : '';
  $('result-meta').textContent = won
    ? `${t('movesUsed', { n: moves })} · ${t('timeLeft', { s: Math.ceil(timeLeft) })}`
    : t('timeOut');
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
  Sdk.track(won ? 'win' : 'fail', {
    level: st.level, stars, moves: st.moves, durationMs: Math.round((st.initialTime - st.timeLeft) * 1000),
  });
  showResult({
    won, stars, moves: st.moves, movePar: st.movePar, timeLeft: st.timeLeft,
    hasNext: st.level < LEVEL_COUNT,
  });
  audio.event(won ? 'win' : 'lose');
}

// ---------- 教程引导（首次自动弹，可跳过，完成/跳过后持久化不再自动弹） ----------
const TUT_STEPS = () => [
  { text: t('tutStep1'), spot: 'goal' },
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
  const card = $('tut-card');
  card.style.left = '';
  card.style.top = '';
  card.classList.remove('side');
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

const TUT_TRIGGER = ['slide', 'slide', 'slide'];
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
      case 'correct':
        view.fxQueue.push({ type: 'glassFlash', r: ev.r, c: ev.c, ttl: 0.4 });
        break;
      case 'wrong':
        view.shake = 1.5;
        break;
      case 'peek':
        view.fxQueue.push({ type: 'peekFlash', ttl: 0.5 });
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
  if (!lay || !run) return null;
  const { grid, cell } = lay;
  const c = Math.floor((p.x - grid.x) / cell);
  const r = Math.floor((p.y - grid.y) / cell);
  if (r < 0 || r >= run.state.rows || c < 0 || c >= run.state.cols) return null;
  return { r, c };
}

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
  if (!cell) return;
  if (rotateArmed && run.state.rotate) {
    run.rotate(cell.r, cell.c);
  } else {
    const res = run.slide(cell.r, cell.c);
    if (!res.ok && res.reason === 'notAdjacent') {
      view.shake = 1.5;
      audio.event('wrong', {});
    }
  }
  updateHud();
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
  if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'result')) restartLevel();
  if (e.code === 'KeyM') toggleMute();
  if (run && phase === 'playing') {
    const dir = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.code];
    if (dir) {
      e.preventDefault();
      const blank = indexToRC(run.state.blank, run.state.cols);
      run.slide(blank.r + dir[0], blank.c + dir[1]);
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

function toggleRotate() {
  if (!run || !run.state.rotate) return;
  rotateArmed = !rotateArmed;
  updateHud();
}

function doPeek() {
  if (!run || phase !== 'playing') return;
  const res = run.peek();
  if (res.ok) updateHud();
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
  on('btn-next', () => startLevel((run ? run.state.level : lastLevel)));
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-rotate', toggleRotate);
  on('btn-peek', doPeek);
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
      syncLabels();
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
  } else if (run && run.state.phase === 'won') {
    run.step(dt); // 完成点亮动画继续推进
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
    get steps() { return ['goal', 'slide', 'slide2']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  save: (k, v) => Sdk.save(k, v),
  share: () => Sdk.share({}),
  ui: { share: () => Sdk.share({}) },
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: () => {
      if (!run) return null;
      return { ...run.state, blankRC: indexToRC(run.state.blank, run.state.cols) };
    },
    layout: () => { try { return renderer.debugLayout(); } catch { return null; } },
    loadLevel: (i) => startLevel(i),
    startSeeded: (i, seed) => {
      const idx = Math.max(0, Math.min(LEVEL_COUNT - 1, i | 0));
      lastLevel = idx;
      rotateArmed = false;
      run = createRun(idx, { seed: seed | 0 || 1 });
      setPhase('playing');
      ui.showGame();
      hideResult();
      updateHud();
      return true;
    },
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    startTutorial: () => startTutorial(),
    tutorialStep: () => tutorialStep,
    // 自动拼回（greedy 同策略）：倒放缺口游走 + 修旋转
    autoPlaceSolution: () => {
      if (!run) return false;
      const sol = solveScramble(run._blankSeq, run._scrambleDepth);
      for (const cell of sol) {
        if (run.state.phase !== 'playing') break;
        const { r, c } = indexToRC(cell, run.state.cols);
        run.slide(r, c);
      }
      if (run.state.rotate) {
        for (let cell = 1; cell < run.state.board.length; cell += 1) {
          if (run.state.phase !== 'playing') break;
          const t = run.state.board[cell];
          let guard = 0;
          while (run.state.rot[cell] !== run.state.homeRot[t] && guard++ < 4) {
            const { r, c } = indexToRC(cell, run.state.cols);
            run.rotate(r, c);
          }
        }
      }
      return true;
    },
    fastForward: () => window.__ll.debug.autoPlaceSolution(),
    giveUp: () => window.__ll.debug.fastForward(),
    armRotate: () => rotateArmed,
  },
};

// ---------- 启动 ----------
bind();
syncDocumentLang();
ui.applyLang();
syncLabels();
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
