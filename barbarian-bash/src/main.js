// BARBARIAN BASH · 主入口：60Hz 固定步长 + 标题/选关/游戏/暂停/结算 + 教程引导 + SDK 出口
// 装配：sim（纯物理）/ render（程序化霓虹）/ audio（WebAudio）/ ui（DOM 壳）。
import { STEP, WORLD, PLAYER } from '../config/game.config.js';
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
let phase = 'title';            // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let tutorialStep = -1;

const view = {
  cursor: { x: 0, y: 0 },
  shake: 0,
};

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let unlocked = Math.max(1, Sdk.load('unlocked', 1) | 0);
let starsByLevel = Sdk.load('stars', {}) || {};
let tutorialDone = !!Sdk.load('tutorialDone', false);
let lastLevel = Sdk.load('lastLevel', 0) | 0;
let bestScore = Sdk.load('bestScore', 0) | 0;

Sdk.ready();
audio.setMuted(muted);
ui.setMuted(muted);

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
}

function restartLevel() {
  if (run) Sdk.track('restart', { level: run.state.level });
  startLevel(run ? run.state.levelIndex : lastLevel);
}

function goHome() {
  run = null;
  setPhase('title');
  ui.hideResult();
  ui.showTitle();
  buildLevelGrid();
}

// ---------- HUD / 关卡格 / 结算 ----------
function updateHud() {
  if (!run) return;
  const h = run.getHud();
  const lv = LEVELS[run.state.levelIndex];
  const name = lv.name[i18n.lang] || lv.name.en || '';
  $('hud-level').textContent = `${t('level')} ${run.state.level}${name ? ' · ' + name : ''}`;
  $('hud-time').textContent = `${t('time')} ${h.timeLeft}s`;
  $('hud-score').textContent = `${t('score')} ${h.score}`;
  $('hud-enemies').textContent = `${t('enemies')} ${h.enemiesLeft}`;
  const comboEl = $('hud-combo');
  if (h.streak >= 2) {
    comboEl.classList.add('combo-on');
    comboEl.textContent = `${t('combo')} ×${h.streak}`;
  } else {
    comboEl.classList.remove('combo-on');
  }
  // 弹药：明确数字（剩余/总量），比圆点更可读
  $('hud-ammo').textContent = `${t('ammo')} ${h.ammoLeft}/${h.ammoTotal}`;
}

function buildLevelGrid() {
  const grid = $('level-grid');
  if (!grid) return;
  grid.innerHTML = '';
  for (let i = 0; i < LEVEL_COUNT; i += 1) {
    const cell = document.createElement('button');
    cell.className = 'level-cell' + (i + 1 > unlocked ? ' level-locked' : '');
    cell.dataset.level = i;
    const stars = starsByLevel[i + 1] | 0;
    cell.innerHTML =
      `<span class="lv-num">${i + 1}</span>` +
      `<span class="lv-stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>`;
    cell.setAttribute('aria-label', `${t('level')} ${i + 1}`);
    grid.appendChild(cell);
  }
  $('stars-total').textContent = `★ ${totalStars()} / ${LEVEL_COUNT * 3}`;
}

function showResult(res) {
  const { won, stars, score, reason, hasNext } = res;
  const title = $('result-title');
  title.textContent = won ? t('winTitle') : t('loseTitle');
  title.classList.toggle('lose', !won);
  $('result-stars').innerHTML = won
    ? `<span class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>${stars >= 3 ? `<em>${t('perfect')}</em>` : ''}`
    : '';
  $('result-score').textContent = `${t('resultScore')}: ${score}`;
  $('result-meta').textContent = won ? '' : reasonText(reason);
  $('btn-next').style.display = won && hasNext ? '' : 'none';
  ui.showResult();
}

function reasonText(reason) {
  if (reason === 'timeOut') return t('loseTimeOut');
  if (reason === 'captiveLost') return t('loseCaptiveLost');
  return t('loseOutOfAmmo');
}

function finishRun(ev) {
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  const st = run.state;
  const won = ev.type === 'win';
  const stars = won ? (ev.stars || st.stars || 1) : 0;
  const score = st.score;
  if (won) {
    const idx = st.levelIndex;
    starsByLevel[st.level] = Math.max(starsByLevel[st.level] | 0, stars);
    if (idx + 1 < LEVEL_COUNT) unlocked = Math.max(unlocked, idx + 2);
    bestScore = Math.max(bestScore, score);
  }
  persist();
  Sdk.track(won ? 'win' : 'fail', { level: st.level, stars, score, reason: ev.reason || null });
  showResult({ won, stars, score, reason: ev.reason || null, hasNext: st.level < LEVEL_COUNT });
  audio.event(won ? 'win' : 'lose');
}

// ---------- 教程 ----------
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

function tutorialAdvance(evType) {
  // 教程以真实动作推进：第一次投掷推进到第 2 步，第一次击杀推进到第 3 步。
  if (tutorialStep < 0) return;
  if (tutorialStep === 0 && evType === 'throw') tutorialNext();
  else if (tutorialStep === 1 && evType === 'kill') tutorialNext();
}

// ---------- 事件消费 ----------
function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    tutorialAdvance(ev.type);
    switch (ev.type) {
      case 'throw':
        view.shake = 2;
        break;
      case 'crit':
        renderer.spawn('crit', ev.cx, ev.cy);
        renderer.spawnText(ev.cx, ev.cy - 40, 'CRIT!', '#4dffef', 24);
        view.shake = 3;
        break;
      case 'hit':
        renderer.spawn('break', ev.cx, ev.cy, { color: '#ff3d81' });
        break;
      case 'kill':
        renderer.spawn('explode', ev.cx, ev.cy);
        renderer.spawnText(ev.cx, ev.cy - 30, `+${ev.gain}`, '#ffe95c', 22);
        if (ev.streak >= 2) renderer.spawnText(ev.cx, ev.cy - 66, `${t('combo')} ×${ev.streak}`, '#ff5a9c', 20);
        view.shake = 4;
        break;
      case 'break':
        renderer.spawn('break', ev.cx, ev.cy, { color: '#b07a3f' });
        view.shake = 2;
        break;
      case 'explode':
        renderer.spawn('explode', ev.cx, ev.cy);
        view.shake = 6;
        break;
      case 'captiveHit':
        renderer.spawnText(ev.cx, ev.cy - 30, 'HOSTAGE!', '#ff5a3c', 26);
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
function canvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (WORLD.WIDTH / rect.width),
    y: (e.clientY - rect.top) * (WORLD.HEIGHT / rect.height),
  };
}

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (!run || phase !== 'playing') return;
  canvas.setPointerCapture(e.pointerId);
  run.aimStart();
  run.aimMove(canvasPos(e).x, canvasPos(e).y);
});

canvas.addEventListener('pointermove', (e) => {
  view.cursor = canvasPos(e);
  if (!run || phase !== 'playing') return;
  run.aimMove(view.cursor.x, view.cursor.y);
});

canvas.addEventListener('pointerup', (e) => {
  if (!run || phase !== 'playing') return;
  const res = run.throw();
  if (res.ok) updateHud();
});

canvas.addEventListener('pointercancel', () => {
  if (run) run.aimCancel();
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
  if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'result')) restartLevel();
  if (e.code === 'KeyM') toggleMute();
});

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  ui.setMuted(muted);
  persist();
}

// ---------- 自瞄（供 __ll.debug / verify / selfplay 复用） ----------
function pickTarget() {
  if (!run) return null;
  const st = run.state;
  // 先清障碍（木箱/玻璃/TNT），再打敌人
  const bar = st.barriers.find((b) => b.alive);
  if (bar) return { x: bar.cx, y: bar.cy };
  const e = st.enemies.find((x) => x.alive);
  if (!e) return null;
  return { x: e.cx + e.core.dx, y: e.cy + e.core.dy };
}

function autoSolve() {
  if (!run) return false;
  let guard = 6000;
  while (guard-- > 0 && run.state.phase === 'playing') {
    if (run.state.boulders.length === 0) {
      const t = pickTarget();
      if (t) {
        run.aim(t.x, t.y);
        run.throw();
      }
    }
    run.step(STEP);
  }
  handleEvents(run.drainEvents());
  if (run.state.phase === 'won' || run.state.phase === 'lost') updateHud();
  return run.state.phase === 'won';
}

function fastForward() {
  if (!run) return false;
  let guard = 4000;
  while (guard-- > 0 && run.state.phase === 'playing') run.step(STEP);
  handleEvents(run.drainEvents());
  return true;
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
  on('btn-tut-replay', () => { if (phase === 'paused') resumeGame(); if (phase === 'playing') startTutorial(); });
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result') startTutorial(); });
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);

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
    accumulator += dt;
    while (accumulator >= STEP) {
      run.step(STEP);
      accumulator -= STEP;
    }
    handleEvents(run.drainEvents());
    if (run && phase === 'playing') updateHud();
  }

  if (view.shake > 0) view.shake = Math.max(0, view.shake - dt * 18);

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
  start: (i) => startLevel(i == null ? (lastLevel || 0) : i),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => restartLevel(),
  home: () => goHome(),
  sim: () => (run ? run.state : null),
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['aim', 'throw', 'clear']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  save: (k, v) => Sdk.save(k, v),
  load: (k, d) => Sdk.load(k, d),
  share: () => Sdk.share(),
  ui,
  debug: {
    state: () => (run ? run.state : null),
    layout: () => renderer.debugLayout(),
    loadLevel: (i) => startLevel(i),
    startSeeded: (i, seed) => {
      const idx = Math.max(0, Math.min(LEVEL_COUNT - 1, i | 0));
      lastLevel = idx;
      run = createRun(idx, { seed: seed | 0 || 1 });
      setPhase('playing');
      ui.showGame();
      ui.hideResult();
      updateHud();
      return true;
    },
    autoSolve,
    fastForward,
    pickTarget: () => pickTarget(),
    giveUp: () => fastForward(),
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
