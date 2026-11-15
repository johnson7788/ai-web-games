// src/main.js — 装配：60Hz 固定步长 + 状态机 + 事件分发 + 输入 + SDK 漏斗 + 标准调试口。
import { STEP, CONFIG, VIEW, CAM, TOWERS, WALL, WAVES, RATINGS } from '../config/game.config.js';
import { createSim, updateSim, getHud, drainEvents } from './game/sim.js';
import { createRenderer } from './render/index.js';
import { ui } from './ui/ui.js';
import { save } from './core/save.js';
import { Sdk } from './core/sdk.js';
import { createAudio } from './core/audio.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

const renderer = createRenderer($('canvas'));
const audio = createAudio();

let state = 'title'; // title | playing | paused | results
let run = createSim({ seed: 1 });
let ended = false;
let lastTime = 0, accumulator = 0, firstInputDone = false;

// ---------------------------------------------------------------- 相机缩放/旋转（render 内 orbit）
function zoomIn(dir) { renderer.orbit(0, 0, dir > 0 ? 1.1 : 0.9); }

// ---------------------------------------------------------------- 流程
function startRun() {
  run = createSim({ seed: (Math.random() * 1e9) | 0 });
  ended = false;
  firstInputDone = false;
  state = 'playing';
  ui.showGame();
  audio.ensure(); audio.unlock(); audio.event('start');
  Sdk.newRun({ level: 1 });
  if (!save.get('tutDone', false)) ui.tutorial.start();
  lastTime = performance.now();
  accumulator = 0;
}

function pauseGame() { if (state !== 'playing') return; state = 'paused'; ui.showPause(); audio.stopAll(); }
function resumeGame() { if (state !== 'paused') return; state = 'playing'; ui.hidePause(); audio.resume(); lastTime = performance.now(); }
function toMenu() { state = 'title'; ui.showTitle(); audio.stopAll(); }

function ratingOf(hp) { for (const r of RATINGS) if (hp >= r.minHp) return r.rank; return 'C'; }

function endRun(won) {
  ended = true;
  state = 'results';
  const total = WAVES.length;
  const wavesCleared = won ? total : Math.max(0, run.wave - 1);
  const hpLeft = run.coreHp;
  const rating = ratingOf(hpLeft);
  const oldBest = save.get('best', 0);
  const isRecord = wavesCleared > oldBest;
  save.set('best', Math.max(oldBest, wavesCleared));
  if (won) Sdk.levelCleared({ level: total, waves: wavesCleared, hp: hpLeft });
  else Sdk.gameOver({ level: run.wave, waves: wavesCleared, hp: hpLeft });
  audio.event(won ? 'win' : 'fail');
  const m = Math.floor(run.time / 60), s = Math.floor(run.time % 60);
  ui.showResults({ won, hpLeft, wavesCleared, totalWaves: total, timeStr: `${m}:${String(s).padStart(2, '0')}`, kills: run.kills, rating, isRecord });
}

function firstInput() {
  if (!firstInputDone) { firstInputDone = true; Sdk.track('first_input', { ms: Math.round(run.time * 1000) }); }
}

// ---------------------------------------------------------------- 事件分发
const AUDIO_MAP = { kill: 'score', wave_clear: 'wave', wave: 'wave', early_start: 'start', interest: 'pickup', wall_built: 'build', enemy_spawn: null };
function dispatch(ev) {
  const name = AUDIO_MAP[ev.type] === undefined ? ev.type : AUDIO_MAP[ev.type];
  if (name) audio.event(name);
  if (ev.type === 'build' || ev.type === 'wall_built') { firstInput(); Sdk.track('build', { kind: ev.kind }); ui.tutorial.onAction('build'); }
  else if (ev.type === 'wave') { ui.tutorial.onAction('wave'); }
  else if (ev.type === 'kill') { ui.tutorial.onAction('kill'); }
  else if (ev.type === 'wave_clear') { Sdk.track('wave_clear', { wave: ev.wave }); }
  renderer.onEvent(ev);
}

// ---------------------------------------------------------------- 建塔/选择动作
function tryBuild(type, c, r) {
  if (!run.canPlace(type, c, r)) return false;
  run.build(type, c, r);
  ui.tutorial.onAction('build');
  firstInput();
  return true;
}
function clickCell(c, r) {
  const k = `${c},${r}`;
  if (ui.selected) {
    if (tryBuild(ui.selected, c, r)) {
      // 放完保持选中，方便连放
    }
    return;
  }
  if (run.towers[k]) {
    const t = run.towers[k];
    ui.setSelCell({ c, r }, `${t.type} L${t.level}`);
  } else if (run.walls[k]) {
    ui.setSelCell({ c, r }, 'wall');
  } else {
    ui.hideSelPanel();
  }
}

// ---------------------------------------------------------------- 输入（指针统一）
const pointers = new Map();
let clickStart = null;
let pinch = { dist: 0, angle: 0 };
let lastMouse = { x: VIEW.W / 2, y: VIEW.H / 2 };

const canvas = $('canvas');
let rotating = false;
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture?.(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  lastMouse = { x: e.clientX, y: e.clientY };
  if (e.button === 2) rotating = true;
  if (pointers.size === 2) pinch = pinchState();
  clickStart = { x: e.clientX, y: e.clientY, button: e.button, type: e.pointerType };
});
function pinchState() {
  const [a, b] = [...pointers.values()];
  return { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, angle: Math.atan2(b.y - a.y, b.x - a.x) };
}
canvas.addEventListener('pointermove', (e) => {
  lastMouse = { x: e.clientX, y: e.clientY };
  if (!pointers.has(e.pointerId)) return;
  const prev = pointers.get(e.pointerId);
  const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (rotating) { renderer.orbit(-dx * CAM.rotateSpeed, dy * 0.004, 1); return; }
  if (pointers.size === 2) {
    const p = pinchState();
    renderer.orbit((p.angle - pinch.angle) * 0.35, 0, 1);
    renderer.cam.dist = clamp(renderer.cam.dist * (pinch.dist / p.dist), CAM.minDist, CAM.maxDist);
    renderer.applyCam();
    pinch = p;
  }
});
function pointerEnd(e) {
  if (!pointers.has(e.pointerId)) return;
  if (clickStart && clickStart.button === 0) {
    const moved = Math.hypot(e.clientX - clickStart.x, e.clientY - clickStart.y);
    const threshold = clickStart.type === 'touch' ? 14 : 8;
    if (moved < threshold) handleClick(e.clientX, e.clientY);
  }
  pointers.delete(e.pointerId);
  if (pointers.size < 2) rotating = false;
  clickStart = null;
}
canvas.addEventListener('pointerup', pointerEnd);
canvas.addEventListener('pointercancel', pointerEnd);
canvas.addEventListener('wheel', (e) => { zoomIn(e.deltaY); }, { passive: true });

function handleClick(x, y) {
  if (state !== 'playing') return;
  const cell = renderer.pickCell(x, y);
  if (!cell) return;
  clickCell(cell.c, cell.r);
  audio.event('ui_click');
}

// 键盘
window.addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (state === 'playing') {
    const map = { Digit1: 'arrow', Digit2: 'cannon', Digit3: 'ice', Digit4: 'wall' };
    if (map[e.code]) { ui.setSelected(map[e.code]); ui.tutorial.onAction('select'); firstInput(); audio.event('ui_click'); }
    else if (e.code === 'Space') { if (run.phase === 'build') { run.earlyStart(); audio.event('start'); firstInput(); } }
  }
  if (e.code === 'Escape') {
    if (state === 'playing') pauseGame();
    else if (state === 'paused') resumeGame();
  }
  if (e.code === 'KeyR' && state === 'results') { audio.event('ui_click'); Sdk.track('restart', {}); startRun(); }
});

// ---------------------------------------------------------------- UI 接线
ui.btnStart.addEventListener('click', () => { audio.event('ui_click'); startRun(); });
ui.btnHowto.addEventListener('click', () => { audio.event('ui_click'); ui.tutorial.start(); });
$('tut-skip').addEventListener('click', () => { audio.event('ui_click'); ui.tutorial.skip(); });
$('tut-next').addEventListener('click', () => { audio.event('ui_click'); ui.tutorial.next(); });
ui.btnResume.addEventListener('click', () => { audio.event('ui_click'); resumeGame(); });
ui.btnRestartPause.addEventListener('click', () => { audio.event('ui_click'); Sdk.track('restart', {}); startRun(); });
ui.btnMenuPause.addEventListener('click', () => { audio.event('ui_click'); toMenu(); });
ui.btnRestart.addEventListener('click', () => { audio.event('ui_click'); Sdk.track('restart', {}); startRun(); });
ui.btnMenu.addEventListener('click', () => { audio.event('ui_click'); toMenu(); });
ui.btnShare.addEventListener('click', () => {
  Sdk.share({ title: CONFIG.title, text: ui.lang() === 'zh'
    ? `我在三维守城里守住了 ${save.get('best', 0)} 波！`
    : `I held ${save.get('best', 0)} waves in KEEP GUARD 3D!` });
});
ui.btnStartWave.addEventListener('click', () => { if (state === 'playing' && run.phase === 'build') { run.earlyStart(); audio.event('start'); firstInput(); } });
ui.btnUpgrade.addEventListener('click', () => {
  const cell = ui.getSelCell();
  if (cell) { const k = `${cell.c},${cell.r}`; if (run.towers[k] && run.upgrade(cell.c, cell.r)) { audio.event('upgrade'); ui.hideSelPanel(); } }
});
ui.btnSell.addEventListener('click', () => {
  const cell = ui.getSelCell();
  if (cell) { if (run.sell(cell.c, cell.r)) { audio.event('sell'); ui.hideSelPanel(); } }
});
for (const b of ui.towerBtns) {
  b.addEventListener('click', () => { if (state === 'playing') { ui.setSelected(b.dataset.tower); ui.tutorial.onAction('select'); firstInput(); audio.event('ui_click'); } });
}
const muteBtn = () => {
  const m = !save.get('muted', false);
  save.set('muted', m);
  audio.setMuted(m);
  ui.applyLang();
};
ui.btnMute.addEventListener('click', muteBtn);
ui.btnMuteTitle.addEventListener('click', muteBtn);
for (const sel of ui.langSelects) if (sel) sel.addEventListener('change', (e) => ui.setLang(e.target.value));

// ---------------------------------------------------------------- 主循环
function hoverView() {
  let hover = null;
  if (state === 'playing' && ui.selected) {
    const cell = renderer.pickCell(lastMouse.x, lastMouse.y);
    if (cell) {
      hover = { c: cell.c, r: cell.r, canPlace: run.canPlace(ui.selected, cell.c, cell.r), previewPath: run.previewPath(cell.c, cell.r) };
    }
  }
  renderer.setView({ selected: ui.selected, hover, previewPath: hover ? hover.previewPath : null, range: ui.selected && ui.selected !== 'wall' ? TOWERS[ui.selected].levels[0].range : 0 });
}

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  if (state === 'playing') {
    accumulator += dt;
    let guard = 0;
    while (accumulator >= STEP && guard++ < 60) {
      updateSim(run, {});
      for (const ev of drainEvents(run)) dispatch(ev);
      accumulator -= STEP;
      if (run.phase === 'won' || run.phase === 'lost') { if (!ended) endRun(run.phase === 'won'); break; }
    }
    ui.updateHUD(run);
  }
  hoverView();
  renderer.render(state === 'title' ? null : run, dt);
}

// ---------------------------------------------------------------- 启动
audio.setMuted(save.get('muted', false));
Sdk.ready().then(() => Sdk.track('load', { appId: CONFIG.appId }));
ui.applyLang();
ui.showTitle();
resize();
updateRotate();
lastTime = performance.now();
requestAnimationFrame(loop);

function resize() {
  renderer.resize(window.innerWidth, window.innerHeight);
  const s = Math.min(window.innerWidth / VIEW.W, window.innerHeight / VIEW.H);
  $('stage').style.transform = `translate(-50%, -50%) scale(${s})`;
}
function updateRotate() {
  const portrait = window.innerHeight > window.innerWidth;
  $('rotate-hint')?.classList?.toggle('hidden', !(isTouch && portrait));
}
window.addEventListener('resize', () => { resize(); updateRotate(); ui.tutorial._position(); });

document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'playing') pauseGame(); });
window.addEventListener('pagehide', () => Sdk.track('session_end', { best: save.get('best', 0) }));

// ---------------------------------------------------------------- 标准调试口
window.G = { Game: { startRun, pauseGame, resumeGame }, UI: ui, Render: renderer, Audio: audio, Save: save };
window.__ll = {
  get state() { return { phase: state, simPhase: run.phase, wave: run.wave, lang: ui.lang(), dir: ui.dir() }; },
  get run() { return run; },
  start: startRun,
  pause: pauseGame,
  resume: resumeGame,
  restart: toMenu,
  startAct: startRun,
  startWave: () => { if (run.phase === 'build') run.earlyStart(); },
  buildTower: (type, c, r) => run.build(type, c, r),
  startTutorial: () => ui.tutorial.start(),
  get tutorial() {
    const t = ui.tutorial;
    return { active: t.active, step: t.step, steps: t.steps, current: t.current, skip: () => t.skip() };
  },
  demo: { win: () => { run.phase = 'won'; }, lose: () => { run.phase = 'lost'; } },
  save: () => save,
  ui: () => ui,
  lang: () => ui.lang(),
  setLang: (l) => ui.setLang(l),
};
