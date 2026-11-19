// GRUMPY BIRDS SIEGE · 主入口：60Hz 固定步长 + 标题/选关/游戏/暂停/结算 + 教程 + SDK 统一出口
// 装配：sim（纯逻辑）/ render（canvas 霓虹）/ ui（DOM）/ audio（WebAudio）/ Sdk。
import { STEP, BIRD, WALL, CONFIG } from '../config/game.config.js';
import { createRun } from './game/sim.js';
import { createRenderer } from './render/index.js';
import { createAudio } from './core/audio.js';
import { ui } from './ui/ui.js';
import { i18n, t, syncDocumentLang } from './core/i18n.js';
import Sdk from './core/sdk.js';

const LEVEL_COUNT = 100; // 原作 MAX_LEVELS = 100
const $ = (id) => document.getElementById(id);
const container = $('game-container');
const renderer = createRenderer($('canvas'));
const audio = createAudio();

let run = null;
let phase = 'title';        // title | playing | paused | result
let lastOutcome = null;     // won | lost
let lastTime = performance.now();
let accumulator = 0;
let tutorialStep = -1;
let holding = false;
let autoFlap = false;
let frameCount = 0;

const view = { t: 0, shake: 0, reduced: false };

try {
  view.reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
} catch { view.reduced = false; }

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let unlocked = Math.max(1, Sdk.load('unlocked', 1) | 0);
let starsByLevel = Sdk.load('stars', {}) || {};
let tutorialDone = !!Sdk.load('tutorialDone', false);
let bestScore = Sdk.load('bestScore', 0) | 0;
let lastLevel = Sdk.load('lastLevel', 0) | 0;

Sdk.ready(); // 不 await，不阻塞首屏
Sdk.onAdStart(() => { if (phase === 'playing') pauseGame(true); });
Sdk.onAdEnd(() => { if (phase === 'paused') resumeGame(); });
audio.setMuted(muted);
ui.setMuted(muted);

function persist() {
  Sdk.save('unlocked', unlocked);
  Sdk.save('stars', starsByLevel);
  Sdk.save('muted', muted);
  Sdk.save('tutorialDone', tutorialDone);
  Sdk.save('bestScore', bestScore);
  Sdk.save('lastLevel', lastLevel);
}

function totalStars() {
  return Object.values(starsByLevel).reduce((a, b) => a + (b | 0), 0);
}

// ---------- 阶段状态机 ----------
function startLevel(idx) {
  idx = Math.max(0, Math.min(LEVEL_COUNT - 1, (idx == null ? lastLevel : idx) | 0));
  lastLevel = idx;
  lastOutcome = null;
  run = createRun(idx, { seed: (Date.now() % 2147483647) || 1 });
  phase = 'playing';
  holding = false;
  ui.showGame();
  ui.hideResult();
  updateHud();
  audio.unlock();
  audio.startBgm();
  Sdk.track('start', { level: idx + 1 });
  if (!tutorialDone && idx === 0) startTutorial();
}

function pauseGame(silent) {
  if (phase !== 'playing') return;
  phase = 'paused';
  audio.stopBgm();
  if (!silent) ui.showPause();
}

function resumeGame() {
  if (phase !== 'paused') return;
  phase = 'playing';
  ui.hidePause();
  audio.startBgm();
  lastTime = performance.now();
}

function restartLevel() {
  Sdk.track('restart', { level: (run ? run.state.level : lastLevel + 1) });
  startLevel(run ? run.state.level - 1 : lastLevel);
}

function goHome() {
  run = null;
  phase = 'title';
  ui.hideResult();
  ui.showTitle();
  buildLevelGrid();
}

// ---------- HUD / 关卡格 / 结算 ----------
function updateHud() {
  if (!run) return;
  ui.updateHud(run.getHud());
}

function buildLevelGrid() {
  const grid = ui.levelGrid;
  grid.innerHTML = '';
  for (let i = 0; i < LEVEL_COUNT; i += 1) {
    const cell = document.createElement('button');
    cell.className = 'level-cell' + (i + 1 > unlocked ? ' locked' : '');
    cell.dataset.level = i;
    const s = starsByLevel[i + 1] | 0;
    cell.innerHTML = `<span class="lv-num">${i + 1}</span><span class="lv-stars">${'★'.repeat(s)}${'☆'.repeat(Math.max(0, 3 - s))}</span>`;
    cell.setAttribute('aria-label', `${t('level')} ${i + 1}${i + 1 > unlocked ? ' ' + t('locked') : ''}`);
    grid.appendChild(cell);
  }
  ui.starsTotal.textContent = `★ ${totalStars()} / ${LEVEL_COUNT * 3}`;
}

function showResult(ev) {
  const won = ev.type === 'win';
  const stars = won ? (ev.stars || run.state.stars || 1) : 0;
  ui.resultTitle.textContent = won ? t('winTitle') : t('loseTitle');
  ui.resultTitle.classList.toggle('lose', !won);
  ui.resultStars.innerHTML = won
    ? `<span class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>${stars >= 3 ? `<em>${t('perfect')}</em>` : ''}`
    : '';
  ui.resultMeta.innerHTML = won
    ? `${t('resultScore')} ${run.state.score} · ${t('resultCombo')} ×${run.state.bestCombo} · ${t('resultWalls')} ${run.state.passed}`
    : `${t('resultScore')} ${run.state.score} · ${t('resultWalls')} ${run.state.passed}`;
  ui.btnNext.style.display = won && run.state.level < LEVEL_COUNT ? '' : 'none';
  ui.showResult();
}

function finishRun(ev) {
  phase = 'result';
  lastOutcome = ev.type === 'win' ? 'won' : 'lost';
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial(); // 结算出现时引导退场
  const st = run.state;
  const won = ev.type === 'win';
  const stars = won ? (ev.stars || st.stars || 1) : 0;
  if (won) {
    const idx = st.level;
    starsByLevel[idx] = Math.max(starsByLevel[idx] | 0, stars);
    if (idx < LEVEL_COUNT) unlocked = Math.max(unlocked, idx + 1);
    bestScore = Math.max(bestScore, st.score);
    buildLevelGrid();
  }
  persist();
  Sdk.track(won ? 'win' : 'fail', { level: st.level, stars, score: st.score, combo: st.bestCombo });
  showResult(ev);
}

// ---------- 教程引导（首次自动弹，可跳过，完成/跳过后持久化） ----------
const TUT_STEPS = () => [
  { text: t('tutStep1') },
  { text: t('tutStep2') },
  { text: t('tutStep3') },
  { text: t('tutStep4') },
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
  ui.tutText.textContent = s ? s.text : '';
  ui.tutTitle.textContent = `${t('tutTitle')} ${tutorialStep + 1}/${steps.length}`;
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
      case 'flap':
        if (!view.reduced) renderer.burst(BIRD.X - BIRD.R, run.state.bird.y, { n: 3, color: '#ffb340', speed: 1.4, ttl: 0.35 });
        break;
      case 'score':
        if (!view.reduced) renderer.burst(BIRD.X, run.state.bird.y, { n: 4, color: '#22d3ee', speed: 1.8, ttl: 0.4 });
        break;
      case 'combo':
        if (!view.reduced) { view.shake = 2; renderer.burst(BIRD.X, run.state.bird.y, { n: 8, color: '#ffd84e', speed: 2.4, ttl: 0.5, spread: 2.4 }); }
        break;
      case 'nearMiss':
        if (!view.reduced) { view.shake = 1.5; renderer.burst(BIRD.X, run.state.bird.y, { n: 5, color: '#ffd84e', speed: 2, ttl: 0.4, spread: 1.6 }); }
        break;
      case 'rockDodge':
        if (!view.reduced) renderer.burst(BIRD.X, run.state.bird.y, { n: 3, color: '#39ff88', speed: 1.6, ttl: 0.3 });
        break;
      case 'shieldGet':
        if (!view.reduced) renderer.burst(BIRD.X, run.state.bird.y, { n: 10, color: '#22d3ee', speed: 2.6, ttl: 0.55, spread: 2.8 });
        break;
      case 'shieldUse':
        if (!view.reduced) { view.shake = 4; renderer.burst(BIRD.X, run.state.bird.y, { n: 12, color: '#ff3860', speed: 3, ttl: 0.5, spread: 3 }); }
        break;
      case 'win':
      case 'lose':
        if (!view.reduced) { view.shake = ev.type === 'lose' ? 6 : 3; }
        finishRun(ev);
        return;
      default:
        break;
    }
  }
}

// ---------- 输入 ----------
function flap() {
  if (!run) return;
  const res = run.flap();
  if (res.ok) updateHud();
}

function doFlap(e) {
  audio.unlock();
  if (phase === 'playing') { flap(); holding = true; }
}

function endHold() { holding = false; }

container.addEventListener('pointerdown', (e) => {
  if (phase === 'title' || phase === 'result') return;
  doFlap(e);
});
window.addEventListener('pointerup', endHold);
window.addEventListener('pointercancel', endHold);

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
    e.preventDefault();
    if (phase === 'playing') { flap(); holding = true; }
  } else if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  } else if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'result')) {
    restartLevel();
  } else if (e.code === 'KeyM') {
    toggleMute();
  }
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') { holding = false; }
});

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  ui.setMuted(muted);
  persist();
}

// ---------- UI 绑定 ----------
function bind() {
  const on = (id, fn) => { const el = $(id); if (el) el.addEventListener('click', () => { audio.unlock(); fn(); }); };
  on('btn-start', () => startLevel(lastLevel || 0));
  on('btn-resume', resumeGame);
  on('btn-restart', restartLevel);
  on('btn-restart2', restartLevel);
  on('btn-retry', restartLevel);
  on('btn-next', () => startLevel((run ? run.state.level : lastLevel + 1) - 1 + 1));
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-howto', () => startTutorial());
  $('btn-howto-title')?.addEventListener('click', () => { audio.unlock(); startTutorial(); });
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);
  $('btn-rotate-skip')?.addEventListener('click', () => {
    const rs = $('rotate-screen');
    if (rs) rs.style.display = 'none';
  });
  ui.levelGrid?.addEventListener('click', (e) => {
    const idx = e.target.closest('[data-level]')?.dataset.level;
    if (idx == null) return;
    const i = +idx;
    if (i + 1 > unlocked) return;
    startLevel(i);
  });
  for (const sel of ui.langSelects) {
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
  frameCount += 1;

  if (phase === 'playing' && run && tutorialStep < 0) {
    accumulator += dt;
    while (accumulator >= STEP) {
      run.setDive(holding);
      run.step(STEP);
      accumulator -= STEP;
    }
    if (autoFlap && frameCount % 20 === 0) flap();
    handleEvents(run.drainEvents());
    if (run && phase === 'playing') updateHud();
  }

  view.t += dt;
  if (view.shake > 0) view.shake = Math.max(0, view.shake - dt * 18);

  try {
    renderer.draw(run ? run.state : null, dt, view);
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
  start: (i) => startLevel(i == null ? (lastLevel || 0) : i),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => restartLevel(),
  home: () => goHome(),
  run: () => run,
  sim: () => (run ? run.state : null),
  save: (k, v) => Sdk.save(k, v),
  load: (k, f) => Sdk.load(k, f),
  ui: () => ui,
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['flap', 'gap', 'rocks', 'breach']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  debug: {
    state: () => (run ? run.state : null),
    lastOutcome: () => lastOutcome,
    stars: () => (run ? run.state.stars : 0),
    startSeeded: (i, seed) => {
      const idx = Math.max(0, Math.min(LEVEL_COUNT - 1, (i | 0) || 0));
      lastLevel = idx;
      lastOutcome = null;
      run = createRun(idx, { seed: (seed | 0) || 1 });
      phase = 'playing';
      holding = false;
      ui.showGame();
      ui.hideResult();
      updateHud();
      audio.unlock();
      audio.startBgm();
      return true;
    },
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    setAutoFlap: (b) => { autoFlap = !!b; return autoFlap; },
    cheatWin: () => {
      if (!run) return false;
      run.state.passed = 10;
      run.state.combo = 10;
      run.state.bestCombo = 10;
      run.state.score = 325;
      run.forceWin();
      handleEvents(run.drainEvents());
      return true;
    },
    cheatLose: () => {
      if (!run) return false;
      run.forceLose();
      handleEvents(run.drainEvents());
      return true;
    },
    loadLevel: (i) => startLevel(i),
  },
};

// ---------- 启动 ----------
function boot() {
  renderer.resize(container);
  bind();
  syncDocumentLang();
  ui.applyLang();
  ui.setMuted(muted);
  buildLevelGrid();
  Sdk.track('load', {});
  requestAnimationFrame(frame);
}

window.addEventListener('resize', () => renderer.resize(container));
boot();
