// src/main.js — 装配：60Hz 固定步长 + 状态机 + 事件分发 + SDK 漏斗 + 标准调试口。
// 契约见 README。共享入口只由 Lead 改。
import { STEP, CONFIG, PLAYER } from '../config/game.config.js';
import { createRun, updateSim, getHud, drainEvents, dailySeed } from './game/sim.js';
import { createRenderer } from './render/index.js';
import { ui } from './ui/ui.js';
import { save } from './core/save.js';
import { Sdk } from './core/sdk.js';
import { createAudio } from './core/audio.js';
import { Input } from './core/base3d.js';

const canvas = document.getElementById('canvas');
const renderer = createRenderer(canvas);
const audio = createAudio();
const inp = new Input(canvas);
const $ = (id) => document.getElementById(id);
const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

let state = 'title'; // title | playing | paused | results
let run = createRun({ seed: dailySeed(new Date()) });
let lastTime = 0, accumulator = 0;

// ---------------------------------------------------------------- 输入
const input = { moveX: 0, moveZ: 0, sprint: false, hide: false, lookDX: 0, lookDY: 0 };
let touchSprint = false, hideQueued = false, firstInputTracked = false;

function readInput() {
  if (window.__AUTO) {
    const a = window.__AUTO;
    input.moveX = a.moveX || 0; input.moveZ = a.moveZ || 0;
    input.sprint = !!a.sprint; input.hide = !!a.hide; a.hide = false;
    input.lookDX = a.lookDX || 0; input.lookDY = a.lookDY || 0;
    return;
  }
  let mz = inp.axis('KeyS', 'KeyW') - inp.touchMove.y;
  let mx = inp.axis('KeyA', 'KeyD') + inp.touchMove.x;
  const len = Math.hypot(mx, mz); if (len > 1) { mx /= len; mz /= len; }
  input.moveX = mx; input.moveZ = mz;
  input.sprint = inp.down('ShiftLeft') || inp.down('ShiftRight') || touchSprint;
  input.hide = inp.hit('KeyE') || hideQueued; hideQueued = false;
  input.lookDX = (inp.mouseDX + inp.touchLook.x * 3) * PLAYER.turnSens;
  input.lookDY = (inp.mouseDY + inp.touchLook.y * 3) * PLAYER.turnSens;
}

function onRealInput() {
  if (!firstInputTracked && state === 'playing') {
    firstInputTracked = true;
    Sdk.track('first_input', {});
  }
}
window.addEventListener('keydown', (e) => {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Tab'].includes(e.code)) e.preventDefault();
  if (e.code === 'Escape') {
    if (state === 'playing') pauseGame();
    else if (state === 'paused') resumeGame();
  }
  if (e.code === 'KeyM' && state === 'playing') toggleMap();
  onRealInput();
}, true);
canvas.addEventListener('mousedown', () => { if (state === 'playing') inp.requestLock(); onRealInput(); });

function toggleMap() {
  const mm = $('minimap');
  mm.classList.toggle('hidden');
  if (!mm.classList.contains('hidden') && run) ui.drawMap(run);
}

// 触屏按钮
if (isTouch) {
  $('touch').classList.remove('hidden');
  const bind = (elm, set) => {
    elm.addEventListener('pointerdown', (e) => { e.preventDefault(); elm.classList.add('active'); set(true); });
    const up = (e) => { e.preventDefault(); elm.classList.remove('active'); set(false); };
    elm.addEventListener('pointerup', up); elm.addEventListener('pointercancel', up); elm.addEventListener('pointerleave', up);
  };
  bind($('btn-sprint'), (v) => { touchSprint = v; onRealInput(); });
  $('btn-hide').addEventListener('pointerdown', (e) => { e.preventDefault(); hideQueued = true; onRealInput(); });
  $('btn-map').addEventListener('pointerdown', (e) => { e.preventDefault(); toggleMap(); });
}

// ---------------------------------------------------------------- 流程
function startRun() {
  run = createRun({ seed: dailySeed(new Date()) });
  state = 'playing';
  firstInputTracked = false;
  ui.showGame();
  audio.ensure(); audio.unlock(); audio.setHum(true);
  Sdk.newRun({ seed: run.seed });
  if (!save.get('tutDone', false)) ui.tutorial.start();
  lastTime = performance.now();
  accumulator = 0;
}

function pauseGame() {
  if (state !== 'playing') return;
  state = 'paused';
  ui.showPause();
  audio.setHum(false);
  audio.setDanger(false);
}

function resumeGame() {
  if (state !== 'paused') return;
  state = 'playing';
  ui.hidePause();
  audio.setHum(true);
  lastTime = performance.now();
}

function toMenu() {
  state = 'title';
  ui.showTitle();
  audio.setHum(false);
  audio.setDanger(false);
  if (document.pointerLockElement) document.exitPointerLock?.();
}

function endRun() {
  state = 'results';
  audio.setHum(false);
  audio.setDanger(false);
  const time = run.time;
  const best = save.get('best', 0);
  if (best === 0 || time < best) save.set('best', time);
  if (run.caught < save.get('bestCaught', 1e9)) save.set('bestCaught', run.caught);
  Sdk.levelCleared({ exits: 9, time: Math.round(time), caught: run.caught });
  audio.play('win');
  ui.showResults(run);
}

// ---------------------------------------------------------------- 事件分发
function dispatch(ev) {
  audio.play(ev.type);
  if (ev.type === 'caught') { ui.hint('hintCaught'); Sdk.track('caught', { caught: run.caught }); }
  else if (ev.type === 'maze_regen') ui.hint('hintRegen');
  else if (ev.type === 'pickup') ui.hint('hintPickup');
  else if (ev.type === 'exit_found') Sdk.track('exit_found', { index: ev.index });
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
      readInput();
      updateSim(run, input);
      for (const ev of drainEvents(run)) dispatch(ev);
      ui.tutorial.check(run);
      accumulator -= STEP;
      if (run.phase === 'won') { endRun(); break; }
    }
    inp.endFrame();
    ui.updateHUD(run);
    audio.setDanger(run.entity.state === 'chase' && !run.player.hidden);
  } else {
    inp.endFrame();
  }
  renderer.render(state === 'title' ? null : run, dt, state);
}

// ---------------------------------------------------------------- UI 接线
$('btn-start').addEventListener('click', () => { audio.play('ui_click'); startRun(); });
$('btn-resume').addEventListener('click', () => { audio.play('ui_click'); resumeGame(); });
$('btn-restart-pause').addEventListener('click', () => { audio.play('ui_click'); Sdk.track('restart'); startRun(); });
$('btn-menu-pause').addEventListener('click', () => { audio.play('ui_back'); toMenu(); });
$('btn-restart').addEventListener('click', () => { audio.play('ui_click'); Sdk.track('restart'); startRun(); });
$('btn-menu').addEventListener('click', () => { audio.play('ui_back'); toMenu(); });
$('btn-howto').addEventListener('click', () => { audio.play('ui_click'); ui.tutorial.start(); });
$('btn-share').addEventListener('click', () => {
  Sdk.share({ title: CONFIG.title, text: `I escaped BACKROOM 9 in ${Math.floor(run.time)}s!` });
});
$('btn-mute').addEventListener('click', () => {
  const m = !save.get('muted', false);
  save.set('muted', m);
  audio.setMuted(m);
  ui.applyLang();
});
$('btn-rotate-skip').addEventListener('click', () => { save.set('rotateDismissed', true); updateRotate(); });
for (const sel of [$('lang-select'), $('lang-select-pause')]) {
  sel.addEventListener('change', (e) => ui.setLang(e.target.value));
}

function resize() {
  const s = Math.min(innerWidth / 1280, innerHeight / 720);
  $('stage').style.transform = `translate(-50%, -50%) scale(${s})`;
}
function updateRotate() {
  const portrait = innerHeight > innerWidth;
  const show = isTouch && portrait && !save.get('rotateDismissed', false);
  $('rotate').classList.toggle('hidden', !show);
}
window.addEventListener('resize', () => { resize(); updateRotate(); });
window.addEventListener('blur', () => { if (state === 'playing') pauseGame(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'playing') pauseGame(); });
window.addEventListener('pagehide', () => Sdk.track('session_end', { best: save.get('best', 0) }));

// ---------------------------------------------------------------- 启动
audio.setMuted(save.get('muted', false));
Sdk.ready().then(() => Sdk.track('load', { appId: CONFIG.appId }));
ui.applyLang();
ui.showTitle();
resize();
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
  save: () => save,
  ui: () => ui,
  lang: () => ui.lang,
  setLang: (l) => ui.setLang(l),
  setInput: (obj) => { window.__AUTO = obj; },
  debug: {
    reachExit: () => { run.player.x = run.activeExit.x; run.player.z = run.activeExit.z; },
    win: () => { run.exitIndex = 8; run.player.x = run.activeExit.x; run.player.z = run.activeExit.z; },
  },
  telemetry: () => ({
    durationSec: run.time, phase: run.phase, exitsFound: run.exitIndex, segment: run.segment,
    caught: run.caught, completed: run.phase === 'won',
  }),
};
