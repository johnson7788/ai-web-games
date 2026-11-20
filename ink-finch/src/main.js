// INK FINCH · 主入口：60Hz 固定步长 + 标题/关卡/暂停/结算 + 教程引导 + SDK 统一出口
// 装配：sim(M1) / render+ui(M2) / audio(M4) / Lead 集成。
// 职责划分：ui.js 只做语言与屏幕显隐；HUD/结算/关卡格/教程的 DOM 由这里直写。
import { STEP, WORLD, GAME } from '../config/game.config.js';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';
import { createRun } from './game/sim.js';
import { createController } from './game/ai.js';
import { createRenderer } from './render/index.js';
import { createAudio } from './core/audio.js';
import { ui } from './ui/ui.js';
import { i18n, t, syncDocumentLang } from './core/i18n.js';
import Sdk from './core/sdk.js';

const $ = (id) => document.getElementById(id);
const canvas = $('canvas');
const renderer = createRenderer(canvas);
const audio = createAudio();

let run = null;            // 当前对局
let phase = 'title';       // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let fpsSamples = [];
let tutorialStep = -1;     // -1 = 未激活
let autoCtrl = null;       // 录 gif / 自动玩用的控制器

const view = {
  shake: 0,
  fxQueue: [],
};

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let unlocked = Math.max(1, Sdk.load('unlocked', 1) | 0);
let cleared = Sdk.load('cleared', {}) || {};
let tutorialDone = !!Sdk.load('tutorialDone', false);
let lastLevel = Sdk.load('lastLevel', 0) | 0;
let best = Sdk.load('best', 0) | 0;

Sdk.ready(); // 不 await，不阻塞首屏
Sdk.onAdStart(() => { if (phase === 'playing') pauseGame(true); });
Sdk.onAdEnd(() => { if (phase === 'paused') resumeGame(); });
audio.setMuted(muted);
ui.setMuted(muted);

function persist() {
  Sdk.save('unlocked', unlocked);
  Sdk.save('cleared', cleared);
  Sdk.save('muted', muted);
  Sdk.save('tutorialDone', tutorialDone);
  Sdk.save('lastLevel', lastLevel);
  Sdk.save('best', best);
}

// ---------- 阶段状态机 ----------
function setPhase(p) { phase = p; }

function startLevel(idx) {
  idx = Math.max(0, Math.min(LEVEL_COUNT - 1, idx | 0));
  lastLevel = idx;
  run = createRun(idx, { seed: (Date.now() % 2147483647) || 1 });
  view.fxQueue = [];
  view.shake = 0;
  setPhase('playing');
  ui.showGame();
  hideResult();
  updateHud();
  audio.startBgm();
  Sdk.track('start', { level: idx + 1 });
  if (!tutorialDone && idx === 0) startTutorial();
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
  if (run) Sdk.track('restart', { level: run.state.level });
  startLevel(run ? run.state.level - 1 : lastLevel);
}

function goHome() {
  run = null;
  setPhase('title');
  hideResult();
  ui.showTitle();
  buildLevelGrid();
}

// ---------- HUD / 关卡格 / 结算 ----------
function updateHud() {
  if (!run) return;
  const h = run.getHud();
  const lv = LEVELS[run.state.level - 1] || {};
  $('hud-level').textContent = `${t('level')} ${h.level} · ${(lv.name && (lv.name[i18n.lang] || lv.name.en)) || ''}`;
  if (run.state.phase === 'ready') {
    $('hud-score').textContent = t('tapToFlap');
  } else {
    $('hud-score').textContent = `${h.score} / ${h.target}`;
  }
  const tgt = $('hud-target');
  if (tgt) tgt.textContent = '';
}

function buildLevelGrid() {
  const grid = $('level-grid');
  if (!grid) return;
  grid.innerHTML = '';
  for (let i = 0; i < LEVEL_COUNT; i += 1) {
    const cell = document.createElement('button');
    const lvl = i + 1;
    cell.className = 'level-cell' + (lvl > unlocked ? ' locked' : '') + (cleared[lvl] ? ' cleared' : '');
    cell.dataset.level = i;
    cell.innerHTML =
      `<span class="lv-num">${lvl}</span>` +
      `<span class="level-mark">${cleared[lvl] ? '✓' : lvl > unlocked ? '' : '·'}</span>`;
    cell.setAttribute('aria-label', `${t('level')} ${lvl}${lvl > unlocked ? ' ' + t('locked') : ''}`);
    grid.appendChild(cell);
  }
  const done = Object.keys(cleared).length;
  $('stars-total').textContent = `✓ ${done} / ${LEVEL_COUNT}`;
}

function showResult({ won, score, target, hasNext, isNewBest }) {
  $('result-title').textContent = won ? t('winTitle') : t('loseTitle');
  $('result-title').classList.toggle('lose', !won);
  $('result-stars').textContent = `${score} / ${target}`;
  const meta = [];
  if (won && hasNext) meta.push(t('nextLevel'));
  if (isNewBest) meta.push(t('newBest'));
  if (!won) meta.push(t('retry'));
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
  let isNewBest = false;
  if (won) {
    const idx = st.level;
    cleared[idx] = true;
    if (idx < LEVEL_COUNT) unlocked = Math.max(unlocked, idx + 1);
    if (st.score > best) { best = st.score; isNewBest = true; }
    buildLevelGrid();
  }
  persist();
  Sdk.track(won ? 'win' : 'fail', { level: st.level, score: st.score });
  showResult({
    won, score: st.score, target: st.target,
    hasNext: st.level < LEVEL_COUNT, isNewBest,
  });
}

// ---------- 教程引导（首次自动弹，可跳过，完成/跳过后持久化不再自动弹） ----------
const TUT_STEPS = () => [
  { text: t('tutStep1'), spot: 'bird' },
  { text: t('tutStep2'), spot: 'gate' },
  { text: t('tutStep3'), spot: 'restart' },
  { text: t('tutStep4'), spot: 'score' },
];

function layoutRect(which) {
  try {
    const lay = renderer.debugLayout();
    return lay && lay[which] ? lay[which] : null;
  } catch { return null; }
}

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
  const rect = s && s.spot ? layoutRect(s.spot) : null;
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

// 真实动作推进教学（flap → gatePass → death → win）
const TUT_TRIGGER = ['flap', 'gatePass', 'death', 'win'];
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
      case 'ink':
        view.fxQueue.push({ type: 'inkSplash', x: ev.x, y: ev.y, ttl: 0.5, max: 0.5, spawned: false });
        break;
      case 'gatePass':
        view.fxQueue.push({ type: 'scorePop', x: ev.x, y: run.state.bird.y - 22, ttl: 0.7, max: 0.7, points: ev.points, spawned: false });
        updateHud();
        break;
      case 'nearMiss':
        view.fxQueue.push({ type: 'nearMiss', x: run.state.bird.x, y: run.state.bird.y, ttl: 0.4, max: 0.4, spawned: false });
        view.shake = 2;
        break;
      case 'death':
        view.shake = GAME.SHAKE_AMP;
        view.fxQueue.push({ type: 'deathInk', x: run.state.bird.x, y: run.state.bird.y, ttl: 1.2, max: 1.2, spawned: false });
        finishRun(ev);
        return;
      case 'win':
        finishRun(ev);
        return;
      default:
        break;
    }
  }
}

// ---------- 输入 ----------
function doFlap() {
  if (!run || phase !== 'playing') return;
  audio.unlock();
  run.flap();
  run.setHold(true);
}

canvas.addEventListener('pointerdown', () => { doFlap(); });
canvas.addEventListener('pointerup', () => { if (run) run.setHold(false); });
canvas.addEventListener('pointercancel', () => { if (run) run.setHold(false); });

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); doFlap(); }
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
  if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'result')) restartLevel();
  if (e.code === 'KeyM') toggleMute();
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp') { if (run) run.setHold(false); }
});

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  ui.setMuted(muted);
  $('btn-mute').classList.toggle('is-muted', muted);
  persist();
}

// ---------- UI 绑定 ----------
function bind() {
  const on = (id, fn) => {
    const el = $(id);
    if (el) el.addEventListener('click', () => { audio.unlock(); fn(); });
  };
  on('btn-start', () => startLevel(lastLevel || 0));
  on('btn-resume', resumeGame);
  on('btn-restart', restartLevel);
  on('btn-restart2', restartLevel);
  on('btn-retry', restartLevel);
  on('btn-next', () => startLevel((run ? run.state.level : lastLevel) + 1));
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-tut-replay', () => { if (phase === 'paused') resumeGame(); startTutorial(); });
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result') startTutorial(); });
  on('btn-rotate-skip', () => { const rs = $('rotate-screen'); if (rs) rs.style.display = 'none'; });
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);

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
      renderTutorialStep();
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

// ---------- 调试契约（截图/验收脚本通用） ----------
function startSeeded(i, seed) {
  const idx = Math.max(0, Math.min(LEVEL_COUNT - 1, i | 0));
  lastLevel = idx;
  run = createRun(idx, { seed: seed | 0 || 1 });
  run.flap(); // 立即进入 playing 并生成竹节（截图/验收路径）
  view.fxQueue = [];
  view.shake = 0;
  setPhase('playing');
  ui.showGame();
  hideResult();
  updateHud();
  audio.startBgm();
  return true;
}

function autoPlay() {
  if (!run) return false;
  const ctrl = createController(run._level);
  let guard = 20000;
  while (guard-- > 0 && run.state.phase !== 'won' && run.state.phase !== 'lost') {
    if (ctrl.step(run)) run.flap();
    run.step(1 / 60);
    handleEvents(run.drainEvents());
  }
  return run.state.phase === 'won';
}

window.__ll = {
  state: {
    get phase() { return phase; },
    get lang() { return i18n.lang; },
  },
  run: () => run,
  start: (i) => startLevel(i == null ? (lastLevel || 0) : (i | 0) - 1),
  save: (k, v) => Sdk.save(k, v),
  load: (k, f) => Sdk.load(k, f),
  share: (p) => Sdk.share(p),
  ui: () => ui,
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => restartLevel(),
  home: () => goHome(),
  sim: () => (run ? run.state : null),
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return TUT_STEPS().map((s) => s.spot); },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: () => (run ? { ...run.state } : null),
    layout: () => { try { return renderer.debugLayout(); } catch { return null; } },
    loadLevel: (i) => { startLevel((i | 0) - 1); if (run) run.flap(); },
    startSeeded: (i, seed) => startSeeded((i | 0) - 1, seed),
    autoPlaceSolution: () => autoPlay(),
    autoPlay: () => autoPlay(),
    autoPilotStart: () => { if (run) autoCtrl = createController(run._level); return !!autoCtrl; },
    autoPilotTick: () => {
      if (run && autoCtrl && run.state.phase === 'playing' && autoCtrl.step(run)) {
        run.flap();
        return true;
      }
      return false;
    },
    fastForward: () => autoPlay(),
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    startTutorial: () => startTutorial(),
    tutorialStep: () => tutorialStep,
    giveUp: () => autoPlay(),
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
