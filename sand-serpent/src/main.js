// 主入口：60Hz 固定步长 + 标题/选关/游戏/暂停/结算 + 教程引导 + SDK 统一出口
// 契约见 docs/README.md。装配：sim / render / ui / audio + Lead 集成。
// 职责：HUD/结算/关卡格/侧栏/教程的 DOM 由这里直写；ui.js 只管语言与屏幕显隐。
import { STEP } from '../config/game.config.js';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';
import { createRun } from './game/sim.js';
import { greedyDir } from './game/bot.js';
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

const view = {
  hoverCell: null,
  cursor: { x: 0, y: 0 },
  fxQueue: [],             // {type:'sandBurst'|'speedLines', r?, c?, ttl, seed?}
  shake: 0,
};

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let unlocked = Math.max(1, Sdk.load('unlocked', 1) | 0);
let bestByLevel = Sdk.load('best', {}) || {};
let tutorialDone = !!Sdk.load('tutorialDone', false);
let lastLevel = Sdk.load('lastLevel', 0) | 0;

Sdk.ready(); // 不 await，不阻塞首屏
Sdk.onAdStart(() => { if (phase === 'playing') pauseGame(true); });
Sdk.onAdEnd(() => { if (phase === 'paused') resumeGame(); });
audio.setMuted(muted);
ui.setMuted(muted);

function persist() {
  Sdk.save('unlocked', unlocked);
  Sdk.save('best', bestByLevel);
  Sdk.save('muted', muted);
  Sdk.save('tutorialDone', tutorialDone);
  Sdk.save('lastLevel', lastLevel);
}

function totalBest() {
  return Object.values(bestByLevel).reduce((a, b) => a + (b | 0), 0);
}

function chapterName(scene) {
  if (scene === 'oasis') return t('chapter2');
  if (scene === 'starlight') return t('chapter3');
  return t('chapter1');
}

// ---------- 阶段状态机 ----------
function setPhase(p) { phase = p; }

function startLevel(idx) {
  idx = Math.max(0, Math.min(LEVEL_COUNT - 1, idx | 0));
  lastLevel = idx;
  run = createRun(idx, { seed: (Date.now() % 2147483647) || 1 });
  run._clockStart = performance.now();
  setPhase('playing');
  ui.showGame();
  hideResult();
  updateHud();
  updateSideLegend();
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

// ---------- HUD / 侧栏 / 关卡格 / 结算 ----------
function updateHud() {
  if (!run) return;
  const h = run.getHud();
  const s = run.state;
  const lv = LEVELS[s.level - 1] || {};
  $('hud-level').textContent = `${t('level')} ${s.level} · ${chapterName(lv.scene)}`;
  $('hud-length').textContent = `${t('length')} ${h.length}/${h.goalLength}`;
  $('hud-score').textContent = `${t('score')} ${h.score}`;
  $('hud-best').textContent = `${t('best')} ${bestByLevel[s.level] | 0}`;
  $('length-bar').style.width = `${Math.min(100, (h.length / h.goalLength) * 100)}%`;
  $('side-goal-value').textContent = `${h.length} / ${h.goalLength}`;
  $('side-sandstorm').classList.toggle('hidden', !h.sandActive);
}

function updateSideLegend() {
  $('side-goal-label').textContent = t('goal');
  $('side-beetle').textContent = `${t('beetleName')} ${t('beetleDesc')}`;
  $('side-scorpion').textContent = `${t('scorpionName')} ${t('scorpionDesc')}`;
  $('side-thorn').textContent = `${t('thornName')} ${t('thornDesc')}`;
}

function buildLevelGrid() {
  const grid = $('level-grid');
  if (!grid) return;
  grid.innerHTML = '';
  for (let i = 0; i < LEVEL_COUNT; i += 1) {
    const cell = document.createElement('button');
    cell.className = 'level-cell' + (i + 1 > unlocked ? ' level-locked' : '');
    cell.dataset.level = i;
    const best = bestByLevel[i + 1] | 0;
    cell.innerHTML =
      `<span class="lv-num">${i + 1}</span>` +
      `<span class="level-flag">${i + 1 > unlocked ? '🔒' : best > 0 ? '✓' : ''}</span>`;
    cell.setAttribute('aria-label', `${t('level')} ${i + 1}${i + 1 > unlocked ? ' ' + t('locked') : ''}`);
    grid.appendChild(cell);
  }
  $('best-total').textContent = `${t('best')}: ${totalBest()}`;
}

function showResult(res) {
  const { won, score, length, goalLength, reason, hasNext } = res;
  $('result-title').textContent = won ? t('winTitle') : t('loseTitle');
  $('result-title').classList.toggle('lose', !won);
  $('result-score').textContent = won ? `${score}` : `${length}/${goalLength}`;
  $('result-meta').textContent = won ? t('winReason') : loseReasonText(reason);
  $('btn-next').style.display = won && hasNext ? '' : 'none';
  $('screen-result').classList.remove('hidden');
}

function loseReasonText(reason) {
  if (reason === 'wall') return t('loseWall');
  if (reason === 'self') return t('loseSelf');
  if (reason === 'cactus') return t('loseCactus');
  if (reason === 'hard') return t('loseHard');
  return t('loseWall');
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
  const idx = s.level; // 1 基
  if (won) {
    bestByLevel[idx] = Math.max(bestByLevel[idx] | 0, s.score);
    if (idx < LEVEL_COUNT) unlocked = Math.max(unlocked, idx + 1);
    buildLevelGrid();
  }
  persist();
  Sdk.track(won ? 'win' : 'fail', {
    level: idx, score: s.score, length: s.length, goalLength: s.goalLength,
    durationMs: Math.round(performance.now() - run._clockStart) || 0,
  });
  showResult({
    won, score: s.score, length: s.length, goalLength: s.goalLength,
    reason: s.result && s.result.reason, hasNext: idx < LEVEL_COUNT,
  });
  audio.event(won ? 'win' : 'lose');
}

// ---------- 教程引导（首次自动弹，可跳过，完成后持久化） ----------
const TUT_TRIGGER = ['turn', 'eat', 'win'];
const TUT_SPOTS = ['board', 'board', 'hud'];
const TUT_STEPS = () => [
  { text: t('tutStep1'), spot: 'board' },
  { text: t('tutStep2'), spot: 'board' },
  { text: t('tutStep3'), spot: 'hud' },
];

function layoutRect(which) {
  try {
    const lay = renderer.debugLayout();
    if (!lay) return null;
    if (which === 'hud') return lay.hud;
    if (which === 'side') return lay.side;
    return lay.grid;
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
  const rect = s && s.spot && layoutRect(s.spot);
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
      case 'eat': {
        const head = run.state.snake[0];
        view.fxQueue.push({ type: 'sandBurst', r: head.r, c: head.c, ttl: 0.4, seed: Math.random() * 6 });
        view.shake = 2;
        break;
      }
      case 'tailDrop': {
        const head = run.state.snake[0];
        view.fxQueue.push({ type: 'sandBurst', r: head.r, c: head.c, ttl: 0.4, seed: Math.random() * 6 });
        break;
      }
      case 'boost':
        view.fxQueue.push({ type: 'speedLines', ttl: 0.5 });
        view.shake = 1;
        break;
      case 'spawn':
        view.fxQueue.push({ type: 'sandBurst', r: ev.r, c: ev.c, ttl: 0.3, seed: Math.random() * 6 });
        break;
      case 'lose':
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
function steer(dir) {
  if (run && phase === 'playing') run.input(dir);
}

function keyToDir(code) {
  switch (code) {
    case 'ArrowUp': case 'KeyW': return 'up';
    case 'ArrowDown': case 'KeyS': return 'down';
    case 'ArrowLeft': case 'KeyA': return 'left';
    case 'ArrowRight': case 'KeyD': return 'right';
    default: return null;
  }
}

window.addEventListener('keydown', (e) => {
  const dir = keyToDir(e.code);
  if (dir) { e.preventDefault(); audio.unlock(); steer(dir); }
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
  if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'result')) restartLevel();
  if (e.code === 'KeyM') toggleMute();
});

// 触屏滑动转向
let swipeStart = null;
canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  swipeStart = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener('pointerup', (e) => {
  if (!swipeStart || !run || phase !== 'playing') { swipeStart = null; return; }
  const dx = e.clientX - swipeStart.x;
  const dy = e.clientY - swipeStart.y;
  swipeStart = null;
  if (Math.hypot(dx, dy) < 24) return;
  const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
  steer(dir);
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
  on('btn-next', () => startLevel((run ? run.state.level : lastLevel)));
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-tut-replay', () => {
    if (phase === 'paused') resumeGame();
    if (phase === 'playing') startTutorial();
  });
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result') startTutorial(); });
  on('btn-rotate-skip', () => {
    const rs = $('rotate-screen');
    if (rs) rs.style.display = 'none';
  });
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
      updateSideLegend();
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
    get steps() { return TUT_TRIGGER; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  save: (k, v) => Sdk.save(k, v),
  ui: () => ui,
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: () => {
      if (!run) return null;
      const s = run.state;
      return { ...s, snake: s.snake.map((p) => ({ ...p })), food: s.food.map((f) => ({ ...f })) };
    },
    layout: () => { try { return renderer.debugLayout(); } catch { return null; } },
    loadLevel: (i) => startLevel(i),
    startSeeded: (i, seed) => {
      const idx = Math.max(0, Math.min(LEVEL_COUNT - 1, i | 0));
      lastLevel = idx;
      run = createRun(idx, { seed: seed | 0 || 1 });
      run._clockStart = performance.now();
      setPhase('playing');
      ui.showGame();
      hideResult();
      updateHud();
      updateSideLegend();
      return true;
    },
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    startTutorial: () => startTutorial(),
    tutorialStep: () => tutorialStep,
    fastForward: () => {
      if (!run) return false;
      try {
        let guard = 10000;
        while (guard-- > 0 && run.state.phase === 'playing') run.moveOnce();
        handleEvents(run.drainEvents());
        return true;
      } catch { return false; }
    },
    autoPlay: () => {
      if (!run) return false;
      try {
        let guard = 3000;
        while (guard-- > 0 && run.state.phase === 'playing') {
          run.input(greedyDir(run));
          run.moveOnce();
        }
        handleEvents(run.drainEvents());
        return run.state.phase;
      } catch { return false; }
    },
    greedyDir: () => (run ? greedyDir(run) : null),
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
updateSideLegend();
buildLevelGrid();
$('btn-mute').classList.toggle('is-muted', muted);
Sdk.track('load', {});
requestAnimationFrame(frame);
