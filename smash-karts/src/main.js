// 主入口：SMASH KARTS。装配 sim / render / ui / audio，跑 60Hz 定步长，维护流程状态机、
// 输入合成、交互引导、遥测与 window.__ll 调试口。
// 状态机：boot → title → countdown → playing ⇄ paused → roundEnd → (countdown | matchOver) → title
import {
  WORLD, STEP, ARENAS, RULES, WEAPONS, UPGRADES, KARTS, PALETTE, CONFIG, PLAYER_KART,
} from '../config/game.config.js';
import {
  createRun, tick, nextRound, getHud, drainEvents, upgradeChoices,
  applyUpgrade, scoreOf, rankOf,
} from './game/sim.js';
import { createRenderer } from './render/index.js';
import { preload, art } from './render/art.js';
import { ui } from './ui/ui.js';
import { audio } from './core/audio.js';
import Sdk from './core/sdk.js';
import { t, i18n, syncDocumentLang } from './core/i18n.js';

const el = (id) => document.getElementById(id);
const canvas = el('canvas');
const renderer = createRenderer(canvas, art);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
function normAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// ---- 全局状态 ------------------------------------------------------------
let state = 'boot';
let run = null;
let lastTime = performance.now();
let accumulator = 0;
let countdown = 0;
let tutorialMode = false;
let tutorialStepIndex = -1;
let reducedMotion = false;
let matchWinner = null;
let roundResult = null;
let bestScore = Number(Sdk.load('bestScore', 0)) || 0;
let bestRank = Sdk.load('bestRank', '') || '';

// ---- 输入 ----------------------------------------------------------------
const keys = { up: false, down: false, left: false, right: false, fire: false, drift: false };
const joy = { active: false, x: 0, y: 0 };
let touchFire = false;
let touchDrift = false;

function computeInput() {
  let steer = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  let throttle = (keys.up ? 1 : 0) - (keys.down ? 1 : 0);
  let drift = keys.drift || touchDrift;
  const fire = keys.fire || touchFire;
  if (joy.active) {
    const mag = Math.hypot(joy.x, joy.y);
    if (mag > 0.16) {
      const kart = run?.karts?.[0];
      const desired = Math.atan2(joy.y, joy.x);
      if (kart) steer = clamp(normAngle(desired - kart.angle) * 2.6, -1, 1);
      throttle = clamp(mag * 1.15, 0, 1);
    } else {
      steer = 0;
      throttle = 0;
    }
  }
  return { throttle, steer, drift: !!drift, fire: !!fire };
}

const KEYMAP = {
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  Space: 'fire',
  ShiftLeft: 'drift', ShiftRight: 'drift',
};

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (state === 'playing') pauseGame();
    else if (state === 'paused') resumeGame();
    return;
  }
  const k = KEYMAP[e.code];
  if (!k) return;
  if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') e.preventDefault();
  audio.unlock();
  if (!e.repeat) { keys[k] = true; markInput(); }
});
window.addEventListener('keyup', (e) => {
  const k = KEYMAP[e.code];
  if (k) keys[k] = false;
});
window.addEventListener('blur', () => {
  for (const k of Object.keys(keys)) keys[k] = false;
  touchFire = false;
  touchDrift = false;
  if (state === 'playing') pauseGame();
});

// ---- 触屏 ----------------------------------------------------------------
const joyNode = el('joystick');
function joyCenter() {
  const r = joyNode.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: Math.max(24, r.width / 2) };
}
function updateJoy(e) {
  const c = joyCenter();
  let dx = e.clientX - c.x;
  let dy = e.clientY - c.y;
  const mag = Math.hypot(dx, dy);
  const max = c.r - 14;
  if (mag > max) { dx = (dx / mag) * max; dy = (dy / mag) * max; }
  ui.setKnob(dx, dy);
  joy.x = dx / max;
  joy.y = dy / max;
}
joyNode.addEventListener('pointerdown', (e) => {
  audio.unlock();
  joy.active = true;
  try { joyNode.setPointerCapture(e.pointerId); } catch { /* noop */ }
  updateJoy(e);
  markInput();
});
joyNode.addEventListener('pointermove', (e) => { if (joy.active) updateJoy(e); });
const endJoy = () => { joy.active = false; joy.x = 0; joy.y = 0; ui.setKnob(0, 0); };
joyNode.addEventListener('pointerup', endJoy);
joyNode.addEventListener('pointercancel', endJoy);

const fireBtn = el('fire-btn');
const driftBtn = el('drift-btn');
fireBtn.addEventListener('pointerdown', (e) => {
  audio.unlock(); touchFire = true; markInput();
  try { fireBtn.setPointerCapture(e.pointerId); } catch { /* noop */ }
});
fireBtn.addEventListener('pointerup', () => { touchFire = false; });
fireBtn.addEventListener('pointercancel', () => { touchFire = false; });
driftBtn.addEventListener('pointerdown', (e) => {
  audio.unlock(); touchDrift = true; markInput();
  try { driftBtn.setPointerCapture(e.pointerId); } catch { /* noop */ }
});
driftBtn.addEventListener('pointerup', () => { touchDrift = false; });
driftBtn.addEventListener('pointercancel', () => { touchDrift = false; });

// ---- 遥测（fun-report 依赖） ---------------------------------------------
const tele = {
  runStartedAt: 0, firstInputAt: null, firstSuccessAt: null, actions: 0, deaths: 0,
  latencies: [], eventTypes: new Set(), lastEventAt: 0, maxEventGap: 0,
  lastInputAt: 0, idleAccum: 0, pendingInputAt: 0, policy: null,
};
function resetTelemetry() {
  const now = performance.now();
  tele.runStartedAt = now;
  tele.firstInputAt = null;
  tele.firstSuccessAt = null;
  tele.actions = 0;
  tele.deaths = 0;
  tele.latencies = [];
  tele.eventTypes.clear();
  tele.lastEventAt = now;
  tele.maxEventGap = 0;
  tele.lastInputAt = now;
  tele.idleAccum = 0;
}
function elapsedSec() { return (performance.now() - tele.runStartedAt) / 1000; }
function markInput() {
  if (state !== 'playing') return;
  const now = performance.now();
  tele.lastInputAt = now;
  tele.actions += 1;
  if (tele.firstInputAt === null) tele.firstInputAt = elapsedSec();
  tele.pendingInputAt = now;
  requestAnimationFrame(() => {
    if (!tele.pendingInputAt) return;
    tele.latencies.push(performance.now() - tele.pendingInputAt);
    tele.pendingInputAt = 0;
  });
}
function noteEvent(ev) {
  const now = performance.now();
  if (tele.eventTypes.size > 0) {
    tele.maxEventGap = Math.max(tele.maxEventGap, (now - tele.lastEventAt) / 1000);
  }
  tele.lastEventAt = now;
  tele.eventTypes.add(ev.type);
}

// ---- HUD 适配层（UI 只吃这个对象） ---------------------------------------
function buildHud() {
  if (!run) return null;
  const p = run.karts[0];
  const raw = getHud ? (getHud(run) || {}) : {};
  const board = (raw.board || raw.karts || run.karts.map((k) => ({
    id: k.id, name: k.name, color: k.color, kills: k.kills, isPlayer: k.isPlayer, isChampion: !!k.isChampion,
  }))).slice().sort((a, b) => b.kills - a.kills);
  const score = scoreOf ? scoreOf(run) : p.kills * 10;
  const arena = ARENAS[run.roundIndex ?? 0] || ARENAS[0];
  return {
    phase: run.phase,
    roundIndex: run.roundIndex ?? 0,
    roundsTotal: RULES.rounds,
    arenaName: arena.name,
    timeLeft: raw.timeLeft ?? run.timeLeft ?? RULES.roundSeconds,
    killTarget: RULES.killTarget,
    roundResult: raw.roundResult ?? roundResult,
    matchWinner,
    roundsWon: raw.roundsWon ?? run.roundsWon ?? 0,
    score,
    rank: raw.rank ?? (rankOf ? rankOf(score) : 'C'),
    picksTaken: raw.picksTaken ?? (run.upgrades ? run.upgrades.length : 0),
    upgrades: raw.upgrades ?? run.upgrades ?? [],
    reducedMotion,
    countdown: state === 'countdown' ? (raw.countdown || 1) : null,
    player: {
      hp: p.hp, maxHp: p.maxHp ?? RULES.hp, shield: p.shield || 0,
      dead: !!p.dead, respawn: p.respawn || 0,
      weapon: p.weapon, ammo: p.ammo,
      kills: p.kills, deaths: p.deaths,
      boost: p.boost || 0, drifting: !!(p.drift && p.drift.active),
      charge: (p.drift && p.drift.charge) || 0,
      expression: p.expression || 'idle',
      speed: p.speed || 0,
    },
    board,
  };
}
function syncHud() { const h = buildHud(); if (h) ui.updateHUD(h); }

// ---- 事件 → 表现 ---------------------------------------------------------
function pumpEvents() {
  if (!run) return [];
  const events = drainEvents(run);
  const player = run.karts[0];
  for (const ev of events) {
    noteEvent(ev);
    renderer.event(ev);
    audio.event(ev);
    if (ev.type === 'ko') {
      if (ev.killer === player.id) {
        if (tele.firstSuccessAt === null) tele.firstSuccessAt = elapsedSec();
        Sdk.track('smash', { n: player.kills });
      }
      if (ev.victim === player.id) tele.deaths += 1;
    }
    advanceTutorial(ev);
    if (ev.type === 'roundEnd') onRoundEnd(ev);
    else if (ev.type === 'matchEnd') onMatchEnd(ev);
  }
  return events;
}

// ---- 交互引导 ------------------------------------------------------------
// 引导步骤在开始引导时按当前语言生成（UI 直接显示 title/body，不做二次翻译）
function tutorialSteps() {
  return [
    { id: 'drive', title: t('tut1Title'), body: t('tut1Body'), target: null },
    { id: 'drift', title: t('tut2Title'), body: t('tut2Body'), target: '#drift-btn' },
    { id: 'boost', title: t('tut3Title'), body: t('tut3Body'), target: '#boost-fill' },
    { id: 'fire', title: t('tut4Title'), body: t('tut4Body'), target: '#fire-btn' },
  ];
}
let driveTimer = 0;

function beginTutorial() {
  tutorialMode = true;
  tutorialStepIndex = 0;
  driveTimer = 0;
  roundResult = null;
  matchWinner = null;
  run = createRun({ seed: (Date.now() % 100000) + 1, roundIndex: 0, tutorial: true, playerKart: PLAYER_KART });
  state = 'countdown';
  countdown = 0.8;
  accumulator = 0;
  renderer.clearEffects();
  ui.showGame();
  ui.tutorial.start(tutorialSteps());
  audio.unlock();
  audio.setScene('meadow');
  syncHud();
  syncLl();
}
function advanceTutorial(ev) {
  if (!tutorialMode || state !== 'playing') return;
  const step = tutorialSteps()[tutorialStepIndex];
  if (!step) return;
  if (step.id === 'boost' && ev.type === 'boost') nextTutorialStep();
  else if (step.id === 'fire' && ev.type === 'shot' && ev.owner === run.karts[0].id) nextTutorialStep();
}
function tickTutorial() {
  if (!tutorialMode || state !== 'playing') return;
  const step = tutorialSteps()[tutorialStepIndex];
  if (!step) return;
  if (step.id === 'drive') {
    const input = computeInput();
    if (input.throttle > 0.3) driveTimer += STEP; else driveTimer = 0;
    if (driveTimer > 0.3) nextTutorialStep();
  } else if (step.id === 'drift') {
    const p = run.karts[0];
    if (p.drift && p.drift.charge > 0.28) nextTutorialStep();
  }
}
function nextTutorialStep() {
  tutorialStepIndex += 1;
  if (tutorialStepIndex >= tutorialSteps().length) { finishTutorial(); return; }
  ui.tutorial.next();
}
function finishTutorial() {
  tutorialMode = false;
  tutorialStepIndex = -1;
  ui.tutorial.finish();
  Sdk.save('tutorialDone', true);
  Sdk.track('tutorial_done', {});
  startMatch({ tutorial: false });
}
function skipTutorial() {
  tutorialMode = false;
  tutorialStepIndex = -1;
  ui.tutorial.skip();
  Sdk.save('tutorialDone', true);
  Sdk.track('tutorial_skip', {});
  startMatch({ tutorial: false });
}

// ---- 流程 ----------------------------------------------------------------
function startMatch() {
  matchWinner = null;
  roundResult = null;
  tutorialMode = false;
  run = createRun({ seed: (Date.now() % 100000) + 7, roundIndex: 0, upgrades: [], playerKart: PLAYER_KART });
  state = 'countdown';
  countdown = RULES.countdownSec;
  accumulator = 0;
  renderer.clearEffects();
  ui.showGame();
  audio.unlock();
  audio.duck(false);
  audio.setScene(ARENAS[0].id);
  Sdk.newRun({ mode: 'cup', round: 1 });
  syncHud();
  syncLl();
  lastTime = performance.now();
}

function pauseGame() {
  if (state !== 'playing') return;
  state = 'paused';
  audio.duck(true);
  ui.showPause();
  syncLl();
}
function resumeGame() {
  if (state !== 'paused') return;
  state = 'playing';
  audio.duck(false);
  ui.hidePause();
  lastTime = performance.now();
  syncLl();
}
function backToTitle() {
  state = 'title';
  run = null;
  ui.showTitle();
  ui.hideEnd();
  ui.hidePause();
  ui.updateBest(bestScore, bestRank);
  audio.setScene('title');
  syncLl();
}

function onRoundEnd(ev) {
  state = 'roundEnd';
  roundResult = { playerWon: !!ev.playerWon, reason: ev.reason || 'target' };
  audio.duck(true);
  const played = run.roundsPlayed ?? ((run.roundIndex ?? 0) + 1);
  const isLast = played >= (run.rounds ?? RULES.rounds);
  if (isLast) {
    if (nextRound) nextRound(run, null);
    const roundsWon = run.playerRoundsWon ?? 0;
    onMatchEnd({ winner: run.winner || (roundsWon * 2 > RULES.rounds ? 'player' : 'bots') });
    return;
  }
  const picks = upgradeChoices ? upgradeChoices(run, 3) : [];
  ui.showRoundEnd({
    playerWon: roundResult.playerWon,
    roundIndex: run.roundIndex ?? 0,
    roundsTotal: RULES.rounds,
    arenaName: ARENAS[run.roundIndex ?? 0].name,
    nextArenaName: ARENAS[(run.roundIndex ?? 0) + 1].name,
    picks,
  });
  audio.event({ type: 'roundEnd', playerWon: roundResult.playerWon });
  syncLl();
}

function chooseUpgrade(id) {
  if (state !== 'roundEnd') return;
  audio.event({ type: 'upgrade', id });
  // sim 的 nextRound 内部会 applyUpgrade，这里不要再调一次
  const nr = nextRound ? nextRound(run, id) : null;
  if (nr) run = nr;
  state = 'countdown';
  countdown = RULES.countdownSec;
  roundResult = null;
  ui.showGame();
  audio.duck(false);
  audio.setScene(ARENAS[run.roundIndex ?? 0]?.id || 'meadow');
  syncHud();
  syncLl();
}

function onMatchEnd(ev) {
  if (state === 'matchOver') return;
  state = 'matchOver';
  matchWinner = ev.winner || matchWinner || 'bots';
  const hud = buildHud();
  const won = matchWinner === 'player';
  const score = hud.score;
  const rank = hud.rank;
  const isNewBest = score > bestScore;
  if (isNewBest) { bestScore = score; Sdk.save('bestScore', score); }
  const order = { S: 4, A: 3, B: 2, C: 1 };
  if ((order[rank] || 0) > (order[bestRank] || 0)) { bestRank = rank; Sdk.save('bestRank', rank); }
  const leader = hud.board?.[0];
  const nearMiss = !won && leader ? Math.max(0, (leader.kills || 0) - hud.player.kills + 1) : 0;
  ui.showMatchEnd({
    won, score, rank,
    kills: hud.player.kills,
    deaths: hud.player.deaths,
    roundsWon: hud.roundsWon,
    roundsTotal: RULES.rounds,
    nearMiss,
    isNewBest,
  });
  audio.setScene('end');
  audio.event({ type: 'matchEnd', winner: won ? 'player' : 'bots' });
  if (won) Sdk.levelCleared({ score, rank }); else Sdk.gameOver({ score, rank });
  Sdk.track('session_end', { score, rank, won });
  syncLl();
}

// ---- UI 事件 -------------------------------------------------------------
ui.on('start', () => {
  audio.unlock();
  const seen = !!(Sdk.load('tutorialDone', false) || Sdk.load('tutorial', false));
  if (!seen) beginTutorial(); else startMatch();
});
// 玩家直接点 UI 上的「跳过 / 完成」按钮（不经 main 的 skipTutorial）
ui.on('tutorial-end', () => {
  if (!tutorialMode) return;
  tutorialMode = false;
  tutorialStepIndex = -1;
  Sdk.save('tutorialDone', true);
  Sdk.track('tutorial_done', {});
  startMatch();
});
ui.on('resume', resumeGame);
ui.on('restart', () => { ui.hidePause(); startMatch(); });
ui.on('again', () => { ui.hideEnd(); startMatch(); });
ui.on('title', () => backToTitle());
ui.on('pause', () => { if (state === 'playing') pauseGame(); else if (state === 'paused') resumeGame(); });
ui.on('mute', () => {
  const muted = !audio.muted;
  audio.setMuted(muted);
  Sdk.save('muted', muted);
  ui.updateMute(muted);
  audio.unlock();
});
ui.on('lang', (lang) => {
  i18n.setLang(lang);
  syncDocumentLang();
  ui.applyLang();
  syncHud();
  ui.updateBest(bestScore, bestRank);
  syncLl();
});
ui.on('upgrade', (id) => chooseUpgrade(id));
ui.on('howto', () => beginTutorial());
ui.on('reduced', (on) => {
  reducedMotion = !!on;
  Sdk.save('reducedMotion', reducedMotion);
  if (ui.setReducedMotion) ui.setReducedMotion(reducedMotion);
});

// ---- 主循环 --------------------------------------------------------------
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  if (state === 'countdown' && run) {
    accumulator += dt;
    const idle = { throttle: 0, steer: 0, drift: false, fire: false };
    while (accumulator >= STEP) {
      tick(run, STEP, idle);
      accumulator -= STEP;
    }
    if (run.phase === 'playing') {
      state = 'playing';
      accumulator = 0;
      resetTelemetry();
      syncLl();
    }
  }

  if (state === 'playing' && run) {
    accumulator += dt;
    const input = computeInput();
    if (input.throttle !== 0 || input.steer !== 0 || input.fire || input.drift) {
      tele.lastInputAt = now;
    }
    while (accumulator >= STEP) {
      tick(run, STEP, input);
      accumulator -= STEP;
      if (tutorialMode && state === 'playing') tickTutorial();
    }
  }

  if (run) pumpEvents();
  if (state === 'playing' && now - tele.lastEventAt > 1200 && now - tele.lastInputAt > 1200) {
    tele.idleAccum += dt;
  }

  renderer.update(dt);
  if (run) {
    const hud = buildHud();
    // 智能 HUD：玩家开到 HUD 下面时把那一块变淡，避免挡视野
    const p = run.karts[0];
    const leftEl = document.querySelector('.hud-left');
    const rightEl = document.querySelector('.hud-right');
    if (leftEl) leftEl.classList.toggle('hud-dim', !!p && p.x < 360 && p.y < 130);
    if (rightEl) rightEl.classList.toggle('hud-dim', !!p && p.x > 940 && p.y < 170);
    audio.update(dt, hud);
    renderer.draw(run, hud, now / 1000);
    if (state === 'playing' || state === 'countdown') ui.updateHUD(hud);
  }
}

// ---- 初始化 --------------------------------------------------------------
const loadingFill = el('loading-fill');
const loadingText = el('loading-text');
const loadingScreen = el('screen-loading');
function setLoading(p) { if (loadingFill) loadingFill.style.width = `${Math.round(p * 100)}%`; }

function syncLl() {
  if (!window.__ll) return;
  window.__ll.state.phase = state;
  window.__ll.state.lang = i18n.lang;
  window.__ll.state.dir = i18n.dir;
  window.__ll.state.round = run ? (run.roundIndex ?? 0) + 1 : 0;
}

function bootstrap() {
  syncDocumentLang();
  ui.applyLang();
  audio.setMuted(!!Sdk.load('muted', false));
  ui.updateMute(audio.muted);
  reducedMotion = !!Sdk.load('reducedMotion', false);
  if (ui.setReducedMotion) ui.setReducedMotion(reducedMotion);
  ui.updateBest(bestScore, bestRank);
  ui.setTouch(('ontouchstart' in window) || navigator.maxTouchPoints > 0);
  if (loadingText) loadingText.textContent = t('loading');

  // 标题屏立刻可见（不等素材），素材回来后再贴 keyart 背景。
  state = 'title';
  ui.showTitle();
  if (loadingScreen) loadingScreen.classList.add('hidden');
  syncLl();
  requestAnimationFrame(loop);
  applyKeyart();
}

function applyKeyart() {
  const keyart = art.image(CONFIG.keyart);
  const titleScreen = el('screen-title');
  if (keyart && titleScreen) {
    titleScreen.style.backgroundImage = `linear-gradient(180deg, rgba(255,246,229,0.62), rgba(255,246,229,0.92)), url("${keyart.src}")`;
    titleScreen.classList.add('has-keyart');
  }
}

Sdk.ready().catch(() => { /* 降级 */ });
Sdk.onAdStart(() => pauseGame());
Sdk.onAdEnd(() => resumeGame());

bootstrap();
preload((done, total) => setLoading(total ? done / total : 1))
  .then(() => applyKeyart())
  .catch(() => { /* 素材失败也要能玩 */ });

// ---- 调试契约 window.__ll ------------------------------------------------
window.G = { run: () => run, state: () => state, ui };

const llTutorial = {
  get active() { return !!(ui.tutorial && ui.tutorial.active); },
  get step() { return ui.tutorial ? ui.tutorial.step : null; },
  get steps() {
    if (!ui.tutorial || !ui.tutorial.steps) return [];
    return ui.tutorial.steps.map((s) => (typeof s === 'string' ? s : (s.id || s.title)));
  },
  get current() { return ui.tutorial ? ui.tutorial.current : null; },
  skip() { skipTutorial(); },
};

window.__ll = {
  state: { phase: 'boot', lang: i18n.lang, dir: i18n.dir, round: 0 },
  get sim() { return run; },
  start: () => startMatch(),
  startTutorial: () => beginTutorial(),
  pause: pauseGame,
  resume: resumeGame,
  restart: backToTitle,
  tutorial: llTutorial,
  ui: () => ui,
  audio: () => audio,
  save: (k, v) => Sdk.save(k, v),
  load: (k, d) => Sdk.load(k, d),
  telemetry(policy) {
    if (policy) tele.policy = policy;
    const sum = tele.latencies.reduce((a, b) => a + b, 0);
    const hud = run ? buildHud() : null;
    return {
      game: 'smash-karts',
      genre: 'action',
      policy: tele.policy || 'human',
      durationSec: Math.round(Math.max(0.1, elapsedSec()) * 10) / 10,
      firstInputSec: tele.firstInputAt === null ? 0 : Math.round(tele.firstInputAt * 10) / 10,
      inputLatencyMs: tele.latencies.length ? Math.round(sum / tele.latencies.length) : 0,
      firstSuccessSec: tele.firstSuccessAt === null ? null : Math.round(tele.firstSuccessAt * 10) / 10,
      deaths: tele.deaths,
      actions: tele.actions,
      idleSec: Math.round(tele.idleAccum * 10) / 10,
      maxEventGapSec: Math.round(tele.maxEventGap * 10) / 10,
      uniqueEvents: tele.eventTypes.size,
      levelsReached: hud ? hud.roundIndex + 1 : 1,
      completed: state === 'matchOver',
    };
  },
  debug: {
    state: () => buildHud(),
    sim: () => run,
    step(sec, input) {
      const n = Math.max(1, Math.ceil(sec * 60));
      for (let i = 0; i < n; i += 1) tick(run, STEP, input || { throttle: 1, steer: 0, drift: false, fire: false });
      pumpEvents();
      syncHud();
      return buildHud();
    },
    setKills(n) { run.karts[0].kills = n; syncHud(); return run.karts[0].kills; },
    winRound() {
      run.karts[0].kills = RULES.killTarget;
      const rival = run.karts.slice(1).sort((a, b) => b.kills - a.kills)[0];
      if (rival) rival.kills = Math.max(0, RULES.killTarget - 3);
      run.roundsPlayed = (run.roundsPlayed || 0) + 1;
      run.playerRoundsWon = (run.playerRoundsWon || 0) + 1;
      run.phase = 'roundover';
      run.events.push({ type: 'roundEnd', playerWon: true, reason: 'target' });
      pumpEvents();
      syncHud();
      return state;
    },
    loseRound() {
      const rival = run.karts[1];
      if (rival) rival.kills = RULES.killTarget;
      run.roundsPlayed = (run.roundsPlayed || 0) + 1;
      run.botRoundsWon = (run.botRoundsWon || 0) + 1;
      run.phase = 'roundover';
      run.events.push({ type: 'roundEnd', playerWon: false, reason: 'target' });
      pumpEvents();
      syncHud();
      return state;
    },
    endMatch(won = true) {
      run.playerRoundsWon = won ? 2 : 1;
      run.roundsPlayed = run.rounds ?? RULES.rounds;
      run.phase = 'matchover';
      run.winner = won ? 'player' : 'bots';
      run.events.push({ type: 'matchEnd', winner: run.winner });
      pumpEvents();
      syncHud();
      return state;
    },
    teleport(x, y) {
      const p = run.karts[0];
      p.x = x; p.y = y;
      return { x, y };
    },
    forceBoost() { run.karts[0].boost = 1; return run.karts[0].boost; },
    layout() {
      return {
        canvas: canvas.getBoundingClientRect(),
        hud: el('hud').getBoundingClientRect(),
        fireBtn: fireBtn.getBoundingClientRect(),
        driftBtn: driftBtn.getBoundingClientRect(),
        joystick: joyNode.getBoundingClientRect(),
      };
    },
  },
};

// bootstrap() 在 __ll 定义之前就跑，这里补一次同步，保证首帧 phase 就是 title
syncLl();
