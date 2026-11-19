// BEACH SOCCER 2V2 · 主入口：60Hz 固定步长 + 标题/选关/游戏/暂停/结算 + 教程 + SDK。
// 装配：sim（纯逻辑）/ render（canvas 程序化）/ ui（DOM）/ audio（WebAudio 程序化）。
import { STEP, WORLD, KICK, PHYS } from '../config/game.config.js';
import { LEVELS, LEVEL_COUNT, createRun } from './game/sim.js';
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
let demoRun = createRun(0, { seed: 1 }); // 标题屏展示用（球在发球点、球门可见）
let phase = 'title';          // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let fpsSamples = [];
let tutorialStep = -1;        // -1 = 未激活

const view = {
  aim: null,                  // {vx, vy} 当前瞄准速度
  aimPos: null,               // {x, y} 拖拽世界坐标
  aiming: false,
  trail: [],
  fxQueue: [],
  bumperHit: 0,
};

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let unlocked = Math.max(1, Sdk.load('unlocked', 1) | 0);
let starsByLevel = Sdk.load('stars', {}) || {};
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
  view.aim = null;
  view.aiming = false;
  view.trail = [];
  view.fxQueue = [];
  view.bumperHit = 0;
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
  if (run) ui.updateHud(run.getHud());
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
    cell.setAttribute('aria-label', `${t('level')} ${i + 1}${i + 1 > unlocked ? ' (' + t('best') + ')' : ''}`);
    grid.appendChild(cell);
  }
  const total = totalStars();
  $('stars-total').textContent = `★ ${total} / ${LEVEL_COUNT * 3}`;
}

function showResult() {
  if (!run || !run.state.result) return;
  const r = run.state.result;
  ui.resultTitle.textContent = r.won ? t('winTitle') : t('loseTitle');
  ui.resultTitle.classList.toggle('lose', !r.won);
  const starsEl = $('result-stars');
  const starTotal = r.starTotal || 3;
  starsEl.innerHTML = r.won
    ? `<span class="stars">${'★'.repeat(Math.max(1, r.stars))}${'☆'.repeat(Math.max(0, starTotal - r.stars))}</span>`
    : `<span class="stars dim">${'★'.repeat(r.stars)}${'☆'.repeat(starTotal - r.stars)}</span>`;
  const metaEl = $('result-meta');
  const bits = [];
  bits.push(`${t('resultStars')} ${r.stars}/${starTotal}`);
  bits.push(`${t('resultTime')} ${Math.floor(r.time)}s`);
  if (r.combo > 1) bits.push(`${t('combo')} ×${r.combo}`);
  bits.push(`${t('resultScore')} ${r.total}`);
  metaEl.textContent = bits.join(' · ');
  const high = Sdk.load('best', 0) | 0;
  const isNew = r.won && r.total > high;
  if (isNew) {
    Sdk.save('best', r.total);
    metaEl.textContent += ` · ${t('newBest')}`;
  }
  $('btn-next').classList.toggle('hidden', !(r.won && run.state.level < LEVEL_COUNT));
  ui.showResult();
}

// ---------- 教程（首次自动弹、可跳过、可重看） ----------
const TUT_STEPS = () => [
  { text: t('tutStep1'), spot: 'ball' },
  { text: t('tutStep2'), spot: 'field' },
  { text: t('tutStep3'), spot: 'goal' },
];

function layoutRect(which) {
  try {
    const lay = renderer.debugLayout();
    return lay && lay[which] ? lay[which] : null;
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
  const card = $('tut-card');
  if (rect) {
    spot.style.display = 'block';
    spot.style.left = `${rect.x - 8}px`;
    spot.style.top = `${rect.y - 8}px`;
    spot.style.width = `${rect.w + 16}px`;
    spot.style.height = `${rect.h + 16}px`;
  } else {
    spot.style.display = 'none';
  }
  card.style.left = '';
  card.style.top = '';
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

function tutorialSkip() {
  endTutorial();
}

// ---------- 事件消费 ----------
function fx(type, x, y) {
  const P = (color, n, speed) => {
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = speed * (0.4 + Math.random() * 0.6);
      view.fxQueue.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 2 + Math.random() * 3, color, ttl: 0.5 + Math.random() * 0.3, max: 0.8 });
    }
  };
  if (type === 'bounce') P('rgba(120,240,255,0.9)', 4, 70);
  else if (type === 'star') P('#ffd54a', 10, 110);
  else if (type === 'bumper') { P('#ff4fd8', 12, 130); view.bumperHit = 0.35; }
  else if (type === 'mega') P('#b36bff', 12, 120);
  else if (type === 'win') P('#22ffc2', 40, 260);
  else if (type === 'lose') P('rgba(255,120,120,0.9)', 10, 90);
  else if (type === 'settle') P('rgba(255,255,255,0.5)', 3, 40);
}

function handleEvents(events) {
  for (const ev of events) {
    if (ev.type === 'megaShot') { audio.event('megaShot', ev); }
    else audio.event(ev.type, ev);
    if (ev.type === 'bounce') fx('bounce', run.state.ball.x, run.state.ball.y);
    else if (ev.type === 'star') fx('star', run.state.ball.x, run.state.ball.y);
    else if (ev.type === 'bumper') fx('bumper', run.state.ball.x, run.state.ball.y);
    else if (ev.type === 'mega') fx('mega', run.state.ball.x, run.state.ball.y);
    else if (ev.type === 'settle') fx('settle', ev.x, ev.y);
    else if (ev.type === 'win' || ev.type === 'lose') {
      if (ev.type === 'win') fx('win', run.state.ball.x, run.state.ball.y);
      else fx('lose', run.state.ball.x, run.state.ball.y);
      finishRun(ev);
      return;
    }
  }
}

function finishRun(ev) {
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  const st = run.state;
  if (ev.type === 'win') {
    const idx = st.level; // 1 基
    const stars = Math.max(1, st.stars);
    starsByLevel[idx] = Math.max(starsByLevel[idx] | 0, stars);
    if (idx < LEVEL_COUNT) unlocked = Math.max(unlocked, idx + 1);
    buildLevelGrid();
  }
  persist();
  Sdk.track(ev.type === 'win' ? 'win' : 'fail', { level: st.level, stars: st.stars, time: st.time, total: st.total });
  showResult();
  if (ev.type === 'win') Sdk.levelCleared({ level: st.level, stars: st.stars });
  else Sdk.gameOver({ level: st.level });
}

// ---------- 输入：拖拽 → 踢球 ----------
function worldPos(e) {
  const rect = canvas.getBoundingClientRect();
  const px = (e.clientX - rect.left) * (WORLD.WIDTH / rect.width);
  const py = (e.clientY - rect.top) * (WORLD.HEIGHT / rect.height);
  return { x: px - WORLD.WIDTH / 2, y: WORLD.HEIGHT / 2 - py };
}

function computeAim(pointer) {
  const b = run.state.ball;
  const megaMul = run.state.mega ? KICK.MEGA_SCALE : 1;
  let vx = (pointer.x - b.x) * KICK.SCALE * megaMul;
  let vy = (pointer.y - b.y) * KICK.SCALE * megaMul;
  const sp = Math.hypot(vx, vy);
  if (sp > PHYS.MAX_SPEED) { const k = PHYS.MAX_SPEED / sp; vx *= k; vy *= k; }
  return { vx, vy };
}

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (!run || phase !== 'playing') return;
  if (run.state.ball.active) return;
  view.aiming = true;
  view.aimPos = worldPos(e);
  view.aim = computeAim(view.aimPos);
});

canvas.addEventListener('pointermove', (e) => {
  if (!view.aiming || !run || phase !== 'playing') return;
  view.aimPos = worldPos(e);
  view.aim = computeAim(view.aimPos);
});

function endAim(e) {
  if (!view.aiming || !run || phase !== 'playing') return;
  view.aiming = false;
  const pointer = worldPos(e);
  const aim = computeAim(pointer);
  view.aim = null;
  const base = run.state.mega
    ? { vx: aim.vx / KICK.MEGA_SCALE, vy: aim.vy / KICK.MEGA_SCALE }
    : aim;
  run.flick(base.vx, base.vy);
  updateHud();
}

canvas.addEventListener('pointerup', endAim);
canvas.addEventListener('pointercancel', () => { view.aiming = false; view.aim = null; });

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
  on('btn-next', () => startLevel((run ? run.state.level : lastLevel) + 1));
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result') startTutorial(); });
  on('btn-howto-title', () => { if (phase === 'title') startTutorial(); });
  on('btn-tut-replay', () => { if (phase === 'paused') resumeGame(); if (phase === 'playing' || phase === 'paused') startTutorial(); });
  on('tut-next', tutorialNext);
  on('tut-skip', tutorialSkip);

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
    // 拖尾
    if (run.state.ball.active) {
      view.trail.push({ x: run.state.ball.x, y: run.state.ball.y });
      if (view.trail.length > 14) view.trail.shift();
    } else {
      view.trail = [];
    }
  }

  if (view.bumperHit > 0) view.bumperHit = Math.max(0, view.bumperHit - dt);
  for (const p of view.fxQueue) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy -= 260 * dt;
    p.ttl -= dt;
  }
  view.fxQueue = view.fxQueue.filter((p) => p.ttl > 0);

  const stateForRender = phase === 'title' ? demoRun.state : (run ? run.state : demoRun.state);
  try {
    renderer.draw(stateForRender, dt, view);
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
  ui: () => ui,
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['aim', 'kick', 'goal']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => tutorialSkip(),
  },
  startTutorial: () => startTutorial(),
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: () => (run ? run.state : null),
    loadLevel: (i) => startLevel(i),
    forceWin: () => { if (run) { const r = run.debugWin(); if (r.ok) { handleEvents(run.drainEvents()); } } },
    setTutorialDone: (b) => { tutorialDone = !!b; if (b) endTutorial(); persist(); },
    tutorialStep: () => tutorialStep,
    layout: () => { try { return renderer.debugLayout(); } catch { return null; } },
  },
};

// ---------- 启动 ----------
bind();
syncDocumentLang();
ui.applyLang();
buildLevelGrid();
ui.showTitle();
ui.setMuted(muted);
Sdk.track('load', {});
requestAnimationFrame(frame);
