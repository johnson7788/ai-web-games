// 主入口：60Hz 固定步长 + 标题/游戏/暂停/结算 + 教程引导 + SDK 统一出口。
// 装配：sim（纯逻辑）/ render（canvas 霓虹街机）/ ui（DOM+CSS）/ audio（WebAudio 程序化）。
import { STEP, WORLD, PROGRESS } from '../config/game.config.js';
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
let phase = 'title'; // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let tutorialStep = -1; // -1 = 未激活
let tutorialDone = !!Sdk.load('tutorialDone', false);
let muted = !!Sdk.load('muted', false);
let best = Sdk.load('best', 0) | 0;
let bestStars = Sdk.load('bestStars', 0) | 0;

const view = {
  shake: 0,
  flash: 0,
  fxQueue: [],
};

Sdk.ready();
Sdk.onAdStart(() => { if (phase === 'playing') pauseGame(true); });
Sdk.onAdEnd(() => { if (phase === 'paused') resumeGame(); });
audio.setMuted(muted);
updateMuteBtn();

function persist() {
  Sdk.save('tutorialDone', tutorialDone);
  Sdk.save('muted', muted);
  Sdk.save('best', best);
  Sdk.save('bestStars', bestStars);
}

// ---------- 阶段状态机 ----------
function setPhase(p) { phase = p; }

function startGame() {
  run = createRun({ seed: (Date.now() % 2147483647) || 1 });
  view.fxQueue = [];
  view.shake = 0;
  view.flash = 0;
  setPhase('playing');
  ui.showGame();
  ui.hideResult();
  updateHud();
  audio.startBgm();
  Sdk.newRun();
  if (!tutorialDone) startTutorial();
}

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

function restartGame() {
  if (run) Sdk.track('restart', { score: run.state.score });
  startGame();
}

function goHome() {
  run = null;
  setPhase('title');
  ui.hideResult();
  ui.showTitle();
  ui.updateBestLine(best);
  audio.stopBgm();
}

// ---------- HUD / 结算 ----------
function updateHud() {
  if (!run) return;
  const h = run.getHud();
  $('hud-score').textContent = `${t('score')}: ${h.score}`;
  $('hud-best').textContent = `${t('best')}: ${best}`;
  $('hud-level').textContent = `${t('level')} ${h.level}`;
  const comboEl = $('hud-combo');
  comboEl.textContent = h.combo > 1 ? `${t('combo')} x${h.combo}` : '';
  comboEl.classList.toggle('on', h.combo > 1);
  const heatEl = $('hud-heat');
  heatEl.textContent = `${t('heat')} ${h.heat}/${h.heatMax}`;
  heatEl.classList.toggle('danger', h.heat >= h.heatMax - 5);
  $('heat-fill').style.width = `${Math.round((h.heat / h.heatMax) * 100)}%`;

  const hint = $('hud-hint');
  if (hint) {
    const firstKill = run.state.stats.kills > 0;
    hint.textContent = t('tapToSlam');
    hint.classList.toggle('hidden', firstKill);
  }
}

function finishRun(ev) {
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  const score = ev.score | 0;
  const stars = ev.stars | 0;
  const isNew = score > best;
  if (isNew) best = score;
  if (stars > bestStars) bestStars = stars;
  persist();
  Sdk.gameOver({ score, stars, distance: run ? Math.round(run.state.distance) : 0 });

  $('result-title').textContent = t('resultTitle');
  const starsEl = $('result-stars');
  starsEl.innerHTML = `${'★'.repeat(stars)}${'☆'.repeat(Math.max(0, 3 - stars))}`;
  $('result-meta').innerHTML =
    `${t('resultScore')}: <b>${score}</b> · ${t('best')}: <b>${best}</b>` +
    (isNew ? `<span class="new-best">${t('newBest')}</span>` : '');
  ui.showResult();
  if (stars >= 2) audio.event('star');
}

// ---------- 粒子 / 反馈 ----------
function pushFx(fx) {
  if (REDUCED_MOTION && (fx.type === 'text' || fx.type === 'ring')) return;
  if (view.fxQueue.length > 60) view.fxQueue.shift();
  view.fxQueue.push(fx);
}

function explodeFx(x, y, color, n = 10) {
  const shards = [];
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2;
    const sp = 2 + Math.random() * 3;
    shards.push({ dx: Math.cos(a) * sp * 20, dy: Math.sin(a) * sp * 20, r: 2 + Math.random() * 3, color });
  }
  pushFx({ type: 'explode', x, y, ttl: 0.45, max: 0.45, shards });
}

function textFx(text, color) {
  pushFx({ type: 'text', x: WORLD.PLAYER_X, y: WORLD.GROUND_Y - 150, ttl: 0.8, max: 0.8, text, color });
}

// ---------- 事件消费 ----------
function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    const px = WORLD.PLAYER_X;
    const gy = WORLD.GROUND_Y;
    switch (ev.type) {
      case 'slam':
        pushFx({ type: 'ring', x: px, y: gy - 4, ttl: 0.25, max: 0.25, r: 20, color: '#4ff3ff' });
        break;
      case 'floor':
        if (!REDUCED_MOTION) view.shake = Math.max(view.shake, 2);
        break;
      case 'killMeteor':
        explodeFx(px, gy - 30, '#ff5ea8', 12);
        if (!REDUCED_MOTION) view.shake = Math.max(view.shake, 4);
        textFx(`+${ev.bonus}`, '#ffd23e');
        break;
      case 'core':
        explodeFx(px, gy - 30, '#ffd23e', 8);
        textFx('+15', '#ffd23e');
        break;
      case 'thruster':
        if (!REDUCED_MOTION) view.shake = Math.max(view.shake, 7);
        explodeFx(px, gy - 20, '#5a8bff', 10);
        break;
      case 'pad':
        textFx(t('heat'), '#43e97b');
        break;
      case 'spike':
        if (!REDUCED_MOTION) { view.shake = Math.max(view.shake, 6); view.flash = 0.35; }
        explodeFx(px, gy - 30, '#ff5a3c', 10);
        break;
      case 'combo':
        textFx(`x${ev.combo}`, '#4ff3ff');
        break;
      case 'levelUp':
        textFx(`${t('level')} ${ev.level}`, '#eaf4ff');
        break;
      case 'gameOver':
        if (!REDUCED_MOTION) view.flash = 0.5;
        finishRun(ev);
        return;
      default:
        break;
    }
  }
}

// ---------- 教程 ----------
const TUT_STEPS = () => [
  { text: t('tutStep1') },
  { text: t('tutStep2') },
  { text: t('tutStep3') },
];

function startTutorial() {
  tutorialStep = 0;
  renderTutorialStep();
}

function renderTutorialStep() {
  const el = $('tutorial');
  if (tutorialStep < 0) { el.classList.add('hidden'); return; }
  const s = TUT_STEPS()[tutorialStep];
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

// ---------- 输入 ----------
function slam() {
  audio.unlock();
  if (!run || phase !== 'playing') return;
  run.slam();
}

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  slam();
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    if (phase === 'playing') slam();
    else if (phase === 'title') startGame();
  } else if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  } else if (e.code === 'KeyR') {
    if (phase === 'playing' || phase === 'paused' || phase === 'result') restartGame();
  } else if (e.code === 'KeyM') {
    toggleMute();
  }
});

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  updateMuteBtn();
  persist();
}

function updateMuteBtn() {
  const b = $('btn-mute');
  b.textContent = muted ? '🔇' : '🔊';
  b.classList.toggle('is-muted', muted);
}

// ---------- UI 绑定 ----------
function bind() {
  const on = (id, fn) => {
    const el = $(id);
    if (el) el.addEventListener('click', () => { audio.unlock(); fn(); });
  };
  on('btn-start', startGame);
  on('btn-resume', resumeGame);
  on('btn-retry', restartGame);
  on('btn-restart', restartGame);
  on('btn-restart2', restartGame);
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result') startTutorial(); });
  on('btn-howto2', () => { if (phase === 'paused') resumeGame(); startTutorial(); });
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);
  on('btn-rotate-skip', () => { const rs = $('rotate-screen'); if (rs) rs.style.display = 'none'; });

  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = $(id);
    if (!sel) continue;
    sel.addEventListener('change', () => {
      ui.setLang(sel.value);
      renderTutorialStep();
      if (run) updateHud();
      ui.updateBestLine(best);
    });
  }
}

// ---------- 主循环 ----------
function frame(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;

  if (phase === 'playing' && run) {
    accumulator += dt;
    while (accumulator >= STEP) {
      run.step(STEP);
      accumulator -= STEP;
    }
    handleEvents(run.drainEvents());
    if (run && phase === 'playing') updateHud();
  }

  if (view.shake > 0) view.shake = Math.max(0, view.shake - dt * 18);
  if (view.flash > 0) view.flash = Math.max(0, view.flash - dt * 2);
  for (const fx of view.fxQueue) fx.ttl -= dt;
  view.fxQueue = view.fxQueue.filter((fx) => fx.ttl > 0);

  const drawState = (phase === 'result' || phase === 'title') ? null : (run ? run.state : null);
  renderer.draw(drawState, dt, view);

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
  restart: () => restartGame(),
  home: () => goHome(),
  sim: () => (run ? run.state : null),
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['slam', 'meteor', 'avoid']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  save: () => Sdk,
  ui: () => ui,
  debug: {
    state: () => (run ? run.state : null),
    startSeeded: (seed) => {
      run = createRun({ seed: seed | 0 || 1 });
      view.fxQueue = [];
      setPhase('playing');
      ui.showGame();
      ui.hideResult();
      updateHud();
      audio.startBgm();
      return true;
    },
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    giveUp: () => { if (run) run.debug.forceOver(); },
  },
};

// ---------- 启动 ----------
bind();
syncDocumentLang();
ui.applyLang();
ui.updateBestLine(best);
renderer.draw(null, 0, view);
Sdk.track('load', {});
requestAnimationFrame(frame);
