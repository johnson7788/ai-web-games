// 主入口：60Hz 固定步长 + 标题/选关/游戏/暂停/结算 + 教程引导 + SDK 统一出口 + letterbox。
// 契约见 docs/README.md。装配：sim（拾取/三同/道具/重试）/ render+ui / audio / Lead 集成。
import { STEP, GAME, LAYOUT } from '../config/game.config.js';
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
let phase = 'title';       // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let fpsSamples = [];
let tutorialStep = -1;     // -1 = 未激活

const view = {
  rot: 0,
  hoverTile: null,
  cursor: { x: 0, y: 0 },
  fxQueue: [],             // {type:'coinRain', fromX, fromY, ttl, maxTtl, count}
  shake: 0,
};

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let unlocked = Math.max(1, Sdk.load('unlocked', 1) | 0);
let starsByLevel = Sdk.load('stars', {}) || {};
let tutorialDone = !!Sdk.load('tutorialDone', false);
let coinsTotal = Sdk.load('coins', 0) | 0;
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
  Sdk.save('coins', coinsTotal);
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
  view.hoverTile = null;
  view.fxQueue = [];
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
  if (run) Sdk.track('restart', { level: run.state.level + 1 });
  startLevel(run ? run.state.level : lastLevel);
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
  const nm = lv.name ? (lv.name[i18n.lang] || lv.name.en || '') : '';
  $('hud-level').textContent = `${t('level')} ${run.state.level}${nm ? ' · ' + nm : ''}`;
  const secs = Math.max(0, Math.ceil(h.timeLeft));
  const timeEl = $('hud-time');
  timeEl.textContent = secs + 's';
  timeEl.classList.toggle('time-low', secs <= 10);
  $('hud-left').textContent = `${t('tilesLeft')} ${h.tilesLeft}`;
  $('hud-coins').textContent = `$ ${h.coins}`;
  const ub = $('undo-badge');
  ub.textContent = h.undo > 0 ? h.undo : '';
  $('btn-undo').style.opacity = h.undo > 0 ? 1 : 0.35;
  const sb = $('shuffle-badge');
  sb.textContent = h.shuffle > 0 ? h.shuffle : '';
  $('btn-shuffle').style.opacity = h.shuffle > 0 ? 1 : 0.35;
  $('btn-rotate').classList.toggle('is-muted', view.rot === 0);
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
  const { won, stars, coins, timeLeft, reason, hasNext, revivesLeft } = res;
  const rt = $('result-title');
  rt.textContent = won ? t('winTitle') : t('loseTitle');
  rt.classList.toggle('lose', !won);
  const starsEl = $('result-stars');
  starsEl.innerHTML = won
    ? `<span class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>${stars >= 3 ? `<em>${t('perfect')}</em>` : ''}`
    : '';
  $('result-time').textContent = won ? t('timeLeft', { s: Math.ceil(timeLeft) }) : '';
  $('result-meta').textContent = won
    ? `$ ${coins}`
    : (reason === 'timeOut' ? t('timeOut') : t('trayFull'));
  $('btn-next').style.display = won && hasNext ? '' : 'none';
  const rv = $('btn-revive');
  rv.classList.toggle('hidden', won || revivesLeft <= 0);
  rv.textContent = `${t('revive')} (${revivesLeft})`;
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
    coinsTotal += st.coins;
    buildLevelGrid();
  }
  persist();
  Sdk.track(won ? 'win' : 'fail', {
    level: st.level, stars, coins: st.coins, merges: st.merges,
    durationMs: Math.round((st.initialTime - st.timeLeft) * 1000), progress: st.totalTiles - st.tiles.length,
  });
  showResult({
    won, stars, coins: st.coins, timeLeft: st.timeLeft,
    reason: ev.reason || null, hasNext: st.level + 1 < LEVEL_COUNT, revivesLeft: st.revivesLeft,
  });
  audio.event(won ? 'win' : 'lose');
}

// ---------- 教程引导（首次自动弹，可跳过，完成/跳过后持久化不再自动弹） ----------
const TUT_STEPS = () => [
  { text: t('tutStep1'), spot: 'firstFree' },
  { text: t('tutStep2'), spot: 'tray' },
  { text: t('tutStep3'), spot: 'bag' },
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
  if (tutorialStep >= TUT_STEPS().length) endTutorial();
  else renderTutorialStep();
}

function endTutorial() {
  tutorialStep = -1;
  tutorialDone = true;
  persist();
  renderTutorialStep();
}

const TUT_TRIGGER = ['pick', 'merge', 'win'];
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
      case 'pick':
        view.shake = 1.5;
        break;
      case 'merge':
        spawnCoinRain();
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

function spawnCoinRain() {
  try {
    const lay = renderer.debugLayout();
    const tray = lay && lay.tray;
    const bag = lay && lay.bag;
    if (!tray || !bag) return;
    view.fxQueue.push({
      type: 'coinRain',
      fromX: tray.x + tray.w / 2,
      fromY: tray.y + 10,
      ttl: 0.7,
      maxTtl: 0.7,
      count: 8,
    });
  } catch { /* noop */ }
}

// ---------- 输入 ----------
function canvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (1280 / rect.width),
    y: (e.clientY - rect.top) * (720 / rect.height),
  };
}

canvas.addEventListener('pointermove', (e) => {
  view.cursor = canvasPos(e);
  if (run && phase === 'playing') {
    const tile = renderer.pickTile(run.state, view.cursor.x, view.cursor.y);
    view.hoverTile = tile && run.isFree(tile) ? tile : null;
  } else {
    view.hoverTile = null;
  }
});

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (!run || phase !== 'playing') return;
  const p = canvasPos(e);
  view.cursor = p;
  const tile = renderer.pickTile(run.state, p.x, p.y);
  if (!tile) return;
  if (!run.isFree(tile)) {
    view.shake = 2;
    audio.event('pick', { fail: true });
    return;
  }
  const res = run.pick(tile.id);
  if (!res.ok) audio.event('pick', { fail: true });
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
  if (e.code === 'KeyU' && phase === 'playing') useUndo();
  if (e.code === 'KeyS' && phase === 'playing') useShuffle();
  if (e.code === 'Space' && phase === 'playing') { e.preventDefault(); toggleRotate(); }
});

function useUndo() {
  if (!run || phase !== 'playing') return;
  const res = run.undo();
  if (res.ok) { updateHud(); handleEvents(run.drainEvents()); }
  else audio.event('pick', { fail: true });
}

function useShuffle() {
  if (!run || phase !== 'playing') return;
  const res = run.shuffle();
  if (res.ok) { updateHud(); handleEvents(run.drainEvents()); }
  else audio.event('pick', { fail: true });
}

function toggleRotate() {
  view.rot = view.rot ? 0 : 1;
  updateHud();
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
  on('btn-next', () => startLevel((run ? run.state.level : lastLevel) + 1));
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-undo', useUndo);
  on('btn-shuffle', useShuffle);
  on('btn-rotate', toggleRotate);
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
  on('btn-revive', () => {
    if (!run) return;
    const res = run.revive();
    if (res.ok) {
      hideResult();
      setPhase('playing');
      ui.showGame();
      audio.startBgm();
      updateHud();
      handleEvents(run.drainEvents());
    }
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

// ---------- letterbox 缩放 ----------
function fitViewport() {
  const c = $('game-container');
  const scale = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
  c.style.transform = `scale(${scale})`;
  c.style.left = `${(window.innerWidth - 1280 * scale) / 2}px`;
  c.style.top = `${(window.innerHeight - 720 * scale) / 2}px`;
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
  save: (key, value) => Sdk.save(key, value),
  ui: ui,
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['pick', 'merge', 'win']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: () => (run ? { ...run.state, trayLen: run.state.tray.length, tilesLeft: run.state.tiles.length } : null),
    layout: () => { try { return renderer.debugLayout(); } catch { return null; } },
    loadLevel: (i) => startLevel(i),
    startSeeded: (i, seed) => {
      const idx = Math.max(0, Math.min(LEVEL_COUNT - 1, i | 0));
      lastLevel = idx;
      run = createRun(idx, { seed: seed | 0 || 1 });
      view.hoverTile = null;
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
    autoPlaceSolution: () => {
      if (!run) return false;
      const order = run._solution || [];
      for (const id of order) run.pick(id);
      handleEvents(run.drainEvents());
      return true;
    },
    pickNext: () => {
      if (!run || run.state.phase !== 'playing') return false;
      const order = run._solution || [];
      for (const id of order) {
        if (run.state.tiles.some((t) => t.id === id)) {
          run.pick(id);
          handleEvents(run.drainEvents());
          updateHud();
          return true;
        }
      }
      return false;
    },
    fastForward: () => {
      if (!run) return false;
      try {
        const order = run._solution || [];
        for (const id of order) run.pick(id);
        handleEvents(run.drainEvents());
        return true;
      } catch { return false; }
    },
    giveUp: () => window.__ll.debug.fastForward(),
    rotate: () => view.rot,
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
fitViewport();
window.addEventListener('resize', fitViewport);
Sdk.track('load', {});
requestAnimationFrame(frame);
