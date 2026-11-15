// src/main.js — 装配：60Hz 固定步长 + 状态机 + 输入 + 事件分发 + SDK 漏斗 + 标准调试口。
import { STEP, PLAYER, ratingOf, WEAPON_ORDER } from '../config/game.config.js';
import { createRun, updateSim, drainEvents, getHud, applyUpgrade } from './game/sim.js';
import { createRenderer } from './render/index.js';
import { ui } from './ui/ui.js';
import { save } from './core/save.js';
import { i18n } from './core/i18n.js';
import { createAudio } from './core/audio.js';
import { Sdk } from './core/sdk.js';
import { Input } from './core/base3d.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const $ = (id) => document.getElementById(id);
const canvas = $('canvas');
const renderer = createRenderer(canvas);
const audio = createAudio();
const input = new Input(canvas);
const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

let state = 'title'; // title | playing | paused | results
let run = createRun({ seed: 1 });
run.hud = getHud(run);
let ended = false;
let lastTime = performance.now(), accumulator = 0;
let yaw = 0, pitch = 0, lastYaw = 0, lastPitch = 0;

// ---------------------------------------------------------------- 输入（鼠标按键 + 触屏按钮）
let mouseFire = false, mouseAim = false;
let touchFire = false, touchAim = false, touchSprint = false;
let touchReloadQueued = false, touchSwitchQueued = null;

window.addEventListener('mousedown', (e) => {
  if (state !== 'playing') return;
  if (e.button === 0) { mouseFire = true; if (!input.locked && !isTouch) input.requestLock(); }
  if (e.button === 2) mouseAim = true;
});
window.addEventListener('mouseup', (e) => {
  if (e.button === 0) mouseFire = false;
  if (e.button === 2) mouseAim = false;
});
window.addEventListener('contextmenu', (e) => e.preventDefault());

const joy = { x: 0, y: 0, id: null, bx: 0, by: 0 };
function setupJoy() {
  const base = $('touch-joy'), knob = $('touch-joy-knob');
  const R = 44;
  base.addEventListener('pointerdown', (e) => { e.preventDefault(); joy.id = e.pointerId; joy.bx = e.clientX; joy.by = e.clientY; base.setPointerCapture(e.pointerId); });
  base.addEventListener('pointermove', (e) => {
    if (e.pointerId !== joy.id) return;
    let dx = (e.clientX - joy.bx) / R, dy = (e.clientY - joy.by) / R;
    const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
    joy.x = dx; joy.y = -dy;
    knob.style.transform = `translate(-50%, -50%) translate(${dx * 22}px, ${-dy * 22}px)`;
  });
  const up = (e) => { if (e.pointerId === joy.id) { joy.id = null; joy.x = 0; joy.y = 0; knob.style.transform = 'translate(-50%, -50%)'; } };
  base.addEventListener('pointerup', up); base.addEventListener('pointercancel', up);
}
if ($('touch-joy')) setupJoy();
function bindTouch(id, set) {
  const elm = $(id);
  if (!elm) return;
  elm.addEventListener('pointerdown', (e) => { e.preventDefault(); elm.classList.add('active'); set(true); });
  const up = (e) => { e.preventDefault(); elm.classList.remove('active'); set(false); };
  elm.addEventListener('pointerup', up); elm.addEventListener('pointercancel', up); elm.addEventListener('pointerleave', up);
}
bindTouch('btn-touch-fire', (v) => (touchFire = v));
bindTouch('btn-touch-aim', (v) => (touchAim = v));
bindTouch('btn-touch-sprint', (v) => (touchSprint = v));
$('btn-touch-reload')?.addEventListener('pointerdown', (e) => { e.preventDefault(); touchReloadQueued = true; });
document.querySelectorAll('.touch-w').forEach((b) => {
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); touchSwitchQueued = b.dataset.w; });
});

function readInput() {
  if (window.__AUTO) {
    const a = window.__AUTO;
    return { forward: a.forward || 0, strafe: a.strafe || 0, yaw: a.yaw ?? yaw, pitch: a.pitch ?? pitch, fire: !!a.fire, aim: !!a.aim, sprint: !!a.sprint, reload: !!a.reload, switchTo: a.switchTo || null };
  }
  yaw -= (input.mouseDX + input.touchLook.x * 3) * PLAYER.sensitivity;
  pitch -= (input.mouseDY + input.touchLook.y * 3) * PLAYER.sensitivity;
  pitch = clamp(pitch, PLAYER.pitchMin, PLAYER.pitchMax);

  const fwd = (input.down('KeyW') ? 1 : 0) - (input.down('KeyS') ? 1 : 0) - input.touchMove.y - joy.y;
  const str = (input.down('KeyD') ? 1 : 0) - (input.down('KeyA') ? 1 : 0) + input.touchMove.x + joy.x;
  const reload = input.hit('KeyR') || touchReloadQueued;
  let switchTo = null;
  if (input.hit('Digit1')) switchTo = 'rifle';
  else if (input.hit('Digit2')) switchTo = 'shotgun';
  else if (input.hit('Digit3')) switchTo = 'pistol';
  if (touchSwitchQueued) switchTo = touchSwitchQueued;
  touchReloadQueued = false; touchSwitchQueued = null;
  return {
    forward: fwd, strafe: str, yaw, pitch,
    fire: mouseFire || touchFire, aim: mouseAim || touchAim,
    sprint: input.down('ShiftLeft') || input.down('ShiftRight') || touchSprint,
    reload, switchTo,
  };
}

// ---------------------------------------------------------------- 流程
function startRun() {
  run = createRun({ seed: (Math.random() * 1e9) | 0 });
  run.hud = getHud(run);
  ended = false;
  ui.upgradeShown = false;
  yaw = 0; pitch = 0; lastYaw = 0; lastPitch = 0;
  state = 'playing';
  ui.showGame();
  audio.ensure(); audio.resume();
  audio.event('start');
  Sdk.newRun({});
  if (!save.get('tutDone', false)) ui.tutorial.start();
  lastTime = performance.now();
  accumulator = 0;
  input.endFrame();
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
  input.endFrame();
}

function endRun() {
  ended = true;
  state = 'results';
  const stats = run.stats;
  const accuracy = stats.shots ? Math.round((stats.hits / stats.shots) * 100) : 0;
  const rating = ratingOf(stats, run.time, stats.deaths);
  const score = Math.round(run.score);
  const best = Math.max(save.get('best', 0), score);
  const isRecord = score > save.get('best', 0) && score > 0;
  save.set('best', best);
  Sdk.levelCleared({ score, rating });
  audio.stopAll();
  audio.event('victory');
  ui.showResults({
    win: run.phase === 'victory', rating, score, best, isRecord,
    kills: stats.kills, headshots: stats.headshots, accuracy,
    waves: run.mapIndex * 5 + run.wave, time: run.time,
  });
}

ui.onUpgradePick = (id) => {
  if (state === 'playing' && run.phase === 'upgrade') {
    applyUpgrade(run, id);
    audio.event('upgradeTaken');
  }
};

// ---------------------------------------------------------------- 事件分发
function dispatch(ev) {
  audio.event(ev.type);
  ui.popup(ev);
  renderer.onEvent(ev);
  const tut = ui.tutorial;
  if (tut.active) {
    if (tut.step === 2 && ev.type === 'shot') tut.next();
    else if (tut.step === 3 && (ev.type === 'reload' || ev.type === 'kill')) tut.next();
  }
  if (ev.type === 'headshot') Sdk.track('headshot', {});
  if (ev.type === 'upgradeTaken') Sdk.track('upgrade', { id: ev.id });
  if (ev.type === 'waveClear') Sdk.track('waveClear', { wave: ev.wave });
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
      // 升级屏 1/2/3 快捷键
      if (run.phase === 'upgrade') {
        if (input.hit('Digit1') && run.upgradeChoices[0]) ui.onUpgradePick(run.upgradeChoices[0].id);
        else if (input.hit('Digit2') && run.upgradeChoices[1]) ui.onUpgradePick(run.upgradeChoices[1].id);
        else if (input.hit('Digit3') && run.upgradeChoices[2]) ui.onUpgradePick(run.upgradeChoices[2].id);
      }
      updateSim(run, inp);
      run.hud = getHud(run);
      if (ui.tutorial.active) {
        if (ui.tutorial.step === 0 && (inp.forward || inp.strafe)) ui.tutorial.next();
        else if (ui.tutorial.step === 1 && (Math.abs(inp.yaw - lastYaw) > 0.02 || Math.abs(inp.pitch - lastPitch) > 0.02)) ui.tutorial.next();
      }
      lastYaw = inp.yaw; lastPitch = inp.pitch;
      for (const ev of drainEvents(run)) dispatch(ev);
      accumulator -= STEP;
      if (run.phase === 'victory' && !ended) { endRun(); break; }
      if (run.phase === 'upgrade' && !ui.upgradeShown) { ui.showUpgrade(run.upgradeChoices.map((c) => c.id)); ui.upgradeShown = true; }
      else if (run.phase !== 'upgrade' && ui.upgradeShown) { ui.hideUpgrade(); ui.upgradeShown = false; }
    }
    ui.updateHUD(run.hud);
  }

  input.endFrame();
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
  Sdk.share({ title: 'BLAZE FPS', text: `I cleared ${run.stats.kills} kills in BLAZE FPS!` });
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
function syncStage() {
  const ww = innerWidth, wh = innerHeight;
  let w = ww, h = (ww * 9) / 16;
  if (h > wh) { h = wh; w = (wh * 16) / 9; }
  $('stage').style.transform = `translate(-50%, -50%) scale(${w / 1280})`;
}
window.addEventListener('resize', () => { updateRotate(); syncStage(); });

window.addEventListener('blur', () => { if (state === 'playing') pauseGame(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'playing') pauseGame();
});
window.addEventListener('pagehide', () => Sdk.track('session_end', { best: save.get('best', 0) }));

// ---------------------------------------------------------------- 启动
audio.setMuted(save.get('muted', false));
Sdk.ready().then(() => Sdk.track('load', { appId: 'pipy-blaze-fps' }));
ui.applyLang();
ui.showTitle();
updateRotate();
syncStage();
lastTime = performance.now();
requestAnimationFrame(loop);

// ---------------------------------------------------------------- 标准调试口
window.G = { Game: { startRun, pauseGame, resumeGame, toMenu }, UI: ui, Render: renderer, Audio: audio, Save: save };
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
  demo: {
    win() { if (state === 'playing') { run.phase = 'victory'; if (!ended) endRun(); } },
    dead() { if (state === 'playing') { run.player.hp = 0; } },
  },
  telemetry() {
    return {
      durationSec: +run.time.toFixed(2), deaths: run.stats.deaths,
      kills: run.stats.kills, levelsReached: run.mapIndex * 5 + run.wave, completed: run.phase === 'victory',
    };
  },
  save: () => save,
  ui: () => ui,
  lang: () => ui.lang,
  setLang: (l) => ui.setLang(l),
  setInput: (obj) => { window.__AUTO = obj; },
};
