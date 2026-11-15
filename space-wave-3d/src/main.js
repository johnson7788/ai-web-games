// src/main.js — 装配：60Hz 固定步长 + 标题→玩法→结算 状态机 + 事件分发 + SDK 漏斗 + 标准调试口。
import { STEP, CONFIG, SCORE } from '../config/game.config.js';
import { createSim, updateSim, getHud, drainEvents, ratingFor } from './game/sim.js';
import { createRenderer } from './render/index.js';
import { ui } from './ui/ui.js';
import { save } from './core/save.js';
import { Sdk } from './core/sdk.js';
import { createAudio } from './core/audio.js';

const $ = (id) => document.getElementById(id);
const canvas = $('canvas');
const renderer = createRenderer(canvas);
const audio = createAudio();

// 渲染器按容器实际尺寸初始化/跟随缩放（否则 WebGL 缓冲停在 300×150 被 CSS 拉伸 → 糊）
function fitCanvas() {
  const c = $('game-container');
  renderer.resize(c.clientWidth || 1280, c.clientHeight || 720);
}
fitCanvas();
window.addEventListener('resize', fitCanvas);

let state = 'title'; // title | playing | paused | results
let run = createSim({ seed: 1 });
let ended = false;
let lastTime = 0, accumulator = 0;
let holdMs = 0;

// ---------------------------------------------------------------- 输入（单键：hold）
const input = { hold: false };
const keys = new Set();

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) { input.hold = true; keys.add('Space'); } }
  if (e.code === 'Escape') { if (state === 'playing') pauseGame(); else if (state === 'paused') resumeGame(); }
  if (e.code === 'KeyR' && state === 'results') startRun();
});
window.addEventListener('keyup', (e) => { if (e.code === 'Space') { input.hold = false; keys.delete('Space'); } });
window.addEventListener('blur', () => { keys.clear(); input.hold = false; if (state === 'playing') pauseGame(); });

function readInput() {
  if (window.__AUTO) { input.hold = !!window.__AUTO.hold; return; }
  input.hold = keys.has('Space') || pointerHold;
}

let pointerHold = false;
function bindHold(el) {
  const on = (e) => { e.preventDefault(); pointerHold = true; };
  const off = (e) => { e.preventDefault(); pointerHold = false; };
  el.addEventListener('pointerdown', on);
  el.addEventListener('pointerup', off);
  el.addEventListener('pointercancel', off);
  el.addEventListener('pointerleave', off);
}
bindHold($('hold-zone'));

// ---------------------------------------------------------------- 流程
function startRun() {
  run = createSim({ seed: (Math.random() * 1e9) | 0 });
  ended = false;
  state = 'playing';
  ui.showGame();
  audio.unlock(); audio.resume();
  audio.event('start');
  Sdk.newRun();
  if (!save.get('tutDone', false)) ui.tutorial.start();
  lastTime = performance.now();
  accumulator = 0;
  holdMs = 0;
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
  input.hold = false;
}

function endRun() {
  ended = true;
  state = 'results';
  const score = Math.round(run.score);
  const prevBest = save.get('best', 0);
  const best = Math.max(prevBest, score);
  const isRecord = score > prevBest && score > 0;
  save.set('best', best);
  const rating = ratingFor(score);
  if (run.phase === 'finished') Sdk.levelCleared({ score, rating });
  else Sdk.gameOver({ score, rating });
  audio.stopAll();
  audio.event(run.phase === 'finished' ? 'win' : 'fail');
  ui.showResults(run, { score, best, isRecord, rating });
}

// ---------------------------------------------------------------- 事件分发
function dispatch(ev) {
  audio.event(ev.type);
  ui.popup(ev);
  renderer.onEvent(ev);
  if (ev.type === 'perfect') Sdk.track('perfect', { mult: ev.mult });
  if (ev.type === 'nearMiss') Sdk.track('nearMiss', { add: ev.add });
  if (ev.type === 'shield') Sdk.track('shield', {});
  // 教学：真实动作推进
  const tut = ui.tutorial;
  if (tut.active) {
    if (tut.step === 1 && (ev.type === 'pass' || ev.type === 'perfect' || ev.type === 'nearMiss')) tut.next();
    else if (tut.step === 2 && ev.type === 'perfect') tut.next();
  }
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
      // 教学第 1 步：按住 ≥0.5s
      if (ui.tutorial.active && ui.tutorial.step === 0) {
        holdMs = input.hold ? holdMs + STEP : 0;
        if (holdMs >= 0.5) { ui.tutorial.next(); holdMs = 0; }
      }
      if (!(ui.tutorial.active && ui.tutorial.step === 0)) {
        updateSim(run, input);
        for (const ev of drainEvents(run)) dispatch(ev);
      }
      accumulator -= STEP;
      if (run.phase === 'dead' || run.phase === 'finished') { if (!ended) endRun(); break; }
    }
    const hud = getHud(run);
    ui.updateHUD(run, hud);
    audio.setThrust(input.hold ? Math.min(1, 0.4 + Math.abs(run.vy) / 14) : 0);
  }

  renderer.render(state === 'title' ? null : run, dt);
}

// ---------------------------------------------------------------- UI 接线
$('btn-start').addEventListener('click', () => { audio.unlock(); startRun(); });
$('btn-resume').addEventListener('click', () => { audio.event('ui_click'); resumeGame(); });
$('btn-restart-pause').addEventListener('click', () => { audio.event('ui_click'); Sdk.track('restart'); startRun(); });
$('btn-menu-pause').addEventListener('click', () => { audio.event('ui_back'); toMenu(); });
$('btn-restart').addEventListener('click', () => { audio.event('ui_click'); Sdk.track('restart'); startRun(); });
$('btn-menu').addEventListener('click', () => { audio.event('ui_back'); toMenu(); });
$('btn-howto').addEventListener('click', () => { audio.event('ui_click'); ui.tutorial.start(); });
$('btn-share').addEventListener('click', () => {
  Sdk.share({ title: CONFIG.title, text: `I scored ${Math.round(run.score)} in SPACE WAVE 3D!` });
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
  const show = ui.isTouch && portrait && !save.get('rotateDismissed', false);
  $('rotate').classList.toggle('hidden', !show);
}
$('btn-rotate-skip').addEventListener('click', () => { save.set('rotateDismissed', true); updateRotate(); });
window.addEventListener('resize', updateRotate);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) { keys.clear(); input.hold = false; if (state === 'playing') pauseGame(); }
});
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
  demo: {
    dead() { run.phase = 'dead'; run.events.push({ type: 'fail', score: Math.round(run.score), rating: ratingFor(run.score) }); },
    finish() { run.phase = 'finished'; run.events.push({ type: 'win' }); },
  },
  telemetry() {
    return {
      durationSec: run.time, firstInputSec: run.stats.firstInputT, inputLatencyMs: 0,
      firstSuccessSec: run.stats.perfects > 0 ? run.stats.firstSuccessT ?? null : null,
      deaths: run.phase === 'dead' ? 1 : 0,
      actions: 0, idleSec: 0, maxEventGapSec: 0, uniqueEvents: 0, levelsReached: run.stats.maxLevel, completed: run.phase === 'finished',
    };
  },
  save: () => save,
  ui: () => ui,
  lang: () => ui.lang,
  setLang: (l) => ui.setLang(l),
  setInput: (obj) => { window.__AUTO = obj; },
};
