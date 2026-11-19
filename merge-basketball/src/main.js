// MERGE BASKETBALL · 主入口：60Hz 固定步长 + 标题/游戏/暂停/结算 + 教程 + SDK 统一出口
// 装配：sim(纯逻辑) / render(Canvas 程序化) / audio(WebAudio) / ui(DOM+CSS)。
import { STEP, CONFIG, GAME } from '../config/game.config.js';
import { createRun, rankFor, starsFor } from './game/sim.js';
import { createRenderer, ballColor } from './render/index.js';
import { createAudio } from './core/audio.js';
import { i18n, t, syncDocumentLang } from './core/i18n.js';
import Sdk from './core/sdk.js';

const $ = (id) => document.getElementById(id);
const canvas = $('canvas');
const renderer = createRenderer(canvas);
const audio = createAudio();

const LEGEND_VALUES = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024];

let run = null;
let phase = 'title'; // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let fpsSamples = [];
let tutorialStep = -1; // -1 = 未激活
let wonBig = false;

const view = {
  pointerX: null,
  aiming: false,
  fx: [], // {type, x, y, ttl}
};

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let bestScore = Sdk.load('best', 0) | 0;
let tutorialDone = !!Sdk.load('tutorialDone', false);

Sdk.ready();
Sdk.onAdStart(() => { if (phase === 'playing') pauseGame(true); });
Sdk.onAdEnd(() => { if (phase === 'paused') resumeGame(); });
audio.setMuted(muted);

function persist() {
  Sdk.save('muted', muted);
  Sdk.save('best', bestScore);
  Sdk.save('tutorialDone', tutorialDone);
}

// ---------- 阶段状态机 ----------
function setPhase(p) { phase = p; }

function startGame() {
  run = createRun((Date.now() % 2147483647) || 1);
  wonBig = false;
  view.fx = [];
  view.aiming = false;
  setPhase('playing');
  $('screen-title').classList.add('hidden');
  $('screen-title').classList.remove('is-active');
  $('screen-pause').classList.add('hidden');
  hideResult();
  showHud();
  showLegend();
  updateHud();
  buildLegend();
  audio.startBgm();
  Sdk.newRun();
  Sdk.track('start', {});
  if (!tutorialDone) startTutorial();
}

function pauseGame(silent) {
  if (phase !== 'playing') return;
  setPhase('paused');
  audio.stopBgm();
  if (!silent) showPause();
}

function resumeGame() {
  if (phase !== 'paused') return;
  setPhase('playing');
  hidePause();
  audio.startBgm();
}

function restartGame() {
  startGame();
}

function goHome() {
  run = null;
  setPhase('title');
  hideResult();
  hidePause();
  hideHud();
  hideLegend();
  showTitle();
  buildLangOptions();
}

// ---------- 屏幕显隐 ----------
function showTitle() { $('screen-title').classList.remove('hidden'); $('screen-title').classList.add('is-active'); }
function showPause() { $('screen-pause').classList.remove('hidden'); applyPauseText(); }
function hidePause() { $('screen-pause').classList.add('hidden'); }
function showHud() { $('hud').classList.remove('hidden'); }
function hideHud() { $('hud').classList.add('hidden'); }
function showLegend() { $('legend').classList.remove('hidden'); }
function hideLegend() { $('legend').classList.add('hidden'); }
function hideResult() { $('screen-result').classList.add('hidden'); }

// ---------- HUD / 阶梯 / 结算 ----------
function updateHud() {
  if (!run) return;
  $('hud-score').textContent = `${t('score')} ${run.state.score}`;
  $('hud-best').textContent = `${t('best')} ${Math.max(bestScore, run.state.score)}`;
  const comboEl = $('hud-combo');
  if (run.state.combo >= 2 && run.state.comboFlash > 0) {
    comboEl.classList.remove('hidden');
    comboEl.textContent = `${t('combo')} x${run.state.combo}`;
  } else {
    comboEl.classList.add('hidden');
  }
}

function buildLegend() {
  const el = $('legend');
  el.innerHTML = '';
  for (const v of LEGEND_VALUES) {
    const chip = document.createElement('span');
    chip.className = 'legend-chip' + (v === GAME.WIN_VALUE ? ' goal' : '');
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = ballColor(v).main;
    const label = document.createElement('span');
    label.textContent = v === GAME.WIN_VALUE ? `${v} ${t('goal')}` : String(v);
    chip.appendChild(dot);
    chip.appendChild(label);
    el.appendChild(chip);
  }
}

function showResult(ev) {
  const st = run.state;
  const stars = ev.stars || starsFor(st.biggest);
  if (st.score > bestScore) {
    bestScore = st.score;
    persist();
  }
  setPhase('result');
  audio.stopBgm();
  hideHud();
  hideLegend();
  $('result-title').textContent = wonBig ? t('winTitle') : t('loseTitle');
  $('result-stars').textContent = '★'.repeat(stars) + '☆'.repeat(Math.max(0, 3 - stars));
  const metaParts = [`${t('score')} ${st.score}`];
  if (wonBig) metaParts.push(t('madeBig'));
  else metaParts.push(`${t('goal')} ${GAME.WIN_VALUE}`);
  $('result-meta').textContent = metaParts.join(' · ');
  $('result-best').textContent = `${t('best')} ${bestScore}`;
  $('btn-retry').textContent = t('retry');
  $('btn-home2').textContent = t('menu');
  $('screen-result').classList.remove('hidden');
  Sdk.gameOver({ score: st.score, biggest: st.biggest, stars, wonBig });
}

function finishRun(ev) {
  if (tutorialStep >= 0) endTutorial();
  showResult(ev);
  audio.event('lose');
}

// ---------- 事件消费 ----------
function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    tutorialAdvance(ev.type);
    switch (ev.type) {
      case 'merge':
        view.fx.push({ type: 'merge', x: ev.x, y: ev.y, ttl: 1.2 });
        break;
      case 'rock':
        view.fx.push({ type: 'rock', x: ev.x, y: ev.y, ttl: 1.2 });
        break;
      case 'drop':
      case 'autoDrop':
        view.fx.push({ type: 'drop', x: ev.x, y: GAME.SPAWN_Y, ttl: 0.5 });
        break;
      case 'win':
        wonBig = true;
        break;
      case 'lose':
        finishRun(ev);
        return;
      default:
        break;
    }
  }
}

// ---------- 教程（首次自动弹，可跳过，可重看，持久化） ----------
const TUT_STEPS = () => [
  { text: t('tutStep1'), spot: 'stage' },
  { text: t('tutStep2'), spot: 'legend' },
  { text: t('tutStep3'), spot: 'stage' },
  { text: t('tutStep4'), spot: 'legend' },
];
const TUT_TRIGGER = ['drop', 'merge', 'autoDrop', 'win'];

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
  if (s && s.spot === 'stage') {
    const lay = renderer.debugLayout();
    const p = lay && lay.play ? lay.play : null;
    if (p) {
      spot.style.display = 'block';
      spot.style.left = `${p.x - 4}px`;
      spot.style.top = `${p.y - 4}px`;
      spot.style.width = `${p.w + 8}px`;
      spot.style.height = `${p.h + 8}px`;
    }
  } else if (s && s.spot === 'legend') {
    const lg = $('legend').getBoundingClientRect();
    const stage = $('stage').getBoundingClientRect();
    spot.style.display = 'block';
    spot.style.left = `${lg.left - stage.left}px`;
    spot.style.top = `${lg.top - stage.top}px`;
    spot.style.width = `${lg.width}px`;
    spot.style.height = `${lg.height}px`;
  } else {
    spot.style.display = 'none';
  }
}

function tutorialNext() {
  tutorialStep += 1;
  if (tutorialStep >= TUT_STEPS().length) endTutorial();
  else renderTutorialStep();
}

function tutorialAdvance(evType) {
  if (tutorialStep < 0 || tutorialStep >= TUT_TRIGGER.length) return;
  if (TUT_TRIGGER[tutorialStep] !== evType) return;
  tutorialStep += 1;
  if (tutorialStep >= TUT_TRIGGER.length) endTutorial();
  else renderTutorialStep();
}

function endTutorial() {
  tutorialStep = -1;
  tutorialDone = true;
  persist();
  renderTutorialStep();
}

// ---------- 输入 ----------
function canvasToPlayX(clientX) {
  const lay = renderer.debugLayout();
  const rect = canvas.getBoundingClientRect();
  if (!lay || !lay.scale) return GAME.SPAWN_Y;
  return (clientX - rect.left - lay.offX) / lay.scale;
}

canvas.addEventListener('pointermove', (e) => {
  view.pointerX = canvasToPlayX(e.clientX);
});
canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (!run || phase !== 'playing') return;
  view.aiming = true;
  view.pointerX = canvasToPlayX(e.clientX);
});
canvas.addEventListener('pointerup', (e) => {
  if (!run || phase !== 'playing') return;
  view.aiming = false;
  const x = canvasToPlayX(e.clientX);
  run.drop(x);
  updateHud();
});
canvas.addEventListener('pointerleave', () => { view.aiming = false; });

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
  if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'result')) restartGame();
  if (e.code === 'KeyM') toggleMute();
  if (e.code === 'KeyH' && (phase === 'playing' || phase === 'result')) startTutorial();
});

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  $('btn-mute').classList.toggle('is-muted', muted);
  persist();
}

// ---------- UI 绑定 ----------
function buildLangOptions() {
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
  }
}

function applyLangTexts() {
  $('title-text').textContent = t('title');
  $('subtitle-text').textContent = t('subtitle');
  $('goal-line').textContent = `${t('goal')} ${GAME.WIN_VALUE}`;
  $('btn-start').textContent = t('start');
  $('pause-title').textContent = t('paused');
  $('btn-resume').textContent = t('resume');
  $('btn-restart2').textContent = t('restart');
  $('btn-tut-replay').textContent = t('replayGuide');
  $('btn-home3').textContent = t('home');
  $('rotate-text').textContent = t('rotateHint');
  $('btn-rotate-skip').textContent = t('rotateSkip');
  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = $(id);
    if (sel) sel.setAttribute('aria-label', t('language'));
  }
  buildLangOptions();
  if (run) updateHud();
}

function applyPauseText() {
  $('pause-title').textContent = t('paused');
  $('btn-resume').textContent = t('resume');
  $('btn-restart2').textContent = t('restart');
  $('btn-tut-replay').textContent = t('replayGuide');
  $('btn-home3').textContent = t('home');
  buildLangOptions();
}

function bind() {
  const on = (id, fn) => {
    const el = $(id);
    if (el) el.addEventListener('click', () => { audio.unlock(); fn(); });
  };
  on('btn-start', startGame);
  on('btn-resume', resumeGame);
  on('btn-restart', restartGame);
  on('btn-restart2', restartGame);
  on('btn-retry', restartGame);
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-tut-replay', () => { if (phase === 'paused') resumeGame(); if (phase === 'playing' || phase === 'result') startTutorial(); });
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result') startTutorial(); });
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);

  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = $(id);
    if (!sel) continue;
    sel.addEventListener('change', () => {
      i18n.setLang(sel.value);
      applyLangTexts();
      if (run) buildLegend();
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

  for (const fx of view.fx) if (fx.ttl > 0) fx.ttl -= dt;
  view.fx = view.fx.filter((fx) => fx.ttl > 0);

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
  start: () => startGame(),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => restartGame(),
  home: () => goHome(),
  sim: () => (run ? run.state : null),
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['drop', 'merge', 'autoDrop', 'win']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: () => (run ? run.state : null),
    layout: () => { try { return renderer.debugLayout(); } catch { return null; } },
    drop: (x) => (run ? run.drop(x == null ? 187 : x) : { ok: false }),
    forceLose: () => {
      if (!run) return false;
      finishRun({ type: 'lose', stars: starsFor(run.state.biggest), score: run.state.score, biggest: run.state.biggest });
      return true;
    },
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
  },
};

// ---------- 启动 ----------
bind();
syncDocumentLang();
applyLangTexts();
buildLangOptions();
$('btn-mute').classList.toggle('is-muted', muted);
Sdk.track('load', {});
requestAnimationFrame(frame);
