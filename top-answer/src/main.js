// 主入口：TOP ANSWER。状态机 title → playing ⇄ paused → clear（回合制）。
// 输入猜测 → 双语匹配 → 揭示答案 → 回合结算。
import { WORLD, COLORS, RULES, CONFIG } from '../config/game.config.js';
import { QUESTIONS } from '../config/questions.js';
import {
  createRun, submitGuess, useHint, revealAll, getHud, drainEvents, QUESTION_COUNT,
} from './game/sim.js';
import { createRenderer } from './render/index.js';
import { ui } from './ui/ui.js';
import { audio } from './audio.js';
import Sdk from './core/sdk.js';
import { t, i18n } from './core/i18n.js';

const canvas = document.getElementById('canvas');
const renderer = createRenderer(canvas);

let roundIndex = 0;
let totalScore = 0;
let run = createRun({ questionIndex: 0, seed: 1 });
let state = 'title';
let best = Sdk.load('best', 0);
let lastTime = performance.now();

const llState = { phase: 'title', lang: ui.lang, dir: ui.dir };

function syncLl() {
  llState.phase = state;
  llState.lang = ui.lang;
  llState.dir = ui.dir;
}
function displayScore() {
  return totalScore + (run.phase === 'playing' ? run.score : 0);
}
function syncUi() {
  ui.updateHUD({ round: roundIndex + 1, score: displayScore(), best });
  ui.updateHint(RULES.hintLimit - run.hintsUsed);
}
function renderBoard() {
  ui.renderBoard(run.answers, i18n.lang);
}
function answerLabel(a) {
  return i18n.lang === 'zh' ? a.zh : a.en;
}

// ---- 事件 → 表现 ---------------------------------------------------------
function processEvents() {
  for (const ev of drainEvents(run)) {
    if (ev.type === 'found') {
      audio.found(ev.index);
      renderer.confetti(16);
      const a = run.answers[ev.index];
      ui.setFeedback(`+${ev.points}  ${answerLabel(a)}`, 'good');
      Sdk.track('answer_found', { points: ev.points });
    } else if (ev.type === 'clear') {
      onRoundClear(ev.giveup);
    } else if (ev.type === 'hint') {
      audio.hint();
    }
  }
}

function doGuess() {
  if (state !== 'playing') return;
  const text = ui.getInput();
  const r = submitGuess(run, text);
  ui.clearInput();
  if (r.kind === 'miss') {
    audio.miss();
    ui.setFeedback(t('miss'), 'bad');
  } else if (r.kind === 'already') {
    audio.click();
    ui.setFeedback(t('already'), 'warn');
  } else if (r.kind === 'empty') {
    ui.setFeedback('', '');
  }
  processEvents();
  renderBoard();
  syncUi();
  ui.focusInput();
}

// ---- 状态机 --------------------------------------------------------------
function startRound(idx) {
  roundIndex = idx;
  run = createRun({ questionIndex: idx, seed: Math.floor(Math.random() * 0x7fffffff) });
  state = 'playing';
  syncLl();
  ui.showGame();
  ui.setQuestion(run.question.prompt[i18n.lang] || run.question.prompt.en);
  ui.setFeedback('', '');
  renderBoard();
  syncUi();
  ui.clearInput();
  ui.focusInput();
  lastTime = performance.now();
}
function startGame() {
  totalScore = 0;
  Sdk.newRun({ mode: 'rounds' });
  startRound(0);
}
function nextRound() {
  if (roundIndex >= QUESTION_COUNT - 1) startGame();
  else startRound(roundIndex + 1);
}
function backToTitle() {
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
  ui.focusInput();
  lastTime = performance.now();
}
function onRoundClear(giveup) {
  state = 'clear';
  syncLl();
  totalScore += run.score;
  if (totalScore > best) {
    best = totalScore;
    Sdk.save('best', best);
  }
  Sdk.levelCleared({ round: roundIndex + 1, score: totalScore, giveup: !!giveup });
  const isLast = roundIndex >= QUESTION_COUNT - 1;
  ui.showClear(totalScore, isLast, giveup);
  renderer.confetti(70);
  audio.clear();
}
function doHint() {
  const h = useHint(run);
  if (h) {
    processEvents();
    renderBoard();
  } else {
    ui.setFeedback(t('noHints'), 'warn');
  }
  syncUi();
  ui.focusInput();
}
function doReveal() {
  revealAll(run);
  processEvents();
  renderBoard();
  syncUi();
}
function doMute() {
  audio.setMuted(!audio.muted);
  Sdk.save('muted', audio.muted);
  ui.updateMute(audio.muted);
}

// ---- 输入 ----------------------------------------------------------------
ui.btnGuess.addEventListener('click', () => { audio.unlock(); doGuess(); });
ui.answerInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); doGuess(); }
  e.stopPropagation(); // 输入时不触发全局快捷键
});

window.addEventListener('keydown', (e) => {
  if (document.activeElement === ui.answerInput) return;
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (state === 'playing') pauseGame();
    else if (state === 'paused') resumeGame();
  }
});
window.addEventListener('blur', () => { if (state === 'playing') pauseGame(); });

// ---- 按钮 ----------------------------------------------------------------
ui.btnStart.addEventListener('click', () => { audio.unlock(); startGame(); });
ui.btnResume.addEventListener('click', resumeGame);
ui.btnRestart.addEventListener('click', () => startRound(roundIndex));
ui.btnNext.addEventListener('click', nextRound);
ui.btnTitle.addEventListener('click', backToTitle);
ui.btnHint.addEventListener('click', doHint);
ui.btnReveal.addEventListener('click', doReveal);
ui.btnMute.addEventListener('click', doMute);
ui.btnPause.addEventListener('click', () => { if (state === 'playing') pauseGame(); });
for (const sel of ui.langSelects) {
  if (sel) sel.addEventListener('change', (e) => {
    ui.setLang(e.target.value);
    syncLl();
    if (state === 'playing' || state === 'paused') {
      ui.setQuestion(run.question.prompt[i18n.lang] || run.question.prompt.en);
      renderBoard();
    }
  });
}

Sdk.onAdStart(() => pauseGame());
Sdk.onAdEnd(() => resumeGame());

// ---- 主循环 --------------------------------------------------------------
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  renderer.update(dt);
  renderer.render();
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
  startAct: (n) => { totalScore = 0; startRound(n || 0); },
  sim: run,
  save: (k, v) => Sdk.save(k, v),
  load: (k, d) => Sdk.load(k, d),
  ui: () => ui,
  debug: {
    state: () => ({ ...getHud(run), totalScore, answers: run.answers.map((a) => ({ en: a.en, revealed: a.revealed })) }),
    guess: (text) => { const r = submitGuess(run, text); processEvents(); renderBoard(); syncUi(); return r; },
    hint: () => { const h = useHint(run); processEvents(); renderBoard(); syncUi(); return h; },
    reveal: () => { revealAll(run); processEvents(); renderBoard(); syncUi(); },
    solveRound: () => {
      for (const a of run.answers) {
        if (!a.revealed) submitGuess(run, a.en);
      }
      processEvents();
      renderBoard();
      syncUi();
      return getHud(run);
    },
    setRound: (n) => startRound(n),
  },
};