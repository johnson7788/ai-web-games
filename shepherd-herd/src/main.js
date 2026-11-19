// 主入口：60Hz 固定步长 + 标题/游戏/暂停/结算 + 教程引导 + SDK 统一出口。
// 契约：window.__ll = { state:{phase,lang}, start, pause, resume, restart, run, tutorial:{...}, startTutorial }。
import { STEP, WORLD } from '../config/game.config.js';
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
let phase = 'title'; // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let fpsSamples = [];
let tutorialStep = -1; // -1 = 未激活

const view = {
  shake: 0,
  clock: 0,
  particles: [],
};

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let unlocked = Math.max(1, Sdk.load('unlocked', 1) | 0);
let starsByLevel = Sdk.load('stars', {}) || {};
let bestScore = Sdk.load('best', 0) | 0;
let tutorialDone = !!Sdk.load('tutorialDone', false);
let lastLevel = Sdk.load('lastLevel', 0) | 0;

Sdk.ready(); // 不 await，不阻塞首屏
Sdk.onAdStart(() => { if (phase === 'playing') pauseGame(true); });
Sdk.onAdEnd(() => { if (phase === 'paused') resumeGame(); });
audio.setMuted(muted);
ui.setMuted(muted);

function persist() {
  Sdk.save('muted', muted);
  Sdk.save('unlocked', unlocked);
  Sdk.save('stars', starsByLevel);
  Sdk.save('best', bestScore);
  Sdk.save('tutorialDone', tutorialDone);
  Sdk.save('lastLevel', lastLevel);
}

function totalStars() {
  return Object.values(starsByLevel).reduce((a, b) => a + (b | 0), 0);
}

// ---------- 阶段状态机 ----------
function setPhase(p) {
  phase = p;
}

function startLevel(idx) {
  idx = Math.max(0, Math.min(LEVEL_COUNT - 1, idx | 0));
  lastLevel = idx;
  run = createRun(idx, { seed: (Date.now() % 2147483647) || 1 });
  view.particles = [];
  view.shake = 0;
  setPhase('playing');
  ui.showGame();
  ui.hideResult();
  updateHud();
  audio.startBgm();
  Sdk.newRun({ level: idx + 1 });
  if (!tutorialDone) startTutorial();
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
  if (run) Sdk.track('restart', { level: run.level + 1 });
  startLevel(run ? run.levelIndex : lastLevel);
}

function goHome() {
  run = null;
  setPhase('title');
  ui.hideResult();
  ui.showTitle();
  renderTitleMeta();
}

// ---------- HUD / 结算 ----------
function updateHud() {
  if (!run) return;
  const h = run.getHud();
  $('hud-level').textContent = `${t('level')} ${h.level}`;
  $('hud-time').textContent = `${Math.max(0, Math.ceil(h.timeLeft))}s`;
  $('hud-time').classList.toggle('time-low', h.timeLeft <= 10);
  $('hud-fed').textContent = t('fedCount', { fed: h.fedCount, total: h.total });
  $('hud-combo').textContent = h.combo >= 2 ? `×${h.combo}` : '';
  $('hud-score').textContent = `${h.score}`;
  const hint = $('hud-hint');
  if (hint) hint.textContent = t('hint');
}

function renderTitleMeta() {
  const st = $('stars-total');
  const bs = $('best-score');
  if (st) st.textContent = `★ ${totalStars()} / ${LEVEL_COUNT * 3}`;
  if (bs) bs.textContent = `${t('best')}: ${bestScore}`;
}

function showResult(ev) {
  const won = ev.type === 'win';
  const stars = won ? (ev.stars || run.stars || 1) : 0;
  $('result-title').textContent = won ? t('winTitle') : t('loseTitle');
  $('result-title').classList.toggle('lose', !won);
  $('result-stars').innerHTML = won
    ? `<span class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>${stars >= 3 ? `<em>${t('perfect')}</em>` : ''}`
    : '';
  $('result-score').textContent = `${t('score')}: ${run.score}`;
  $('result-meta').textContent = won ? t('timeLeft', { s: Math.ceil(run.timeLeft) }) : t('timeOut');
  $('btn-next').style.display = won && run.levelIndex + 1 < LEVEL_COUNT ? '' : 'none';
  ui.showResult();
}

function finishRun(ev) {
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  const st = run;
  const won = ev.type === 'win';
  const stars = won ? (ev.stars || st.stars || 1) : 0;
  if (won) {
    starsByLevel[st.level] = Math.max(starsByLevel[st.level] | 0, stars);
    if (st.levelIndex + 1 < LEVEL_COUNT) unlocked = Math.max(unlocked, st.levelIndex + 2);
    bestScore = Math.max(bestScore, st.score);
  }
  persist();
  Sdk.track(won ? 'win' : 'fail', {
    level: st.level, stars, score: st.score,
    durationMs: Math.round((st.totalTime - st.timeLeft) * 1000),
    combo: st.combo, mistakes: st.mistakes,
  });
  showResult(ev);
  audio.event(won ? 'win' : 'lose');
}

// ---------- 教程（首次自动弹，可跳过，完成/跳过后持久化） ----------
const TUT_STEPS = ['observe', 'feed', 'combo'];

function startTutorial() {
  tutorialStep = 0;
  renderTutorialStep();
}

function renderTutorialStep() {
  const el = $('tutorial');
  if (tutorialStep < 0) {
    el.classList.add('hidden');
    return;
  }
  el.classList.remove('hidden');
  $('tut-title').textContent = t('tutTitle');
  $('tut-text').textContent = t('tut' + (tutorialStep + 1));
  $('tut-skip').textContent = t('tutSkip');
  $('tut-next').textContent = t('tutNext');
}

function tutorialNext() {
  tutorialStep += 1;
  if (tutorialStep >= TUT_STEPS.length) endTutorial();
  else renderTutorialStep();
}

function endTutorial() {
  tutorialStep = -1;
  tutorialDone = true;
  persist();
  renderTutorialStep();
}

// ---------- 事件消费 ----------
function spawnParticles(x, y, color, n, speed = 140) {
  for (let i = 0; i < n; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const sp = speed * (0.4 + Math.random() * 0.8);
    view.particles.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      r: 3 + Math.random() * 4,
      color,
      ttl: 0.5 + Math.random() * 0.3,
      max: 0.8,
    });
  }
}

function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    const sh = ev.id != null ? run.sheep.find((x) => x.id === ev.id) : null;
    switch (ev.type) {
      case 'feedLaunch':
        if (sh) spawnParticles(sh.x, sh.y, '#b6ff00', 3, 90);
        break;
      case 'feedLand':
        if (sh) spawnParticles(sh.x, sh.y, ev.golden ? '#ffd34d' : '#00e5ff', ev.golden ? 14 : 7, 160);
        view.shake = 2;
        break;
      case 'combo':
        spawnParticles(WORLD.WIDTH / 2, WORLD.FIELD.top + 30, '#ffd34d', 5, 120);
        break;
      case 'goldenFed':
        if (sh) spawnParticles(sh.x, sh.y, '#ffd34d', 16, 200);
        view.shake = 4;
        break;
      case 'mistake':
        if (sh) spawnParticles(sh.x, sh.y, '#ff5d5d', 8, 150);
        view.shake = 5;
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

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (!run || phase !== 'playing') return;
  const p = canvasPos(e);
  run.tap(p.x, p.y);
  updateHud();
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
  on('btn-next', () => startLevel((run ? run.levelIndex : lastLevel) + 1));
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home2b', goHome);
  on('btn-mute', toggleMute);
  const howto = () => { if (phase === 'playing' || phase === 'paused' || phase === 'result') startTutorial(); };
  on('btn-howto', howto);
  on('btn-howto2', howto);
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);
  on('btn-rotate-skip', () => {
    const rs = $('rotate-screen');
    if (rs) rs.style.display = 'none';
  });

  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = $(id);
    if (!sel) continue;
    sel.addEventListener('change', () => {
      ui.setLang(sel.value);
      renderTutorialStep();
      renderTitleMeta();
      if (run) updateHud();
      const rt = $('rotate-text');
      const rb = $('btn-rotate-skip');
      if (rt) rt.textContent = t('rotateHint');
      if (rb) rb.textContent = t('rotateSkip');
    });
  }
}

// ---------- 调试契约 ----------
function debugState() {
  if (!run) return null;
  return {
    level: run.level,
    phase: run.phase,
    timeLeft: Math.max(0, run.timeLeft),
    totalTime: run.totalTime,
    sheepCount: run.sheep.length,
    fedCount: run.fedCount,
    foodRemaining: run.foodRemaining,
    combo: run.combo,
    score: run.score,
    mistakes: run.mistakes,
    stars: run.stars,
    goldenCount: run.sheep.filter((s) => s.golden).length,
    goldenFedCount: run.goldenFedCount,
    rocks: run.rocks.length,
  };
}

function debugFeedAll() {
  if (!run) return false;
  let guard = 2000;
  while (guard-- > 0 && (run.phase === 'playing' || run.phase === 'countdown')) {
    if (run.phase === 'playing' && run.cooldown <= 0) {
      const sh = run.sheep.find((s) => !s.fed);
      if (sh) run.tap(sh.x, sh.y);
      else if (run.flights.length === 0) break;
    }
    run.step(STEP);
    handleEvents(run.drainEvents());
  }
  return true;
}

function debugFastForward() {
  if (!run) return false;
  let guard = 4000;
  while (guard-- > 0 && (run.phase === 'playing' || run.phase === 'countdown')) {
    run.step(0.1);
    handleEvents(run.drainEvents());
  }
  return true;
}

function debugComboDemo() {
  if (!run) return false;
  let guard = 500;
  while (guard-- > 0 && run.combo < 2 && (run.phase === 'playing' || run.phase === 'countdown')) {
    if (run.phase === 'playing' && run.cooldown <= 0 && run.fedCount < 2) {
      const sh = run.sheep.find((s) => !s.fed);
      if (sh) run.tap(sh.x, sh.y);
    }
    run.step(STEP);
    handleEvents(run.drainEvents());
  }
  return run.combo >= 2;
}

window.__ll = {
  state: {
    get phase() { return phase; },
    get lang() { return i18n.lang; },
  },
  run: () => run,
  sim: () => run,
  start: (i) => startLevel(i == null ? (lastLevel || 0) : i),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => restartLevel(),
  home: () => goHome(),
  save: () => Sdk,
  ui: () => ui,
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return TUT_STEPS; },
    get current() { return tutorialStep >= 0 ? { step: TUT_STEPS[tutorialStep], text: t('tut' + (tutorialStep + 1)) } : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: debugState,
    feedAll: debugFeedAll,
    fastForward: debugFastForward,
    comboDemo: debugComboDemo,
    loadLevel: (i) => startLevel(i),
    startSeeded: (i, seed) => {
      const idx = Math.max(0, Math.min(LEVEL_COUNT - 1, i | 0));
      lastLevel = idx;
      run = createRun(idx, { seed: seed | 0 || 1 });
      view.particles = [];
      view.shake = 0;
      setPhase('playing');
      ui.showGame();
      ui.hideResult();
      updateHud();
      return true;
    },
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    giveUp: debugFastForward,
  },
};

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
  view.clock += dt;
  for (const p of view.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.ttl -= dt;
  }
  view.particles = view.particles.filter((p) => p.ttl > 0);

  try {
    renderer.draw(run, dt, view);
  } catch (err) {
    console.warn('render error', err);
  }

  if (fpsSamples.length < 600 && dt > 0) fpsSamples.push(1 / dt);
  requestAnimationFrame(frame);
}

// ---------- 启动 ----------
bind();
syncDocumentLang();
ui.applyLang();
renderTitleMeta();
{
  const rt = $('rotate-text');
  const rb = $('btn-rotate-skip');
  if (rt) rt.textContent = t('rotateHint');
  if (rb) rb.textContent = t('rotateSkip');
}
ui.showTitle();
$('btn-mute').classList.toggle('is-muted', muted);
Sdk.track('load', {});
requestAnimationFrame(frame);
