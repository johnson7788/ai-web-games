// APACHE TRAIL · 主入口：60Hz 固定步长 + 标题/关卡/游戏/暂停/结算 + 教程 + SDK 统一出口。
// 装配：sim / render / audio / ui。契约见 docs/batch3/apache-trail.md。
import { STEP } from '../config/game.config.js';
import { LEVELS, LEVEL_COUNT, createRun } from './game/sim.js';
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
let fpsSamples = [];
let tutorialStep = -1;
let prevTimeLeft = null;

// 标题屏的装饰性场景（让标题截图也有跑者主体）
const TITLE_STATE = {
  levelIndex: 0,
  player: { x: 580, y: 616, facing: 1, state: 'idle', shield: 0, invuln: 0 },
};

// 键盘 / 触屏输入状态
const key = { left: false, right: false };
const touch = { left: false, right: false };

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let unlocked = Math.max(1, Sdk.load('unlocked', 1) | 0);
let starsByLevel = Sdk.load('stars', {}) || {};
let tutorialDone = !!Sdk.load('tutorialDone', false);
let lastLevel = Sdk.load('lastLevel', 0) | 0;
let bestScore = Sdk.load('bestScore', 0) | 0;

Sdk.ready(); // 不 await，不阻塞首屏
Sdk.onAdStart(() => { if (phase === 'playing') pauseGame(true); });
Sdk.onAdEnd(() => { if (phase === 'paused') resumeGame(); });
audio.setMuted(muted);

function persist() {
  Sdk.save('unlocked', unlocked);
  Sdk.save('stars', starsByLevel);
  Sdk.save('muted', muted);
  Sdk.save('tutorialDone', tutorialDone);
  Sdk.save('lastLevel', lastLevel);
  Sdk.save('bestScore', bestScore);
}

function totalStars() {
  return Object.values(starsByLevel).reduce((a, b) => a + (b | 0), 0);
}

// ---------- 阶段状态机 ----------
function setPhase(p) { phase = p; }

function startLevel(idx) {
  idx = Math.max(0, Math.min(LEVEL_COUNT - 1, idx | 0));
  lastLevel = idx;
  run = createRun(idx, { seed: (Date.now() % 2147483647) || 1 });
  prevTimeLeft = run.state.timeLeft;
  setPhase('playing');
  ui.showGame();
  ui.hide('result');
  ui.hide('pause');
  updateHud();
  audio.startBgm();
  Sdk.track('start', { level: idx + 1 });
  if (!tutorialDone && idx === 0) startTutorial();
}

function pauseGame(silent) {
  if (phase !== 'playing') return;
  setPhase('paused');
  audio.stopBgm();
  if (!silent) ui.showPause();
}

function resumeGame() {
  if (phase !== 'paused') return;
  setPhase('playing');
  ui.hidePause();
  audio.startBgm();
}

function restartLevel() {
  if (run) Sdk.track('restart', { level: run.state.level });
  startLevel(run ? run.state.levelIndex : lastLevel);
}

function goHome() {
  run = null;
  setPhase('title');
  ui.hide('result');
  ui.hide('pause');
  ui.showTitle();
  buildLevelGrid();
}

// ---------- HUD / 关卡格 / 结算 ----------
function updateHud() {
  if (!run) return;
  const h = run.getHud();
  const lv = LEVELS[h.levelIndex] || {};
  $('hud-level').textContent = `${t('level')} ${h.level} · ${(lv.name && (lv.name[i18n.lang] || lv.name.en)) || ''}`;
  const secs = Math.max(0, Math.ceil(h.timeLeft));
  const timeEl = $('hud-time');
  timeEl.textContent = `${t('time')} ${secs}s`;
  timeEl.classList.toggle('time-low', secs <= 10);
  $('hud-crystals').textContent = `◆ ${h.crystals}/${h.crystalsTotal}`;
  $('hud-combo').textContent = h.combo >= 2 ? `×${h.combo}` : '';
  $('hud-combo').style.display = h.combo >= 2 ? '' : 'none';
  $('hud-shield').style.display = h.shield > 0 ? '' : 'none';
}

function buildLevelGrid() {
  const grid = $('level-grid');
  if (!grid) return;
  grid.innerHTML = '';
  for (let i = 0; i < LEVEL_COUNT; i += 1) {
    const cell = document.createElement('button');
    cell.className = 'level-cell' + (i + 1 > unlocked ? ' locked' : '');
    cell.dataset.level = i;
    const stars = starsByLevel[i + 1] | 0;
    cell.innerHTML =
      `<span class="lv-num">${i + 1}</span>` +
      `<span class="lv-stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>`;
    cell.setAttribute('aria-label', `${t('level')} ${i + 1}${i + 1 > unlocked ? ' ' + t('locked') : ''}`);
    grid.appendChild(cell);
  }
  $('stars-total').textContent = `★ ${totalStars()} / ${LEVEL_COUNT * 3}`;
}

function showResult(res) {
  const { won, stars, crystals, crystalsTotal, timeLeft, reason, score, hasNext } = res;
  $('result-title').textContent = won ? t('winTitle') : t('loseTitle');
  $('result-title').classList.toggle('lose', !won);
  const starsEl = $('result-stars');
  starsEl.innerHTML = won
    ? `<span class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>${stars >= 3 ? `<em>${t('perfect')}</em>` : ''}`
    : '';
  $('result-time').textContent = won
    ? `${t('resultTime')} ${Math.ceil(timeLeft)}s · ◆ ${crystals}/${crystalsTotal}`
    : (reason === 'timeOut' ? t('timeOut') : reason === 'fall' ? t('fall') : t('hazard'));
  $('result-meta').textContent = `${t('resultScore')} ${score}`;
  $('btn-next').style.display = won && hasNext ? '' : 'none';
  $('screen-result').classList.remove('hidden');
}

function hideResult() {
  $('screen-result').classList.add('hidden');
}

function finishRun(ev) {
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  const st = run.state;
  const won = ev.type === 'win';
  const stars = won ? (ev.stars || st.stars || 1) : 0;
  if (won) {
    const idx = st.levelIndex;
    starsByLevel[idx + 1] = Math.max(starsByLevel[idx + 1] | 0, stars);
    if (idx + 1 < LEVEL_COUNT) unlocked = Math.max(unlocked, idx + 2);
    bestScore = Math.max(bestScore, st.score);
    buildLevelGrid();
  }
  persist();
  Sdk.track(won ? 'win' : 'fail', { level: st.level, stars, crystals: st.crystalsCollected, score: st.score });
  showResult({
    won, stars, crystals: st.crystalsCollected, crystalsTotal: st.crystalsTotal,
    timeLeft: st.timeLeft, reason: st.reason || null, score: st.score, hasNext: st.levelIndex + 1 < LEVEL_COUNT,
  });
  audio.event(won ? 'win' : 'lose');
}

// ---------- 教程引导 ----------
const TUT_STEPS = () => [
  { key: 'move', text: t('tutStep1') },
  { key: 'jump', text: t('tutStep2') },
  { key: 'collect', text: t('tutStep3') },
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

function tutorialAdvance(evType) {
  if (tutorialStep < 0) return;
  const cur = TUT_STEPS()[tutorialStep];
  if (!cur) return;
  if ((cur.key === 'move' && evType === 'run') ||
      (cur.key === 'jump' && (evType === 'jump' || evType === 'doubleJump')) ||
      (cur.key === 'collect' && evType === 'collect')) {
    tutorialStep += 1;
    if (tutorialStep >= TUT_STEPS().length) endTutorial();
    else renderTutorialStep();
  }
}

// ---------- 事件消费 ----------
function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    tutorialAdvance(ev.type);
    switch (ev.type) {
      case 'jump':
      case 'doubleJump':
        renderer.spawn(run.state.player.x + 20, run.state.player.y + 40, '#ffe0b0', 4, 0.3, 40);
        break;
      case 'land':
        renderer.spawn(run.state.player.x + 20, run.state.player.y + 44, '#d07a55', 5, 0.35, 70);
        break;
      case 'collect':
        renderer.spawn(run.state.player.x + 20, run.state.player.y + 20, '#ffd24a', 8, 0.5, 90);
        break;
      case 'combo':
        renderer.shake(2);
        break;
      case 'shield':
        renderer.spawn(run.state.player.x + 20, run.state.player.y + 20, '#7fe0d0', 10, 0.6, 100);
        break;
      case 'shieldBreak':
        renderer.shake(6);
        renderer.spawn(run.state.player.x + 20, run.state.player.y + 20, '#e8fffb', 12, 0.5, 120);
        break;
      case 'death':
        renderer.shake(10);
        renderer.spawn(run.state.player.x + 20, run.state.player.y + 20, '#e5484d', 14, 0.7, 140);
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
function syncInputToRun() {
  if (!run || phase !== 'playing') return;
  run.input.left = key.left || touch.left;
  run.input.right = key.right || touch.right;
}

window.addEventListener('keydown', (e) => {
  const c = e.code;
  if (c === 'ArrowLeft' || c === 'KeyA') { key.left = true; }
  else if (c === 'ArrowRight' || c === 'KeyD') { key.right = true; }
  else if (c === 'Space' || c === 'ArrowUp' || c === 'KeyW') {
    e.preventDefault();
    if (phase === 'playing' && run) { run.pressJump(); audio.unlock(); }
  } else if (c === 'Escape' || c === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  } else if (c === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'result')) {
    restartLevel();
  } else if (c === 'KeyM') {
    toggleMute();
  }
});

window.addEventListener('keyup', (e) => {
  const c = e.code;
  if (c === 'ArrowLeft' || c === 'KeyA') key.left = false;
  else if (c === 'ArrowRight' || c === 'KeyD') key.right = false;
});

function bindTouch(id, onDown, onUp) {
  const el = $(id);
  if (!el) return;
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); audio.unlock(); onDown(); });
  el.addEventListener('pointerup', (e) => { e.preventDefault(); onUp && onUp(); });
  el.addEventListener('pointercancel', (e) => { onUp && onUp(); });
  el.addEventListener('pointerleave', (e) => { onUp && onUp(); });
}

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  $('btn-mute').classList.toggle('is-muted', muted);
  $('btn-mute').setAttribute('aria-label', muted ? t('unmute') : t('mute'));
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
  on('btn-next', () => startLevel((run ? run.state.levelIndex : lastLevel) + 1));
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-tut-replay', () => { if (phase === 'paused') resumeGame(); if (phase === 'playing' || phase === 'result') startTutorial(); });
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result') startTutorial(); });
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);

  bindTouch('btn-left', () => { touch.left = true; }, () => { touch.left = false; });
  bindTouch('btn-right', () => { touch.right = true; }, () => { touch.right = false; });
  bindTouch('btn-jump', () => { if (phase === 'playing' && run) run.pressJump(); });

  $('level-grid')?.addEventListener('click', (e) => {
    const idx = e.target.closest('[data-level]')?.dataset.level;
    if (idx == null) return;
    const i = +idx;
    if (i + 1 > unlocked) return;
    startLevel(i);
  });

  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = $(id);
    if (!sel) continue;
    sel.addEventListener('change', () => {
      ui.setLang(sel.value);
      renderTutorialStep();
      buildLevelGrid();
      if (run) updateHud();
    });
  }
}

// ---------- 主循环 ----------
function frame(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;

  if (phase === 'playing' && run) {
    syncInputToRun();
    accumulator += dt;
    while (accumulator >= STEP) {
      run.step(STEP);
      accumulator -= STEP;
    }
    handleEvents(run.drainEvents());
    if (run && phase === 'playing') {
      updateHud();
      // 倒计时滴答
      const left = run.state.timeLeft;
      if (prevTimeLeft !== null && Math.ceil(left) < Math.ceil(prevTimeLeft) && left > 0 && left <= 5) {
        audio.event('countdownTick', { timeLeft: left });
      }
      prevTimeLeft = left;
    }
  }

  try {
    // 标题屏也画一个站立的跑者（保证标题截图有主体剪影）
    if (run) renderer.draw(run.state, dt);
    else renderer.draw(TITLE_STATE, dt);
  } catch (err) {
    console.warn('render error', err);
  }

  if (fpsSamples.length < 600 && dt > 0) fpsSamples.push(1 / dt);

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
  start: (i) => startLevel(i == null ? (lastLevel || 0) : i),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => restartLevel(),
  home: () => goHome(),
  sim: () => (run ? run.state : null),
  save: (key, value) => Sdk.save(key, value),
  load: (key, fb) => Sdk.load(key, fb),
  ui: () => ui,
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['move', 'jump', 'collect']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: () => (run ? run.state : null),
    loadLevel: (i) => startLevel(i),
    startSeeded: (i, seed) => {
      const idx = Math.max(0, Math.min(LEVEL_COUNT - 1, i | 0));
      lastLevel = idx;
      run = createRun(idx, { seed: seed | 0 || 1 });
      prevTimeLeft = run.state.timeLeft;
      setPhase('playing');
      ui.showGame();
      ui.hide('result');
      updateHud();
      return true;
    },
    winNow: () => { if (run) run.debug.winNow(); },
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
  },
};

// ---------- 启动 ----------
bind();
syncDocumentLang();
ui.applyLang();
buildLevelGrid();
$('btn-mute').classList.toggle('is-muted', muted);
$('btn-mute').setAttribute('aria-label', muted ? t('unmute') : t('mute'));
$('btn-mute').textContent = muted ? '🔇' : '🔊';
ui.showTitle();
Sdk.track('load', {});
requestAnimationFrame(frame);
