// 主入口：60Hz 固定步长 + 标题→游戏→暂停→结果 + i18n + SDK + 音频 + 标准调试契约。
import { STEP, QUIZ, CONFIG } from '../config/game.config.js';
import { QUESTIONS } from '../config/questions.js';
import { createRun } from './game/sim.js';
import { createRenderer } from './render/index.js';
import { ui } from './ui/ui.js';
import { i18n, t } from './core/i18n.js';
import Sdk from './core/sdk.js';
import { createAudio } from './core/audio.js';

const canvas = document.getElementById('canvas');
const renderer = createRenderer(canvas);
const audio = createAudio();

let run = createRun({ seed: 1 });
let phase = 'title'; // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let muted = !!Sdk.load('muted', false);
let tutorialDone = !!Sdk.load('tutorialDone', false);

const TUT_STEPS = ['tutStep1', 'tutStep2', 'tutStep3'];
const tut = { active: false, step: 0 };

// ---------- 音频 ----------
if (muted) audio.setMuted(true);
window.addEventListener('pointerdown', () => audio.unlock(), { once: true });

// ---------- 事件消费：sim 事件 → 音频 / 反馈 / 结算 ----------
function consumeEvents(events) {
  for (const e of events) {
    audio.event(e.type, e);
    if (e.type === 'answer_correct') ui.showFeedback(t('feedbackRight', { p: e.gain }), false);
    if (e.type === 'answer_wrong') ui.showFeedback(t('feedbackWrong'), true);
    if (e.type === 'win' || e.type === 'lose') endRun();
  }
}

function currentSceneKey() {
  return QUESTIONS[run.state.order[run.state.index]].scene;
}

// ---------- 状态流转 ----------
function startGame() {
  run = createRun({ seed: (Math.random() * 1e9) | 0 });
  phase = 'playing';
  accumulator = 0;
  ui.showGame();
  ui.renderQuestion(run);
  ui.updateHUD(run.getHud());
  Sdk.newRun({ mode: 'quiz' });
  Sdk.track('start', {});
  audio.startBgm();
  if (!tutorialDone) startTutorial();
}

function goHome() {
  phase = 'title';
  audio.stopBgm();
  ui.showTitle();
}

function pauseGame() {
  if (phase === 'playing') {
    phase = 'paused';
    audio.stopBgm();
    ui.showPause();
  }
}

function resumeGame() {
  if (phase === 'paused') {
    phase = 'playing';
    ui.hidePause();
    lastTime = performance.now();
    audio.startBgm();
  }
}

function endRun() {
  if (phase === 'result') return;
  phase = 'result';
  audio.stopBgm();
  const s = run.state;
  ui.renderResult(run);
  ui.showResult();
  if (s.won) {
    Sdk.levelCleared({ score: s.score, stars: s.stars });
    const best = Sdk.load('best', 0) | 0;
    if (s.score > best) Sdk.save('best', s.score);
  } else {
    Sdk.gameOver({ reason: s.reason });
  }
}

// ---------- 输入 ----------
function answer(choice) {
  if (phase !== 'playing') return;
  if (tut.active) return;
  const res = run.answer(choice);
  if (!res.ok) return;
  consumeEvents(run.drainEvents());
  if (!res.correct) {
    ui.setAnswerLocked(true);
    setTimeout(() => { if (phase === 'playing') ui.setAnswerLocked(false); }, QUIZ.WRONG_LOCK_DELAY * 1000);
  }
  ui.renderQuestion(run);
  ui.updateHUD(run.getHud());
}

function navigate(dir) {
  if (phase !== 'playing') return;
  if (tut.active) return;
  const res = run.navigate(dir);
  if (!res.ok) return;
  consumeEvents(run.drainEvents());
  ui.renderQuestion(run);
  ui.updateHUD(run.getHud());
}

function toggleMute() {
  muted = audio.setMuted(!muted);
  Sdk.save('muted', muted);
  ui.btnMute.textContent = muted ? '🔇' : '🔊';
}

// ---------- 教程 ----------
function startTutorial() {
  tut.active = true;
  tut.step = 0;
  ui.setTutorialContent(TUT_STEPS[0]);
  ui.tutorial.classList.remove('hidden');
}

function nextTutorialStep() {
  tut.step += 1;
  if (tut.step >= TUT_STEPS.length) { skipTutorial(); return; }
  ui.setTutorialContent(TUT_STEPS[tut.step]);
}

function skipTutorial() {
  tut.active = false;
  ui.tutorial.classList.add('hidden');
  tutorialDone = true;
  Sdk.save('tutorialDone', true);
}

// ---------- 按钮绑定 ----------
ui.btnStart.addEventListener('click', startGame);
ui.btnResume.addEventListener('click', resumeGame);
ui.btnRestart2.addEventListener('click', startGame);
ui.btnRetry.addEventListener('click', startGame);
ui.btnHome.addEventListener('click', goHome);
ui.btnHome2.addEventListener('click', goHome);
ui.btnHome3.addEventListener('click', goHome);
ui.btnPause.addEventListener('click', pauseGame);
ui.btnRestart.addEventListener('click', startGame);
ui.btnMute.addEventListener('click', toggleMute);
ui.btnSafe.addEventListener('click', () => answer('right'));
ui.btnUnsafe.addEventListener('click', () => answer('wrong'));
ui.btnPrev.addEventListener('click', () => navigate(-1));
ui.btnNext.addEventListener('click', () => navigate(1));
ui.btnHowto.addEventListener('click', startTutorial);
ui.btnHowto2.addEventListener('click', startTutorial);
ui.tutNext.addEventListener('click', nextTutorialStep);
ui.tutSkip.addEventListener('click', skipTutorial);
for (const sel of ui.langSelects) {
  if (sel) sel.addEventListener('change', (e) => {
    ui.setLang(e.target.value);
    if (phase === 'playing' || phase === 'paused') ui.renderQuestion(run);
  });
}

// 键盘
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  } else if (e.code === 'ArrowLeft') navigate(-1);
  else if (e.code === 'ArrowRight') navigate(1);
  else if (e.code === 'KeyA' || e.code === 'KeyY' || e.code === 'Digit1') answer('right');
  else if (e.code === 'KeyD' || e.code === 'KeyN' || e.code === 'Digit2') answer('wrong');
  else if (e.code === 'KeyR') { if (phase !== 'title') startGame(); }
  else if (e.code === 'KeyM') toggleMute();
});

// ---------- 主循环 ----------
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  if (phase === 'playing') {
    if (!tut.active) {
      accumulator += dt;
      while (accumulator >= STEP) {
        run.step(STEP);
        accumulator -= STEP;
        consumeEvents(run.drainEvents());
      }
    }
    renderer.render({ phase: 'playing', scene: currentSceneKey(), timeMs: now });
    ui.updateHUD(run.getHud());
  } else if (phase === 'paused') {
    renderer.render({ phase: 'playing', scene: currentSceneKey(), timeMs: now });
  } else {
    renderer.render({ phase, timeMs: now });
  }
}

// ---------- 初始化 ----------
Sdk.ready(); // 不 await，不阻塞首屏
Sdk.track('load', {});
ui.applyLang();
ui.showTitle();
ui.btnMute.textContent = muted ? '🔇' : '🔊';
renderer.render({ phase: 'title', timeMs: 0 });
requestAnimationFrame(loop);

// ---------- 标准调试契约 ----------
window.G = {
  run: () => run,
  state: () => run.state,
  answer,
  navigate,
  phase: () => phase,
};

window.__ll = {
  get state() { return { phase, lang: ui.lang, dir: ui.dir }; },
  get run() { return run; },
  start: startGame,
  pause: pauseGame,
  resume: resumeGame,
  restart: startGame,
  startAct: startGame,
  save: () => Sdk,
  ui: () => ui,
  startTutorial,
  tutorial: {
    get active() { return tut.active; },
    get step() { return tut.step; },
    get steps() { return TUT_STEPS; },
    get current() { return TUT_STEPS[tut.step] || null; },
    skip: skipTutorial,
  },
  debug: {
    state: () => run.state,
    currentAnswer: () => QUESTIONS[run.state.order[run.state.index]].answer,
    answer,
    win() {
      for (let i = 0; i < 40 && run.state.phase === 'playing'; i += 1) {
        const q = QUESTIONS[run.state.order[run.state.index]];
        answer(q.answer);
      }
    },
    timeout() {
      run.state.time = run.state.totalTime;
      run.state.timeLeft = 0;
      run.step(0);
      consumeEvents(run.drainEvents());
    },
  },
};
