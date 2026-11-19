// 主入口：60Hz 固定步长 + 标题/选关/游戏/暂停/结算 + 首次交互引导 + SDK 统一出口。
// 装配：sim(M1) / render(M2) / audio(M4)。职责：ui.js 只做语言与显隐；HUD/结算/关卡格/教程由这里直写。
import { STEP, GAME, WORLD } from '../config/game.config.js';
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
let demoRun = null;
let phase = 'title';        // title | playing | paused | result
let mode = 'endless';       // endless | level
let levelIndex = 0;
let lastTime = performance.now();
let accumulator = 0;
let tutorialStep = -1;      // -1 = 未激活
let pendingTutorial = false;

const view = { flashL: 0, flashR: 0, shake: 0, time: 0 };
const reducedMotion = typeof window !== 'undefined'
  && window.matchMedia
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let best = Sdk.load('best', 0) | 0;
let starsByLevel = Sdk.load('stars', {}) || {};
let unlocked = Math.max(1, Sdk.load('unlocked', 1) | 0);
let tutorialDone = !!Sdk.load('tutorialDone', false);
let lastLevel = Sdk.load('lastLevel', 0) | 0;

Sdk.ready();
Sdk.onAdStart(() => { if (phase === 'playing') pauseGame(); });
Sdk.onAdEnd(() => { if (phase === 'paused') resumeGame(); });
audio.setMuted(muted);
ui.setMuted(muted);

function persist() {
  Sdk.save('muted', muted);
  Sdk.save('best', best);
  Sdk.save('stars', starsByLevel);
  Sdk.save('unlocked', unlocked);
  Sdk.save('tutorialDone', tutorialDone);
  Sdk.save('lastLevel', lastLevel);
}

function totalStars() {
  return Object.values(starsByLevel).reduce((a, b) => a + (b | 0), 0);
}

// ---------- 阶段状态机 ----------
function setPhase(p) { phase = p; }

function createRunFor(m, idx = 0) {
  const simMode = m === 'endless' ? -1 : idx;
  return createRun(simMode, { seed: (Date.now() % 2147483647) || 1 });
}

function startRun(m, idx = 0) {
  mode = m;
  levelIndex = idx;
  run = createRunFor(m, idx);
  run.start();
  setPhase('playing');
  ui.showGame();
  ui.resultScreen.classList.add('hidden');
  audio.startBgm();
  view.shake = 0;
  handleEvents(run.drainEvents()); // 消费 levelStart 等开局事件
  updateHud();
  Sdk.newRun({ mode, level: idx + 1 });
  Sdk.track('start', { mode, level: idx + 1 });
  if (!tutorialDone) startTutorial();
}

function startEndless() {
  lastLevel = 0;
  startRun('endless', 0);
}

function startLevel(i) {
  i = Math.max(0, Math.min(LEVEL_COUNT - 1, i | 0));
  lastLevel = i;
  startRun('level', i);
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
  lastTime = performance.now();
}

function restartRun() {
  startRun(mode, levelIndex);
}

function goHome() {
  run = null;
  setPhase('title');
  audio.stopBgm();
  ui.showTitle();
  buildLevelGrid();
  updateBestLine();
}

// ---------- HUD / 关卡格 / 结算 ----------
function updateHud() {
  if (!run) return;
  ui.updateHUD(run.getHud(), best, mode === 'endless');
}

function updateBestLine() {
  ui.bestLine.textContent = `${t('best')}: ${best}m · ★ ${totalStars()}/${LEVEL_COUNT * 3}`;
}

function buildLevelGrid() {
  const grid = ui.levelGrid;
  if (!grid) return;
  grid.innerHTML = '';
  for (let i = 0; i < LEVEL_COUNT; i += 1) {
    const cell = document.createElement('button');
    cell.className = 'level-cell' + (i + 1 > unlocked ? ' locked' : '');
    cell.dataset.level = i;
    const s = starsByLevel[i + 1] | 0;
    cell.innerHTML = `<span class="lv-num">${i + 1}</span><span class="lv-stars">${'★'.repeat(s)}${'☆'.repeat(3 - s)}</span>`;
    cell.setAttribute('aria-label', `${t('level')} ${i + 1}`);
    grid.appendChild(cell);
  }
  ui.starsTotal.textContent = `★ ${totalStars()} / ${LEVEL_COUNT * 3}`;
}

function finishRun(ev) {
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  const st = run.state;
  const won = ev.type === 'win';
  const dist = Math.floor(st.distance);
  const stars = won ? (ev.stars || st.stars || 1) : 0;
  const newBest = mode === 'endless' && !won && dist > best;

  if (won) {
    if (mode === 'level') {
      const idx = st.levelIndex + 1; // 1 基
      starsByLevel[idx] = Math.max(starsByLevel[idx] | 0, stars);
      if (idx < LEVEL_COUNT) unlocked = Math.max(unlocked, idx + 1);
    }
  } else if (newBest) {
    best = dist;
  }

  persist();
  Sdk.track(won ? 'win' : 'fail', { mode, level: (st.levelIndex + 1), stars, distance: dist });
  if (won && mode === 'level') Sdk.levelCleared({ level: st.levelIndex + 1, stars });

  const resultTitle = ui.resultTitle;
  resultTitle.textContent = won ? t('winTitle') : t('loseTitle');
  resultTitle.classList.toggle('lose', !won);
  const starsEl = ui.resultStars;
  if (won) {
    starsEl.innerHTML = `<span class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>${stars >= 3 ? `<em>${t('perfect')}</em>` : ''}`;
  } else {
    starsEl.innerHTML = '';
  }

  const isEndless = mode === 'endless';
  if (won) {
    ui.resultMeta.textContent = isEndless
      ? `${t('dist')}: ${dist}m`
      : `${t('levelClear')} · ${t('dist')}: ${dist}m · ${t('orbs')}: ${st.orbsCollected}`;
  } else {
    ui.resultMeta.textContent = isEndless
      ? `${t('endlessResult')} · ${dist}m${newBest ? ` · ${t('newBest')}` : ''}`
      : `${t('dist')}: ${dist}m`;
  }

  ui.btnNext.classList.toggle('hidden', !(won && mode === 'level' && levelIndex + 1 < LEVEL_COUNT));
  ui.showResult();
  audio.event(won ? 'win' : 'lose');
}

// ---------- 教程（首次自动弹，可跳过，完成/跳过后持久化不再自动弹） ----------
const TUT_STEPS = () => [
  { text: t('tutStep1'), spot: 'left' },
  { text: t('tutStep2'), spot: 'right' },
  { text: t('tutStep3'), spot: 'pitch' },
];

function layoutRect(which) {
  try {
    const lay = renderer.debugLayout();
    return lay && lay[which] ? lay[which] : null;
  } catch { return null; }
}

function startTutorial() {
  tutorialStep = 0;
  pendingTutorial = false;
  renderTutorialStep();
}

function renderTutorialStep() {
  const el = $('tutorial');
  if (tutorialStep < 0) { el.classList.add('hidden'); return; }
  const steps = TUT_STEPS();
  const s = steps[tutorialStep];
  el.classList.remove('hidden');
  ui.tutTitle.textContent = t('tutTitle');
  ui.tutText.textContent = s ? s.text : '';
  ui.tutSkip.textContent = t('tutSkip');
  ui.tutNext.textContent = t('tutNext');
  const rect = s && s.spot ? layoutRect(s.spot) : null;
  const spot = $('tut-spotlight');
  if (rect) {
    spot.style.display = 'block';
    spot.style.left = `${rect.x - 6}px`;
    spot.style.top = `${rect.y - 6}px`;
    spot.style.width = `${rect.w + 12}px`;
    spot.style.height = `${rect.h + 12}px`;
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

function tutorialAdvance(ev) {
  if (tutorialStep < 0 || tutorialStep >= 3) return;
  const want = ['flickL', 'flickR', 'dodge'][tutorialStep];
  const got = ev.type === 'flick' ? (ev.half === 'L' ? 'flickL' : 'flickR') : ev.type;
  if (got !== want) return;
  tutorialStep += 1;
  if (tutorialStep >= 3) endTutorial();
  else renderTutorialStep();
}

// ---------- 事件消费 ----------
function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    tutorialAdvance(ev);
    switch (ev.type) {
      case 'flick':
        if (ev.half === 'L') view.flashL = 0.35;
        else view.flashR = 0.35;
        break;
      case 'dodge':
      case 'nearMiss':
        view.shake = ev.type === 'nearMiss' ? 5 : 3;
        break;
      case 'shieldBlock':
        view.shake = 4;
        break;
      case 'orb':
      case 'combo':
        view.shake = Math.max(view.shake, 2);
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
function canvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  return (e.clientX - rect.left) * (WORLD.WIDTH / rect.width);
}

function flickHalf(x) {
  return x < WORLD.WIDTH / 2 ? 'L' : 'R';
}

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (!run || phase !== 'playing') return;
  const x = canvasPos(e);
  const half = flickHalf(x);
  const res = run.input(half === 'L' ? 'left' : 'right');
  if (res.ok) handleEvents(run.drainEvents());
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
    if (run && phase === 'playing') { run.input('left'); handleEvents(run.drainEvents()); }
  } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
    if (run && phase === 'playing') { run.input('right'); handleEvents(run.drainEvents()); }
  } else if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  } else if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'result')) {
    restartRun();
  } else if (e.code === 'KeyM') {
    toggleMute();
  }
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
  on('btn-start', () => startEndless());
  on('btn-levels', () => {
    ui.levelPanel.classList.remove('hidden');
    ui.btnStart.classList.add('hidden');
    ui.btnLevels.classList.add('hidden');
    ui.btnHowto.classList.add('hidden');
    ui.taglineText.classList.add('hidden');
  });
  on('btn-levels-back', () => { ui.showTitle(); buildLevelGrid(); updateBestLine(); });
  on('btn-howto', () => startTutorial());
  on('btn-hud-howto', () => startTutorial());
  on('btn-pause', pauseGame);
  on('btn-resume', resumeGame);
  on('btn-restart', restartRun);
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-retry', restartRun);
  on('btn-next', () => startLevel(levelIndex + 1));
  on('btn-mute', toggleMute);
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);

  ui.levelGrid.addEventListener('click', (e) => {
    const idx = e.target.closest('[data-level]')?.dataset.level;
    if (idx == null) return;
    const i = +idx;
    if (i + 1 > unlocked) return;
    startLevel(i);
  });

  for (const sel of ui.langSelects) {
    if (!sel) continue;
    sel.addEventListener('change', () => {
      ui.setLang(sel.value);
      renderTutorialStep();
      buildLevelGrid();
      updateBestLine();
      if (run) updateHud();
    });
  }
}

// ---------- 主循环 ----------
function frame(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;
  view.time += dt;

  if (phase === 'playing' && run) {
    accumulator += dt;
    while (accumulator >= STEP) {
      run.step();
      accumulator -= STEP;
    }
    handleEvents(run.drainEvents());
    if (run && phase === 'playing') updateHud();
  }

  if (view.flashL > 0) view.flashL = Math.max(0, view.flashL - dt);
  if (view.flashR > 0) view.flashR = Math.max(0, view.flashR - dt);
  if (view.shake > 0) view.shake = Math.max(0, view.shake - (reducedMotion ? dt * 30 : dt * 18));

  // 标题/结算屏后跑一段吸引演示，让画面保持霓虹球场氛围（关卡模式，终点线可见）
  if (phase !== 'playing' && phase !== 'paused' && demoRun) {
    demoRun.step();
    if (demoRun.state.phase !== 'playing') {
      demoRun = createRun(0, { seed: (Date.now() % 100000) + 7 });
      demoRun.start();
    }
  }

  try {
    const st = run ? run.state : (demoRun ? demoRun.state : null);
    renderer.draw(st, dt, view);
  } catch (err) {
    console.warn('render error', err);
  }

  requestAnimationFrame(frame);
}

// ---------- 调试契约 ----------
window.__ll = {
  state: {
    get phase() { return phase; },
    get lang() { return i18n.lang; },
    get dir() { return i18n.dir; },
  },
  run: () => run,
  start: (i) => (i == null ? startEndless() : startLevel(i)),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => restartRun(),
  home: () => goHome(),
  sim: () => (run ? run.state : null),
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['flickL', 'flickR', 'dodge']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
  },
  startTutorial: () => startTutorial(),
  debug: {
    state: () => (run ? run.state : null),
    layout: () => { try { return renderer.debugLayout(); } catch { return null; } },
    startEndless: () => startEndless(),
    startLevel: (i) => startLevel(i),
    win: () => { if (run) finishRun({ type: 'win', stars: run.state.stars || 3, distance: Math.floor(run.state.distance) }); },
    lose: () => { if (run) finishRun({ type: 'lose' }); },
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    setDistance: (m) => { if (run) run.state.distance = m; },
    seedScene: () => {
      if (!run) return false;
      const st = run.state;
      const W = GAME.WALL_H;
      st.walls = [
        { half: 'L', lane: 1, x: 480, y: 150, h: W, kind: 'wall', passed: false, nearMissDone: false },
        { half: 'R', lane: 2, x: 800, y: 150, h: W, kind: 'wall', passed: false, nearMissDone: false },
        { half: 'L', lane: 1, x: 480, y: 340, h: W, kind: 'wall', passed: false, nearMissDone: false },
        { half: 'R', lane: 2, x: 800, y: 340, h: W, kind: 'wall', passed: false, nearMissDone: false },
      ];
      st.orbs = [
        { half: 'L', lane: 0, x: 160, y: 100, r: GAME.ORB_R, collected: false },
        { half: 'R', lane: 3, x: 1120, y: 100, r: GAME.ORB_R, collected: false },
        { half: 'L', lane: 0, x: 160, y: 250, r: GAME.ORB_R, collected: false },
        { half: 'R', lane: 3, x: 1120, y: 250, r: GAME.ORB_R, collected: false },
      ];
      st.powerups = [
        { half: 'L', lane: 0, x: 160, y: 430, kind: 'shield', collected: false },
        { half: 'R', lane: 3, x: 1120, y: 500, kind: 'magnet', collected: false },
      ];
      return true;
    },
    seedRock: () => {
      if (!run) return false;
      const st = run.state;
      st.walls = [
        { half: 'L', lane: 0, x: 300, vx: 0.9, y: 200, h: GAME.ROCK_H, kind: 'rock', passed: false, nearMissDone: false },
        { half: 'R', lane: 2, x: 980, vx: -0.9, y: 320, h: GAME.ROCK_H, kind: 'rock', passed: false, nearMissDone: false },
        { half: 'L', lane: 1, x: 480, y: 450, h: GAME.WALL_H, kind: 'wall', passed: false, nearMissDone: false },
        { half: 'R', lane: 2, x: 800, y: 450, h: GAME.WALL_H, kind: 'wall', passed: false, nearMissDone: false },
      ];
      st.orbs = [
        { half: 'L', lane: 1, x: 480, y: 120, r: GAME.ORB_R, collected: false },
        { half: 'R', lane: 3, x: 1120, y: 120, r: GAME.ORB_R, collected: false },
      ];
      st.powerups = [];
      return true;
    },
  },
  save: () => ({ best, stars: starsByLevel, unlocked, tutorialDone }),
  ui: () => ui,
};

// ---------- 启动 ----------
bind();
syncDocumentLang();
ui.applyLang();
ui.showTitle();
buildLevelGrid();
updateBestLine();
demoRun = createRun(0, { seed: 42 });
demoRun.start();
Sdk.track('load', {});
requestAnimationFrame(frame);
