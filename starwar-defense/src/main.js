// 主入口：60Hz 固定步长 + 标题/游戏/暂停/结算 + 教程引导 + SDK 统一出口
import { STEP, CONFIG } from '../config/game.config.js';
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
let fireHeld = false;
let tutorialStep = -1;

const view = {
  particles: [],
  beam: null,
  shake: 0,
};

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let lastWave = Math.max(1, Sdk.load('lastWave', 1) | 0);
let bestWave = Math.max(1, Sdk.load('bestWave', 1) | 0);
let starsByWave = Sdk.load('stars', {}) || {};
let tutorialDone = !!Sdk.load('tutorialDone', false);

Sdk.ready(); // 不 await，不阻塞首屏
Sdk.onAdStart(() => { if (phase === 'playing') pauseGame(true); });
Sdk.onAdEnd(() => { if (phase === 'paused') resumeGame(); });
audio.setMuted(muted);
ui.setMuted(muted);

function persist() {
  Sdk.save('muted', muted);
  Sdk.save('lastWave', lastWave);
  Sdk.save('bestWave', bestWave);
  Sdk.save('stars', starsByWave);
  Sdk.save('tutorialDone', tutorialDone);
}

function totalStars() {
  return Object.values(starsByWave).reduce((a, b) => a + (b | 0), 0);
}

// ---------- 阶段状态机 ----------
function setPhase(p) { phase = p; }

function startLevel(idx) {
  const wave = Math.max(0, idx | 0);
  fireHeld = false;
  run = createRun(wave, { seed: (Date.now() % 2147483647) || 1 });
  view.particles = [];
  view.beam = null;
  view.shake = 0;
  setPhase('playing');
  ui.showGame();
  ui.hideResult();
  updateHud();
  $('press-any').classList.remove('hidden');
  audio.unlock();
  audio.startBgm();
  Sdk.newRun({ level: wave + 1 });
  if (!tutorialDone && wave === 0) startTutorial();
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
  lastTime = performance.now();
}

function restartLevel() {
  if (run) startLevel(run.state.level - 1);
}

function goHome() {
  run = null;
  setPhase('title');
  ui.hideResult();
  ui.showTitle();
  ui.updateBest(bestWave, totalStars());
  audio.stopBgm();
}

function nextWave() {
  if (!run) return;
  const next = Math.min(run.state.level, 999); // 下一波（level 已是 1 基，直接当 index）
  startLevel(next);
}

// ---------- HUD ----------
function updateHud() {
  if (!run) return;
  ui.updateHud(run.getHud());
}

function spawnParticle(x, y, color, count, speed) {
  for (let i = 0; i < count; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const s = (speed || 120) * (0.4 + Math.random() * 0.8);
    view.particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 0.3 + Math.random() * 0.35,
      maxLife: 0.6,
      size: 3 + Math.random() * 4,
      color,
    });
  }
}

// ---------- 结算 ----------
function finishRun(ev) {
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  const st = run.state;
  const won = ev.type === 'win';
  const stars = won ? (ev.stars || st.stars || 1) : 0;
  if (won) {
    starsByWave[st.level] = Math.max(starsByWave[st.level] | 0, stars);
    if (st.level >= bestWave) bestWave = st.level;
    lastWave = Math.max(lastWave, st.level + 1);
    Sdk.levelCleared({ level: st.level, stars, score: st.score });
  } else {
    lastWave = Math.max(1, st.level);
    Sdk.gameOver({ level: st.level, score: st.score });
  }
  persist();
  ui.updateBest(bestWave, totalStars());
  const meta = won
    ? `${t('score')} ${st.score} · ${t('combo')} ×${Math.min(8, 1 + Math.floor(st.bestCombo / 4))}`
    : `${t('score')} ${st.score}`;
  ui.showResult(won, stars, meta);
  audio.event(won ? 'win' : 'lose');
}

// ---------- 教程 ----------
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

function tutorialAdvance(evType) {
  if (tutorialStep < 0) return;
  const triggers = ['shot', 'kill', 'collect'];
  const idx = triggers.indexOf(evType);
  if (idx < 0) return;
  if (idx >= tutorialStep) tutorialNext();
}

// ---------- 事件消费 ----------
function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    tutorialAdvance(ev.type);
    switch (ev.type) {
      case 'shot':
        spawnParticle(ev.x, ev.y, '#bffcff', 2, 90);
        break;
      case 'hit':
        spawnParticle(ev.x, ev.y, '#ffe14d', 3, 130);
        break;
      case 'kill':
        spawnParticle(ev.x, ev.y, ev.type === 'boss' ? '#ff2d95' : '#ff8a3c', 14, 200);
        view.shake = ev.type === 'boss' ? 8 : 3;
        break;
      case 'leak':
        spawnParticle(ev.x, renderer.H, '#ff4a4a', 12, 170);
        view.shake = 5;
        break;
      case 'blast':
        view.beam = { ttl: 0.5 };
        view.shake = 10;
        break;
      case 'collect':
        spawnParticle(ev.x, ev.y, '#5dff8a', 8, 120);
        break;
      case 'shield':
        spawnParticle(renderer.W / 2, renderer.H, '#5dff8a', 10, 140);
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
function pressFire() {
  audio.unlock();
  fireHeld = true;
  $('press-any')?.classList.add('hidden');
}

function releaseFire() { fireHeld = false; }

function doBlast() {
  audio.unlock();
  if (run && phase === 'playing') {
    const r = run.blast();
    if (r.ok) view.beam = { ttl: 0.5 };
  }
}

canvas.addEventListener('pointerdown', (e) => { e.preventDefault(); pressFire(); });
window.addEventListener('pointerup', releaseFire);
window.addEventListener('pointercancel', releaseFire);

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') { e.preventDefault(); pressFire(); }
  else if (e.code === 'Enter' || e.code === 'KeyB') { e.preventDefault(); doBlast(); }
  else if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  } else if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'result')) restartLevel();
  else if (e.code === 'KeyM') toggleMute();
});
window.addEventListener('keyup', (e) => { if (e.code === 'Space') releaseFire(); });

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
  on('btn-start', () => startLevel(Math.max(0, lastWave - 1)));
  on('btn-resume', resumeGame);
  on('btn-restart', restartLevel);
  on('btn-restart2', restartLevel);
  on('btn-retry', restartLevel);
  on('btn-next', nextWave);
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-blast', doBlast);
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result' || phase === 'paused') startTutorial(); });
  on('btn-howto-title', () => startTutorial());
  on('btn-tut-replay', () => { if (phase === 'paused') resumeGame(); startTutorial(); });

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
    if (fireHeld) run.fire();
    accumulator += dt;
    while (accumulator >= STEP) {
      run.step(STEP);
      accumulator -= STEP;
    }
    handleEvents(run.drainEvents());
    if (run && phase === 'playing') updateHud();
  }

  if (view.shake > 0) view.shake = Math.max(0, view.shake - dt * 20);
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
  },
  run: () => run,
  start: (i) => startLevel(i == null ? Math.max(0, lastWave - 1) : i),
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
    get steps() { return ['fire', 'super', 'powerups']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
  },
  startTutorial: () => startTutorial(),
  debug: {
    state: () => (run ? run.state : null),
    loadWave: (i) => startLevel(i),
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    fastForward: () => {
      if (!run) return false;
      try {
        let guard = 4000;
        while (guard-- > 0 && run.state.phase === 'playing') {
          run.step(0.5);
          handleEvents(run.drainEvents());
        }
        return true;
      } catch { return false; }
    },
  },
};

// ---------- 启动 ----------
bind();
syncDocumentLang();
ui.applyLang();
ui.updateBest(bestWave, totalStars());
$('btn-mute')?.classList.toggle('is-muted', muted);
Sdk.track('load', {});
requestAnimationFrame(frame);
