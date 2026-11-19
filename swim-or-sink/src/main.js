// 主入口：60Hz 固定步长 + 标题/答题/暂停/结算 + 教程引导 + SDK 统一出口
// 装配：sim(M1) / render(M2) / audio(M4)。HUD/题目/结算/教程的 DOM 由这里直写。
import { STEP, GAME } from '../config/game.config.js';
import { LEVELS, LEVEL_COUNT, pick } from '../config/questions.js';
import { createRun, localizeQuestion } from './game/sim.js';
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
let phase = 'title';           // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let tutorialStep = -1;         // -1 = 未激活
let locked = false;            // 反馈期间锁输入
let pendingResult = null;
let lastLQ = null;             // 刚作答的题面（本地化后），用于反馈文案

const view = { time: 0, shake: 0, fxQueue: [] };

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let unlocked = Math.max(1, Sdk.load('unlocked', 1) | 0);
let bestStars = Sdk.load('bestStars', 0) | 0;
let bestScore = Sdk.load('bestScore', 0) | 0;
let tutorialDone = !!Sdk.load('tutorialDone', false);

Sdk.ready(); // 不 await，不阻塞首屏
Sdk.onAdStart(() => { if (phase === 'playing') pauseGame(true); });
Sdk.onAdEnd(() => { if (phase === 'paused') resumeGame(); });
audio.setMuted(muted);

function persist() {
  Sdk.save('muted', muted);
  Sdk.save('unlocked', unlocked);
  Sdk.save('bestStars', bestStars);
  Sdk.save('bestScore', bestScore);
  Sdk.save('tutorialDone', tutorialDone);
}

function depthName(level) {
  const lv = LEVELS[level - 1];
  return lv ? t(lv.nameKey) : '';
}

// ---------- 阶段状态机 ----------
function startLevel(idx) {
  idx = Math.max(0, Math.min(LEVEL_COUNT - 1, idx | 0));
  locked = false;
  pendingResult = null;
  run = createRun(idx, { seed: (Date.now() % 2147483647) || 1 });
  phase = 'playing';
  ui.showGame();
  hideResult();
  renderQuestion();
  audio.startBgm();
  Sdk.newRun({ level: idx + 1 });
  Sdk.track('start', { level: idx + 1 });
  if (!tutorialDone && idx === 0) startTutorial();
  pump();
}

function pauseGame(silent) {
  if (phase !== 'playing') return;
  phase = 'paused';
  audio.stopBgm();
  if (!silent) ui.showPause();
}

function resumeGame() {
  if (phase !== 'paused') return;
  phase = 'playing';
  ui.hidePause();
  audio.startBgm();
}

function restartLevel() {
  if (run) Sdk.track('restart', { level: run.state.level });
  startLevel(run ? run.state.level - 1 : 0);
}

function goHome() {
  run = null;
  phase = 'title';
  hideResult();
  ui.showTitle();
  buildLevelGrid();
  audio.stopBgm();
}

// ---------- 渲染：题目 / 选项 / HUD ----------
function renderQuestion() {
  if (!run || run.state.phase !== 'playing') return;
  const q = run.state.questions[run.state.qIndex];
  const lq = localizeQuestion(q, i18n.lang);
  $('question-text').textContent = lq.q;

  const opts = $('options');
  opts.classList.remove('hidden');
  opts.innerHTML = '';
  lq.opts.forEach((text, i) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.dataset.idx = String(i);
    if (lq.eliminated && lq.eliminated.has(i)) {
      btn.classList.add('eliminated');
      btn.disabled = true;
    }
    const key = document.createElement('span');
    key.className = 'opt-key';
    key.textContent = String(i + 1);
    btn.appendChild(key);
    btn.appendChild(document.createTextNode(text));
    opts.appendChild(btn);
  });

  $('hud-q').textContent = t('qProgress', { cur: run.state.qIndex + 1, total: run.state.qCount });
  $('hud-level').textContent = `${t('level')} ${run.state.level} · ${depthName(run.state.level)}`;
  renderHud();
}

function renderHud() {
  if (!run) return;
  const h = run.getHud();

  const airEl = $('hud-air');
  airEl.innerHTML = '';
  for (let i = 0; i < h.maxAir; i += 1) {
    const b = document.createElement('span');
    b.className = 'bubble' + (i < h.air ? '' : ' lost');
    airEl.appendChild(b);
  }

  const streakEl = $('hud-streak');
  streakEl.textContent = `🔥 ${h.streak}`;
  streakEl.classList.toggle('flame', h.streak >= 2);
  streakEl.classList.toggle('hidden', h.streak <= 0);

  $('hud-score').textContent = `${t('score')} ${h.score}`;

  const lifeline = $('btn-lifeline');
  const q = run.state.questions[run.state.qIndex];
  const usable = !h.usedLifeline && q && q.opts.length >= 3 && phase === 'playing';
  lifeline.classList.toggle('disabled', !usable);
  lifeline.disabled = !usable;
  lifeline.textContent = h.usedLifeline ? '✕' : '🛟';
}

// ---------- 反馈 ----------
function showFeedback(good, reasonText, correctIdx) {
  const fb = $('feedback');
  fb.classList.remove('hidden');
  const ft = $('feedback-title');
  ft.textContent = good ? t('correct') : t('wrong');
  ft.className = good ? 'good' : 'bad';
  $('feedback-text').textContent = reasonText;
  for (const b of $('options').querySelectorAll('.option-btn')) {
    b.classList.toggle('reveal-correct', Number(b.dataset.idx) === correctIdx);
  }
}

function hideFeedback() {
  $('feedback').classList.add('hidden');
}

function onAnswerComplete() {
  locked = false;
  hideFeedback();
  if (pendingResult) {
    const ev = pendingResult;
    pendingResult = null;
    finishRun(ev);
  } else if (run && run.state.phase === 'playing') {
    renderQuestion();
  }
}

// ---------- 作答 ----------
function applyAnswer(idx, instant = false) {
  if (!run || phase !== 'playing' || locked) return false;
  const q = run.state.questions[run.state.qIndex];
  if (!q) return false;
  if (q.eliminated && q.eliminated.has(idx)) return false;
  lastLQ = localizeQuestion(q, i18n.lang);
  const res = run.answer(idx);
  if (!res.ok) return false;
  pump();
  renderHud();

  if (instant) {
    if (run.state.phase === 'playing') renderQuestion();
    if (pendingResult) { const ev = pendingResult; pendingResult = null; finishRun(ev); }
    return true;
  }

  showFeedback(res.correct, lastLQ.reason, lastLQ.answer);
  locked = true;
  setTimeout(onAnswerComplete, res.correct ? GAME.feedbackMsCorrect : GAME.feedbackMsWrong);
  return true;
}

function choose(idx) {
  audio.unlock();
  applyAnswer(idx, false);
}

// ---------- 结算 ----------
function finishRun(ev) {
  phase = 'result';
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  const won = ev.type === 'win';
  const st = run.state;
  if (won) {
    bestStars = Math.max(bestStars, st.stars | 0);
    bestScore = Math.max(bestScore, st.score | 0);
    unlocked = LEVEL_COUNT;
    persist();
    Sdk.levelCleared({ level: st.level, stars: st.stars, score: st.score });
  } else {
    persist();
    Sdk.gameOver({ level: st.level, score: st.score, reason: ev.reason || 'drowned' });
  }
  showResult(ev);
  audio.event(ev.type);
}

function showResult(ev) {
  const won = ev.type === 'win';
  const st = run.state;
  $('result-title').textContent = won ? t('winTitle') : t('loseTitle');
  $('result-title').classList.toggle('lose', !won);
  $('result-stars').textContent = won
    ? '★'.repeat(st.stars) + '☆'.repeat(3 - st.stars)
    : '';
  $('result-meta').textContent = won
    ? `${t('resultScore')}: ${st.score}\n${t('resultAir')}: ${st.air}/${st.maxAir}\n${t('resultStreak')}: ${st.maxStreak}`
    : `${t('sinkReason')}\n${t('resultScore')}: ${st.score}\n${t('resultStreak')}: ${st.maxStreak}`;
  $('btn-next').classList.add('hidden'); // 连续闯关，无下一关跳转
  ui.show('result');
}

function hideResult() {
  $('screen-result').classList.add('hidden');
}

// ---------- 事件消费 ----------
function pump() {
  if (!run) return;
  handleEvents(run.drainEvents());
}

function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    if (ev.type === 'correct' || ev.type === 'wrong') tutorialAdvance();
    switch (ev.type) {
      case 'wrong':
        view.shake = 6;
        break;
      case 'win':
      case 'lose':
        pendingResult = ev;
        break;
      default:
        break;
    }
  }
}

// ---------- 教程引导（首次自动弹，可跳过，完成/跳过后持久化不再自动弹） ----------
const TUT_STEPS = () => [
  { text: t('tutStep1') },
  { text: t('tutStep2') },
  { text: t('tutStep3') },
];

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

function tutorialAdvance() {
  if (tutorialStep < 0) return;
  tutorialStep += 1;
  if (tutorialStep >= TUT_STEPS().length) endTutorial();
  else renderTutorialStep();
}

// ---------- 标题关卡格 ----------
function buildLevelGrid() {
  const grid = $('level-grid');
  if (!grid) return;
  grid.innerHTML = '';
  for (let i = 0; i < LEVEL_COUNT; i += 1) {
    const cell = document.createElement('button');
    cell.className = 'level-cell' + (i + 1 > unlocked ? ' locked' : '');
    cell.dataset.level = String(i);
    const lv = LEVELS[i];
    const lockedTxt = i + 1 > unlocked;
    cell.innerHTML = `<span class="level-num">${t('level')} ${i + 1}</span><span class="level-name">${lockedTxt ? '🔒' : ''} ${t(lv.nameKey)}</span>`;
    grid.appendChild(cell);
  }
  $('stars-total').textContent = bestStars > 0 ? `★ ${bestStars} / 3` : '';
}

// ---------- 输入 / UI 绑定 ----------
function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  ui.setMuted(muted);
  $('btn-mute').classList.toggle('is-muted', muted);
  persist();
}

function bind() {
  const on = (id, fn) => {
    const el = $(id);
    if (el) el.addEventListener('click', () => { audio.unlock(); fn(); });
  };
  on('btn-start', () => startLevel(0));
  on('btn-resume', resumeGame);
  on('btn-restart', restartLevel);
  on('btn-restart2', restartLevel);
  on('btn-retry', () => startLevel(0));
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-lifeline', () => {
    if (!run || phase !== 'playing' || locked) return;
    audio.unlock();
    const res = run.useLifeline();
    if (res.ok) { pump(); renderQuestion(); }
  });
  on('btn-tut-replay', () => {
    if (phase === 'paused') resumeGame();
    if (phase === 'playing') startTutorial();
  });
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result') startTutorial(); });
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);

  $('options').addEventListener('click', (e) => {
    const btn = e.target.closest('.option-btn');
    if (!btn || btn.disabled) return;
    choose(Number(btn.dataset.idx));
  });

  $('level-grid').addEventListener('click', (e) => {
    const cell = e.target.closest('[data-level]');
    if (!cell || cell.classList.contains('locked')) return;
    startLevel(Number(cell.dataset.level));
  });

  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = $(id);
    if (!sel) continue;
    sel.addEventListener('change', () => {
      ui.setLang(sel.value);
      buildLevelGrid();
      if (run && phase === 'playing') renderQuestion();
      else if (run && phase === 'result') showResult(run.state.phase === 'won' ? { type: 'win' } : { type: 'lose' });
      renderTutorialStep();
      $('btn-mute').setAttribute('aria-label', muted ? t('unmute') : t('mute'));
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (phase === 'playing') pauseGame();
      else if (phase === 'paused') resumeGame();
    }
    if (e.code === 'KeyR') { if (phase === 'playing' || phase === 'paused' || phase === 'result') restartLevel(); }
    if (e.code === 'KeyM') toggleMute();
    const num = parseInt(e.key, 10);
    if (num >= 1 && num <= 3 && phase === 'playing') choose(num - 1);
  });
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
    pump();
  }

  if (view.shake > 0) view.shake = Math.max(0, view.shake - dt * 18);
  for (const fx of view.fxQueue) if (fx.ttl > 0) fx.ttl -= dt;
  view.fxQueue = view.fxQueue.filter((fx) => fx.ttl > 0);

  renderer.draw(run ? run.state : null, dt, view);
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
  sim: () => (run ? run.state : null),
  start: (i) => startLevel(i == null ? 0 : i),
  startAct: (i) => startLevel(i == null ? 0 : i),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => restartLevel(),
  home: () => goHome(),
  save: () => Sdk,
  ui: () => ui,
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['read', 'air', 'streak']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  debug: {
    state: () => {
      if (!run) return null;
      const st = run.state;
      return {
        phase: st.phase,
        level: st.level,
        qIndex: st.qIndex,
        qCount: st.questions.length,
        air: st.air,
        streak: st.streak,
        score: st.score,
        stars: st.stars,
        optionCount: st.questions[st.qIndex] ? st.questions[st.qIndex].opts.length : 0,
        usedLifeline: st.usedLifeline,
      };
    },
    answerCorrect: () => {
      if (!run || run.state.phase !== 'playing') return false;
      return applyAnswer(run.state.questions[run.state.qIndex].answer, true);
    },
    answerWrong: () => {
      if (!run || run.state.phase !== 'playing') return false;
      const q = run.state.questions[run.state.qIndex];
      const wrong = q.opts.findIndex((_, i) => i !== q.answer && !(q.eliminated && q.eliminated.has(i)));
      if (wrong < 0) return false;
      return applyAnswer(wrong, true);
    },
    loadLevel: (i) => startLevel(i),
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    startTutorial: () => startTutorial(),
    tutorialStep: () => tutorialStep,
    autoSolve: () => {
      if (!run) return false;
      let guard = 40;
      while (guard-- > 0 && run.state.phase === 'playing') {
        applyAnswer(run.state.questions[run.state.qIndex].answer, true);
      }
      return run.state.phase !== 'playing';
    },
    useLifeline: () => {
      if (!run) return false;
      const r = run.useLifeline();
      if (r.ok) { pump(); renderQuestion(); }
      return !!r.ok;
    },
  },
};

// ---------- 启动 ----------
bind();
syncDocumentLang();
ui.applyLang();
buildLevelGrid();
$('btn-mute').classList.toggle('is-muted', muted);
Sdk.track('load', {});
requestAnimationFrame(frame);
