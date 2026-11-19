// HOOP FRENZY · 主入口：60Hz 固定步长 + 标题/游戏/暂停/结算 + 教程 + SDK 统一出口
import { STEP, GAME, LAYOUT } from '../config/game.config.js';
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
const REDUCED_MOTION = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

let run = null;
let phase = 'title';       // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let fpsSamples = [];
let tutorialStep = -1;     // -1 = 未激活
let lastClockTick = -1;

const view = {
  shake: 0,
  fxQueue: [],
};

// 标题屏演示场景（让标题/结算背后也有霓虹球场可辨，避免纯菜单截图拉低 silhouette）
const demoState = {
  targetSide: -1,
  targetRingY: GAME.RING_BASE_Y,
  ringBaseYL: GAME.RING_BASE_Y,
  ringBaseYR: GAME.RING_BASE_Y,
  golden: false,
  combo: 0,
  stage: 1,
  power: 0.5,
};

// ---------- 存档 ----------
let muted = !!Sdk.load('muted', false);
let best = Sdk.load('best', 0) | 0;
let tutorialDone = !!Sdk.load('tutorialDone', false);

Sdk.ready();
Sdk.onAdStart(() => { if (phase === 'playing') pauseGame(true); });
Sdk.onAdEnd(() => { if (phase === 'paused') resumeGame(); });
audio.setMuted(muted);

function persist() {
  Sdk.save('muted', muted);
  Sdk.save('best', best);
  Sdk.save('tutorialDone', tutorialDone);
}

// ---------- 阶段状态机 ----------
function setPhase(p) { phase = p; }

function startRun(opts = {}) {
  const seed = (Date.now() % 2147483647) || 1;
  run = createRun(seed);
  setPhase('playing');
  ui.showGame();
  hideResult();
  updateHud();
  audio.startBgm();
  Sdk.newRun({ score: 0 });
  if (opts.tutorial && !tutorialDone) startTutorial();
}

function startGame() { startRun({ tutorial: true }); }

function pauseGame(silent) {
  if (phase !== 'playing') return;
  setPhase('paused');
  audio.stopBgm();
  if (!silent) ui.showPause();
}

function resumeGame() {
  if (phase !== 'paused') return;
  setPhase('playing');
  ui.hidePause();
  audio.startBgm();
}

function restartRun() { startRun({ tutorial: false }); }

function goHome() {
  run = null;
  setPhase('title');
  hideResult();
  ui.showTitle();
  updateTitleBest();
}

// ---------- HUD ----------
function updateHud() {
  if (!run) return;
  const h = run.getHud();
  $('hud-score').textContent = h.score;
  $('hud-best').textContent = `${t('best')} ${best}`;
  $('hud-stage').textContent = `${t('stage')} ${h.stage}`;
  const combo = $('hud-combo');
  combo.textContent = h.combo >= 2 ? t('comboX', { n: h.combo }) : '';
  combo.style.visibility = h.combo >= 2 ? 'visible' : 'hidden';
  const hearts = '♥'.repeat(Math.max(0, h.lives)) + '♡'.repeat(Math.max(0, GAME.LIVES - h.lives));
  $('hud-lives').textContent = hearts;
  $('btn-mute').textContent = muted ? '🔇' : '🔊';
}

function updateTitleBest() {
  $('title-best').textContent = `${t('best')} ${best}`;
}

// ---------- 结算 ----------
function starsFor(score, won) {
  if (won) return 3;
  if (score >= 14) return 2;
  if (score >= 6) return 1;
  return 0;
}

function showResult(ev) {
  const won = ev.type === 'win';
  const score = run ? run.state.score : 0;
  if (score > best) { best = score; persist(); }
  const stars = starsFor(score, won);
  $('result-title').textContent = won ? t('winTitle') : t('loseTitle');
  $('result-title').classList.toggle('lose', !won);
  $('result-stars').textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
  $('result-meta').textContent = won ? `${t('score')} ${score}${score > (Sdk.load('best', 0) | 0) ? ' · ' + t('newBest') : ''}` : `${t('score')} ${score}`;
  ui.showResult();
}

function finishRun(ev) {
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  showResult(ev);
  if (ev.type === 'win') Sdk.levelCleared({ score: run.state.score, stars: starsFor(run.state.score, true) });
  else Sdk.gameOver({ score: run.state.score, stars: starsFor(run.state.score, false) });
}

// ---------- 教程 ----------
const TUT_STEPS = () => [
  { id: 'meter', text: t('tutStep1') },
  { id: 'ring', text: t('tutStep2') },
  { id: 'combo', text: t('tutStep3') },
];

function startTutorial() {
  tutorialStep = 0;
  renderTutorialStep();
}

function renderTutorialStep() {
  const el = $('tutorial');
  if (tutorialStep < 0) { el.classList.add('hidden'); return; }
  const steps = TUT_STEPS();
  const s = steps[tutorialStep];
  el.classList.remove('hidden');
  $('tut-title').textContent = t('tutTitle');
  $('tut-text').textContent = s ? s.text : '';
  $('tut-skip').textContent = t('tutSkip');
  $('tut-next').textContent = t('tutNext');
}

function tutorialNext() {
  tutorialStep += 1;
  if (tutorialStep >= TUT_STEPS().length) endTutorial();
  else renderTutorialStep();
}

function endTutorial() {
  tutorialStep = -1;
  tutorialDone = true;
  persist();
  renderTutorialStep();
}

// ---------- popup ----------
function popup(text, cls = '') {
  if (REDUCED_MOTION) return;
  const el = document.createElement('div');
  el.className = 'popup ' + cls;
  el.textContent = text;
  el.style.top = '300px';
  $('popups').appendChild(el);
  setTimeout(() => el.remove(), 950);
}

// ---------- 事件消费 ----------
function fireShotFx() {
  if (!run) return;
  const hud = run.getHud();
  const shot = run.state.lastShot;
  const from = { x: LAYOUT.PAD_X, y: LAYOUT.PAD_Y - 8 };
  let to = { x: hud.targetRingX, y: hud.targetRingY };
  let arc = 120;
  if (shot && shot.outcome === 'miss') {
    to = { x: hud.targetRingX + (hud.targetSide < 0 ? -LAYOUT.RIM_R - 14 : LAYOUT.RIM_R + 14), y: hud.targetRingY - LAYOUT.RIM_R };
    arc = 60;
  }
  view.fxQueue.push({ type: 'shot', ttl: 0.5, ttl0: 0.5, from, to, arc });
}

function spawnSparks(x, y, hue, n = 14) {
  if (REDUCED_MOTION) return;
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2;
    view.fxQueue.push({
      type: 'spark', x, y, hue, r: 2 + Math.random() * 3,
      vx: Math.cos(a) * (60 + Math.random() * 90),
      vy: Math.sin(a) * (60 + Math.random() * 90),
      ttl: 0.5 + Math.random() * 0.2, ttl0: 0.6,
    });
  }
}

function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev);
    switch (ev) {
      case 'launch':
        fireShotFx();
        break;
      case 'swish': {
        const h = run.getHud();
        view.shake = REDUCED_MOTION ? 0 : 3;
        view.fxQueue.push({ type: 'ringFlash', x: h.targetRingX, y: h.targetRingY, hue: '#00e5ff', ttl: 0.4, ttl0: 0.4 });
        spawnSparks(h.targetRingX, h.targetRingY, '#00e5ff', 16);
        break;
      }
      case 'bank': {
        const h = run.getHud();
        view.shake = REDUCED_MOTION ? 0 : 1;
        view.fxQueue.push({ type: 'ringFlash', x: h.targetRingX, y: h.targetRingY, hue: '#7a5bd6', ttl: 0.3, ttl0: 0.3 });
        break;
      }
      case 'combo':
        popup(t('comboX', { n: run.state.combo }));
        break;
      case 'flame':
        popup(t('flameOn'), 'fire');
        break;
      case 'golden':
        popup(t('golden'), 'gold');
        break;
      case 'stageUp':
        popup(t('stageUp', { n: run.state.stage }));
        break;
      case 'nearMiss':
        popup(t('nearMiss'), 'miss');
        break;
      case 'lifeLost':
        view.shake = REDUCED_MOTION ? 0 : 6;
        break;
      case 'win':
      case 'lose':
        finishRun(ev);
        return;
      default:
        break;
    }
  }
}

// ---------- 输入 ----------
function tryShoot() {
  audio.unlock();
  if (!run || phase !== 'playing' || tutorialStep >= 0) return;
  const res = run.shoot();
  if (res.ok) {
    handleEvents(run.drainEvents());
    updateHud();
  }
}

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  tryShoot();
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') { e.preventDefault(); tryShoot(); }
  else if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
  else if (e.code === 'KeyR') { if (phase === 'playing' || phase === 'paused' || phase === 'result') restartRun(); }
  else if (e.code === 'KeyM') toggleMute();
  else if (e.code === 'KeyH') { if (phase === 'playing' || phase === 'result') startTutorial(); }
});

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  $('btn-mute').classList.toggle('is-muted', muted);
  persist();
  updateHud();
}

// ---------- UI 绑定 ----------
function bind() {
  const on = (id, fn) => {
    const el = $(id);
    if (el) el.addEventListener('click', () => { audio.unlock(); fn(); });
  };
  on('btn-start', startGame);
  on('btn-resume', resumeGame);
  on('btn-restart', restartRun);
  on('btn-restart2', restartRun);
  on('btn-retry', restartRun);
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result') startTutorial(); });
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);

  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = $(id);
    if (!sel) continue;
    sel.addEventListener('change', () => {
      ui.setLang(sel.value);
      applyStaticText();
      renderTutorialStep();
      updateHud();
    });
  }
}

function applyStaticText() {
  $('title-text').textContent = t('title');
  $('subtitle-text').textContent = t('subtitle');
  $('btn-start').textContent = t('start');
  $('btn-resume').textContent = t('resume');
  $('pause-title').textContent = t('paused');
  $('btn-restart2').textContent = t('restart');
  $('btn-home2').textContent = t('home');
  $('btn-retry').textContent = t('retry');
  $('btn-home3').textContent = t('home');
  $('btn-howto').setAttribute('aria-label', t('howto'));
  $('rotate-text').textContent = t('rotateHint');
  $('btn-rotate-skip').textContent = t('rotateSkip');
  view.targetLabel = t('target');
  view.tapLabel = t('tap');
}

function hideResult() {
  $('screen-result').classList.add('hidden');
}

// ---------- 主循环 ----------
function frame(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;

  if (phase === 'playing' && run && tutorialStep < 0) {
    accumulator += dt;
    while (accumulator >= STEP) {
      run.step(STEP);
      accumulator -= STEP;
    }
    handleEvents(run.drainEvents());
    if (run && phase === 'playing') updateHud();
    // 倒计时 beep（最后 2 秒每秒一次）
    if (run && run.state.clock > 0 && run.state.clock <= 2) {
      const sec = Math.ceil(run.state.clock);
      if (sec !== lastClockTick) { lastClockTick = sec; audio.event('clockTick'); }
    }
  }

  if (view.shake > 0) view.shake = Math.max(0, view.shake - dt * 18);
  for (const fx of view.fxQueue) fx.ttl -= dt;
  view.fxQueue = view.fxQueue.filter((fx) => fx.ttl > 0);
  view.showHints = (phase === 'title' || phase === 'playing');

  try {
    renderer.draw(run ? run.state : demoState, dt, view);
  } catch (err) {
    console.warn('render error', err);
  }

  if (fpsSamples.length < 600 && dt > 0) fpsSamples.push(1 / dt);
  requestAnimationFrame(frame);
}

// ---------- 调试契约 ----------
window.__ll = {
  state: {
    get phase() { return phase; },
    get lang() { return i18n.lang; },
  },
  run: () => run,
  start: () => startGame(),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => restartRun(),
  home: () => goHome(),
  sim: () => (run ? run.state : null),
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['meter', 'ring', 'combo']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  save: (k, v) => Sdk.save(k, v),
  ui: () => ui,
  share: (p) => Sdk.share(p),
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: () => (run ? { ...run.state } : null),
    hud: () => (run ? run.getHud() : null),
    perfectShot: () => {
      if (!run || run.state.phase !== 'aiming') return false;
      // 把指针拨到理想力量再出手（验证用，等价玩家卡准时机）
      const ideal = run.idealPower();
      const u = (ideal >= 0.5) ? 0.25 : 0.75;
      run.state.meterPhase = u * GAME.METER_PERIOD;
      run.state.power = ideal;
      const res = run.shoot();
      handleEvents(run.drainEvents());
      updateHud();
      return res;
    },
    playToEnd: () => {
      if (!run) return false;
      let guard = 60;
      while (guard-- > 0 && run.state.phase !== 'won') {
        window.__ll.debug.perfectShot();
      }
      return run.state.phase === 'won';
    },
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); if (b) endTutorial(); },
  },
};

// ---------- 启动 ----------
bind();
syncDocumentLang();
ui.applyLang();
applyStaticText();
updateTitleBest();
$('btn-mute').classList.toggle('is-muted', muted);
Sdk.track('load', {});
requestAnimationFrame(frame);
