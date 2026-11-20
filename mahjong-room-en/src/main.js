// 主入口：60Hz 固定步长 + 标题→对局→暂停→结算 + 教程引导 + SDK 统一出口 + 调试契约
import { STEP, GAME } from '../config/game.config.js';
import { createRun, bestDiscard } from './game/sim.js';
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
let phase = 'title'; // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let fpsSamples = [];
let tutorialStep = -1;

const view = { selectedTile: -1, hoverTile: -1 };

// ---------- 存档 ----------
let muted = !!Sdk.load('muted', false);
let tutorialDone = !!Sdk.load('tutorialDone', false);
let bestRounds = Sdk.load('bestRounds', 0) | 0;

Sdk.ready(); // 不 await，不阻塞首屏
audio.setMuted(muted);

function persist() {
  Sdk.save('muted', muted);
  Sdk.save('tutorialDone', tutorialDone);
  Sdk.save('bestRounds', bestRounds);
}

// ---------- 阶段状态机 ----------
function setPhase(p) { phase = p; }

function startGame() {
  run = createRun({ seed: (Date.now() % 2147483647) || 1, selfTimeout: 30 });
  view.selectedTile = -1;
  view.hoverTile = -1;
  setPhase('playing');
  ui.showGame();
  ui.hideResult();
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

function restartGame() {
  if (run) Sdk.track('restart', {});
  startGame();
}

function goHome() {
  run = null;
  setPhase('title');
  ui.hideResult();
  ui.showTitle();
  updateBestLine();
}

// ---------- HUD ----------
function updateHud() {
  if (!run) return;
  $('hud-goal').textContent = t('goal');
  $('hud-round').textContent = `${t('round')} ${run.state.round}/${GAME.ROUNDS}`;
  $('hud-score').textContent = `${t('score')} ${run.state.scores[0]}`;
  const e = run.state.energy;
  $('hud-energy').textContent = `${t('energy')} ${'◆'.repeat(e)}${'◇'.repeat(Math.max(0, GAME.ENERGY_MAX - e))}`;
  $('hud-energy').classList.toggle('streak', e >= GAME.ENERGY_MAX);
  const st = $('hud-streak');
  if (run.state.streak >= 1) { st.textContent = `${t('streak')} ×${run.state.streak + 1}`; st.classList.remove('hidden'); }
  else { st.classList.add('hidden'); }
  $('btn-mute').textContent = muted ? '🔇' : '🔊';
  $('btn-mute').classList.toggle('is-muted', muted);
}

function updateActions() {
  const bar = $('actionbar');
  const hint = $('turn-hint');
  const hideAll = () => {
    for (const id of ['btn-hu', 'btn-peng', 'btn-gang', 'btn-pass', 'btn-lucky', 'btn-discard']) $(id).classList.add('hidden');
  };
  if (phase !== 'playing' || !run || run.state.decider !== 0) {
    bar.classList.add('hidden');
    return;
  }
  bar.classList.remove('hidden');
  const opts = run.state.options;
  const has = (k) => opts.some((o) => o.kind === k);
  hideAll();
  $('btn-hu').classList.toggle('hidden', !has('hu'));
  $('btn-peng').classList.toggle('hidden', !has('peng'));
  $('btn-gang').classList.toggle('hidden', !(has('angang') || has('minggang')));
  $('btn-pass').classList.toggle('hidden', !has('pass'));
  const luckyReady = run.state.stage === 'discard' && run.state.energy >= GAME.ENERGY_MAX && GAME.LUCKY_ENABLED;
  $('btn-lucky').classList.toggle('hidden', !luckyReady);
  $('btn-discard').classList.toggle('hidden', run.state.stage !== 'discard');
  if (run.state.stage === 'discard') hint.textContent = t('yourTurn');
  else hint.textContent = t('claim');
  hint.classList.remove('hidden');
}

// ---------- 事件消费 ----------
function finishRun(ev) {
  setPhase('result');
  audio.stopBgm();
  const won = ev.type === 'win';
  const stars = ev.stars || 0;
  if (won && stars > bestRounds) { bestRounds = stars; persist(); }
  $('result-title').textContent = won ? t('winTitle') : t('loseTitle');
  $('result-title').classList.toggle('lose', !won);
  $('result-stars').textContent = won ? '★'.repeat(Math.max(1, stars)) : '';
  $('result-meta').textContent = won
    ? `${t('roundsWon')}: ${run.state.selfRoundWins}/${GAME.ROUNDS} · ${t('score')}: ${run.state.scores[0]}`
    : `${t('roundsWon')}: ${run.state.selfRoundWins}/${GAME.ROUNDS} · ${t('score')}: ${run.state.scores[0]}`;
  ui.showResult();
  Sdk.track(won ? 'win' : 'fail', { stars, roundsWon: run.state.selfRoundWins, score: run.state.scores[0] });
  audio.event(ev.type, ev);
}

function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    if (ev.type === 'win' || ev.type === 'lose') { finishRun(ev); return; }
  }
}

// ---------- 教程引导 ----------
const TUT_STEPS = () => [
  { text: t('tutStep1'), spot: 'selfHand' },
  { text: t('tutStep2'), spot: 'selfDiscard' },
  { text: t('tutStep3'), spot: 'table' },
];

function spotRect(which) {
  const lay = renderer.debugLayout();
  return lay && lay[which] ? lay[which] : null;
}

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
  const rect = s && s.spot ? spotRect(s.spot) : null;
  const spot = $('tut-spotlight');
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
function canvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (1280 / rect.width),
    y: (e.clientY - rect.top) * (720 / rect.height),
  };
}

canvas.addEventListener('pointermove', (e) => {
  if (!run || phase !== 'playing') return;
  const p = canvasPos(e);
  view.hoverTile = run.state.decider === 0 ? renderer.hitSelfTile(p.x, p.y) : -1;
});

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (!run || phase !== 'playing' || run.state.decider !== 0) return;
  if (run.state.stage !== 'discard') return;
  const p = canvasPos(e);
  const idx = renderer.hitSelfTile(p.x, p.y);
  if (idx >= 0) {
    view.selectedTile = view.selectedTile === idx ? idx : idx;
    if (view.selectedTile === idx && run.state.hands[0][idx] != null) {
      audio.event('discard', { pre: true });
    }
    updateActions();
  }
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
  if (e.code === 'KeyR' && (phase === 'playing' || phase === 'result')) restartGame();
  if (e.code === 'KeyM') toggleMute();
});

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  persist();
  updateHud();
}

// ---------- 动作 ----------
function doAction(fn) {
  if (!run || phase !== 'playing') return;
  fn();
  view.selectedTile = -1;
  updateHud();
  updateActions();
  handleEvents(run.drainEvents());
}

function bind() {
  const on = (id, fn) => $(id)?.addEventListener('click', () => { audio.unlock(); fn(); });
  on('btn-start', startGame);
  on('btn-resume', resumeGame);
  on('btn-restart', restartGame);
  on('btn-restart2', restartGame);
  on('btn-retry', restartGame);
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-tut-replay', () => { if (phase === 'paused') resumeGame(); if (phase === 'playing') startTutorial(); });
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result') startTutorial(); });
  on('btn-discard', () => {
    if (run.state.stage !== 'discard' || view.selectedTile < 0) return;
    const t = run.state.hands[0][view.selectedTile];
    doAction(() => run.act({ kind: 'discard', t }));
  });
  on('btn-hu', () => doAction(() => run.act({ kind: 'hu' })));
  on('btn-peng', () => doAction(() => run.act({ kind: 'peng' })));
  on('btn-gang', () => {
    const opts = run.state.options;
    const ag = opts.find((o) => o.kind === 'angang');
    if (ag) doAction(() => run.act({ kind: 'angang', t: ag.t }));
    else doAction(() => run.act({ kind: 'minggang' }));
  });
  on('btn-pass', () => doAction(() => run.act({ kind: 'pass' })));
  on('btn-lucky', () => doAction(() => run.lucky()));
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);

  for (const id of ['lang-select', 'lang-select-pause']) {
    $(id)?.addEventListener('change', (e) => {
      ui.setLang(e.target.value);
      renderTutorialStep();
      updateHud();
      updateBestLine();
    });
  }
}

function updateBestLine() {
  const el = $('best-line');
  if (bestRounds > 0) { el.textContent = `${t('best')}: ${bestRounds} ${t('stars')}`; el.classList.remove('hidden'); }
  else el.classList.add('hidden');
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
    if (run && phase === 'playing') { updateHud(); updateActions(); }
  }

  try {
    renderer.draw(run ? run.state : null, view);
  } catch (err) {
    console.warn('render error', err);
  }

  if (fpsSamples.length < 600 && dt > 0) fpsSamples.push(1 / dt);
  requestAnimationFrame(frame);
}

// ---------- 调试契约 ----------
function greedyPlayToEnd() {
  if (!run) return false;
  let guard = 0;
  while (run.state.phase === 'playing' && guard < 400000) {
    guard += 1;
    if (run.state.decider === 0) {
      const opts = run.state.options;
      const has = (k) => opts.find((o) => o.kind === k);
      if (run.state.stage === 'discard') {
        if (has('hu')) run.act({ kind: 'hu' });
        else if (has('angang')) { const a = has('angang'); run.act({ kind: 'angang', t: a.t }); }
        else if (run.state.energy >= GAME.ENERGY_MAX) { run.lucky(); }
        else { const t = bestDiscard(run.state.hands[0]); if (t != null) run.act({ kind: 'discard', t }); }
      } else {
        if (has('hu')) run.act({ kind: 'hu' });
        else if (has('peng')) run.act({ kind: 'peng' });
        else if (has('minggang')) run.act({ kind: 'minggang' });
        else run.act({ kind: 'pass' });
      }
    } else {
      run.step(1 / 60);
    }
  }
  handleEvents(run.drainEvents());
  return true;
}

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
  save: (key, value) => Sdk.save(key, value),
  ui: () => ui,
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['discard', 'claim', 'hu']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: () => (run ? run.state : null),
    fastForward: () => greedyPlayToEnd(),
    giveUp: () => greedyPlayToEnd(),
    startSeeded: (seed) => {
      run = createRun({ seed: seed | 0 || 1, selfTimeout: 30 });
      view.selectedTile = -1;
      setPhase('playing');
      ui.showGame();
      ui.hideResult();
      updateHud();
      return true;
    },
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
  },
};

// ---------- 启动 ----------
bind();
syncDocumentLang();
ui.applyLang();
updateBestLine();
Sdk.track('load', {});
requestAnimationFrame(frame);
