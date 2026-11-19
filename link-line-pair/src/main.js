// LINK LINE PAIR · 主入口：60Hz 固定步长 + 标题/选关/游戏/暂停/结算 + 教程 + SDK 统一出口
import { STEP } from '../config/game.config.js';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';
import { createRun, mulberry32 } from './game/sim.js';
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
let dragging = false;
let lastHoverId = null;
let lastTickSec = -1;

const view = {
  cursor: null,
  fx: [],
  shake: 0,
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

function setPhase(p) { phase = p; }

// ---------- 阶段状态机 ----------
function startLevel(idx) {
  idx = Math.max(0, Math.min(LEVEL_COUNT - 1, idx | 0));
  lastLevel = idx;
  run = createRun(idx, { seed: (Date.now() % 2147483647) || 1 });
  view.fx = [];
  view.cursor = null;
  lastHoverId = null;
  lastTickSec = -1;
  setPhase('playing');
  ui.showGame();
  ui.hideResult();
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
  if (run) Sdk.track('restart', { level: run.state.levelIndex + 1 });
  startLevel(run ? run.state.levelIndex : lastLevel);
}

function goHome() {
  run = null;
  setPhase('title');
  ui.hideResult();
  ui.showTitle();
  buildLevelGrid();
}

// ---------- HUD ----------
function updateHud() {
  if (!run) return;
  const h = run.getHud();
  const lv = LEVELS[run.state.levelIndex];
  $('hud-level').textContent = `${t('level')} ${h.level} · ${lv.name[i18n.lang] || lv.name.en}`;
  $('hud-time').textContent = `${t('time')} ${Math.ceil(h.timeLeft)}s`;
  $('hud-time').classList.toggle('time-low', h.timeLeft <= 10);
  $('hud-score').textContent = `${t('score')} ${h.score}`;
  const comboEl = $('hud-combo');
  comboEl.textContent = h.combo >= 2 ? `×${h.combo}` : '';
  comboEl.style.display = h.combo >= 2 ? '' : 'none';
  $('hud-lives').textContent = '♥'.repeat(Math.max(0, h.lives)) + '♡'.repeat(Math.max(0, 3 - h.lives));
  $('hint-badge').textContent = h.hintLeft;
  $('undo-badge').textContent = h.undoLeft;
  $('btn-hint').disabled = h.hintLeft <= 0;
  $('btn-undo').disabled = h.undoLeft <= 0 || h.done === 0;
}

function buildLevelGrid() {
  const grid = $('level-grid');
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
  const { won, stars, score, reason, hasNext } = res;
  $('result-title').textContent = won ? t('winTitle') : t('loseTitle');
  $('result-title').classList.toggle('lose', !won);
  const starsEl = $('result-stars');
  starsEl.innerHTML = won
    ? `<span class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>${stars >= 3 ? `<em>${t('perfect')}</em>` : ''}`
    : '';
  $('result-meta').textContent = won
    ? `${t('scoreEarned')} ${score} · ${t('timeUsed')} ${Math.ceil(run.state.elapsed)}s`
    : (reason === 'timeOut' ? t('timeOut') : t('outOfLives'));
  $('btn-next').style.display = won && hasNext ? '' : 'none';
  ui.showResult();
}

function finishRun(ev) {
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  const won = ev.type === 'win';
  const stars = won ? (ev.stars || 1) : 0;
  if (won) {
    const idx = run.state.levelIndex;
    starsByLevel[idx + 1] = Math.max(starsByLevel[idx + 1] | 0, stars);
    if (idx + 1 < LEVEL_COUNT) unlocked = Math.max(unlocked, idx + 2);
    buildLevelGrid();
  }
  persist();
  Sdk.track(won ? 'win' : 'fail', {
    level: run.state.levelIndex + 1, stars,
    score: run.state.score, missCount: run.state.missCount,
    durationMs: Math.round(run.state.elapsed * 1000),
  });
  showResult({ won, stars, score: run.state.score, reason: ev.reason || null, hasNext: run.state.levelIndex + 1 < LEVEL_COUNT });
  audio.event(won ? 'win' : 'lose');
}

// ---------- 教程 ----------
const TUT_STEPS = () => [
  { text: t('tutStep1'), spot: 'grid' },
  { text: t('tutStep2'), spot: 'grid' },
  { text: t('tutStep3'), spot: 'grid' },
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
  const lay = renderer.debugLayout();
  if (s && s.spot === 'grid' && lay) {
    spot.style.display = 'block';
    spot.style.left = `${lay.grid.x - 6}px`;
    spot.style.top = `${lay.grid.y - 6}px`;
    spot.style.width = `${lay.grid.w + 12}px`;
    spot.style.height = `${lay.grid.h + 12}px`;
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

// 真实动作驱动教学推进：0=select 1=connect 2=connect
const TUT_TRIGGER = ['select', 'connect', 'connect'];
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
      case 'connect': {
        const seg = run.state.segments[ev.segment];
        const dot = run.state.dots[seg.b];
        view.fx.push({ type: 'connectPop', c: dot.c, r: dot.r, ttl: 0.4, maxTtl: 0.4 });
        break;
      }
      case 'rock': {
        const rock = run.state.rocks[ev.rock | 0] || run.state.rocks[0];
        view.fx.push({ type: 'rockBurst', c: rock.c, r: rock.r, ttl: 0.5, maxTtl: 0.5, seed: Math.random() * 6 });
        view.shake = 6;
        break;
      }
      case 'miss':
        view.fx.push({ type: 'missFlash', ttl: 0.35, maxTtl: 0.35 });
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
  return { x: (e.clientX - rect.left) * (1280 / rect.width), y: (e.clientY - rect.top) * (720 / rect.height) };
}

function pointerTap(p) {
  if (!run || phase !== 'playing') return;
  const hit = renderer.hitTest(run.state, p);
  if (!hit) return;
  if (hit.type === 'dot') run.tapDot(hit.id);
  else if (hit.type === 'rock') run.tapRock(hit.id);
  updateHud();
}

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  const p = canvasPos(e);
  view.cursor = p;
  dragging = true;
  lastHoverId = null;
  pointerTap(p);
});

canvas.addEventListener('pointermove', (e) => {
  const p = canvasPos(e);
  view.cursor = p;
  if (!dragging || !run || phase !== 'playing') return;
  const hit = renderer.hitTest(run.state, p);
  if (hit && hit.type === 'dot' && hit.id !== lastHoverId) {
    lastHoverId = hit.id;
    if (run.state.sel != null) {
      run.tapDot(hit.id);
      updateHud();
    }
  }
});

window.addEventListener('pointerup', () => { dragging = false; lastHoverId = null; });

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
  on('btn-undo', () => { if (run && phase === 'playing') { run.undo(); updateHud(); } });
  on('btn-tut-replay', () => { if (phase === 'paused') resumeGame(); if (phase === 'playing') startTutorial(); });
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
    if (run && phase === 'playing') {
      updateHud();
      // 最后 5 秒倒计时 tick
      const sec = Math.ceil(run.getHud().timeLeft);
      if (sec <= 5 && sec > 0 && sec !== lastTickSec) {
        lastTickSec = sec;
        audio.event('countdownTick', { timeLeft: sec });
      }
    }
  }

  if (view.shake > 0) view.shake = Math.max(0, view.shake - dt * 18);
  for (const fx of view.fx) if (fx.ttl > 0) fx.ttl -= dt;
  view.fx = view.fx.filter((fx) => fx.ttl > 0);

  try {
    renderer.draw(run ? run.state : null, dt, view);
  } catch (err) {
    console.warn('render error', err);
  }

  if (fpsSamples.length < 600 && dt > 0) fpsSamples.push(1 / dt);
  requestAnimationFrame(frame);
}

// ---------- 调试契约 ----------
function solveCurrent() {
  if (!run) return false;
  const byKey = new Map(run.state.dots.map((d) => [d.key, d.id]));
  const order = run.state.nodes.map((n) => byKey.get(`${n.c},${n.r}`));
  for (const id of order) run.tapDot(id);
  return run.state.phase === 'won';
}

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
  ui: () => ui,
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['select', 'link', 'finish']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
  },
  startTutorial: () => startTutorial(),
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: () => {
      if (!run) return null;
      const st = run.state;
      return {
        phase: st.phase,
        levelIndex: st.levelIndex,
        dots: st.dots.length,
        segCount: st.segCount,
        rockCount: st.rocks.length,
        done: st.doneCount,
        stars: st.stars,
        score: st.score,
        lives: st.lives,
        combo: st.combo,
      };
    },
    layout: () => { try { return renderer.debugLayout(); } catch { return null; } },
    loadLevel: (i) => startLevel(i),
    solve: () => solveCurrent(),
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    startSeeded: (i, seed) => {
      const idx = Math.max(0, Math.min(LEVEL_COUNT - 1, i | 0));
      lastLevel = idx;
      run = createRun(idx, { seed: seed | 0 || 1 });
      view.fx = [];
      setPhase('playing');
      ui.showGame();
      ui.hideResult();
      updateHud();
      return true;
    },
    giveUp: () => solveCurrent(),
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
ui.showTitle();
ui.setMuted(muted);
Sdk.track('load', {});
requestAnimationFrame(frame);
