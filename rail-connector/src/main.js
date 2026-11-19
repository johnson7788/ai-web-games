// main.js — 60Hz 固定步长装配：标题(吸引演示)/选关/游戏/暂停/结算 + 教程 + SDK + 标准调试契约。
import { STEP, WORLD, PALETTE } from '../config/game.config.js';
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
let phase = 'title'; // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let tutorialStep = -1;
let lastCountdownSec = -1;

const view = {
  now: performance.now(),
  shake: 0,
  fx: [],
};

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let unlocked = Math.max(1, Sdk.load('unlocked', 1) | 0);
let starsByLevel = Sdk.load('stars', {}) || {};
let tutorialDone = !!Sdk.load('tutorialDone', false);
let lastLevel = Sdk.load('lastLevel', 0) | 0;

Sdk.ready(); // 不 await，不阻塞首屏
audio.setMuted(muted);

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

function setPhase(p) {
  phase = p;
}

function makeDemoRun() {
  const r = createRun(0, { seed: 5 });
  // 吸引演示：把开关都拨到正确态，列车优雅循环
  for (const sw of r.state.switches) {
    const cell = r.state.grid[sw.r][sw.c];
    cell.stateIndex = cell.states.length - 1;
  }
  return r;
}
demoRun = makeDemoRun();

// ---------- 阶段状态机 ----------
function startLevel(idx) {
  idx = Math.max(0, Math.min(LEVEL_COUNT - 1, idx | 0));
  lastLevel = idx;
  run = createRun(idx, { seed: (Date.now() % 2147483647) || 1 });
  view.shake = 0;
  view.fx = [];
  setPhase('playing');
  ui.showGame();
  ui.hideResult();
  updateHud();
  audio.startBgm();
  Sdk.newRun({ level: idx + 1 });
  if (idx === 0 && !tutorialDone) startTutorial();
}

function pauseGame() {
  if (phase !== 'playing') return;
  setPhase('paused');
  audio.stopBgm();
  ui.showPause();
}

function resumeGame() {
  if (phase !== 'paused') return;
  setPhase('playing');
  ui.hidePause();
  audio.startBgm();
  lastTime = performance.now();
}

function restartLevel() {
  startLevel(run ? run.state.level : lastLevel);
}

function goHome() {
  run = null;
  setPhase('title');
  ui.hideResult();
  ui.showTitle();
  updateStarsTotal();
}

// ---------- HUD ----------
function updateHud() {
  if (!run) return;
  const h = run.getHud();
  const lv = LEVELS[run.state.level];
  $('hud-level').textContent = `${t('level')} ${run.state.level + 1}`;
  $('hud-score').textContent = `${t('score')} ${h.score}/${h.totalScore}`;
  $('hud-progress-fill').style.width = `${Math.min(100, (h.score / h.totalScore) * 100)}%`;
  const secs = Math.max(0, Math.ceil(h.timeLeft));
  const timeEl = $('hud-time');
  timeEl.textContent = secs + 's';
  timeEl.classList.toggle('time-low', secs <= 10);
  $('hud-combo').textContent = h.combo >= 2 ? `${t('combo')} x${h.combo}` : '';
  $('frost-badge').textContent = h.frostCharges;
  $('btn-frost').classList.toggle('is-ready', h.frostCharges >= 1);
  $('btn-frost').classList.toggle('is-active', h.frostActive);
}

function updateStarsTotal() {
  const el = $('stars-total');
  if (el) el.textContent = `★ ${totalStars()} / ${LEVEL_COUNT * 3}`;
}

// ---------- 结算 ----------
function finishRun(ev) {
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  const st = run.state;
  const won = ev.type === 'win';
  const stars = won ? (ev.stars || st.stars || 1) : 0;
  $('result-title').textContent = won ? t('winTitle') : t('loseTitle');
  $('result-title').classList.toggle('lose', !won);
  $('result-stars').innerHTML = won
    ? `<span class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>${stars >= 3 ? `<em>${t('perfect')}</em>` : ''}`
    : '';
  $('result-meta').textContent = won
    ? `${t('deliveries')}: ${st.deliveries} · ${t('errors')}: ${st.errors}`
    : t('loseTitle');
  $('btn-next').style.display = won && st.level + 1 < LEVEL_COUNT ? '' : 'none';
  if (won) {
    const idx = st.level + 1;
    starsByLevel[idx] = Math.max(starsByLevel[idx] | 0, stars);
    if (st.level + 1 < LEVEL_COUNT) unlocked = Math.max(unlocked, idx + 1);
    persist();
    Sdk.levelCleared({ level: idx, stars });
    updateStarsTotal();
  } else {
    Sdk.gameOver({ level: st.level + 1 });
  }
  ui.showResult();
  audio.event(won ? 'win' : 'lose');
}

// ---------- 教程（首次自动弹，可跳过，完成/跳过后持久化） ----------
const TUT_STEPS = () => [
  { id: 'switch', text: t('tutStep1') },
  { id: 'route', text: t('tutStep2') },
  { id: 'deliver', text: t('tutStep3') },
];

function switchRect() {
  const lay = renderer.debugLayout();
  if (!lay || !run) return null;
  const sw = run.state.switches[0];
  if (!sw) return null;
  const x = lay.grid.x + sw.c * lay.grid.cell;
  const y = lay.grid.y + sw.r * lay.grid.cell;
  return { x, y, w: lay.grid.cell, h: lay.grid.cell };
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
  const spot = $('tut-spotlight');
  const rect = (s && s.id === 'switch') ? switchRect() : (s ? { x: 0, y: 0, w: 0, h: 0 } : null);
  if (rect && rect.w > 0) {
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

// ---------- 事件消费 ----------
function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    switch (ev.type) {
      case 'boom':
      case 'rockCrash':
        view.shake = 8;
        break;
      case 'pickup':
        view.shake = 2;
        break;
      case 'deliver':
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
    x: (e.clientX - rect.left) * (WORLD.WIDTH / rect.width),
    y: (e.clientY - rect.top) * (WORLD.HEIGHT / rect.height),
  };
}

function pickSwitch(p) {
  const lay = renderer.debugLayout();
  if (!lay || !run) return -1;
  const cc = Math.floor((p.x - lay.grid.x) / lay.grid.cell);
  const r = Math.floor((p.y - lay.grid.y) / lay.grid.cell);
  if (r < 0 || r >= run.state.rows || cc < 0 || cc >= run.state.cols) return -1;
  const cell = run.state.grid[r][cc];
  if (!cell || cell.type !== 'switch') return -1;
  return run.state.switches.findIndex((s) => s.r === r && s.c === cc);
}

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (phase !== 'playing' || !run) return;
  const idx = pickSwitch(canvasPos(e));
  if (idx >= 0) {
    run.toggleSwitch(idx);
    view.shake = 2;
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
  if (e.code === 'KeyF' && phase === 'playing') useFrost();
  if (e.code === 'Space' && phase === 'playing') { e.preventDefault(); useFrost(); }
});

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  $('btn-mute').textContent = muted ? '🔇' : '🔊';
  $('btn-mute').setAttribute('aria-label', muted ? t('unmute') : t('mute'));
  persist();
}

function useFrost() {
  if (!run || phase !== 'playing') return;
  const r = run.useFrost();
  if (r.ok) updateHud();
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
  on('btn-frost', useFrost);
  on('btn-tut-replay', () => { if (phase === 'paused') resumeGame(); if (phase === 'playing') startTutorial(); });
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result') startTutorial(); });
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);

  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = $(id);
    if (!sel) continue;
    sel.addEventListener('change', () => {
      ui.setLang(sel.value);
      renderTutorialStep();
      updateHud();
      const rt = $('rotate-text');
      const rb = $('btn-rotate-skip');
      if (rt) rt.textContent = t('rotateHint');
      if (rb) rb.textContent = t('rotateSkip');
      $('btn-mute').textContent = muted ? '🔇' : '🔊';
    });
  }
}

// ---------- 主循环 ----------
function frame(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;
  view.now = now;

  if (phase === 'playing' && run) {
    accumulator += dt;
    while (accumulator >= STEP) {
      run.step(STEP);
      accumulator -= STEP;
    }
    handleEvents(run.drainEvents());
    if (run && phase === 'playing') updateHud();
    // 倒计时提示音
    const left = run ? run.getHud().timeLeft : 0;
    const sec = Math.ceil(left);
    if (left > 0 && left <= 5 && sec !== lastCountdownSec) {
      lastCountdownSec = sec;
      audio.event('countdownTick', { timeLeft: left });
    }
  } else if (phase === 'title') {
    // 标题屏：驱动吸引演示
    demoRun.step(dt);
    demoRun.drainEvents();
    if (demoRun.state.phase !== 'playing') demoRun = makeDemoRun();
  }

  if (view.shake > 0) view.shake = Math.max(0, view.shake - dt * 22);

  const drawState = phase === 'title' ? demoRun.state : (run ? run.state : null);
  try {
    renderer.draw(drawState, dt, view);
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
  run: () => run,
  save: (k, v) => Sdk.save(k, v),
  ui: () => ui,
  start: (i) => startLevel(i == null ? (lastLevel || 0) : i),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => restartLevel(),
  home: () => goHome(),
  sim: () => (run ? run.state : null),
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['switch', 'route', 'deliver']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
  },
  startTutorial: () => startTutorial(),
  debug: {
    state: () => {
      if (!run) return null;
      const st = run.state;
      const rockCount = st.grid.flat().filter((c) => c.type === 'rock').length;
      return { ...st, rockCount, switchCount: st.switches.length };
    },
    layout: () => { try { return renderer.debugLayout(); } catch { return null; } },
    loadLevel: (i) => startLevel(i),
    startSeeded: (i, seed) => {
      const idx = Math.max(0, Math.min(LEVEL_COUNT - 1, i | 0));
      lastLevel = idx;
      run = createRun(idx, { seed: seed | 0 || 1 });
      setPhase('playing');
      ui.showGame();
      ui.hideResult();
      updateHud();
      return true;
    },
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    startTutorial: () => startTutorial(),
    tutorialStep: () => tutorialStep,
    // 把开关全部拨到正确态（用于验收/截图）
    autoSolve: () => {
      if (!run) return false;
      for (const sw of run.state.switches) {
        const cell = run.state.grid[sw.r][sw.c];
        cell.stateIndex = cell.states.length - 1;
      }
      updateHud();
      return true;
    },
    forceWin: () => {
      if (!run) return false;
      run.state.score = run.state.totalScore;
      run.state.stars = 3;
      run.state.deliveries = Math.max(1, run.state.deliveries);
      finishRun({ type: 'win', stars: 3 });
      return true;
    },
    useFrost: () => useFrost(),
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
$('btn-mute').textContent = muted ? '🔇' : '🔊';
updateStarsTotal();
ui.showTitle();
Sdk.track('load', {});
requestAnimationFrame(frame);
