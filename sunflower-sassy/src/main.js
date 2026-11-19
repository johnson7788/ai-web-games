// 主入口：60Hz 固定步长 + 标题/游戏/暂停/结算 + 教程引导 + SDK 统一出口。
// 装配：sim / render / ui / audio。调试契约 window.__ll。
import { STEP, GAME } from '../config/game.config.js';
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

let run = null;
let phase = 'title';       // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let fpsSamples = [];
let tutorialStep = -1;     // -1 = 未激活

// 渲染视图状态
const view = {
  t: 0,
  fxQueue: [],
  shake: 0,
};

// 当前方向牌中心（与 render 布局一致，供粒子定位）
const CUR_TILE = { x: 310 + 42, y: 500 + 48 };

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let best = Sdk.load('best', 0) | 0;
let tutorialDone = !!Sdk.load('tutorialDone', false);

Sdk.ready(); // 不 await，不阻塞首屏
audio.setMuted(muted);
ui.setMuted(muted);

function persist() {
  Sdk.save('muted', muted);
  Sdk.save('best', best);
  Sdk.save('tutorialDone', tutorialDone);
}

// ---------- 阶段状态机 ----------
function setPhase(p) { phase = p; }

function startGame() {
  run = createRun({ seed: (Date.now() % 2147483647) || 1 });
  view.fxQueue = [];
  view.shake = 0;
  setPhase('playing');
  ui.show('game');
  hideResult();
  updateHud();
  audio.startBgm();
  Sdk.newRun({ mode: 'arcade' });
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
  if (run) Sdk.track('restart', { score: run.state.score });
  startGame();
}

function goHome() {
  run = null;
  setPhase('title');
  hideResult();
  ui.show('title');
  updateBestText();
}

// ---------- HUD / 结算 ----------
function updateHud() {
  if (!run) return;
  const h = run.getHud();
  $('hud-time').textContent = Math.max(0, Math.ceil(h.timeLeft)) + 's';
  $('hud-time').classList.toggle('time-low', h.timeLeft <= 10);
  $('hud-score').textContent = `${t('score')} ${h.score}`;
  $('hud-stage').textContent = `${t('stage')} ${h.stage}`;
  const comboEl = $('hud-combo');
  comboEl.textContent = h.combo > 1 ? `×${h.combo}` : '';
  comboEl.classList.toggle('hidden', h.combo <= 1);
  comboEl.classList.toggle('fever-on', h.fever);
  $('hud-hearts').textContent = '♥'.repeat(h.hearts) + '♡'.repeat(h.maxHearts - h.hearts);
  $('hud-hearts').classList.toggle('danger', h.hearts <= 1);
}

function updateBestText() {
  $('best-text').textContent = `${t('best')} ${best}`;
}

function showResult(ev) {
  const s = run.state;
  const won = ev.type === 'win';
  $('result-title').textContent = won ? t('winTitle') : t('loseTitle');
  $('result-title').classList.toggle('lose', !won);
  $('result-stars').innerHTML = won
    ? `${'★'.repeat(ev.stars)}${'☆'.repeat(3 - ev.stars)}`
    : '';
  $('result-score').textContent = `${t('score')} ${s.score}`;
  $('result-meta').textContent = won ? t('timeUp') : t('lostHearts');
  if (s.score > best) {
    $('result-meta').textContent += ` · ${t('newBest')}`;
  }
  $('screen-result').classList.remove('hidden');
}

function hideResult() {
  $('screen-result').classList.add('hidden');
}

function finishRun(ev) {
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  const s = run.state;
  const won = ev.type === 'win';
  const stars = won ? (ev.stars || s.stars || 1) : 0;
  if (s.score > best) {
    best = s.score;
  }
  persist();
  Sdk.track(won ? 'win' : 'fail', {
    score: s.score, stars, maxCombo: s.maxCombo, stage: s.stage, durationMs: Math.round(s.elapsed * 1000),
  });
  showResult(ev);
  updateBestText();
  audio.event(won ? 'win' : 'lose');
}

// ---------- 教程（首次自动弹，可跳过，跳过后不再自动弹） ----------
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

// ---------- 事件消费 ----------
function tileColor(dir) {
  if (dir === 'left') return '#00e5ff';
  if (dir === 'right') return '#ff2d95';
  return '#a855f7';
}

function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    switch (ev.type) {
      case 'match':
        view.fxQueue.push({ type: 'pop', x: CUR_TILE.x, y: CUR_TILE.y, color: tileColor(ev.dir), ttl: 0.4 });
        break;
      case 'dodge':
        view.fxQueue.push({ type: 'pop', x: CUR_TILE.x, y: CUR_TILE.y, color: '#a855f7', ttl: 0.4 });
        break;
      case 'miss':
      case 'timeout':
        view.shake = 6;
        break;
      case 'score':
        view.fxQueue.push({ type: 'float', x: 640, y: 210, text: `+${ev.gained}`, color: '#ffd23f', ttl: 0.7 });
        break;
      case 'combo':
        view.fxQueue.push({ type: 'float', x: 640, y: 170, text: `×${ev.combo}`, color: '#39ff88', ttl: 0.6 });
        break;
      case 'fever':
        view.fxQueue.push({ type: 'float', x: 640, y: 130, text: t('fever'), color: '#ff2d95', ttl: 1.2 });
        view.shake = 5;
        break;
      case 'stage':
        view.fxQueue.push({ type: 'float', x: 640, y: 130, text: `${t('stage')} ${ev.stage}`, color: '#00e5ff', ttl: 1.0 });
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
function doTap(dir) {
  audio.unlock();
  if (!run || phase !== 'playing') return;
  const res = run.tap(dir);
  if (res.ok) {
    handleEvents(run.drainEvents());
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
  on('btn-left', () => doTap('left'));
  on('btn-right', () => doTap('right'));
  on('btn-dodge', () => doTap('dodge'));
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result') startTutorial(); });
  on('btn-tut-replay', () => { if (phase === 'paused') resumeGame(); startTutorial(); });
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);

  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = $(id);
    if (!sel) continue;
    sel.addEventListener('change', () => {
      ui.setLang(sel.value);
      renderTutorialStep();
      if (run) updateHud();
      updateBestText();
    });
  }
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') doTap('left');
  else if (e.code === 'ArrowRight' || e.code === 'KeyD') doTap('right');
  else if (e.code === 'ArrowDown' || e.code === 'Space' || e.code === 'KeyS') { e.preventDefault(); doTap('dodge'); }
  else if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  } else if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'result')) restartGame();
  else if (e.code === 'KeyM') toggleMute();
  else if (e.code === 'KeyH') { if (phase === 'playing') startTutorial(); }
});

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

  if (view.shake > 0) view.shake = Math.max(0, view.shake - dt * 18);
  for (const fx of view.fxQueue) if (fx.ttl > 0) fx.ttl -= dt;

  try {
    renderer.draw(run ? run.state : null, dt, view);
  } catch (err) {
    console.warn('render error', err);
  }
  view.fxQueue = view.fxQueue.filter((fx) => fx.ttl > 0);

  if (fpsSamples.length < 600 && dt > 0) fpsSamples.push(1 / dt);
  requestAnimationFrame(frame);
}

// ---------- 调试契约 ----------
function simAdvance(dt) {
  if (!run) return;
  run.step(dt);
  handleEvents(run.drainEvents());
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
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['match', 'dodge', 'fever']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  save: (k, v) => Sdk.save(k, v),
  load: (k, f) => Sdk.load(k, f),
  ui,
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: () => (run ? { ...run.state } : null),
    layout: () => { try { return renderer.debugLayout(); } catch { return null; } },
    // 正确按键 n 次（每次推进 0.1s，即 10 键/秒）
    autoPlay: (n = 12) => {
      if (!run) return false;
      for (let i = 0; i < n; i += 1) {
        const cur = run.state.queue[0].dir;
        run.tap(cur === 'rock' ? 'dodge' : cur);
        for (let j = 0; j < 6; j += 1) simAdvance(1 / 60);
      }
      updateHud();
      return true;
    },
    // 完美打到终局（生存到 40s → win）
    fastForward: () => {
      if (!run) return false;
      let guard = 800;
      while (guard-- > 0 && run.state.phase === 'playing') {
        const cur = run.state.queue[0].dir;
        run.tap(cur === 'rock' ? 'dodge' : cur);
        for (let j = 0; j < 6; j += 1) simAdvance(1 / 60);
      }
      updateHud();
      return true;
    },
    // 跳到指定剩余秒数（阶段随 elapsed 重算）
    setTimeLeft: (sec) => {
      if (!run) return false;
      run.state.elapsed = Math.max(0, GAME.ROUND_TIME - sec);
      run.state.timeLeft = Math.max(0, sec);
      return true;
    },
    // 把当前牌强制换成岩石（截图/验收用）
    forceRock: () => {
      if (!run) return false;
      run.state.queue[0] = { dir: 'rock' };
      return true;
    },
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
  },
};

// ---------- 启动 ----------
function fit() {
  try {
    const scale = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
    document.body.style.setProperty('--scale', String(Math.max(0.1, scale)));
  } catch { /* noop */ }
}
bind();
syncDocumentLang();
ui.applyLang();
updateBestText();
$('btn-mute').classList.toggle('is-muted', muted);
fit();
window.addEventListener('resize', fit);
Sdk.track('load', {});
requestAnimationFrame(frame);
