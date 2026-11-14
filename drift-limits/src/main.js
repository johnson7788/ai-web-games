// src/main.js — 装配：60Hz 固定步长 + 状态机 + 事件分发 + SDK 漏斗 + 标准调试口。
// 共享入口只由 Lead 改。契约见 README。
import { STEP, CONFIG } from '../config/game.config.js';
import { createSim, updateSim, getHud, drainEvents } from './game/sim.js';
import { createRenderer } from './render/index.js';
import { ui } from './ui/ui.js';
import { save } from './core/save.js';
import { Sdk } from './core/sdk.js';
import { createAudio } from './core/audio.js';

const canvas = document.getElementById('canvas');
const renderer = createRenderer(canvas);
const audio = createAudio();
const $ = (id) => document.getElementById(id);
const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

let state = 'title'; // title | playing | paused | results
let run = createSim({ seed: 1 });
run.hud = getHud(run);
let lastTime = 0, accumulator = 0, ended = false;

// ---------------------------------------------------------------- 输入
const input = { steer: 0, drift: false, nitro: false, brake: false, launch: false };
const keys = new Set();
let launchQueued = false;
let touchSteer = 0, touchDrift = false, touchNitro = false;

window.addEventListener('keydown', (e) => {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
  if (e.code === 'Space' && !e.repeat) launchQueued = true;
  keys.add(e.code);
  if (e.code === 'Escape') {
    if (state === 'playing') pauseGame();
    else if (state === 'paused') resumeGame();
  }
  if (e.code === 'KeyR' && state === 'results') startRun();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => { keys.clear(); if (state === 'playing') pauseGame(); });

function readInput() {
  if (window.__AUTO) {
    const a = window.__AUTO;
    input.steer = a.steer || 0; input.drift = !!a.drift;
    input.nitro = !!a.nitro; input.brake = !!a.brake;
    input.launch = !!a.launch; a.launch = false;
    return;
  }
  input.steer = 0;
  if (keys.has('ArrowLeft') || keys.has('KeyA')) input.steer -= 1;
  if (keys.has('ArrowRight') || keys.has('KeyD')) input.steer += 1;
  input.drift = keys.has('Space') || touchDrift;
  input.nitro = keys.has('ShiftLeft') || keys.has('ShiftRight') || touchNitro;
  input.brake = keys.has('ArrowDown') || keys.has('KeyS');
  if (touchSteer) input.steer = touchSteer;
  input.launch = launchQueued; launchQueued = false;
}

if (isTouch) {
  $('touch').classList.remove('hidden');
  document.querySelectorAll('#touch .steer').forEach((elm) => {
    const dir = +elm.dataset.steer;
    const on = (e) => { e.preventDefault(); touchSteer = dir; elm.classList.add('active'); };
    const off = (e) => { e.preventDefault(); if (touchSteer === dir) touchSteer = 0; elm.classList.remove('active'); };
    elm.addEventListener('pointerdown', on);
    elm.addEventListener('pointerup', off);
    elm.addEventListener('pointercancel', off);
    elm.addEventListener('pointerleave', off);
  });
  const bind = (elm, set) => {
    elm.addEventListener('pointerdown', (e) => { e.preventDefault(); elm.classList.add('active'); set(true); });
    const up = (e) => { e.preventDefault(); elm.classList.remove('active'); set(false); };
    elm.addEventListener('pointerup', up);
    elm.addEventListener('pointercancel', up);
    elm.addEventListener('pointerleave', up);
  };
  bind($('btn-drift'), (v) => (touchDrift = v));
  bind($('btn-nitro'), (v) => (touchNitro = v));
  // 触屏起步：点漂移键也排队 launch
  $('btn-drift').addEventListener('pointerdown', () => { launchQueued = true; });
}

// ---------------------------------------------------------------- 流程
function startRun() {
  run = createSim({ seed: (Math.random() * 1e9) | 0, perks: ui.getLoadout(), car: ui.getCar() });
  run.hud = getHud(run);
  ended = false;
  state = 'playing';
  ui.showGame();
  audio.ensure(); audio.resume();
  Sdk.newRun({ perks: ui.getLoadout() });
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
  const score = Math.round(run.score);
  const best = Math.max(save.get('best', 0), score);
  const isRecord = score > save.get('best', 0) && score > 0;
  save.set('best', best);
  const rating = run.events.find((e) => e.type === 'finished' || e.type === 'busted')?.rating || 'C';
  if (run.phase === 'finished') Sdk.levelCleared({ score, rating });
  else Sdk.gameOver({ score, rating });
  audio.stopAll();
  ui.showResults(run, { score, best, isRecord, rating });
}

// ---------------------------------------------------------------- 事件分发
function dispatch(ev) {
  audio.event(ev.type);
  ui.popup(ev);
  renderer.onEvent(ev);
  if (ev.type === 'nearMiss') Sdk.track('nearMiss', { bonus: ev.bonus });
  if (ev.type === 'crash') Sdk.track('crash', { reason: ev.reason });
  // 教学：真实动作推进
  const tut = ui.tutorial;
  if (tut.active) {
    if (tut.step === 0 && (ev.type === 'launchPerfect' || ev.type === 'launchJump' || ev.type === 'launchNormal')) tut.next();
    else if (tut.step === 1 && ev.type === 'driftStart') tut.next();
    else if (tut.step === 2 && ev.type === 'boostStart') tut.next();
    else if (tut.step === 3 && (ev.type === 'nearMiss' || ev.type === 'lap')) tut.next();
  }
}

// ---------------------------------------------------------------- 主循环
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - lastTime) / 1000, 0.5); // 低帧率时按真实时间补步，sim 不被渲染拖慢
  lastTime = now;

  if (state === 'playing') {
    accumulator += dt;
    let guard = 0;
    while (accumulator >= STEP && guard++ < 60) {
      readInput();
      updateSim(run, input);
      run.hud = getHud(run);
      for (const ev of drainEvents(run)) dispatch(ev);
      accumulator -= STEP;
      if (run.phase === 'busted' || run.phase === 'finished') { if (!ended) endRun(); break; }
    }
    audio.setEngine(Math.min(1, run.player.speed / 74), run.boostT > 0);
    audio.setSkid(run.player.drifting, Math.min(1, Math.abs(run.player.angle) * 1.8));
    const gap = run.hud.gap;
    audio.setSiren(run.phase === 'race' ? Math.max(0, 1 - gap / 50) : 0);
    ui.updateHUD(run);
  }
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
  Sdk.share({ title: CONFIG.title, text: `I scored ${Math.round(run.score)} in DRIFT LIMITS!` });
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

function updateRotate() {
  const portrait = innerHeight > innerWidth;
  const show = isTouch && portrait && !save.get('rotateDismissed', false);
  $('rotate').classList.toggle('hidden', !show);
}
$('btn-rotate-skip').addEventListener('click', () => { save.set('rotateDismissed', true); updateRotate(); });

function resize() {
  renderer.resize(innerWidth, innerHeight);
  const s = Math.min(innerWidth / 1280, innerHeight / 720);
  const stage = $('stage');
  stage.style.transform = `translate(-50%, -50%) scale(${s})`;
}
window.addEventListener('resize', () => { resize(); updateRotate(); });

document.addEventListener('visibilitychange', () => {
  if (document.hidden) { keys.clear(); if (state === 'playing') pauseGame(); }
});
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
  get hud() { return run.hud; },
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
};