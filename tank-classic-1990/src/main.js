// 主入口：60Hz 固定步长 + 标题→游戏→暂停→结算 + 教程引导 + SDK 统一出口 + 霓虹渲染
import { STEP } from '../config/game.config.js';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';
import { createRun } from './game/sim.js';
import { createRenderer } from './render/index.js';
import { createAudio } from './core/audio.js';
import { ui } from './ui/ui.js';
import { i18n, t, syncDocumentLang } from './core/i18n.js';
import Sdk from './core/sdk.js';

const $ = (id) => document.getElementById(id);
const container = $('game-container');
const canvas = $('canvas');
const renderer = createRenderer(canvas);
const audio = createAudio();

let run = null;
let phase = 'title';       // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let fpsSamples = [];
let tutorialStep = -1;     // -1 = 未激活

const view = { shake: 0, fx: [] };

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let best = Sdk.load('best', 0) | 0;
let starsByLevel = Sdk.load('stars', {}) || {};
let tutorialDone = !!Sdk.load('tutorialDone', false);
let lastLevel = Sdk.load('lastLevel', 0) | 0;

Sdk.ready(); // 不 await，不阻塞首屏
audio.setMuted(muted);
ui.setMuted(muted);

function persist() {
  Sdk.save('muted', muted);
  Sdk.save('best', best);
  Sdk.save('stars', starsByLevel);
  Sdk.save('tutorialDone', tutorialDone);
  Sdk.save('lastLevel', lastLevel);
}

function setPhase(p) { phase = p; }

function updateBestText() {
  ui.bestText.textContent = `${t('best')}: ${best}`;
}

// ---------- 阶段状态机 ----------
function startLevel(idx) {
  idx = Math.max(0, Math.min(LEVEL_COUNT - 1, idx | 0));
  lastLevel = idx;
  run = createRun(idx, { seed: (Date.now() % 2147483647) || 1 });
  setPhase('playing');
  ui.showGame();
  ui.hideResult();
  ui.updateHud(run.getHud());
  audio.startBgm();
  Sdk.newRun({ level: idx + 1 });
  if (!tutorialDone && idx === 0) startTutorial();
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
}

function restartLevel() {
  if (run) Sdk.track('restart', { level: run.state.level + 1 });
  startLevel(run ? run.state.level : lastLevel);
}

function goHome() {
  run = null;
  setPhase('title');
  audio.stopBgm();
  ui.hideResult();
  ui.showTitle();
  updateBestText();
}

// ---------- 结算 ----------
function showResult(res) {
  ui.resultTitle.textContent = res.won ? t('winTitle') : t('loseTitle');
  ui.resultTitle.classList.toggle('lose', !res.won);
  ui.resultStars.innerHTML = res.won
    ? `${'★'.repeat(res.stars)}${'☆'.repeat(3 - res.stars)}${res.stars >= 3 ? `<em>${t('perfect')}</em>` : ''}`
    : '';
  ui.resultMeta.textContent = res.won
    ? t('winMeta', { score: res.score })
    : (res.reason === 'base' ? t('loseBase') : t('loseLives'));
  ui.btnNext.style.display = res.won && res.hasNext ? '' : 'none';
  ui.showResult();
}

function finishRun(ev) {
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  const st = run.state;
  const won = ev.type === 'win';
  const stars = won ? (ev.stars || st.stars || 1) : 0;
  if (won) {
    starsByLevel[st.level + 1] = Math.max(starsByLevel[st.level + 1] | 0, stars);
    if (st.score > best) best = st.score;
    lastLevel = Math.min(LEVEL_COUNT - 1, st.level + 1);
    persist();
    Sdk.levelCleared({ level: st.level + 1, stars, score: st.score });
  } else {
    Sdk.gameOver({ level: st.level + 1, score: st.score, reason: ev.reason });
  }
  showResult({ won, stars, score: st.score, reason: ev.reason, hasNext: st.level + 1 < LEVEL_COUNT });
  audio.event(won ? 'win' : 'lose');
}

// ---------- 教程引导（首次自动弹，可跳过，完成/跳过后持久化） ----------
const TUT_STEPS = () => [
  { text: t('tutStep1'), spot: 'board' },
  { text: t('tutStep2'), spot: 'board' },
  { text: t('tutStep3'), spot: 'base' },
];

function layoutRect(which) {
  try {
    const lay = renderer.debugLayout();
    if (which === 'board') return lay.board;
    if (which === 'base') return lay.base;
  } catch { /* noop */ }
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
  const s = steps[Math.min(tutorialStep, steps.length - 1)];
  el.classList.remove('hidden');
  ui.tutTitle.textContent = t('tutTitle');
  ui.tutText.textContent = s ? s.text : '';
  ui.tutSkip.textContent = t('tutSkip');
  ui.tutNext.textContent = t('tutNext');
  const rect = s && s.spot ? layoutRect(s.spot) : null;
  const spot = $('tut-spotlight');
  if (rect) {
    spot.style.display = 'block';
    spot.style.left = `${rect.x - 6}px`;
    spot.style.top = `${rect.y - 6}px`;
    spot.style.width = `${rect.w + 12}px`;
    spot.style.height = `${rect.h + 12}px`;
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
      case 'kill':
        view.fx.push({ type: 'explode', x: ev.x, y: ev.y, ttl: 0.4, max: 0.4 });
        view.shake = Math.max(view.shake, 3);
        break;
      case 'playerHit':
        view.fx.push({ type: 'explode', x: ev.x, y: ev.y, ttl: 0.5, max: 0.5 });
        view.shake = Math.max(view.shake, 6);
        break;
      case 'baseHit':
        view.fx.push({ type: 'explode', x: ev.x, y: ev.y, ttl: 0.8, max: 0.8 });
        view.shake = 8;
        break;
      case 'fire':
        if (run) view.fx.push({ type: 'flash', x: run.state.player.x, y: run.state.player.y, ttl: 0.1, max: 0.1 });
        break;
      case 'powerup':
        if (run) view.fx.push({ type: 'flash', x: run.state.player.x, y: run.state.player.y, ttl: 0.2, max: 0.2 });
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
const heldDirs = [];
let fireHeld = false;

function currentDir() { return heldDirs.length ? heldDirs[heldDirs.length - 1] : null; }

function pressDir(dir) {
  const i = heldDirs.indexOf(dir);
  if (i >= 0) heldDirs.splice(i, 1);
  heldDirs.push(dir);
}

function releaseDir(dir) {
  const i = heldDirs.indexOf(dir);
  if (i >= 0) heldDirs.splice(i, 1);
}

const KEY_DIR = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
};

window.addEventListener('keydown', (e) => {
  audio.unlock();
  const dir = KEY_DIR[e.code];
  if (dir) { pressDir(dir); e.preventDefault(); }
  if (e.code === 'Space') { fireHeld = true; e.preventDefault(); }
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
  if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'result')) restartLevel();
  if (e.code === 'KeyM') toggleMute();
});

window.addEventListener('keyup', (e) => {
  const dir = KEY_DIR[e.code];
  if (dir) releaseDir(dir);
  if (e.code === 'Space') fireHeld = false;
});

function bindTouch() {
  document.querySelectorAll('.tc-btn[data-dir]').forEach((btn) => {
    const dir = btn.dataset.dir;
    btn.addEventListener('pointerdown', (e) => { e.preventDefault(); audio.unlock(); pressDir(dir); btn.classList.add('pressed'); });
    const up = (e) => { e.preventDefault(); releaseDir(dir); btn.classList.remove('pressed'); };
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('pointerleave', up);
  });
  const fire = $('btn-fire');
  fire.addEventListener('pointerdown', (e) => { e.preventDefault(); audio.unlock(); fireHeld = true; fire.classList.add('pressed'); });
  const fup = (e) => { e.preventDefault(); fireHeld = false; fire.classList.remove('pressed'); };
  fire.addEventListener('pointerup', fup);
  fire.addEventListener('pointercancel', fup);
  fire.addEventListener('pointerleave', fup);
}

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
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result') startTutorial(); });
  on('btn-title-howto', () => { if (phase === 'title') startTutorial(); });
  on('btn-tut-replay', () => { if (phase === 'paused') resumeGame(); if (phase === 'playing') startTutorial(); });
  on('btn-rotate-skip', () => { const rs = $('rotate-screen'); if (rs) rs.style.display = 'none'; });
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);

  for (const sel of ui.langSelects) {
    sel.addEventListener('change', () => {
      ui.setLang(sel.value);
      renderTutorialStep();
      updateBestText();
      if (run) ui.updateHud(run.getHud());
    });
  }
}

// ---------- 缩放适配 ----------
function fit() {
  const scale = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
  container.style.transform = `scale(${scale})`;
}
window.addEventListener('resize', fit);
window.addEventListener('orientationchange', () => setTimeout(fit, 60));

// ---------- 主循环 ----------
function frame(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;

  if (phase === 'playing' && run && tutorialStep < 0) {
    run.setInput({ dir: currentDir(), fire: fireHeld });
    accumulator += dt;
    while (accumulator >= STEP) {
      run.step(STEP);
      accumulator -= STEP;
    }
    handleEvents(run.drainEvents());
    if (run && phase === 'playing') ui.updateHud(run.getHud());
  }

  if (view.shake > 0) view.shake = Math.max(0, view.shake - dt * 18);
  for (const fx of view.fx) fx.ttl -= dt;
  view.fx = view.fx.filter((fx) => fx.ttl > 0);

  try {
    renderer.draw(run ? run.state : null, dt, view);
  } catch (err) {
    console.warn('render error', err);
  }

  if (fpsSamples.length < 600 && dt > 0) fpsSamples.push(1 / dt);
  requestAnimationFrame(frame);
}

// ---------- 调试契约（截图/验收脚本通用） ----------
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
    get steps() { return ['move', 'fire', 'objective']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  save: (key, value) => Sdk.save(key, value),
  load: (key, fallback) => Sdk.load(key, fallback),
  ui: () => ui,
  debug: {
    state: () => {
      if (!run) return null;
      const st = run.state;
      let rock = 0;
      let steel = 0;
      let grass = 0;
      let water = 0;
      for (const row of st.grid) {
        for (const cell of row) {
          if (cell.t === 'rock') rock += 1;
          if (cell.t === 'steel') steel += 1;
          if (cell.t === 'grass') grass += 1;
          if (cell.t === 'water') water += 1;
        }
      }
      return { ...st, grid: undefined, rockCount: rock, steelCount: steel, grassCount: grass, waterCount: water, enemiesAlive: st.enemies.filter((e) => e.alive).length, queueLen: st.spawnQueue.length };
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
      ui.updateHud(run.getHud());
      return true;
    },
    killAll: () => {
      if (!run) return false;
      run.state.spawnQueue = [];
      run.state.enemies = [];
      return true;
    },
    fastForward: () => {
      if (!run) return false;
      run.setInput({ dir: null, fire: false });
      let guard = 8000;
      while (guard-- > 0 && run.state.phase === 'playing') run.step(1 / 60);
      handleEvents(run.drainEvents());
      return run.state.phase;
    },
    spawnPowerup: (type) => {
      if (!run) return false;
      run.state.powerups.push({ x: run.state.player.x, y: run.state.player.y, type: type || 'rapid', ttl: 12 });
      return true;
    },
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    armDir: () => currentDir(),
  },
};

// ---------- 启动 ----------
bind();
bindTouch();
syncDocumentLang();
ui.applyLang();
updateBestText();
fit();
ui.showTitle();
$('btn-mute').classList.toggle('is-muted', muted);
Sdk.track('load', {});
requestAnimationFrame(frame);
