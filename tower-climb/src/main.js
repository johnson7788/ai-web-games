// src/main.js — 装配：60Hz 固定步长 + 状态机 + 事件分发 + SDK 漏斗 + 标准调试口（window.__ll / window.G）。
import { STEP, PHYS, TOWER } from '../config/game.config.js';
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
const SENS = PHYS.sensitivity;

let state = 'title'; // title | playing | paused | results
let run = createSim({ seed: 1 });
let lastTime = 0, accumulator = 0, ended = false;

// ---------------------------------------------------------------- 输入
function readInput() {
  let moveF = 0, moveS = 0;
  if (window.__AUTO) {
    const a = window.__AUTO;
    moveF = a.moveF || 0; moveS = a.moveS || 0;
  } else {
    if (input.down('KeyW') || input.down('ArrowUp')) moveF += 1;
    if (input.down('KeyS') || input.down('ArrowDown')) moveF -= 1;
    if (input.down('KeyD') || input.down('ArrowRight')) moveS += 1;
    if (input.down('KeyA') || input.down('ArrowLeft')) moveS -= 1;
    moveF += ui.touch.moveY || 0;
    moveS += ui.touch.moveX || 0;
  }
  const jump = input.hit('Space') || ui.touch.jump;
  const dash = input.hit('ShiftLeft') || input.hit('ShiftRight') || ui.touch.dash;
  const lookX = (input.mouseDX + input.touchLook.x * 3) * SENS;
  const lookY = (input.mouseDY + input.touchLook.y * 3) * SENS;
  const respawn = input.hit('KeyR');
  ui.touch.jump = false; ui.touch.dash = false;
  return { moveF, moveS, jump, dash, lookX, lookY, respawn };
}

// ---------------------------------------------------------------- 流程
function startRun() {
  run = createSim({ seed: (Math.random() * 1e9) | 0 });
  ended = false;
  state = 'playing';
  ui.showGame();
  audio.ensure(); audio.resume();
  audio.event('start');
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
  const hud = getHud(run);
  const best = save.get('best', null);
  const isRecord = best == null || hud.time < best;
  if (isRecord) save.set('best', hud.time);
  Sdk.levelCleared({ rating: hud.rating, time: Math.round(hud.time) });
  audio.stopAll();
  audio.event('won');
  ui.showResults();
  ui.showResultsData({ ...hud, isRecord });
}

// ---------------------------------------------------------------- 事件分发
function dispatch(ev) {
  audio.event(ev.type);
  renderer.onEvent(ev);
  if (ev.type === 'fall') Sdk.track('fall', { falls: ev.falls });
  if (ev.type === 'level_up') Sdk.track('level_up', { floor: ev.floor });
  const tut = ui.tutorial;
  if (tut.active) {
    if (tut.step === 1 && ev.type === 'jump') tut.next();
    else if (tut.step === 2 && ev.type === 'dash') tut.next();
    else if (tut.step === 3 && ev.type === 'level_up') tut.skip();
  }
}

// ---------------------------------------------------------------- 主循环
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - lastTime) / 1000, 0.25);
  lastTime = now;

  if (state === 'playing') {
    accumulator += dt;
    const inp = readInput();
    const tut = ui.tutorial;
    if (tut.active && tut.step === 0 && (Math.abs(inp.moveF) > 0.05 || Math.abs(inp.moveS) > 0.05)) tut.next();
    let guard = 0;
    while (accumulator >= STEP && guard++ < 60) {
      updateSim(run, inp);
      for (const ev of drainEvents(run)) dispatch(ev);
      accumulator -= STEP;
      if (run.phase === 'won') { if (!ended) endRun(); break; }
    }
    if (!ended) ui.updateHUD(getHud(run));
    audio.setWind(run.player.y >= 36);
  }
  input.endFrame();
  renderer.render(state === 'title' ? null : run, dt);
}

// ---------------------------------------------------------------- UI 接线
$('btn-start').addEventListener('click', () => { audio.ui(); startRun(); });
$('btn-howto').addEventListener('click', () => { audio.ui(); ui.tutorial.start('title'); });
$('tut-skip').addEventListener('click', () => { audio.ui(); ui.tutorial.skip(); });
$('btn-resume').addEventListener('click', () => { audio.ui(); resumeGame(); });
$('btn-restart-pause').addEventListener('click', () => { audio.ui(); Sdk.track('restart'); startRun(); });
$('btn-menu-pause').addEventListener('click', () => { audio.ui(); toMenu(); });
$('btn-howto-pause').addEventListener('click', () => { audio.ui(); ui.tutorial.start('title'); });
$('btn-mute').addEventListener('click', () => {
  const m = !save.get('muted', false);
  save.set('muted', m);
  audio.setMuted(m);
  ui.applyLang();
});
$('btn-restart').addEventListener('click', () => { audio.ui(); Sdk.track('restart'); startRun(); });
$('btn-menu').addEventListener('click', () => { audio.ui(); toMenu(); });
$('btn-share').addEventListener('click', () => {
  Sdk.share({ title: 'TOWER CLIMB', text: `I cleared the neon tower in ${Math.round(run.time)}s (rating ${run.rating})!` });
});
for (const sel of ui.langSelects) sel.addEventListener('change', (e) => ui.setLang(e.target.value));

// 点击画布请求指针锁定（桌面鼠标视角）
canvas.addEventListener('click', () => input.requestLock());

// 竖屏提示
function updateRotate() {
  const portrait = innerHeight > innerWidth;
  const show = ui.isTouchDevice && portrait && !save.get('rotateDismissed', false);
  ui.rotate.classList.toggle('hidden', !show);
}
$('btn-rotate-skip').addEventListener('click', () => { save.set('rotateDismissed', true); updateRotate(); });
window.addEventListener('resize', updateRotate);

// 失焦 / 切后台自动暂停
window.addEventListener('blur', () => { if (state === 'playing') pauseGame(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'playing') pauseGame(); });
window.addEventListener('pagehide', () => Sdk.track('session_end', { best: save.get('best', null) }));

// ---------------------------------------------------------------- 启动
audio.setMuted(save.get('muted', false));
Sdk.ready().then(() => Sdk.track('load', { appId: 'pipy-tower-climb' }));
ui.applyLang();
ui.showTitle();
updateRotate();
lastTime = performance.now();
requestAnimationFrame(loop);

// ---------------------------------------------------------------- 标准调试口
window.G = { Game: { startRun, pauseGame, resumeGame, toMenu }, UI: ui, Render: renderer, Audio: audio, Save: save };
window.__ll = {
  get state() { return { phase: state, lang: ui.lang, dir: ui.dir }; },
  get run() { return run; },
  get hud() { return getHud(run); },
  start: startRun,
  pause: pauseGame,
  resume: resumeGame,
  restart: toMenu,
  startAct: startRun,
  startTutorial: () => ui.tutorial.start(),
  win: () => {
    if (state === 'playing') {
      run.floor = TOWER.floors; run.maxFloor = TOWER.floors;
      run.rating = ratingFor(run.falls, run.time);
      endRun();
    }
  },
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
