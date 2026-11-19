// 主入口：60Hz 固定步长 + 标题/玩法/暂停/结算 + 教程引导 + SDK 统一出口。
// 装配：sim(M1) / render+ui(M2) / audio(M4) / Lead 集成。
// 契约：window.__ll = { state, start, pause, resume, restart, run, tutorial, startTutorial, debug }。
import { STEP, WORLD, CLAW } from '../config/game.config.js';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';
import { createRun } from './game/sim.js';
import { greedyPick } from './game/bots.js';
import { createRenderer } from './render/index.js';
import { createAudio } from './core/audio.js';
import { ui } from './ui/ui.js';
import { i18n, t, syncDocumentLang } from './core/i18n.js';
import Sdk from './core/sdk.js';

const canvas = ui.canvas;
const renderer = createRenderer(canvas);
const audio = createAudio();

let run = null;
let phase = 'title';        // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let fpsSamples = [];
let tutorialStep = -1;      // -1 = 未激活
let currentLevel = 0;       // 0 基
let best = Sdk.load('best', 0) | 0;
let tutorialDone = !!Sdk.load('tutorialDone', false);
let muted = !!Sdk.load('muted', false);

const view = {
  t: 0,
  shake: 0,
  flash: 0,
  sparks: [],
};

Sdk.ready(); // 不 await，不阻塞首屏
Sdk.onAdStart(() => { if (phase === 'playing') pauseGame(true); });
Sdk.onAdEnd(() => { if (phase === 'paused') resumeGame(); });
audio.setMuted(muted);
ui.setMuted(muted);

function persist() {
  Sdk.save('best', best);
  Sdk.save('tutorialDone', tutorialDone);
  Sdk.save('muted', muted);
  Sdk.save('lastLevel', currentLevel);
}

// ---------- 阶段状态机 ----------
function setPhase(p) { phase = p; }

function startLevel(idx) {
  idx = Math.max(0, Math.min(LEVEL_COUNT - 1, idx | 0));
  currentLevel = idx;
  run = createRun(idx, { seed: (Date.now() % 2147483647) || 1 });
  setPhase('playing');
  ui.showGame();
  ui.hideResult();
  updateHud();
  audio.startBgm();
  Sdk.track('start', { level: idx + 1 });
  if (!tutorialDone && idx === 0) startTutorial();
}

function startSeeded(idx, seed) {
  idx = Math.max(0, Math.min(LEVEL_COUNT - 1, idx | 0));
  currentLevel = idx;
  run = createRun(idx, { seed: seed | 0 || 1 });
  setPhase('playing');
  ui.showGame();
  ui.hideResult();
  updateHud();
  audio.startBgm();
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

function restartLevel() {
  const lv = run ? run.state.level - 1 : currentLevel;
  startLevel(lv);
}

function goHome() {
  run = null;
  setPhase('title');
  ui.hideResult();
  ui.showTitle();
}

// ---------- HUD ----------
function updateHud() {
  if (!run) return;
  const h = run.getHud();
  const lv = LEVELS[run.state.level - 1] || {};
  ui.hudLevel.textContent = `${t('level')} ${run.state.level}${lv.name ? ' · ' + (lv.name[i18n.lang] || lv.name.en) : ''}`;
  const secs = Math.max(0, Math.ceil(h.timeLeft));
  ui.hudTime.textContent = `${secs}s`;
  ui.hudTime.classList.toggle('time-low', secs <= 10);
  ui.hudTarget.textContent = `${t('target')} ${h.target}`;
  ui.hudBest.textContent = `${t('best')} ${best}`;
  ui.hudScore.textContent = `${h.score}`;
  ui.hudCombo.textContent = `×${h.combo}`;
  ui.hudCombo.classList.toggle('hidden', h.combo < 2);
  ui.btnPower.classList.toggle('hidden', !h.powerReady);
  ui.btnPower.classList.toggle('ready', h.powerReady);
  ui.btnPower.textContent = h.fever ? '✨' : '🔥';
  ui.btnBank.classList.toggle('hidden', h.score < h.target);
  ui.btnBank.textContent = t('bank');
}

// ---------- 结算 ----------
function showResult(res) {
  const { won, stars, score, target } = res;
  ui.resultTitle.textContent = won ? t('winTitle') : t('loseTitle');
  ui.resultTitle.classList.toggle('lose', !won);
  ui.resultStars.innerHTML = won
    ? `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}`
    : '';
  ui.resultScore.textContent = `${t('resultScore')}: ${score}`;
  ui.resultMeta.textContent = won
    ? (stars >= 3 ? t('perfect') : t('bankHint'))
    : (score < target ? t('notEnough', { n: target }) : t('timeOut'));
  ui.btnNext.style.display = won && run.state.level < LEVEL_COUNT ? '' : 'none';
  ui.showResult();
}

function finishRun(ev) {
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  const st = run.state;
  const won = ev.type === 'win';
  const score = st.score;
  best = Math.max(best, score);
  if (won && st.level < LEVEL_COUNT) currentLevel = Math.max(currentLevel, st.level);
  persist();
  Sdk.track(won ? 'win' : 'fail', { level: st.level, score, stars: st.stars });
  showResult({ won, stars: st.stars, score, target: st.target });
  audio.event(won ? 'win' : 'lose');
}

// ---------- 教程 ----------
const TUT_STEPS = () => ['drop', 'grab', 'fever'];

function startTutorial() {
  tutorialStep = 0;
  renderTutorialStep();
}

function renderTutorialStep() {
  const el = ui.canvas.parentElement.querySelector('#tutorial');
  if (!el) return;
  if (tutorialStep < 0) { el.classList.add('hidden'); return; }
  const steps = TUT_STEPS();
  el.classList.remove('hidden');
  const idx = Math.min(tutorialStep, steps.length - 1);
  const key = ['tutStep1', 'tutStep2', 'tutStep3'][idx] || 'tutStep1';
  ui.tutText.textContent = t(key);
  const spot = el.querySelector('#tut-spotlight');
  if (spot) spot.style.display = 'none';
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

function tutorialAdvance(evType) {
  if (tutorialStep < 0 || tutorialStep >= TUT_STEPS().length) return;
  if (TUT_STEPS()[tutorialStep] !== evType) return;
  tutorialStep += 1;
  if (tutorialStep >= TUT_STEPS().length) endTutorial();
  else renderTutorialStep();
}

// ---------- 事件消费 ----------
function spark(x, y, n) {
  for (let i = 0; i < n; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const sp = Math.random() * 120 + 40;
    view.sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, age: 0, life: 0.5 + Math.random() * 0.3 });
  }
  if (view.sparks.length > 80) view.sparks.splice(0, view.sparks.length - 80);
}

function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    tutorialAdvance(ev.type);
    switch (ev.type) {
      case 'hit':
        view.shake = Math.max(view.shake, 2);
        spark(run.state.hook.tip.x, run.state.hook.tip.y, 3);
        break;
      case 'grab':
        view.shake = Math.max(view.shake, 3);
        spark(run.state.hook.tip.x, run.state.hook.tip.y, 8);
        break;
      case 'rockHit':
        view.shake = Math.max(view.shake, 7);
        view.flash = 0.35;
        break;
      case 'miss':
        view.shake = Math.max(view.shake, 1);
        break;
      case 'fever':
        view.flash = 0.5;
        spark(CLAW.pivotX, CLAW.pivotY, 14);
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
function tryDrop() {
  audio.unlock();
  if (!run || phase !== 'playing') return;
  run.drop();
}

function tryPower() {
  audio.unlock();
  if (!run || phase !== 'playing') return;
  run.power();
  updateHud();
}

function tryBank() {
  audio.unlock();
  if (!run || phase !== 'playing') return;
  if (run.bank().ok) { /* 结算由事件驱动 */ }
}

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  tryDrop();
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); tryDrop(); }
  else if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
  else if (e.code === 'KeyR') { if (phase !== 'title') restartLevel(); }
  else if (e.code === 'KeyM') toggleMute();
  else if (e.code === 'KeyN' || e.code === 'KeyB') tryBank();
  else if (e.code === 'KeyF') tryPower();
});

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  ui.setMuted(muted);
  persist();
}

// ---------- UI 绑定 ----------
function bind() {
  const on = (id, fn) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', () => { audio.unlock(); fn(); });
  };
  on('btn-start', () => startLevel(currentLevel));
  on('btn-resume', resumeGame);
  on('btn-restart', restartLevel);
  on('btn-restart2', restartLevel);
  on('btn-retry', restartLevel);
  on('btn-next', () => startLevel((run ? run.state.level : currentLevel + 1)));
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-power', tryPower);
  on('btn-bank', tryBank);
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result' || phase === 'paused') startTutorial(); });
  on('btn-tut-replay', () => { if (phase === 'paused') resumeGame(); startTutorial(); });
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);

  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = document.getElementById(id);
    if (!sel) continue;
    sel.addEventListener('change', () => {
      ui.setLang(sel.value);
      renderTutorialStep();
      if (run) updateHud();
    });
  }
}

// ---------- 主循环 ----------
function frame(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;
  view.t += dt;

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
  if (view.flash > 0) view.flash = Math.max(0, view.flash - dt * 2);
  view.sparks = view.sparks.filter((sp) => sp.age < sp.life);

  try {
    renderer.draw(run ? run.state : null, dt, view);
  } catch (err) {
    console.warn('render error', err);
  }

  if (fpsSamples.length < 600 && dt > 0) fpsSamples.push(1 / dt);
  requestAnimationFrame(frame);
}

// ---------- 调试契约 ----------
function autoPlay(seconds, opts = {}) {
  if (!run || phase !== 'playing') return false;
  let budget = seconds;
  let guard = 0;
  while (budget > 0 && run.state.phase === 'playing' && guard++ < 20000) {
    if (run.state.hook.phase !== 'swinging') {
      run.step(STEP); budget -= STEP;
      handleEvents(run.drainEvents());
      continue;
    }
    const pick = greedyPick(run, { allowBank: opts.bank !== false });
    if (!pick) { run.step(STEP); budget -= STEP; handleEvents(run.drainEvents()); continue; }
    if (pick.type === 'power') {
      run.power();
      handleEvents(run.drainEvents());
      run.step(STEP); budget -= STEP;
      continue;
    }
    if (pick.type === 'bank') {
      if (opts.bank !== false && run.bank().ok) { /* win via events */ }
      handleEvents(run.drainEvents());
      run.step(STEP); budget -= STEP;
      continue;
    }
    if (pick.type === 'drop') {
      let dropped = false;
      for (let i = 0; i < 400 && run.state.phase === 'playing'; i += 1) {
        const before = run.state.hook.angle;
        run.step(STEP); budget -= STEP;
        handleEvents(run.drainEvents());
        const after = run.state.hook.angle;
        if (run.state.phase !== 'playing') break;
        const d = run.state.hook.dir;
        if (d === 1 && before < pick.angle && after >= pick.angle) { run.state.hook.angle = pick.angle; run.drop(); dropped = true; break; }
        if (d === -1 && before > pick.angle && after <= pick.angle) { run.state.hook.angle = pick.angle; run.drop(); dropped = true; break; }
      }
      if (!dropped && run.state.phase === 'playing') run.drop();
      handleEvents(run.drainEvents());
      run.step(STEP); budget -= STEP;
      continue;
    }
    run.step(STEP); budget -= STEP;
    handleEvents(run.drainEvents());
  }
  updateHud();
  return true;
}

window.__ll = {
  state: {
    get phase() { return phase; },
    get lang() { return i18n.lang; },
  },
  run: () => run,
  sim: () => (run ? run.state : null),
  save: () => Sdk,
  ui: () => ui,
  share: () => Sdk.share,
  start: (i) => startLevel(i == null ? currentLevel : i),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => restartLevel(),
  home: () => goHome(),
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return TUT_STEPS(); },
    get current() { return tutorialStep >= 0 ? { id: TUT_STEPS()[tutorialStep] } : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: () => (run ? run.state : null),
    loadLevel: (i) => startLevel(i),
    startSeeded: (i, seed) => startSeeded(i, seed),
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    tutorialStep: () => tutorialStep,
    autoPlay: (sec, opts) => autoPlay(sec, opts),
    winNow: () => { if (run && run.state.phase === 'playing') { run.state.score = Math.max(run.state.score, run.state.target); run.bank(); } },
    fastForward: (sec) => { if (run) { for (let i = 0; i < Math.round(sec * 60); i += 1) { run.step(STEP); } handleEvents(run.drainEvents()); updateHud(); } },
  },
};

// ---------- 启动 ----------
bind();
syncDocumentLang();
ui.applyLang();
ui.showTitle();
renderer.draw(null, 0, view);
Sdk.track('load', {});
requestAnimationFrame(frame);
