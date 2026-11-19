// SNAIL MAZE · 主入口：60Hz 固定步长 + 标题/关卡/暂停/结算 + 教程引导 + SDK 统一出口。
import { STEP } from '../config/game.config.js';
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
const reducedMotion = typeof window !== 'undefined'
  && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let run = null;
let phase = 'title';           // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let fpsSamples = [];
let tutorialStep = -1;         // -1 = 未激活
let prevBestForRun = 0;

const view = {
  shake: 0,
  flash: 0,
  flashColor: 'rgba(255,255,255,0.5)',
  reduced: reducedMotion,
};

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let unlocked = Math.max(1, Sdk.load('unlocked', 1) | 0);
let starsByLevel = Sdk.load('stars', {}) || {};
let bestByLevel = Sdk.load('bestByLevel', {}) || {};
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
  Sdk.save('bestByLevel', bestByLevel);
  Sdk.save('muted', muted);
  Sdk.save('tutorialDone', tutorialDone);
  Sdk.save('lastLevel', lastLevel);
}

function totalStars() {
  return Object.values(starsByLevel).reduce((a, b) => a + (b | 0), 0);
}

function setPhase(p) { phase = p; }

function startLevel(idx) {
  idx = Math.max(0, Math.min(LEVEL_COUNT - 1, idx | 0));
  lastLevel = idx;
  run = createRun(idx, { seed: (Date.now() % 2147483647) || 1 });
  renderer.resetCamera();
  view.shake = 0;
  view.flash = 0;
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
  const idx = run ? run.state.level : lastLevel;
  startLevel(idx);
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
  $('hud-level').textContent = `${t('level')} ${h.level}`;
  $('hud-score').textContent = `${t('score')} ${h.score}`;
  const comboEl = $('hud-combo');
  comboEl.textContent = h.combo > 1 ? `×${h.combo}` : '';
  comboEl.style.display = h.combo > 1 ? '' : 'none';
  $('hud-orbs').textContent = `${t('orbs')} ${h.orbsCollected}/${h.orbsTotal}`;
  $('hud-progress').style.width = `${Math.round(h.progress * 100)}%`;
}

function buildLevelGrid() {
  const grid = $('level-grid');
  grid.innerHTML = '';
  for (let i = 0; i < LEVEL_COUNT; i += 1) {
    const cell = document.createElement('button');
    cell.className = 'level-cell' + (i >= unlocked ? ' locked' : '');
    cell.dataset.level = i;
    const stars = starsByLevel[i] | 0;
    cell.innerHTML = `<span class="lv-num">${i + 1}</span><span class="lv-stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>`;
    cell.setAttribute('aria-label', `${t('level')} ${i + 1}${i >= unlocked ? ' ' + t('locked') : ''}`);
    grid.appendChild(cell);
  }
  $('stars-total').textContent = `★ ${totalStars()} / ${LEVEL_COUNT * 3}`;
}

function showResult(res) {
  const { won, rating, score, time, reason, hasNext, isRecord } = res;
  $('result-title').textContent = won ? t('winTitle') : t('loseTitle');
  $('result-title').classList.toggle('lose', !won);
  $('result-stars').innerHTML = won
    ? `<span class="stars">${'★'.repeat(rating)}${'☆'.repeat(3 - rating)}</span>${rating >= 3 ? `<em>${t('perfect')}</em>` : ''}`
    : '';
  $('result-time').textContent = won
    ? `${t('resultTime')}: ${Math.round(time)}s${isRecord ? ' · ' + t('newRecord') : ''}`
    : '';
  $('result-meta').textContent = won
    ? `${t('score')}: ${score}`
    : (reason === 'wall' ? t('wallHit') : t('rockHit'));
  $('btn-next').style.display = won && hasNext ? '' : 'none';
  ui.showResult();
}

function finishRun(ev) {
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  const st = run.state;
  const won = ev.type === 'win';
  const rating = won ? (st.rating || 1) : 0;
  let isRecord = false;
  if (won) {
    const idx = st.level;
    starsByLevel[idx] = Math.max(starsByLevel[idx] | 0, rating);
    if (idx + 1 < LEVEL_COUNT) unlocked = Math.max(unlocked, idx + 2);
    if (st.score > (bestByLevel[idx] | 0)) { bestByLevel[idx] = st.score; isRecord = true; }
    buildLevelGrid();
  }
  persist();
  if (won) Sdk.levelCleared({ level: st.level + 1, rating, score: st.score });
  else Sdk.gameOver({ level: st.level + 1, score: st.score });
  showResult({ won, rating, score: st.score, time: st.time, reason: ev.reason || null, hasNext: st.level + 1 < LEVEL_COUNT, isRecord });
  audio.event(won ? 'win' : 'lose');
}

// ---------- 教程 ----------
const TUT_STEPS = () => [
  { key: 'tutStep1' },
  { key: 'tutStep2' },
  { key: 'tutStep3' },
];

function startTutorial() {
  if (phase === 'paused') resumeGame();
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
  $('tut-text').textContent = s ? t(s.key) : '';
  $('tut-skip').textContent = t('tutSkip');
  $('tut-next').textContent = t('tutNext');
  $('tut-spotlight').style.display = 'none';
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
      case 'star': renderer.spawn('star', ev.x, ev.y); break;
      case 'bash': renderer.spawn('bash', ev.x, ev.y); view.shake = 4; break;
      case 'rockHit':
        renderer.spawn('rockHit', ev.x, ev.y);
        view.shake = 6;
        view.flash = 0.4;
        view.flashColor = 'rgba(255,84,112,0.45)';
        break;
      case 'turn': { const sp = run.snail(); renderer.spawn('turn', sp.x, sp.y); break; }
      case 'win': { const sp = run.snail(); renderer.spawn('win', sp.x, sp.y); finishRun(ev); return; }
      case 'lose': { const sp = run.snail(); renderer.spawn('crash', sp.x, sp.y); view.shake = 8; finishRun(ev); return; }
      default: break;
    }
  }
}

// ---------- 输入 ----------
canvas.addEventListener('pointerdown', () => {
  audio.unlock();
  if (!run || phase !== 'playing' || tutorialStep >= 0) return;
  run.tap();
  updateHud();
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'Enter') {
    e.preventDefault();
    audio.unlock();
    if (run && phase === 'playing' && tutorialStep < 0) { run.tap(); updateHud(); }
  } else if (e.code === 'KeyR') {
    if (phase === 'playing' || phase === 'paused' || phase === 'result') restartLevel();
  } else if (e.code === 'KeyM') {
    toggleMute();
  } else if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
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
  on('btn-next', () => startLevel((run ? run.state.level : lastLevel) + 1));
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result' || phase === 'paused') startTutorial(); });
  on('btn-howto2', () => { if (phase === 'paused') resumeGame(); startTutorial(); });
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);

  $('level-grid')?.addEventListener('click', (e) => {
    const idx = e.target.closest('[data-level]')?.dataset.level;
    if (idx == null) return;
    const i = +idx;
    if (i >= unlocked) return;
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

  if (phase === 'playing' && run && tutorialStep < 0) {
    accumulator += dt;
    while (accumulator >= STEP && run.state.phase !== 'won' && run.state.phase !== 'lost') {
      run.step(STEP);
      accumulator -= STEP;
    }
    handleEvents(run.drainEvents());
    if (run && phase === 'playing') updateHud();
  }

  if (view.shake > 0) view.shake = Math.max(0, view.shake - dt * 18);
  if (view.flash > 0) view.flash = Math.max(0, view.flash - dt * 2.2);
  if (view.reduced) { view.shake = 0; view.flash = 0; }

  try {
    renderer.draw(run, dt, view);
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
  save: (k, v) => Sdk.save(k, v),
  load: (k) => Sdk.load(k),
  ui: () => ui,
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['tap', 'stars', 'bash']; },
    get current() { return tutorialStep >= 0 ? { text: t(TUT_STEPS()[tutorialStep].key) } : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: () => (run ? { ...run.state } : null),
    loadLevel: (i) => startLevel(i),
    startSeeded: (i, seed) => {
      const idx = Math.max(0, Math.min(LEVEL_COUNT - 1, i | 0));
      lastLevel = idx;
      run = createRun(idx, { seed: seed | 0 || 1 });
      renderer.resetCamera();
      view.shake = 0; view.flash = 0;
      setPhase('playing');
      ui.showGame();
      ui.hideResult();
      updateHud();
      return true;
    },
    autoWin: () => {
      if (!run || phase !== 'playing') return false;
      let guard = 40000;
      while (guard-- > 0 && run.state.phase !== 'won' && run.state.phase !== 'lost') {
        const h = run.hint();
        if (h) run.tap();
        run.step(1 / 60);
        handleEvents(run.drainEvents());
        if (phase !== 'playing') break;
      }
      return run.state.phase === 'won';
    },
    fastForward: () => {
      if (!run) return false;
      let guard = 40000;
      while (guard-- > 0 && run.state.phase !== 'won' && run.state.phase !== 'lost') {
        const h = run.hint();
        if (h) run.tap();
        run.step(1 / 60);
        handleEvents(run.drainEvents());
        if (phase !== 'playing') break;
      }
      return true;
    },
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
  },
};

// ---------- 启动 ----------
bind();
syncDocumentLang();
ui.applyLang();
buildLevelGrid();
$('btn-mute').classList.toggle('is-muted', muted);
Sdk.track('load', {});
requestAnimationFrame(frame);
