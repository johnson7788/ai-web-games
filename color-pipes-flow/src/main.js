// COLOR PIPES FLOW · 主入口：60Hz 固定步长 + 标题/选关/游戏/暂停/结算 + 教程引导 + SDK 统一出口。
// 装配：sim(M1) / render / ui / audio。职责划分：ui.js 只做语言与屏幕显隐；HUD/结算/教程由这里直写。
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

let run = null;                 // 当前对局
let phase = 'title';            // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let fpsSamples = [];
let drawing = false;            // 是否正在拖动画线
let tutorialStep = -1;          // -1 = 未激活

const view = { shake: 0 };

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let unlocked = Math.max(1, Sdk.load('unlocked', 1) | 0);
let starsByLevel = Sdk.load('stars', {}) || {};
let tutorialDone = !!Sdk.load('tutorialDone', false);
let lastLevel = Sdk.load('lastLevel', 0) | 0;

Sdk.ready(); // 不 await，不阻塞首屏
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
  drawing = false;
  run = createRun(idx);
  view.shake = 0;
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
  startLevel(run ? run.state.levelIndex : lastLevel);
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
  $('hud-level').textContent = `${t('level')} ${h.level}`;
  $('hud-moves').textContent = `${t('moves')} ${h.moves}/${h.par}`;
  $('hud-hints').textContent = `💡 ${h.hintsLeft}`;
  $('hud-goal').textContent = t('goal');
  $('btn-hint').disabled = h.hintsLeft <= 0 || phase !== 'playing';
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
  const { won, stars, moves, par, reason, hasNext } = res;
  $('result-title').textContent = won ? t('winTitle') : t('loseTitle');
  $('result-title').classList.toggle('lose', !won);
  const starsEl = $('result-stars');
  starsEl.innerHTML = won
    ? `<span class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>${stars >= 3 ? `<em>${t('perfect')}</em>` : ''}`
    : '';
  $('result-meta').textContent = won
    ? `${t('moves')} ${moves} / ${t('par')} ${par}`
    : (reason === 'outOfMoves' ? t('outOfMoves') : t('gaveUp'));
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
  Sdk.track(won ? 'win' : 'fail', { level: st.level, stars, moves: st.moves });
  showResult({
    won, stars, moves: st.moves, par: st.par,
    reason: ev.reason || null, hasNext: st.level + 1 < LEVEL_COUNT,
  });
  audio.event(won ? 'win' : 'lose');
}

// ---------- 教程引导 ----------
const TUT_STEPS = () => [
  { text: t('tutStep1'), spot: 'dot' },
  { text: t('tutStep2'), spot: 'grid' },
  { text: t('tutStep3'), spot: 'grid' },
];

function layoutRect(which) {
  try {
    const lay = renderer.debugLayout();
    if (lay && which === 'grid') {
      return { x: lay.grid.x, y: lay.grid.y, w: lay.grid.w, h: lay.grid.h };
    }
    if (lay && which === 'dot' && run && run.state.pairs.length) {
      const pair = run.state.pairs[0];
      const c = lay.cell;
      const x = lay.grid.x + pair.a[1] * c;
      const y = lay.grid.y + pair.a[0] * c;
      return { x: x - 6, y: y - 6, w: c + 12, h: c + 12 };
    }
  } catch { /* 布局未就绪 */ }
  return null;
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
  const rect = s && layoutRect(s.spot);
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

// 教学步骤推进（真实动作驱动）：0=drawStart 1=cellFill 2=pairComplete
const TUT_TRIGGER = ['drawStart', 'cellFill', 'pairComplete'];
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
      case 'pairComplete':
        view.shake = 3;
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

function cellInActivePath(r, c) {
  if (!run || run.state.activeColor < 0) return -1;
  const path = run.state.paths[run.state.activeColor];
  for (let i = 0; i < path.length; i += 1) {
    if (path[i][0] === r && path[i][1] === c) return i;
  }
  return -1;
}

// 向前拖：从当前路径头走到 target（一步一格，处理快速拖拽跳过格）
function dragTo(target) {
  if (!run || run.state.activeColor < 0) return;
  let guard = 0;
  while (guard < 16) {
    guard += 1;
    const s = run.state;
    const path = s.paths[s.activeColor];
    const last = path[path.length - 1];
    const dr = target[0] - last[0];
    const dc = target[1] - last[1];
    const dist = Math.abs(dr) + Math.abs(dc);
    if (dist === 0) break;
    if (dist === 1) { run.drawTo(target[0], target[1]); break; }
    const sr = Math.abs(dr) >= Math.abs(dc) ? Math.sign(dr) : 0;
    const sc = sr === 0 ? Math.sign(dc) : 0;
    const res = run.drawTo(last[0] + sr, last[1] + sc);
    if (!res.ok) break;
  }
}

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (!run || phase !== 'playing') return;
  const p = canvasPos(e);
  const cell = pickCell(p);
  if (!cell) return;
  const g = run.state.grid[cell.r][cell.c];
  if (g.dot !== -1) {
    // 判断是 a 端还是 b 端
    const pair = run.state.pairs[g.dot];
    const end = (pair.a[0] === cell.r && pair.a[1] === cell.c) ? 'a' : 'b';
    run.startDraw(g.dot, end);
    drawing = true;
    e.preventDefault();
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (!drawing || !run || phase !== 'playing') return;
  const cell = pickCell(canvasPos(e));
  if (!cell) return;
  const s = run.state;
  if (s.activeColor < 0) return;
  const idx = cellInActivePath(cell.r, cell.c);
  if (idx >= 0 && idx < (s.paths[s.activeColor].length - 1)) {
    run.cutBack(cell.r, cell.c);
  } else if (idx === -1) {
    dragTo(cell);
  }
});

function endPointer() {
  if (drawing && run) {
    run.endDraw();
    drawing = false;
  }
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
  if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'result')) restartLevel();
  if (e.code === 'KeyM') toggleMute();
  if (e.code === 'KeyH' && phase === 'playing' && run) { run.hint(); updateHud(); }
});

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  ui.setMuted(muted);
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
  on('btn-next', () => startLevel((run ? run.state.levelIndex : lastLevel) + 1));
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-hint', () => { if (run && phase === 'playing') { run.hint(); updateHud(); } });
  on('btn-tut-replay', () => {
    if (phase === 'paused') resumeGame();
    if (phase === 'playing' || phase === 'result') startTutorial();
  });
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
      $('btn-mute').textContent = muted ? '🔇' : '🔊';
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
    get steps() { return ['draw', 'fill', 'connect']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  save: (key, value) => Sdk.save(key, value),
  share: (payload) => Sdk.share(payload),
  ui,
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: () => (run ? run.state : null),
    loadLevel: (i) => startLevel(i),
    startSeeded: (i) => startLevel(i),
    solve: () => {
      if (!run) return false;
      const st = run.state;
      for (const pair of st.pairs) {
        run.startDraw(pair.id, 'a');
        for (let i = 1; i < pair.path.length; i += 1) run.drawTo(pair.path[i][0], pair.path[i][1]);
        run.endDraw();
      }
      handleEvents(run.drainEvents());
      return run.state.phase === 'won';
    },
    autoPlaceSolution: function () { return this.solve(); },
    drawPartial: (n) => {
      if (!run || run.state.phase !== 'playing') return false;
      const pairs = run.state.pairs.slice(0, Math.max(0, n | 0));
      for (const pair of pairs) {
        run.startDraw(pair.id, 'a');
        for (let i = 1; i < pair.path.length; i += 1) run.drawTo(pair.path[i][0], pair.path[i][1]);
        run.endDraw();
      }
      handleEvents(run.drainEvents());
      return true;
    },
    hint: () => { if (run && run.state.phase === 'playing') { run.hint(); handleEvents(run.drainEvents()); return true; } return false; },
    giveUp: () => { if (run) { run.giveUp(); handleEvents(run.drainEvents()); } },
    loadSolution: () => { if (run) { run.state.hintCell = null; } },
  },
};

// ---------- 启动 ----------
bind();
syncDocumentLang();
ui.applyLang();
buildLevelGrid();
$('btn-mute').textContent = muted ? '🔇' : '🔊';
Sdk.track('load', {});
requestAnimationFrame(frame);
