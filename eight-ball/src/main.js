// 主入口：60Hz 固定步长主循环 + 拖拽瞄准 + 暂停/静音 + SDK 接线 + __ll 调试契约。
import { AI, AIM, LAYOUT, PLAY, STEP, TABLE, WORLD } from '../config/game.config.js';
import Sdk from './core/sdk.js';
import { t } from './core/i18n.js';
import { CUE } from './game/balls.js';
import { PLAYER, RIVAL } from './game/match.js';
import { createSim } from './game/sim.js';
import { createRenderer } from './render/index.js';
import Sound from './ui/audio.js';
import { foulText, ui } from './ui/ui.js';

const SAVE_KEY = 'progress';
const MAX_CATCHUP = 6;
const DEG = Math.PI / 180;

const renderer = createRenderer(ui.canvas);
const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

const store = Object.assign(
  { wins: 0, losses: 0, muted: false, aiLevel: AI.DEFAULT },
  readStored(),
);
if (!AI.LEVELS[store.aiLevel]) store.aiLevel = AI.DEFAULT;

function readStored() {
  const raw = Sdk.load(SAVE_KEY, null);
  return raw && typeof raw === 'object' ? raw : {};
}

function persist() {
  Sdk.save(SAVE_KEY, store);
}

let sim = makeSim();
let prev = sim.hud();
let phase = 'title';
let accumulator = 0;
let last = 0;
let pointerMode = '';

const llState = { phase: 'title', lang: ui.lang };

function nextSeed() {
  return (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) & 0x7fffffff;
}

function makeSim() {
  return createSim({
    seed: nextSeed(),
    aiLevel: store.aiLevel,
    reduceMotion: reduceMotionQuery.matches,
  });
}

function setPhase(next) {
  phase = next;
  llState.phase = next;
  llState.lang = ui.lang;
}

function matchOver() {
  return sim.match.phase === 'over';
}

function canPlay() {
  return phase === 'playing' && !matchOver();
}

// —— 流程 ——
function startMatch() {
  sim = makeSim();
  prev = sim.hud();
  accumulator = 0;
  last = performance.now();
  pointerMode = '';
  ui.hideToast();
  ui.showGame();
  setPhase('playing');
  Sdk.newRun({ mode: 'eight_ball', level: store.aiLevel });
  Sdk.track('rack_up', { level: store.aiLevel });
}

function goTitle() {
  sim = makeSim();
  prev = sim.hud();
  pointerMode = '';
  ui.showTitle(store);
  setPhase('title');
}

function pauseGame() {
  if (phase !== 'playing') return false;
  setPhase('paused');
  ui.showPause();
  Sdk.track('pause', {});
  return true;
}

function resumeGame() {
  if (phase !== 'paused') return false;
  setPhase('playing');
  last = performance.now();
  accumulator = 0;
  ui.hidePause();
  return true;
}

function togglePause() {
  if (phase === 'playing') pauseGame();
  else if (phase === 'paused') resumeGame();
}

function toggleSound() {
  store.muted = !store.muted;
  Sound.setMuted(store.muted);
  ui.setSound(store.muted);
  persist();
  Sdk.track('sound_toggle', { muted: store.muted });
}

// —— 输入：按住白球附近往后拖，反方向出杆，拖距=力度 ——
function toWorld(event) {
  const box = ui.canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - box.left) * WORLD.WIDTH) / box.width,
    y: ((event.clientY - box.top) * WORLD.HEIGHT) / box.height,
  };
}

function cueBall() {
  return sim.world.balls.find((b) => b.id === CUE) || null;
}

function nearCue(p) {
  const cue = cueBall();
  if (!cue) return false;
  return Math.hypot(p.x - cue.x, p.y - cue.y) <= AIM.GRAB;
}

function humanTurn() {
  const match = sim.match;
  return (
    canPlay() &&
    match.turn === PLAYER &&
    (match.phase === 'aim' || match.phase === 'break') &&
    sim.stick.state === 'idle'
  );
}

ui.canvas.addEventListener('pointerdown', (event) => {
  Sound.unlock();
  if (!canPlay()) return;
  const p = toWorld(event);
  if (!nearCue(p)) return;
  event.preventDefault();
  if (ui.canvas.setPointerCapture) {
    try {
      ui.canvas.setPointerCapture(event.pointerId);
    } catch {
      /* 指针已释放 */
    }
  }
  if (sim.match.ballInHand && humanTurn()) {
    pointerMode = sim.beginPlace(p.x, p.y) ? 'place' : '';
    return;
  }
  if (humanTurn()) pointerMode = sim.beginAim(p.x, p.y) ? 'aim' : '';
});

ui.canvas.addEventListener('pointermove', (event) => {
  if (!canPlay()) return;
  const p = toWorld(event);
  if (pointerMode === 'aim') sim.moveAim(p.x, p.y);
  else if (pointerMode === 'place') sim.movePlace(p.x, p.y);
  else if (humanTurn()) sim.hoverAim(p.x, p.y);
});

function releasePointer() {
  if (pointerMode === 'aim') sim.endAim();
  else if (pointerMode === 'place') sim.endPlace();
  pointerMode = '';
}

ui.canvas.addEventListener('pointerup', releasePointer);
ui.canvas.addEventListener('pointercancel', releasePointer);

window.addEventListener('keydown', (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.code === 'Escape' || event.code === 'KeyP') {
    event.preventDefault();
    togglePause();
  }
});

window.addEventListener('blur', () => pauseGame());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseGame();
});
window.addEventListener('resize', layout);
reduceMotionQuery.addEventListener('change', (event) => {
  sim.reduceMotion = event.matches;
});

// —— 按钮与语言 ——
ui.btnStart.addEventListener('click', () => {
  Sound.unlock();
  startMatch();
});
ui.btnAgain.addEventListener('click', () => startMatch());
ui.btnResume.addEventListener('click', () => resumeGame());
ui.btnPause.addEventListener('click', () => togglePause());
ui.btnRestart.addEventListener('click', () => goTitle());
ui.btnQuit.addEventListener('click', () => goTitle());
ui.btnSound.addEventListener('click', () => toggleSound());
ui.aiSelect.addEventListener('change', (event) => {
  store.aiLevel = event.target.value;
  persist();
  Sdk.track('level_select', { level: store.aiLevel });
});
for (const sel of ui.langSelects) {
  if (!sel) continue;
  sel.addEventListener('change', (event) => {
    ui.setLang(event.target.value);
    llState.lang = ui.lang;
    Sdk.track('lang_change', { lang: ui.lang });
  });
}

function layout() {
  const scale = Math.min(window.innerWidth / WORLD.WIDTH, window.innerHeight / WORLD.HEIGHT);
  ui.setScale(scale);
}

// —— 每帧表现层同步：音效队列、HUD、事件提示 ——
function playSfx() {
  let guard = 0;
  while (sim.sfx.length && guard < 8) {
    const s = sim.sfx.shift();
    Sound.play(s.name, s);
    guard += 1;
  }
}

function syncHud() {
  const hud = sim.hud();
  ui.updateHud(hud);

  if (hud.shots[PLAYER] + hud.shots[RIVAL] > prev.shots[PLAYER] + prev.shots[RIVAL]) {
    Sdk.track('shot_fired', { level: store.aiLevel, turn: hud.turn });
  }

  const potted = prev.left[PLAYER].concat(prev.left[RIVAL]).filter((id) =>
    hud.left[PLAYER].concat(hud.left[RIVAL]).indexOf(id) < 0);
  for (const id of potted) Sdk.track('ball_potted', { id, turn: hud.turn });

  if (hud.foul && hud.foul !== prev.foul) {
    ui.toast(foulText(hud.foul), 'foul');
    Sdk.track('foul', { reason: hud.foul.reason, by: hud.foul.by });
  } else if (!hud.foul && prev.foul) {
    ui.hideToast();
  }

  if (!prev.groups[PLAYER] && hud.groups[PLAYER]) {
    ui.toast(t('group_you', { group: t(hud.groups[PLAYER]) }), 'good');
    Sdk.track('group_set', { you: hud.groups[PLAYER] });
  }

  if (hud.phase === 'over' && prev.phase !== 'over') finishMatch(hud);
  prev = hud;
}

function finishMatch(hud) {
  const win = hud.result === 'win';
  setPhase('over');
  store[win ? 'wins' : 'losses'] = (store[win ? 'wins' : 'losses'] | 0) + 1;
  persist();
  ui.updateRecord(store);
  ui.showResult(hud);
  if (win) Sdk.levelCleared({ mode: 'eight_ball', shots: hud.shots[PLAYER] });
  else Sdk.gameOver({ reason: hud.resultReason, shots: hud.shots[PLAYER] });
  Sdk.track('match_over', {
    result: hud.result,
    reason: hud.resultReason,
    level: store.aiLevel,
    shots: hud.shots[PLAYER] + hud.shots[RIVAL],
  });
}

function syncCursor() {
  if (!canPlay()) return ui.setCursor('');
  if (pointerMode === 'place') return ui.setCursor('hand');
  if (pointerMode === 'aim') return ui.setCursor('drag');
  return ui.setCursor(humanTurn() ? 'grab' : '');
}

// —— 主循环：固定 1/60 步长累加器，渲染每帧一次 ——
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.2);
  last = now;

  if (phase === 'playing' || phase === 'over') {
    accumulator += dt;
    let guard = 0;
    while (accumulator >= STEP && guard < MAX_CATCHUP) {
      sim.step(STEP);
      accumulator -= STEP;
      guard += 1;
    }
    if (guard >= MAX_CATCHUP) accumulator = 0;
  }

  renderer.render(phase === 'title' ? null : sim);
  playSfx();
  syncHud();
  syncCursor();
}

// —— 调试：把某一方设为出杆方并立即击球 ——
function forceTurn(who) {
  const match = sim.match;
  if (match.phase === 'over' || match.phase === 'moving') return false;
  if (sim.stick.state !== 'idle') return false;
  match.turn = who;
  match.ballInHand = false;
  return true;
}

function debugShot(who, angleDeg, power) {
  if (!forceTurn(who)) return false;
  return sim.beginStrike({ angle: angleDeg * DEG, power, by: who });
}

Sound.setMuted(store.muted);
ui.setSound(store.muted);
ui.aiSelect.value = store.aiLevel;
layout();
ui.showTitle(store);

Sdk.ready();
Sdk.onAdStart(() => pauseGame());
Sdk.onAdEnd(() => resumeGame());
Sdk.track('boot', { lang: ui.lang, level: store.aiLevel });

requestAnimationFrame(frame);

window.__ll = {
  state: llState,
  get lang() {
    return ui.lang;
  },
  setLang: (code) => {
    ui.setLang(code);
    llState.lang = ui.lang;
    return ui.lang;
  },
  start: () => startMatch(),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => goTitle(),
  get sim() {
    return sim;
  },
  get match() {
    return sim.match;
  },
  save: (key, value) => Sdk.save(key, value),
  ui,
  debug: {
    shoot: (angleDeg, power) => debugShot(PLAYER, angleDeg, power),
    rivalShoot: (angleDeg, power) => debugShot(RIVAL, angleDeg, power),
    aiShoot: () => {
      if (!forceTurn(RIVAL)) return false;
      const plan = sim.match.planAiShot();
      if (!plan) return false;
      return sim.beginStrike({ angle: plan.angle, power: plan.power, by: RIVAL });
    },
    setBalls: (list) => {
      const match = sim.match;
      match.setBalls(list || []);
      match.isBreak = false;
      match.ballInHand = false;
      match.lastFoul = null;
      sim.stick.state = 'idle';
      sim.stick.t = 0;
      sim.aim.active = false;
      sim.place.active = false;
      prev = match.getHud();
      return match.getHud();
    },
    setGroups: (you, rival) => {
      sim.match.groups[PLAYER] = you || null;
      sim.match.groups[RIVAL] = rival || null;
      return sim.match.getHud();
    },
    state: () => {
      const hud = sim.hud();
      return {
        phase: hud.phase,
        turn: hud.turn,
        groups: hud.groups,
        remaining: hud.remaining,
        result: hud.result,
        reason: hud.resultReason,
        foul: hud.foul,
        ballInHand: hud.ballInHand,
        isBreak: hud.isBreak,
        shots: hud.shots,
      };
    },
    layout: () => {
      const frame = TABLE.RIBBER + TABLE.WOOD;
      return {
        hudBottom: LAYOUT.HUD_SAFE_BOTTOM,
        tableTop: PLAY.top - frame,
        tableBottom: PLAY.bottom + frame,
        tableLeft: PLAY.left - frame,
        tableRight: PLAY.right + frame,
      };
    },
  },
};
