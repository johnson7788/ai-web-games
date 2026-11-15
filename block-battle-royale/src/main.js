// src/main.js — 装配：60Hz 固定步长 + 状态机 + 事件分发 + SDK 漏斗 + 标准调试口。
import { STEP, CONFIG, LOOT } from '../config/game.config.js';
import { createSim, updateSim, getHud, drainEvents, getRating } from './game/sim.js';
import { createRenderer } from './render/index.js';
import { ui } from './ui/ui.js';
import { save } from './core/save.js';
import { Sdk } from './core/sdk.js';
import { createAudio } from './core/audio.js';
import { Input } from './core/base3d.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const $ = (id) => document.getElementById(id);
const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

const canvas = $('canvas');
const renderer = createRenderer(canvas);
const audio = createAudio();
const inputCtrl = new Input(canvas);

let state = 'title'; // title | playing | paused | results
let run = createSim({ seed: 1 });
run.hud = getHud(run);
let lastTime = 0, accumulator = 0, ended = false;
let yaw = 0, pitch = 0;
const SENS = 0.0024;

const input = { yaw: 0, pitch: 0, forward: 0, strafe: 0, fire: false, build: false, reload: false, pickup: false };
let fireHeld = false, buildQueued = false, reloadQueued = false, pickupQueued = false;
let touchFire = false, touchBuild = false, touchReload = false, touchPickup = false;

// ---------------------------------------------------------------- 输入
canvas.addEventListener('mousedown', (e) => {
  if (state !== 'playing' || isTouch) return;
  if (e.button === 0) { if (!inputCtrl.locked) inputCtrl.requestLock(); else fireHeld = true; }
  if (e.button === 2) buildQueued = true;
});
window.addEventListener('mouseup', (e) => { if (e.button === 0) fireHeld = false; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') {
    if (state === 'playing') pauseGame();
    else if (state === 'paused') resumeGame();
  }
  if (e.code === 'KeyR' && state === 'playing') reloadQueued = true;
  if (e.code === 'KeyE' && state === 'playing') pickupQueued = true;
  if (e.code === 'Tab' && state === 'playing') { e.preventDefault(); ui.toggleBackpack(run); }
  if (e.code === 'KeyM' && state === 'playing') ui.toggleMinimap();
});

function bindTouchBtn(id, set) {
  const el = $(id);
  if (!el) return;
  const on = (e) => { e.preventDefault(); el.classList.add('active'); set(true); };
  const off = (e) => { e.preventDefault(); el.classList.remove('active'); set(false); };
  el.addEventListener('pointerdown', on);
  el.addEventListener('pointerup', off);
  el.addEventListener('pointercancel', off);
  el.addEventListener('pointerleave', off);
}
bindTouchBtn('btn-fire', (v) => { touchFire = v; });
bindTouchBtn('btn-build', (v) => { if (v) touchBuild = true; });
bindTouchBtn('btn-pickup', (v) => { if (v) touchPickup = true; });
bindTouchBtn('btn-reload', (v) => { if (v) touchReload = true; });

function readInput() {
  if (window.__AUTO) {
    const a = window.__AUTO;
    input.forward = a.forward || 0; input.strafe = a.strafe || 0;
    input.fire = !!a.fire;
    input.build = !!a.build; a.build = false;
    input.reload = !!a.reload; a.reload = false;
    input.pickup = !!a.pickup; a.pickup = false;
    if (a.yaw != null) input.yaw = a.yaw;
    if (a.pitch != null) input.pitch = a.pitch;
    return;
  }
  yaw += -(inputCtrl.mouseDX + inputCtrl.touchLook.x * 3) * SENS;
  pitch += -(inputCtrl.mouseDY + inputCtrl.touchLook.y * 3) * SENS;
  pitch = clamp(pitch, -1.45, 1.45);
  input.yaw = yaw; input.pitch = pitch;
  input.forward = inputCtrl.axis('KeyS', 'KeyW') - inputCtrl.touchMove.y;
  input.strafe = inputCtrl.axis('KeyA', 'KeyD') + inputCtrl.touchMove.x;
  input.fire = fireHeld || touchFire;
  input.build = buildQueued || touchBuild; buildQueued = false; touchBuild = false;
  input.reload = inputCtrl.hit('KeyR') || reloadQueued || touchReload; reloadQueued = false; touchReload = false;
  input.pickup = inputCtrl.hit('KeyE') || pickupQueued || touchPickup; pickupQueued = false; touchPickup = false;

  // 引导第 1 步：真实移动
  if (ui.tutorial.active && ui.tutorial.step === 0 && (Math.abs(input.forward) > 0.1 || Math.abs(input.strafe) > 0.1)) ui.tutorial.next();
}

// ---------------------------------------------------------------- 流程
function startGame() {
  run = createSim({ seed: (Math.random() * 1e9) | 0 });
  run.hud = getHud(run);
  ended = false;
  yaw = 0; pitch = 0;
  state = 'playing';
  ui.showGame();
  audio.ensure(); audio.resume(); audio.play('start');
  Sdk.newRun({ appId: CONFIG.appId });
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
  run = createSim({ seed: 1 });
  run.hud = getHud(run);
  renderer.markBlocksDirty();
  ui.showTitle();
  audio.stopAll();
}

function endRun() {
  ended = true;
  state = 'results';
  const win = run.phase === 'won';
  const kills = run.player.kills;
  const rating = getRating(run);
  const best = Math.max(save.get('best', 0), kills);
  const isRecord = kills > save.get('best', 0) && kills > 0;
  save.set('best', best);
  if (win) Sdk.levelCleared({ kills, rating });
  else Sdk.gameOver({ kills, rating });
  audio.stopAll();
  audio.play(win ? 'win' : 'fail');
  ui.showResults(run, { victory: win, rating, kills, time: run.time, best, isRecord, alive: getHud(run).alive });
}

// ---------------------------------------------------------------- 事件分发
function dispatch(ev) {
  audio.event(ev.type);
  renderer.onEvent(ev);
  if (ev.type === 'hit' && ev.shooter === run.player.id) run.hitmarkT = run.time + 0.15;
  if (ev.type === 'kill' && ev.killer === run.player.id) Sdk.track('kill', { weapon: ev.weapon });
  // 引导：真实动作推进
  const tut = ui.tutorial;
  if (tut.active) {
    if (tut.step === 1 && ev.type === 'pickup' && ev.id === run.player.id) tut.next();
    else if (tut.step === 2 && ev.type === 'shot' && ev.shooter === run.player.id) tut.next();
    else if (tut.step === 3 && ev.type === 'build' && ev.owner === run.player.id) tut.next();
  }
}

function nearLoot() {
  const p = run.player;
  for (const l of run.loot) {
    const dx = l.x - p.x, dz = l.z - p.z;
    if (dx * dx + dz * dz < (LOOT.radius + 1.5) ** 2) return true;
  }
  return false;
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
      run.hud = getHud(run);
      run.nearLoot = nearLoot();
      for (const ev of drainEvents(run)) dispatch(ev);
      accumulator -= STEP;
      inputCtrl.endFrame();
      if (run.phase === 'won' || run.phase === 'dead') { if (!ended) endRun(); break; }
    }
    ui.updateHUD(run);
    ui.updateMinimap(run);
  }

  renderer.render(run, state, dt);
}

// ---------------------------------------------------------------- UI 接线
$('btn-start').addEventListener('click', () => { audio.ui(); startGame(); });
$('btn-resume').addEventListener('click', () => { audio.ui(); resumeGame(); });
$('btn-restart-pause').addEventListener('click', () => { audio.ui(); Sdk.track('restart'); startGame(); });
$('btn-menu-pause').addEventListener('click', () => { audio.ui(); toMenu(); });
$('btn-restart').addEventListener('click', () => { audio.ui(); Sdk.track('restart'); startGame(); });
$('btn-share').addEventListener('click', () => { Sdk.share({ title: CONFIG.title, text: `I scored ${run.player.kills} kills in BLOCK BATTLE ROYALE!` }); });
$('btn-menu').addEventListener('click', () => { audio.ui(); toMenu(); });
$('btn-howto').addEventListener('click', () => { audio.ui(); ui.tutorial.start(); });
$('btn-mute').addEventListener('click', () => {
  const m = !save.get('muted', false);
  save.set('muted', m);
  audio.setMuted(m);
  ui.applyLang();
});
for (const sel of [$('lang-select'), $('lang-select-pause')]) {
  sel.addEventListener('change', (e) => ui.setLang(e.target.value));
}

function updateRotate() {
  const portrait = innerHeight > innerWidth;
  const show = isTouch && portrait && !save.get('rotateDismissed', false);
  $('rotate').classList.toggle('hidden', !show);
}
$('btn-rotate-skip').addEventListener('click', () => { save.set('rotateDismissed', true); updateRotate(); });
window.addEventListener('resize', updateRotate);

document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'playing') pauseGame(); });
window.addEventListener('pagehide', () => Sdk.track('session_end', { best: save.get('best', 0) }));

// ---------------------------------------------------------------- 启动
audio.setMuted(save.get('muted', false));
Sdk.ready().then(() => Sdk.track('load', { appId: CONFIG.appId }));
ui.applyLang();
ui.showTitle();
updateRotate();
lastTime = performance.now();
requestAnimationFrame(loop);

// ---------------------------------------------------------------- 标准调试口
window.G = { Game: { startGame, pauseGame, resumeGame }, UI: ui, Render: renderer, Audio: audio, Save: save };
window.__ll = {
  get state() { return { phase: state, simPhase: run.phase, lang: ui.lang, dir: ui.dir }; },
  get run() { return run; },
  get hud() { return getHud(run); },
  start: startGame,
  pause: pauseGame,
  resume: resumeGame,
  restart: toMenu,
  startAct: startGame,
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
  demo: {
    win() { run.bots.forEach((b) => { b.alive = false; b.hp = 0; }); run.player.hp = Math.max(1, run.player.hp); },
    dead() { run.player.hp = 0; run.player.alive = false; },
  },
  telemetry() {
    return {
      durationSec: run.time, firstInputSec: null, inputLatencyMs: 0, firstSuccessSec: null,
      deaths: run.phase === 'dead' ? 1 : 0, actions: run.stats.shots + run.stats.blocksPlaced + run.stats.pickups,
      idleSec: 0, maxEventGapSec: 0, uniqueEvents: 0, levelsReached: run.zone.stage + 1,
      completed: run.phase === 'won',
    };
  },
};
