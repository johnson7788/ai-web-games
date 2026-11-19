// WILDLAND RALLY · 主入口：60Hz 固定步长 + 标题/游戏/暂停/结算 + 教程 + SDK + 调试契约
import { STEP, GAME, MATCH, WORLD } from '../config/game.config.js';
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
let phase = 'title';          // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let tutorialStep = -1;
const view = { clock: 0 };

// ---- 存档（统一走 Sdk） ----
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

// ---- 输入 ----
const keys = { left: false, right: false, up: false, down: false };
const joy = { dx: 0, dy: 0, active: false };
const isTouch = typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
let autopilot = false;

function currentDir() {
  if (autopilot) {
    const t = performance.now() / 1000;
    return { dx: Math.cos(t * 1.6), dy: Math.sin(t * 1.6) };
  }
  let dx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  let dy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
  if (dx === 0 && dy === 0 && joy.active) { dx = joy.dx; dy = joy.dy; }
  return { dx, dy };
}

// ---- 阶段状态机 ----
function setPhase(p) { phase = p; }

function startLevel(seed) {
  const s = seed == null ? (Date.now() % 2147483647) || 1 : seed;
  run = createRun({ seed: s });
  setPhase('playing');
  ui.showGame();
  ui.hideResult();
  ui.setControlsVisible(isTouch);
  updateHud();
  audio.startBgm();
  Sdk.track('start', { seed: s });
  Sdk.newRun();
  if (!tutorialDone) startTutorial();
}

function pauseGame() {
  if (phase !== 'playing') return;
  setPhase('paused');
  audio.stopBgm();
  ui.showPause();
  ui.setControlsVisible(false);
}

function resumeGame() {
  if (phase !== 'paused') return;
  setPhase('playing');
  ui.hidePause();
  ui.setControlsVisible(isTouch);
  audio.startBgm();
}

function goHome() {
  run = null;
  setPhase('title');
  ui.hideResult();
  ui.showTitle();
  ui.setControlsVisible(false);
  updateBest();
}

// ---- HUD / 结算 ----
function updateHud() {
  if (!run) return;
  const h = run.getHud();
  $('hud-wave').textContent = `${t('wave')} ${Math.max(1, h.wave)}/${MATCH.waves}`;
  $('hud-score').textContent = `${t('score')} ${h.score}`;
  const comboEl = $('hud-combo');
  comboEl.textContent = t('combo2', { n: h.combo });
  comboEl.classList.toggle('hidden', h.combo < 2);
  $('hud-targets').textContent = `${t('targets')} ${h.targets}`;
  $('hud-hp').textContent = `${t('hp')} ${h.hp}`;
  $('hud-lv').textContent = `${t('lv')} ${h.level}`;
}

function starsFor(h) {
  const hpFrac = h.hp / h.maxHp;
  const scoreOk = h.score >= 400;
  let stars = 1;
  if (scoreOk) stars += 1;
  if (hpFrac >= 0.5) stars += 1;
  return Math.max(1, Math.min(3, stars));
}

function showResult(won, score, h) {
  const stars = won ? starsFor(h) : 0;
  $('result-title').textContent = won ? t('winTitle') : t('loseTitle');
  const starsEl = $('result-stars');
  if (won) {
    let html = '';
    for (let i = 1; i <= 3; i += 1) html += `<span class="${i <= stars ? '' : 'dim'}">★</span>`;
    starsEl.innerHTML = html;
  } else {
    starsEl.innerHTML = '';
  }
  $('result-meta').textContent = won
    ? t('winMeta', { score }) + ' · ' + t('stars', { n: stars })
    : t('loseMeta');
  ui.showResult();
  if (won && score > best) { best = score; persist(); }
}

function updateBest() {
  $('best-text').textContent = `${t('best')} ${best}`;
}

function finishRun(ev) {
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  const h = run.getHud();
  const won = ev.type === 'win';
  showResult(won, run.state.score, h);
  Sdk.track(won ? 'win' : 'fail', { score: run.state.score, wave: h.wave });
  if (won) Sdk.levelCleared({ score: run.state.score, stars: starsFor(h) });
  else Sdk.gameOver({ score: run.state.score });
  audio.event(won ? 'win' : 'lose');
}

// ---- 教程 ----
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
  const s = TUT_STEPS()[tutorialStep];
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

// ---- 事件消费 ----
function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    switch (ev.type) {
      case 'ehit':
        renderer.shake.v = GAME.SHAKE_AMP;
        break;
      case 'nova':
        renderer.shake.v = GAME.SHAKE_AMP * 0.7;
        break;
      case 'kill':
        renderer.shake.v = Math.max(renderer.shake.v, 2);
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

// ---- 输入绑定 ----
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = true;
  if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = true;
  if (e.code === 'KeyW' || e.code === 'ArrowUp') keys.up = true;
  if (e.code === 'KeyS' || e.code === 'ArrowDown') keys.down = true;
  if (e.code === 'Space') {
    e.preventDefault();
    if (!e.repeat && phase === 'playing' && run) run.dash();
  }
  if (e.code === 'KeyE') {
    if (!e.repeat && phase === 'playing' && run) run.nova();
  }
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
  if (e.code === 'KeyM') toggleMute();
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = false;
  if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = false;
  if (e.code === 'KeyW' || e.code === 'ArrowUp') keys.up = false;
  if (e.code === 'KeyS' || e.code === 'ArrowDown') keys.down = false;
});

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  ui.setMuted(muted);
  persist();
}

// 触控摇杆
function bindJoystick() {
  const jz = $('joystick');
  const knob = $('joy-knob');
  if (!jz || !knob) return;
  const R = 48;
  let pid = null;
  const setKnob = (dx, dy) => { knob.style.transform = `translate(${dx}px, ${dy}px)`; };
  jz.addEventListener('pointerdown', (e) => {
    pid = e.pointerId;
    jz.setPointerCapture(e.pointerId);
    update(e);
  });
  jz.addEventListener('pointermove', (e) => { if (e.pointerId === pid) update(e); });
  const update = (e) => {
    const r = jz.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const l = Math.hypot(dx, dy);
    if (l > R) { dx = (dx / l) * R; dy = (dy / l) * R; }
    joy.dx = dx / R;
    joy.dy = dy / R;
    joy.active = true;
    setKnob(dx, dy);
  };
  const end = (e) => {
    if (e.pointerId !== pid) return;
    pid = null;
    joy.dx = 0; joy.dy = 0; joy.active = false;
    setKnob(0, 0);
  };
  jz.addEventListener('pointerup', end);
  jz.addEventListener('pointercancel', end);
}

function bind() {
  const on = (id, fn) => { const el = $(id); if (el) el.addEventListener('click', () => { audio.unlock(); fn(); }); };
  on('btn-start', () => startLevel());
  on('btn-resume', resumeGame);
  on('btn-restart', () => startLevel());
  on('btn-restart2', () => startLevel());
  on('btn-retry', () => startLevel());
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-howto', () => startTutorial());
  on('btn-howto-hud', () => startTutorial());
  on('btn-tut-replay', () => { if (phase === 'paused') resumeGame(); startTutorial(); });
  on('btn-howto-close', () => ui.hideHowto());
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);
  on('btn-dash', () => { if (phase === 'playing' && run) run.dash(); });
  on('btn-nova', () => { if (phase === 'playing' && run) run.nova(); });

  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = $(id);
    if (!sel) continue;
    sel.addEventListener('change', () => {
      ui.setLang(sel.value);
      renderTutorialStep();
      updateBest();
      if (run) updateHud();
      updateRotateLabels();
    });
  }
  bindJoystick();
}

function updateRotateLabels() {
  const rt = $('rotate-text');
  const rb = $('btn-rotate-skip');
  if (rt) rt.textContent = t('rotateHint');
  if (rb) rb.textContent = t('rotateSkip');
}

// ---- 主循环 ----
function frame(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;
  view.clock = now / 1000;

  if (phase === 'playing' && run) {
    accumulator += dt;
    while (accumulator >= STEP) {
      const d = currentDir();
      run.move(d.dx, d.dy);
      run.step(STEP);
      accumulator -= STEP;
    }
    const evs = run.drainEvents();
    renderer.feed(evs);
    handleEvents(evs);
    if (run && phase === 'playing') updateHud();
  }

  try {
    renderer.draw(run ? run.state : null, dt, view);
  } catch (err) {
    console.warn('render error', err);
  }

  requestAnimationFrame(frame);
}

// ---- 调试契约 ----
window.__ll = {
  state: {
    get phase() { return phase; },
    get lang() { return i18n.lang; },
    get dir() { return i18n.dir; },
  },
  get run() { return run; },
  start: (seed) => startLevel(seed),
  startAct: (seed) => startLevel(seed),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => goHome(),
  home: () => goHome(),
  sim: () => (run ? run.state : null),
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['drive', 'dash', 'nova']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  save: () => Sdk.save,
  ui: () => ui,
  debug: {
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    startSeeded: (seed) => startLevel(seed),
    setAutopilot: (on) => { autopilot = !!on; },
    state: () => (run ? run.state : null),
    skipTutorial: () => endTutorial(),
    fastForward: () => {
      if (!run) return false;
      let guard = 4000;
      while (guard-- > 0 && run.state.phase === 'playing') {
        run.move(0, 0);
        run.step(1 / 60);
      }
      handleEvents(run.drainEvents());
      return true;
    },
  },
};

// ---- 启动 ----
bind();
syncDocumentLang();
ui.applyLang();
updateRotateLabels();
updateBest();
ui.setMuted(muted);
Sdk.track('load', {});
requestAnimationFrame(frame);
