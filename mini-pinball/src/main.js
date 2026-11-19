// MINI PINBALL · 主入口：60Hz 固定步长 + 标题/选关/游戏/暂停/结算 + 教程 + SDK 出口。
// 装配：sim（纯逻辑）/ render（程序化 canvas）/ audio（WebAudio）/ ui（DOM 屏幕）。
import { STEP, WORLD, BALL, LAUNCH, CONFIG } from '../config/game.config.js';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';
import { createRun, stepState } from './game/sim.js';
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
let aimAngle = -Math.PI / 2;
let aimStart = { x: 0, y: 0 };
let aimDist = 0;

const view = {
  aim: { active: false, angle: -Math.PI / 2 },
  trail: [],
  particles: [],
  popups: [],
};

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let unlocked = Math.max(1, Sdk.load('unlocked', 1) | 0);
let starsByLevel = Sdk.load('stars', {}) || {};
let tutorialDone = !!Sdk.load('tutorialDone', false);
let bestScore = Sdk.load('best', 0) | 0;
let lastLevel = Sdk.load('lastLevel', 0) | 0;

Sdk.ready();
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
  aiming = false;
  view.aim.active = false;
  view.trail = [];
  view.particles = [];
  view.popups = [];
  setPhase('playing');
  ui.showGame();
  ui.hideResult();
  updateHud();
  audio.startBgm();
  Sdk.track('start', { level: idx + 1 });
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
  lastTime = performance.now();
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
  audio.stopBgm();
}

// ---------- HUD / 关卡格 / 结算 ----------
function updateHud() {
  if (!run) return;
  const h = run.getHud();
  const lv = LEVELS[run.state.levelIndex] || {};
  const name = lv.name ? t(lv.name) : '';
  $('hud-level').textContent = `${t('level')} ${h.level}${name ? ' · ' + name : ''}`;
  $('hud-score').textContent = `${t('score')} ${h.score}`;
  $('hud-launches').textContent = `${t('launches')} ${h.launches}`;
  const comboEl = $('hud-combo');
  if (h.combo >= 2) {
    comboEl.textContent = `${t('combo')} ×${h.mult}`;
    comboEl.classList.add('hot');
  } else {
    comboEl.textContent = '';
    comboEl.classList.remove('hot');
  }
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
  $('stars-total').textContent = `★ ${totalStars()} / ${LEVEL_COUNT * 3}`;
}

function showResult(res) {
  const { won, stars, score } = res;
  $('result-title').textContent = won ? t('winTitle') : t('loseTitle');
  $('result-title').classList.toggle('lose', !won);
  const starsEl = $('result-stars');
  starsEl.innerHTML = won
    ? `<span class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>${stars >= 3 ? `<em>${t('perfect')}</em>` : ''}`
    : '';
  $('result-meta').textContent = won ? `${t('resultScore')} ${score} · ${t('resultBest')} ${bestScore}` : '';
  const hasNext = won && (run ? run.state.levelIndex + 1 < LEVEL_COUNT : false);
  $('btn-next').style.display = hasNext ? '' : 'none';
  $('btn-retry').textContent = won ? t('retry') : t('retry');
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
  const stars = won ? (ev.stars || 1) : 0;
  if (won) {
    const idx = st.levelIndex; // 0 基
    const lv = idx + 1;
    starsByLevel[lv] = Math.max(starsByLevel[lv] | 0, stars);
    if (idx + 1 < LEVEL_COUNT) unlocked = Math.max(unlocked, idx + 2);
    bestScore = Math.max(bestScore, st.score);
    buildLevelGrid();
  }
  persist();
  Sdk.track(won ? 'win' : 'fail', { level: st.levelIndex + 1, stars, score: st.score, launches: st.launches });
  showResult({ won, stars, score: st.score });
  audio.event(won ? 'win' : 'lose', { stars });
}

// ---------- 教程（首次自动弹，可跳过，完成/跳过后持久化不再自动弹） ----------
const TUT_STEPS = () => [
  { text: t('tutStep1'), spot: 'pad' },
  { text: t('tutStep2'), spot: 'block' },
  { text: t('tutStep3'), spot: 'block' },
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
  const lay = renderer.debugLayout(run ? run.state : null);
  const rect = s && lay && lay[s.spot] ? lay[s.spot] : null;
  const spot = $('tut-spotlight');
  if (rect) {
    spot.style.display = 'block';
    spot.style.left = `${rect.x}px`;
    spot.style.top = `${rect.y}px`;
    spot.style.width = `${rect.w}px`;
    spot.style.height = `${rect.h}px`;
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
function spawnParticles(x, y, color, count = 10) {
  for (let i = 0; i < count; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const sp = 60 + Math.random() * 180;
    view.particles.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      ttl: 0.5 + Math.random() * 0.4,
      maxTtl: 0.9,
      color,
      size: 2 + Math.random() * 3,
    });
  }
}

function spawnPopup(x, y, text, color) {
  view.popups.push({ x, y, text, color, ttl: 0.9, maxTtl: 0.9 });
}

function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    switch (ev.type) {
      case 'launch':
        view.trail = [];
        break;
      case 'wall':
        break;
      case 'hit':
        spawnParticles(ev.x, ev.y, '#ff4d9e', 12);
        spawnPopup(ev.x, ev.y, `+${ev.score}`, '#ff8ec4');
        break;
      case 'rubber':
        spawnParticles(ev.x, ev.y, '#5dff8c', 16);
        spawnPopup(ev.x, ev.y, `+${ev.score}`, '#b6ffd0');
        break;
      case 'bumper':
        spawnParticles(ev.x, ev.y, '#ffb84d', 6);
        spawnPopup(ev.x, ev.y, '+50', '#ffd99b');
        break;
      case 'orb':
        spawnParticles(ev.x, ev.y, '#ffe066', 14);
        spawnPopup(ev.x, ev.y, `+${ev.score}`, '#fff8d0');
        break;
      case 'combo':
        spawnPopup(WORLD.WIDTH / 2, 140, `${t('combo')} ×${ev.combo}`, '#4df3ff');
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

function beginAim(p) {
  if (!run || phase !== 'playing' || run.state.phase !== 'aiming') return;
  audio.unlock();
  aiming = true;
  aimStart = p;
  aimDist = 0;
  aimAngle = Math.atan2(p.y - BALL.LAUNCH_Y, p.x - BALL.LAUNCH_X);
  view.aim.active = true;
  view.aim.angle = aimAngle;
}

function moveAim(p) {
  if (!aiming) return;
  aimDist = Math.hypot(p.x - aimStart.x, p.y - aimStart.y);
  aimAngle = Math.atan2(p.y - BALL.LAUNCH_Y, p.x - BALL.LAUNCH_X);
  view.aim.angle = aimAngle;
}

function endAim(p) {
  if (!aiming) return;
  aiming = false;
  view.aim.active = false;
  aimDist = Math.hypot(p.x - aimStart.x, p.y - aimStart.y);
  if (aimDist < LAUNCH.MIN_DRAG) return; // 点按不发射
  if (!run || run.state.phase !== 'aiming') return;
  run.launch(aimAngle);
  audio.event('launch');
}

canvas.addEventListener('pointerdown', (e) => {
  beginAim(canvasPos(e));
  canvas.setPointerCapture?.(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  moveAim(canvasPos(e));
});
canvas.addEventListener('pointerup', (e) => {
  endAim(canvasPos(e));
});
canvas.addEventListener('pointercancel', () => {
  aiming = false;
  view.aim.active = false;
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
  on('btn-next', () => startLevel((run ? run.state.levelIndex : lastLevel) + 1));
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result') startTutorial(); });
  on('btn-tut-replay', () => { if (phase === 'paused') resumeGame(); if (phase === 'playing') startTutorial(); });
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);

  const btnRotate = $('btn-rotate-skip');
  if (btnRotate) {
    btnRotate.setAttribute('onclick', "document.getElementById('rotate-screen').style.display='none'");
    btnRotate.addEventListener('click', () => { $('rotate-screen').style.display = 'none'; });
  }

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

  // 粒子/弹出更新
  if (view.trail && run && run.state.ball.active) {
    view.trail.push({ x: run.state.ball.x, y: run.state.ball.y });
    if (view.trail.length > 14) view.trail.shift();
  } else if (view.trail.length) {
    view.trail = [];
  }
  for (const p of view.particles) {
    p.ttl -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 300 * dt;
  }
  for (const p of view.popups) p.ttl -= dt;
  view.particles = view.particles.filter((p) => p.ttl > 0);
  view.popups = view.popups.filter((p) => p.ttl > 0);

  try {
    renderer.draw(run ? run.state : null, (performance.now() / 1000), view);
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
    get steps() { return ['launch', 'break', 'clear']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
  },
  startTutorial: () => startTutorial(),
  debug: {
    state: () => (run ? run.state : null),
    loadLevel: (i) => startLevel(i),
    // 验收辅助：直接以给定角度发射（供截图/自动玩）
    fireAngle: (deg) => {
      if (!run) return false;
      const ok = run.launch((deg * Math.PI) / 180);
      if (ok) audio.event('launch');
      return ok;
    },
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    win: () => { if (!run) return false; finishRun({ type: 'win', stars: 3 }); return true; },
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
