// RPS DUEL QI · 主入口：60Hz 固定步长 + 标题/游戏/暂停/结算 + 教程 + SDK 统一出口
// 装配：sim（纯逻辑）+ render（canvas 霓虹）+ ui（DOM 语言/屏幕）+ audio（WebAudio 程序化）。
import { STEP, WORLD } from '../config/game.config.js';
import { createRun, COUNTER_OF, HANDS } from './game/sim.js';
import { createRenderer } from './render/index.js';
import { createAudio } from './core/audio.js';
import { ui } from './ui/ui.js';
import { i18n, t, syncDocumentLang } from './core/i18n.js';
import Sdk from './core/sdk.js';

const $ = (id) => document.getElementById(id);
const canvas = $('canvas');
const renderer = createRenderer(canvas);
const audio = createAudio();

let run = null;
let phase = 'title';       // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let fpsSamples = [];
let muted = !!Sdk.load('muted', false);
let best = Sdk.load('best', 0) | 0;
let tutorialDone = !!Sdk.load('tutorialDone', false);
let tutorialStep = -1;

const reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const view = {
  shake: 0,
  playerHand: null,
  playerHandT: 0,
  floatText: null,
  floatTextT: 0,
};

// ---------- 存档（统一走 Sdk） ----------
function persist() {
  Sdk.save('best', best);
  Sdk.save('muted', muted);
  Sdk.save('tutorialDone', tutorialDone);
}

// ---------- 阶段状态机 ----------
function setPhase(p) { phase = p; }

function syncButtons() {
  const playing = phase === 'playing';
  const qiReady = run && run.state.qi >= 5;
  for (const id of ['btn-rock', 'btn-scissors', 'btn-paper']) {
    const el = $(id);
    if (el) el.disabled = !playing;
  }
  const qb = $('btn-qi');
  if (qb) { qb.disabled = !playing || !qiReady; qb.classList.toggle('ready', playing && qiReady); }
}

function startRun(seed) {
  run = createRun({ seed: seed == null ? ((Date.now() % 2147483647) || 1) : seed });
  run.state.best = best;
  run.start();
  view.playerHand = null;
  view.playerHandT = 0;
  view.floatText = null;
  view.floatTextT = 0;
  setPhase('playing');
  ui.showGame();
  hideResult();
  updateHud();
  syncButtons();
  audio.startBgm();
  Sdk.newRun();
  Sdk.track('start', { seed: run.state._rng ? 'r' : 'd' });
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
  syncButtons();
  audio.startBgm();
}

function restartRun() {
  if (run) Sdk.track('restart', { score: run.state.score });
  startRun();
}

function goHome() {
  run = null;
  setPhase('title');
  hideResult();
  ui.showTitle();
  syncButtons();
  audio.stopBgm();
}

// ---------- HUD / 结算 ----------
function updateHud() {
  if (!run) return;
  const h = run.getHud();
  $('hud-score').textContent = `${t('score')} ${h.score}`;
  $('hud-best').textContent = `${t('best')} ${best}`;
  $('hud-wave').textContent = `${t('wave')} ${h.wave}`;
  $('hud-round').textContent = `${t('round')} ${Math.min(h.round, h.totalRounds)}/${h.totalRounds}`;
  const timeEl = $('hud-time');
  timeEl.textContent = `${h.timeLeft.toFixed(1)}s`;
  timeEl.classList.toggle('time-low', h.timeLeft < 1);
  const comboEl = $('hud-combo');
  comboEl.classList.toggle('hidden', h.combo < 2);
  comboEl.textContent = `×${h.combo}`;
  const qiEl = $('hud-qi');
  qiEl.textContent = `${t('qi')} ${h.qi}/${h.qiMax}`;
  qiEl.classList.toggle('ready', h.qi >= h.qiMax);
  let pips = '';
  for (let i = 1; i <= h.angerMax; i += 1) pips += i <= h.anger ? '●' : '○';
  $('hud-anger').textContent = pips;
  const qb = $('btn-qi');
  if (qb) {
    qb.disabled = phase !== 'playing' || h.qi < h.qiMax;
    qb.classList.toggle('ready', phase === 'playing' && h.qi >= h.qiMax);
    qb.title = h.qi >= h.qiMax ? t('qiReady') : t('qiEmpty');
  }
}

function showResult(res) {
  $('result-title').textContent = res.won ? t('winTitle') : t('loseTitle');
  $('result-title').classList.toggle('lose', !res.won);
  $('result-stars').innerHTML = res.won
    ? `<span class="stars">${'★'.repeat(res.stars)}${'☆'.repeat(3 - res.stars)}</span>${res.stars >= 3 ? `<em>${t('cleared')}</em>` : ''}`
    : `<span class="stars">${'★'.repeat(res.stars)}${'☆'.repeat(3 - res.stars)}</span>`;
  const meta = [
    `${t('resultScore')} ${res.score}`,
    `${t('resultBest')} ${res.best}${res.isNewBest ? ' · ' + t('newBest') : ''}`,
    `${t('resultCombo')} ×${res.maxCombo}`,
    `${t('resultRounds')} ${res.rounds}/${res.totalRounds}`,
  ];
  $('result-meta').textContent = meta.join('  ·  ');
  $('screen-result').classList.remove('hidden');
}

function hideResult() {
  $('screen-result').classList.add('hidden');
}

function finishRun(ev) {
  if (!run) return;
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  const won = ev.type === 'clear';
  const score = run.state.score;
  const isNewBest = score > best;
  if (isNewBest) best = score;
  persist();
  run.state.result.best = best;
  const st = run.state;
  Sdk.track(won ? 'win' : 'fail', { score, maxCombo: st.maxCombo, stars: st.result.stars, rounds: st.roundsDone });
  if (won) Sdk.levelCleared({ score, stars: st.result.stars });
  else Sdk.gameOver({ score });
  showResult({
    won, score, stars: st.result.stars, maxCombo: st.maxCombo,
    rounds: st.roundsDone, totalRounds: st.totalRounds, best, isNewBest,
  });
  syncButtons();
}

// ---------- 教程 ----------
const TUT_STEPS = () => [
  { id: 'hand', text: t('tutStep1') },
  { id: 'beat', text: t('tutStep2') },
  { id: 'qi', text: t('tutStep3') },
];

function startTutorial() { tutorialStep = 0; renderTutorialStep(); }

function renderTutorialStep() {
  const el = $('tutorial');
  if (tutorialStep < 0) { el.classList.add('hidden'); return; }
  const steps = TUT_STEPS();
  const s = steps[Math.min(tutorialStep, steps.length - 1)];
  el.classList.remove('hidden');
  $('tut-title').textContent = t('tutTitle');
  $('tut-text').textContent = s.text;
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

// ---------- 事件消费 ----------
function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    switch (ev.type) {
      case 'win':
        view.floatText = '+1';
        view.floatTextT = 1;
        renderer.spawnSpark(WORLD.WIDTH / 2, WORLD.HEIGHT * 0.4, '#ffd24a', reducedMotion ? 6 : 16);
        break;
      case 'combo':
        view.floatText = `COMBO ×${ev.combo}`;
        view.floatTextT = 1;
        break;
      case 'lose':
        view.shake = reducedMotion ? 2 : 6;
        view.floatText = 'MISS';
        view.floatTextT = 1;
        renderer.spawnSpark(WORLD.WIDTH / 2, WORLD.HEIGHT * 0.4, '#ff3d81', reducedMotion ? 5 : 14);
        break;
      case 'timeout':
        view.shake = reducedMotion ? 1 : 4;
        view.floatText = 'TOO SLOW';
        view.floatTextT = 1;
        break;
      case 'qiReady':
        view.floatText = 'QI READY';
        view.floatTextT = 1;
        break;
      case 'qiUsed':
        view.shake = reducedMotion ? 3 : 8;
        view.floatText = 'QI BLAST!';
        view.floatTextT = 1;
        renderer.spawnSpark(WORLD.WIDTH / 2, WORLD.HEIGHT * 0.4, '#b44dff', reducedMotion ? 8 : 22);
        break;
      case 'clear':
      case 'gameover':
        finishRun(ev);
        return;
      default:
        break;
    }
  }
}

// ---------- 输入 ----------
function playHand(hand) {
  audio.unlock();
  if (!run || phase !== 'playing') return;
  view.playerHand = hand;
  view.playerHandT = 0.55;
  const res = run.choose(hand);
  if (res.ok) updateHud();
}

function playQi() {
  audio.unlock();
  if (!run || phase !== 'playing') return;
  const res = run.useQi();
  if (res.ok) {
    view.playerHand = 'qi';
    view.playerHandT = 0.55;
    updateHud();
  }
}

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  ui.setMuted(muted);
  $('btn-mute').classList.toggle('is-muted', muted);
  persist();
}

// ---------- UI 绑定 ----------
function bind() {
  const on = (id, fn) => {
    const el = $(id);
    if (el) el.addEventListener('click', () => { audio.unlock(); fn(); });
  };
  on('btn-start', () => startRun());
  on('btn-resume', resumeGame);
  on('btn-restart', restartRun);
  on('btn-restart2', restartRun);
  on('btn-retry', restartRun);
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-rock', () => playHand('rock'));
  on('btn-scissors', () => playHand('scissors'));
  on('btn-paper', () => playHand('paper'));
  on('btn-qi', playQi);
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result') startTutorial(); });
  on('btn-tut-replay', () => { if (phase === 'paused') resumeGame(); if (phase === 'playing') startTutorial(); });
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);
  on('btn-rotate-skip', () => {
    const rs = $('rotate-screen');
    if (rs) rs.style.display = 'none';
  });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (phase === 'playing') pauseGame();
      else if (phase === 'paused') resumeGame();
    } else if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'result')) {
      restartRun();
    } else if (e.code === 'KeyM') {
      toggleMute();
    } else if (phase === 'playing') {
      if (e.code === 'Digit1') playHand('rock');
      else if (e.code === 'Digit2') playHand('scissors');
      else if (e.code === 'Digit3') playHand('paper');
      else if (e.code === 'KeyQ' || e.code === 'Space') { e.preventDefault(); playQi(); }
    }
  });

  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = $(id);
    if (!sel) continue;
    sel.addEventListener('change', () => {
      ui.setLang(sel.value);
      renderTutorialStep();
      updateHud();
      applyStaticLang();
    });
  }
}

function applyStaticLang() {
  const rt = $('rotate-text');
  const rb = $('btn-rotate-skip');
  if (rt) rt.textContent = t('rotateHint');
  if (rb) rb.textContent = t('rotateSkip');
  for (const el of document.querySelectorAll('[data-i18n]')) {
    el.textContent = t(el.getAttribute('data-i18n'));
  }
  const hint = $('hud-anger');
  if (hint) hint.title = t('beatHint');
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
  if (view.playerHandT > 0) view.playerHandT -= dt;
  if (view.floatTextT > 0) view.floatTextT -= dt;

  try {
    renderer.draw(run ? run.state : null, dt, view);
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
  start: () => startRun(),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => restartRun(),
  home: () => goHome(),
  sim: () => (run ? run.state : null),
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['hand', 'beat', 'qi']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[Math.min(tutorialStep, 2)] : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: () => (run ? run.state : null),
    hand: () => (run ? run.state.bossHand : null),
    counter: (hand) => COUNTER_OF[hand],
    playCorrect: () => {
      if (!run || run.state.phase !== 'playing') return false;
      const c = COUNTER_OF[run.state.bossHand];
      const r = run.choose(c);
      if (r.ok) updateHud();
      return r.ok;
    },
    fastForward: () => {
      if (!run) return false;
      let guard = 5000;
      while (guard-- > 0 && (run.state.phase === 'playing' || run.state.phase === 'settle' || run.state.phase === 'idle')) {
        if (run.state.phase === 'playing') run.choose(COUNTER_OF[run.state.bossHand]);
        run.step(1 / 30);
      }
      handleEvents(run.drainEvents());
      return run.state.phase === 'won' || run.state.phase === 'lost';
    },
  },
};

// ---------- 启动 ----------
bind();
syncDocumentLang();
ui.applyLang();
applyStaticLang();
$('btn-mute').classList.toggle('is-muted', muted);
audio.setMuted(muted);
Sdk.ready();
Sdk.onAdStart(() => { if (phase === 'playing') pauseGame(); });
Sdk.onAdEnd(() => { if (phase === 'paused') resumeGame(); });
Sdk.track('load', {});
requestAnimationFrame(frame);
