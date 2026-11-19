// BOUNCY BALL RUN3D · 主入口：60Hz 固定步长 + 标题→玩法→结算 + i18n + SDK + 标准调试契约。
import { STEP } from '../config/game.config.js';
import { createRun, greedyDir } from './game/sim.js';
import { createRenderer } from './render/index.js';
import { ui } from './ui/ui.js';
import { i18n, t } from './core/i18n.js';
import { save } from './core/save.js';
import { createAudio } from './core/audio.js';
import Sdk from './core/sdk.js';

const canvas = document.getElementById('canvas');
const renderer = createRenderer(canvas);
const audio = createAudio();

let sim = createRun({ seed: 1 });
let phase = 'title'; // title | playing | paused | won | gameover
let accumulator = 0;
let lastTime = performance.now();
let muted = false;
let dragging = false;
let lastPX = 0;
let dragDeg = 0;
let tutorialFromStart = false;

const keys = { left: false, right: false };

// ---- 教程状态（契约：window.__ll.tutorial） ----
const tutorial = {
  active: false,
  step: 0,
  steps: ['tut1', 'tut2', 'tut3'],
  current: 'tut1',
  skip() { finishTutorial(); },
};

function renderTutorialStep() {
  const key = tutorial.steps[tutorial.step];
  ui.showTutorial(t(key + 'Title'), t(key + 'Text'));
  ui.setTutNext(t('tutNext'), tutorial.step >= tutorial.steps.length - 1);
}

function showTutorial() {
  tutorial.active = true;
  tutorial.step = 0;
  tutorial.current = tutorial.steps[0];
  renderTutorialStep();
}

function finishTutorial() {
  tutorial.active = false;
  ui.hideTutorial();
  save.set('tutorialSeen', true);
  if (tutorialFromStart) startRun();
}

function startRun(seed) {
  sim = createRun(seed == null ? { seed: (Date.now() & 0x7fffffff) } : { seed });
  phase = 'playing';
  accumulator = 0;
  ui.showGame();
  ui.updateHUD(sim);
  audio.unlock();
  audio.startBgm();
  Sdk.newRun({});
}

function restart() {
  phase = 'title';
  sim = createRun({ seed: (Date.now() & 0x7fffffff) });
  ui.showTitle();
  ui.updateBest(save.get('best', 0));
  audio.stopBgm();
}

function pause() {
  if (phase !== 'playing') return;
  phase = 'paused';
  ui.showPause();
  audio.stopBgm();
}

function resume() {
  if (phase !== 'paused') return;
  phase = 'playing';
  ui.showGame();
  audio.startBgm();
  lastTime = performance.now();
}

function endRun() {
  const won = sim.state.phase === 'won';
  const prevBest = save.get('best', 0);
  const isNewBest = sim.state.score > prevBest;
  if (isNewBest) save.set('best', sim.state.score);
  Sdk.gameOver({ score: sim.state.score, won });
  if (won) Sdk.levelCleared({ score: sim.state.score, stars: sim.state.stars });
  phase = won ? 'won' : 'gameover';
  ui.showResult(won, sim.state.score, Math.max(prevBest, sim.state.score), sim.state.stars, sim.state.gems, isNewBest);
  audio.stopBgm();
}

// ---- 事件 → 音频（渲染粒子由 renderer 直接消费同一批事件） ----
function handleEvents(events) {
  for (const e of events) audio.event(e.type, e.payload);
}

// ---- 输入 ----
window.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowLeft') keys.left = true;
  if (e.code === 'ArrowRight') keys.right = true;
  if (e.code === 'Escape') {
    if (phase === 'playing') pause();
    else if (phase === 'paused') resume();
  }
  if (e.code === 'KeyR' && phase !== 'title') restart();
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowLeft') keys.left = false;
  if (e.code === 'ArrowRight') keys.right = false;
});

canvas.addEventListener('pointerdown', (e) => {
  dragging = true;
  lastPX = e.clientX;
  try { canvas.setPointerCapture(e.pointerId); } catch { /* noop */ }
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastPX;
  lastPX = e.clientX;
  dragDeg += dx * TOWER.ROT_FACTOR;
});
canvas.addEventListener('pointerup', () => { dragging = false; });
canvas.addEventListener('pointercancel', () => { dragging = false; });

// ---- UI 按钮 ----
ui.btnStart.addEventListener('click', () => {
  const seen = save.get('tutorialSeen', false);
  if (seen) startRun();
  else { tutorialFromStart = true; showTutorial(); }
});
ui.btnResume.addEventListener('click', resume);
ui.btnRetry.addEventListener('click', () => startRun());
ui.btnRestart.addEventListener('click', restart);
ui.btnRestart2.addEventListener('click', restart);
ui.btnHome.addEventListener('click', restart);
ui.btnHome2.addEventListener('click', restart);
ui.btnHome3.addEventListener('click', restart);
ui.btnHowto.addEventListener('click', () => { tutorialFromStart = false; showTutorial(); });
ui.tutNext.addEventListener('click', () => {
  tutorial.step += 1;
  if (tutorial.step >= tutorial.steps.length) finishTutorial();
  else {
    tutorial.current = tutorial.steps[tutorial.step];
    renderTutorialStep();
  }
});
ui.tutSkip.addEventListener('click', () => finishTutorial());
ui.btnMute.addEventListener('click', () => {
  muted = audio.setMuted(!muted);
  ui.updateMuteLabel(muted);
});
for (const sel of ui.langSelects) {
  if (sel) sel.addEventListener('change', (e) => ui.setLang(e.target.value));
}

// ---- 主循环（60Hz 固定步长） ----
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  let events = [];
  if (phase === 'playing') {
    accumulator += dt;
    const input = { rotate: (keys.right ? 1 : 0) - (keys.left ? 1 : 0), dRot: dragDeg };
    dragDeg = 0;
    while (accumulator >= STEP) {
      sim.step(input);
      accumulator -= STEP;
    }
    events = sim.drainEvents();
    handleEvents(events);
    ui.updateHUD(sim);
    if (sim.state.phase !== 'playing') endRun();
  }

  renderer.render(sim, events);
}

// ---- 调试契约 ----
window.__ll = {
  get state() { return { phase, lang: i18n.lang, dir: i18n.dir }; },
  get run() { return sim; },
  start: () => startRun(),
  pause,
  resume,
  restart,
  startTutorial: () => { tutorialFromStart = false; showTutorial(); },
  tutorial,
  lang: () => i18n.lang,
  setLang: (l) => ui.setLang(l),
  save: () => Sdk,
  ui: () => ui,
  debug: {
    markSeen: () => save.set('tutorialSeen', true),
    state: () => sim.getHud(),
    seed: (n) => { startRun(n); },
    greedy: (n) => {
      for (let i = 0; i < n; i += 1) sim.step({ rotate: greedyDir(sim) });
      sim.drainEvents();
      ui.updateHUD(sim);
      if (sim.state.phase !== 'playing') endRun();
      return sim.getHud();
    },
    advance: (n, rotate = 0) => {
      for (let i = 0; i < n; i += 1) sim.step({ rotate });
      sim.drainEvents();
      ui.updateHUD(sim);
      if (sim.state.phase !== 'playing') endRun();
      return sim.getHud();
    },
    forceWin: () => {
      sim.state.phase = 'won';
      sim.state.stars = 3;
      sim.state.score = Math.max(sim.state.score, 30);
      endRun();
    },
    forceLose: () => {
      sim.state.phase = 'gameover';
      sim.state.stars = 1;
      endRun();
    },
  },
};

// ---- 启动 ----
Sdk.ready();
ui.applyLang();
ui.updateMuteLabel(muted);
ui.showTitle();
ui.updateBest(save.get('best', 0));
requestAnimationFrame(loop);
