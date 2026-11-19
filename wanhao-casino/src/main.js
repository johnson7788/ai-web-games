// WANHAO CASINO · 主入口：60Hz 固定步长 + 标题/游戏/暂停/结算 + 教程 + SDK 统一出口
import { STEP, GAME, DOORS, CHIP_SIZES } from '../config/game.config.js';
import { createRun } from './game/sim.js';
import { createRenderer, doorLayouts } from './render/index.js';
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
let armAllin = false;
let tutorialDone = !!Sdk.load('tutorialDone', false);
let bestChips = Sdk.load('bestChips', 0) | 0;
let muted = !!Sdk.load('muted', false);

const view = { shake: 0, cursor: { x: 0, y: 0 } };

Sdk.ready();
audio.setMuted(muted);

function persist() {
  Sdk.save('tutorialDone', tutorialDone);
  Sdk.save('bestChips', bestChips);
  Sdk.save('muted', muted);
}

// ---------- 阶段状态机 ----------
function setPhase(p) { phase = p; }

function startSession() {
  run = createRun((Date.now() % 2147483647) || 1);
  armAllin = false;
  setPhase('playing');
  ui.showGame();
  ui.hideResult();
  updateHud();
  updateChipButtons();
  audio.startBgm();
  Sdk.newRun({});
  if (!tutorialDone) startTutorial();
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

function restartSession() {
  Sdk.track('restart', { round: run ? run.state.round : 1 });
  startSession();
}

function goHome() {
  run = null;
  setPhase('title');
  ui.hideResult();
  ui.showTitle();
  if (tutorialStep >= 0) endTutorial();
}

// ---------- HUD / 结算 ----------
function updateHud() {
  if (!run) return;
  const h = run.getHud();
  $('hud-round').textContent = `${t('round')} ${h.round}/${GAME.MAX_ROUNDS}`;
  $('hud-chips').textContent = `${t('chips')} ${h.chips.toLocaleString()}`;
  const streakEl = $('hud-streak');
  if (h.streak >= 1) {
    streakEl.classList.remove('hidden');
    streakEl.textContent = `${t('streak')} ×${Math.min(GAME.STREAK_CAP, 1 + 0.5 * Math.max(0, h.streak - 1))}`;
  } else {
    streakEl.classList.add('hidden');
  }
}

function updateChipButtons() {
  if (!run) return;
  document.querySelectorAll('.chip-btn').forEach((b) => {
    b.classList.toggle('selected', Number(b.dataset.chip) === run.state.selectedChip);
  });
  $('btn-allin').classList.toggle('armed', armAllin);
}

function showResult(res) {
  const { won, stars, finalChips } = res;
  $('result-title').textContent = won ? t('winTitle') : t('loseTitle');
  $('result-title').classList.toggle('lose', !won);
  $('result-stars').innerHTML = won
    ? `<span class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>${stars >= 3 ? `<em>${t('perfect')}</em>` : ''}`
    : '';
  $('result-chips').textContent = `${t('resultChips')}: ${finalChips.toLocaleString()}`;
  $('result-meta').textContent = won ? t('finalWinMeta') : t('finalLoseMeta');
  ui.showResult();
}

function finishRun(ev) {
  if (phase === 'result') return;
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  const won = ev.type === 'win';
  const stars = won ? (ev.stars || 1) : 0;
  const finalChips = run ? run.state.chips : 0;
  if (won && finalChips > bestChips) {
    bestChips = finalChips;
  }
  persist();
  Sdk[won ? 'levelCleared' : 'gameOver']({ stars, finalChips, round: run ? run.state.round : 0 });
  showResult({ won, stars, finalChips });
  audio.event(won ? 'win' : 'lose');
}

// ---------- 教程（首次自动弹，可跳过，可重看，动作驱动推进） ----------
const TUT_STEP_IDS = ['bet', 'chip', 'roll', 'reveal'];
const TUT_STEPS = () => [
  { text: t('tutStep1'), spot: 'doors' },
  { text: t('tutStep2'), spot: 'chip' },
  { text: t('tutStep3'), spot: 'roll' },
  { text: t('tutStep4'), spot: 'doors' },
];
const TUT_TRIGGER = ['bet', 'selectChip', 'roll', 'reveal'];

function startTutorial() {
  if (!run) startSession();
  tutorialStep = 0;
  renderTutorialStep();
}

function renderTutorialStep() {
  const el = $('tutorial');
  if (tutorialStep < 0 || tutorialStep >= TUT_STEPS().length) {
    el.classList.add('hidden');
    return;
  }
  const s = TUT_STEPS()[tutorialStep];
  el.classList.remove('hidden');
  $('tut-title').textContent = t('tutTitle');
  $('tut-text').textContent = s.text;
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

function tutorialAdvance(evType) {
  if (tutorialStep < 0 || tutorialStep >= TUT_TRIGGER.length) return;
  if (TUT_TRIGGER[tutorialStep] !== evType) return;
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
      case 'doorWin':
      case 'combo':
        view.shake = 3;
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

function pickDoor(p) {
  for (const d of doorLayouts()) {
    if (p.x >= d.x && p.x <= d.x + d.w && p.y >= d.y && p.y <= d.y + d.h) return d.key;
  }
  return null;
}

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (!run || phase !== 'playing') return;
  const p = canvasPos(e);
  const door = pickDoor(p);
  if (!door) return;
  if (armAllin) {
    const res = run.allin(door);
    if (res.ok) { armAllin = false; updateHud(); updateChipButtons(); }
  } else {
    const res = run.bet(door);
    if (res.ok) updateHud();
    else if (res.reason === 'poor') { view.shake = 4; }
  }
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
  if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'result')) restartSession();
  if (e.code === 'KeyM') toggleMute();
});

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  $('btn-mute').classList.toggle('is-muted', muted);
  persist();
}

// ---------- UI 绑定 ----------
function bind() {
  const on = (id, fn) => {
    const el = $(id);
    if (el) el.addEventListener('click', () => { audio.unlock(); fn(); });
  };
  on('btn-start', startSession);
  on('btn-resume', resumeGame);
  on('btn-restart', restartSession);
  on('btn-restart2', restartSession);
  on('btn-retry', restartSession);
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-roll', () => {
    if (!run || phase !== 'playing') return;
    const res = run.roll();
    if (res.ok) updateHud();
  });
  on('btn-allin', () => {
    if (!run || phase !== 'playing') return;
    armAllin = !armAllin;
    updateChipButtons();
  });
  on('btn-howto', startTutorial);
  on('btn-howto-title', startTutorial);
  on('btn-howto2', () => { resumeGame(); startTutorial(); });
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);

  document.querySelectorAll('.chip-btn').forEach((b) => {
    b.addEventListener('click', () => {
      audio.unlock();
      if (!run || phase !== 'playing') return;
      run.selectChip(Number(b.dataset.chip));
      updateChipButtons();
    });
  });

  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = $(id);
    if (!sel) continue;
    sel.addEventListener('change', () => {
      ui.setLang(sel.value);
      renderTutorialStep();
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

// ---------- 调试契约 ----------
window.__ll = {
  state: {
    get phase() { return phase; },
    get lang() { return i18n.lang; },
  },
  run: () => run,
  start: () => startSession(),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => restartSession(),
  home: () => goHome(),
  sim: () => (run ? run.state : null),
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return TUT_STEP_IDS.slice(); },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  save: () => Sdk,
  ui: () => ui,
  debug: {
    state: () => (run ? { ...run.state, bets: { ...run.state.bets }, hands: { ...run.state.hands } } : null),
    bet: (d) => (run ? run.bet(d) : { ok: false }),
    betAll: () => {
      if (!run) return false;
      for (const d of ['sun', 'moon', 'star']) run.bet(d);
      updateHud();
      return true;
    },
    roll: () => (run ? run.roll() : { ok: false }),
    allin: (d) => (run ? run.allin(d) : { ok: false }),
    setStreak: (n) => { if (run) { run.state.streak = n | 0; updateHud(); } },
    forceHands: (h) => (run ? run.forceHands(h) : false),
    fastForward: () => {
      if (!run) return false;
      let guard = 2000;
      while (guard-- > 0 && run.state.phase !== 'won' && run.state.phase !== 'lost') {
        run.step(1 / 60);
        handleEvents(run.drainEvents());
      }
      return true;
    },
    skipToRound: (n) => {
      if (!run) return false;
      run.state.round = Math.max(1, Math.min(GAME.MAX_ROUNDS, n | 0));
      run.state.phase = 'betting';
      run.state.bets = { sun: 0, moon: 0, star: 0 };
      run.state.hands = { house: null, sun: null, moon: null, star: null };
      updateHud();
      return true;
    },
  },
};

// ---------- 启动 ----------
bind();
syncDocumentLang();
ui.applyLang();
$('btn-mute').classList.toggle('is-muted', muted);
Sdk.track('load', {});
requestAnimationFrame(frame);
