// 主入口：FRONT WARS。title → loadout → playing ⇄ paused → round/perk → match over。
import { STEP, RULES } from '../config/game.config.js';
import {
  createRun, createTutorialRun, tick, getHud, drainEvents, getPerkChoices, nextRound,
} from './game/sim.js';
import { createRenderer } from './render/index.js';
import { ui } from './ui/ui.js';
import { audio } from './audio.js';
import Sdk from './core/sdk.js';
import { t, i18n } from './core/i18n.js';

const canvas = document.getElementById('canvas');
const renderer = createRenderer(canvas);
const keys = { up: false, down: false, left: false, right: false };
const mouse = { x: 640, y: 360, down: false };
const touchMove = { x: 0, y: 0 };
const touchAim = { x: 0, y: 0, active: false };
let dashQueued = false;
let run = createRun({ seed: 1 });
let state = 'title';
let wins = Number(Sdk.load('wins', 0)) || 0;
let tutorialDone = !!Sdk.load('tutorialDone', false) || /(?:^|[#&])tutorialDone(?:$|[&])/.test(location.hash);
let lastTime = performance.now();
let accumulator = 0;
let pending = null;
let currentLoadout = 'rifleman';

// telemetry
let runStartedAt = 0;
let firstInputAt = null;
let firstKillAt = null;
let lastInteractionAt = 0;
let lastEventAt = 0;
let idleSec = 0;
let maxEventGapSec = 0;
let actions = 0;
let deaths = 0;
const latencies = [];
const eventTypes = new Set();
let pendingInputAt = 0;
const llState = { phase: 'title', lang: ui.lang, dir: ui.dir };

function syncLl() { llState.phase = state; llState.lang = ui.lang; llState.dir = ui.dir; }
function nowSec() { return (performance.now() - runStartedAt) / 1000; }
function markInput() {
  if (state !== 'playing') return;
  const now = performance.now();
  lastInteractionAt = now;
  if (firstInputAt === null) firstInputAt = nowSec();
  pendingInputAt = now;
  requestAnimationFrame(() => {
    if (!pendingInputAt) return;
    latencies.push(performance.now() - pendingInputAt);
    pendingInputAt = 0;
  });
}
function noteEvent(ev) {
  const now = performance.now();
  if (lastEventAt) maxEventGapSec = Math.max(maxEventGapSec, (now - lastEventAt) / 1000);
  lastEventAt = now;
  eventTypes.add(ev.type);
}

function canvasPos(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height) };
}

function resetSession(mode) {
  accumulator = 0;
  runStartedAt = performance.now();
  firstInputAt = null;
  firstKillAt = null;
  lastInteractionAt = runStartedAt;
  lastEventAt = 0;
  maxEventGapSec = 0;
  idleSec = 0;
  actions = 0;
  deaths = 0;
  latencies.length = 0;
  eventTypes.clear();
  pending = null;
  dashQueued = false;
  touchMove.x = touchMove.y = 0;
  touchAim.x = touchAim.y = 0; touchAim.active = false;
  mouse.down = false;
  state = 'playing';
  syncLl();
  Sdk.newRun({ mode });
  ui.showGame();
  ui.hideEnd();
}

function startMatch(loadout = currentLoadout) {
  currentLoadout = loadout;
  run = createRun({ seed: Math.floor(Math.random() * 0x7fffffff), loadout });
  renderer.clearEffects();
  ui.endTutorialUI();
  resetSession('frontwars');
  ui.showRoundBanner(getHud(run));
  syncUi();
  lastTime = performance.now();
}

function startTutorial() {
  run = createTutorialRun();
  renderer.clearEffects();
  ui.hidePause();
  ui.endTutorialUI();
  resetSession('tutorial');
  ui.startTutorialUI();
  syncUi();
  lastTime = performance.now();
}

function finishTutorial() {
  tutorialDone = true;
  Sdk.save('tutorialDone', true);
  try {
    if (!/[#&]tutorialDone(?:$|[&])/.test(location.hash)) {
      history.replaceState(null, '', `${location.pathname}${location.search}#tutorialDone`);
    }
  } catch { /* sandbox */ }
  ui.endTutorialUI();
  showLoadout();
}

function showLoadout() {
  state = 'loadout';
  syncLl();
  ui.showLoadout((id) => { audio.unlock(); startMatch(id); }, backToTitle);
}

function backToTitle() {
  state = 'title';
  syncLl();
  ui.endTutorialUI();
  ui.showTitle();
  ui.updateBest(wins);
}
function pauseGame() {
  if (state !== 'playing' || ui.tutorialActive) return;
  state = 'paused'; syncLl(); ui.showPause();
}
function resumeGame() {
  if (state !== 'paused') return;
  state = 'playing'; syncLl(); ui.hidePause(); lastTime = performance.now();
}
function doMute() { audio.setMuted(!audio.muted); Sdk.save('muted', audio.muted); ui.updateMute(audio.muted); }

function syncUi() {
  const hud = getHud(run);
  ui.updateHUD(hud);
  ui.updateTutorial(hud);
}

function handleRoundEnd() {
  if (run.phase === 'matchOver') {
    state = 'over'; syncLl();
    if (run.matchWinner === 0) {
      wins += 1; Sdk.save('wins', wins); audio.win();
    } else audio.lose();
    Sdk.gameOver({ winner: run.matchWinner, rounds: run.roundWins });
    ui.showEnd(getHud(run), wins, () => showLoadout(), backToTitle);
    return;
  }
  state = 'round'; syncLl();
  const hud = getHud(run);
  const choices = getPerkChoices(run, 3);
  audio.round();
  const advance = (perkId) => {
    nextRound(run, perkId);
    state = 'playing'; syncLl();
    ui.showGame();
    ui.showRoundBanner(getHud(run));
    syncUi();
    lastTime = performance.now();
  };
  ui.showRoundResult(hud, choices, advance, () => advance(null));
}

function processEvents() {
  for (const ev of drainEvents(run)) {
    noteEvent(ev);
    if (ev.type === 'shoot') {
      if (ev.id === 0) { audio.shoot(); renderer.muzzle(run.players[0].x, run.players[0].y, run.players[0].aim); }
      else {
        const p = run.players[ev.id];
        if (p) renderer.muzzle(p.x, p.y, p.aim, ev.team === 0 ? '#7dd3fc' : '#fda4af');
      }
    } else if (ev.type === 'hit') {
      const p = run.players[ev.id];
      if (p) renderer.addSpark(ev.x, ev.y, ev.team === 0 ? '#7dd3fc' : '#fda4af', 6);
      if (ev.id === 0) { ui.flashHurt(); renderer.flash(0.12); audio.hit(); }
      if (ev.team === 0 && ev.id !== 0) renderer.markHit();
      renderer.addText(ev.x, ev.y - 10, String(ev.dmg), ev.team === 0 ? '#fef3c7' : '#fda4af');
    } else if (ev.type === 'kill') {
      const v = run.players[ev.victim];
      if (v) renderer.addSpark(v.x, v.y, ev.team === 0 ? '#7dd3fc' : '#fda4af', 12);
      ui.updateKillFeed([ev]);
      if (ev.killer === 0) { audio.kill(); if (firstKillAt === null) firstKillAt = nowSec(); Sdk.track('kill', { team: ev.team }); }
      if (ev.victim === 0) { deaths += 1; audio.death(); renderer.flash(0.25); ui.flashHurt(); }
    } else if (ev.type === 'dash') {
      if (ev.id === 0) audio.dash();
    } else if (ev.type === 'respawn') {
      if (ev.id === 0) audio.respawn();
    } else if (ev.type === 'pickupSpawn') {
      ui.toast(t('pickupOnline'), 'gold'); audio.pickup();
    } else if (ev.type === 'pickup') {
      if (ev.id === 0) { ui.toast(`⚡ ${t('overdrive')}`, 'gold'); audio.pickup(); }
    } else if (ev.type === 'overtime') {
      ui.toast(t('overtime'), 'gold'); audio.warning();
    } else if (ev.type === 'roundEnd') {
      audio.round();
      pending = { kind: 'round' };
    } else if (ev.type === 'matchWin') {
      pending = { kind: 'match' };
    } else if (ev.type === 'tutorialStep') {
      audio.click();
    } else if (ev.type === 'tutorialDone') {
      ui.showTutorialComplete();
      Sdk.track('tutorial_complete', {});
    }
  }
}

function handlePending() {
  if (!pending) return;
  const kind = pending.kind;
  pending = null;
  if (kind === 'round' || kind === 'match') handleRoundEnd();
}

function buildInput() {
  const me = run.players[0];
  let aim = Math.atan2(mouse.y - me.y, mouse.x - me.x);
  if (touchAim.active && Math.hypot(touchAim.x, touchAim.y) > 0.18) {
    aim = Math.atan2(touchAim.y, touchAim.x);
  }
  let up = keys.up, down = keys.down, left = keys.left, right = keys.right;
  if (Math.hypot(touchMove.x, touchMove.y) > 0.18) {
    left = touchMove.x < -0.25; right = touchMove.x > 0.25;
    up = touchMove.y < -0.25; down = touchMove.y > 0.25;
  }
  const shoot = mouse.down || (touchAim.active && Math.hypot(touchAim.x, touchAim.y) > 0.28);
  return { up, down, left, right, aim, shoot, dash: dashQueued };
}

// ---- input ----
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (state === 'playing') pauseGame(); else if (state === 'paused') resumeGame();
    return;
  }
  if (state !== 'playing') return;
  if (e.code === 'KeyW' || e.code === 'ArrowUp') keys.up = true;
  if (e.code === 'KeyS' || e.code === 'ArrowDown') keys.down = true;
  if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = true;
  if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = true;
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'Space') {
    e.preventDefault();
    dashQueued = true;
    actions += 1;
    markInput();
  }
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) { actions += 1; markInput(); }
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'KeyW' || e.code === 'ArrowUp') keys.up = false;
  if (e.code === 'KeyS' || e.code === 'ArrowDown') keys.down = false;
  if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = false;
  if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = false;
});
canvas.addEventListener('pointermove', (e) => {
  const p = canvasPos(e); mouse.x = p.x; mouse.y = p.y;
  if (e.pointerType === 'mouse') markInput();
});
canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  const p = canvasPos(e); mouse.x = p.x; mouse.y = p.y; mouse.down = true;
  actions += 1;
  markInput();
});
window.addEventListener('pointerup', () => { mouse.down = false; });
window.addEventListener('blur', () => {
  for (const k of Object.keys(keys)) keys[k] = false;
  mouse.down = false;
  if (state === 'playing') pauseGame();
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('resize', () => ui.setTouchMode(matchMedia('(pointer: coarse)').matches || innerWidth < 900));

function setupStick(el, onMove) {
  const knob = el.querySelector('.knob');
  let id = null;
  const update = (e) => {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let dx = (e.clientX - cx) / (r.width * 0.38);
    let dy = (e.clientY - cy) / (r.height * 0.38);
    const mag = Math.hypot(dx, dy);
    if (mag > 1) { dx /= mag; dy /= mag; }
    knob.style.transform = `translate(${dx * 26}px, ${dy * 26}px)`;
    onMove(dx, dy);
  };
  el.addEventListener('pointerdown', (e) => {
    id = e.pointerId; el.setPointerCapture(id); audio.unlock(); markInput(); update(e);
  });
  el.addEventListener('pointermove', (e) => { if (e.pointerId === id) update(e); });
  const end = (e) => {
    if (e.pointerId !== id) return;
    id = null; knob.style.transform = 'translate(0,0)'; onMove(0, 0);
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}

// ---- buttons/screens ----
ui.btnStart.addEventListener('click', () => { audio.unlock(); if (tutorialDone) showLoadout(); else startTutorial(); });
ui.btnHowto.addEventListener('click', () => { audio.unlock(); startTutorial(); });
ui.btnHowtoPause.addEventListener('click', () => { audio.unlock(); startTutorial(); });
ui.btnResume.addEventListener('click', resumeGame);
ui.btnRestart.addEventListener('click', () => { audio.unlock(); startMatch(currentLoadout); });
ui.btnAgain.addEventListener('click', () => { audio.unlock(); showLoadout(); });
ui.btnTitle.addEventListener('click', backToTitle);
ui.btnTitleEnd.addEventListener('click', backToTitle);
ui.btnMute.addEventListener('click', doMute);
ui.btnPause.addEventListener('click', () => { if (state === 'playing') pauseGame(); });
ui.tutorialSkip.addEventListener('click', finishTutorial);
ui.tutorialNext.addEventListener('click', finishTutorial);
for (const sel of ui.langSelects) {
  if (sel) sel.addEventListener('change', (e) => {
    ui.setLang(e.target.value); syncLl();
    if (state === 'playing' || state === 'paused') syncUi();
  });
}
setupStick(document.getElementById('stick-move'), (x, y) => { touchMove.x = x; touchMove.y = y; if (x || y) markInput(); });
setupStick(document.getElementById('stick-aim'), (x, y) => {
  touchAim.x = x; touchAim.y = y; touchAim.active = Math.hypot(x, y) > 0.18;
  if (touchAim.active) markInput();
});
document.getElementById('btn-dash').addEventListener('pointerdown', (e) => {
  e.preventDefault(); audio.unlock(); dashQueued = true; actions += 1; markInput();
});

Sdk.onAdStart(() => pauseGame());
Sdk.onAdEnd(() => resumeGame());

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  if (state === 'playing') {
    accumulator += dt;
    while (accumulator >= STEP) {
      tick(run, STEP, buildInput());
      dashQueued = false;
      accumulator -= STEP;
    }
    if (now - lastInteractionAt > 1500) idleSec += dt;
    processEvents();
    handlePending();
    syncUi();
  }
  renderer.update(dt);
  renderer.render({ run, hud: getHud(run), mouse: ui.touchMode ? null : mouse });
}

Sdk.ready();
audio.setMuted(Sdk.load('muted', false));
ui.setTouchMode(matchMedia('(pointer: coarse)').matches || innerWidth < 900);
ui.applyLang();
ui.showTitle();
ui.updateBest(wins);
ui.updateMute(audio.muted);
syncLl();
requestAnimationFrame(loop);

// ---- debug / telemetry ----
function telemetry(policy) {
  if (policy) window.__llPolicy = policy;
  const sum = latencies.reduce((a, b) => a + b, 0);
  return {
    game: 'front-wars',
    genre: 'action',
    policy: window.__llPolicy || 'human',
    durationSec: Math.max(0.1, nowSec()),
    firstInputSec: firstInputAt === null ? 0 : Math.round(firstInputAt * 10) / 10,
    inputLatencyMs: latencies.length ? Math.round(sum / latencies.length) : 0,
    firstSuccessSec: firstKillAt === null ? null : Math.round(firstKillAt * 10) / 10,
    deaths,
    actions,
    idleSec: Math.round(idleSec * 10) / 10,
    maxEventGapSec: Math.round(maxEventGapSec * 10) / 10,
    uniqueEvents: eventTypes.size,
    levelsReached: Math.min(3, run.round + 1),
    completed: run.phase === 'matchOver',
  };
}

window.G = { run: () => run, state: () => state, ui };
window.__ll = {
  state: llState,
  start: () => startMatch('rifleman'),
  startAct: () => startMatch('rifleman'),
  startTutorial,
  startMatch,
  pause: pauseGame,
  resume: resumeGame,
  restart: backToTitle,
  get sim() { return run; },
  save: (k, v) => Sdk.save(k, v),
  load: (k, d) => Sdk.load(k, d),
  ui: () => ui,
  telemetry,
  get tutorial() {
    return {
      active: ui.tutorialActive,
      step: ui.tutorialStepIndex,
      steps: ui.tutorialSteps.map((x) => x.id),
      current: ui.tutorialSteps[ui.tutorialStepIndex]?.id || null,
      skip: finishTutorial,
    };
  },
  debug: {
    state: () => getHud(run),
    step: (sec, input) => { const n = Math.ceil(sec * 60); for (let i = 0; i < n; i += 1) tick(run, 1 / 60, input || {}); processEvents(); syncUi(); return getHud(run); },
    setScores: (a, b) => { run.scores = [a, b]; return [...run.scores]; },
    kill: (id) => { const q = run.players[id]; q.alive = false; q.hp = 0; q.respawnT = RULES.respawn; run.scores[1 - q.team] += 1; return getHud(run); },
    winRound: (team = 0) => { run.scores = team === 0 ? [RULES.killTarget, 0] : [0, RULES.killTarget]; tick(run, 0, {}); processEvents(); handlePending(); return getHud(run); },
    nextRound: (perk) => { nextRound(run, perk); state = 'playing'; syncLl(); ui.showGame(); syncUi(); return getHud(run); },
    playAll: () => {
      run.players[0].isBot = true;
      let guard = 0;
      while (run.phase !== 'matchOver' && guard < 60 * 480) {
        tick(run, 1 / 60, {});
        processEvents();
        if (run.phase === 'roundOver') { nextRound(run, null); state = 'playing'; }
        guard += 1;
      }
      return getHud(run);
    },
  },
};
