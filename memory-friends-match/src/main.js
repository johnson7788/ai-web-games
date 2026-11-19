// MEMORY FRIENDS MATCH · 主入口
// 装配：sim（纯逻辑）/ render（霓虹背景 canvas）/ ui（DOM 屏幕）/ audio（WebAudio）/ Sdk（门户）。
// 调试契约：window.__ll（state/start/pause/resume/restart/run/tutorial/startTutorial）。
import { STEP } from '../config/game.config.js';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';
import { createRun } from './game/sim.js';
import { createRenderer } from './render/index.js';
import { buddySvg, buddyName } from './render/buddy.js';
import { createAudio } from './core/audio.js';
import { ui } from './ui/ui.js';
import { i18n, t, syncDocumentLang } from './core/i18n.js';
import Sdk from './core/sdk.js';

const $ = (id) => document.getElementById(id);
const canvas = $('canvas');
const renderer = createRenderer(canvas);
const audio = createAudio();

let run = null;
let phase = 'title'; // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let tutorialStep = -1;

const view = {
  lastAnswer: null,
  shake: 0,
  flash: 0,
  comboFlash: 0,
};

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let unlocked = Math.max(1, Sdk.load('unlocked', 1) | 0);
let starsByLevel = Sdk.load('stars', {}) || {};
let tutorialDone = !!Sdk.load('tutorialDone', false);
let lastLevel = Sdk.load('lastLevel', 0) | 0;

Sdk.ready();
audio.setMuted(muted);

function persist() {
  Sdk.save('unlocked', unlocked);
  Sdk.save('stars', starsByLevel);
  Sdk.save('muted', muted);
  Sdk.save('tutorialDone', tutorialDone);
  Sdk.save('lastLevel', lastLevel);
}

function totalStars() {
  return Object.values(starsByLevel).reduce((a, b) => a + (b | 0), 0);
}

function setPhase(p) {
  phase = p;
}

// ---------- 阶段状态机 ----------
function startLevel(idx, opts = {}) {
  idx = Math.max(0, Math.min(LEVEL_COUNT - 1, idx | 0));
  lastLevel = idx;
  run = createRun(idx, { seed: (Date.now() % 2147483647) || 1 });
  view.lastAnswer = null;
  view.shake = 0;
  view.flash = 0;
  view.comboFlash = 0;
  setPhase('playing');
  ui.showGame();
  ui.hideResult();
  updateHud();
  renderGame();
  audio.startBgm();
  Sdk.track('start', { level: idx + 1 });
  if (!opts.skipTutorial && !tutorialDone && idx === 0) startTutorial();
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
}

function restartLevel() {
  const idx = run ? run.state.level - 1 : lastLevel;
  startLevel(idx, { skipTutorial: true });
}

function goHome() {
  run = null;
  setPhase('title');
  ui.hideResult();
  ui.showTitle();
  buildLevelGrid();
}

// ---------- 答题区渲染 ----------
function renderGame() {
  if (!run) return;
  const st = run.state;
  ui.prompt.innerHTML = '';
  ui.prompt.classList.add('hidden');
  ui.options.innerHTML = '';
  ui.btnReadyOk.classList.add('hidden');
  ui.options.classList.remove('memorize', 'question');

  if (st.phase === 'memorize') {
    ui.prompt.innerHTML =
      `<div class="prompt-title">${t('memorizeTitle')}</div><div class="prompt-sub">${t('memorizeHint')}</div>`;
    ui.prompt.classList.remove('hidden');
    ui.btnReadyOk.textContent = t('memorizeOk');
    ui.btnReadyOk.classList.remove('hidden');
    ui.options.classList.add('memorize');
    for (const f of st.friends) {
      const card = document.createElement('div');
      card.className = 'buddy-card';
      card.innerHTML = `<div class="buddy">${buddySvg(f)}</div><div class="buddy-name">${buddyName(f, i18n.lang)}</div>`;
      ui.options.appendChild(card);
    }
  } else if (st.phase === 'question' && st.question) {
    const q = st.question;
    const target = st.friends[q.target];
    ui.options.classList.add('question');
    if (q.type === 1) {
      ui.prompt.innerHTML = `<div class="prompt-text">${t('questionWho', { name: buddyName(target, i18n.lang) })}</div>`;
    } else {
      ui.prompt.innerHTML = `<div class="prompt-face">${buddySvg(target)}</div><div class="prompt-text">${t('questionName')}</div>`;
    }
    ui.prompt.classList.remove('hidden');
    q.options.forEach((fIdx, i) => {
      const f = st.friends[fIdx];
      const btn = document.createElement('button');
      btn.className = 'option';
      if (q.type === 1) {
        btn.classList.add('face-option');
        btn.innerHTML = `<div class="buddy">${buddySvg(f)}</div>`;
        btn.setAttribute('aria-label', buddyName(f, i18n.lang));
      } else {
        btn.classList.add('name-option');
        btn.textContent = buddyName(f, i18n.lang);
      }
      btn.dataset.idx = String(i);
      if (st.answered && view.lastAnswer && view.lastAnswer.i === i) {
        btn.classList.add(view.lastAnswer.correct ? 'is-correct' : 'is-wrong');
      }
      ui.options.appendChild(btn);
    });
  }
}

function updateHud() {
  if (!run) return;
  const st = run.state;
  ui.hudLevel.textContent = t('level', { n: st.level });
  const secs = Math.max(0, Math.ceil(st.timeLeft));
  const timeEl = ui.hudTime;
  timeEl.textContent = secs + 's';
  timeEl.classList.toggle('time-low', secs <= 10);
  ui.hudScore.textContent = String(st.score);
  ui.hudCombo.classList.toggle('hidden', st.combo < 2);
  ui.hudCombo.textContent = '×' + st.combo;
  ui.hintBadge.textContent = String(st.hintLeft);
  ui.btnHint.classList.toggle('disabled', st.hintLeft <= 0 || st.phase !== 'question');
}

// ---------- 关卡格 / 结算 ----------
function buildLevelGrid() {
  const grid = ui.levelGrid;
  if (!grid) return;
  grid.innerHTML = '';
  for (let i = 0; i < LEVEL_COUNT; i += 1) {
    const cell = document.createElement('button');
    cell.className = 'level-cell' + (i + 1 > unlocked ? ' locked' : '');
    cell.dataset.level = String(i);
    const stars = starsByLevel[i + 1] | 0;
    cell.innerHTML =
      `<span class="lv-num">${i + 1}</span>` +
      `<span class="lv-stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>`;
    cell.setAttribute('aria-label', t('level', { n: i + 1 }));
    grid.appendChild(cell);
  }
  ui.starsTotal.textContent = `★ ${totalStars()} / ${LEVEL_COUNT * 3}`;
}

function showResult(res) {
  const won = res.won;
  ui.resultTitle.textContent = won ? t('winTitle') : t('loseTitle');
  ui.resultTitle.classList.toggle('lose', !won);
  if (won) {
    ui.resultStars.innerHTML =
      `<span class="stars">${'★'.repeat(res.stars)}${'☆'.repeat(3 - res.stars)}</span>` +
      (res.stars >= 3 ? `<em>${t('perfect')}</em>` : '');
    ui.resultTime.textContent = `${t('resultTime')}: ${Math.ceil(res.timeLeft)}s`;
    ui.resultMeta.textContent = `${t('correctCount')} ${res.correct} · ${t('wrongCount')} ${res.wrong}`;
  } else {
    ui.resultStars.innerHTML = '';
    ui.resultTime.textContent = t('timeOut');
    ui.resultMeta.textContent = `${t('correctCount')} ${res.correct} · ${t('wrongCount')} ${res.wrong}`;
  }
  ui.btnNext.style.display = won && run && run.state.level < LEVEL_COUNT ? '' : 'none';
  ui.playArea.classList.add('hidden');
  ui.showResult();
}

function finishRun(ev) {
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  const st = run.state;
  const won = ev.type === 'win';
  const stars = won ? (ev.stars || st.stars || 1) : 0;
  if (won) {
    const lv = st.level;
    starsByLevel[lv] = Math.max(starsByLevel[lv] | 0, stars);
    if (lv < LEVEL_COUNT) unlocked = Math.max(unlocked, lv + 1);
    Sdk.levelCleared({ level: lv, stars, score: st.score });
    buildLevelGrid();
  } else {
    Sdk.gameOver({ level: st.level, score: st.score, reason: st.reason });
  }
  persist();
  showResult({ won, stars, timeLeft: st.timeLeft, correct: st.correct, wrong: st.wrong });
  audio.event(ev.type, ev);
}

// ---------- 事件消费 ----------
function handleEvents(events) {
  for (const ev of events) {
    if (ev.type === 'win' || ev.type === 'lose') {
      finishRun(ev);
      return;
    }
    audio.event(ev.type, ev);
    if (ev.type === 'question') {
      view.lastAnswer = null;
      renderGame();
      updateHud();
    } else if (ev.type === 'correct') {
      view.flash = 0.3;
    } else if (ev.type === 'wrong') {
      view.shake = 5;
    } else if (ev.type === 'combo') {
      view.comboFlash = 0.45;
    } else if (ev.type === 'hint') {
      renderGame();
      updateHud();
    }
  }
}

// ---------- 教程引导（首次自动弹，可跳过，可重看） ----------
const TUT_STEPS = () => [t('tutStep1'), t('tutStep2'), t('tutStep3')];

function startTutorial() {
  tutorialStep = 0;
  renderTutorialStep();
}

function renderTutorialStep() {
  const el = ui.tutorial;
  if (tutorialStep < 0) {
    el.classList.add('hidden');
    return;
  }
  el.classList.remove('hidden');
  const steps = TUT_STEPS();
  ui.tutText.textContent = steps[tutorialStep] || '';
  ui.tutTitle.textContent = `${t('tutTitle')} ${tutorialStep + 1}/${steps.length}`;
  ui.tutSkip.textContent = t('tutSkip');
  ui.tutNext.textContent = t('tutNext');
}

function advanceTutorial() {
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

// ---------- 输入 ----------
function onMemorizeOk() {
  audio.unlock();
  if (!run || run.state.phase !== 'memorize') return;
  run.memorizeDone();
  if (tutorialStep === 0) advanceTutorial();
  renderGame();
  updateHud();
}

function onAnswer(i) {
  audio.unlock();
  if (!run || run.state.phase !== 'question') return;
  const res = run.answer(i);
  if (!res.ok) return;
  view.lastAnswer = { i, correct: !!res.correct };
  if (tutorialStep === 1 || tutorialStep === 2) advanceTutorial();
  renderGame();
}

function onHint() {
  audio.unlock();
  if (!run || run.state.phase !== 'question') return;
  if (run.revealHint().ok) {
    renderGame();
    updateHud();
  }
}

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  ui.btnMute.textContent = muted ? '🔇' : '🔊';
  ui.btnMute.classList.toggle('is-muted', muted);
  persist();
}

// ---------- UI 绑定 ----------
function bind() {
  const on = (id, fn) => {
    const el = $(id);
    if (el) el.addEventListener('click', () => { audio.unlock(); fn(); });
  };
  on('btn-start', () => startLevel(lastLevel || 0));
  on('btn-resume', resumeGame);
  on('btn-restart', restartLevel);
  on('btn-restart2', restartLevel);
  on('btn-retry', restartLevel);
  on('btn-next', () => startLevel((run ? run.state.level : lastLevel), { skipTutorial: true }));
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-hint', onHint);
  on('btn-ready-ok', onMemorizeOk);
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result') startTutorial(); });
  on('btn-tut-replay', () => { if (phase === 'paused') resumeGame(); if (phase === 'playing') startTutorial(); });
  on('tut-skip', endTutorial);
  on('tut-next', advanceTutorial);

  ui.options.addEventListener('click', (e) => {
    const btn = e.target.closest('.option');
    if (btn && btn.dataset.idx != null) onAnswer(Number(btn.dataset.idx));
  });

  ui.levelGrid.addEventListener('click', (e) => {
    const idx = e.target.closest('[data-level]')?.dataset.level;
    if (idx == null) return;
    const i = Number(idx);
    if (i + 1 > unlocked) return;
    startLevel(i);
  });

  for (const sel of [ui.langSelect, ui.langSelectPause]) {
    if (!sel) continue;
    sel.addEventListener('change', () => {
      ui.setLang(sel.value);
      renderTutorialStep();
      buildLevelGrid();
      if (run) { updateHud(); renderGame(); }
    });
  }
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
  if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'result')) restartLevel();
  if (e.code === 'KeyM') toggleMute();
});

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
    handleEvents(run.drainEvents());
    if (run && phase === 'playing') updateHud();
  }

  if (view.shake > 0) view.shake = Math.max(0, view.shake - dt * 16);
  if (view.flash > 0) view.flash = Math.max(0, view.flash - dt);
  if (view.comboFlash > 0) view.comboFlash = Math.max(0, view.comboFlash - dt);

  try {
    renderer.draw(run ? run.state : null, dt, view);
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
  },
  run: () => run,
  start: (i) => startLevel(i == null ? (lastLevel || 0) : i, { skipTutorial: true }),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => restartLevel(),
  home: () => goHome(),
  startTutorial: () => startTutorial(),
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['memorize', 'answer', 'answer']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
  },
  save: () => Sdk,
  ui: () => ui,
  debug: {
    state: () => (run ? run.state : null),
    loadLevel: (i) => startLevel(i, { skipTutorial: true }),
    autoMemorize: () => { if (run && run.state.phase === 'memorize') { run.memorizeDone(); renderGame(); updateHud(); } return true; },
    useHint: () => onHint(),
    autoSolve: () => {
      if (!run) return false;
      let guard = 0;
      while (guard++ < 20000 && run.state.phase !== 'won' && run.state.phase !== 'lose') {
        if (run.state.phase === 'memorize') run.memorizeDone();
        else if (run.state.phase === 'question' && run.state.question && !run.state.answered && run.state.transitionLeft <= 0) {
          const q = run.state.question;
          run.answer(q.options.indexOf(q.target));
        }
        run.step(STEP);
        handleEvents(run.drainEvents());
        if (phase === 'result') break;
      }
      renderGame();
      updateHud();
      return run.state.phase === 'won';
    },
  },
};

// ---------- 启动 ----------
bind();
syncDocumentLang();
ui.applyLang();
ui.btnMute.textContent = muted ? '🔇' : '🔊';
ui.btnMute.classList.toggle('is-muted', muted);
buildLevelGrid();
Sdk.track('load', {});
requestAnimationFrame(frame);
