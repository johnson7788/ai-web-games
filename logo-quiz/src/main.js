// 主入口：LOGO QUIZ。状态机 title → playing ⇄ paused → done。
import { WORLD, COLORS, RULES, CONFIG } from '../config/game.config.js';
import { createRun, answer, next, getHud, drainEvents } from './game/sim.js';
import { createRenderer } from './render/index.js';
import { ui } from './ui/ui.js';
import { audio } from './audio.js';
import Sdk from './core/sdk.js';
import { t } from './core/i18n.js';

const canvas = document.getElementById('canvas');
const renderer = createRenderer(canvas);

let run = createRun({ seed: 1 });
let state = 'title';
let best = Sdk.load('best', 0);
let lastTime = performance.now();
let advanceTimer = null;

const llState = { phase: 'title', lang: ui.lang, dir: ui.dir };

function syncLl() {
  llState.phase = state;
  llState.lang = ui.lang;
  llState.dir = ui.dir;
}
function syncUi() {
  ui.updateHUD(getHud(run));
  ui.renderOptions(run.current.options, run.phase, run.lastResult);
}

// ---- 事件 → 表现 ---------------------------------------------------------
function processEvents() {
  for (const ev of drainEvents(run)) {
    if (ev.type === 'answer') {
      if (ev.correct) {
        audio.correct();
        renderer.flashResult(true);
        ui.setFeedback(t('correct'), 'good');
      } else {
        audio.wrong();
        renderer.flashResult(false);
        ui.setFeedback(t('wrong'), 'bad');
      }
      Sdk.track('answer', { correct: ev.correct });
    } else if (ev.type === 'done') {
      onDone();
    }
  }
}

function doAnswer(idx) {
  if (state !== 'playing' || run.phase !== 'question') return;
  answer(run, idx);
  processEvents();
  syncUi();
  clearTimeout(advanceTimer);
  advanceTimer = setTimeout(() => {
    if (state !== 'playing') return;
    next(run);
    processEvents();
    if (run.phase !== 'done') {
      ui.setFeedback('', '');
      syncUi();
    }
  }, 1000);
}

// ---- 状态机 --------------------------------------------------------------
function startGame() {
  clearTimeout(advanceTimer);
  run = createRun({ seed: Math.floor(Math.random() * 0x7fffffff) });
  renderer.clearEffects();
  state = 'playing';
  syncLl();
  Sdk.newRun({ mode: 'logoquiz' });
  ui.showGame();
  ui.setFeedback('', '');
  syncUi();
  lastTime = performance.now();
}
function backToTitle() {
  clearTimeout(advanceTimer);
  state = 'title';
  syncLl();
  ui.showTitle();
  ui.updateBest(best);
}
function pauseGame() {
  if (state !== 'playing') return;
  state = 'paused';
  syncLl();
  ui.showPause();
}
function resumeGame() {
  if (state !== 'paused') return;
  state = 'playing';
  syncLl();
  ui.hidePause();
  lastTime = performance.now();
}
function onDone() {
  state = 'done';
  syncLl();
  if (run.score > best) { best = run.score; Sdk.save('best', best); }
  Sdk.levelCleared({ score: run.score });
  ui.showDone(run.score);
  audio.complete();
}
function doMute() {
  audio.setMuted(!audio.muted);
  Sdk.save('muted', audio.muted);
  ui.updateMute(audio.muted);
}

// ---- 输入 ----------------------------------------------------------------
ui.options.addEventListener('click', (e) => {
  const btn = e.target.closest('.opt-btn');
  if (!btn || btn.disabled) return;
  audio.unlock();
  doAnswer(Number(btn.dataset.idx));
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (state === 'playing') pauseGame();
    else if (state === 'paused') resumeGame();
    return;
  }
  if (state === 'playing' && run.phase === 'question') {
    const n = Number(e.key);
    if (n >= 1 && n <= 4) doAnswer(n - 1);
  }
});
window.addEventListener('blur', () => { if (state === 'playing') pauseGame(); });

// ---- 按钮 ----------------------------------------------------------------
ui.btnStart.addEventListener('click', () => { audio.unlock(); startGame(); });
ui.btnResume.addEventListener('click', resumeGame);
ui.btnRestart.addEventListener('click', startGame);
ui.btnAgain.addEventListener('click', startGame);
ui.btnTitle.addEventListener('click', backToTitle);
ui.btnMute.addEventListener('click', doMute);
ui.btnPause.addEventListener('click', () => { if (state === 'playing') pauseGame(); });
for (const sel of ui.langSelects) {
  if (sel) sel.addEventListener('change', (e) => { ui.setLang(e.target.value); syncLl(); });
}

Sdk.onAdStart(() => pauseGame());
Sdk.onAdEnd(() => resumeGame());

// ---- 主循环 --------------------------------------------------------------
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  renderer.update(dt);
  renderer.render({ run });
}

// ---- 初始化 --------------------------------------------------------------
Sdk.ready();
audio.setMuted(Sdk.load('muted', false));
ui.applyLang();
ui.showTitle();
ui.updateBest(best);
ui.updateMute(audio.muted);
syncLl();
syncUi();
requestAnimationFrame(loop);

// ---- 调试契约 ------------------------------------------------------------
window.G = { run: () => run, state: () => state, ui };

window.__ll = {
  state: llState,
  start: startGame,
  pause: pauseGame,
  resume: resumeGame,
  restart: backToTitle,
  startAct: startGame,
  sim: run,
  save: (k, v) => Sdk.save(k, v),
  load: (k, d) => Sdk.load(k, d),
  ui: () => ui,
  debug: {
    state: () => getHud(run),
    answer: (i) => { answer(run, i); processEvents(); syncUi(); return getHud(run); },
    answerCorrect: () => { answer(run, run.current.correct); processEvents(); syncUi(); return getHud(run); },
    next: () => { next(run); processEvents(); if (run.phase !== 'done') syncUi(); return getHud(run); },
    playAll: () => {
      let guard = 0;
      while (run.phase !== 'done' && guard < 100) {
        if (run.phase === 'question') answer(run, run.current.correct);
        else if (run.phase === 'reveal') next(run);
        processEvents();
        guard += 1;
      }
      syncUi();
      return getHud(run);
    },
  },
};