// FISH FRENZY FLEE2 · 主入口：60Hz 固定步长装配 sim / render / ui / audio / sdk / 教程。
// 契约见 docs/batch3/fish-frenzy-flee2.md。玩法：驾驶鱼群逃亡，吞并小鱼、躲红鲨暗礁、吃星狂暴。
import { STEP, GAME, CONFIG, WORLD } from '../config/game.config.js';
import { createRun } from './game/sim.js';
import { createRenderer } from './render/index.js';
import { createAudio } from './core/audio.js';
import { ui } from './ui/ui.js';
import { i18n, t, syncDocumentLang } from './core/i18n.js';
import Sdk from './core/sdk.js';

const $ = (id) => document.getElementById(id);
const canvas = $('canvas');
const renderer = createRenderer(canvas);
const audio = createAudio();

let run = null;            // 当前对局
let decorRun = null;       // 标题/结算背景的自动演示鱼群
let phase = 'title';       // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let tutorialStep = -1;     // -1 = 未激活

const view = { fx: [], shake: 0 };

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let best = Sdk.load('best', 0) | 0;
let gold = Sdk.load('gold', 0) | 0;
let tutorialDone = !!Sdk.load('tutorialDone', false);

Sdk.ready(); // 不 await，不阻塞首屏
audio.setMuted(muted);
ui.setMuted(muted);

function persist() {
  Sdk.save('muted', muted);
  Sdk.save('best', best);
  Sdk.save('gold', gold);
  Sdk.save('tutorialDone', tutorialDone);
}

function setPhase(p) { phase = p; }

// ---------- 输入（虚拟摇杆 + 键盘 + 冲刺） ----------
const input = { joy: false, joyX: 0, joyY: 0, joyOx: 0, joyOy: 0, keys: new Set(), boostHeld: false };

function canvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (WORLD.WIDTH / rect.width),
    y: (e.clientY - rect.top) * (WORLD.HEIGHT / rect.height),
  };
}

function steerAngle() {
  if (input.joy) {
    const dx = input.joyX - input.joyOx;
    const dy = input.joyY - input.joyOy;
    if (Math.hypot(dx, dy) > 10) return Math.atan2(dy, dx);
  }
  let kx = 0; let ky = 0;
  if (input.keys.has('ArrowLeft') || input.keys.has('KeyA')) kx -= 1;
  if (input.keys.has('ArrowRight') || input.keys.has('KeyD')) kx += 1;
  if (input.keys.has('ArrowUp') || input.keys.has('KeyW')) ky -= 1;
  if (input.keys.has('ArrowDown') || input.keys.has('KeyS')) ky += 1;
  if (kx || ky) return Math.atan2(ky, kx);
  return null;
}

// ---------- 阶段状态机 ----------
function startRun(seed) {
  seed = seed == null ? ((Date.now() % 2147483647) || 1) : (seed | 0);
  run = createRun(seed);
  view.fx = [];
  view.shake = 0;
  setPhase('playing');
  ui.showGame();
  hideResult();
  updateHud();
  audio.startBgm();
  Sdk.track('start', {});
  if (!tutorialDone) startTutorial();
}

function pauseGame() {
  if (phase !== 'playing') return;
  setPhase('paused');
  audio.stopBgm();
  ui.showPause();
}

function resumeGame() {
  if (phase !== 'paused') return;
  setPhase('playing');
  ui.hidePause();
  audio.startBgm();
}

function restartRun() {
  if (run) Sdk.track('restart', {});
  startRun();
}

function goHome() {
  run = null;
  setPhase('title');
  hideResult();
  ui.showTitle();
  updateTitleHud();
}

// ---------- HUD ----------
function updateHud() {
  if (!run) return;
  const st = run.state;
  $('hud-score').textContent = String(st.score);
  $('hud-gold').textContent = String(gold);
  $('hud-best').textContent = String(best);
  $('hud-stage').textContent = `${t('stage')} ${st.stage}`;
  $('hud-combo').textContent = st.combo >= 2 ? `${t('combo')} ×${1 + Math.floor(st.combo / GAME.COMBO_STEP)}` : '';
  $('hud-combo').classList.toggle('hot', st.combo >= GAME.COMBO_STEP);
  $('hud-boost-fill').style.width = `${Math.round((st.boost / GAME.BOOST_MAX) * 100)}%`;
  $('hud-frenzy').style.display = st.frenzy > 0 ? '' : 'none';
}

function updateTitleHud() {
  $('title-best').textContent = t('best') + ' ' + best;
  $('title-gold').textContent = '¢ ' + gold;
}

// ---------- 结算 ----------
function showResult(st) {
  $('result-title').textContent = t('resultTitle');
  $('result-score').textContent = st.score;
  $('result-meta').textContent = `${t('best')} ${best} · ${t('gold')} ${st.gold} · ${t('stage')} ${st.stage}`;
  $('btn-revive').style.display = (gold >= GAME.REVIVE_COST && !run.state.reviveUsed) ? '' : 'none';
  $('btn-revive').textContent = `${t('revive')} (¢${GAME.REVIVE_COST})`;
  ui.showResult();
}

function hideResult() { ui.hideResult(); }

function finishRun(ev) {
  setPhase('result');
  audio.stopBgm();
  audio.event('lose');
  if (tutorialStep >= 0) endTutorial();
  const st = run.state;
  best = Math.max(best, st.score);
  gold += st.gold;
  persist();
  Sdk.gameOver({ score: st.score, gold: st.gold, stage: st.stage, time: Math.round(st.time) });
  showResult(st);
}

function doRevive() {
  if (!run || run.state.phase !== 'over' || gold < GAME.REVIVE_COST) return;
  gold -= GAME.REVIVE_COST;
  persist();
  run.tryRevive();
  setPhase('playing');
  ui.showGame();
  hideResult();
  audio.startBgm();
  Sdk.track('revive', {});
  updateHud();
}

// ---------- 教程 ----------
const TUT_STEPS = () => [
  { key: 'steer', text: t('tutStep1') },
  { key: 'grow', text: t('tutStep2') },
  { key: 'avoid', text: t('tutStep3') },
  { key: 'frenzy', text: t('tutStep4') },
];

function startTutorial() {
  tutorialStep = 0;
  renderTutorialStep();
}

function renderTutorialStep() {
  const el = $('tutorial');
  if (tutorialStep < 0) { el.classList.add('hidden'); return; }
  const steps = TUT_STEPS();
  const s = steps[Math.min(tutorialStep, steps.length - 1)];
  el.classList.remove('hidden');
  $('tut-title').textContent = t('tutTitle');
  $('tut-text').textContent = s.text;
  $('tut-dots').textContent = `${tutorialStep + 1} / ${steps.length}`;
  $('tut-skip').textContent = t('tutSkip');
  $('tut-next').textContent = tutorialStep >= steps.length - 1 ? t('tutDone') : t('tutNext');
}

function tutorialNext() {
  const steps = TUT_STEPS();
  tutorialStep += 1;
  if (tutorialStep >= steps.length) endTutorial();
  else renderTutorialStep();
}

function endTutorial() {
  tutorialStep = -1;
  tutorialDone = true;
  persist();
  renderTutorialStep();
}

// ---------- 事件消费 ----------
function pushFx(type, dx, dy) {
  if (!run) return;
  view.fx.push({ type, x: run.state.school.x + dx, y: run.state.school.y + dy, ttl: 0.45, max: 0.45, seed: Math.random() * 6.28 });
}

function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    switch (ev.type) {
      case 'join':
        pushFx('join', 0, 0);
        break;
      case 'eat':
        pushFx('eat', 0, 0);
        view.shake = 3;
        break;
      case 'rockHit':
        pushFx('rockHit', 0, 0);
        view.shake = 4;
        break;
      case 'eatPred':
        pushFx('join', 0, 0);
        view.shake = 4;
        break;
      case 'lose':
        finishRun(ev);
        return;
      default:
        break;
    }
  }
}

// ---------- 演示鱼群（标题/结算背景） ----------
function decorStep() {
  if (!decorRun) decorRun = createRun(1234);
  decorRun.step(STEP);
  // 简单 AI：追最近小鱼，躲最近鲨鱼
  const s = decorRun.state.school;
  let bx = 0; let by = 0;
  const add = (dx, dy, w) => { const d = Math.hypot(dx, dy) || 1; bx += (dx / d) * w; by += (dy / d) * w; };
  for (const p of decorRun.state.prey) add(p.x - s.x, p.y - s.y, 3);
  for (const pr of decorRun.state.predators) { const d = Math.hypot(pr.x - s.x, pr.y - s.y); if (d < 500) add(s.x - pr.x, s.y - pr.y, 6 * (1 - d / 500)); }
  if (bx || by) decorRun.setDirection(Math.atan2(by, bx));
  for (const e of decorRun.drainEvents()) { /* 演示不发声不记分 */ }
  if (decorRun.state.phase === 'over') decorRun = createRun(1234);
}

// ---------- 主循环 ----------
function frame(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;

  if (phase === 'playing' && run && tutorialStep < 0) {
    accumulator += dt;
    while (accumulator >= STEP) {
      const ang = steerAngle();
      if (ang != null) run.setDirection(ang);
      run.setBoost(input.boostHeld);
      run.step(STEP);
      accumulator -= STEP;
    }
    handleEvents(run.drainEvents());
    if (run && phase === 'playing') updateHud();
  } else if (phase === 'title' || phase === 'result') {
    decorStep();
  }

  for (const fx of view.fx) fx.ttl -= dt;
  view.fx = view.fx.filter((fx) => fx.ttl > 0);
  if (view.shake > 0) view.shake = Math.max(0, view.shake - dt * 18);

  const drawState = (phase === 'playing' && run) ? run.state : (decorRun ? decorRun.state : null);
  try {
    renderer.draw(drawState, dt, view);
  } catch (err) {
    console.warn('render error', err);
  }

  requestAnimationFrame(frame);
}

// ---------- 调试契约 ----------
window.__ll = {
  state: {
    get phase() { return phase; },
    get lang() { return i18n.lang; },
  },
  run: () => run,
  start: (seed) => startRun(seed),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => restartRun(),
  home: () => goHome(),
  sim: () => (run ? run.state : null),
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return TUT_STEPS().map((s) => s.key); },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  save: (key, value) => Sdk.save(key, value),
  ui: () => ui,
  fps: () => 0,
  debug: {
    state: () => (run ? run.state : null),
    startSeeded: (seed) => {
      tutorialStep = -1;
      run = createRun(seed | 0 || 1);
      view.fx = []; view.shake = 0;
      setPhase('playing');
      ui.showGame();
      hideResult();
      updateHud();
      audio.startBgm();
      return true;
    },
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    steerTo: (angle) => { if (run) run.setDirection(angle); return true; },
    setBoost: (b) => { input.boostHeld = !!b; return true; },
    fastForward: (sec) => {
      if (!run) return false;
      const n = Math.ceil((sec || 1) / STEP);
      for (let i = 0; i < n && run.state.phase === 'playing'; i += 1) run.step(STEP);
      handleEvents(run.drainEvents());
      return true;
    },
    spawnPreyAt: (dx, dy) => { if (run) { run.state.prey.push({ kind: 'prey', x: run.state.school.x + dx, y: run.state.school.y + dy, dir: 0, speed: 0, turnT: 99, t: 0 }); } return true; },
    spawnPredatorAt: (dx, dy, r) => { if (run) { run.state.predators.push({ kind: 'predator', x: run.state.school.x + dx, y: run.state.school.y + dy, r: r || 28, dir: 0, speed: 120, nearFlag: false }); } return true; },
    spawnRockAt: (dx, dy, r) => { if (run) { run.state.rocks.push({ kind: 'rock', x: run.state.school.x + dx, y: run.state.school.y + dy, r: r || 30, verts: 7, rot: 0, driftDir: 0 }); } return true; },
    spawnStarAt: (dx, dy) => { if (run) { run.state.stars.push({ kind: 'star', x: run.state.school.x + dx, y: run.state.school.y + dy, ph: 0 }); } return true; },
    grow: (n) => { if (run) { const s = run.state.school; for (let i = 0; i < n; i += 1) { s.size += 1; s.members.push({ ph: Math.random() * 6.28, ox: (Math.random() - 0.5) * 28, oy: (Math.random() - 0.5) * 28, r: 10 + Math.random() * 16 }); } return s.size; } return 0; },
    triggerFrenzy: () => { if (run) { run.state.frenzy = GAME.FRENZY_DURATION; run.drainEvents(); } return true; },
    forceGameOver: () => { if (run) { run.state.phase = 'over'; finishRun({ type: 'lose' }); } return true; },
  },
};

// ---------- 输入绑定 ----------
function bind() {
  canvas.addEventListener('pointerdown', (e) => {
    audio.unlock();
    if (phase !== 'playing') return;
    const p = canvasPos(e);
    input.joy = true;
    input.joyOx = p.x; input.joyOy = p.y;
    input.joyX = p.x; input.joyY = p.y;
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!input.joy) return;
    const p = canvasPos(e);
    input.joyX = p.x; input.joyY = p.y;
  });
  const endJoy = () => { input.joy = false; };
  canvas.addEventListener('pointerup', endJoy);
  canvas.addEventListener('pointercancel', endJoy);
  canvas.addEventListener('pointerleave', endJoy);

  window.addEventListener('keydown', (e) => {
    input.keys.add(e.code);
    if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.boostHeld = true;
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (phase === 'playing') pauseGame();
      else if (phase === 'paused') resumeGame();
    }
    if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'result')) restartRun();
    if (e.code === 'KeyM') toggleMute();
  });
  window.addEventListener('keyup', (e) => {
    input.keys.delete(e.code);
    if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.boostHeld = false;
  });

  const on = (id, fn) => { const el = $(id); if (el) el.addEventListener('click', () => { audio.unlock(); fn(); }); };
  on('btn-start', () => startRun());
  on('btn-resume', resumeGame);
  on('btn-restart', restartRun);
  on('btn-restart2', restartRun);
  on('btn-retry', restartRun);
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-revive', doRevive);
  on('btn-mute', toggleMute);
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result') startTutorial(); });
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);

  const boostBtn = $('btn-boost');
  if (boostBtn) {
    boostBtn.addEventListener('pointerdown', () => { input.boostHeld = true; });
    boostBtn.addEventListener('pointerup', () => { input.boostHeld = false; });
    boostBtn.addEventListener('pointerleave', () => { input.boostHeld = false; });
  }

  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = $(id);
    if (!sel) continue;
    sel.addEventListener('change', () => {
      ui.setLang(sel.value);
      renderTutorialStep();
      if (run) updateHud();
      updateTitleHud();
    });
  }
}

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  ui.setMuted(muted);
  persist();
}

// ---------- 启动 ----------
bind();
syncDocumentLang();
ui.applyLang();
updateTitleHud();
renderTutorialStep();
Sdk.track('load', {});
requestAnimationFrame(frame);
