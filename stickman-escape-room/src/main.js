// 主入口：60Hz 固定步长 + 标题/游戏/暂停/结算 + 教程引导 + SDK 统一出口 + 调试契约。
// 装配：sim(M1) / render+ui(M2) / audio(M4) / Lead 集成。
import { STEP, WORLD, LAYOUT, GAME, CONFIG } from '../config/game.config.js';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';
import { createRun } from './game/sim.js';
import { createRenderer, columnCenter } from './render/index.js';
import { createAudio } from './core/audio.js';
import { ui } from './ui/ui.js';
import { i18n, t, syncDocumentLang } from './core/i18n.js';
import Sdk from './core/sdk.js';

const $ = (id) => document.getElementById(id);
const canvas = $('canvas');
const renderer = createRenderer(canvas);
const audio = createAudio();
const reducedMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

let run = null;
let phase = 'title';            // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let fpsSamples = [];
let tutorialStep = -1;          // -1 = 未激活
let lastTap = { dir: 0, t: 0 };

const view = { t: 0, shake: 0, fxQueue: [] };

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let best = Sdk.load('best', 0) | 0;
let bestStars = Sdk.load('bestStars', 0) | 0;
let tutorialDone = !!Sdk.load('tutorialDone', false);

Sdk.ready(); // 不 await，不阻塞首屏
Sdk.onAdStart(() => { if (phase === 'playing') pauseGame(true); });
Sdk.onAdEnd(() => { if (phase === 'paused') resumeGame(); });
audio.setMuted(muted);
ui.updateMuteLabel();

function persist() {
  Sdk.save('muted', muted);
  Sdk.save('best', best);
  Sdk.save('bestStars', bestStars);
  Sdk.save('tutorialDone', tutorialDone);
}

// ---------- 阶段状态机 ----------
function setPhase(p) { phase = p; }

function clampLevel(i) {
  return Math.max(0, Math.min(LEVEL_COUNT - 1, i | 0));
}

function startLevel(idx, opts = {}) {
  idx = clampLevel(idx);
  run = createRun(idx, { seed: (opts.seed ?? ((Date.now() % 2147483647) || 1)) >>> 0 });
  view.fxQueue = [];
  view.shake = 0;
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

function restartRun() {
  Sdk.track('restart', { level: run ? run.state.level : 1 });
  if (tutorialStep >= 0) endTutorial();
  startLevel(0);
}

function goHome() {
  run = null;
  setPhase('title');
  ui.hideResult();
  ui.showTitle();
  audio.stopBgm();
}

// ---------- HUD ----------
function updateHud() {
  if (run) ui.updateHud(run.getHud());
  updateBoostBadge();
}

function updateBoostBadge() {
  if (!run) return;
  ui.badgeBoost.classList.toggle('boosted', run.state.boost > 0);
}

// ---------- 输入 ----------
function act(dir, boosted) {
  audio.unlock();
  if (!run || phase !== 'playing') return;
  if (run.state.phase !== 'countdown' && run.state.phase !== 'descending') return;
  const res = boosted ? run.boost(dir) : run.move(dir);
  if (res.ok) updateHud();
}

function bind() {
  const press = (id, dir) => {
    const el = $(id);
    if (!el) return;
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const now = performance.now();
      const boosted = (lastTap.dir === dir && now - lastTap.t < 280);
      lastTap = { dir, t: now };
      act(dir, boosted);
    });
  };
  press('btn-left', -1);
  press('btn-right', 1);

  const on = (id, fn) => {
    const el = $(id);
    if (el) el.addEventListener('click', () => { audio.unlock(); fn(); });
  };
  on('btn-start', () => startLevel(0));
  on('btn-resume', resumeGame);
  on('btn-restart', restartRun);
  on('btn-restart2', () => { if (phase === 'paused') resumeGame(); restartRun(); });
  on('btn-retry', restartRun);
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-howto', () => { if (phase === 'playing') startTutorial(); });
  on('btn-howto-title', () => { startLevel(0); startTutorial(); });
  on('btn-tut-replay', () => { if (phase === 'paused') resumeGame(); if (phase === 'playing') startTutorial(); });
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);

  window.addEventListener('keydown', (e) => {
    const boost = e.shiftKey;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') { e.preventDefault(); act(-1, boost); }
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') { e.preventDefault(); act(1, boost); }
    else if (e.code === 'Escape' || e.code === 'KeyP') {
      if (phase === 'playing') pauseGame();
      else if (phase === 'paused') resumeGame();
    } else if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'result')) {
      restartRun();
    } else if (e.code === 'KeyM') toggleMute();
  });

  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = $(id);
    if (!sel) continue;
    sel.addEventListener('change', () => {
      ui.setLang(sel.value);
      if (run) updateHud();
      renderTutorialStep();
    });
  }
}

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  $('btn-mute').classList.toggle('is-muted', muted);
  ui.updateMuteLabel();
  persist();
}

// ---------- 教程引导 ----------
const TUT_STEPS = () => [
  { id: 'move', text: t('tutStep1'), spot: 'columns' },
  { id: 'gap', text: t('tutStep2'), spot: 'ceiling' },
  { id: 'collect', text: t('tutStep3'), spot: 'columns' },
  { id: 'escape', text: t('tutStep4'), spot: null },
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
  const rect = s && s.spot ? layoutRect(s.spot) : null;
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

// ---------- 事件消费（音效 + 粒子 + 震屏 + 结算） ----------
function spawnParticles(type, col, n) {
  if (reducedMotion) return;
  for (let i = 0; i < n; i += 1) {
    view.fxQueue.push({ type, col, ttl: 0.5, max: 0.5, x: columnCenter(col) + (Math.random() - 0.5) * 60, y: WORLD.HEIGHT - 80 - Math.random() * 40 });
  }
}

function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    switch (ev.type) {
      case 'move': if (!reducedMotion) view.fxQueue.push({ type: 'spark', col: ev.to, ttl: 0.2, max: 0.2, x: 0, y: 0 }); break;
      case 'boost': view.shake = Math.max(view.shake, 3); spawnParticles('spark', ev.to, 5); break;
      case 'collect': view.shake = Math.max(view.shake, 1.5); spawnParticles('gem', ev.index, 8); break;
      case 'descendStart': view.shake = Math.max(view.shake, 3.5); break;
      case 'survive': spawnParticles('gem', ev.index, 10); break;
      case 'shieldUsed': spawnParticles('spark', ev.index, 10); break;
      case 'danger': spawnParticles('crushDebris', ev.index, 4); break;
      case 'nearMiss': spawnParticles('crushDebris', ev.index, 3); break;
      case 'crush': view.shake = Math.max(view.shake, 7); spawnParticles('crushDebris', ev.index, 16); break;
      case 'win':
      case 'lose':
        finishRun(ev);
        return;
      default: break;
    }
  }
}

function finishRun(ev) {
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  const st = run ? run.state : null;
  const res = st && st.result ? st.result : { won: ev.type === 'win', score: 0, totalStars: 0, roomsCleared: 0, combo: 0 };
  const isNewBest = res.score > best;
  if (res.score > best) best = res.score;
  if (res.totalStars > bestStars) bestStars = res.totalStars;
  persist();
  Sdk.track(res.won ? 'win' : 'fail', { level: res.level, score: res.score, stars: res.totalStars, roomsCleared: res.roomsCleared, combo: res.combo });
  if (res.won) Sdk.levelCleared({ level: res.level, score: res.score });
  else Sdk.gameOver({ level: res.level, reason: res.reason });

  $('result-title').textContent = res.won ? t('winTitle') : t('loseTitle');
  $('result-title').classList.toggle('lose', !res.won);
  $('result-stars').textContent = `★ ${res.totalStars}`;
  const metaParts = [];
  metaParts.push(res.won ? t('escaped') : t('crushed'));
  metaParts.push(`${t('roomsCleared')} ${res.roomsCleared}`);
  metaParts.push(`${t('score')} ${res.score}`);
  if (isNewBest && res.score > 0) metaParts.push(t('newBest'));
  $('result-meta').textContent = metaParts.join(' · ');
  ui.showResult();
  audio.event(res.won ? 'win' : 'lose');
}

// ---------- 主循环 ----------
function frame(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;
  view.t += dt;

  if (phase === 'playing' && run) {
    accumulator += dt;
    while (accumulator >= STEP) {
      run.step(STEP);
      accumulator -= STEP;
    }
    handleEvents(run.drainEvents());
    if (phase === 'playing') updateHud();
  }

  if (view.shake > 0) view.shake = Math.max(0, view.shake - dt * 20);
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

// ---------- 调试契约 ----------
function autoSurvive() {
  if (!run) return false;
  const s = run.state;
  if (s.phase === 'won' || s.phase === 'lost') return false;
  // 找一个安全缺口，走到它上面
  let target = -1;
  for (let i = 0; i < s.columns; i += 1) if (s.safe[i] && !s.hazards[i]) { target = i; break; }
  if (target >= 0) {
    let guard = 30;
    while (guard-- > 0 && s.playerIndex !== target) {
      const dir = target > s.playerIndex ? 1 : -1;
      const gap = Math.abs(target - s.playerIndex);
      if (gap >= 2 && s.boost > 0 && s.rocks[s.playerIndex + dir]) run.boost(dir);
      else if (!run.move(dir).ok) run.boost(dir);
    }
  }
  // 快进到本关结算
  let guard2 = 600;
  while (guard2-- > 0 && s.phase !== 'won' && s.phase !== 'lost' && s.level === run.state.level && (s.phase === 'countdown' || s.phase === 'descending')) {
    run.step(1 / 20);
  }
  run.drainEvents();
  return { level: s.level, phase: s.phase, playerIndex: s.playerIndex };
}

window.__ll = {
  state: {
    get phase() { return phase; },
    get lang() { return i18n.lang; },
  },
  run: () => run,
  start: (i) => startLevel(i == null ? 0 : i),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => restartRun(),
  home: () => goHome(),
  sim: () => (run ? run.state : null),
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['move', 'gap', 'collect', 'escape']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  save: (key, value) => Sdk.save(key, value),
  ui: () => ui,
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: () => (run ? run.state : null),
    loadLevel: (i) => startLevel(i),
    startSeeded: (i, seed) => startLevel(i, { seed: seed | 0 }),
    autoSurvive,
    fastForward: autoSurvive,
    tutorialStep: () => tutorialStep,
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    giveUp: autoSurvive,
  },
};

// ---------- 启动 ----------
bind();
syncDocumentLang();
ui.applyLang();
ui.showTitle();
$('btn-mute').classList.toggle('is-muted', muted);
Sdk.track('load', {});
requestAnimationFrame(frame);
