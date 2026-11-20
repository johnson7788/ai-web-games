// NEON SERPENT · 主入口：60Hz 固定步长 + 标题→游戏→暂停→结算 + 教程引导 + SDK 统一出口。
// 装配：sim(M1) / render+ui(M2) / audio(M4) / SDK(M5)。契约见 README.md。
// 职责：main 只做状态机、输入、事件消费、HUD/结算/教程 DOM 直写。
import { STEP, SERPENT, GAME } from '../config/game.config.js';
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
let tutorialStep = -1;

const view = {
  t: 0,
  shake: 0,
};

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let best = Sdk.load('best', 0) | 0;
let tutorialDone = !!Sdk.load('tutorialDone', false);

Sdk.ready(); // 不 await，不阻塞首屏
Sdk.onAdStart(() => { if (phase === 'playing') pauseGame(true); });
Sdk.onAdEnd(() => { if (phase === 'paused') resumeGame(); });
audio.setMuted(muted);
ui.setMuted(muted);

function persist() {
  Sdk.save('muted', muted);
  Sdk.save('best', best);
  Sdk.save('tutorialDone', tutorialDone);
}

// ---------- 阶段状态机 ----------
function setPhase(p) { phase = p; }

function startGame() {
  run = createRun({ seed: (Date.now() % 2147483647) || 1 });
  run.state.best = best;
  renderer.clearParticles();
  setPhase('playing');
  ui.show('game');
  hideResult();
  updateHud();
  audio.unlock();
  audio.startBgm();
  Sdk.track('start', {});
  if (!tutorialDone) startTutorial();
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

function restartGame() {
  Sdk.track('restart', { score: run ? run.state.score : 0 });
  startGame();
}

function goHome() {
  run = null;
  setPhase('title');
  hideResult();
  ui.showTitle();
  audio.stopBgm();
}

// ---------- HUD / 结算 ----------
function updateHud() {
  if (!run) return;
  const h = run.getHud();
  $('hud-score').textContent = `${t('score')} ${h.score}`;
  const comboEl = $('hud-combo');
  comboEl.textContent = `×${h.combo}`;
  comboEl.classList.toggle('combo-hot', h.combo >= 3);
  $('hud-best').textContent = `${t('best')} ${Math.max(best, h.score)}`;
  $('hud-body').textContent = '♥'.repeat(Math.max(0, h.body));
  $('hud-body').classList.toggle('low', h.body <= 0);
  // 护盾/狂热指示
  const status = [];
  if (h.shieldT > 0) status.push('🛡');
  if (h.feverT > 0) status.push('🔥');
  if (h.stars > 0) status.push('★'.repeat(h.stars));
  $('hud-status').textContent = status.join(' ');
}

function showResult() {
  if (!run) return;
  const st = run.state;
  $('result-title').textContent = t('resultTitle');
  $('result-score').textContent = t('resultScore', { s: st.score });
  const isNew = st.score > best;
  if (isNew) best = st.score;
  $('result-best').textContent = t('resultBest', { b: best }) + (isNew ? ` · ${t('newBest')}` : '');
  $('screen-result').classList.remove('hidden');
}

function hideResult() {
  $('screen-result').classList.add('hidden');
}

function finishRun(ev) {
  if (phase === 'result') return;
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  const st = run.state;
  persist();
  Sdk.track('fail', { score: st.score, zone: st.level, reason: ev.reason, durationMs: Math.round(st.time * 1000) });
  showResult();
  audio.event('die', ev);
}

// ---------- 教程引导（首次自动弹，可跳过，完成后持久化不再自动弹） ----------
const TUT_STEPS = () => [
  { id: 'flap', text: t('tutStep1') },
  { id: 'dodge', text: t('tutStep2') },
  { id: 'collect', text: t('tutStep3') },
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
  // 聚光灯：教程卡片固定底部居中，无需精确高亮棋盘；隐藏 spotlight
  const spot = $('tut-spotlight');
  if (spot) spot.style.display = 'none';
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
    const headX = SERPENT.X;
    const headY = run ? run.state.serpent.y : 360;
    switch (ev.type) {
      case 'flap':
        renderer.burst(headX - 6, headY + 10, '#4dffc9', 4, 90);
        break;
      case 'score':
        renderer.burst(headX + 20, headY, '#19f6ff', 8, 150);
        break;
      case 'combo':
        renderer.burst(headX, headY - 20, '#ffe14d', 3, 80);
        break;
      case 'hit':
        view.shake = 6;
        renderer.burst(headX, headY, '#ff4d9d', 16, 220);
        break;
      case 'shield':
        renderer.burst(headX, headY, '#4de3ff', 18, 200);
        break;
      case 'life':
        renderer.burst(headX, headY, '#ff4d9d', 12, 160);
        break;
      case 'star':
        renderer.burst(headX, headY, '#ffe14d', 12, 170);
        break;
      case 'fever':
        view.shake = 4;
        renderer.burst(headX, headY, '#ff2ecc', 24, 260);
        break;
      case 'zone':
        renderer.burst(headX, headY - 30, '#b347ff', 14, 200);
        break;
      case 'die':
        finishRun(ev);
        return;
      default:
        break;
    }
  }
}

// ---------- 输入 ----------
function doFlap() {
  if (!run || phase !== 'playing') return;
  run.flap();
}

canvas.addEventListener('pointerdown', () => {
  audio.unlock();
  doFlap();
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
    e.preventDefault();
    audio.unlock();
    if (phase === 'playing') doFlap();
    else if (phase === 'title') startGame();
    else if (phase === 'result') restartGame();
    else if (phase === 'paused') resumeGame();
  }
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
  if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'result')) restartGame();
  if (e.code === 'KeyM') toggleMute();
});

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  ui.setMuted(muted);
  $('btn-mute').classList.toggle('is-muted', muted);
  $('btn-mute').textContent = muted ? '🔇' : '🔊';
  persist();
}

// ---------- UI 绑定 ----------
function bind() {
  const on = (id, fn) => {
    const el = $(id);
    if (el) el.addEventListener('click', () => { audio.unlock(); fn(); });
  };
  on('btn-start', startGame);
  on('btn-resume', resumeGame);
  on('btn-restart', restartGame);
  on('btn-restart2', restartGame);
  on('btn-retry', restartGame);
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-howto', () => { if (phase === 'playing' || phase === 'paused' || phase === 'result') startTutorial(); });
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
      updateHud();
    });
  }
}

// ---------- 主循环 ----------
function frame(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;
  view.t = now / 1000;

  if (phase === 'playing' && run) {
    accumulator += dt;
    while (accumulator >= STEP) {
      run.step(STEP);
      accumulator -= STEP;
    }
    handleEvents(run.drainEvents());
    if (run && phase === 'playing') updateHud();
  }

  if (view.shake > 0) view.shake = Math.max(0, view.shake - dt * 22);

  try {
    const shakeX = view.shake ? (Math.random() - 0.5) * view.shake : 0;
    const shakeY = view.shake ? (Math.random() - 0.5) * view.shake : 0;
    const s = run && (phase === 'playing' || phase === 'paused' || phase === 'result') ? run.state : null;
    renderer.draw(s, dt, view);
    if (shakeX || shakeY) { /* 震屏通过轻微位移 canvas 实现 */ }
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
  sim: () => (run ? run.state : null),
  start: () => startGame(),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => restartGame(),
  home: () => goHome(),
  save: (k, v) => Sdk.save(k, v),
  load: (k, d) => Sdk.load(k, d),
  ui,
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['flap', 'dodge', 'collect']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: () => (run ? run.state : null),
    hud: () => (run ? run.getHud() : null),
    autoPlayToDeath: () => {
      if (!run || phase !== 'playing') return false;
      let guard = 800;
      while (guard-- > 0 && run.state.phase !== 'dead') {
        run.step(1 / 60);
        handleEvents(run.drainEvents());
      }
      return run.state.phase === 'dead';
    },
    fastForward: (sec = 3) => {
      if (!run || phase !== 'playing') return false;
      const n = Math.round(sec * 60);
      for (let i = 0; i < n && run.state.phase === 'playing'; i += 1) {
        run.step(1 / 60);
        handleEvents(run.drainEvents());
      }
      return true;
    },
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
  },
};

// ---------- 启动 ----------
bind();
syncDocumentLang();
ui.applyLang();
$('btn-mute').classList.toggle('is-muted', muted);
$('btn-mute').textContent = muted ? '🔇' : '🔊';
Sdk.track('load', {});
requestAnimationFrame(frame);
