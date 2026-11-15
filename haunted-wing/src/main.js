// src/main.js — 装配：60Hz 固定步长 + 状态机 + 事件分发 + SDK 漏斗 + 标准调试口。
import { STEP, CONFIG, PLAYER } from '../config/game.config.js';
import { createSim, updateSim, drainEvents, getHud, ratingFor } from './game/sim.js';
import { createRenderer } from './render/index.js';
import { ui } from './ui/ui.js';
import { save } from './core/save.js';
import { Sdk } from './core/sdk.js';
import { createAudio } from './core/audio.js';
import { Input } from './core/base3d.js';

const canvas = document.getElementById('canvas');
const renderer = createRenderer(canvas);
const audio = createAudio();
const input = new Input(canvas);
const $ = (id) => document.getElementById(id);
const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

let state = 'title'; // title | playing | paused | results
let run = createSim({ seed: (Math.random() * 1e9) | 0 });
let lastTime = 0, accumulator = 0, pitch = 0, ended = false;
let touchFlash = false, touchInteract = false, touchSprint = false;
const MOUSE_SENS = 0.0024;

// 指针锁定（桌面：点画布锁定视角）
canvas.addEventListener('click', () => { if (state === 'playing' && !isTouch) input.requestLock(); });
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') {
    if (state === 'playing') pauseGame();
    else if (state === 'paused') resumeGame();
  }
  if (e.code === 'KeyR' && state === 'results') startRun();
  if (['Space'].includes(e.code)) e.preventDefault();
});
window.addEventListener('blur', () => { if (state === 'playing') pauseGame(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'playing') pauseGame(); });

// 触屏按钮（flash/interact = 边沿，sprint = 按住）
function bindTap(id, fn) {
  const elm = $(id);
  elm.addEventListener('pointerdown', (e) => { e.preventDefault(); fn(); });
}
if (isTouch) {
  $('touch').classList.remove('hidden');
  bindTap('btn-touch-flash', () => { touchFlash = true; });
  bindTap('btn-touch-interact', () => { touchInteract = true; });
  bindTap('btn-touch-sprint', () => { touchSprint = !touchSprint; });
}

// 每逻辑帧读输入（边沿归 main，held 归 Input）
function readInput() {
  if (window.__AUTO) {
    const a = window.__AUTO;
    const inp = {
      forward: a.forward ?? 0, strafe: a.strafe ?? 0, turn: a.turn ?? 0,
      flashlight: !!a.flashlight, interact: !!a.interact, lever: a.lever ?? 0,
      sprint: !!a.sprint, crouch: !!a.crouch,
    };
    a.flashlight = false; a.interact = false; a.lever = 0;
    return inp;
  }
  const turn = -(input.mouseDX + input.touchLook.x * 3) * MOUSE_SENS;
  pitch -= (input.mouseDY + input.touchLook.y * 3) * MOUSE_SENS;
  pitch = Math.max(-1.45, Math.min(1.45, pitch));
  const f = input.axis('KeyS', 'KeyW') + -input.touchMove.y;
  const s = input.axis('KeyA', 'KeyD') + input.touchMove.x;
  const len = Math.hypot(f, s);
  const forward = len > 1 ? f / len : f;
  const strafe = len > 1 ? s / len : s;
  const flash = input.hit('KeyF') || touchFlash;
  const interact = input.hit('KeyE') || touchInteract;
  touchFlash = false; touchInteract = false;
  return {
    forward, strafe, turn,
    flashlight: flash,
    interact,
    lever: input.hit('Digit1') ? 1 : input.hit('Digit2') ? 2 : input.hit('Digit3') ? 3 : 0,
    sprint: input.down('ShiftLeft') || input.down('ShiftRight') || touchSprint,
    crouch: input.down('KeyC'),
  };
}

// ---------------------------------------------------------------- 流程
function startRun() {
  run = createSim({ seed: (Math.random() * 1e9) | 0 });
  run.player.flashlight = true; // 出生点亮手电，保证画面有可读剪影（玩家存在感）
  ended = false;
  state = 'playing';
  ui.showGame();
  audio.unlock();
  Sdk.newRun();
  if (!save.get('tutDone', false)) ui.tutorial.start();
  lastTime = performance.now();
  accumulator = 0;
}

function pauseGame() {
  if (state !== 'playing') return;
  state = 'paused';
  ui.showPause();
  audio.stopAll();
}
function resumeGame() {
  if (state !== 'paused') return;
  state = 'playing';
  ui.hidePause();
  audio.resume();
  lastTime = performance.now();
}
function toMenu() {
  state = 'title';
  ui.showTitle();
  audio.stopAll();
}

function endRun() {
  ended = true;
  state = 'results';
  const win = run.phase === 'won';
  const rating = ratingFor(run.time, run.player.lives);
  const best = save.get('best', null);
  const isRecord = win && (best == null || run.time < best);
  if (isRecord) save.set('best', Math.round(run.time));
  if (win) Sdk.levelCleared({ time: Math.round(run.time), rating });
  else Sdk.gameOver({ time: Math.round(run.time) });
  audio.stopAll();
  ui.showResults(run, { rating, keys: Object.values(run.keys).filter(Boolean).length, isRecord });
}

// ---------------------------------------------------------------- 事件分发
function dispatch(ev) {
  audio.event(ev.type);
  ui.popup(ev);
  ui.tutorial.onEvent(ev);
  if (ev.type === 'key') Sdk.track('key', { color: ev.color });
  if (ev.type === 'door') Sdk.track('door', { id: ev.id });
  if (ev.type === 'caught') Sdk.track('caught', {});
  if (ev.type === 'generator') Sdk.track('generator', {});
}

// ---------------------------------------------------------------- 主循环
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - lastTime) / 1000, 0.5);
  lastTime = now;

  if (state === 'playing') {
    accumulator += dt;
    let guard = 0;
    while (accumulator >= STEP && guard++ < 60) {
      const inp = readInput();
      updateSim(run, inp);
      input.endFrame();
      for (const ev of drainEvents(run)) dispatch(ev);
      accumulator -= STEP;
      if (run.phase !== 'playing') { if (!ended) endRun(); break; }
    }
    const hud = getHud(run);
    ui.updateHUD(hud);
    const dist = hud.entityDist;
    const level = dist < 5 ? 1 : dist < 10 ? 0.6 : dist < 16 ? 0.25 : 0;
    audio.setHeartbeat(level);
  } else if (state === 'paused' || state === 'results') {
    audio.setHeartbeat(0);
  }

  renderer.setPitch(pitch);
  renderer.render(state === 'title' ? null : run, dt);
}

// ---------------------------------------------------------------- UI 接线
$('btn-start').addEventListener('click', () => { audio.ui(); startRun(); });
$('btn-resume').addEventListener('click', () => { audio.ui(); resumeGame(); });
$('btn-restart-pause').addEventListener('click', () => { audio.ui(); Sdk.track('restart'); startRun(); });
$('btn-menu-pause').addEventListener('click', () => { audio.ui(); toMenu(); });
$('btn-restart').addEventListener('click', () => { audio.ui(); Sdk.track('restart'); startRun(); });
$('btn-menu').addEventListener('click', () => { audio.ui(); toMenu(); });
$('btn-howto').addEventListener('click', () => { audio.ui(); ui.tutorial.start(); });
$('btn-share').addEventListener('click', () => {
  Sdk.share({ title: CONFIG.title, text: `I escaped HAUNTED WING in ${Math.round(run.time)}s!` });
});
$('btn-mute').addEventListener('click', () => {
  const m = !save.get('muted', false);
  save.set('muted', m);
  audio.setMuted(m);
  ui.applyLang();
});
for (const sel of [$('lang-select'), $('lang-select-pause')]) {
  sel.addEventListener('change', (e) => ui.setLang(e.target.value));
}
// 发电机拉杆（触屏/鼠标点按钮 = 拉杆）
document.querySelectorAll('.lever').forEach((b) => {
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (state !== 'playing') return;
    updateSim(run, { lever: +b.dataset.lever });
    for (const ev of drainEvents(run)) dispatch(ev);
  });
});

function updateRotate() {
  const portrait = innerHeight > innerWidth;
  const show = isTouch && portrait && !save.get('rotateDismissed', false);
  $('rotate').classList.toggle('hidden', !show);
}
$('btn-rotate-skip').addEventListener('click', () => { save.set('rotateDismissed', true); updateRotate(); });
window.addEventListener('resize', updateRotate);
window.addEventListener('pagehide', () => Sdk.track('session_end', { best: save.get('best', 0) }));

// ---------------------------------------------------------------- 启动
audio.setMuted(save.get('muted', false));
Sdk.ready().then(() => Sdk.track('load', { appId: CONFIG.title }));
ui.applyLang();
ui.showTitle();
updateRotate();
lastTime = performance.now();
requestAnimationFrame(loop);

// ---------------------------------------------------------------- 标准调试口
window.G = { Game: { startRun, pauseGame, resumeGame }, UI: ui, Render: renderer, Audio: audio, Save: save };
window.__ll = {
  get state() { return { phase: state, simPhase: run.phase, lang: ui.lang, dir: ui.dir }; },
  get run() { return run; },
  get hud() { return getHud(run); },
  start: startRun,
  pause: pauseGame,
  resume: resumeGame,
  restart: toMenu,
  startAct: startRun,
  startTutorial: () => ui.tutorial.start(),
  get tutorial() {
    const t = ui.tutorial;
    return { active: t.active, step: t.step, steps: t.steps, current: t.current, skip: () => t.skip() };
  },
  telemetry() {
    const h = getHud(run);
    return {
      durationSec: +run.time.toFixed(2),
      firstInputSec: 0,
      inputLatencyMs: 0,
      firstSuccessSec: run.stats.keys > 0 ? run.time : null,
      deaths: run.stats.deaths,
      actions: 0,
      idleSec: 0,
      maxEventGapSec: 0,
      uniqueEvents: 0,
      levelsReached: run.phase === 'won' ? 5 : 1 + h.keysCount,
      completed: run.phase === 'won',
    };
  },
  save: () => save,
  ui: () => ui,
  lang: () => ui.lang,
  setLang: (l) => ui.setLang(l),
  setInput: (obj) => { window.__AUTO = obj; },
};
