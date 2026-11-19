// 主入口：60Hz 固定步长 + 标题/答题/暂停/结算 + 教程引导 + SDK 统一出口。
// 装配：sim（纯逻辑）/ render（canvas）/ audio（WebAudio）。
import { STEP, GAME } from '../config/game.config.js';
import { TOPICS, TRAVELERS, travelerById, QUESTION_COUNT } from '../config/topics.js';
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
let phase = 'title';       // title | playing | paused | result
let lastTraveler = 0;
let lastTime = performance.now();
let accumulator = 0;
let fpsSamples = [];
let tutorialStep = -1;     // -1 = 未激活
let bannerTimer = null;

const view = {
  hoverOption: null,
  fxQueue: [],             // {type:'correct'|'wrong', option, ttl, max}
  time: 0,
  shake: 0,
  t,
};

// ---------- 存档（统一走 Sdk）----------
let muted = !!Sdk.load('muted', false);
let starsBest = Sdk.load('starsBest', 0) | 0;
let tutorialDone = !!Sdk.load('tutorialDone', false);

Sdk.ready(); // 不 await，不阻塞首屏（sdk-check 要求 main.js 调 Sdk.ready()）
audio.setMuted(muted);

function persist() {
  Sdk.save('muted', muted);
  Sdk.save('starsBest', starsBest);
  Sdk.save('tutorialDone', tutorialDone);
}

function setPhase(p) { phase = p; }

// ---------- 阶段状态机 ----------
function startRun(traveler) {
  const idx = traveler == null ? lastTraveler : (traveler | 0);
  lastTraveler = idx;
  run = createRun({ traveler: idx, seed: (Date.now() % 2147483647) || 1 });
  view.hoverOption = null;
  view.fxQueue = [];
  hideBanner();
  setPhase('playing');
  hideResult();
  $('screen-title').classList.add('hidden');
  $('screen-pause').classList.add('hidden');
  $('hud').classList.remove('hidden');
  updateHud();
  audio.startBgm();
  Sdk.newRun({ traveler: idx });
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
  startRun(run ? run.state.travelerIndex : lastTraveler);
}

function goHome() {
  run = null;
  setPhase('title');
  hideResult();
  hideBanner();
  $('hud').classList.add('hidden');
  $('screen-pause').classList.add('hidden');
  $('screen-title').classList.remove('hidden');
  $('stars-total').textContent = `★ ${starsBest}`;
}

// ---------- HUD / 结算 ----------
function updateHud() {
  if (!run) return;
  const h = run.getHud();
  const trav = travelerById(h.traveler);
  $('hud-traveler').textContent = `${trav.emoji} ${t(trav.nameKey)}`;
  $('hud-progress').textContent = t('questionOf', { n: h.questionIndex + 1, total: h.total });
  $('hud-stars').textContent = `★ ${h.stars}`;
  $('hud-combo').textContent = `×${h.combo}`;
  $('hud-question').textContent = t(run.state.question.titleKey);
  $('hud-instruction').textContent = t('instruction');
  const secs = Math.max(0, Math.ceil(h.timeLeft));
  const timeEl = $('hud-time');
  timeEl.textContent = `${secs}s`;
  timeEl.classList.toggle('time-low', secs <= 5);
  $('btn-hint').classList.toggle('disabled', h.hintLeft <= 0);
  $('btn-hint').title = `${t('hint')} (${h.hintLeft})`;
}

function ratingOf(stars) {
  const max = GAME.MAX_STARS;
  if (stars >= max) return 'ratingS';
  if (stars >= max - 2) return 'ratingA';
  if (stars >= max - 4) return 'ratingB';
  return 'ratingC';
}

function showResult() {
  const st = run.state;
  starsBest = Math.max(starsBest, st.stars);
  persist();
  $('result-title').textContent = t('resultTitle');
  $('result-stars').textContent = '★'.repeat(st.stars) + '☆'.repeat(Math.max(0, GAME.MAX_STARS - st.stars));
  $('result-rating').textContent = t(ratingOf(st.stars));
  $('result-score').textContent = `${t('score')} ${st.score}`;
  $('screen-result').classList.remove('hidden');
}

function hideResult() {
  $('screen-result').classList.add('hidden');
}

function finishRun() {
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  Sdk.levelCleared({ stars: run.state.stars, score: run.state.score });
  Sdk.track('win', { stars: run.state.stars });
  showResult();
  audio.event('win');
}

// ---------- 换人横幅 ----------
function showBanner(nameKey) {
  $('switch-title').textContent = t('switchTitle', { name: t(nameKey) });
  $('switch-text').textContent = t('switchText');
  $('switch-banner').classList.remove('hidden');
  if (bannerTimer) clearTimeout(bannerTimer);
  bannerTimer = setTimeout(hideBanner, 1700);
}

function hideBanner() {
  $('switch-banner').classList.add('hidden');
  if (bannerTimer) { clearTimeout(bannerTimer); bannerTimer = null; }
}

// ---------- 教程引导 ----------
const TUT_STEPS = () => [
  { text: t('tutStep1'), spot: 'option' },
  { text: t('tutStep2'), spot: 'combo' },
  { text: t('tutStep3'), spot: 'timer' },
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
  const spot = $('tut-spotlight');
  if (s && s.spot === 'option' && run && run.state.question) {
    const opt = run.state.question.options[0];
    const lay = renderer.debugLayout();
    spot.style.display = 'block';
    const cx = opt.x * 1280;
    const cy = lay.sceneTop + opt.y * lay.sceneH;
    spot.style.left = `${cx - 60}px`;
    spot.style.top = `${cy - 60}px`;
    spot.style.width = '120px';
    spot.style.height = '120px';
  } else {
    spot.style.display = 'none';
  }
  // 卡片固定底部居中（vision-review 判 HUD 遮挡的硬约束）
  const card = $('tut-card');
  card.style.left = '50%';
  card.style.transform = 'translateX(-50%)';
  card.style.bottom = '36px';
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

// 真实动作驱动推进：tap → correct → win
const TUT_TRIGGER = ['tap', 'correct', 'win'];
function tutorialAdvance(evType) {
  if (tutorialStep < 0 || tutorialStep >= TUT_TRIGGER.length) return;
  if (TUT_TRIGGER[tutorialStep] !== evType) return;
  tutorialStep += 1;
  if (tutorialStep >= TUT_TRIGGER.length) endTutorial();
  else renderTutorialStep();
}

// ---------- 事件消费 ----------
function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    tutorialAdvance(ev.type);
    switch (ev.type) {
      case 'tap':
        break;
      case 'correct':
        view.fxQueue.push({ type: 'correct', option: ev.i, ttl: 0.45, max: 0.45 });
        break;
      case 'wrong':
        view.fxQueue.push({ type: 'wrong', option: ev.i, ttl: 0.45, max: 0.45 });
        view.shake = 4;
        break;
      case 'timeout':
        view.shake = 4;
        break;
      case 'star':
        view.fxQueue.push({ type: 'correct', option: run.state.question ? run.state.question.correct[0] : 0, ttl: 0.6, max: 0.6 });
        break;
      case 'charSwitch':
        showBanner(travelerById(ev.traveler).nameKey);
        break;
      case 'win':
        finishRun();
        return;
      default:
        break;
    }
  }
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
  const p = canvasPos(e);
  view.hoverOption = (run && phase === 'playing') ? (renderer.pick(p.x, p.y, run.state)?.i ?? null) : null;
});

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (!run || phase !== 'playing') return;
  const p = canvasPos(e);
  const opt = renderer.pick(p.x, p.y, run.state);
  if (!opt) return;
  const res = run.answer(opt.i);
  if (res.ok) updateHud();
});

canvas.addEventListener('pointerleave', () => { view.hoverOption = null; });

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
  if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'result')) restartLevel();
  if (e.code === 'KeyM') toggleMute();
});

function useHint() {
  if (!run || phase !== 'playing') return;
  audio.unlock();
  const res = run.hint();
  if (res.ok) updateHud();
}

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  $('btn-mute').textContent = muted ? '🔇' : '🔊';
  persist();
}

// ---------- UI 绑定 ----------
function bind() {
  const on = (id, fn) => {
    const el = $(id);
    if (el) el.addEventListener('click', () => { audio.unlock(); fn(); });
  };
  on('btn-start', () => startRun(0));
  on('btn-resume', resumeGame);
  on('btn-restart2', restartLevel);
  on('btn-retry', restartLevel);
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-hint', useHint);
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result' || phase === 'paused') startTutorial(); });
  on('btn-tut-replay', () => { if (phase === 'paused') resumeGame(); startTutorial(); });
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);

  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = $(id);
    if (!sel) continue;
    sel.addEventListener('change', () => {
      i18n.setLang(sel.value);
      renderTutorialStep();
      if (run) updateHud();
      applyStaticText();
    });
  }
}

function applyStaticText() {
  $('title-text').textContent = t('title');
  $('subtitle-text').textContent = t('subtitle');
  $('btn-start').textContent = t('start');
  $('pause-title').textContent = t('paused');
  $('btn-resume').textContent = t('resume');
  $('btn-restart2').textContent = t('restart');
  $('btn-tut-replay').textContent = t('replayGuide');
  $('btn-home3').textContent = t('home');
  $('btn-retry').textContent = t('playAgain');
  $('btn-home2').textContent = t('menuBtn');
  const rt = $('rotate-text');
  const rb = $('btn-rotate-skip');
  if (rt) rt.textContent = t('rotateHint');
  if (rb) rb.textContent = t('rotateSkip');
}

function buildLangSelects() {
  const options = i18n.options().map((o) => `<option value="${o.code}">${o.name}</option>`).join('');
  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = $(id);
    if (!sel) continue;
    sel.innerHTML = options;
    sel.value = i18n.lang;
  }
}

// ---------- 主循环 ----------
function frame(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;
  view.time += dt;
  if (view.shake > 0) view.shake = Math.max(0, view.shake - dt * 18);
  for (const fx of view.fxQueue) if (fx.ttl > 0) fx.ttl -= dt;
  view.fxQueue = view.fxQueue.filter((fx) => fx.ttl > 0);

  if (phase === 'playing' && run) {
    accumulator += dt;
    while (accumulator >= STEP) {
      run.step(STEP);
      accumulator -= STEP;
    }
    handleEvents(run.drainEvents());
    if (run && phase === 'playing') updateHud();
  }

  try {
    renderer.draw(run ? run.state : null, dt, view);
  } catch (err) {
    // 渲染异常不打断主循环
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
  start: (i) => startRun(i == null ? 0 : i),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => restartLevel(),
  home: () => goHome(),
  sim: () => (run ? run.state : null),
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['tap', 'correct', 'win']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  save: (k, v) => Sdk.save(k, v),
  ui: {},
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: () => {
      if (!run) return null;
      return { ...run.state, hintLeft: run.state.hintLeft, levelsReached: run.state.levelsReached };
    },
    layout: () => { try { return renderer.debugLayout(); } catch { return null; } },
    startSeeded: (traveler, seed) => {
      lastTraveler = traveler == null ? 0 : (traveler | 0);
      run = createRun({ traveler: lastTraveler, seed: seed | 0 || 1 });
      view.hoverOption = null;
      view.fxQueue = [];
      hideBanner();
      setPhase('playing');
      hideResult();
      $('screen-title').classList.add('hidden');
      $('screen-pause').classList.add('hidden');
      $('hud').classList.remove('hidden');
      updateHud();
      return true;
    },
    jumpTo: (q) => { if (run) { run.jumpTo(q); updateHud(); } return true; },
    answer: (i) => {
      if (!run) return null;
      const q = run.state.question;
      const idx = i == null ? (q.correct[0] ?? 0) : i;
      const res = run.answer(idx);
      updateHud();
      return res;
    },
    useHint: () => { if (run) { const r = run.hint(); updateHud(); return r; } return null; },
    fastForward: () => {
      if (!run) return false;
      let guard = 40;
      while (guard-- > 0 && run.state.phase === 'playing') {
        const q = run.state.question;
        run.answer(q.correct[0] ?? 0);
      }
      updateHud();
      return true;
    },
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    startTutorial: () => startTutorial(),
    tutorialStep: () => tutorialStep,
  },
};

// ---------- 启动 ----------
bind();
syncDocumentLang();
applyStaticText();
buildLangSelects();
$('stars-total').textContent = `★ ${starsBest}`;
$('btn-mute').textContent = muted ? '🔇' : '🔊';
$('hud-instruction').textContent = t('instruction');
Sdk.track('load', {});
requestAnimationFrame(frame);
