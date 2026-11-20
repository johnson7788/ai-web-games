// SKY STRIKE ALPHA · 主入口：60Hz 固定步长 + 标题/游戏/暂停/结算 + 教程引导 + SDK 统一出口
// 契约见 docs/README.md 与执行单。装配：sim / render+ui / audio。
import { STEP, WORLD, GAME } from '../config/game.config.js';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';
import { createRun } from './game/sim.js';
import { greedyHold, flySteps } from './game/autopilot.js';
import { createRenderer } from './render/index.js';
import { createAudio } from './core/audio.js';
import { ui } from './ui/ui.js';
import { i18n, t, syncDocumentLang } from './core/i18n.js';
import Sdk from './core/sdk.js';

const $ = (id) => document.getElementById(id);
const canvas = $('canvas');
canvas.style.touchAction = 'none';
const renderer = createRenderer(canvas);
const audio = createAudio();

let run = null;            // 当前对局
let phase = 'title';       // title | playing | paused | result
let currentLevel = 0;      // 当前关卡 0 基
let lastTime = performance.now();
let accumulator = 0;
let fpsSamples = [];
let tutorialStep = -1;     // -1 = 未激活
let inputHold = false;     // 主循环每帧灌给 sim 的输入

const view = { fxQueue: [], shake: 0 };

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let best = Sdk.load('best', 0) | 0;
let tutorialDone = !!Sdk.load('tutorialDone', false);
let lastLevel = Sdk.load('lastLevel', 0) | 0;

Sdk.ready(); // 不 await，不阻塞首屏
Sdk.onAdStart(() => { if (phase === 'playing') pauseGame(true); });
Sdk.onAdEnd(() => { if (phase === 'paused') resumeGame(); });
audio.setMuted(muted);
ui.setMuted(muted);

function persist() {
  Sdk.save('muted', muted);
  Sdk.save('best', best);
  Sdk.save('tutorialDone', tutorialDone);
  Sdk.save('lastLevel', lastLevel);
}

function setPhase(p) { phase = p; }

// ---------- 阶段状态机 ----------
function startLevel(idx) {
  idx = Math.max(0, Math.min(LEVEL_COUNT - 1, idx | 0));
  currentLevel = idx;
  run = createRun(idx, { seed: (Date.now() % 2147483647) || 1 });
  inputHold = false;
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
  if (run) Sdk.track('restart', { level: currentLevel + 1 });
  startLevel(currentLevel);
}

function goHome() {
  run = null;
  setPhase('title');
  ui.hideResult();
  ui.showTitle();
  ui.setBest(best);
}

// ---------- HUD / 结算 ----------
function updateHud() {
  if (!run) return;
  ui.updateHud(run.getHud(), best);
}

function finishRun(ev) {
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial(); // 结算屏出现时引导退场
  const st = run.state;
  const won = ev.type === 'win';
  const res = won
    ? { won: true, stars: st.stars || 1, score: st.score, coresCollected: st.coresCollected, coresSpawned: st.coresSpawned, hitsTaken: st.hitsTaken, reason: null }
    : { won: false, stars: 0, score: st.score, coresCollected: st.coresCollected, coresSpawned: st.coresSpawned, hitsTaken: st.hitsTaken, reason: ev.reason || 'crashWall' };
  if (won) {
    best = Math.max(best, st.score);
    lastLevel = Math.max(lastLevel, currentLevel + 1);
    persist();
  }
  Sdk.track(won ? 'win' : 'fail', { level: currentLevel + 1, stars: res.stars, score: st.score, cores: st.coresCollected });
  ui.showResult(res);
  audio.event(won ? 'win' : 'lose');
}

// ---------- 教程（首次自动弹，可跳过，完成/跳过后持久化不再自动弹） ----------
const TUT_STEPS = () => [
  { text: t('tutStep1'), spot: 'playfield' },
  { text: t('tutStep2'), spot: 'playfield' },
  { text: t('tutStep3'), spot: 'playfield' },
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
  // 卡片固定在底部居中，不遮 HUD 与战机
  const spot = $('tut-spotlight');
  spot.style.display = 'none';
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
      case 'score':
        view.fxQueue.push({ type: 'score', x: run.state.player.x, y: run.state.player.y });
        view.shake = 1;
        break;
      case 'shieldGot':
        view.fxQueue.push({ type: 'shieldGot', x: run.state.player.x, y: run.state.player.y });
        break;
      case 'nearMiss':
        view.fxQueue.push({ type: 'nearMiss', x: run.state.player.x, y: run.state.player.y });
        break;
      case 'shieldBlock':
        view.fxQueue.push({ type: 'shieldBlock', x: run.state.player.x, y: run.state.player.y });
        view.shake = 6;
        break;
      case 'win':
      case 'lose':
        if (ev.type === 'lose') view.fxQueue.push({ type: 'explode', x: run.state.player.x, y: run.state.player.y });
        finishRun(ev);
        return;
      default:
        break;
    }
  }
}

// ---------- 输入 ----------
function setHold(v) {
  inputHold = !!v;
  if (run && phase === 'playing') run.setHold(inputHold);
}

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  audio.unlock();
  if (phase !== 'playing') return;
  setHold(true);
});
window.addEventListener('pointerup', () => setHold(false));
window.addEventListener('pointercancel', () => setHold(false));

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); audio.unlock(); setHold(true); }
  else if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
  else if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'result')) restartLevel();
  else if (e.code === 'KeyM') toggleMute();
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp') setHold(false);
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
  on('btn-start', () => startLevel(0));
  on('btn-resume', resumeGame);
  on('btn-restart', restartLevel);
  on('btn-restart2', restartLevel);
  on('btn-retry', restartLevel);
  on('btn-next', () => startLevel(currentLevel + 1));
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-tut-replay', () => { if (phase === 'paused') resumeGame(); if (phase === 'playing') startTutorial(); });
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result') startTutorial(); });
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

  if (phase === 'playing' && run && tutorialStep < 0) {
    accumulator += dt;
    while (accumulator >= STEP) {
      run.setHold(inputHold);
      run.step(STEP);
      accumulator -= STEP;
    }
    handleEvents(run.drainEvents());
    if (run && phase === 'playing') updateHud();
    // 引擎尾焰粒子
    if (run.state.phase === 'playing' || run.state.phase === 'ready') {
      view.fxQueue.push({ type: 'engine', p: run.state.player });
    }
  }

  if (view.shake > 0) view.shake = Math.max(0, view.shake - dt * 18);

  try {
    renderer.draw(run ? run.state : null, dt, view);
  } catch (err) {
    console.warn('render error', err);
  }
  view.fxQueue = [];

  if (fpsSamples.length < 600 && dt > 0) fpsSamples.push(1 / dt);

  requestAnimationFrame(frame);
}

// ---------- 调试契约（截图/验收脚本通用） ----------
function debugState() {
  return run ? run.state : null;
}

function startSeeded(idx, seed) {
  idx = Math.max(0, Math.min(LEVEL_COUNT - 1, idx | 0));
  currentLevel = idx;
  run = createRun(idx, { seed: seed | 0 || 1 });
  inputHold = false;
  run.setHold(true); // 立即起飞，脱离 ready
  run.setHold(false);
  setPhase('playing');
  ui.showGame();
  ui.hideResult();
  updateHud();
  return true;
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
  restart: () => restartLevel(),
  home: () => goHome(),
  sim: () => (run ? run.state : null),
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['hold', 'thread', 'drain']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  save: (k, v) => Sdk.save(k, v),
  load: (k, f) => Sdk.load(k, f),
  share: (p) => Sdk.share(p || {}),
  ui: () => ui,
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: debugState,
    loadLevel: (i) => startLevel(i),
    startSeeded,
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    startTutorial: () => startTutorial(),
    // 贪心自动驾驶推进到离场（供验收快速通关/截图）
    autoFly: (maxSec = 60) => {
      if (!run) return false;
      if (run.state.phase === 'ready') { run.setHold(true); run.setHold(false); }
      const r = flySteps(run, maxSec);
      handleEvents(run.drainEvents());
      return r.phase;
    },
    // 推进指定秒数，停在 mid-game 用于截图
    partialFly: (sec = 3) => {
      if (!run) return false;
      if (run.state.phase === 'ready') { run.setHold(true); run.setHold(false); }
      flySteps(run, sec);
      handleEvents(run.drainEvents());
      return run.state.phase;
    },
    // 手动控制 hold（供调试）
    hold: (v) => { if (run) run.setHold(!!v); },
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
ui.showTitle();
ui.setBest(best);
ui.setMuted(muted);
Sdk.track('load', {});
requestAnimationFrame(frame);
