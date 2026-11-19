// ARCHER MISS 3D · 主入口：60Hz 固定步长装配 sim/render/ui/audio/sdk + 标准调试契约
import { STEP } from '../config/game.config.js';
import { createRun } from './game/sim.js';
import { createRenderer } from './render/index.js';
import { ui } from './ui/ui.js';
import { i18n, t } from './core/i18n.js';
import { save } from './core/save.js';
import Sdk from './core/sdk.js';
import { createAudio } from './core/audio.js';

const canvas = document.getElementById('canvas');
const renderer = createRenderer(canvas);
const audio = createAudio();

Sdk.ready(); // 不 await，不阻塞首屏

const reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

let run = createRun({ seed: (Date.now() ^ 0x9e3779b9) >>> 0 });
let lastTime = 0;
let accumulator = 0;
const keys = new Set();

// ---- 输入状态（键盘 + 摇杆） ----
let joyVec = { x: 0, y: 0 };

function currentMoveDir() {
  let dx = 0; let dy = 0;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) dx -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) dx += 1;
  if (keys.has('KeyW') || keys.has('ArrowUp')) dy -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) dy += 1;
  if (joyVec.x || joyVec.y) { dx = joyVec.x; dy = joyVec.y; }
  return { dx, dy };
}

function inputStep() {
  const { dx, dy } = currentMoveDir();
  run.setMove(dx, dy);
}

// ---- 教程 ----
const tutorial = {
  active: false,
  step: 0,
  steps: ['tut1', 'tut2', 'tut3', 'tut4'],
  get current() { return t(this.steps[this.step]); },
  start() {
    this.active = true;
    this.step = 0;
    ui.tutTitle.textContent = t('tutorialTitle');
    ui.setTutorialStep(this.current);
    ui.tutNext.textContent = this.step >= this.steps.length - 1 ? t('tutorialDone') : t('tutorialNext');
    ui.showTutorial();
  },
  next() {
    this.step += 1;
    if (this.step >= this.steps.length) { this.skip(); return; }
    ui.setTutorialStep(this.current);
    ui.tutNext.textContent = this.step >= this.steps.length - 1 ? t('tutorialDone') : t('tutorialNext');
  },
  skip() {
    this.active = false;
    ui.hideTutorial();
    save.set('tutorialSeen', true);
  },
};

// ---- 流程控制 ----
function startGame(level = 0) {
  run = createRun({ seed: (Date.now() ^ 0x9e3779b9) >>> 0 });
  run.start(level);
  ui.showGame();
  audio.unlock();
  audio.startBgm();
  Sdk.newRun({ level: level + 1 });
  if (!save.get('tutorialSeen', false)) tutorial.start();
  else tutorial.active = false;
}

function pauseGame() {
  if (run.state.phase === 'playing') { run.pause(); ui.showPause(); audio.stopBgm(); }
}

function resumeGame() {
  if (run.state.phase === 'paused') { run.resume(); ui.hidePause(); audio.startBgm(); lastTime = performance.now(); }
}

function restartToTitle() {
  run = createRun({ seed: (Date.now() ^ 0x9e3779b9) >>> 0 });
  run.state.phase = 'title';
  tutorial.active = false;
  ui.hideTutorial();
  audio.stopBgm();
  ui.showTitle(save.totalStars());
}

function restartRun() {
  const lvl = run.state.level;
  run = createRun({ seed: (Date.now() ^ 0x9e3779b9) >>> 0 });
  run.start(lvl);
  ui.showGame();
  tutorial.active = false;
  ui.hideTutorial();
  audio.startBgm();
}

function onWin() {
  const score = run.state.score;
  save.setBest(score);
  save.addStars(run.state.stars);
  Sdk.levelCleared({ level: run.state.level + 1, score });
  audio.stopBgm();
  ui.showResult({ won: true, stars: run.state.stars, score, best: save.best() });
}

function onLose() {
  const score = run.state.score;
  save.setBest(score);
  Sdk.gameOver({ level: run.state.level + 1, score });
  audio.stopBgm();
  ui.showResult({ won: false, stars: 0, score, best: save.best() });
}

function handleEvent(e) {
  audio.event(e.type, e);
  if (e.type === 'levelClear') {
    ui.showUpgrade(run.state.pendingUpgrade, (id) => { run.chooseUpgrade(id); ui.hideUpgrade(); });
  } else if (e.type === 'win') onWin();
  else if (e.type === 'lose') onLose();
}

// ---- 输入绑定 ----
window.addEventListener('keydown', (e) => {
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  keys.add(e.code);
  audio.unlock();
  if (e.code === 'KeyR') { restartRun(); return; }
  if (e.code === 'Escape') {
    if (run.state.phase === 'playing') pauseGame();
    else if (run.state.phase === 'paused') resumeGame();
  }
  if (e.code === 'Enter' && run.state.phase === 'result') startGame(0);
});
window.addEventListener('keyup', (e) => { keys.delete(e.code); });

function setupJoy() {
  const joy = ui.joy;
  const knob = ui.joyKnob;
  let activePointer = null;
  const R = 50;
  const setVec = (cx, cy) => {
    const rect = joy.getBoundingClientRect();
    const ox = cx - (rect.left + rect.width / 2);
    const oy = cy - (rect.top + rect.height / 2);
    const len = Math.hypot(ox, oy);
    const cl = Math.min(len, R);
    const nx = len ? ox / len : 0; const ny = len ? oy / len : 0;
    joyVec = { x: nx, y: ny };
    knob.style.transform = `translate(${nx * cl}px, ${ny * cl}px)`;
    audio.unlock();
  };
  const reset = () => { joyVec = { x: 0, y: 0 }; knob.style.transform = 'translate(0px, 0px)'; };
  joy.addEventListener('pointerdown', (e) => { activePointer = e.pointerId; joy.setPointerCapture(e.pointerId); setVec(e.clientX, e.clientY); });
  joy.addEventListener('pointermove', (e) => { if (e.pointerId === activePointer) setVec(e.clientX, e.clientY); });
  joy.addEventListener('pointerup', (e) => { if (e.pointerId === activePointer) { activePointer = null; reset(); } });
  joy.addEventListener('pointercancel', reset);
}

// ---- UI 按钮 ----
ui.btnStart.addEventListener('click', () => { audio.unlock(); startGame(0); });
ui.btnResume.addEventListener('click', resumeGame);
ui.btnRestart = document.getElementById('btn-restart');
ui.btnRestart.addEventListener('click', restartRun);
document.getElementById('btn-restart2').addEventListener('click', restartRun);
document.getElementById('btn-home').addEventListener('click', restartToTitle);
document.getElementById('btn-home2').addEventListener('click', restartToTitle);
document.getElementById('btn-home3').addEventListener('click', restartToTitle);
document.getElementById('btn-retry').addEventListener('click', () => startGame(0));
document.getElementById('btn-next').addEventListener('click', () => startGame(0));
ui.btnMute.addEventListener('click', () => { ui.muted = !ui.muted; audio.setMuted(ui.muted); ui.renderMuteBtn(); });
ui.tutNext.addEventListener('click', () => tutorial.next());
document.getElementById('tut-skip').addEventListener('click', () => tutorial.skip());
document.getElementById('btn-help').addEventListener('click', () => tutorial.start());
for (const btn of document.querySelectorAll('[data-tutorial-replay]')) {
  btn.addEventListener('click', () => tutorial.start());
}
for (const sel of ui.langSelects) {
  if (sel) sel.addEventListener('change', (e) => ui.setLang(e.target.value));
}
setupJoy();

// ---- 主循环 ----
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  if (run.state.phase === 'playing' && run.state.sub !== 'upgrade') {
    accumulator += dt;
    while (accumulator >= STEP) {
      if (run.state.phase !== 'playing' || run.state.sub === 'upgrade') break;
      inputStep();
      run.step(STEP);
      accumulator -= STEP;
      const evs = run.drainEvents();
      for (const e of evs) handleEvent(e);
      if (run.state.phase !== 'playing') break;
    }
    ui.updateHUD(run.getHud());
  }

  const timeForRender = reducedMotion ? 0 : now / 1000;
  if (run.state.phase === 'title' || run.state.phase === 'result') {
    renderer.render(run.state.phase === 'title' ? null : run.state, timeForRender);
  } else {
    renderer.render(run.state, timeForRender);
  }
}

// ---- 标准调试契约 ----
window.G = { get sim() { return run; }, state: () => run.state, ui, save };
window.__ll = {
  get state() { return { phase: run.state.phase, lang: ui.lang, dir: ui.dir }; },
  lang: () => ui.lang,
  setLang: (lang) => ui.setLang(lang),
  get run() { return run; },
  start: (level) => startGame(level == null ? 0 : level),
  startAct: (level) => startGame(level == null ? 0 : level),
  pause: pauseGame,
  resume: resumeGame,
  restart: restartToTitle,
  tutorial,
  startTutorial: () => tutorial.start(),
  save: () => save,
  ui: () => ui,
  debug: {
    state: () => run.state,
    setMove: (dx, dy) => run.setMove(dx, dy),
    fastForward: (sec = 5) => { for (let i = 0; i < Math.floor(sec * 60); i += 1) { run.step(1 / 60); const evs = run.drainEvents(); for (const e of evs) handleEvent(e); } },
    forceWin: () => { run.forceKillAll(); for (let i = 0; i < 200 && run.state.sub === 'upgrade'; i += 1) { run.chooseUpgrade(run.state.pendingUpgrade[0]); run.forceKillAll(); } const evs = run.drainEvents(); for (const e of evs) handleEvent(e); },
  },
};

// ---- 初始化 ----
ui.applyLang();
ui.showTitle(save.totalStars());
renderer.render(null, 0);
requestAnimationFrame((now) => { lastTime = now; requestAnimationFrame(loop); });
