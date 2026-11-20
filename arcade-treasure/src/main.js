// src/main.js — 装配：固定步长 / 输入 / 事件分发 / 状态机 / SDK / 音频。
import { STEP, WORLD } from '../config/game.config.js';
import { createRun } from './game/sim.js';
import { createRender } from './render/index.js';
import { createUI } from './ui/index.js';
import { createAudio } from './core/audio.js';
import { i18n } from './core/i18n.js';
import Sdk from './core/sdk.js';

const canvas = document.getElementById('canvas');
const uiRoot = document.getElementById('ui-root');
const loadingEl = document.getElementById('loading');

const renderer = createRender(canvas);
const audio = createAudio();

let state = 'boot';             // boot | title | hall | playing | paused | result | gameover | grandprix
let run = null;
let lastTime = 0;
let accumulator = 0;
let prevPhase = null;
let bestRank = 1;

// 输入（边沿归 main；held 持续）
const input = { pick: null, continue: false, pity: false, tapX: null, tapY: null, steerX: null, move: 0, fire: false };
const keys = { left: false, right: false };
let pointerX = null;
let steerMoved = false;

function canvasToWorldX(clientX) {
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(rect.width / WORLD.WIDTH, rect.height / WORLD.HEIGHT);
  const ox = (rect.width - WORLD.WIDTH * scale) / 2;
  return (clientX - rect.left - ox) / scale;
}
function canvasToWorldY(clientY) {
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(rect.width / WORLD.WIDTH, rect.height / WORLD.HEIGHT);
  const oy = (rect.height - WORLD.HEIGHT * scale) / 2;
  return (clientY - rect.top - oy) / scale;
}

function updateMoveFromKeys() {
  if (keys.left && keys.right) input.move = 0;
  else if (keys.left) input.move = -1;
  else if (keys.right) input.move = 1;
  else input.move = 0;
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;
  if (e.code === 'Space') { input.fire = true; e.preventDefault(); }
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'Enter' && state === 'title') startGame();
  if (e.code === 'KeyR' && (state === 'gameover' || state === 'grandprix')) toTitle();
  updateMoveFromKeys();
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
  if (e.code === 'Space') input.fire = false;
  updateMoveFromKeys();
});

// 指针：rain/swarm 用位置；mole 用点按；swarm 点按开火。
canvas.addEventListener('pointermove', (e) => {
  pointerX = canvasToWorldX(e.clientX);
  if (state === 'playing' && run) {
    if (run.machine === 1) { input.steerX = pointerX; steerMoved = true; }
    else if (run.machine === 2) { input.steerX = pointerX; steerMoved = true; }
  }
});
canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  pointerX = canvasToWorldX(e.clientX);
  if (state === 'playing' && run) {
    if (run.machine === 0) { input.tapX = pointerX; input.tapY = canvasToWorldY(e.clientY); }
    else if (run.machine === 1) { input.steerX = pointerX; steerMoved = true; }
    else if (run.machine === 2) { input.steerX = pointerX; input.fire = true; steerMoved = true; }
  }
});
canvas.addEventListener('pointerleave', () => { pointerX = null; });

// ---------- UI ----------
const ui = createUI(uiRoot, {
  onStart: () => startGame(),
  onResume: () => resumeGame(),
  onRestart: () => toTitle(),
  onContinue: () => { input.continue = true; },
  onPity: () => { input.pity = true; },
  onPick: (i) => { if (state === 'hall') input.pick = i; },
});
ui.onTutorial((result) => {
  Sdk.track('tutorial_done', { skipped: !!result?.skipped });
});
ui.setBest(bestRank);

function applyAudioSettings() {
  audio.setMuted(!!Sdk.load('muted', false));
  audio.setVolume(Sdk.load('volume', 0.8));
}

// ---------- 游戏流转 ----------
function startGame() {
  audio.unlock();
  run = createRun({ seed: (Date.now() & 0xffff) * 2654435761 >>> 0 });
  state = 'hall';
  prevPhase = 'hall';
  resetInput();
  accumulator = 0;
  lastTime = performance.now();
  ui.show('hall');
  Sdk.newRun({ zone: 1 });
  applyAudioSettings();
}

function resetInput() {
  input.pick = null; input.continue = false; input.pity = false;
  input.tapX = null; input.tapY = null; input.fire = false; input.move = 0;
}

function togglePause() {
  if (state === 'playing' || state === 'hall') { state = 'paused'; ui.show('paused'); }
  else if (state === 'paused') { resumeGame(); }
}
function resumeGame() {
  if (state === 'paused') {
    state = (run && run.phase === 'playing') ? 'playing' : 'hall';
    ui.show(state);
    lastTime = performance.now();
  }
}

function toTitle() {
  state = 'title';
  run = null;
  prevPhase = null;
  resetInput();
  ui.show('title');
  renderer.draw(null, 1);
}

// ---------- run 相位 → UI 状态同步 ----------
function syncPhase() {
  if (!run) return;
  const ph = run.phase;
  if (ph === prevPhase) return;
  prevPhase = ph;

  if (ph === 'hall') {
    state = 'hall';
    resetInput();
    ui.show('hall');
  } else if (ph === 'playing') {
    state = 'playing';
    resetInput();
    ui.show('playing');
  } else if (ph === 'result') {
    state = 'result';
    resetInput();
    ui.show('result', { ...run.result, rank: run.rank });
    persistProgress();
  } else if (ph === 'gameover') {
    state = 'gameover';
    resetInput();
    ui.show('gameover');
    Sdk.gameOver({ rank: run.rank, tokens: run.tokens });
  } else if (ph === 'grandprix') {
    state = 'grandprix';
    resetInput();
    ui.show('grandprix');
    Sdk.levelCleared({ rank: run.rank });
    persistProgress();
  }
}

function persistProgress() {
  if (!run) return;
  if (run.rank > bestRank) {
    bestRank = run.rank;
    Sdk.save('bestRank', bestRank);
    ui.setBest(bestRank);
  }
}

// ---------- 事件分发 ----------
function dispatchEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);

    if (ev.type === 'hit') renderer.burst(ev.x, ev.y, 'hit');
    else if (ev.type === 'badHit') renderer.burst(ev.x, ev.y, 'bad');
    else if (ev.type === 'cleared' || ev.type === 'rankUp' || ev.type === 'grandPrix') renderer.burst(WORLD.WIDTH / 2, 300, 'hit');

    if (state === 'playing' || state === 'hall') ui.tutorial.onGameEvent(ev);

    if (ev.type === 'machinePick') Sdk.track('machinePick', { machine: ev.machine });
    else if (ev.type === 'rankUp') Sdk.track('rankUp', { rank: ev.rank });
    else if (ev.type === 'grandPrix') Sdk.track('grandPrix', { rank: ev.rank });
  }
}

// ---------- 主循环 ----------
function loop(now) {
  requestAnimationFrame(loop);

  const active = state === 'hall' || state === 'playing' || state === 'result';
  if (!active) {
    renderer.draw(state === 'paused' ? run : null, 1);
    return;
  }

  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  accumulator += dt;

  let steps = 0;
  while (accumulator >= STEP && steps < 6) {
    if (state === 'hall') {
      // hall：机台选择（pick）/ 打烊（pity）
    } else if (state === 'playing') {
      // playing：键盘 move 已更新；steerX 由指针维护
    } else if (state === 'result') {
      // result：等待 continue
    }
    run.step(input);
    accumulator -= STEP;
    steps++;

    // 边沿输入消费后清零
    input.pick = null;
    input.continue = false;
    input.pity = false;
    input.tapX = null;
    input.tapY = null;
    input.fire = false;

    if (steerMoved) {
      ui.tutorial.onGameEvent({ type: 'steer' });
      steerMoved = false;
    }

    dispatchEvents(run.drainEvents());
    syncPhase();
    if (state !== 'hall' && state !== 'playing' && state !== 'result') { accumulator = 0; break; }
  }

  const hud = run.getHud();
  renderer.draw(run, accumulator / STEP);
  ui.setHud(hud);
  ui.tutorial.tick();
}

// ---------- 失焦自动暂停 ----------
document.addEventListener('visibilitychange', () => {
  if (document.hidden && (state === 'playing' || state === 'hall')) togglePause();
});

// ---------- 广告期间静音 ----------
Sdk.onAdStart(() => audio.setMuted(true));
Sdk.onAdEnd(() => { audio.setMuted(!!Sdk.load('muted', false)); });

// ---------- 启动 ----------
(async () => {
  bestRank = Math.floor(Sdk.load('bestRank', 1)) || 1;
  ui.setBest(bestRank);
  applyAudioSettings();
  await Sdk.ready();
  Sdk.track('load', { lang: i18n.lang });
  // boot 竞态守卫：只在还没开局时才显示标题
  if (state === 'boot') { state = 'title'; ui.show('title'); }
  renderer.draw(null, 1);
  loadingEl.classList.add('hidden');
  lastTime = performance.now();
  requestAnimationFrame(loop);
})();

// ---------- 标准调试契约 ----------
window.G = {
  get run() { return run; },
  ui, renderer, audio, Sdk,
  get state() { return state; },
};

window.__ll = {
  get state() { return { phase: state, lang: i18n.lang, dir: i18n.dir }; },
  lang: () => i18n.lang,
  setLang: (l) => { i18n.setLang(l); ui.applyLang(); },
  get run() { return run; },
  start: startGame,
  pause: togglePause,
  resume: resumeGame,
  restart: toTitle,
  tutorial: {
    get active() { return ui.tutorial.active; },
    get step() { return ui.tutorial.step; },
    get steps() { return ui.tutorial.steps; },
    get current() { return ui.tutorial.current; },
    skip: () => ui.tutorial.skip(),
  },
  save: () => Sdk.save,
  ui: () => ui,
  debug: { layout: () => ({ viewport: [canvas.clientWidth, canvas.clientHeight], cabs: [0, 1, 2] }) },
};
