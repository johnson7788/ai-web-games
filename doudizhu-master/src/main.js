// DOUDIZHU MASTER · 主入口：60Hz 固定步长 + 标题/牌局/暂停/结算 + 教程 + SDK 统一出口
// 装配：sim(纯逻辑) / render(canvas 程序化) / audio(WebAudio 程序化) / ui(DOM)
import { STEP, CONFIG, GAME } from '../config/game.config.js';
import { createRun, TYPE_NAMES } from './game/sim.js';
import { createRenderer, VIEW_W, VIEW_H } from './render/index.js';
import { createAudio } from './core/audio.js';
import { ui } from './ui/ui.js';
import { i18n, t, syncDocumentLang } from './core/i18n.js';
import Sdk from './core/sdk.js';

const $ = (id) => document.getElementById(id);
const canvas = $('canvas');
const renderer = createRenderer(canvas);
const audio = createAudio();

let run = null;
let phase = 'title';           // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let fpsSamples = [];
let tutorialStep = -1;         // -1 = 未激活

// 存档（统一走 Sdk）
let muted = !!Sdk.load('muted', false);
let coins = Sdk.load('coins', 0) | 0;
let round = Math.max(1, Sdk.load('round', 1) | 0);
let bestRound = Math.max(1, Sdk.load('bestRound', 1) | 0);
let streak = Sdk.load('streak', 0) | 0;
let bestStreak = Sdk.load('bestStreak', 0) | 0;
let tutorialDone = !!Sdk.load('tutorialDone', false);

const view = {
  hoverCard: null,
  cursor: { x: 0, y: 0 },
  shake: 0,
  flash: 0,
};

Sdk.ready();
Sdk.onAdStart(() => { if (phase === 'playing') pauseGame(true); });
Sdk.onAdEnd(() => { if (phase === 'paused') resumeGame(); });
audio.setMuted(muted);
ui.setMuted(muted);

function persist() {
  Sdk.save('muted', muted);
  Sdk.save('coins', coins);
  Sdk.save('round', round);
  Sdk.save('bestRound', bestRound);
  Sdk.save('streak', streak);
  Sdk.save('bestStreak', bestStreak);
  Sdk.save('tutorialDone', tutorialDone);
}

// ---------- 阶段状态机 ----------
function setPhase(p) { phase = p; }

function startRound(roundNum) {
  roundNum = Math.max(1, Math.min(GAME.MAX_ROUNDS, roundNum | 0));
  round = roundNum;
  run = createRun(roundNum, { seed: (Date.now() % 2147483647) || 1, aiThinkMs: GAME.AI_THINK_MS });
  view.hoverCard = null;
  view.shake = 0;
  view.flash = 0;
  setPhase('playing');
  ui.showGame();
  hideResult();
  updateHud();
  audio.startBgm();
  Sdk.newRun({ round: roundNum });
  Sdk.track('start', { round: roundNum });
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

function restartRound() {
  Sdk.track('restart', { round });
  startRound(round);
}

function goHome() {
  run = null;
  setPhase('title');
  hideResult();
  ui.showTitle();
  updateMenu();
}

// ---------- HUD / 菜单 ----------
function updateHud() {
  if (!run) return;
  const h = run.getHud();
  $('hud-round').textContent = `${t('level')}${h.round}`;
  $('hud-mult').textContent = `×${h.multiplier}`;
  $('hud-coins').textContent = `🪙 ${coins}`;
  $('hud-role').textContent = `${t('you')} · ${t('landlord')} · ${h.myCount} ${t('cardsLeft')}`;
  const playEl = $('btn-play');
  playEl.textContent = t('play');
  $('btn-pass').textContent = t('pass');
  $('btn-hint').textContent = t('hint');
  $('btn-mute').textContent = muted ? '🔇' : '🔊';
}

function updateMenu() {
  $('menu-coins').textContent = `🪙 ${coins}`;
  $('menu-streak').textContent = `${t('menuBest')}: ${bestStreak}`;
}

function showResult(ev) {
  const won = ev.type === 'win';
  $('result-title').textContent = won ? t('winTitle') : t('loseTitle');
  const spring = ev.spring ? ` · ${t('spring', { n: ev.multiplier })}` : '';
  $('result-meta').textContent = won ? t('winReason') + spring : t('loseReason');
  const sign = won ? '+' : '−';
  $('result-coins').textContent = `${t('coinDelta', { sign, n: ev.score })} · ×${ev.multiplier}`;
  $('btn-next').style.display = won ? '' : 'none';
  $('btn-retry').style.display = won ? 'none' : '';
  $('screen-result').classList.remove('hidden');
}

function hideResult() {
  $('screen-result').classList.add('hidden');
}

function finishRun(ev) {
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  const won = ev.type === 'win';
  if (won) {
    coins += ev.score;
    streak += 1;
    bestStreak = Math.max(bestStreak, streak);
    round = Math.min(GAME.MAX_ROUNDS, round + 1);
    bestRound = Math.max(bestRound, round);
    Sdk.levelCleared({ round, score: ev.score });
  } else {
    coins -= ev.score;
    streak = 0;
    Sdk.gameOver({ round, score: ev.score });
  }
  persist();
  updateMenu();
  showResult(ev);
  audio.event(won ? 'win' : 'lose');
}

// ---------- 事件消费 ----------
function handleEvents(events) {
  for (const ev of events) {
    switch (ev.type) {
      case 'deal':
      case 'roundStart':
        audio.event('deal');
        break;
      case 'play':
        if (ev.type === 'bomb') audio.event('bomb');
        else if (ev.type === 'rocket') audio.event('rocket');
        else audio.event('play');
        view.shake = Math.max(view.shake, 2);
        tutorialAdvance('play');
        break;
      case 'bomb':
        audio.event(ev.type === 'rocket' ? 'rocket' : 'bomb');
        view.flash = 0.5;
        view.shake = Math.max(view.shake, 6);
        break;
      case 'pass':
        audio.event('pass');
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

// ---------- 教程 ----------
const TUT_STEPS = () => [
  { text: t('tutStep1'), spot: 'hand' },
  { text: t('tutStep2'), spot: 'center' },
  { text: t('tutStep3'), spot: 'center' },
];

function startTutorial() {
  if (phase !== 'playing' && phase !== 'result') return;
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
  const spot = $('tut-spotlight');
  const rect = s && s.spot ? spotRect(s.spot) : null;
  if (rect) {
    spot.style.display = 'block';
    spot.style.left = `${rect.x - 8}px`;
    spot.style.top = `${rect.y - 8}px`;
    spot.style.width = `${rect.w + 16}px`;
    spot.style.height = `${rect.h + 16}px`;
  } else {
    spot.style.display = 'none';
  }
}

function spotRect(which) {
  if (!run) return null;
  const lay = renderer.layout(run.state);
  if (which === 'hand') {
    if (!lay.hand.length) return null;
    const r = lay.hand[0];
    return { x: r.x, y: r.y, w: r.w, h: r.h };
  }
  return lay.center;
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

const TUT_TRIGGER = ['select', 'play', 'win'];
function tutorialAdvance(evType) {
  if (tutorialStep < 0 || tutorialStep >= TUT_TRIGGER.length) return;
  if (TUT_TRIGGER[tutorialStep] !== evType) return;
  tutorialStep += 1;
  if (tutorialStep >= TUT_TRIGGER.length) endTutorial();
  else renderTutorialStep();
}

// ---------- 输入 ----------
function canvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (VIEW_W / rect.width),
    y: (e.clientY - rect.top) * (VIEW_H / rect.height),
  };
}

canvas.addEventListener('pointermove', (e) => {
  const p = canvasPos(e);
  view.cursor = p;
  view.hoverCard = (run && phase === 'playing') ? renderer.handCardAt(p.x, p.y, run.state) : null;
});

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (!run || phase !== 'playing' || run.state.turn !== 0) return;
  const p = canvasPos(e);
  const card = renderer.handCardAt(p.x, p.y, run.state);
  if (card) {
    const res = run.selectCard(card.id);
    if (res.ok) {
      audio.event('select');
      if (tutorialStep === 0) tutorialAdvance('select');
    }
  }
});

function doPlay() {
  if (!run || phase !== 'playing' || run.state.turn !== 0) return;
  const res = run.playSelected();
  if (!res.ok && res.reason === 'cannot-beat') {
    view.shake = Math.max(view.shake, 4);
    audio.event('pass', { fail: true });
  }
  updateHud();
}

function doPass() {
  if (!run || phase !== 'playing' || run.state.turn !== 0) return;
  run.pass();
  updateHud();
}

function doHint() {
  if (!run || phase !== 'playing' || run.state.turn !== 0) return;
  run.hint();
  audio.event('hint');
  updateHud();
}

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  ui.setMuted(muted);
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
  on('btn-start', () => startRound(round));
  on('btn-resume', resumeGame);
  on('btn-restart', restartRound);
  on('btn-restart2', restartRound);
  on('btn-retry', restartRound);
  on('btn-next', () => startRound(round));
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-play', doPlay);
  on('btn-pass', doPass);
  on('btn-hint', doHint);
  on('btn-howto', () => { if (phase === 'playing') startTutorial(); });
  on('btn-howto2', () => { if (phase !== 'playing') startRound(round); startTutorial(); });
  on('btn-tut-replay', () => { if (phase === 'paused') resumeGame(); if (phase === 'playing') startTutorial(); });
  on('btn-rotate-skip', () => {
    const rs = $('rotate-screen');
    if (rs) rs.style.display = 'none';
  });
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);

  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = $(id);
    if (!sel) continue;
    sel.addEventListener('change', () => {
      ui.setLang(sel.value);
      renderTutorialStep();
      updateMenu();
      if (run) updateHud();
      $('rotate-text').textContent = t('rotateHint');
      $('btn-rotate-skip').textContent = t('rotateSkip');
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

  if (view.shake > 0) view.shake = Math.max(0, view.shake - dt * 20);
  if (view.flash > 0) view.flash = Math.max(0, view.flash - dt * 2.2);

  try {
    renderer.draw(run ? run.state : null, dt, view);
  } catch (err) {
    console.warn('render error', err);
  }

  if (fpsSamples.length < 600 && dt > 0) fpsSamples.push(1 / dt);
  requestAnimationFrame(frame);
}

// ---------- 调试契约（截图/验收脚本通用） ----------
window.__ll = {
  state: {
    get phase() { return phase; },
    get lang() { return i18n.lang; },
  },
  run: () => run,
  start: (i) => startRound((i == null ? (round - 1) : i) + 1),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => restartRound(),
  home: () => goHome(),
  sim: () => (run ? run.state : null),
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['select', 'play', 'win']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  save: (key, value) => Sdk.save(key, value),
  ui: { share: async () => Sdk.share({ text: t('title') }) },
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: () => (run ? run.debug() : null),
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    autoPlay: () => { if (run && run.state.turn === 0) run.autoPlay(); return run ? run.debug() : null; },
    fastForward: () => {
      if (!run) return false;
      try {
        let guard = 40000;
        while (guard-- > 0 && run.state.phase === 'playing') {
          if (run.state.turn === 0) run.autoPlay();
          else run.step(0.1);
          handleEvents(run.drainEvents());
        }
        if (run.state.phase === 'ended' && phase === 'playing') handleEvents(run.drainEvents());
        return true;
      } catch { return false; }
    },
  },
};

// ---------- 启动 ----------
function fit() {
  const c = $('game-container');
  const s = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
  c.style.transform = `scale(${s})`;
}
window.addEventListener('resize', fit);
window.addEventListener('orientationchange', () => setTimeout(fit, 120));

bind();
syncDocumentLang();
ui.applyLang();
$('rotate-text').textContent = t('rotateHint');
$('btn-rotate-skip').textContent = t('rotateSkip');
$('btn-play').textContent = t('play');
$('btn-pass').textContent = t('pass');
$('btn-hint').textContent = t('hint');
updateMenu();
renderer.resize(window.devicePixelRatio || 1);
fit();
$('btn-mute').classList.toggle('is-muted', muted);
Sdk.track('load', {});
requestAnimationFrame(frame);
