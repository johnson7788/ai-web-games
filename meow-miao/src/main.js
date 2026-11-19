// MEOW MIAO · 主入口：60Hz 固定步长 + 标题/选关/游戏/暂停/结算 + 教程 + SDK 统一出口。
// 契约：window.__ll（state/start/pause/resume/restart/run/tutorial/startTutorial）+ 教程 DOM 标记。
import { STEP, GAME, CONFIG, WORLD } from '../config/game.config.js';
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
let demoRun = null;
let phase = 'title';       // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let tutorialStep = -1;
let solIdx = 0;

const view = {
  freeIds: new Set(),
  hoverId: null,
  cursor: { x: 0, y: 0 },
};

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let unlocked = Math.max(1, Sdk.load('unlocked', 1) | 0);
let starsByLevel = Sdk.load('stars', {}) || {};
let tutorialDone = !!Sdk.load('tutorialDone', false);
let lastLevel = Sdk.load('lastLevel', 0) | 0;

Sdk.ready();
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
  run = createRun(idx, { seed: (Date.now() % 2147483647) || 1 });
  run._solIdx = 0;
  solIdx = 0;
  view.freeIds = new Set();
  setPhase('playing');
  ui.showGame();
  hideResult();
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
  startLevel(run ? run.state.levelIndex : lastLevel);
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
function updateHud() {
  if (!run) return;
  const h = run.getHud();
  const lv = LEVELS[run.state.levelIndex] || {};
  const name = lv.name ? (lv.name[i18n.lang] || lv.name.en || '') : '';
  $('hud-goal').textContent = t('goal');
  $('hud-level').textContent = `${t('level')} ${h.level}${name ? ' · ' + name : ''}`;
  const secs = Math.max(0, Math.ceil(h.timeLeft));
  const timeEl = $('hud-time');
  timeEl.textContent = `${t('time')} ${secs}s`;
  timeEl.classList.toggle('time-low', secs <= 10);
  $('hud-score').textContent = `${t('score')} ${h.score}`;
  const comboEl = $('hud-combo');
  comboEl.textContent = h.combo >= 2 ? `×${h.combo} ${t('combo')}` : '';
  comboEl.classList.toggle('show', h.combo >= 2);
  $('shuffle-badge').textContent = h.shuffleLeft;
  $('undo-badge').textContent = h.undoLeft;
  $('hud-remaining').textContent = t('tilesLeft', { n: h.remainingTiles });
  view.goalText = t('goal');
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
  $('stars-total').textContent = t('starsTotal', { n: totalStars(), total: LEVEL_COUNT * 3 });
}

function showResult(res) {
  const { won, stars, timeLeft, score, maxCombo, reason, hasNext } = res;
  $('result-title').textContent = won ? t('winTitle') : t('loseTitle');
  $('result-title').classList.toggle('lose', !won);
  $('result-stars').innerHTML = won
    ? `<span class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>${stars >= 3 ? `<em>${t('perfect')}</em>` : ''}`
    : '';
  $('result-time').textContent = won ? t('timeLeft', { s: Math.ceil(timeLeft) }) : '';
  $('result-meta').textContent = won
    ? `${t('score')} ${score} · ×${maxCombo} ${t('combo')}`
    : (reason === 'timeout' ? t('loseTimeout') : t('loseOverflow'));
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
    const idx = st.levelIndex;
    starsByLevel[idx + 1] = Math.max(starsByLevel[idx + 1] | 0, stars);
    if (idx + 1 < LEVEL_COUNT) unlocked = Math.max(unlocked, idx + 2);
    buildLevelGrid();
  }
  persist();
  Sdk.track(won ? 'win' : 'fail', {
    level: st.levelIndex + 1, stars, score: st.score, maxCombo: st.maxCombo, reason: ev.reason || null,
  });
  showResult({
    won, stars, timeLeft: st.timeLeft, score: st.score, maxCombo: st.maxCombo,
    reason: ev.reason || null, hasNext: st.levelIndex + 1 < LEVEL_COUNT,
  });
  audio.event(won ? 'win' : 'lose', ev);
}

// ---------- 教程（首次自动弹，可跳过，完成/跳过后持久化，可重看） ----------
const TUT_STEPS = () => [
  { text: t('tutStep1'), spot: 'board' },
  { text: t('tutStep2'), spot: 'shelf' },
  { text: t('tutStep3'), spot: 'props' },
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

const TUT_TRIGGER = ['pick', 'match', 'match'];
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
      case 'match': {
        const sym = ev.symbol;
        const color = sym === -1 ? renderer.WILD_COLOR : (renderer.SYMBOLS[sym] && renderer.SYMBOLS[sym].color);
        if (color) {
          const lay = renderer.debugLayout(run.state);
          if (lay && lay.shelf) {
            renderer.burst(lay.shelf.x + lay.shelf.w / 2, lay.shelf.y + lay.shelf.h / 2, color, ev.combo >= 2 ? 22 : 14);
          }
        }
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
    x: (e.clientX - rect.left) * (WORLD.WIDTH / rect.width),
    y: (e.clientY - rect.top) * (WORLD.HEIGHT / rect.height),
  };
}

canvas.addEventListener('pointermove', (e) => {
  view.cursor = canvasPos(e);
  view.hoverId = (run && phase === 'playing') ? renderer.hitTest(view.cursor.x, view.cursor.y) : null;
});

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (!run || phase !== 'playing') return;
  const p = canvasPos(e);
  view.cursor = p;
  const id = renderer.hitTest(p.x, p.y);
  if (id == null) return;
  run.pick(id);
  handleEvents(run.drainEvents());
  if (run && phase === 'playing') updateHud();
});

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
  on('btn-next', () => startLevel((run ? run.state.levelIndex : lastLevel) + 1));
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result') startTutorial(); });
  on('btn-tut-replay', () => { if (phase === 'paused') resumeGame(); if (phase === 'playing') startTutorial(); });
  on('btn-shuffle', () => {
    if (run && phase === 'playing') { run.useShuffle(); handleEvents(run.drainEvents()); updateHud(); }
  });
  on('btn-undo', () => {
    if (run && phase === 'playing') { run.useUndo(); handleEvents(run.drainEvents()); updateHud(); }
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

  if (phase === 'playing' && run) {
    accumulator += dt;
    while (accumulator >= STEP) {
      run.step(STEP);
      accumulator -= STEP;
    }
    handleEvents(run.drainEvents());
    if (run && phase === 'playing') updateHud();
    view.freeIds = new Set(run.freeTiles().map((t) => t.id));
  }

  const drawState = phase === 'title'
    ? (demoRun ? demoRun.state : null)
    : (run ? run.state : null);
  if (phase === 'title' && demoRun) {
    view.freeIds = new Set(demoRun.freeTiles().map((t) => t.id));
  }

  view.goalText = t('goal');
  try {
    renderer.draw(drawState, dt, view, now);
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
  },
  get run() { return run; },
  sim: () => (run ? run.state : null),
  start: (i) => startLevel(i == null ? (lastLevel || 0) : i),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => restartLevel(),
  home: () => goHome(),
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['pick', 'match', 'match']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
  },
  startTutorial: () => startTutorial(),
  save: (key, value) => { Sdk.save(key, value); return true; },
  ui,
  fps: () => 0,
  debug: {
    state: () => {
      if (!run) return null;
      const st = run.state;
      return {
        ...st,
        tileCount: st.tiles.filter((t) => t.onBoard).length,
        freeCount: run.freeTiles().length,
        shelfLen: st.shelf.length,
        rocks: st.rocks.length,
        wilds: st.tiles.filter((t) => t.symbol === -1).length,
      };
    },
    layout: () => { try { return renderer.debugLayout(run.state); } catch { return null; } },
    loadLevel: (i) => startLevel(i),
    startSeeded: (i, seed) => {
      const idx = Math.max(0, Math.min(LEVEL_COUNT - 1, i | 0));
      lastLevel = idx;
      run = createRun(idx, { seed: seed | 0 || 1 });
      run._solIdx = 0;
      setPhase('playing');
      ui.showGame();
      hideResult();
      updateHud();
      view.freeIds = new Set(run.freeTiles().map((t) => t.id));
      return true;
    },
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    // 按逆向构造解序自动通关（greedy：每色连拿 3 块）
    solve: () => {
      if (!run) return false;
      let guard = 1000;
      while (run.state.phase === 'playing' && guard-- > 0) {
        const sym = run._solution[run._solIdx];
        if (sym === undefined) break;
        run._solIdx += 1;
        const tile = run.freeTiles().find((t) => t.symbol === sym);
        if (!tile) break;
        run.pick(tile.id);
      }
      handleEvents(run.drainEvents());
      updateHud();
      return run.state.phase !== 'playing';
    },
    fastForward: () => {
      if (!run) return false;
      let guard = 20000;
      while (guard-- > 0 && run.state.phase === 'playing') {
        run.step(0.25);
      }
      handleEvents(run.drainEvents());
      updateHud();
      return true;
    },
    giveUp: () => {
      if (!run) return false;
      // 强行拿 8 块不同的可拿方块塞满等待架触发溢出
      let guard = 0;
      while (run.state.phase === 'playing' && run.state.shelf.length <= GAME.SHELF_CAP && guard++ < 40) {
        const free = run.freeTiles();
        const t = free.find((x) => !run.state.shelf.some((s) => s.id === x.id));
        if (!t) break;
        run.pick(t.id);
      }
      handleEvents(run.drainEvents());
      updateHud();
      return run.state.phase === 'lost';
    },
  },
};

// ---------- 启动 ----------
bind();
syncDocumentLang();
ui.applyLang();
demoRun = createRun(0, { seed: 7 });
buildLevelGrid();
$('btn-mute').classList.toggle('is-muted', muted);
Sdk.track('load', {});
requestAnimationFrame(frame);
