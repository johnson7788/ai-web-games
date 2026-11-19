// SPIN CYCLE ORBIT · 主入口：60Hz 固定步长 + 标题/游戏/暂停/结算 + 教程引导 + SDK 统一出口
// 契约：window.__ll = { state:{phase,lang}, start, pause, resume, restart, run, tutorial, startTutorial }
// 装配：sim / render+ui / audio / sdk。

import { STEP } from '../config/game.config.js';
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
let tutorialStep = -1;     // -1 = 未激活

const prefersReduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const view = {
  time: 0,
  reduced: prefersReduced,
};

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let best = Sdk.load('best', 0) | 0;
let tutorialDone = !!Sdk.load('tutorialDone', false);

Sdk.ready(); // 不阻塞首屏
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
  run = createRun((Date.now() % 2147483647) || 1);
  setPhase('playing');
  ui.showGame();
  ui.updateBest(best);
  ui.updateHud(run.getHud());
  audio.unlock();
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

function retryGame() {
  run = createRun((Date.now() % 2147483647) || 1);
  setPhase('playing');
  ui.showGame();
  ui.updateBest(best);
  ui.updateHud(run.getHud());
  audio.startBgm();
  Sdk.newRun({});
}

function goHome() {
  run = null;
  setPhase('title');
  ui.showTitle();
  ui.updateBest(best);
  audio.stopBgm();
}

// ---------- 结算 ----------
function finishRun(ev) {
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  const st = run.state;
  const isNew = st.score > best;
  if (isNew) best = st.score;
  persist();
  Sdk.gameOver({ score: st.score, level: st.level, reason: st.overReason });
  ui.showResult();
  ui.updateBest(best);
  if ($('result-title')) $('result-title').textContent = t('resultTitle');
  if ($('result-new')) $('result-new').style.display = isNew ? '' : 'none';
  if ($('result-score')) $('result-score').textContent = t('resultScore') + ' ' + st.score;
  if ($('result-best')) $('result-best').textContent = t('resultBest') + ' ' + best;
  if ($('result-combo')) $('result-combo').textContent = t('resultCombo') + ' ×' + Math.min(st.maxCombo, 8);
  if ($('result-level')) $('result-level').textContent = t('resultLevel') + ' ' + st.level;
}

// ---------- 教程（首次自动弹，可跳过，完成/跳过后持久化） ----------
const TUT_STEPS = () => [
  { id: 'hop', text: t('tutStep1') },
  { id: 'timing', text: t('tutStep2') },
  { id: 'combo', text: t('tutStep3') },
];

function startTutorial() {
  tutorialStep = 0;
  renderTutorialStep();
}

function renderTutorialStep() {
  const el = $('tutorial');
  if (!el) return;
  if (tutorialStep < 0) {
    el.classList.add('hidden');
    return;
  }
  const steps = TUT_STEPS();
  const s = steps[tutorialStep];
  el.classList.remove('hidden');
  if ($('tut-title')) $('tut-title').textContent = t('tutTitle');
  if ($('tut-text')) $('tut-text').textContent = s ? s.text : '';
  if ($('tut-skip')) $('tut-skip').textContent = t('tutSkip');
  if ($('tut-next')) $('tut-next').textContent = t('tutNext');
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
    if (ev.type === 'lose') {
      finishRun(ev);
      return;
    }
  }
}

// ---------- 输入 ----------
function tap() {
  audio.unlock();
  if (!run || phase !== 'playing') return;
  run.tap();
  handleEvents(run.drainEvents());
}

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  tap();
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'Enter') {
    if (phase === 'playing') { e.preventDefault(); tap(); }
    else if (phase === 'title') { startGame(); }
    else if (phase === 'result') { retryGame(); }
    else if (phase === 'paused') { resumeGame(); }
  }
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
  if (e.code === 'KeyR') {
    if (phase === 'playing' || phase === 'paused' || phase === 'result') retryGame();
  }
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
  on('btn-start', startGame);
  on('btn-resume', resumeGame);
  on('btn-restart', retryGame);
  on('btn-restart2', retryGame);
  on('btn-retry', retryGame);
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-help', startTutorial);
  on('btn-howto', startTutorial);
  on('btn-howto2', startTutorial);
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
      if (run) ui.updateHud(run.getHud());
      if (phase === 'title') ui.updateBest(best);
    });
  }
}

// ---------- 主循环 ----------
function frame(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;
  view.time = now / 1000;

  if (phase === 'playing' && run) {
    accumulator += dt;
    while (accumulator >= STEP) {
      run.step();
      accumulator -= STEP;
    }
    handleEvents(run.drainEvents());
    if (run && phase === 'playing') ui.updateHud(run.getHud());
  }

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
  sim: () => (run ? run.state : null),
  start: () => startGame(),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => goHome(),
  retry: () => retryGame(),
  home: () => goHome(),
  save: () => Sdk,
  ui: () => ui,
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return TUT_STEPS().map((s) => s.id); },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
  },
  startTutorial: () => startTutorial(),
  endTutorial: () => endTutorial(),
  debug: {
    state: () => (run ? run.state : null),
    tap: () => tap(),
    nextDistance: () => (run ? run.nextDistance() : null),
    startSeeded: (seed) => {
      run = createRun(seed | 0 || 1);
      setPhase('playing');
      ui.showGame();
      ui.updateBest(best);
      ui.updateHud(run.getHud());
      return true;
    },
    step: (n = 1) => {
      if (!run) return 0;
      for (let i = 0; i < n; i += 1) {
        run.step();
        handleEvents(run.drainEvents());
      }
      if (run && phase === 'playing') ui.updateHud(run.getHud());
      return run.state.time;
    },
    forceCapture: (n = 1) => {
      if (!run) return 0;
      for (let i = 0; i < n; i += 1) {
        if (run.state.phase !== 'playing') break;
        run.state.orbiter.x = run.state.nodes[1].x;
        run.state.orbiter.y = run.state.nodes[1].y;
        run.tap();
        handleEvents(run.drainEvents());
      }
      // 快照相机到新锚点，保证截图主体在画面内
      run.state.camX = run.state.anchor.x;
      run.state.camY = run.state.anchor.y;
      if (run && phase === 'playing') ui.updateHud(run.getHud());
      return run.state.captures;
    },
    gameOver: () => {
      if (!run || run.state.phase !== 'playing') return false;
      const n = run.state.nodes[1];
      const dx = n.x - run.state.anchor.x;
      const dy = n.y - run.state.anchor.y;
      const len = Math.hypot(dx, dy) || 1;
      run.state.orbiter.x = run.state.anchor.x - (dx / len) * 120;
      run.state.orbiter.y = run.state.anchor.y - (dy / len) * 120;
      run.tap(); // 已保证远离下一节点 → miss 判负
      handleEvents(run.drainEvents());
      return run.state.phase === 'over';
    },
  },
};

// ---------- 启动 ----------
bind();
syncDocumentLang();
ui.applyLang();
ui.showTitle();
ui.updateBest(best);
$('btn-mute')?.classList.toggle('is-muted', muted);
Sdk.track('load', {});
requestAnimationFrame(frame);
