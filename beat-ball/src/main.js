// 主入口：60Hz 固定步长 + 标题/选关/游戏/暂停/结算 + 交互引导 + SDK 统一出口
// 装配：sim(M1) / render(M2) / ui(M3) / audio(M4) / Lead 集成。
// 职责划分：ui.js 只做语言与屏幕显隐；HUD/结算/关卡格/教程的 DOM 由这里直写。
import { STEP, GAME } from '../config/game.config.js';
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
let phase = 'title';       // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let fpsSamples = [];
let tutorialStep = -1;    // -1 = 未激活

const view = {
  shake: 0,
  fxQueue: [],            // {type:'ripple', lane, ttl}
  sceneKey: 'dawn',
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
  run = createRun(idx, { seed: (Date.now() % 2147483647) || 1 });
  view.sceneKey = (LEVELS[idx] && LEVELS[idx].scene) || 'dawn';
  setPhase('playing');
  ui.showGame();
  hideResult();
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
  if (run) Sdk.track('restart', { level: run.state.level + 1 });
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
  $('hud-level').textContent = `${t('level')} ${run.state.level}`;
  $('hud-score').textContent = `${t('score')} ${h.score}`;
  $('hud-distance').textContent = `${t('distance')} ${h.distance}m`;
  const comboEl = $('hud-combo');
  comboEl.textContent = h.combo > 1 ? `${t('combo')} ×${h.combo}` : '';
  comboEl.classList.toggle('on', h.combo >= 5);
  $('progress-fill').style.width = `${Math.round(h.progress * 100)}%`;
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
    cell.innerHTML =
      `<span class="lv-num">${i + 1}</span>` +
      `<span class="lv-stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>`;
    cell.setAttribute('aria-label', `${t('level')} ${i + 1}${i + 1 > unlocked ? ' ' + t('locked') : ''}`);
    grid.appendChild(cell);
  }
  $('stars-total').textContent = `★ ${totalStars()} / ${LEVEL_COUNT * 3}`;
}

function showResult(res) {
  const { won, stars, score, maxCombo, hasNext } = res;
  $('result-title').textContent = won ? t('winTitle') : t('loseTitle');
  $('result-title').classList.toggle('lose', !won);
  $('result-stars').innerHTML = won
    ? `<span class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>`
    : '';
  $('result-meta').textContent = won
    ? `${t('score')} ${score} · ${t('combo')} ×${maxCombo}`
    : t('crashed');
  $('btn-next').style.display = won && hasNext ? '' : 'none';
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
    best = Math.max(best, st.score);
    buildLevelGrid();
  }
  persist();
  Sdk.track(won ? 'win' : 'fail', {
    level: st.level, stars, score: st.score, maxCombo: st.maxCombo,
    durationMs: Math.round(st.clock * 1000), progress: st.distance,
  });
  showResult({
    won, stars, score: st.score, maxCombo: st.maxCombo,
    hasNext: st.level < LEVEL_COUNT,
  });
  audio.event(won ? 'win' : 'lose');
}

// ---------- 交互引导（首次自动弹，可跳过，完成/跳过后持久化不再自动弹） ----------
const TUT_STEPS = () => [
  { text: t('tutStep1'), spot: 'lanes', action: 'laneChange' },
  { text: t('tutStep2'), spot: 'player', action: 'jump' },
  { text: t('tutStep3'), spot: 'progress', action: 'padHit' },
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
  if (rect) {
    spot.style.display = 'block';
    spot.style.left = `${rect.x - 8}px`;
    spot.style.top = `${rect.y - 8}px`;
    spot.style.width = `${rect.w + 16}px`;
    spot.style.height = `${rect.h + 16}px`;
  } else {
    spot.style.display = 'none';
  }
  const card = $('tut-card');
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

// 教学步骤推进（真实动作驱动）
function tutorialAdvance(evType) {
  if (tutorialStep < 0 || tutorialStep >= TUT_STEPS().length) return;
  if (TUT_STEPS()[tutorialStep].action !== evType) return;
  tutorialStep += 1;
  if (tutorialStep >= TUT_STEPS().length) endTutorial();
  else renderTutorialStep();
}

// ---------- 事件消费 ----------
function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    tutorialAdvance(ev.type);
    switch (ev.type) {
      case 'padHit':
        view.fxQueue.push({ type: 'ripple', lane: ev.lane, ttl: 0.5 });
        if (ev.combo && ev.combo >= 5) view.shake = 2;
        break;
      case 'perfect':
        view.fxQueue.push({ type: 'ripple', lane: null, ttl: 0.6 });
        view.shake = 3;
        break;
      case 'hazard':
        view.shake = 3;
        break;
      case 'crash':
        view.shake = 7;
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

let touchStartX = null;
let touchStartY = null;

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  touchStartX = e.clientX;
  touchStartY = e.clientY;
});

canvas.addEventListener('pointerup', (e) => {
  if (touchStartX == null) return;
  const dx = e.clientX - touchStartX;
  const dy = e.clientY - touchStartY;
  touchStartX = null;
  touchStartY = null;
  if (!run || phase !== 'playing') return;
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  if (adx < 20 && ady < 20) {
    // 点按 = 跳跃
    run.jump();
  } else if (adx > ady) {
    run.move(dx > 0 ? 1 : -1);
  } else {
    run.jump();
  }
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
  if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'result')) restartLevel();
  if (e.code === 'KeyM') toggleMute();
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
    e.preventDefault();
    if (run && phase === 'playing') run.move(-1);
  }
  if (e.code === 'ArrowRight' || e.code === 'KeyD') {
    e.preventDefault();
    if (run && phase === 'playing') run.move(1);
  }
  if (e.code === 'Space') {
    e.preventDefault();
    if (run && phase === 'playing') run.jump();
  }
});

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  ui.setMuted(muted);
  $('btn-mute').classList.toggle('is-muted', muted);
  $('btn-mute').textContent = muted ? '🔇' : '♪';
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
  on('btn-next', () => startLevel((run ? run.state.level - 1 : lastLevel) + 1));
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-howto', () => { if (phase === 'paused') resumeGame(); if (phase === 'playing') startTutorial(); });
  on('btn-tut-replay', () => { if (phase === 'paused') resumeGame(); if (phase === 'playing') startTutorial(); });
  on('btn-rotate-skip', () => { const rs = $('rotate-screen'); if (rs) rs.style.display = 'none'; });
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);
  on('btn-touch-left', () => { if (run && phase === 'playing') run.move(-1); });
  on('btn-touch-right', () => { if (run && phase === 'playing') run.move(1); });
  on('btn-touch-jump', () => { if (run && phase === 'playing') run.jump(); });

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
  for (const fx of view.fxQueue) if (fx.ttl > 0) fx.ttl -= dt;

  try {
    renderer.draw(run ? run.state : null, dt, view);
  } catch (err) {
    console.warn('render error', err);
  }
  view.fxQueue = view.fxQueue.filter((fx) => fx.ttl > 0);

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
  save: (k, v) => Sdk.save(k, v),
  ui: () => ui,
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['move', 'jump', 'hit']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: () => {
      if (!run) return null;
      const st = run.state;
      return {
        ...st,
        pendingHazards: st.obstacles.filter((o) => o.kind === 'hazard' && !o.resolved).length,
        pendingPads: st.obstacles.filter((o) => o.kind === 'pad' && !o.resolved).length,
      };
    },
    layout: () => { try { return renderer.debugLayout(); } catch { return null; } },
    loadLevel: (i) => startLevel(i),
    startSeeded: (i, seed) => {
      const idx = Math.max(0, Math.min(LEVEL_COUNT - 1, i | 0));
      lastLevel = idx;
      run = createRun(idx, { seed: seed | 0 || 1 });
      view.sceneKey = (LEVELS[idx] && LEVELS[idx].scene) || 'dawn';
      setPhase('playing');
      ui.showGame();
      hideResult();
      updateHud();
      return true;
    },
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    startTutorial: () => startTutorial(),
    tutorialStep: () => tutorialStep,
    autoPlaceSolution: () => true,
    fastForward: () => {
      if (!run) return false;
      try {
        let guard = 6000;
        while (guard-- > 0 && run.state.phase === 'playing') {
          run.step(0.5);
          handleEvents(run.drainEvents());
        }
        return true;
      } catch { return false; }
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

// 竖屏 + 触屏设备显示旋转提示（横屏游戏）
function updateRotateHint() {
  const rs = $('rotate-screen');
  if (!rs) return;
  const portrait = window.innerHeight > window.innerWidth;
  const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (portrait && touch) { rs.hidden = false; rs.classList.add('show'); }
  else { rs.hidden = true; rs.classList.remove('show'); }
}
window.addEventListener('resize', updateRotateHint);
updateRotateHint();
