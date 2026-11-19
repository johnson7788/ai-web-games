// 主入口：60Hz 固定步长 + 标题/记忆/翻牌/暂停/结算 + 教程引导 + SDK 统一出口。
// 契约：window.__ll 调试口（state/start/pause/resume/restart/run/tutorial/startTutorial）。
import { STEP, GAME, WORLD, CONFIG } from '../config/game.config.js';
import { LEVELS, LEVEL_COUNT, symbolById } from '../config/levels.js';
import { createRun } from './game/sim.js';
import { createRenderer } from './render/index.js';
import { createAudio } from './core/audio.js';
import { ui } from './ui/ui.js';
import { i18n, t, syncDocumentLang } from './core/i18n.js';
import Sdk from './core/sdk.js';

const $ = (id) => document.getElementById(id);
const W = WORLD.WIDTH;
const H = WORLD.HEIGHT;
const canvas = ui.canvas;
const renderer = createRenderer(canvas);
const audio = createAudio();

let run = null;
let phase = 'title'; // title | memorize | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let mode = 'timed'; // timed | practice
let tutorialStep = -1;
let tutorialOnFinish = null;

const view = {
  hover: null,
  fx: [],
  shake: 0,
  flash: 0,
};

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let unlocked = Math.max(1, Sdk.load('unlocked', 1) | 0);
let starsByLevel = Sdk.load('stars', {}) || {};
let tutorialDone = !!Sdk.load('tutorialDone', false);
let lastLevel = Sdk.load('lastLevel', 0) | 0;

Sdk.ready(); // 不 await，不阻塞首屏
Sdk.onAdStart(() => { if (phase === 'playing' || phase === 'memorize') pauseGame(true); });
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

// ---------- 阶段状态机 ----------
function startLevel(idx) {
  idx = Math.max(0, Math.min(LEVEL_COUNT - 1, idx | 0));
  lastLevel = idx;
  run = createRun(idx, { mode, seed: (Date.now() % 2147483647) || 1 });
  view.fx = [];
  view.shake = 0;
  view.flash = 0;
  phase = 'memorize';
  ui.showGame();
  ui.hideResult();
  updateHud();
  audio.startBgm();
  Sdk.newRun({ level: idx + 1, mode });
}

function pauseGame(silent) {
  if (phase !== 'playing' && phase !== 'memorize') return;
  phase = 'paused';
  audio.stopBgm();
  if (!silent) ui.showPause();
}

function resumeGame() {
  if (phase !== 'paused') return;
  phase = 'playing';
  ui.hidePause();
  audio.startBgm();
}

function restartLevel() {
  if (run) Sdk.track('restart', { level: run.state.level + 1 });
  startLevel(run ? run.state.level : lastLevel);
}

function goHome() {
  run = null;
  phase = 'title';
  ui.hideResult();
  ui.showTitle();
  buildLevelGrid();
  updateModeToggle();
  audio.stopBgm();
}

// ---------- HUD / 关卡格 / 结算 ----------
function updateHud() {
  if (!run) return;
  const st = run.state;
  $('hud-level').textContent = `${t('level')} ${st.level + 1}`;
  const timeEl = $('hud-time');
  if (st.totalTime > 0) {
    const secs = Math.max(0, Math.ceil(st.timeLeft));
    timeEl.textContent = `${t('time')} ${secs}s`;
    timeEl.classList.toggle('time-low', secs <= 10);
  } else {
    timeEl.textContent = t('modePractice');
    timeEl.classList.remove('time-low');
  }
  $('hud-matched').textContent = t('matched', { a: st.matchedCount, b: st.cards.length });
  const comboEl = $('hud-combo');
  comboEl.textContent = st.combo >= 2 ? `${t('combo')} ×${st.combo}` : '';
  $('peek-badge').textContent = st.peekCharges;
  $('btn-peek').classList.toggle('is-muted', st.peekCharges <= 0);
  const hintEl = $('board-hint');
  if (hintEl) hintEl.textContent = st.phase === 'memorize' ? t('hintMemorize') : t('hintFind');
}

function buildLevelGrid() {
  const grid = $('level-grid');
  if (!grid) return;
  grid.innerHTML = '';
  for (let i = 0; i < LEVEL_COUNT; i += 1) {
    const cell = document.createElement('button');
    cell.className = 'level-cell' + (i + 1 > unlocked ? ' locked' : '');
    cell.dataset.level = i;
    const s = starsByLevel[i + 1] | 0;
    cell.innerHTML =
      `<span class="lv-num">${i + 1}</span>` +
      `<span class="lv-stars">${'★'.repeat(s)}${'☆'.repeat(3 - s)}</span>`;
    cell.setAttribute('aria-label', `${t('level')} ${i + 1}${i + 1 > unlocked ? ' ' + t('locked') : ''}`);
    grid.appendChild(cell);
  }
  $('stars-total').textContent = `★ ${totalStars()} / ${LEVEL_COUNT * 3}`;
}

function updateModeToggle() {
  ui.modeTimed.classList.toggle('is-active', mode === 'timed');
  ui.modePractice.classList.toggle('is-active', mode === 'practice');
}

function finishRun() {
  if (!run) return;
  const st = run.state;
  phase = 'result';
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  const won = st.phase === 'won';
  const stars = won ? st.stars : 0;
  if (won) {
    const idx = st.level;
    starsByLevel[idx + 1] = Math.max(starsByLevel[idx + 1] | 0, stars);
    if (idx + 1 < LEVEL_COUNT) unlocked = Math.max(unlocked, idx + 2);
    buildLevelGrid();
  }
  persist();
  if (won) Sdk.levelCleared({ level: st.level + 1, stars });
  else Sdk.gameOver({ level: st.level + 1 });

  ui.resultTitle.textContent = won ? t('winTitle') : t('loseTitle');
  ui.resultTitle.classList.toggle('lose', !won);
  ui.resultStars.innerHTML = won
    ? `<span class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>${stars >= 3 ? `<em>${t('perfect')}</em>` : ''}`
    : '';
  ui.resultMeta.textContent = won
    ? `${t('bestCombo', { c: st.maxCombo })} · ${t('missCount', { m: st.mismatches })} · ${st.totalTime > 0 ? t('timeLeft', { s: Math.max(0, Math.ceil(st.timeLeft)) }) : t('modePractice')}`
    : t('timeUp');
  $('btn-next').style.display = (won && st.level + 1 < LEVEL_COUNT) ? '' : 'none';
  ui.showResult();
  audio.event(won ? 'win' : 'lose');
}

// ---------- 教程引导 ----------
const TUT_STEPS = () => [
  { text: t('tutStep1'), spot: 'board' },
  { text: t('tutStep2'), spot: 'board' },
  { text: t('tutStep3'), spot: 'combo' },
  { text: t('tutStep4'), spot: 'peek' },
];

function spotRect(which) {
  try {
    if (which === 'board') {
      const lay = renderer.debugLayout();
      if (lay) return { x: lay.boardX, y: lay.boardY, w: lay.boardW, h: lay.boardH };
      return null;
    }
    const el = $(which === 'combo' ? 'hud-combo' : 'btn-peek');
    if (!el || el.classList.contains('hidden')) return null;
    const r = el.getBoundingClientRect();
    const c = document.getElementById('game-container').getBoundingClientRect();
    return { x: r.left - c.left, y: r.top - c.top, w: r.width, h: r.height };
  } catch { return null; }
}

function startTutorial(onFinish) {
  tutorialStep = 0;
  tutorialOnFinish = onFinish || null;
  renderTutorial();
}

function renderTutorial() {
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
  const rect = s && s.spot ? spotRect(s.spot) : null;
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

function endTutorial() {
  tutorialStep = -1;
  tutorialDone = true;
  persist();
  renderTutorial();
  const f = tutorialOnFinish;
  tutorialOnFinish = null;
  if (f) f();
}

function tutorialNext() {
  tutorialStep += 1;
  if (tutorialStep >= TUT_STEPS().length) endTutorial();
  else renderTutorial();
}

// ---------- 事件消费 ----------
function cardCenter(id) {
  const lay = renderer.debugLayout();
  if (!lay || !run) return null;
  const st = run.state;
  const c = id % st.cols;
  const r = Math.floor(id / st.cols);
  return {
    x: lay.boardX + c * lay.cell + lay.cell / 2,
    y: lay.boardY + r * lay.cell + lay.cell / 2,
  };
}

function spawnSparks(x, y, color, n) {
  for (let i = 0; i < n; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const sp = 40 + Math.random() * 120;
    view.fx.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 40,
      color,
      life: 0.5 + Math.random() * 0.3,
      maxLife: 0.8,
      size: 2 + Math.random() * 3,
    });
  }
}

function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    switch (ev.type) {
      case 'match': {
        view.shake = 3;
        for (const id of (ev.ids || [])) {
          const p = cardCenter(id);
          if (p) spawnSparks(p.x, p.y, symbolById(run.state.cards[id].name).color, 8);
        }
        break;
      }
      case 'mismatch':
        view.shake = 4;
        break;
      case 'peek':
        view.flash = 0.5;
        break;
      case 'win': {
        const colors = ['#ffd06b', '#5ef0ff', '#ff3c8c', '#8f6bff'];
        for (let i = 0; i < 44; i += 1) {
          spawnSparks(60 + Math.random() * (W - 120), 40 + Math.random() * 320, colors[i % 4], 3);
        }
        break;
      }
      default:
        break;
    }
  }
}

// ---------- 输入 ----------
function canvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (W / rect.width),
    y: (e.clientY - rect.top) * (H / rect.height),
  };
}

function pickCell(p) {
  const lay = renderer.debugLayout();
  if (!lay || !run) return null;
  const c = Math.floor((p.x - lay.boardX) / lay.cell);
  const r = Math.floor((p.y - lay.boardY) / lay.cell);
  if (r < 0 || r >= run.state.rows || c < 0 || c >= run.state.cols) return null;
  return { r, c, id: r * run.state.cols + c };
}

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (!run || phase !== 'playing') return;
  const p = canvasPos(e);
  const cell = pickCell(p);
  if (cell) run.showCard(cell.id);
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing' || phase === 'memorize') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
  if (e.code === 'KeyR' && (phase === 'playing' || phase === 'memorize' || phase === 'paused' || phase === 'result')) restartLevel();
  if (e.code === 'KeyM') toggleMute();
});

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  ui.setMuted(muted);
  persist();
}

function onStartClick() {
  audio.unlock();
  if (!tutorialDone) startTutorial(() => startLevel(lastLevel || 0));
  else startLevel(lastLevel || 0);
}

// ---------- UI 绑定 ----------
function bind() {
  const on = (id, fn) => {
    const el = $(id);
    if (el) el.addEventListener('click', () => { audio.unlock(); fn(); });
  };
  on('btn-start', onStartClick);
  on('btn-title-howto', () => startTutorial(null));
  on('btn-howto', () => startTutorial(null));
  on('btn-howto2', () => { if (phase === 'paused') resumeGame(); startTutorial(null); });
  on('btn-resume', resumeGame);
  on('btn-restart', restartLevel);
  on('btn-restart2', restartLevel);
  on('btn-retry', restartLevel);
  on('btn-next', () => startLevel((run ? run.state.level : lastLevel) + 1));
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-peek', () => { if (run && phase === 'playing') { run.usePeek(); updateHud(); } });
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);

  ui.modeTimed.addEventListener('click', () => { mode = 'timed'; updateModeToggle(); });
  ui.modePractice.addEventListener('click', () => { mode = 'practice'; updateModeToggle(); });

  $('level-grid')?.addEventListener('click', (e) => {
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
      buildLevelGrid();
      if (run) updateHud();
      renderTutorial();
    });
  }
}

// ---------- 主循环 ----------
function frame(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;

  if (run && (phase === 'memorize' || phase === 'playing')) {
    accumulator += dt;
    while (accumulator >= STEP) {
      run.step(STEP);
      accumulator -= STEP;
    }
    handleEvents(run.drainEvents());
    if (run.state.phase === 'won' || run.state.phase === 'lost') finishRun();
    else if (phase === 'memorize' && run.state.phase === 'playing') phase = 'playing';
    updateHud();
  }

  if (view.shake > 0) view.shake = Math.max(0, view.shake - dt * 18);
  if (view.flash > 0) view.flash = Math.max(0, view.flash - dt * 2.2);
  for (const p of view.fx) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 60 * dt;
    p.life -= dt;
  }
  view.fx = view.fx.filter((p) => p.life > 0);

  renderer.draw(run ? run.state : null, dt, view);
  requestAnimationFrame(frame);
}

// ---------- 调试契约 ----------
function syncPhaseFromRun() {
  if (!run) { phase = 'title'; return; }
  if (run.state.phase === 'won' || run.state.phase === 'lost') phase = 'result';
  else if (run.state.phase === 'playing') phase = 'playing';
  else if (run.state.phase === 'memorize') phase = 'memorize';
}

function debugDrain() { run.drainEvents(); }

function debugEnterPlaying() {
  if (!run) return false;
  while (run.state.phase === 'memorize') { run.step(0.05); debugDrain(); }
  if (run.state.phase === 'playing') phase = 'playing';
  return run.state.phase === 'playing';
}

function debugSolve() {
  if (!run) return false;
  debugEnterPlaying();
  let guard = 5000;
  while (run.state.phase === 'playing' && guard-- > 0) {
    if (run.state.simTime < run.state.lockedUntil) { run.step(0.05); debugDrain(); continue; }
    const st = run.state;
    const byName = {};
    for (const c of st.cards) if (!c.matched) (byName[c.name] = byName[c.name] || []).push(c.id);
    const name = Object.keys(byName).find((n) => byName[n].length >= st.groupOf);
    if (!name) { run.step(0.05); debugDrain(); continue; }
    for (const id of byName[name]) run.showCard(id);
    run.step(0.4);
    debugDrain();
  }
  debugDrain();
  if (run.state.phase === 'won') finishRun();
  else syncPhaseFromRun();
  return run.state.phase === 'won';
}

window.__ll = {
  state: {
    get phase() { return phase; },
    get lang() { return i18n.lang; },
  },
  run: () => run,
  sim: () => (run ? run.state : null),
  start: (i) => startLevel(i == null ? (lastLevel || 0) : i),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => restartLevel(),
  home: () => goHome(),
  startTutorial: () => startTutorial(null),
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['memorize', 'flip', 'combo', 'peek']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  debug: {
    state: () => (run ? run.state : null),
    layout: () => renderer.debugLayout(),
    play: () => { startLevel(lastLevel || 0); debugEnterPlaying(); },
    enterPlaying: () => debugEnterPlaying(),
    solve: () => debugSolve(),
    loadLevel: (i) => startLevel(i),
    fail: () => {
      if (!run) return false;
      debugEnterPlaying();
      if (run.state.totalTime > 0) {
        run.state.timeLeft = 0;
        run.step(0.02);
        debugDrain();
      } else {
        run.state.phase = 'lost';
      }
      syncPhaseFromRun();
      return run.state.phase === 'lost';
    },
  },
};

// ---------- 启动 ----------
bind();
syncDocumentLang();
ui.applyLang();
buildLevelGrid();
updateModeToggle();
ui.showTitle();
ui.setMuted(muted);
Sdk.track('load', {});
requestAnimationFrame(frame);
