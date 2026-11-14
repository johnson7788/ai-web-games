// 主入口：DUO QUIZ。状态机 boot → title → playing ⇄ paused → done。
// 双人同屏：P1 按键 1-4 / 左按钮，P2 按键 7-0 / 右按钮。
import { STEP, RULES } from '../config/game.config.js';
import { createRun, currentQuestion, answer, tick, next, getHud, drainEvents } from './game/sim.js';
import { createRenderer } from './render/index.js';
import { preload } from './render/art.js';
import { ui } from './ui/ui.js';
import { audio } from './audio.js';
import Sdk from './core/sdk.js';
import { t, i18n } from './core/i18n.js';

const canvas = document.getElementById('canvas');
const renderer = createRenderer(canvas);

let run = createRun({ seed: 1 });
let state = 'boot';
let lastTime = performance.now();
let accumulator = 0;
let lastWinner = -1;

const llState = { phase: 'boot', lang: ui.lang, dir: ui.dir };

function syncLl() {
  llState.phase = state;
  llState.lang = ui.lang;
  llState.dir = ui.dir;
}
function mascotExpr(player) {
  if (state === 'playing') {
    if (run.phase === 'reveal' && run.lastResult) {
      return run.lastResult.correct[player] ? 'correct' : 'wrong';
    }
    return 'neutral';
  }
  if (state === 'done') {
    if (lastWinner === -1) return 'neutral';
    return player === lastWinner ? 'win' : 'wrong';
  }
  return 'neutral';
}
function syncMascots() {
  ui.setMascot(0, mascotExpr(0));
  ui.setMascot(1, mascotExpr(1));
}
function refreshQuestion() {
  const q = currentQuestion(run);
  const lang = i18n.lang;
  ui.setQuestion(q.q[lang] || q.q.en);
  ui.setRound(run.round + 1, run.rounds);
  ui.setScores(run.scores);
  ui.renderOptions(q, lang, run.answers, run.phase, run.lastResult);
  if (run.phase === 'reveal' && run.lastResult) {
    const r = run.lastResult;
    const parts = [0, 1].map((p) => `${p === 0 ? t('p1') : t('p2')}: ${r.correct[p] ? '+' + r.points[p] : t('wrong')}`);
    ui.setReveal(true, parts.join('   '));
  } else {
    ui.setReveal(false, '');
  }
  syncMascots();
}

// ---- 事件 → 表现 ---------------------------------------------------------
function processEvents() {
  for (const ev of drainEvents(run)) {
    if (ev.type === 'answer') {
      audio.lock();
      refreshQuestion();
    } else if (ev.type === 'reveal') {
      if (ev.correct[0] || ev.correct[1]) audio.correct();
      else audio.wrong();
      refreshQuestion();
    } else if (ev.type === 'done') {
      onDone(ev.winner, ev.scores);
    }
  }
}

function doAnswer(player, idx) {
  if (state !== 'playing') return;
  answer(run, player, idx);
  processEvents();
}
function doNext() {
  if (state !== 'playing' || run.phase !== 'reveal') return;
  next(run);
  processEvents();
  if (run.phase !== 'done') refreshQuestion();
}

// ---- 状态机 --------------------------------------------------------------
function startGame() {
  run = createRun({ seed: Math.floor(Math.random() * 0x7fffffff) });
  lastWinner = -1;
  renderer.clearEffects();
  accumulator = 0;
  state = 'playing';
  renderer.setPhase(state);
  syncLl();
  Sdk.newRun({ mode: 'duo' });
  ui.showGame();
  refreshQuestion();
  lastTime = performance.now();
}
function backToTitle() {
  state = 'title';
  renderer.setPhase(state);
  syncLl();
  ui.showTitle();
}
function pauseGame() {
  if (state !== 'playing') return;
  state = 'paused';
  renderer.setPhase(state);
  syncLl();
  ui.showPause();
}
function resumeGame() {
  if (state !== 'paused') return;
  state = 'playing';
  renderer.setPhase(state);
  syncLl();
  ui.hidePause();
  lastTime = performance.now();
}
function onDone(winner, scores) {
  state = 'done';
  lastWinner = winner;
  renderer.setPhase(state);
  syncLl();
  Sdk.gameOver({ winner, scores });
  ui.showDone(winner, scores);
  renderer.confetti(80);
  syncMascots();
  audio.win();
}
function doMute() {
  audio.setMuted(!audio.muted);
  Sdk.save('muted', audio.muted);
  ui.updateMute(audio.muted);
}

// ---- 输入 ----------------------------------------------------------------
const onOptClick = (e) => {
  const btn = e.target.closest('.opt-btn');
  if (!btn || btn.disabled) return;
  audio.unlock();
  doAnswer(Number(btn.dataset.player), Number(btn.dataset.idx));
};
ui.p1Options.addEventListener('click', onOptClick);
ui.p2Options.addEventListener('click', onOptClick);

const P2_KEYS = { Digit7: 0, Digit8: 1, Digit9: 2, Digit0: 3 };
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (state === 'playing') pauseGame();
    else if (state === 'paused') resumeGame();
    return;
  }
  if (state !== 'playing') return;
  if (run.phase === 'question') {
    if (e.code.startsWith('Digit')) {
      const n = Number(e.code.slice(5));
      if (n >= 1 && n <= 4) doAnswer(0, n - 1);
      else if (P2_KEYS[e.code] !== undefined) doAnswer(1, P2_KEYS[e.code]);
    }
  } else if (run.phase === 'reveal') {
    if (e.code === 'Enter' || e.code === 'Space') { doNext(); e.preventDefault(); }
  }
});
window.addEventListener('blur', () => { if (state === 'playing') pauseGame(); });

// ---- 按钮 ----------------------------------------------------------------
ui.btnStart.addEventListener('click', () => { audio.unlock(); startGame(); });
ui.btnResume.addEventListener('click', resumeGame);
ui.btnRestart.addEventListener('click', startGame);
ui.btnAgain.addEventListener('click', startGame);
ui.btnTitle.addEventListener('click', backToTitle);
ui.btnNext.addEventListener('click', doNext);
ui.btnMute.addEventListener('click', doMute);
ui.btnPause.addEventListener('click', () => { if (state === 'playing') pauseGame(); });
for (const sel of ui.langSelects) {
  if (sel) sel.addEventListener('change', (e) => { ui.setLang(e.target.value); syncLl(); if (state === 'playing') refreshQuestion(); });
}

Sdk.onAdStart(() => pauseGame());
Sdk.onAdEnd(() => resumeGame());

// ---- 主循环 --------------------------------------------------------------
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  if (state === 'playing' && run.phase === 'question') {
    accumulator += dt;
    while (accumulator >= STEP) {
      tick(run, STEP);
      accumulator -= STEP;
    }
    processEvents();
    ui.setTimer(run.timer / RULES.roundTime);
  }
  renderer.update(dt);
  renderer.render();
}

// ---- 初始化 --------------------------------------------------------------
Sdk.ready();
audio.setMuted(Sdk.load('muted', false));
ui.applyLang();
renderer.setPhase('boot');
renderer.setLoading(0);
syncLl();
requestAnimationFrame(loop);

preload((p) => renderer.setLoading(p)).then(() => {
  renderer.setLoading(-1);
  state = 'title';
  renderer.setPhase(state);
  syncLl();
  ui.showTitle();
  ui.updateMute(audio.muted);
});

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
    answer: (player, idx) => { doAnswer(player, idx); return getHud(run); },
    next: () => { doNext(); return getHud(run); },
    answerCorrect: (player) => { doAnswer(player, currentQuestion(run).correct); return getHud(run); },
    playAll: () => {
      let guard = 0;
      while (run.phase !== 'done' && guard < 100) {
        if (run.phase === 'question') {
          doAnswer(0, currentQuestion(run).correct);
          doAnswer(1, (currentQuestion(run).correct + 1) % 4);
        } else if (run.phase === 'reveal') {
          doNext();
        }
        guard += 1;
      }
      return getHud(run);
    },
  },
};
