// PARK SLIDE IN · 主入口：60Hz 固定步长装配 sim / render / ui / audio / sdk + 教程 + 调试契约。
import { STEP } from '../config/game.config.js';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';
import { createRun } from './game/sim.js';
import { autopilotControl } from './game/autopilot.js';
import { createRenderer } from './render/index.js';
import { createAudio } from './core/audio.js';
import { ui } from './ui/ui.js';
import { i18n, t, syncDocumentLang } from './core/i18n.js';
import Sdk from './core/sdk.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

const canvas = $('canvas');
const renderer = createRenderer(canvas);
const audio = createAudio();

let run = null;
let phase = 'title'; // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let fpsSamples = [];
let tutorialStep = -1; // -1 = 未激活

const view = { shake: 0 };

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let unlocked = Math.max(1, Sdk.load('unlocked', 1) | 0);
let starsByLevel = Sdk.load('stars', {}) || {};
let tutorialDone = !!Sdk.load('tutorialDone', false);
let lastLevel = Sdk.load('lastLevel', 0) | 0;

Sdk.ready(); // 不阻塞首屏
audio.setMuted(muted);
ui.setMuted(muted);

function persist() {
  Sdk.save('unlocked', unlocked);
  Sdk.save('stars', starsByLevel);
  Sdk.save('muted', muted);
  Sdk.save('tutorialDone', tutorialDone);
  Sdk.save('lastLevel', lastLevel);
}

function totalStars() {
  return Object.values(starsByLevel).reduce((a, b) => a + (b | 0), 0);
}

function setPhase(p) { phase = p; }

// ---------- 阶段状态机 ----------
function startLevel(idx) {
  idx = Math.max(0, Math.min(LEVEL_COUNT - 1, idx | 0));
  lastLevel = idx;
  run = createRun(idx, { seed: (Date.now() % 2147483647) || 1 });
  view.shake = 0;
  setPhase('playing');
  ui.showGame();
  hideResult();
  updateHud();
  audio.startBgm();
  Sdk.newRun({ level: idx + 1 });
  Sdk.track('start', { level: idx + 1 });
  if (!tutorialDone && idx === 0) startTutorial();
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

function restartLevel() {
  if (run) Sdk.track('restart', { level: run.state.level });
  startLevel(run ? run.state.level - 1 : lastLevel);
}

function goHome() {
  run = null;
  setPhase('title');
  hideResult();
  ui.showTitle();
  buildLevelGrid();
  audio.stopBgm();
}

// ---------- HUD / 关卡格 / 结算 ----------
function updateHud() {
  if (!run) return;
  const h = run.getHud();
  const lv = LEVELS[run.state.level - 1] || {};
  $('hud-level').textContent = `${t('level')} ${run.state.level}`;
  $('hud-time').textContent = `${t('time')} ${h.time.toFixed(1)}s`;
  $('hud-orbs').textContent = `${t('orbs')} ${h.orbs}/${h.orbTotal}`;
  $('hud-shield').textContent = `${t('shield')} ${h.shield}`;
  $('hud-combo').textContent = h.combo >= 2 ? `${t('combo')} ×${h.combo}` : '';
  $('hud-combo').style.display = h.combo >= 2 ? '' : 'none';
}

function buildLevelGrid() {
  const grid = $('level-grid');
  if (!grid) return;
  grid.innerHTML = '';
  for (let i = 0; i < LEVEL_COUNT; i += 1) {
    const cell = document.createElement('button');
    cell.className = 'level-cell' + (i + 1 > unlocked ? ' locked' : '');
    cell.dataset.level = i;
    const stars = starsByLevel[i + 1] | 0;
    cell.innerHTML =
      `<span class="lv-num">${i + 1}</span>` +
      `<span class="lv-stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>`;
    cell.setAttribute('aria-label', `${t('level')} ${i + 1}`);
    grid.appendChild(cell);
  }
  $('stars-total').textContent = `★ ${totalStars()} / ${LEVEL_COUNT * 3}`;
}

function showResult(res) {
  const { won, stars, time, orbs, orbTotal, collisions, hasNext } = res;
  $('result-title').textContent = won ? t('winTitle') : t('loseTitle');
  $('result-title').classList.toggle('lose', !won);
  const starsEl = $('result-stars');
  starsEl.innerHTML = won
    ? `<span class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>${stars >= 3 ? `<em>${t('perfect')}</em>` : ''}`
    : '';
  $('result-time').textContent = won ? `${t('resultTime')} ${time.toFixed(1)}s` : '';
  const meta = [];
  meta.push(won ? (collisions === 0 ? t('resultMetaHit') : t('resultMetaCrash', { n: collisions })) : t('resultMetaCrash', { n: collisions }));
  if (orbTotal > 0) meta.push(t('resultMetaOrbs', { n: orbs, m: orbTotal }));
  $('result-meta').textContent = meta.join(' · ');
  $('btn-next').style.display = won && hasNext ? '' : 'none';
  $('screen-result').classList.remove('hidden');
}

function hideResult() {
  $('screen-result').classList.add('hidden');
}

function finishRun(ev) {
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  const st = run.state;
  const won = ev.type === 'win';
  const stars = won ? (ev.stars || st.stars || 1) : 0;
  if (won) {
    const idx = st.level;
    starsByLevel[idx] = Math.max(starsByLevel[idx] | 0, stars);
    if (idx < LEVEL_COUNT) unlocked = Math.max(unlocked, idx + 1);
    buildLevelGrid();
    Sdk.levelCleared({ level: idx, stars, timeMs: Math.round(st.time * 1000) });
  } else {
    Sdk.gameOver({ level: st.level, reason: ev.reason || 'crash' });
  }
  persist();
  showResult({
    won, stars, time: st.time, orbs: st.orbsCollected, orbTotal: st.orbTotal,
    collisions: st.collisions, hasNext: st.level < LEVEL_COUNT,
  });
  audio.event(won ? 'win' : 'lose');
  if (won) view.shake = 4; else view.shake = 6;
}

// ---------- 教程（首次自动弹，可跳过，完成/跳过后持久化） ----------
const TUT_TRIGGERS = ['steerOn', 'throttleOn', 'slide'];
const TUT_STEPS = () => [
  { id: 'steer', text: t('tutStep1') },
  { id: 'throttle', text: t('tutStep2') },
  { id: 'park', text: t('tutStep3') },
];

function startTutorial() {
  tutorialStep = 0;
  renderTutorialStep();
}

function renderTutorialStep() {
  const el = $('tutorial');
  if (tutorialStep < 0) { el.classList.add('hidden'); return; }
  const steps = TUT_STEPS();
  const s = steps[Math.min(tutorialStep, steps.length - 1)];
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

function tutorialAdvance(evType) {
  if (tutorialStep < 0 || tutorialStep >= TUT_TRIGGERS.length) return;
  if (TUT_TRIGGERS[tutorialStep] !== evType) return;
  tutorialStep += 1;
  if (tutorialStep >= TUT_TRIGGERS.length) endTutorial();
  else renderTutorialStep();
}

// ---------- 事件消费 ----------
function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    tutorialAdvance(ev.type);
    const car = run ? run.state.car : null;
    switch (ev.type) {
      case 'orb':
        if (car) renderer.burst(car.x, car.y, '#00f0ff', 10);
        break;
      case 'shield':
        if (car) renderer.burst(car.x, car.y, '#ff2bd6', 14);
        view.shake = 2;
        break;
      case 'shieldBreak':
        if (car) renderer.burst(car.x, car.y, '#ff5a3c', 16);
        view.shake = 4;
        break;
      case 'nearMiss':
        view.shake = Math.max(view.shake, 1.5);
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
const keys = { up: false, down: false, left: false, right: false };
const pad = { up: false, down: false, left: false, right: false };

function currentInput() {
  let throttle = 0;
  let steerDir = 0;
  if (keys.up || pad.up) throttle += 1;
  if (keys.down || pad.down) throttle -= 1;
  if (keys.right || pad.right) steerDir += 1;
  if (keys.left || pad.left) steerDir -= 1;
  return { throttle: clamp(throttle, -1, 1), steerDir: clamp(steerDir, -1, 1) };
}

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
};

window.addEventListener('keydown', (e) => {
  const act = KEYMAP[e.code];
  if (act) {
    keys[act] = true;
    e.preventDefault();
    audio.unlock();
    return;
  }
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
  if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'result')) restartLevel();
  if (e.code === 'KeyM') toggleMute();
});

window.addEventListener('keyup', (e) => {
  const act = KEYMAP[e.code];
  if (act) keys[act] = false;
});

function bindPad(id, flag) {
  const el = $(id);
  if (!el) return;
  const on = (v) => { pad[flag] = v; audio.unlock(); el.classList.toggle('pressed', v); };
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); on(true); });
  el.addEventListener('pointerup', () => on(false));
  el.addEventListener('pointercancel', () => on(false));
  el.addEventListener('pointerleave', () => on(false));
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
  const on = (id, fn) => { const el = $(id); if (el) el.addEventListener('click', () => { audio.unlock(); fn(); }); };
  on('btn-start', () => startLevel(lastLevel || 0));
  on('btn-resume', resumeGame);
  on('btn-restart', restartLevel);
  on('btn-restart2', restartLevel);
  on('btn-retry', restartLevel);
  on('btn-next', () => startLevel((run ? run.state.level - 1 : lastLevel) + 1));
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);
  const howto = document.querySelectorAll('[data-tutorial-replay]');
  for (const b of howto) b.addEventListener('click', () => { audio.unlock(); startTutorial(); });

  bindPad('btn-left', 'left');
  bindPad('btn-right', 'right');
  bindPad('btn-up', 'up');
  bindPad('btn-down', 'down');

  $('level-grid')?.addEventListener('click', (e) => {
    const idx = e.target.closest('[data-level]')?.dataset.level;
    if (idx == null) return;
    const i = +idx;
    if (i + 1 > unlocked) return;
    startLevel(i);
  });

  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = $(id);
    if (!sel) continue;
    sel.addEventListener('change', () => {
      ui.setLang(sel.value);
      buildLevelGrid();
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
    run.setInput(currentInput());
    accumulator += dt;
    while (accumulator >= STEP) {
      run.step(STEP);
      accumulator -= STEP;
    }
    handleEvents(run.drainEvents());
    if (run && phase === 'playing') updateHud();
  }

  if (view.shake > 0) view.shake = Math.max(0, view.shake - dt * 14);

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
  start: (i) => startLevel(i == null ? (lastLevel || 0) : i),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => restartLevel(),
  home: () => goHome(),
  sim: () => (run ? run.state : null),
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return TUT_STEPS().map((s) => s.id); },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  save: () => Sdk,
  ui: () => ui,
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: () => (run ? run.state : null),
    loadLevel: (i) => startLevel(i),
    solve: () => {
      if (!run) return false;
      let guard = 60 * 95;
      while (guard-- > 0 && run.state.phase === 'playing') {
        const c = autopilotControl(run.state);
        run.setInput(c);
        run.step(STEP);
        handleEvents(run.drainEvents());
      }
      return run.state.phase === 'won';
    },
    fastForward: () => window.__ll.debug.solve(),
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
buildLevelGrid();
$('btn-mute').classList.toggle('is-muted', muted);
Sdk.track('load', {});
requestAnimationFrame(frame);
