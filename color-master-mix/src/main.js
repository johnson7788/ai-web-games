// COLOR MASTER MIX · 主入口：60Hz 固定步长 + letterbox + 流程状态机 + 教程 + 调试契约
import { STEP, WORLD, CONFIG, GAME } from '../config/game.config.js';
import { LEVELS } from '../config/shapes.js';
import { createRun } from './game/sim.js';
import { createRenderer } from './render/index.js';
import { ui } from './ui/ui.js';
import { i18n, syncDocumentLang } from './core/i18n.js';
import { createAudio } from './core/audio.js';
import Sdk from './core/sdk.js';

const canvas = document.getElementById('canvas');
const renderer = createRenderer(canvas);
const audio = createAudio();

// 存档：统一走 Sdk.save/load（localStorage 兜底在 sdk.js 内部）
let progress = Sdk.load('progress', { unlocked: 1, stars: [], tutorialDone: false, muted: false, bestStars: 0 });
if (!Array.isArray(progress.stars)) progress.stars = [];
progress.unlocked = Math.max(1, progress.unlocked || 1);

let run = createRun(0, { seed: 1 });
run.drainEvents(); // 丢弃 levelStart，等 startRun 再重建

let phase = 'title'; // title | playing | paused | result
let levelIndex = 0;
let hoverId = -1;
let accumulator = 0;
let lastTime = performance.now();
let muted = !!progress.muted;

// ---------- 教程状态机 ----------
const TUT_STEPS = [
  { id: 'pick', titleKey: 'tutTitle', textKey: 'tutStep1', target: '#palette .swatch[data-family="0"][data-shade="7"]' },
  { id: 'paint', titleKey: 'tutTitle', textKey: 'tutStep2', target: '#canvas' },
  { id: 'rock', titleKey: 'tutTitle', textKey: 'tutStep3', target: '#hud-combo' },
  { id: 'finish', titleKey: 'tutTitle', textKey: 'tutStep4', target: '#btn-magic' },
];
const tutorial = {
  active: false,
  step: 0,
  stepIds: TUT_STEPS.map((s) => s.id),
  get current() { return TUT_STEPS[this.step]?.id || null; },
};

function tutorialRender() {
  const s = TUT_STEPS[tutorial.step];
  ui.showTutorial(i18n.get(s.titleKey), i18n.get(s.textKey), s.target);
}

function startTutorial() {
  tutorial.active = true;
  tutorial.step = 0;
  tutorialRender();
}

function endTutorial(persist) {
  tutorial.active = false;
  ui.hideTutorial();
  if (persist) {
    progress.tutorialDone = true;
    Sdk.save('progress', progress);
  }
}

function tutorialNext() {
  if (tutorial.step >= TUT_STEPS.length - 1) { endTutorial(true); return; }
  tutorial.step += 1;
  tutorialRender();
}

function tutorialSkip() {
  endTutorial(true);
}

// ---------- 存档 / 进度 ----------
function saveProgress() {
  Sdk.save('progress', progress);
}

// ---------- 流程 ----------
function startRun(idx) {
  levelIndex = Math.max(0, Math.min(idx, LEVELS.length - 1));
  run = createRun(levelIndex, { seed: (Date.now() % 100000) + 1 });
  hoverId = -1;
  accumulator = 0;
  phase = 'playing';
  ui.showGame();
  ui.updateHUD(run.getHud());
  ui.buildGoalPreview(run);
  ui.highlightSelected(ui._selFamily, ui._selShade);
  audio.unlock();
  audio.startBgm();
  Sdk.newRun();
  if (levelIndex === 0 && !progress.tutorialDone) {
    startTutorial();
  }
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

function goHome() {
  phase = 'title';
  tutorial.active = false;
  ui.hideTutorial();
  ui.showTitle();
  ui.setLevelStars(progress.stars);
  renderer.render(null, phase);
}

function restartRun() {
  startRun(levelIndex);
}

function nextLevel() {
  startRun(levelIndex + 1);
}

function handleSimEvent(e) {
  if (e.type === 'win') {
    phase = 'result';
    const hud = run.getHud();
    ui.showResult(true, hud);
    Sdk.levelCleared({ level: hud.level, stars: hud.stars, score: hud.score });
    progress.stars[levelIndex] = Math.max(progress.stars[levelIndex] || 0, hud.stars);
    progress.unlocked = Math.max(progress.unlocked, levelIndex + 2);
    progress.bestStars = progress.stars.reduce((a, b) => a + (b || 0), 0);
    saveProgress();
  } else if (e.type === 'lose') {
    phase = 'result';
    ui.showResult(false, run.getHud());
    Sdk.gameOver({ level: run.getHud().level, score: run.getHud().score });
  }
}

// ---------- 输入 ----------
function logicalFromEvent(e) {
  const rect = canvas.getBoundingClientRect();
  const lx = ((e.clientX - rect.left) / rect.width) * WORLD.WIDTH;
  const ly = ((e.clientY - rect.top) / rect.height) * WORLD.HEIGHT;
  return { lx, ly };
}

function regionAt(lx, ly) {
  const g = renderer.geometry(run);
  for (const r of run.regions) {
    const rect = renderer.cellRect(run, r, g);
    if (lx >= rect.x && lx <= rect.x + rect.w && ly >= rect.y && ly <= rect.y + rect.h) return r.id;
  }
  return -1;
}

canvas.addEventListener('pointerdown', (e) => {
  if (phase !== 'playing') return;
  const { lx, ly } = logicalFromEvent(e);
  const id = regionAt(lx, ly);
  if (id >= 0) run.tap(id);
});

canvas.addEventListener('pointermove', (e) => {
  if (phase !== 'playing') { hoverId = -1; return; }
  const { lx, ly } = logicalFromEvent(e);
  hoverId = regionAt(lx, ly);
});
canvas.addEventListener('pointerleave', () => { hoverId = -1; });

function onPick(f, s) {
  ui.highlightSelected(f, s);
  if (run) { run.selectFamily(f); run.selectShade(s); }
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
    e.preventDefault();
  } else if (e.code === 'KeyR') {
    restartRun();
  } else if (e.code === 'KeyN' && phase === 'result') {
    nextLevel();
  } else if (e.code === 'KeyU' && phase === 'playing') {
    run.undo();
  } else if (e.code === 'KeyM') {
    muted = !muted;
    audio.setMuted(muted);
    ui.setMuteIcon(muted);
    progress.muted = muted;
    saveProgress();
  } else if (e.code === 'KeyH' && (phase === 'playing' || phase === 'title')) {
    startTutorial();
  }
});

// UI 事件绑定
ui.buildPalette(onPick);
ui._onLevelClick = (i) => { if (i < progress.unlocked) { startRun(i); } };

ui.btnStart.addEventListener('click', () => startRun(0));
ui.btnResume.addEventListener('click', resumeGame);
ui.btnRestart2.addEventListener('click', restartRun);
ui.btnHome3.addEventListener('click', goHome);
ui.btnTutReplay.addEventListener('click', startTutorial);
ui.btnRetry.addEventListener('click', restartRun);
ui.btnNext.addEventListener('click', nextLevel);
ui.btnHome2.addEventListener('click', goHome);
ui.btnRestart.addEventListener('click', restartRun);
ui.btnHome.addEventListener('click', goHome);
ui.btnHowto.addEventListener('click', startTutorial);
ui.btnHowtoTitle.addEventListener('click', startTutorial);
ui.btnUndo.addEventListener('click', () => { if (phase === 'playing') run.undo(); });
ui.btnMagic.addEventListener('click', () => { if (phase === 'playing') run.magicFill(); });
ui.btnMute.addEventListener('click', () => {
  muted = !muted;
  audio.setMuted(muted);
  ui.setMuteIcon(muted);
  progress.muted = muted;
  saveProgress();
});
ui.tutNext.addEventListener('click', tutorialNext);
ui.tutSkip.addEventListener('click', tutorialSkip);
for (const sel of [ui.langSelect, ui.langSelectPause]) {
  sel.addEventListener('change', (e) => ui.setLang(e.target.value));
}

// ---------- letterbox ----------
function fit() {
  const s = Math.min(window.innerWidth / WORLD.WIDTH, window.innerHeight / WORLD.HEIGHT);
  const el = document.getElementById('game-container');
  el.style.transform = `scale(${s})`;
  el.style.transformOrigin = 'center center';
}
window.addEventListener('resize', fit);
fit();

// prefers-reduced-motion
const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
renderer.setReducedMotion(mq.matches);
if (mq.addEventListener) mq.addEventListener('change', (e) => renderer.setReducedMotion(e.matches));

// ---------- 主循环（60Hz 固定步长）----------
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  if (phase === 'playing' && !tutorial.active) {
    accumulator += dt;
    while (accumulator >= STEP) {
      run.step(STEP);
      accumulator -= STEP;
    }
  } else {
    accumulator = 0;
  }

  const events = run.drainEvents();
  for (const e of events) {
    audio.event(e.type, e);
    renderer.onEvent(e, run);
    handleSimEvent(e);
  }

  renderer.render(run, phase, { hoverId, dt });
  if (phase === 'playing') ui.updateHUD(run.getHud());
}

// 初始化
Sdk.ready().catch(() => {});
audio.setMuted(muted);
ui.setMuteIcon(muted);
ui.buildTitlePreview();
ui.buildLevelGrid(progress.unlocked);
ui.applyLang();
ui.setLevelStars(progress.stars);
ui.showTitle();
renderer.render(null, phase);
requestAnimationFrame(loop);

// ---------- 标准调试契约 ----------
window.G = {
  run: () => run,
  state: () => phase,
  ui,
  save: Sdk,
  audio,
  createRun: (lv = 0) => createRun(lv, { seed: 1 }),
};

window.__ll = {
  get state() { return { phase, lang: ui.lang, dir: ui.dir }; },
  lang: () => ui.lang,
  setLang: (lang) => ui.setLang(lang),
  get run() { return run; },
  start: (lv = 0) => startRun(lv),
  startAct: (lv = 0) => startRun(lv),
  pause: pauseGame,
  resume: resumeGame,
  restart: restartRun,
  home: goHome,
  save: () => Sdk,
  ui: () => ui,
  tutorial: {
    get active() { return tutorial.active; },
    get step() { return tutorial.step; },
    get steps() { return tutorial.stepIds.slice(); },
    get current() { return tutorial.current; },
    skip: tutorialSkip,
    next: tutorialNext,
  },
  startTutorial,
  debug: {
    state: () => run.getHud(),
    regions: () => run.regions.map((r) => ({ id: r.id, r: r.r, c: r.c, locked: r.locked, unlocked: r.unlocked, colored: r.colored, color: r.color })),
    fillAll: () => {
      // 按可解锁顺序把整张图涂满（供验收/截图）
      let guard = 0;
      while (run.state.phase === 'playing' && guard < 500) {
        const t = run.regions.find((r) => !r.colored && r.unlocked);
        if (!t) break;
        run.tap(t.id);
        guard += 1;
      }
      return run.getHud();
    },
    loadLevel: (i) => startRun(i),
  },
};
