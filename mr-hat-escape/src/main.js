// MR HAT ESCAPE · 主入口：60Hz 固定步长装配 sim / render / ui / audio / sdk + 标准调试契约。
import { STEP, WORLD, PLAYER } from '../config/game.config.js';
import { LEVEL_COUNT } from '../config/levels.js';
import { createRun } from './game/sim.js';
import { createRenderer } from './render/index.js';
import { ui } from './ui/ui.js';
import { i18n } from './core/i18n.js';
import { save } from './core/save.js';
import { createAudio } from './core/audio.js';
import { Sdk } from './core/sdk.js';

const canvas = ui.canvas;
const renderer = createRenderer(canvas);

const audio = createAudio();
let muted = !!save.get('muted', false);
audio.setMuted(muted);
ui.setMuteIcon(muted);

let phase = 'title'; // title | playing | paused | result
let run = null;
let levelIndex = 0;
let cameraX = 0;
let accumulator = 0;
let lastTime = performance.now();
let timeNow = 0;

const input = {
  left: false,
  right: false,
  jump: false,
  hold: false,
  pointerX: 0,
  pointerY: 0,
  pointerDown: false,
};

const tutorial = {
  active: false,
  step: 0,
  steps: ['move', 'jump', 'key', 'door'],
  current: 'move',
  skip() { finishTutorial(); },
};

// ---------------- 关卡 / 流程 ----------------

function loadLevel(idx) {
  levelIndex = Math.max(0, Math.min(LEVEL_COUNT - 1, idx));
  run = createRun(levelIndex, { seed: Date.now() % 100000 });
  input.left = input.right = input.jump = input.hold = input.pointerDown = false;
}

function start(levelIdx = 0) {
  loadLevel(levelIdx);
  phase = 'playing';
  ui.showGame();
  ui.setHoldVisible(run.state.special === 'pulley');
  Sdk.newRun({ level: run.state.level });
  ensureBgm();
}

function startFromTitle() {
  start(Math.min(save.get('passedCount', 0), LEVEL_COUNT - 1));
  if (!save.get('tutorialSeen', false)) beginTutorial();
}

function beginTutorial() {
  tutorial.active = true;
  tutorial.step = 0;
  tutorial.current = tutorial.steps[0];
  ui.showTutorialStep(0);
}

function finishTutorial() {
  tutorial.active = false;
  tutorial.step = 0;
  ui.hideTutorial();
  save.set('tutorialSeen', true);
}

function nextTutorialStep() {
  tutorial.step += 1;
  if (tutorial.step >= tutorial.steps.length) {
    finishTutorial();
  } else {
    tutorial.current = tutorial.steps[tutorial.step];
    ui.showTutorialStep(tutorial.step);
  }
}

function restartLevel() {
  loadLevel(levelIndex);
  phase = 'playing';
  ui.showGame();
  ui.setHoldVisible(run.state.special === 'pulley');
  Sdk.newRun({ level: run.state.level });
}

function pauseGame() {
  if (phase === 'playing') { phase = 'paused'; ui.showPause(); }
}

function resumeGame() {
  if (phase === 'paused') { phase = 'playing'; ui.hidePause(); lastTime = performance.now(); }
}

function goHome() {
  phase = 'title';
  ui.showTitle();
  ui.renderLevelGrid((i) => startFromTitleLevel(i), save.get('passedCount', 0));
}

function startFromTitleLevel(i) {
  loadLevel(i);
  phase = 'playing';
  ui.showGame();
  ui.setHoldVisible(run.state.special === 'pulley');
  Sdk.newRun({ level: run.state.level });
  ensureBgm();
}

function onLevelWon() {
  const s = run.state;
  const passed = save.get('passedCount', 0);
  if (s.level > passed) save.set('passedCount', s.level);
  const stars = save.get('stars', {});
  const prev = stars[s.levelIndex] || 0;
  if (s.starsCollected > prev) { stars[s.levelIndex] = s.starsCollected; save.set('stars', stars); }
  Sdk.levelCleared({ level: s.level, stars: s.starsCollected });
  phase = 'result';
  ui.showResult(true, {
    level: s.level,
    starsEarned: s.starsCollected,
    starsTotal: s.starsTotal,
    time: s.time,
    isLast: s.levelIndex >= LEVEL_COUNT - 1,
  });
}

function stepRun() {
  run.step(STEP, input);
  for (const e of run.drainEvents()) audio.event(e.type, e);
  if (run.state.phase === 'won') onLevelWon();
}

// ---------------- 音频 ----------------

function ensureBgm() {
  audio.unlock();
  audio.startBgm();
}

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  save.set('muted', muted);
  ui.setMuteIcon(muted);
  audio.event('ui');
}

// ---------------- 输入 ----------------

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyA' || e.code === 'ArrowLeft') input.left = true;
  if (e.code === 'KeyD' || e.code === 'ArrowRight') input.right = true;
  if (e.code === 'Space') { input.jump = true; e.preventDefault(); }
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyH') input.hold = true;
  if (e.code === 'KeyR' && phase === 'playing') { restartLevel(); }
  if (e.code === 'KeyM') toggleMute();
  if (e.code === 'Escape') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'KeyA' || e.code === 'ArrowLeft') input.left = false;
  if (e.code === 'KeyD' || e.code === 'ArrowRight') input.right = false;
  if (e.code === 'Space') input.jump = false;
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyH') input.hold = false;
});

function setPointerFromEvent(e) {
  const rect = canvas.getBoundingClientRect();
  const sx = (e.clientX - rect.left) / rect.width * WORLD.WIDTH;
  const sy = (e.clientY - rect.top) / rect.height * WORLD.HEIGHT;
  input.pointerX = sx + cameraX;
  input.pointerY = sy;
}

canvas.addEventListener('pointerdown', (e) => { setPointerFromEvent(e); input.pointerDown = true; canvas.setPointerCapture?.(e.pointerId); });
canvas.addEventListener('pointermove', (e) => { setPointerFromEvent(e); });
canvas.addEventListener('pointerup', () => { input.pointerDown = false; });
canvas.addEventListener('pointercancel', () => { input.pointerDown = false; });

function bindTouch(btn, key) {
  if (!btn) return;
  btn.addEventListener('pointerdown', (e) => { e.preventDefault(); input[key] = true; });
  btn.addEventListener('pointerup', () => { input[key] = false; });
  btn.addEventListener('pointerleave', () => { input[key] = false; });
  btn.addEventListener('pointercancel', () => { input[key] = false; });
}
bindTouch(ui.btnLeft, 'left');
bindTouch(ui.btnRight, 'right');
bindTouch(ui.btnJump, 'jump');
bindTouch(ui.btnHold, 'hold');
bindTouch(ui.btnHold2, 'hold');

// ---------------- UI 绑定 ----------------

ui.btnStart.addEventListener('click', startFromTitle);
ui.btnResume.addEventListener('click', resumeGame);
ui.btnRestart.addEventListener('click', restartLevel);
ui.btnRestart2.addEventListener('click', () => { resumeGame(); restartLevel(); });
ui.btnHome.addEventListener('click', goHome);
ui.btnHome2.addEventListener('click', goHome);
ui.btnHome3.addEventListener('click', goHome);
ui.btnRetry.addEventListener('click', restartLevel);
ui.btnNext.addEventListener('click', () => start(levelIndex + 1));
ui.btnMute.addEventListener('click', toggleMute);
ui.btnHowto.addEventListener('click', beginTutorial);
ui.btnTutReplay.addEventListener('click', beginTutorial);
ui.tutNext.addEventListener('click', nextTutorialStep);
ui.tutSkip.addEventListener('click', () => finishTutorial());

for (const sel of ui.langSelects) {
  if (sel) sel.addEventListener('change', (e) => ui.setLang(e.target.value));
}

// ---------------- 渲染 ----------------

function updateCamera() {
  if (!run) { cameraX = 0; return; }
  const cx = run.state.player.x + PLAYER.W / 2;
  const maxCam = Math.max(0, run.state.width - WORLD.WIDTH);
  cameraX = Math.max(0, Math.min(maxCam, cx - WORLD.WIDTH / 2));
}

function render() {
  if (phase === 'title') {
    renderer.renderTitle(timeNow);
    return;
  }
  if (!run) { renderer.render(null); return; }
  updateCamera();
  renderer.render(run, { cameraX, time: timeNow });
  if (phase === 'playing' || phase === 'paused') ui.updateHUD(run.state);
}

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  timeNow += dt;

  if (phase === 'playing' && !tutorial.active) {
    accumulator += dt;
    while (accumulator >= STEP) {
      stepRun();
      accumulator -= STEP;
      if (phase !== 'playing') break;
    }
  }
  render();
}

// ---------------- 调试契约 ----------------

const debug = {
  state() {
    if (!run) return null;
    const s = run.state;
    return {
      phase,
      level: s.level,
      levelIndex: s.levelIndex,
      width: s.width,
      key: !!s.key,
      keyCollected: s.keyCollected,
      doorOpen: s.doorOpen,
      starsTotal: s.starsTotal,
      starsCollected: s.starsCollected,
      spikes: s.spikes.length,
      blades: s.blades.length,
      crates: s.crates.length,
      draggables: s.draggables.length,
      player: { x: s.player.x, y: s.player.y },
    };
  },
  loadLevel(i) { start(i); },
  collectKey() {
    if (!run) return;
    run.state.keyCollected = true;
    run.state.doorOpen = true;
  },
  reachDoor() {
    if (!run) return;
    run.state.doorOpen = true;
    run.state.player.x = run.state.door.x - PLAYER.W - 4;
    run.state.player.y = run.state.door.y;
  },
  teleport(x, y = 576) {
    if (!run) return;
    run.state.player.x = x;
    run.state.player.y = y;
    run.state.player.vx = 0;
    run.state.player.vy = 0;
  },
  forceWin() {
    if (!run) return;
    run.state.phase = 'won';
    onLevelWon();
  },
  resetRun() { restartLevel(); },
};

window.G = { run: () => run, state: () => phase, ui, save, debug, createRun };

window.__ll = {
  get state() { return { phase, lang: ui.lang, dir: ui.dir }; },
  lang: () => ui.lang,
  setLang: (l) => ui.setLang(l),
  get run() { return run; },
  start,
  pause: pauseGame,
  resume: resumeGame,
  restart: restartLevel,
  startTutorial() { start(0); beginTutorial(); },
  tutorial,
  save: () => save,
  ui: () => ui,
  debug,
};

// ---------------- 启动 ----------------

Sdk.ready().catch(() => {});
ui.applyLang();
ui.renderLevelGrid((i) => startFromTitleLevel(i), save.get('passedCount', 0));
goHome();
requestAnimationFrame(loop);
