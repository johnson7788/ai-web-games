// RETRO RACER GT · 主入口：60Hz 固定步长 + 标题/游戏/暂停/结算 + 教程 + SDK 出口
// 装配：sim（纯逻辑）/ render（canvas 霓虹）/ audio（WebAudio）/ ui（DOM+i18n）。
import { STEP, WORLD } from '../config/game.config.js';
import { createRun } from './game/sim.js';
import { createRenderer } from './render/index.js';
import { createAudio } from './core/audio.js';
import { i18n, t, syncDocumentLang } from './core/i18n.js';
import Sdk from './core/sdk.js';

const $ = (id) => document.getElementById(id);
const canvas = $('canvas');
const renderer = createRenderer(canvas);
const audio = createAudio();

let run = null;
let phase = 'title';        // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let fpsSamples = [];
let tutorialStep = -1;
let newBest = false;

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let best = Sdk.load('best', 0) | 0;
let coins = Sdk.load('coins', 0) | 0;
let tutorialDone = !!Sdk.load('tutorialDone', false);

Sdk.ready(); // 不 await，不阻塞首屏
audio.setMuted(muted);

function persist() {
  Sdk.save('muted', muted);
  Sdk.save('best', best);
  Sdk.save('coins', coins);
  Sdk.save('tutorialDone', tutorialDone);
}

// ---------- 阶段状态机 ----------
function setPhase(p) { phase = p; }

function startLevel() {
  run = createRun((Date.now() % 2147483647) || 1);
  newBest = false;
  setPhase('playing');
  $('screen-title').classList.add('hidden');
  $('screen-title').classList.remove('is-active');
  $('screen-pause').classList.add('hidden');
  $('screen-result').classList.add('hidden');
  $('hud').classList.remove('hidden');
  $('controls').classList.remove('hidden');
  updateHud();
  audio.startBgm();
  audio.event('start');
  Sdk.track('start', {});
  if (!tutorialDone) startTutorial();
}

function pauseGame() {
  if (phase !== 'playing') return;
  setPhase('paused');
  audio.stopBgm();
  $('screen-pause').classList.remove('hidden');
}

function resumeGame() {
  if (phase !== 'paused') return;
  setPhase('playing');
  $('screen-pause').classList.add('hidden');
  audio.startBgm();
}

function restartLevel() {
  if (run) Sdk.track('restart', {});
  startLevel();
}

function goHome() {
  run = null;
  setPhase('title');
  endTutorial();
  $('screen-pause').classList.add('hidden');
  $('screen-result').classList.add('hidden');
  $('hud').classList.add('hidden');
  $('controls').classList.add('hidden');
  $('screen-title').classList.remove('hidden');
  $('screen-title').classList.add('is-active');
  updateTitleBest();
  audio.stopBgm();
}

function crash() {
  if (!run || run.state.phase !== 'running') return;
  // 直接推进到碰撞结算
  run.state.phase = 'crashed';
  run.state.speed = 0;
  finishRun({ type: 'crash' });
}

function finishRun(ev) {
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  const st = run.state;
  const score = Math.floor(st.score);
  newBest = score > best;
  if (newBest) best = score;
  const gained = Math.floor(score / 20) + 10;
  coins += gained;
  persist();
  Sdk.track('fail', { score, tier: st.tier + 1, cars: st.carsPassed, combo: st.maxCombo });
  audio.event('crash');

  $('result-title').textContent = newBest ? `${t('resultTitle')} · ${t('newBest')}` : t('resultTitle');
  const lines = [
    [t('resultScore'), `${score}`],
    [t('resultBest'), `${best}`],
    [t('resultCars'), `${st.carsPassed}`],
    [t('resultStars'), `${st.starsCollected}`],
    [t('resultCombo'), `x${st.maxCombo}`],
    [t('resultCoins'), `+${gained}`],
  ];
  const el = $('result-lines');
  el.innerHTML = '';
  for (const [k, v] of lines) {
    const row = document.createElement('div');
    row.className = 'r-line';
    const kk = document.createElement('span');
    kk.className = 'r-key';
    kk.textContent = k;
    const vv = document.createElement('span');
    vv.className = 'r-val' + (k === t('resultBest') && newBest ? ' r-best' : '');
    vv.textContent = v;
    row.appendChild(kk);
    row.appendChild(vv);
    el.appendChild(row);
  }
  $('hud').classList.add('hidden');
  $('controls').classList.add('hidden');
  $('screen-result').classList.remove('hidden');
}

// ---------- HUD ----------
function updateHud() {
  if (!run) return;
  const st = run.state;
  $('hud-score').textContent = Math.floor(st.score);
  $('hud-speed').textContent = Math.floor(st.speed / 10);
  $('hud-best').textContent = best;
  $('hud-tier').textContent = `${t('tier')} ${st.tier + 1}`;
  const comboEl = $('hud-combo');
  if (st.combo >= 2) {
    comboEl.classList.remove('hidden');
    comboEl.textContent = `${t('combo')} x${st.combo}`;
  } else {
    comboEl.classList.add('hidden');
  }
  updateNitroButton();
}

function updateNitroButton() {
  const st = run ? run.state : null;
  const ready = !!(st && !st.nitroActive && st.nitroCd <= 0);
  const active = !!(st && st.nitroActive);
  for (const id of ['btn-nitro-hud', 'btn-nitro']) {
    const b = $(id);
    if (!b) continue;
    b.classList.toggle('ready', ready);
    b.classList.toggle('cooldown', !ready && !active);
    b.textContent = active ? '⚡ BOOST' : `${t('nitro')}`;
  }
}

function updateTitleBest() {
  $('title-best').textContent = `${t('best')} ${best}`;
}

// ---------- 教程 ----------
const TUT_STEPS = () => [
  { text: t('tutStep1'), spot: 'controls' },
  { text: t('tutStep2'), spot: 'nitro' },
  { text: t('tutStep3'), spot: 'road' },
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

// ---------- 事件消费（sim → audio/juice） ----------
function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    if (ev.type === 'crash' && phase === 'playing') { finishRun(ev); return; }
  }
}

// ---------- 输入 ----------
function tryTurn(dir) {
  if (phase !== 'playing' || !run) return;
  audio.unlock();
  const res = dir < 0 ? run.turnLeft() : run.turnRight();
  if (res.ok) audio.event('turn');
}

function tryNitro() {
  if (phase !== 'playing' || !run) return;
  audio.unlock();
  const res = run.useNitro();
  if (res.ok) { audio.event('nitro'); updateNitroButton(); }
}

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  $('btn-mute').classList.toggle('is-muted', muted);
  persist();
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') { tryTurn(-1); }
  else if (e.code === 'ArrowRight' || e.code === 'KeyD') { tryTurn(1); }
  else if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') { e.preventDefault(); tryNitro(); }
  else if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  } else if (e.code === 'KeyR') { if (phase !== 'title') restartLevel(); }
  else if (e.code === 'KeyM') toggleMute();
});

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (phase !== 'playing') return;
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width;
  if (x < 0.4) tryTurn(-1);
  else if (x > 0.6) tryTurn(1);
});

// ---------- UI 绑定 ----------
function bind() {
  const on = (id, fn) => {
    const el = $(id);
    if (el) el.addEventListener('click', () => { audio.unlock(); fn(); });
  };
  on('btn-start', startLevel);
  on('btn-resume', resumeGame);
  on('btn-restart2', restartLevel);
  on('btn-retry', restartLevel);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-pause', pauseGame);
  on('btn-mute', toggleMute);
  on('btn-left', () => tryTurn(-1));
  on('btn-right', () => tryTurn(1));
  on('btn-nitro', tryNitro);
  on('btn-nitro-hud', tryNitro);
  on('btn-howto', () => startTutorial());
  on('btn-howto-title', () => startTutorial());
  on('btn-tut-replay', () => startTutorial());
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);
  on('btn-rotate-skip', () => { $('rotate-screen').style.display = 'none'; });

  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = $(id);
    if (!sel) continue;
    sel.addEventListener('change', () => {
      i18n.setLang(sel.value);
      applyLang();
    });
  }
}

function fillLangOptions() {
  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = $(id);
    if (!sel) continue;
    sel.innerHTML = '';
    for (const item of i18n.options()) {
      const opt = document.createElement('option');
      opt.value = item.code;
      opt.textContent = item.name;
      if (item.code === i18n.lang) opt.selected = true;
      sel.appendChild(opt);
    }
    sel.setAttribute('aria-label', t('language'));
  }
}

function applyLang() {
  syncDocumentLang();
  $('title-text').textContent = t('title');
  $('subtitle-text').textContent = t('subtitle');
  $('btn-start').textContent = t('start');
  $('btn-resume').textContent = t('resume');
  $('btn-retry').textContent = t('retry');
  $('btn-restart2').textContent = t('restart');
  $('btn-home2').textContent = t('home');
  $('btn-home3').textContent = t('home');
  $('btn-howto-title').textContent = t('replayGuide');
  $('pause-title').textContent = t('paused');
  $('btn-nitro-hud').textContent = t('nitro');
  $('rotate-text').textContent = t('rotateHint');
  $('btn-rotate-skip').textContent = t('rotateSkip');
  $('hud-score-label').textContent = t('score');
  $('hud-speed-label').textContent = t('speed');
  $('hud-best-label').textContent = t('best');
  renderTutorialStep();
  updateTitleBest();
  updateHud();
  fillLangOptions();
}

// ---------- 主循环 ----------
function frame(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;

  if (phase === 'playing' && run) {
    accumulator += dt;
    let steps = 0;
    while (accumulator >= STEP && steps < 5) {
      run.step(STEP);
      accumulator -= STEP;
      steps += 1;
    }
    handleEvents(run.drainEvents());
    if (phase === 'playing') updateHud();
  }

  try {
    renderer.draw((run && phase !== 'title') ? run.state : null, dt, {});
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
  start: () => startLevel(),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => restartLevel(),
  home: () => goHome(),
  sim: () => (run ? run.state : null),
  save: (k, v) => (v === undefined ? Sdk.load(k) : Sdk.save(k, v)),
  ui: () => ({ lang: i18n.lang, dir: i18n.dir }),
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['turn', 'nitro', 'rocks']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
    next: () => tutorialNext(),
  },
  startTutorial: () => startTutorial(),
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: () => {
      if (!run) return null;
      const st = run.state;
      return {
        phase: st.phase, score: Math.floor(st.score), speed: st.speed, tier: st.tier,
        level: st.tier + 1, lane: st.lane, combo: st.combo, maxCombo: st.maxCombo,
        cars: st.cars.length, rocks: st.rocks.length, stars: st.stars.length,
        carsPassed: st.carsPassed, starsCollected: st.starsCollected, nitroActive: st.nitroActive,
        nitroCd: st.nitroCd,
      };
    },
    seedRun: (seed) => {
      run = createRun(seed | 0 || 1);
      newBest = false;
      setPhase('playing');
      $('screen-title').classList.add('hidden');
      $('screen-title').classList.remove('is-active');
      $('screen-pause').classList.add('hidden');
      $('screen-result').classList.add('hidden');
      $('hud').classList.remove('hidden');
      $('controls').classList.remove('hidden');
      updateHud();
      return true;
    },
    fastForward: (sec) => {
      if (!run) return false;
      const n = Math.max(1, Math.floor((sec || 1) * 60));
      for (let i = 0; i < n; i += 1) {
        run.step(STEP);
        handleEvents(run.drainEvents());
        if (run.state.phase !== 'running') break;
      }
      updateHud();
      return true;
    },
    crash: () => crash(),
    forceSpawn: (kind) => {
      if (!run) return false;
      const st = run.state;
      if (kind === 'rock') st.rocks.push({ lane: 0, y: 240, w: 52, h: 52, nearMissed: false });
      else if (kind === 'star') st.stars.push({ lane: 3, y: 220, w: 40, h: 40, collected: false });
      else if (kind === 'car') st.cars.push({ lane: 1, y: 160, w: 58, h: 100, dir: 1, passed: false, nearMissed: false, hue: 320 });
      return true;
    },
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    tutorialStep: () => tutorialStep,
    startTutorial: () => startTutorial(),
  },
};

// ---------- 启动 ----------
bind();
syncDocumentLang();
applyLang();
updateTitleBest();
Sdk.track('load', {});
requestAnimationFrame(frame);
