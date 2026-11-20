// 主入口：60Hz 固定步长 + 标题/游戏/暂停/结算 + 教程引导 + SDK 统一出口。
// 装配：sim(M1) / render(M2) / audio(M4) / ui(M4)。
import { STEP, WORLD, GAME, CONFIG } from '../config/game.config.js';
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
let lastLevel = 0;
let best = 0;
let starsByLevel = {};

const view = {
  aimAngle: null,
  aimActive: false,
  cursor: { x: WORLD.LAUNCH_X, y: WORLD.LAUNCH_Y },
  shake: 0,
};

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let tutorialDone = !!Sdk.load('tutorialDone', false);
starsByLevel = Sdk.load('stars', {}) || {};
best = Sdk.load('best', 0) | 0;
lastLevel = Sdk.load('lastLevel', 0) | 0;

Sdk.ready(); // 不 await，不阻塞首屏
Sdk.onAdStart(() => { if (phase === 'playing') pauseGame(true); });
Sdk.onAdEnd(() => { if (phase === 'paused') resumeGame(); });
audio.setMuted(muted);

function persist() {
  Sdk.save('muted', muted);
  Sdk.save('tutorialDone', tutorialDone);
  Sdk.save('stars', starsByLevel);
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
  view.aimAngle = null;
  view.aimActive = false;
  setPhase('playing');
  ui.showGame();
  ui.hideResult();
  updateHud();
  audio.startBgm();
  Sdk.track('start', { level: idx + 1 });
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
  startLevel(run ? run.state.levelIndex : lastLevel);
}

function restartRun() {
  Sdk.track('restart', { level: 1 });
  startLevel(0);
}

function goHome() {
  run = null;
  setPhase('title');
  ui.hideResult();
  ui.showTitle();
  updateStarsTotal();
}

// ---------- HUD / 结算 ----------
function updateHud() {
  if (!run) return;
  const h = run.getHud();
  $('hud-level').textContent = `${t('level')} ${h.level}/${h.levelCount}`;
  $('hud-shots').textContent = `${t('shots')} ${h.shotsLeft}`;
  $('hud-targets').textContent = `${t('targets')} ${h.bricksLeft}`;
  $('hud-score').textContent = `${t('score')} ${h.score}`;
  const comboEl = $('hud-combo');
  comboEl.textContent = `${t('combo')} ${h.combo}`;
  comboEl.style.display = h.combo >= 3 ? '' : 'none';
}

function updateStarsTotal() {
  $('stars-total').textContent = `★ ${totalStars()} / ${LEVEL_COUNT * 3}`;
}

function finishRun(ev) {
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  const st = run.state;
  const won = ev.type === 'win';
  if (won) {
    best = Math.max(best, st.score);
    persist();
    Sdk.levelCleared({ level: st.level, stars: st.totalStars, score: st.score });
  } else {
    Sdk.gameOver({ level: st.level, stars: st.totalStars, score: st.score });
  }
  Sdk.track(won ? 'win' : 'fail', { level: st.level, stars: st.totalStars, score: st.score, durationMs: Math.round(st.time * 1000) });
  showResult({ won, stars: st.totalStars, score: st.score });
  audio.event(won ? 'win' : 'lose');
}

function showResult(res) {
  const title = $('result-title');
  title.textContent = res.won ? t('winTitle') : t('loseTitle');
  title.classList.toggle('lose', !res.won);
  $('result-stars').innerHTML = `<span class="stars">${'★'.repeat(Math.min(3, res.stars))}${'☆'.repeat(Math.max(0, 3 - Math.min(3, res.stars)))}</span>`;
  $('result-meta').textContent = `${t('resultScore')}: ${res.score}  ·  ${t('resultStars')}: ${res.stars}/${LEVEL_COUNT * 3}`;
  ui.showResult();
  updateStarsTotal();
}

// ---------- 教程引导（首次自动弹，可跳过，完成/跳过后持久化） ----------
const TUT_STEPS = () => [
  { text: t('tutStep1') },
  { text: t('tutStep2') },
  { text: t('tutStep3') },
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
      case 'brickBreak':
      case 'powerUp':
        renderer.burst(ev.x, ev.y, ev.type === 'powerUp' ? '#c44dff' : '#7ff3ff');
        break;
      case 'laser':
      case 'violet':
        view.shake = 6;
        break;
      case 'levelWin':
        starsByLevel[ev.level] = Math.max(starsByLevel[ev.level] | 0, ev.stars);
        persist();
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

function aimFromPointer(p) {
  const dx = p.x - WORLD.LAUNCH_X;
  const dy = WORLD.LAUNCH_Y - p.y;
  if (dy <= 0) return 0;
  return Math.max(-GAME.maxAngle, Math.min(GAME.maxAngle, Math.atan2(dx, dy)));
}

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (!run || phase !== 'playing') return;
  const p = canvasPos(e);
  view.cursor = p;
  if (run.state.phase === 'aiming') {
    view.aimActive = true;
    view.aimAngle = aimFromPointer(p);
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (!run || phase !== 'playing') return;
  const p = canvasPos(e);
  view.cursor = p;
  if (view.aimActive && run.state.phase === 'aiming') {
    view.aimAngle = aimFromPointer(p);
  }
});

canvas.addEventListener('pointerup', (e) => {
  if (!run || phase !== 'playing') return;
  if (view.aimActive) {
    const p = canvasPos(e);
    view.aimAngle = aimFromPointer(p);
    if (run.state.phase === 'aiming') {
      run.shoot(view.aimAngle);
    }
    view.aimActive = false;
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
  const b = $('btn-mute');
  if (b) { b.textContent = muted ? '🔇' : '🔊'; b.classList.toggle('is-muted', muted); }
  persist();
}

// ---------- UI 绑定 ----------
function bind() {
  const on = (id, fn) => {
    const el = $(id);
    if (el) el.addEventListener('click', () => { audio.unlock(); fn(); });
  };
  on('btn-start', () => startLevel(lastLevel));
  on('btn-resume', resumeGame);
  on('btn-restart', restartLevel);
  on('btn-restart2', restartLevel);
  on('btn-retry', restartRun);
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result') startTutorial(); });
  on('btn-rotate-skip', () => {
    const rs = $('rotate-screen');
    if (rs) rs.style.display = 'none';
  });
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);

  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = $(id);
    if (!sel) continue;
    sel.addEventListener('change', () => {
      ui.setLang(sel.value);
      renderTutorialStep();
      if (run) updateHud();
      if (phase === 'title') updateStarsTotal();
      if (phase === 'result' && run) showResult({ won: run.state.phase === 'won', stars: run.state.totalStars, score: run.state.score });
    });
  }
}

// ---------- 主循环 ----------
function frame(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;

  if (phase === 'playing' && run && tutorialStep < 0) {
    accumulator += dt;
    while (accumulator >= STEP) {
      run.step(STEP);
      accumulator -= STEP;
    }
    handleEvents(run.drainEvents());
    if (run && phase === 'playing') updateHud();
  }

  if (view.shake > 0) view.shake = Math.max(0, view.shake - dt * 18);

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
  start: (i) => startLevel(i == null ? lastLevel : i),
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
    get steps() { return TUT_STEPS().map((s) => s.text); },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip() { endTutorial(); },
  },
  startTutorial: () => startTutorial(),
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: () => (run ? run.state : null),
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    startSeeded: (i, seed) => {
      const idx = Math.max(0, Math.min(LEVEL_COUNT - 1, i | 0));
      run = createRun(idx, { seed: seed | 0 || 1 });
      setPhase('playing');
      ui.showGame();
      ui.hideResult();
      updateHud();
      return true;
    },
  },
};

// ---------- 启动 ----------
bind();
syncDocumentLang();
ui.applyLang();
ui.showTitle();
updateStarsTotal();
{
  const b = $('btn-mute');
  if (b) { b.textContent = muted ? '🔇' : '🔊'; b.classList.toggle('is-muted', muted); }
}
Sdk.track('load', {});
requestAnimationFrame(frame);
