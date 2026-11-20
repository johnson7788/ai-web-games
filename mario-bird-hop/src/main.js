// 主入口：60Hz 固定步长 + 标题→游戏→暂停→结算 + 教程引导 + SDK 统一出口。
import { STEP, LAYOUT } from '../config/game.config.js';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';
import { createRun } from './game/sim.js';
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
let phase = 'title'; // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let tutorialStep = -1; // -1 = 未激活

const input = { left: false, right: false, jump: false };
const view = { shake: 0 };

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let starsByLevel = Sdk.load('stars', {}) || {};
let bestScore = Sdk.load('best', 0) | 0;
let tutorialDone = !!Sdk.load('tutorialDone', false);
let lastLevel = Sdk.load('lastLevel', 0) | 0;

Sdk.ready(); // 不 await，不阻塞首屏
audio.setMuted(muted);
ui.setMuted(muted);

function persist() {
  Sdk.save('stars', starsByLevel);
  Sdk.save('best', bestScore);
  Sdk.save('muted', muted);
  Sdk.save('tutorialDone', tutorialDone);
  Sdk.save('lastLevel', lastLevel);
}

function totalStars() {
  return Object.values(starsByLevel).reduce((a, b) => a + (b | 0), 0);
}

// ---------- 阶段状态机 ----------
function setPhase(p) { phase = p; }

function levelName(idx) {
  const lv = LEVELS[idx];
  return lv ? (lv.name[i18n.lang] || lv.name.en || '') : '';
}

function startLevel(idx) {
  idx = Math.max(0, Math.min(LEVEL_COUNT - 1, idx | 0));
  lastLevel = idx;
  run = createRun(idx);
  view.shake = 0;
  setPhase('playing');
  ui.showGame();
  ui.hideResult();
  updateHud();
  audio.startBgm();
  Sdk.track('start', { level: idx + 1 });
  if (!tutorialDone && idx === 0) startTutorial();
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
  lastTime = performance.now();
}

function restartLevel() {
  if (run) Sdk.track('restart', { level: run.state.level });
  startLevel(run ? run.state.level - 1 : lastLevel);
}

function goHome() {
  run = null;
  setPhase('title');
  ui.hideResult();
  ui.showTitle();
  buildTitleStars();
  audio.stopBgm();
}

// ---------- HUD / 标题星 / 结算 ----------
function updateHud() {
  if (!run) return;
  const h = run.getHud();
  h.levelName = levelName(run.state.level - 1);
  h.best = bestScore;
  ui.updateHUD(h);
  const flagX = run.state.flagRect ? run.state.flagRect.x + run.state.flagRect.w / 2 : run.state.levelWidth;
  ui.updateGoal((run.state.player.x / Math.max(1, flagX)) * 100);
}

function buildTitleStars() {
  const el = $('stars-total');
  if (el) el.textContent = `★ ${totalStars()} / ${LEVEL_COUNT * 3}`;
}

function finishRun(ev) {
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  const st = run.state;
  const won = ev.type === 'win';
  const stars = won ? (ev.stars || st.starsEarned || 1) : 0;
  const newBest = won && st.score > bestScore;

  $('result-title').textContent = won ? t('winTitle') : t('loseTitle');
  $('result-title').classList.toggle('lose', !won);
  const starsEl = $('result-stars');
  starsEl.innerHTML = won
    ? `<span class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>${stars >= 3 ? `<em>${t('perfect')}</em>` : ''}`
    : '';
  const reasonKey = ev.reason ? ('lose' + ev.reason[0].toUpperCase() + ev.reason.slice(1)) : '';
  $('result-meta').textContent = won
    ? `${t('score')} ${st.score} · ◉ ${st.coinCount}`
    : (reasonKey && t(reasonKey) !== reasonKey ? t(reasonKey) : t('loseMonster'));
  $('result-best').textContent = newBest ? t('newBest') : `${t('best')} ${bestScore}`;
  $('btn-next').style.display = won && st.level < LEVEL_COUNT ? '' : 'none';

  if (won) {
    const idx = st.level; // 1 基
    starsByLevel[idx] = Math.max(starsByLevel[idx] | 0, stars);
    if (st.score > bestScore) bestScore = st.score;
  }
  persist();
  buildTitleStars();
  Sdk.track(won ? 'win' : 'fail', { level: st.level, stars, score: st.score, reason: ev.reason || null });
  audio.event(won ? 'win' : 'lose');
  ui.showResult();
}

// ---------- 教程（首次自动弹，可跳过，持久化不再弹） ----------
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
  $('tut-skip').textContent = t('tutSkip');
  $('tut-next').textContent = t('tutNext');
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

// ---------- 事件消费 ----------
function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    renderer.fx(ev, run.state);
    switch (ev.type) {
      case 'box':
      case 'stomp':
        view.shake = 3;
        break;
      case 'hurt':
        view.shake = 5;
        break;
      case 'win':
      case 'lose':
        finishRun(ev);
        return;
      default:
        break;
    }
  }
}

// ---------- 输入 ----------
function setKey(code, down) {
  if (code === 'KeyA' || code === 'ArrowLeft') input.left = down;
  else if (code === 'KeyD' || code === 'ArrowRight') input.right = down;
  else if (code === 'Space' || code === 'KeyW' || code === 'ArrowUp') input.jump = down;
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp') e.preventDefault();
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
    return;
  }
  if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'result')) restartLevel();
  if (e.code === 'KeyM') toggleMute();
  setKey(e.code, true);
});

window.addEventListener('keyup', (e) => setKey(e.code, false));

function bindTouch(id, prop) {
  const el = $(id);
  if (!el) return;
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); audio.unlock(); input[prop] = true; });
  el.addEventListener('pointerup', (e) => { e.preventDefault(); input[prop] = false; });
  el.addEventListener('pointercancel', () => { input[prop] = false; });
}

canvas.addEventListener('pointerdown', () => {
  audio.unlock();
  if (phase === 'playing') input.jump = true;
});
canvas.addEventListener('pointerup', () => { input.jump = false; });

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  ui.setMuted(muted);
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
  on('btn-next', () => startLevel((run ? run.state.level : lastLevel)));
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result' || phase === 'paused') startTutorial(); });
  on('btn-tut-replay', () => { if (phase === 'paused') resumeGame(); if (phase === 'playing' || phase === 'result') startTutorial(); });
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);

  bindTouch('btn-left', 'left');
  bindTouch('btn-right', 'right');
  bindTouch('btn-jump', 'jump');

  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = $(id);
    if (!sel) continue;
    sel.addEventListener('change', () => {
      ui.setLang(sel.value);
      renderTutorialStep();
      buildTitleStars();
      if (run) updateHud();
    });
  }
}

// ---------- 主循环 ----------
function frame(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;

  if (phase === 'playing' && run) {
    accumulator += dt;
    while (accumulator >= STEP) {
      run.step(input);
      accumulator -= STEP;
    }
    handleEvents(run.drainEvents());
    if (run && phase === 'playing') updateHud();
  }

  if (view.shake > 0) view.shake = Math.max(0, view.shake - dt * 20);

  try {
    renderer.draw(run ? run.state : null, dt, view);
  } catch (err) {
    // 渲染错误不打断主循环
  }

  requestAnimationFrame(frame);
}

// ---------- 调试契约（验收脚本通用） ----------
window.__ll = {
  state: {
    get phase() { return phase; },
    get lang() { return i18n.lang; },
  },
  run: () => run,
  start: (i) => startLevel(i == null ? (lastLevel || 0) : i),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => restartLevel(),
  home: () => goHome(),
  sim: () => (run ? run.state : null),
  save: (key, value) => Sdk.save(key, value),
  ui: () => ui,
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['move', 'jump', 'goal']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  debug: {
    state: () => (run ? run.state : null),
    loadLevel: (i) => startLevel(i),
    win: () => {
      if (!run) return false;
      run.state.phase = 'won';
      run.state.starsEarned = Math.min(3, 1 + run.state.starsCollected);
      finishRun({ type: 'win', stars: run.state.starsEarned, starsCollected: run.state.starsCollected, score: run.state.score });
      return true;
    },
  },
};

// ---------- 启动 ----------
bind();
syncDocumentLang();
ui.applyLang();
buildTitleStars();
renderer.draw(null, 0, view);
Sdk.track('load', {});
requestAnimationFrame(frame);
