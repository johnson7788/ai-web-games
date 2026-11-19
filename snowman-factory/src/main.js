// 主入口：60Hz 固定步长 + 标题/游戏/暂停/结算 + 教程引导 + SDK 统一出口
// 契约：window.__ll = { state:{phase,lang}, start, pause, resume, restart, run,
//        tutorial:{active,step,steps,startTutorial}, startTutorial }
// 装配：sim(纯逻辑) / render(canvas) / ui(DOM) / audio(WebAudio) / sdk(存档埋点)。
import { STEP, LAYOUT, BALANCE, WORLD } from '../config/game.config.js';
import { createRun } from './game/sim.js';
import { createRenderer } from './render/index.js';
import { createAudio } from './core/audio.js';
import { ui } from './ui/ui.js';
import { i18n, t, syncDocumentLang } from './core/i18n.js';
import Sdk from './core/sdk.js';

const $ = (id) => document.getElementById(id);
const canvas = $('canvas');
const container = $('game-container');
const renderer = createRenderer(canvas);
const audio = createAudio();

let run = null;           // 当前对局（null = 标题）
let phase = 'title';      // title | playing | paused | result
let lastMode = 'classic';
let lastTime = performance.now();
let accumulator = 0;
let fpsSamples = [];
let tutorialStep = -1;    // -1 = 未激活

// 视图状态（渲染器 + 特效）
const reducedMotion = typeof window !== 'undefined'
  && window.matchMedia
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const view = {
  t: 0,
  shake: 0,
  fx: [],
  reducedMotion,
};

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

function startRun(mode) {
  const m = mode === 'crazy' ? 'crazy' : 'classic';
  lastMode = m;
  run = createRun({ seed: (Date.now() % 2147483647) || 1 });
  run.start(m);
  setPhase('playing');
  ui.showGame();
  ui.hideResult();
  updateHud();
  audio.startBgm();
  Sdk.newRun({ mode: m });
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

function restartRun() {
  if (phase === 'playing' || phase === 'paused' || phase === 'result') {
    startRun(lastMode);
  }
}

function goHome() {
  run = null;
  setPhase('title');
  ui.hideResult();
  ui.showTitle();
  audio.stopBgm();
}

// ---------- HUD ----------
function updateHud() {
  if (!run) return;
  const h = run.getHud();
  $('hud-level').textContent = `${t('level')} ${h.level}`;
  {
    const g = $('hud-goal');
    if (g) g.textContent = `${t('goalCatch')} ${h.catches ?? 0}/${h.catchesNeed ?? 6}`;
  }
  $('hud-score').textContent = `${t('score')} ${h.score}`;
  const comboEl = $('hud-combo');
  comboEl.textContent = `${t('combo')} ×${h.mult}`;
  comboEl.classList.toggle('combo-hot', h.mult >= 3);
  const timeEl = $('hud-time');
  if (h.timeLeft != null) {
    const s = Math.max(0, Math.ceil(h.timeLeft));
    timeEl.style.display = '';
    timeEl.textContent = `${t('time')} ${s}s`;
    timeEl.classList.toggle('time-low', s <= 10);
  } else {
    timeEl.style.display = 'none';
  }
  $('hud-lives').textContent = `❤ ${h.lives}/${BALANCE.maxLives}`;
}

// ---------- 结算 ----------
function showResult(st, isNewBest) {
  $('result-title').textContent = t('loseTitle');
  $('result-reason').textContent = t(st.reason === 'time' ? 'reasonTime' : 'reasonLives');
  $('result-score').textContent = `${t('resultScore')} ${st.score}`;
  const bestEl = $('result-best');
  bestEl.textContent = `${t('resultBest')} ${best}`;
  if (isNewBest) {
    const em = document.createElement('span');
    em.className = 'new-best';
    em.textContent = t('newBest');
    bestEl.appendChild(em);
  }
}

function finishRun(ev) {
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  const st = run.state;
  const score = st.score;
  let isNewBest = false;
  if (score > best) { best = score; isNewBest = true; }
  persist();
  Sdk.gameOver({ score, level: st.level, reason: ev.reason, mode: st.mode });
  ui.showResult();
  showResult(st, isNewBest);
  audio.event('lose');
}

// ---------- 教程引导（首次自动弹，可跳过，完成/跳过后持久化不再自动弹） ----------
const TUT_STEPS = () => [
  { id: 'launch', text: t('tutStep1'), spot: 'launch' },
  { id: 'catch', text: t('tutStep2'), spot: 'catch' },
  { id: 'combo', text: t('tutStep3'), spot: 'combo' },
];

function startTutorial() {
  if (!run) startRun(lastMode);
  else if (phase !== 'playing') { setPhase('playing'); ui.hidePause(); ui.hideResult(); ui.showGame(); audio.startBgm(); }
  tutorialStep = 0;
  renderTutorialStep();
}

function spotRect(which) {
  try {
    if (which === 'launch') {
      const b = $('btn-drop').getBoundingClientRect();
      const c = container.getBoundingClientRect();
      return { x: b.left - c.left, y: b.top - c.top, w: b.width, h: b.height };
    }
    const lay = renderer.debugLayout();
    const s = container.clientWidth / WORLD.WIDTH;
    if (lay && lay[which]) {
      return { x: lay[which].x * s, y: lay[which].y * s, w: lay[which].w * s, h: lay[which].h * s };
    }
  } catch { /* noop */ }
  return null;
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
  const rect = s && spotRect(s.spot);
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

// 真实动作驱动推进：0=launch 1=catch 2=combo
const TUT_TRIGGER = ['launch', 'catch', 'combo'];
function tutorialAdvance(evType) {
  if (tutorialStep < 0 || tutorialStep >= TUT_TRIGGER.length) return;
  if (TUT_TRIGGER[tutorialStep] !== evType) return;
  tutorialStep += 1;
  if (tutorialStep >= TUT_TRIGGER.length) endTutorial();
  else renderTutorialStep();
}

// ---------- 事件消费 ----------
function pushFx(type, payload) {
  const x = LAYOUT.SNOWMAN_X;
  const y = LAYOUT.BELT_Y - LAYOUT.ITEM_HALF;
  view.fx.push({
    type, x, y, ttl: type === 'star' ? 0.7 : 0.5, max: type === 'star' ? 0.7 : 0.5,
    r: 14 + Math.random() * 8, seed: Math.random() * TAU, golden: !!payload.golden,
  });
}

const TAU = Math.PI * 2;

function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    tutorialAdvance(ev.type);
    switch (ev.type) {
      case 'catch':
        view.shake = 2;
        pushFx('splat', ev);
        if (ev.golden) pushFx('star', ev);
        break;
      case 'golden':
        view.shake = 3;
        pushFx('star', { golden: true });
        break;
      case 'miss':
        view.shake = 3;
        pushFx('splat', ev);
        break;
      case 'rock':
        view.shake = 4;
        pushFx('burst', ev);
        break;
      case 'combo':
        pushFx('star', { golden: false });
        break;
      case 'levelup':
        view.shake = 3;
        break;
      case 'lose':
        finishRun(ev);
        return;
      default:
        break;
    }
  }
}

// ---------- 输入 ----------
function doLaunch() {
  audio.unlock();
  if (!run || phase !== 'playing') return;
  run.launch();
}

canvas.addEventListener('pointerdown', () => doLaunch());

$('btn-drop').addEventListener('click', () => doLaunch());

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') { e.preventDefault(); doLaunch(); }
  else if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
  else if (e.code === 'KeyR') restartRun();
  else if (e.code === 'KeyM') toggleMute();
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
  on('btn-start', () => startRun('classic'));
  on('btn-crazy', () => startRun('crazy'));
  on('btn-resume', resumeGame);
  on('btn-restart', restartRun);
  on('btn-restart2', restartRun);
  on('btn-retry', () => restartRun());
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-pause', pauseGame);
  on('btn-mute', toggleMute);
  on('btn-howto', startTutorial);
  on('btn-howto-hud', startTutorial);
  on('btn-howto-pause', startTutorial);
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);
  on('btn-rotate-skip', () => {
    const rs = $('rotate-screen');
    if (rs) rs.style.display = 'none';
  });

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

  if (view.shake > 0) view.shake = Math.max(0, view.shake - dt * 16);
  for (const fx of view.fx) if (fx.ttl > 0) fx.ttl -= dt;

  try {
    renderer.draw(run ? run.state : null, dt, view);
  } catch (err) {
    console.warn('render error', err);
  }
  view.fx = view.fx.filter((fx) => fx.ttl > 0);

  if (fpsSamples.length < 600 && dt > 0) fpsSamples.push(1 / dt);

  requestAnimationFrame(frame);
}

// ---------- 调试契约（截图/验收脚本通用） ----------
const saveStore = {
  set(k, v) { Sdk.save(k, v); },
  get(k, d) { return Sdk.load(k, d); },
};

window.__ll = {
  state: {
    get phase() { return phase; },
    get lang() { return i18n.lang; },
  },
  run: () => run,
  start: (m) => startRun(m === 1 || m === 'crazy' ? 'crazy' : 'classic'),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => goHome(),
  home: () => goHome(),
  sim: () => (run ? run.state : null),
  save: () => saveStore,
  ui: {},
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['launch', 'catch', 'combo']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: () => (run ? run.state : null),
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    ensureRun: () => { if (!run) startRun(lastMode); return run; },
    place: (kind, x, opts = {}) => {
      if (!run) startRun(lastMode);
      if (tutorialStep >= 0) endTutorial();
      run.state.items.push({
        id: Date.now() + Math.random(),
        kind: kind === 'rock' ? 'rock' : 'cone',
        color: opts.color || 'red',
        golden: !!opts.golden,
        x, y: LAYOUT.BELT_Y - LAYOUT.ITEM_HALF,
        state: 'sliding',
        topped: !!opts.topped,
      });
      updateHud();
      return true;
    },
    clearItems: () => { if (run) run.state.items = []; return true; },
    seedScene: () => {
      if (!run) startRun(lastMode);
      if (tutorialStep >= 0) endTutorial();
      run.state.items = [];
      const put = (kind, x, o = {}) => run.state.items.push({
        id: Date.now() + Math.random(), kind, color: o.color || 'red', golden: !!o.golden,
        x, y: LAYOUT.BELT_Y - LAYOUT.ITEM_HALF, state: 'sliding', topped: !!o.topped,
      });
      put('cone', LAYOUT.SNOWMAN_X - 18, { color: 'red' });
      put('cone', LAYOUT.SNOWMAN_X + 200, { color: 'blue', golden: true });
      put('cone', LAYOUT.SNOWMAN_X - 280, { color: 'green', topped: true });
      run.debug.setCombo(3);
      run.debug.addScore(26);
      updateHud();
      return true;
    },
    forceResult: () => {
      if (!run) startRun(lastMode);
      if (tutorialStep >= 0) endTutorial();
      run.debug.addScore(58);
      run.debug.setLevel(3);
      run.debug.forceResult();
      return true;
    },
    launch: () => doLaunch(),
  },
};

window.G = { state: () => ({ phase }), ui, save: saveStore, run: () => run };

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
ui.showTitle();
Sdk.track('load', {});
requestAnimationFrame(frame);
