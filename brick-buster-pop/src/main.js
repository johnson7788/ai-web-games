// 主入口：60Hz 固定步长 + 标题/游戏/暂停/结算 + 教程引导 + SDK 统一出口。
// 装配：sim(M1) / render+ui(M2) / audio(M4) / Lead 集成。
import { STEP, GRID, CANNON, AIM } from '../config/game.config.js';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';
import { createRun } from './game/sim.js';
import { greedyAngle, solveRun } from './game/level.js';
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
let tutorialStep = -1;
let aiming = false;

const view = {
  fx: [],
  shake: 0,
  reduced: typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
};

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let unlocked = Math.max(1, Sdk.load('unlocked', 1) | 0);
let starsByLevel = Sdk.load('stars', {}) || {};
let tutorialDone = !!Sdk.load('tutorialDone', false);
let best = Sdk.load('best', 0) | 0;
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
  Sdk.save('best', best);
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
  aiming = false;
  run = createRun(idx, { seed: (Date.now() % 2147483647) || 1 });
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
  if (run) Sdk.track('restart', { level: run.state.level });
  startLevel(run ? run.state.level - 1 : lastLevel);
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
  const lv = LEVELS[h.level - 1] || {};
  $('hud-level').textContent = `${t('level')} ${h.level}${lv.name ? ' · ' + (lv.name[i18n.lang] || lv.name.en) : ''}`;
  $('hud-score').textContent = `${t('score')} ${h.score}`;
  const comboEl = $('hud-combo');
  comboEl.classList.toggle('hidden', h.combo < 1);
  comboEl.textContent = `${t('combo')} ×${h.combo}`;
  $('hud-balls').textContent = `${t('balls')} ${h.ballCount}`;
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
    cell.innerHTML = `<span class="lv-num">${i + 1}</span><span class="lv-stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>`;
    cell.setAttribute('aria-label', `${t('level')} ${i + 1}${i + 1 > unlocked ? ' ' + t('locked') : ''}`);
    grid.appendChild(cell);
  }
  $('stars-total').textContent = `★ ${totalStars()}/${LEVEL_COUNT * 3} · ${t('best')} ${best}`;
}

function showResult(res) {
  const { won, stars, score, volleys, hasNext, newBest } = res;
  $('result-title').textContent = won ? t('winTitle') : t('loseTitle');
  $('result-title').classList.toggle('lose', !won);
  $('result-stars').innerHTML = won
    ? `<span class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>${stars >= 3 ? `<em>${t('perfect')}</em>` : ''}`
    : '';
  $('result-score').textContent = `${t('score')} ${score}${newBest ? ' · ' + t('newBest') : ''}`;
  $('result-meta').textContent = won ? `${t('balls')} ${run ? run.state.ballCount : ''} · ${t('combo')} ×${run ? run.state.maxCombo : 0}` : '';
  $('btn-next').style.display = won && hasNext ? '' : 'none';
  ui.showResult();
}

function hideResult() {
  ui.hideResult();
}

function finishRun(ev) {
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  const st = run.state;
  const won = ev.type === 'win';
  const stars = won ? (st.stars || 1) : 0;
  let newBest = false;
  if (won) {
    const idx = st.level;
    starsByLevel[idx] = Math.max(starsByLevel[idx] | 0, stars);
    if (idx < LEVEL_COUNT) unlocked = Math.max(unlocked, idx + 1);
    if (st.score > best) { best = st.score; newBest = true; }
    buildLevelGrid();
  }
  persist();
  Sdk.track(won ? 'win' : 'fail', { level: st.level, stars, score: st.score, volleys: st.volleys });
  showResult({ won, stars, score: st.score, volleys: st.volleys, hasNext: st.level < LEVEL_COUNT, newBest });
  audio.event(won ? 'win' : 'lose');
}

// ---------- 教程（首次自动弹，可跳过，完成/跳过后持久化不再自动弹） ----------
const TUT_TRIGGER = ['fire', 'break', 'descend'];

function startTutorial() {
  tutorialStep = 0;
  renderTutorialStep();
}

function renderTutorialStep() {
  const el = $('tutorial');
  if (tutorialStep < 0) { el.classList.add('hidden'); return; }
  const texts = [t('tutStep1'), t('tutStep2'), t('tutStep3')];
  const spots = ['cannon', 'grid', 'grid'];
  el.classList.remove('hidden');
  $('tut-title').textContent = t('tutTitle');
  $('tut-text').textContent = texts[tutorialStep] || '';
  $('tut-skip').textContent = t('tutSkip');
  $('tut-next').textContent = t('tutNext');
  const spot = $('tut-spotlight');
  if (spots[tutorialStep] === 'cannon') {
    spot.style.display = 'block';
    spot.style.left = `${CANNON.X - 60}px`;
    spot.style.top = `${CANNON.Y - 60}px`;
    spot.style.width = '120px';
    spot.style.height = '120px';
  } else {
    spot.style.display = 'none';
  }
}

function tutorialNext() {
  tutorialStep += 1;
  if (tutorialStep >= 3) endTutorial();
  else renderTutorialStep();
}

function endTutorial() {
  tutorialStep = -1;
  tutorialDone = true;
  persist();
  renderTutorialStep();
}

function tutorialAdvance(evType) {
  if (tutorialStep < 0 || tutorialStep >= TUT_TRIGGER.length) return;
  if (TUT_TRIGGER[tutorialStep] !== evType) return;
  tutorialStep += 1;
  if (tutorialStep >= TUT_TRIGGER.length) endTutorial();
  else renderTutorialStep();
}

// ---------- 粒子 / 事件消费 ----------
function brickAt(r, c) {
  if (!run) return null;
  return run.state.bricks.find((b) => b.r === r && b.c === c) || null;
}

function burst(x, y, color, n, power = 160) {
  if (view.reduced) return;
  for (let i = 0; i < n; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const sp = power * (0.4 + Math.random() * 0.8);
    view.fx.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      ttl: 0.5 + Math.random() * 0.4,
      maxTtl: 0.9,
      color,
      size: 2 + Math.random() * 2.5,
    });
  }
  if (view.fx.length > 240) view.fx.splice(0, view.fx.length - 240);
}

const BRICK_GLOW = { 1: '#00e5ff', 2: '#39ff88', 3: '#ffe14d', 4: '#ff9f1c', 5: '#ff4d8d', 6: '#ff3b3b', 7: '#b14dff', 8: '#3b82ff', 9: '#ffffff' };

function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    tutorialAdvance(ev.type);
    switch (ev.type) {
      case 'hit': {
        const b = brickAt(ev.r, ev.c);
        if (b) burst(b.x + b.w / 2, b.y + b.h / 2, BRICK_GLOW[b.hp + 1] || '#fff', 4, 120);
        break;
      }
      case 'break': {
        const b = brickAt(ev.r, ev.c);
        if (b) burst(b.x + b.w / 2, b.y + b.h / 2, '#7dd3fc', 8, 200);
        view.shake = 2;
        break;
      }
      case 'rockHit': {
        const b = brickAt(ev.r, ev.c);
        if (b) burst(b.x + b.w / 2, b.y + b.h / 2, '#94a3b8', 3, 90);
        break;
      }
      case 'lineClear':
        view.shake = 4;
        break;
      case 'bomb':
        view.shake = 6;
        break;
      case 'plusBall': {
        const b = brickAt(ev.r, ev.c);
        if (b) burst(b.x + b.w / 2, b.y + b.h / 2, '#4ade80', 6, 160);
        break;
      }
      case 'scatter': {
        const b = brickAt(ev.r, ev.c);
        if (b) burst(b.x + b.w / 2, b.y + b.h / 2, '#22d3ee', 6, 180);
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
    x: (e.clientX - rect.left) * (1280 / rect.width),
    y: (e.clientY - rect.top) * (720 / rect.height),
  };
}

function angleToPoint(p) {
  const dx = p.x - CANNON.X;
  const dy = CANNON.Y - p.y;
  const deg = (Math.atan2(dx, dy) * 180) / Math.PI;
  return Math.max(AIM.MIN, Math.min(AIM.MAX, deg));
}

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (!run || phase !== 'playing') return;
  if (run.state.phase === 'aim') {
    aiming = true;
    run.aim(angleToPoint(canvasPos(e)));
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (!aiming || !run) return;
  run.aim(angleToPoint(canvasPos(e)));
});

canvas.addEventListener('pointerup', (e) => {
  if (!aiming || !run) return;
  aiming = false;
  run.aim(angleToPoint(canvasPos(e)));
  run.fire();
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
  on('btn-next', () => startLevel((run ? run.state.level : lastLevel)));
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
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
      $('rotate-text').textContent = t('rotateHint');
      $('btn-rotate-skip').textContent = t('rotateSkip');
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
  for (const p of view.fx) {
    p.ttl -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 120 * dt;
  }
  view.fx = view.fx.filter((p) => p.ttl > 0);

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
    get dir() { return i18n.dir; },
  },
  run: () => run,
  start: (i) => startLevel(i == null ? (lastLevel || 0) : i),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => restartLevel(),
  home: () => goHome(),
  sim: () => (run ? run.state : null),
  save: () => Sdk,
  ui: () => ui,
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['aim', 'fire', 'descend']; },
    get current() { return tutorialStep >= 0 ? [t('tutStep1'), t('tutStep2'), t('tutStep3')][tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  debug: {
    state: () => {
      if (!run) return null;
      const st = run.state;
      return {
        level: st.level,
        phase: st.phase,
        clearableCount: st.clearableCount,
        hasRock: st.bricks.some((b) => b.type === 'rock' && !b.dead),
        ballCount: st.ballCount,
        volleys: st.volleys,
        score: st.score,
        combo: st.combo,
        bricksLeft: st.bricks.filter((b) => b.clearable && !b.dead).length,
      };
    },
    loadLevel: (i) => startLevel(i),
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    solve: () => {
      if (!run) return false;
      try {
        solveRun(run, { onStep: () => handleEvents(run.drainEvents()) });
        return run.state.phase === 'won';
      } catch { return false; }
    },
  },
};

// ---------- 启动 ----------
bind();
syncDocumentLang();
ui.applyLang();
$('rotate-text').textContent = t('rotateHint');
$('btn-rotate-skip').textContent = t('rotateSkip');
buildLevelGrid();
Sdk.track('load', {});
requestAnimationFrame(frame);
