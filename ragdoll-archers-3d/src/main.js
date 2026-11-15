// src/main.js — 装配：60Hz 固定步长 + 状态机 + 事件分发 + SDK 漏斗 + 标准调试口。
import { STEP, CONFIG, ARROW } from '../config/game.config.js';
import { createRun, updateSim, drainEvents, getHud, solveAim, forceKillEnemies } from './game/sim.js';
import { createRenderer } from './render/index.js';
import { ui } from './ui/ui.js';
import { save } from './core/save.js';
import { Sdk } from './core/sdk.js';
import { createAudio } from './core/audio.js';
import { t } from './core/i18n.js';

const canvas = document.getElementById('canvas');
const renderer = createRenderer(canvas);
const audio = createAudio();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

let state = 'title'; // title | playing | paused | upgrade | results
let run = createRun({ seed: 1 });
let lastTime = 0, accumulator = 0, firstInputTracked = false;

// ---------------------------------------------------------------- 输入
const input = { strafe: 0, aim: null, fire: false };
const keys = new Set();
let fireQueued = false;
let touchStrafe = 0;
const drag = { active: false, sx: 0, sy: 0, x: 0, y: 0 };

window.addEventListener('keydown', (e) => {
  if (['ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  keys.add(e.code);
  if (e.code === 'Escape') {
    if (state === 'playing') pauseGame();
    else if (state === 'paused') resumeGame();
  }
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => { keys.clear(); drag.active = false; if (state === 'playing') pauseGame(); });

function dragStart(x, y) { drag.active = true; drag.sx = drag.x = x; drag.sy = drag.y = y; if (state === 'playing') audio.unlock(); }
function dragMove(x, y) { if (drag.active) { drag.x = x; drag.y = y; } }
function dragEnd() { if (drag.active) { drag.active = false; fireQueued = true; } }

canvas.addEventListener('pointerdown', (e) => { e.preventDefault(); dragStart(e.clientX, e.clientY); });
window.addEventListener('pointermove', (e) => dragMove(e.clientX, e.clientY));
window.addEventListener('pointerup', () => dragEnd());
window.addEventListener('pointercancel', () => { drag.active = false; });

function readInput() {
  if (window.__AUTO) {
    const a = window.__AUTO;
    input.strafe = a.strafe || 0;
    input.aim = a.aim || null;
    input.fire = !!a.fire; a.fire = false;
    return;
  }
  input.strafe = touchStrafe;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) input.strafe -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) input.strafe += 1;
  if (drag.active && state === 'playing') {
    const dx = drag.x - drag.sx, dy = drag.y - drag.sy;
    const power = clamp(Math.hypot(dx, dy) / 260, 0, 1);
    const angle = clamp(0.12 + dy / 220, ARROW.minAngle, ARROW.maxAngle);
    input.aim = { angle, power };
  } else input.aim = null;
  input.fire = fireQueued; fireQueued = false;
  if (input.aim || input.fire || input.strafe) trackFirstInput();
}

if (isTouch) {
  document.getElementById('touch').classList.remove('hidden');
  const bind = (elm, set) => {
    elm.addEventListener('pointerdown', (e) => { e.preventDefault(); elm.classList.add('active'); set(true); audio.unlock(); });
    const up = (e) => { e.preventDefault(); elm.classList.remove('active'); set(false); };
    elm.addEventListener('pointerup', up);
    elm.addEventListener('pointercancel', up);
    elm.addEventListener('pointerleave', up);
  };
  bind(document.getElementById('btn-left'), (v) => { touchStrafe = v ? -1 : 0; });
  bind(document.getElementById('btn-right'), (v) => { touchStrafe = v ? 1 : 0; });
}

function trackFirstInput() {
  if (firstInputTracked) return;
  firstInputTracked = true;
  Sdk.track('first_input', { ms: Math.round(performance.now()) });
}

// ---------------------------------------------------------------- 流程
function newSeed() { return (Math.random() * 1e9) | 0; }

function startRun() {
  run = createRun({ seed: newSeed() });
  firstInputTracked = false;
  state = 'playing';
  ui.showGame();
  audio.unlock(); audio.resume();
  Sdk.newRun();
  if (!save.get('tutDone', false)) ui.tutorial.start();
  lastTime = performance.now();
  accumulator = 0;
}

function pauseGame() { if (state !== 'playing') return; state = 'paused'; ui.showPause(); audio.stopAll(); }
function resumeGame() { if (state !== 'paused') return; state = 'playing'; ui.showGame(); audio.resume(); lastTime = performance.now(); }
function toMenu() { state = 'title'; ui.showTitle(); audio.stopAll(); }

function endRun() {
  state = 'results';
  const win = run.phase === 'won';
  const stars = win ? run.hearts : 0;
  const score = Math.round(run.time);
  if (win) {
    if (score < save.get('best', 0) || save.get('best', 0) === 0) save.set('best', score);
    if (run.headshots > save.get('bestHeadshots', 0)) save.set('bestHeadshots', run.headshots);
  }
  if (win) Sdk.levelCleared({ level: run.level, stars, time: score });
  else Sdk.gameOver({ level: run.level, time: score });
  audio.stopAll();
  ui.showResults(win, { stars, time: score, headshots: run.headshots });
}

function applyUpgradeAndContinue(id) {
  if (!run.applyUpgrade(id)) return;
  audio.play('pickup');
  state = 'playing';
  ui.showGame();
  lastTime = performance.now();
}

// ---------------------------------------------------------------- 事件分发
function dispatch(ev) {
  audio.event(ev.type);
  ui.tutorial.advance(ev.type);
  switch (ev.type) {
    case 'level_clear': ui.toast(t('level_clear')); Sdk.track('level_clear', { level: ev.level }); break;
    case 'heart_lost': ui.toast(t('heart_lost')); break;
    case 'quiver_empty': ui.toast(t('quiver_empty')); break;
    case 'kill': if (ev.headshot) Sdk.track('headshot', { level: ev.level }); break;
    default: break;
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
      updateSim(run, input);
      for (const ev of drainEvents(run)) dispatch(ev);
      accumulator -= STEP;
      if (run.phase === 'upgrade') { state = 'upgrade'; ui.showUpgrade(run.getUpgradeChoices(3)); break; }
      if (run.phase === 'won' || run.phase === 'dead') { endRun(); break; }
    }
    ui.updateHUD(getHud(run));
  }

  renderer.render(state === 'title' ? null : run, dt);
}

// ---------------------------------------------------------------- UI 接线
ui._onUpgrade = applyUpgradeAndContinue;
ui.btnStart.addEventListener('click', () => { audio.play('ui_click'); startRun(); });
ui.btnResume.addEventListener('click', () => { audio.play('ui_click'); resumeGame(); });
ui.btnHowto.addEventListener('click', () => { audio.play('ui_click'); ui.tutorial.start(); });
document.querySelector('[data-tutorial-skip]').addEventListener('click', () => { audio.play('ui_click'); ui.tutorial.skip(); });
document.getElementById('btn-restart-pause').addEventListener('click', () => { audio.play('ui_click'); Sdk.track('restart'); startRun(); });
document.getElementById('btn-menu').addEventListener('click', () => { audio.play('ui_click'); toMenu(); });
document.getElementById('btn-menu-results').addEventListener('click', () => { audio.play('ui_click'); toMenu(); });
ui.btnRetry.addEventListener('click', () => { audio.play('ui_click'); Sdk.track('restart'); startRun(); });
ui.btnShare.addEventListener('click', () => {
  Sdk.share({ title: CONFIG.title, text: `I cleared ${run.level} duels in RAGDOLL ARCHERS 3D!` });
});
ui.btnMute.addEventListener('click', () => {
  const m = !save.get('muted', false);
  save.set('muted', m);
  audio.setMuted(m);
  ui.applyLang();
});
for (const sel of ui.langSelects) if (sel) sel.addEventListener('change', (e) => ui.setLang(e.target.value));

document.addEventListener('visibilitychange', () => { if (document.hidden) { keys.clear(); if (state === 'playing') pauseGame(); } });
window.addEventListener('pagehide', () => Sdk.track('session_end', { best: save.get('best', 0) }));

// ---------------------------------------------------------------- 启动
audio.setMuted(save.get('muted', false));
Sdk.ready().then(() => Sdk.track('load', { appId: CONFIG.title }));
ui.applyLang();
ui.showTitle();
lastTime = performance.now();
requestAnimationFrame(loop);

// ---------------------------------------------------------------- 标准调试口
window.G = { Game: { startRun, pauseGame, resumeGame }, UI: ui, Render: renderer, Audio: audio, Save: save };
window.__ll = {
  get state() { return { phase: state, simPhase: run.phase, level: run.level, lang: ui.lang, dir: ui.dir }; },
  get run() { return run; },
  get hud() { return getHud(run); },
  start: startRun,
  pause: pauseGame,
  resume: resumeGame,
  restart: toMenu,
  startAct: (i) => { startRun(); if (i != null) { while (run.level < i && run.level < 5) run.applyUpgrade(run.getUpgradeChoices(1)[0]); } },
  autoAim: (part) => solveAim(run, part || 'torso'),
  demo: {
    win() { run.phase = 'won'; endRun(); },
    dead() { run.phase = 'dead'; endRun(); },
    killLevel() { forceKillEnemies(run); },
  },
  get tutorial() {
    const t = ui.tutorial;
    return { active: t.active, step: t.step, steps: t.steps, current: t.current, skip: () => t.skip() };
  },
  startTutorial: () => ui.tutorial.start(),
  save: () => save,
  ui: () => ui,
  lang: () => ui.lang,
  setLang: (l) => ui.setLang(l),
  setInput: (obj) => { window.__AUTO = obj; },
};
