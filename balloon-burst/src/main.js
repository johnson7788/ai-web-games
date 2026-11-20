// 主入口：60Hz 固定步长 + 标题/关卡/游戏/暂停/结算 + 教程引导 + SDK 统一出口。
// 契约见 docs/README.md。装配：sim + render + audio + ui + main 集成。
import { STEP, GAME } from '../config/game.config.js';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';
import { createRun, largestGroup } from './game/sim.js';
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

const view = {
  cursor: { x: 0, y: 0 },
  hoverCell: null,
  dragStart: null,
  dragLine: null,
  fx: [],        // {type:'pop', r,c, ttl, max, color, seed}
  rises: [],     // 升空孔明灯
  glow: 0,       // 大场面暖光 0..1
  shake: 0,
  sceneKey: 'dusk',
};

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let unlocked = Math.max(1, Sdk.load('unlocked', 1) | 0);
let starsByLevel = Sdk.load('stars', {}) || {};
let tutorialDone = !!Sdk.load('tutorialDone', false);
let bestScore = Sdk.load('best', 0) | 0;
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
  Sdk.save('best', bestScore);
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
  view.sceneKey = run.state.sceneKey;
  view.hoverCell = null;
  view.dragStart = null;
  view.dragLine = null;
  view.fx = [];
  view.rises = [];
  view.glow = 0;
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
  $('hud-level').textContent = `${t('level')} ${run.state.level}` + (lv.name ? ' · ' + (lv.name[i18n.lang] || lv.name.en || '') : '');
  $('hud-score').textContent = `${t('score')}: ${h.score}`;
  $('hud-target').textContent = `${t('target')}: ${h.target}`;
  const secs = Math.max(0, Math.ceil(h.timeLeft));
  const timeEl = $('hud-time');
  timeEl.textContent = secs + 's';
  timeEl.classList.toggle('time-low', secs <= 10);
  $('hud-chain').style.display = h.chain > 0 ? '' : 'none';
  $('hud-chain').textContent = `🔗 ×${h.chain}`;
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
  const { won, stars, score, target, timeLeft } = res;
  $('result-title').textContent = won ? t('winTitle') : t('loseTitle');
  $('result-title').classList.toggle('lose', !won);
  const starsEl = $('result-stars');
  starsEl.innerHTML = won
    ? `<span class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>${stars >= 3 ? `<em>${t('perfect')}</em>` : ''}`
    : '';
  $('result-meta').textContent = won
    ? `${t('scoreLabel')}: ${score} / ${t('target')}: ${target} · ${t('time')}: ${Math.ceil(timeLeft)}s`
    : (score >= target * 0.85 ? t('nearMiss') : t('timeOut'));
  $('btn-next').style.display = won && run.state.level < LEVEL_COUNT ? '' : 'none';
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
    bestScore = Math.max(bestScore, st.score);
    buildLevelGrid();
  }
  persist();
  Sdk.track(won ? 'win' : 'fail', {
    level: st.level, stars, score: st.score, target: st.target,
    durationMs: Math.round((st.initialTime - st.timeLeft) * 1000),
  });
  showResult({ won, stars, score: st.score, target: st.target, timeLeft: st.timeLeft });
  audio.event(won ? 'win' : 'lose');
}

// ---------- 教程引导 ----------
const TUT_STEPS = () => [
  { text: t('tutStep1'), spot: 'grid' },
  { text: t('tutStep2'), spot: 'grid' },
  { text: t('tutStep3'), spot: 'score' },
];

function layoutRect(which) {
  try {
    const lay = renderer.debugLayout();
    if (!lay) return null;
    if (which === 'grid') return lay.grid;
    if (which === 'score') return { x: lay.grid.x, y: lay.hud.y, w: 260, h: lay.hud.h };
    return null;
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

const TUT_TRIGGER = ['pop', 'pop', 'pop'];

function tutorialAdvance(evType) {
  if (tutorialStep < 0 || tutorialStep >= TUT_TRIGGER.length) return;
  if (TUT_TRIGGER[tutorialStep] !== evType) return;
  tutorialStep += 1;
  if (tutorialStep >= TUT_TRIGGER.length) endTutorial();
  else renderTutorialStep();
}

// ---------- 事件消费 ----------
const FX_COLORS = ['coral', 'amber', 'gold', 'jade', 'sky', 'violet'];

function spawnPopFx(cells) {
  for (const cell of cells.slice(0, 16)) {
    view.fx.push({
      type: 'pop', r: cell.r, c: cell.c,
      ttl: 0.38, max: 0.38,
      color: FX_COLORS[Math.floor(Math.random() * FX_COLORS.length)],
      seed: Math.random() * 6,
    });
  }
}

function spawnRises() {
  const lay = renderer.debugLayout();
  if (!lay) return;
  for (let i = 0; i < 9; i += 1) {
    view.rises.push({
      x: lay.grid.x + (Math.random() * lay.grid.w),
      y: lay.grid.y + lay.grid.h * (0.4 + Math.random() * 0.4),
      s: 0.7 + Math.random() * 0.5,
      seed: i,
      ttl: 2.4, max: 2.4,
    });
  }
  view.glow = 1;
}

function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    tutorialAdvance(ev.type);
    switch (ev.type) {
      case 'tap':
        break;
      case 'pop':
      case 'cascade':
        if (ev.cells) spawnPopFx(ev.cells);
        view.shake = Math.min(4, (ev.n || 0) * 0.5);
        if (ev.n >= GAME.BIG_CLEAR_MIN) spawnRises();
        break;
      case 'bigClear':
        spawnRises();
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
  if (view.dragStart && view.hoverCell) {
    view.dragLine = { from: view.dragStart, to: view.hoverCell };
  }
});

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (!run || phase !== 'playing') return;
  const p = canvasPos(e);
  view.cursor = p;
  view.dragStart = pickCell(p);
});

canvas.addEventListener('pointerup', (e) => {
  if (!run || phase !== 'playing') return;
  const p = canvasPos(e);
  view.cursor = p;
  const cell = pickCell(p);
  view.dragLine = null;
  view.dragStart = null;
  if (cell) {
    const res = run.tap(cell.r, cell.c);
    if (res.ok) handleEvents(run.drainEvents());
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
  on('btn-next', () => startLevel((run ? run.state.level : lastLevel + 1)));
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-tut-replay', () => {
    if (phase === 'paused') resumeGame();
    if (phase === 'playing') startTutorial();
  });
  on('btn-howto', () => { if (phase === 'playing') startTutorial(); });
  on('btn-rotate-skip', () => { const rs = $('rotate-screen'); if (rs) rs.style.display = 'none'; });
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
    if (run && phase === 'playing') updateHud();
  }

  if (view.shake > 0) view.shake = Math.max(0, view.shake - dt * 18);
  if (view.glow > 0) view.glow = Math.max(0, view.glow - dt * 0.7);
  for (const fx of view.fx) if (fx.ttl > 0) fx.ttl -= dt;
  for (const r of view.rises) if (r.ttl > 0) r.ttl -= dt;
  view.fx = view.fx.filter((fx) => fx.ttl > 0);
  view.rises = view.rises.filter((r) => r.ttl > 0);

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
  save: (k, v) => { Sdk.save(k, v); return true; },
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
    get steps() { return ['pop', 'pop', 'pop']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: () => {
      if (!run) return null;
      const st = run.state;
      return { ...st };
    },
    layout: () => { try { return renderer.debugLayout(); } catch { return null; } },
    loadLevel: (i) => startLevel(i),
    startSeeded: (i, seed) => {
      const idx = Math.max(0, Math.min(LEVEL_COUNT - 1, i | 0));
      lastLevel = idx;
      run = createRun(idx, { seed: seed | 0 || 1 });
      view.sceneKey = run.state.sceneKey;
      setPhase('playing');
      ui.showGame();
      hideResult();
      updateHud();
      return true;
    },
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    startTutorial: () => startTutorial(),
    tutorialStep: () => tutorialStep,
    // 自动通关：反复点击最大同色群直到赢/输
    autoClear: () => {
      if (!run) return 0;
      let pops = 0;
      let guard = 400;
      while (guard-- > 0 && run.state.phase === 'playing') {
        const g = largestGroup(run.state.grid, GAME.MANUAL_MIN);
        if (!g) { run.ensurePlayable(); continue; }
        const res = run.tap(g[0].r, g[0].c);
        if (!res.ok) break;
        pops += 1;
        handleEvents(run.drainEvents());
      }
      return pops;
    },
    autoPlaceSolution: () => window.__ll.debug.autoClear(),
    popLargest: () => {
      if (!run || run.state.phase !== 'playing') return false;
      const g = largestGroup(run.state.grid, GAME.MANUAL_MIN);
      if (!g) return false;
      const res = run.tap(g[0].r, g[0].c);
      if (res.ok) { handleEvents(run.drainEvents()); updateHud(); }
      return !!res.ok;
    },
    fastForward: () => {
      if (!run) return false;
      window.__ll.debug.autoClear();
      return true;
    },
    giveUp: () => window.__ll.debug.fastForward(),
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
Sdk.track('load', {});
requestAnimationFrame(frame);
