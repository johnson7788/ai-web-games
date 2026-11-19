// BEAR DASH RUN · 主入口：60Hz 固定步长 + 标题→游玩→暂停→结算 + i18n + SDK + 教程 + 标准调试契约
import { STEP } from '../config/game.config.js';
import { createRun, updateRun } from './game/sim.js';
import { createRenderer } from './render/index.js';
import { ui, applyRotateText, TUT_STEPS, t } from './ui/ui.js';
import { i18n } from './core/i18n.js';
import { save } from './core/save.js';
import { createAudio } from './core/audio.js';
import Sdk from './core/sdk.js';

const canvas = document.getElementById('canvas');
const renderer = createRenderer(canvas);
const audio = createAudio();

let run = null;
let previewRun = createRun(0);   // 标题屏静态预览场景
let phase = 'title';             // title | playing | paused | result
let levelIndex = 0;
let lastWin = false;
let lastStars = 0;
let lastScore = 0;
let lastTime = 0;
let accumulator = 0;
let tutorialStep = -1;
let tutorialDone = !!save.get('tutorialDone', false);

const input = { left: false, right: false, jump: false };

function $id(id) { return document.getElementById(id); }

// ---------- 输入 ----------
window.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') input.left = true;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') input.right = true;
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') { input.jump = true; e.preventDefault(); }
  if (e.code === 'Escape') {
    if (phase === 'playing') { phase = 'paused'; ui.showPause(); }
    else if (phase === 'paused') { phase = 'playing'; ui.hidePause(); lastTime = performance.now(); }
  }
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') input.left = false;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') input.right = false;
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') input.jump = false;
});

function bindTouch(btn, key, isJump) {
  if (!btn) return;
  const on = (e) => { e.preventDefault(); audio.unlock(); if (isJump) input.jump = true; else input[key] = true; };
  const off = (e) => { e.preventDefault(); if (isJump) input.jump = false; else input[key] = false; };
  btn.addEventListener('pointerdown', on);
  btn.addEventListener('pointerup', off);
  btn.addEventListener('pointercancel', off);
  btn.addEventListener('pointerleave', off);
}
bindTouch($id('btn-left'), 'left', false);
bindTouch($id('btn-right'), 'right', false);
bindTouch($id('btn-jump'), 'jump', true);

// ---------- 教程 ----------
function renderTutorial() {
  const el = $id('tutorial');
  if (tutorialStep < 0) { el.classList.add('hidden'); return; }
  const steps = TUT_STEPS();
  const s = steps[tutorialStep];
  el.classList.remove('hidden');
  $id('tut-title').textContent = t('tutTitle');
  $id('tut-text').textContent = s ? s.text : '';
  $id('tut-skip').textContent = t('tutSkip');
  $id('tut-next').textContent = t('tutNext');
}

function startTutorial() {
  tutorialStep = 0;
  renderTutorial();
}

function endTutorial() {
  tutorialStep = -1;
  tutorialDone = true;
  save.set('tutorialDone', true);
  renderTutorial();
}

function tutorialNext() {
  tutorialStep += 1;
  if (tutorialStep >= TUT_STEPS().length) endTutorial();
  else renderTutorial();
}

// ---------- 游戏流程 ----------
function startGame(idx = 0) {
  levelIndex = Math.max(0, Math.min(2, idx));
  run = createRun(levelIndex);
  phase = 'playing';
  ui.showGame();
  Sdk.newRun({ level: levelIndex + 1 });
  audio.unlock();
  audio.startBgm();
  lastTime = performance.now();
  accumulator = 0;
}

function startFromTitle() {
  startGame(0);
  if (!tutorialDone) startTutorial();
}

function pauseGame() {
  if (phase === 'playing') { phase = 'paused'; ui.showPause(); }
}

function resumeGame() {
  if (phase === 'paused') { phase = 'playing'; ui.hidePause(); lastTime = performance.now(); }
}

function restartGame() {
  phase = 'title';
  run = null;
  ui.showTitle();
  applyRotateText();
}

function finishRun(win, stars, score) {
  lastWin = win;
  lastStars = stars;
  lastScore = score;
  const best = save.get('best', 0);
  if (win && score > best) { save.set('best', score); ui.updateBest(score); }
  else ui.updateBest(best);
  phase = 'result';
  audio.stopBgm();
  ui.showResult(win, stars, score);
  if (win) Sdk.levelCleared({ level: levelIndex + 1, stars, score });
  else Sdk.gameOver({ level: levelIndex + 1, score });
}

function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    if (ev.type === 'win') { finishRun(true, ev.stars, ev.score); return; }
    if (ev.type === 'lose') { finishRun(false, 0, ev.score); return; }
  }
}

// ---------- UI 绑定 ----------
ui.btnStart.addEventListener('click', startFromTitle);
ui.btnResume.addEventListener('click', resumeGame);
ui.btnRestart.addEventListener('click', () => { startGame(levelIndex); });
ui.btnHome.addEventListener('click', restartGame);
ui.btnHome2.addEventListener('click', restartGame);
ui.btnRetry.addEventListener('click', () => { startGame(levelIndex); });
ui.btnNext.addEventListener('click', () => { startGame(Math.min(2, levelIndex + 1)); });
ui.btnMute.addEventListener('click', () => {
  const m = audio.setMuted(!(ui.btnMute.dataset.muted === '1'));
  ui.btnMute.dataset.muted = m ? '1' : '0';
  ui.btnMute.textContent = m ? '🔇' : '🔊';
});
for (const sel of ui.langSelects) if (sel) sel.addEventListener('change', (e) => { ui.setLang(e.target.value); applyRotateText(); });

$id('tut-skip').addEventListener('click', endTutorial);
$id('tut-next').addEventListener('click', tutorialNext);
document.querySelectorAll('[data-tutorial-replay]').forEach((b) => b.addEventListener('click', startTutorial));

// ---------- 主循环 ----------
function loop(now) {
  requestAnimationFrame(loop);
  const t = (now / 1000);

  if (phase === 'playing' && run) {
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;
    accumulator += dt;
    while (accumulator >= STEP) {
      updateRun(run, input);
      accumulator -= STEP;
      const evs = run.drainEvents();
      handleEvents(evs);
      if (phase !== 'playing') break;
    }
    ui.updateHUD(run.state.level, run.state.score, run.state.stars, run.state.combo);
    renderer.render({ phase, run, time: t });
    return;
  }

  if (phase === 'title') {
    renderer.render({ phase, run: previewRun, time: t });
  } else if (phase === 'paused' && run) {
    renderer.render({ phase, run, time: t });
  } else if (phase === 'result' && run) {
    renderer.render({ phase, run, time: t });
  }
}

// ---------- 初始化 ----------
Sdk.ready(); // 触发本地 SDK 注入（PipyGames/GameSDK 门面）
ui.btnMute.textContent = '🔊';
ui.applyLang();
ui.showTitle();
applyRotateText();
ui.updateBest(save.get('best', 0));
renderer.render({ phase, run: previewRun, time: 0 });
requestAnimationFrame(loop);

// ---------- 标准调试契约 ----------
window.G = { sim: () => run, state: () => phase, ui, save, createRun };

window.__ll = {
  get state() { return { phase, lang: ui.lang, dir: ui.dir }; },
  lang: () => ui.lang,
  setLang: (lang) => ui.setLang(lang),
  get run() { return run; },
  start: (idx) => startGame(idx ?? 0),
  pause: pauseGame,
  resume: resumeGame,
  restart: restartGame,
  startAct: (idx) => startGame(idx ?? 0),
  startTutorial: () => startTutorial(),
  save: () => save,
  ui: () => ui,
  finish: (win, stars, score) => finishRun(win, stars, score),
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return TUT_STEPS().map((s) => s.text); },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
};
