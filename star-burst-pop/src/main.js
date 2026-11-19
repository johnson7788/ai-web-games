// 主入口：60Hz 固定步长 + 标题→玩法→结算 + 教程 + i18n + SDK + 标准调试契约
import { STEP, WORLD, LAYOUT, GAME } from '../config/game.config.js';
import { createSim, select, pop, tick, drainEvents, getHud } from './game/sim.js';
import { createRenderer } from './render/index.js';
import { ui } from './ui/ui.js';
import { t } from './core/i18n.js';
import { save } from './core/save.js';
import { Sdk } from './core/sdk.js';
import { createAudio } from './core/audio.js';

const canvas = ui.canvas;
const renderer = createRenderer(canvas);
const audio = createAudio();

const TUTORIAL_STEPS = [
  { key: 'tut1', title: () => t('tut1Title'), text: () => t('tut1Text') },
  { key: 'tut2', title: () => t('tut2Title'), text: () => t('tut2Text') },
  { key: 'tut3', title: () => t('tut3Title'), text: () => t('tut3Text') },
  { key: 'tut4', title: () => t('tut4Title'), text: () => t('tut4Text') },
];

const tutorial = {
  active: false,
  step: 0,
  steps: TUTORIAL_STEPS.map((s) => s.key),
  current: null,
  skip() { finishTutorial(); },
};

let phase = 'title'; // title | playing | paused | result
let sim = createSim();
let lastTime = 0;
let accumulator = 0;
let totalStars = 0;
let bestScore = save.get('best', 0);

if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) {
  renderer.setReducedMotion(true);
}

// ---------- 教程 ----------
function renderTutorialStep() {
  const s = TUTORIAL_STEPS[tutorial.step];
  tutorial.current = s.key;
  ui.renderTutorial({ title: s.title(), text: s.text() });
}

function startTutorial() {
  tutorial.active = true;
  tutorial.step = 0;
  renderTutorialStep();
  ui.setTutorialVisible(true);
}

function finishTutorial() {
  tutorial.active = false;
  ui.setTutorialVisible(false);
  save.set('tutorialDone', true);
}

function tutorialNext() {
  if (!tutorial.active) return;
  if (tutorial.step + 1 >= TUTORIAL_STEPS.length) {
    finishTutorial();
  } else {
    tutorial.step += 1;
    renderTutorialStep();
  }
}

// ---------- 状态切换 ----------
function startGame(skipTutorial = false) {
  sim = createSim();
  totalStars = 0;
  phase = 'playing';
  ui.showGame();
  audio.unlock();
  audio.startBgm();
  Sdk.newRun({ level: 1 });
  lastTime = performance.now();
  accumulator = 0;
  if (!skipTutorial && !save.get('tutorialDone')) startTutorial();
}

function retry() {
  startGame(true);
}

function pauseGame() {
  if (phase === 'playing') {
    phase = 'paused';
    ui.showPause();
    audio.stopBgm();
  }
}

function resumeGame() {
  if (phase === 'paused') {
    phase = 'playing';
    ui.hidePause();
    audio.startBgm();
    lastTime = performance.now();
  }
}

function goTitle() {
  phase = 'title';
  sim = createSim();
  ui.showTitle();
  audio.stopBgm();
  ui.bestValue.textContent = String(bestScore);
}

function finishCampaign() {
  phase = 'result';
  const score = sim.score;
  const newBest = score > bestScore;
  if (newBest) {
    bestScore = score;
    save.set('best', bestScore);
  }
  ui.renderResult(totalStars, score, bestScore, newBest);
  ui.showResult();
  audio.stopBgm();
  Sdk.track('campaign_complete', { score, stars: totalStars });
}

// ---------- 输入 ----------
function cellFromEvent(e) {
  const rect = canvas.getBoundingClientRect();
  const sx = WORLD.WIDTH / rect.width;
  const sy = WORLD.HEIGHT / rect.height;
  const px = (e.clientX - rect.left) * sx;
  const py = (e.clientY - rect.top) * sy;
  const col = Math.floor((px - LAYOUT.BOARD_X) / LAYOUT.CELL);
  const row = (GAME.GRID - 1) - Math.floor((py - LAYOUT.BOARD_Y) / LAYOUT.CELL);
  if (col < 0 || col >= GAME.GRID || row < 0 || row >= GAME.GRID) return null;
  return [col, row];
}

canvas.addEventListener('pointerdown', (e) => {
  if (phase !== 'playing' || tutorial.active) return;
  audio.unlock();
  const cell = cellFromEvent(e);
  if (!cell) return;
  const [x, y] = cell;
  if (sim.selected && sim.selected.some(([cx, cy]) => cx === x && cy === y)) {
    const cells = sim.selected.slice();
    const type = sim.grid[cells[0][0]][cells[0][1]];
    pop(sim);
    renderer.spawnPop(cells, type);
  } else {
    select(sim, x, y);
  }
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  } else if (e.code === 'KeyR') {
    retry();
  } else if (e.code === 'KeyM') {
    toggleMute();
  }
});

function toggleMute() {
  const m = audio.setMuted(!ui.muted);
  ui.setMuted(m);
}

// ---------- UI 事件 ----------
ui.btnStart.addEventListener('click', () => startGame());
ui.btnResume.addEventListener('click', resumeGame);
ui.btnRestart.addEventListener('click', retry);
ui.btnHome.addEventListener('click', goTitle);
ui.btnHome2.addEventListener('click', goTitle);
ui.btnRetry.addEventListener('click', retry);
ui.btnPause.addEventListener('click', pauseGame);
ui.btnMute.addEventListener('click', toggleMute);
ui.btnMute2.addEventListener('click', toggleMute);
ui.btnHowto.addEventListener('click', startTutorial);
ui.btnHowtoHud.addEventListener('click', startTutorial);
ui.btnHowtoPause.addEventListener('click', startTutorial);
ui.tutSkip.addEventListener('click', finishTutorial);
ui.tutNext.addEventListener('click', tutorialNext);
for (const sel of ui.langSelects) {
  if (sel) sel.addEventListener('change', (e) => ui.setLang(e.target.value));
}

// ---------- 主循环 ----------
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  if (phase === 'playing' && !tutorial.active) {
    accumulator += dt;
    while (accumulator >= STEP) {
      tick(sim, STEP);
      accumulator -= STEP;
    }
  }

  for (const e of drainEvents(sim)) {
    audio.event(e.type, e);
    renderer.onEvent(e);
    if (e.type === 'levelClear') {
      totalStars += e.stars || 0;
      Sdk.levelCleared({ level: e.level, score: e.score, stars: e.stars });
    }
  }

  if (phase === 'playing' && sim.phase === 'won') {
    finishCampaign();
  }

  renderer.render(phase === 'title' ? null : sim);

  if (phase === 'playing' || phase === 'paused') {
    ui.updateHUD(getHud(sim), bestScore);
  }
}

// ---------- 初始化 ----------
Sdk.ready(); // 不 await，不阻塞首屏（SDK 不可用时自动降级）
ui.applyLang();
ui.showTitle();
ui.bestValue.textContent = String(bestScore);
renderer.render(null);
requestAnimationFrame(loop);

// ---------- 标准调试契约 ----------
window.__ll = {
  get state() { return { phase, lang: ui.lang, dir: ui.dir }; },
  start: () => startGame(true),
  pause: pauseGame,
  resume: resumeGame,
  restart: goTitle,
  retry,
  get run() { return sim; },
  tutorial,
  startTutorial,
  save: () => save,
  ui: () => ui,
};
