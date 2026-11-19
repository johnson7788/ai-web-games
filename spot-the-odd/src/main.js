// 主入口：60Hz 固定步长 + 标题→游戏→暂停→结算 + 教程引导 + SDK 统一出口 + 标准调试契约
// 装配：sim(M1) / render(M2) / audio(M3) / ui(M4)。
import { STEP, WORLD, GRID, CATEGORIES, ROUNDS } from '../config/game.config.js';
import { createRunDecorated, tap as simTap, hint as simHint, step as simStep, drainEvents } from './game/sim.js';
import { createRenderer } from './render/index.js';
import { createAudio } from './core/audio.js';
import { ui } from './ui/ui.js';
import { t } from './core/i18n.js';
import Sdk from './core/sdk.js';

const $ = (id) => document.getElementById(id);
const CAT_COLOR = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.color]));
const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const canvas = ui.canvas;
const renderer = createRenderer(canvas);
const audio = createAudio();

let run = null;
let phase = 'title';            // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;

let muted = !!Sdk.load('muted', false);
let best = Sdk.load('best', null);
let tutorialDone = !!Sdk.load('tutorialDone', false);
let hudAccum = 0;

const view = {
  now: 0,
  hintIndex: null,
  fx: [],
};

// ---------- 教程状态 ----------
const TUT_STEPS = ['t_step1', 't_step2', 't_step3', 't_step4'];
const tutorial = { active: false, step: 0, current: '' };
let tutorialFromMenu = false;

const tutOverlay = $('tutorial');
const tutTitle = $('tut-title');
const tutText = $('tut-text');
const tutNext = $('tut-next');

function cellCenter(i) {
  const c = i % GRID.cols;
  const r = Math.floor(i / GRID.cols);
  return { x: GRID.left + c * GRID.cellW + GRID.cellW / 2, y: GRID.top + r * GRID.cellH + GRID.cellH / 2 };
}

function pushFx(x, y, color, ttl = 0.4) {
  view.fx.push({ x, y, color, born: view.now, ttl });
  if (view.fx.length > 40) view.fx.splice(0, view.fx.length - 40);
}

// ---------- 阶段状态机 ----------
function startGame(seed) {
  run = createRunDecorated(seed != null ? seed : (Date.now() % 0x7fffffff) || 1);
  view.fx = [];
  view.hintIndex = null;
  phase = 'playing';
  ui.showGame();
  ui.updateHud(run);
  Sdk.newRun({ game: 'spot-the-odd' });
  audio.unlock();
  audio.startBgm();
}

function goTitle() {
  phase = 'title';
  run = null;
  view.fx = [];
  ui.showTitle();
  ui.updateBest(best);
  audio.stopBgm();
}

function pauseGame() {
  if (phase === 'playing') {
    phase = 'paused';
    ui.showPause();
  }
}

function resumeGame() {
  if (phase === 'paused') {
    phase = 'playing';
    ui.hidePause();
    lastTime = performance.now();
  }
}

function onFinish() {
  phase = 'result';
  best = Math.max(best ?? 0, run.score);
  Sdk.save('best', best);
  if (run.won) Sdk.levelCleared({ score: run.score, stars: run.stars });
  else Sdk.gameOver({ score: run.score });
  ui.showResult();
  ui.updateResult(run);
  ui.updateBest(best);
  audio.stopBgm();
}

// ---------- 教程 ----------
function updateTutorialCard() {
  const id = TUT_STEPS[tutorial.step];
  tutTitle.textContent = t(`${id}_title`);
  tutText.textContent = t(`${id}_text`);
  tutNext.textContent = tutorial.step >= TUT_STEPS.length - 1 ? t('tut_gotit') : t('tut_next');
  tutorial.current = t(`${id}_title`);
}

function activateTutorial(fromMenu) {
  tutorialFromMenu = !!fromMenu;
  tutorial.active = true;
  tutorial.step = 0;
  updateTutorialCard();
  tutOverlay.classList.remove('hidden');
}

function dismissTutorial() {
  tutorial.active = false;
  tutOverlay.classList.add('hidden');
  tutorialDone = true;
  Sdk.save('tutorialDone', true);
  if (tutorialFromMenu) startGame();
}

function advanceTutorial() {
  if (!tutorial.active) return;
  tutorial.step += 1;
  if (tutorial.step >= TUT_STEPS.length) {
    dismissTutorial();
  } else {
    updateTutorialCard();
  }
}

function onMenuStart() {
  audio.unlock();
  if (!tutorialDone) activateTutorial(true);
  else startGame();
}

// ---------- 事件消费 ----------
function handleEvent(e) {
  switch (e.type) {
    case 'tapCorrect': {
      audio.event('tapCorrect', { combo: e.payload.combo });
      const c = cellCenter(e.payload.index);
      const item = run.items[e.payload.index];
      pushFx(c.x, c.y, CAT_COLOR[item.cat] || '#fff');
      if (e.payload.combo >= 2) ui.showToast(t('toast_combo', { n: e.payload.combo }));
      break;
    }
    case 'tapWrong': {
      audio.event('tapWrong');
      const c = cellCenter(e.payload.index);
      pushFx(c.x, c.y, '#ff5c5c');
      ui.showToast(t('toast_wrong'));
      break;
    }
    case 'oddFound': {
      audio.event('oddFound');
      const c = cellCenter(e.payload.index);
      pushFx(c.x, c.y, '#ff5cff', 0.55);
      ui.showToast(t('toast_odd', { n: e.payload.bonus }));
      break;
    }
    case 'hint': {
      audio.event('hint');
      view.hintIndex = e.payload.index;
      break;
    }
    case 'combo':
      break; // 已由 tapCorrect 的 toast 覆盖
    case 'roundWin': audio.event('roundWin'); ui.showToast(t('toast_roundWin')); break;
    case 'roundLose': audio.event('roundLose'); ui.showToast(t('toast_roundLose')); break;
    case 'roundDraw': audio.event('roundDraw'); ui.showToast(t('toast_roundDraw')); break;
    case 'gameWin': audio.event('gameWin'); break;
    case 'gameLose': audio.event('gameLose'); break;
    case 'countdown': audio.event('countdown', { timeLeft: e.payload.timeLeft }); break;
    default: break;
  }
}

// ---------- 输入 ----------
function doTap(index) {
  if (phase !== 'playing' || !run) return;
  const res = simTap(run, index);
  if (res.ok) {
    // 事件在下一帧 step 后统一消费
  }
}

function pointerToCell(e) {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (WORLD.WIDTH / rect.width);
  const y = (e.clientY - rect.top) * (WORLD.HEIGHT / rect.height);
  const col = Math.floor((x - GRID.left) / GRID.cellW);
  const row = Math.floor((y - GRID.top) / GRID.cellH);
  if (col < 0 || col >= GRID.cols || row < 0 || row >= GRID.rows) return null;
  return row * GRID.cols + col;
}

canvas.addEventListener('pointerdown', (e) => {
  if (phase !== 'playing') return;
  audio.unlock();
  const idx = pointerToCell(e);
  if (idx != null) doTap(idx);
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  } else if (e.code === 'KeyR') {
    if (phase === 'playing' || phase === 'paused' || phase === 'result') startGame();
  } else if (e.code === 'KeyM') {
    muted = !muted; audio.setMuted(muted); ui.setMuted(muted); Sdk.save('muted', muted);
  }
});

// ---------- 主循环 ----------
function loop(now) {
  requestAnimationFrame(loop);
  view.now = REDUCED ? 0 : now;
  view.fx = view.fx.filter((f) => (now - f.born) / 1000 < f.ttl);

  if (phase !== 'playing') {
    renderer.render(run, view);
    return;
  }

  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  accumulator += dt;
  while (accumulator >= STEP) {
    simStep(run, STEP);
    accumulator -= STEP;
    if (run.finished) break;
  }

  for (const ev of drainEvents(run)) handleEvent(ev);
  if (run.finished) {
    onFinish();
    renderer.render(run, view);
    return;
  }

  view.hintIndex = run.hintIndex;
  hudAccum += dt;
  if (hudAccum >= 0.1) {
    ui.updateHud(run);
    hudAccum = 0;
  }
  renderer.render(run, view);
}

// ---------- 按钮接线 ----------
ui.btnStart.addEventListener('click', onMenuStart);
ui.btnResume.addEventListener('click', resumeGame);
ui.btnRetry.addEventListener('click', () => startGame());
$('btn-home').addEventListener('click', goTitle);
$('btn-restart').addEventListener('click', () => startGame());
$('btn-restart2').addEventListener('click', () => startGame());
$('btn-home2').addEventListener('click', goTitle);
$('btn-home3').addEventListener('click', goTitle);
$('btn-howto').addEventListener('click', () => activateTutorial(false));
$('btn-howto-hud').addEventListener('click', () => activateTutorial(false));
$('btn-howto-pause').addEventListener('click', () => activateTutorial(false));
$('tut-skip').addEventListener('click', dismissTutorial);
$('tut-next').addEventListener('click', advanceTutorial);
ui.btnHint.addEventListener('click', () => {
  if (phase !== 'playing' || !run) return;
  audio.unlock();
  const res = simHint(run);
  if (res.ok) view.hintIndex = res.index;
  else ui.showToast(t('hintEmpty'));
});
ui.btnMute.addEventListener('click', () => {
  muted = !muted;
  audio.setMuted(muted);
  ui.setMuted(muted);
  Sdk.save('muted', muted);
});
for (const sel of ui.langSelects) {
  if (sel) sel.addEventListener('change', (e) => ui.setLang(e.target.value));
}

// ---------- 启动 ----------
Sdk.ready(); // 不 await，不阻塞首屏
Sdk.track('load', { game: 'spot-the-odd' });
audio.setMuted(muted);
ui.setMuted(muted);
ui.applyLang();
ui.showTitle();
ui.updateBest(best);
renderer.render(run, view);
requestAnimationFrame(loop);

// ---------- 标准调试契约 ----------
const tutorialApi = {
  get active() { return tutorial.active; },
  get step() { return tutorial.step; },
  get steps() { return TUT_STEPS.slice(); },
  get current() { return tutorial.current; },
  skip: () => dismissTutorial(),
};

window.__ll = {
  get state() { return { phase, lang: ui.lang, dir: ui.dir }; },
  start: () => startGame(),
  pause: pauseGame,
  resume: resumeGame,
  restart: goTitle,
  startAct: (n) => startGame(n),
  get run() { return run; },
  tutorial: tutorialApi,
  startTutorial: () => activateTutorial(false),
  save: () => Sdk,
  ui: () => ui,
};

window.G = {
  get state() { return phase; },
  get run() { return run; },
  createRun: createRunDecorated,
  ui,
};

window.__ll.debug = {
  state() {
    if (!run) return null;
    return {
      round: run.round,
      task: run.task,
      timeLeft: run.timeLeft,
      score: run.score,
      combo: run.combo,
      items: run.items.length,
      finished: run.finished,
      roundsWon: run.roundsWon,
      roundsLost: run.roundsLost,
      stars: run.stars,
    };
  },
  // 贪心完成整局（供 verify / 截图走结算）
  solve() {
    if (!run || run.finished) return;
    let guard = 0;
    while (!run.finished && guard < 1000) {
      guard += 1;
      for (let i = 0; i < run.items.length; i += 1) {
        const it = run.items[i];
        if (it.odd && !it.oddResolved) { simTap(run, i); break; }
      }
      let did = false;
      for (let i = 0; i < run.items.length; i += 1) {
        const it = run.items[i];
        if (!it.collected && it.cat === run.task.cat && !(it.odd && !it.oddResolved)) {
          simTap(run, i);
          did = true;
          break;
        }
      }
      if (!did) break;
    }
  },
};
