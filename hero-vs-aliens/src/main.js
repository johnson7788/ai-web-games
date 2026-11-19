// 主入口：60Hz 固定步长 + 标题/游戏/暂停/结算 + 教程 + SDK 统一出口 + 标准调试契约。
import { STEP, HERO, AIM, MAP } from '../config/game.config.js';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';
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
let phase = 'title';        // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let fpsSamples = [];
let tutorialStep = -1;      // -1 = 未激活
let tutorialDone = !!Sdk.load('tutorialDone', false);
let best = Sdk.load('best', 0) | 0;
let muted = !!Sdk.load('muted', false);

const view = { shake: 0, fx: [] };

Sdk.ready();
Sdk.onAdStart(() => { if (phase === 'playing') pauseGame(true); });
Sdk.onAdEnd(() => { if (phase === 'paused') resumeGame(); });
audio.setMuted(muted);
ui.setMuted(muted);

function persist() {
  Sdk.save('tutorialDone', tutorialDone);
  Sdk.save('best', best);
  Sdk.save('muted', muted);
}

// ---------- 阶段状态机 ----------
function setPhase(p) { phase = p; }

function startRun() {
  run = createRun(0, { seed: (Date.now() % 2147483647) || 1 });
  setPhase('playing');
  ui.showGame();
  hideResult();
  view.shake = 0;
  updateHud();
  audio.startBgm();
  Sdk.newRun({ level: 1 });
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

function restartRun() {
  if (run) Sdk.track('restart', { level: run.state.level });
  audio.stopBgm();
  startRun();
}

function goHome() {
  run = null;
  setPhase('title');
  hideResult();
  audio.stopBgm();
  ui.showTitle();
  updateBestLine();
}

// ---------- HUD / 结算 ----------
function updateHud() {
  if (!run) return;
  const h = run.getHud();
  const lv = LEVELS[run.state.level - 1] || {};
  $('hud-level').textContent = `${t('level')} ${run.state.level}${lv.name ? ' · ' + (lv.name[i18n.lang] || lv.name.en) : ''}`;
  $('hud-score').textContent = `${t('score')} ${h.score}`;
  $('hud-alt').textContent = `${t('altitude')} ${h.altitude}m`;
  $('hud-combo').textContent = h.combo > 0 ? `${t('combo')} ×${h.combo}` : '';
  $('hud-best').textContent = `${t('best')} ${best}`;
}

function updateBestLine() {
  const el = $('best-line');
  if (el) el.textContent = best > 0 ? `${t('best')} ${best}` : '';
}

function hideResult() {
  $('screen-result').classList.add('hidden');
}

function showResult(won, hud) {
  $('result-title').textContent = won ? t('winTitle') : t('loseTitle');
  $('result-title').classList.toggle('lose', !won);
  const starsEl = $('result-stars');
  starsEl.innerHTML = won
    ? `<span class="stars">${'★'.repeat(hud.stars)}${'☆'.repeat(3 - hud.stars)}</span>`
    : '';
  const meta = $('result-meta');
  meta.innerHTML = '';
  const rows = [
    [t('resultScore'), hud.score],
    [t('resultDistance'), hud.altitude + 'm'],
    [t('resultAliens'), hud.aliensSmashed],
    [t('resultCrystals'), hud.crystals],
    [t('resultCombo'), '×' + hud.maxCombo],
  ];
  if (!won) {
    const reason = hud.reason === 'hazard' ? t('reasonHazard') : t('reasonDepleted');
    rows.unshift([reason, '']);
  }
  for (const [k, v] of rows) {
    const row = document.createElement('div');
    row.className = 'result-row';
    row.innerHTML = `<span>${k}</span><span>${v}</span>`;
    meta.appendChild(row);
  }
  ui.showResult();
}

function finishRun(ev) {
  const won = ev.type === 'win';
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  const hud = run ? run.getHud() : { score: 0, stars: 0, altitude: 0, aliensSmashed: 0, crystals: 0, maxCombo: 0, reason: null };
  if (won) {
    if (hud.score > best) { best = hud.score; persist(); }
  }
  persist();
  Sdk.track(won ? 'win' : 'fail', { level: run ? run.state.level : 1, score: hud.score, stars: hud.stars });
  showResult(won, { ...hud, stars: won ? (ev.stars || hud.stars || 1) : 0 });
  audio.event(won ? 'win' : 'lose');
}

// ---------- 教程引导（首次自动弹，可跳过，完成/跳过后持久化不再自动弹） ----------
const TUT_STEPS = () => [
  { text: t('tutStep1'), spot: 'launch' },
  { text: t('tutStep2'), spot: null },
  { text: t('tutStep3'), spot: null },
];

function startTutorial() {
  tutorialStep = 0;
  renderTutorialStep();
}

function renderTutorialStep() {
  const el = $('tutorial');
  if (tutorialStep < 0) { el.classList.add('hidden'); return; }
  const steps = TUT_STEPS();
  const s = steps[tutorialStep] || steps[0];
  el.classList.remove('hidden');
  $('tut-title').textContent = t('tutTitle');
  $('tut-text').textContent = s ? s.text : '';
  $('tut-skip').textContent = t('tutSkip');
  $('tut-next').textContent = t('tutNext');
  const spot = $('tut-spotlight');
  if (s && s.spot) {
    const lay = renderer.debugLayout();
    const rect = lay && lay[s.spot] ? lay[s.spot] : null;
    if (rect) {
      spot.style.display = 'block';
      spot.style.left = `${rect.x - 8}px`;
      spot.style.top = `${rect.y - 8}px`;
      spot.style.width = `${rect.w + 16}px`;
      spot.style.height = `${rect.h + 16}px`;
    } else {
      spot.style.display = 'none';
    }
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

// ---------- 事件消费 ----------
function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    switch (ev.type) {
      case 'smash':
        view.shake = 4;
        break;
      case 'drop':
      case 'bounce':
        view.shake = Math.max(view.shake, 1.5);
        break;
      case 'combo':
        view.shake = Math.max(view.shake, 3);
        break;
      case 'win':
      case 'die':
        finishRun(ev);
        return;
      default:
        break;
    }
  }
}

// ---------- 输入 ----------
function launchOrDrop(e) {
  if (!run || phase !== 'playing') return;
  if (run.state.phase === 'aim') {
    audio.unlock();
    run.launch();
  } else if (run.state.phase === 'flying') {
    const rect = canvas.getBoundingClientRect();
    const x = rect.width ? (e.clientX - rect.left) / rect.width : 0.5;
    if (x < 0.33) run.steer(-1);
    else if (x > 0.66) run.steer(1);
    else run.drop();
  }
}

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  launchOrDrop(e);
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
    return;
  }
  if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'result')) { restartRun(); return; }
  if (e.code === 'KeyM') { toggleMute(); return; }
  if (e.code === 'Space' || e.code === 'Enter') {
    if (phase !== 'playing' || !run) return;
    e.preventDefault();
    audio.unlock();
    if (run.state.phase === 'aim') run.launch();
    else if (run.state.phase === 'flying') run.drop();
    return;
  }
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') { if (run && phase === 'playing' && run.state.phase === 'flying') run.steer(-1); }
  if (e.code === 'ArrowRight' || e.code === 'KeyD') { if (run && phase === 'playing' && run.state.phase === 'flying') run.steer(1); }
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
    const el = $(id);
    if (el) el.addEventListener('click', () => { audio.unlock(); fn(); });
  };
  on('btn-start', startRun);
  on('btn-resume', resumeGame);
  on('btn-restart', restartRun);
  on('btn-restart2', restartRun);
  on('btn-retry', restartRun);
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-mute', toggleMute);
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result') startTutorial(); });
  on('btn-howto-title', startTutorial);
  on('btn-howto-pause', startTutorial);
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);

  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = $(id);
    if (!sel) continue;
    sel.addEventListener('change', () => {
      ui.setLang(sel.value);
      renderTutorialStep();
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
      run.step(STEP);
      accumulator -= STEP;
    }
    handleEvents(run.drainEvents());
    if (run && phase === 'playing') updateHud();
  }

  if (view.shake > 0) view.shake = Math.max(0, view.shake - dt * 18);

  try {
    const state = run ? run.state : null;
    renderer.draw(state, dt, view);
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
  startAct: (i) => startRun(),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => restartRun(),
  home: () => goHome(),
  save: (key, value) => Sdk.save(key, value),
  ui: () => ui,
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['aim', 'steer', 'drop']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: () => (run ? run.state : null),
    sim: () => (run ? run.state : null),
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    launch: () => { if (run && phase === 'playing') run.launch(); },
    fastForward: () => {
      if (!run) return false;
      try {
        if (run.state.phase === 'aim') run.launch();
        let guard = 6000;
        while (guard-- > 0 && (run.state.phase === 'aim' || run.state.phase === 'flying')) {
          run.step(0.5);
          handleEvents(run.drainEvents());
          if (phase !== 'playing') break;
        }
        return true;
      } catch { return false; }
    },
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
updateBestLine();
$('btn-mute').classList.toggle('is-muted', muted);
ui.showTitle();
Sdk.track('load', {});
requestAnimationFrame(frame);

