// LIL HERO SAGA · 主入口：60Hz 固定步长 + 标题/游戏/暂停/结算 + 教程 + SDK 统一出口。
// 装配：sim / render / ui / audio / i18n / sdk。
import { STEP, GAME } from '../config/game.config.js';
import { createRun } from './game/sim.js';
import { policy as autodrivePolicy } from './game/autodrive.js';
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
let tutorialStep = -1;

const view = {
  shake: 0,
  fxQueue: [],
};

// prefers-reduced-motion：关闭大幅震屏
const REDUCED_MOTION = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let bestScore = Sdk.load('best', 0) | 0;
let tutorialDone = !!Sdk.load('tutorialDone', false);

Sdk.ready(); // 不 await，不阻塞首屏
audio.setMuted(muted);

function persist() {
  Sdk.save('muted', muted);
  Sdk.save('best', bestScore);
  Sdk.save('tutorialDone', tutorialDone);
}

// ---------- 阶段状态机 ----------
function setPhase(p) { phase = p; }

function startLevel() {
  run = createRun({ seed: (Date.now() % 2147483647) || 1 });
  view.shake = 0;
  view.fxQueue = [];
  setPhase('playing');
  ui.showGame();
  updateHud();
  audio.startBgm();
  Sdk.track('start', {});
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

function restartLevel() {
  if (run) Sdk.track('restart', {});
  startLevel();
}

function goHome() {
  run = null;
  setPhase('title');
  ui.showTitle();
  updateBest();
  audio.stopBgm();
}

// ---------- HUD / 结算 ----------
function updateHud() {
  if (!run) return;
  const h = run.getHud();
  $('hud-act').textContent = t(h.act === 2 ? 'act2' : h.act === 3 ? 'act3' : 'act1');
  $('hud-score').textContent = `${t('score')} ${h.score}`;
  const comboEl = $('hud-combo');
  comboEl.classList.toggle('on', h.combo >= 2);
  comboEl.textContent = `×${Math.max(1, h.combo)}`;

  const heartsEl = $('hud-hearts');
  heartsEl.innerHTML = '';
  for (let i = 0; i < h.maxHp; i += 1) {
    const s = document.createElement('span');
    s.className = 'heart' + (i < h.hp ? '' : ' off');
    s.textContent = '♥';
    heartsEl.appendChild(s);
  }

  const mp = h.mp;
  $('mp-red').style.width = `${(mp.red / GAME.MP_MAX) * 100}%`;
  $('mp-yellow').style.width = `${(mp.yellow / GAME.MP_MAX) * 100}%`;
  $('mp-blue').style.width = `${(mp.blue / GAME.MP_MAX) * 100}%`;
}

function updateBest() {
  $('best-score').textContent = `${t('best')} ${bestScore}`;
}

function showResult(res) {
  const { won, stars, score, time, maxCombo, newBest } = res;
  $('result-title').textContent = won ? t('winTitle') : t('loseTitle');
  $('result-title').classList.toggle('lose', !won);
  $('result-stars').innerHTML = won
    ? `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}${stars >= 3 ? `<em>${t('perfect')}</em>` : ''}`
    : '';
  $('result-time').textContent = `${t('time')} ${Math.round(time)}s · ${t('score')} ${score}`;
  $('result-meta').textContent = won
    ? `${t('combo')} ×${Math.max(1, maxCombo)}${newBest ? ' · ' + t('newBest') : ''}`
    : t('loseReason');
  ui.showResult();
}

function finishRun(ev) {
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  const st = run.state;
  const won = ev.type === 'win';
  const stars = won ? (ev.stars || 1) : 0;
  let newBest = false;
  if (won && st.score > bestScore) {
    bestScore = st.score;
    newBest = true;
  }
  persist();
  Sdk.track(won ? 'win' : 'fail', { score: st.score, stars, durationMs: Math.round(st.time * 1000) });
  if (won) Sdk.levelCleared({ level: 1, stars });
  else Sdk.gameOver({ score: st.score });
  showResult({ won, stars, score: st.score, time: st.time, maxCombo: st.maxCombo, newBest });
  audio.event(won ? 'win' : 'lose');
}

// ---------- 教程（首次自动弹，可跳过，可重看） ----------
const TUT_STEPS = ['tutStep1', 'tutStep2', 'tutStep3'];

function startTutorial() {
  tutorialStep = 0;
  renderTutorialStep();
}

function renderTutorialStep() {
  const el = $('tutorial');
  if (tutorialStep < 0) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  $('tut-title').textContent = t('tutTitle');
  $('tut-text').textContent = t(TUT_STEPS[tutorialStep] || 'tutStep1');
  $('tut-skip').textContent = t('tutSkip');
  $('tut-next').textContent = t('tutNext');
  $('tut-spotlight').style.display = 'none';
}

function tutorialNext() {
  tutorialStep += 1;
  if (tutorialStep >= TUT_STEPS.length) endTutorial();
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
      case 'jump':
        view.fxQueue.push({ type: 'ring', x: run.state.player.x + 15, y: run.state.player.y + 40, r: 18, max: 0.3, ttl: 0.3, color: '#7ef0ff' });
        break;
      case 'cast':
        view.shake = 2;
        break;
      case 'kill':
        view.shake = 4;
        view.fxQueue.push({ type: 'ring', x: run.state.player.x + 15, y: run.state.player.y + 20, r: 40, max: 0.4, ttl: 0.4, color: '#ffd60a' });
        break;
      case 'hurt':
        view.shake = 8;
        break;
      case 'rock_break':
        view.shake = 5;
        break;
      case 'flag':
      case 'boss':
        view.shake = 6;
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
const input = { left: false, right: false, jump: false };
const COLOR_KEYS = {
  KeyJ: 'red', Digit1: 'red',
  KeyK: 'yellow', Digit2: 'yellow',
  KeyL: 'blue', Digit3: 'blue',
};

window.addEventListener('keydown', (e) => {
  const color = COLOR_KEYS[e.code];
  if (color) {
    audio.unlock();
    if (run && phase === 'playing') run.pressColor(color);
    e.preventDefault();
    return;
  }
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') input.left = true;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') input.right = true;
  if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') { input.jump = true; e.preventDefault(); }
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
  if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'result')) restartLevel();
  if (e.code === 'KeyM') toggleMute();
});

window.addEventListener('keyup', (e) => {
  const color = COLOR_KEYS[e.code];
  if (color) {
    if (run && phase === 'playing') run.releaseColor();
    e.preventDefault();
    return;
  }
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') input.left = false;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') input.right = false;
  if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') input.jump = false;
});

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  $('btn-mute').classList.toggle('is-muted', muted);
  $('btn-mute').textContent = muted ? '✕' : '♪';
  persist();
}

// 触屏按钮
function bindTouchBtn(id, onDown, onUp) {
  const el = $(id);
  if (!el) return;
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); audio.unlock(); onDown(); });
  el.addEventListener('pointerup', (e) => { e.preventDefault(); onUp(); });
  el.addEventListener('pointercancel', () => onUp());
}
bindTouchBtn('touch-left', () => { input.left = true; }, () => { input.left = false; });
bindTouchBtn('touch-right', () => { input.right = true; }, () => { input.right = false; });
bindTouchBtn('touch-jump', () => { input.jump = true; }, () => { input.jump = false; });
bindTouchBtn('touch-red', () => { if (run && phase === 'playing') run.pressColor('red'); }, () => { if (run && phase === 'playing') run.releaseColor(); });
bindTouchBtn('touch-yellow', () => { if (run && phase === 'playing') run.pressColor('yellow'); }, () => { if (run && phase === 'playing') run.releaseColor(); });
bindTouchBtn('touch-blue', () => { if (run && phase === 'playing') run.pressColor('blue'); }, () => { if (run && phase === 'playing') run.releaseColor(); });

// ---------- UI 绑定 ----------
function bind() {
  const on = (id, fn) => {
    const el = $(id);
    if (el) el.addEventListener('click', () => { audio.unlock(); fn(); });
  };
  on('btn-start', startLevel);
  on('btn-resume', resumeGame);
  on('btn-restart', restartLevel);
  on('btn-restart2', restartLevel);
  on('btn-retry', restartLevel);
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result' || phase === 'title') startTutorial(); });
  on('btn-howto-title', () => startTutorial());
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);
  on('btn-rotate-skip', () => { const rs = $('rotate-screen'); if (rs) rs.style.display = 'none'; });

  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = $(id);
    if (!sel) continue;
    sel.addEventListener('change', () => {
      ui.setLang(sel.value);
      renderTutorialStep();
      updateBest();
      if (run) updateHud();
      const rt = $('rotate-text');
      const rb = $('btn-rotate-skip');
      if (rt) rt.textContent = t('rotateHint');
      if (rb) rb.textContent = t('rotateSkip');
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
      run.setInput(input);
      run.step(STEP);
      accumulator -= STEP;
      if (run.state.phase !== 'playing') break;
    }
    handleEvents(run.drainEvents());
    if (run && phase === 'playing') updateHud();
  }

  if (view.shake > 0) view.shake = REDUCED_MOTION ? 0 : Math.max(0, view.shake - dt * 22);
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
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['charge', 'mix', 'reach']; },
    get current() { return tutorialStep >= 0 ? { text: t(TUT_STEPS[tutorialStep]) } : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  save: (key, value) => Sdk.save(key, value),
  load: (key, fallback) => Sdk.load(key, fallback),
  ui: () => ui,
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: () => (run ? run.state : null),
    startSeeded: (seed) => {
      run = createRun({ seed: (seed | 0) || 1 });
      setPhase('playing');
      ui.showGame();
      view.shake = 0;
      updateHud();
      return true;
    },
    // 浏览器内用贪心策略推进到终局（与 selfplay 同策略）
    fastForward: () => {
      if (!run) return false;
      let guard = 60 * 120;
      while (guard-- > 0 && run.state.phase === 'playing') {
        autodrivePolicy(run);
        run.step(1 / 60);
        handleEvents(run.drainEvents());
      }
      updateHud();
      return true;
    },
    loadLevel: () => startLevel(),
    teleport: (x, y) => (run ? run.teleport(x, y) : false),
  },
};

// ---------- 启动 ----------
bind();
syncDocumentLang();
ui.applyLang();
{
  const rt = $('rotate-text');
  const rb = $('btn-rotate-skip');
  if (rt) rt.textContent = t('rotateHint');
  if (rb) rb.textContent = t('rotateSkip');
}
$('btn-mute').textContent = muted ? '✕' : '♪';
$('btn-mute').classList.toggle('is-muted', muted);
updateBest();
ui.showTitle();
Sdk.track('load', {});
requestAnimationFrame(frame);
