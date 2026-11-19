// 主入口：60Hz 固定步长 + 标题/选关/游戏/暂停/结算 + 教程引导 + SDK 统一出口
// 装配：sim（纯逻辑）/ render（canvas 程序化）/ ui（DOM）/ audio（WebAudio 程序化）。
import { STEP, GAME, LAYOUT } from '../config/game.config.js';
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
let phase = 'title';       // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let fpsSamples = [];
let tutorialStep = -1;     // -1 = 未激活
let lastLevel = 0;

const view = {
  fxQueue: [],             // {type, x, y, ttl, life}
  shake: 0,
  carTilt: { c1: 0, c2: 0 },
  cursor: { x: 0, y: 0 },
};

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let unlocked = Math.max(1, Sdk.load('unlocked', 1) | 0);
let starsByLevel = Sdk.load('stars', {}) || {};
let tutorialDone = !!Sdk.load('tutorialDone', false);
let bestScore = Sdk.load('bestScore', 0) | 0;

Sdk.ready(); // 不 await，不阻塞首屏
audio.setMuted(muted);
ui.setMuted(muted);

function persist() {
  Sdk.save('unlocked', unlocked);
  Sdk.save('stars', starsByLevel);
  Sdk.save('muted', muted);
  Sdk.save('tutorialDone', tutorialDone);
  Sdk.save('bestScore', bestScore);
  Sdk.save('lastLevel', lastLevel);
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
  setPhase('playing');
  ui.showGame();
  hideResult();
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
  startLevel(run ? (run.state.level - 1) : lastLevel);
}

function goHome() {
  run = null;
  setPhase('title');
  hideResult();
  ui.showTitle();
  buildLevelGrid();
}

// ---------- HUD / 关卡格 / 结算 ----------
function updateHud() {
  if (!run) return;
  const h = run.getHud();
  const lv = LEVELS[run.state.level - 1] || {};
  $('hud-level').textContent = `${t('level')} ${run.state.level}`;
  if (run.state.phase === 'countdown') {
    $('hud-time').textContent = `${Math.ceil(h.countdownLeft)}`;
  } else {
    $('hud-time').textContent = `${Math.ceil(h.timeLeft)}s`;
  }
  $('hud-time').classList.toggle('time-low', run.state.phase === 'playing' && h.timeLeft <= 5);
  $('hud-orbs').textContent = `● ${h.starsCollected}/${h.starsSpawned}`;
  $('hud-target').textContent = `${t('target')} ${Math.round(h.goal * 100)}%`;
  const comboEl = $('hud-combo');
  comboEl.textContent = h.combo > 1 ? `x${h.combo}` : '';
  comboEl.style.display = h.combo > 1 ? '' : 'none';
  $('hud-shield').style.display = h.shield ? '' : 'none';
  const name = lv.name ? (lv.name[i18n.lang] || lv.name.en || '') : '';
  $('hud-level').title = name;
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
  const total = totalStars();
  $('stars-total').textContent = `★ ${total} / ${LEVEL_COUNT * 3}`;
}

function showResult(res) {
  const { won, stars, rate, score, reason, hasNext, best } = res;
  $('result-title').textContent = won ? t('winTitle') : t('loseTitle');
  $('result-title').classList.toggle('lose', !won);
  const starsEl = $('result-stars');
  starsEl.innerHTML = won
    ? `<span class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>${stars >= 3 ? `<em>${t('perfect')}</em>` : ''}`
    : '';
  $('result-meta').innerHTML = won
    ? `${t('collectRate', { n: Math.round(rate * 100) })} · ${t('score')} ${score}` + (best ? ` · ${t('best')} ${best}` : '')
    : (reason === 'crash' ? t('crash') : t('timeUp'));
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
    const idx = st.level;
    starsByLevel[idx] = Math.max(starsByLevel[idx] | 0, stars);
    if (idx < LEVEL_COUNT) unlocked = Math.max(unlocked, idx + 1);
    bestScore = Math.max(bestScore, st.score);
    buildLevelGrid();
  }
  persist();
  Sdk.track(won ? 'win' : 'fail', {
    level: st.level, stars, score: st.score, combo: st.maxCombo,
    rate: st.rate, durationMs: Math.round(st.time * 1000),
  });
  showResult({
    won, stars, rate: st.rate, score: st.score,
    reason: st.reason || null, hasNext: st.level + 1 < LEVEL_COUNT,
    best: bestScore,
  });
  audio.event(won ? 'win' : 'lose');
}

// ---------- 教程引导 ----------
const TUT_STEPS = () => [
  { id: 'steerLeft', text: t('tutStep1') },
  { id: 'steerRight', text: t('tutStep2') },
  { id: 'collect', text: t('tutStep3') },
];

function startTutorial() {
  tutorialStep = 0;
  renderTutorialStep();
}

function renderTutorialStep() {
  const el = $('tutorial');
  if (tutorialStep < 0) { el.classList.add('hidden'); return; }
  const steps = TUT_STEPS();
  const s = steps[Math.min(tutorialStep, steps.length - 1)];
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
    switch (ev.type) {
      case 'collect': {
        const x = LAYOUT.LANE_CX[ev.lane];
        view.fxQueue.push({ type: 'burst', x, y: LAYOUT.CAR_Y, ttl: 0.4, life: 0.4 });
        break;
      }
      case 'nearMiss': {
        const x = LAYOUT.LANE_CX[ev.lane];
        view.fxQueue.push({ type: 'spark', x, y: LAYOUT.CAR_Y, ttl: 0.3, life: 0.3 });
        break;
      }
      case 'shieldBreak': {
        const x = LAYOUT.LANE_CX[ev.lane];
        view.fxQueue.push({ type: 'shieldFlash', x, y: LAYOUT.CAR_Y, ttl: 0.5, life: 0.5 });
        view.shake = 6;
        break;
      }
      case 'lose':
        view.shake = 10;
        finishRun(ev);
        return;
      case 'win':
        finishRun(ev);
        return;
      default:
        break;
    }
  }
}

// 贪婪驾驶（供调试/快进/自对弈同源策略）
function steerGreedy() {
  if (!run || run.state.phase !== 'playing') return;
  for (const car of ['c1', 'c2']) {
    const next = run.state.entities
      .filter((e) => !e.resolved && e.arrive >= run.state.time && (e.lane < 2 ? 'c1' : 'c2') === car)
      .sort((a, b) => a.arrive - b.arrive)[0];
    if (!next) continue;
    const lp = next.lane % 2;
    const here = run.state.cars[car] === lp;
    if (next.kind === 'barrier') { if (here) run.switchCar(car); }
    else { if (!here) run.switchCar(car); }
  }
}

// ---------- 输入 ----------
function canvasX(e) {
  const rect = canvas.getBoundingClientRect();
  return e.clientX - rect.left;
}

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (!run || phase !== 'playing') return;
  const x = canvasX(e);
  const leftHalf = x <= canvas.clientWidth * 0.5;
  const car = leftHalf ? 'c1' : 'c2';
  const res = run.switchCar(car);
  if (res.ok) {
    view.carTilt[car] = (leftHalf ? -0.32 : 0.32) * (res.lane === 0 ? 1 : -1);
    view.fxQueue.push({ type: 'spark', x: LAYOUT.LANE_CX[car === 'c1' ? res.lane : 2 + res.lane], y: LAYOUT.CAR_Y, ttl: 0.2, life: 0.2 });
  }
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
  if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'result')) restartLevel();
  if (e.code === 'KeyM') toggleMute();
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') { if (run && phase === 'playing') run.switchCar('c1'); }
  if (e.code === 'ArrowRight' || e.code === 'KeyD') { if (run && phase === 'playing') run.switchCar('c2'); }
});

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  ui.setMuted(muted);
  $('btn-mute').classList.toggle('is-muted', muted);
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
  on('btn-tut-replay', () => {
    if (phase === 'paused') resumeGame();
    if (phase === 'playing') startTutorial();
  });
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result') startTutorial(); });
  on('btn-rotate-skip', () => {
    const rs = $('rotate-screen');
    if (rs) rs.style.display = 'none';
  });
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
      const rt = $('rotate-text');
      const rb = $('btn-rotate-skip');
      if (rt) rt.textContent = t('rotateHint');
      if (rb) rb.textContent = t('rotateSkip');
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

  // 视觉衰减
  if (view.shake > 0) view.shake = Math.max(0, view.shake - dt * 22);
  view.carTilt.c1 *= 0.86;
  view.carTilt.c2 *= 0.86;

  try {
    renderer.draw(run ? run.state : null, dt, view);
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
    get steps() { return TUT_STEPS().map((s) => s.id); },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  save: (k, v) => Sdk.save(k, v),
  load: (k, f) => Sdk.load(k, f),
  ui: () => ui,
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: () => {
      if (!run) return null;
      const st = run.state;
      return {
        ...st,
        entities: st.entities.length,
        cars: { ...st.cars },
      };
    },
    layout: () => { try { return renderer.debugLayout(); } catch { return null; } },
    loadLevel: (i) => startLevel(i),
    startSeeded: (i, seed) => {
      const idx = Math.max(0, Math.min(LEVEL_COUNT - 1, i | 0));
      lastLevel = idx;
      run = createRun(idx, { seed: seed | 0 || 1 });
      setPhase('playing');
      ui.showGame();
      hideResult();
      updateHud();
      return true;
    },
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    advance: (s) => {
      if (!run) return false;
      let steps = Math.round((s || 1) * 60);
      while (steps-- > 0 && run.state.phase !== 'won' && run.state.phase !== 'lost') {
        steerGreedy();
        run.step(1 / 60);
      }
      handleEvents(run.drainEvents());
      if (run && phase === 'playing') updateHud();
      return true;
    },
    fastForward: () => {
      if (!run) return false;
      let guard = 60 * 60 * 3;
      while (guard-- > 0 && (run.state.phase === 'countdown' || run.state.phase === 'playing')) {
        steerGreedy();
        run.step(1 / 60);
        handleEvents(run.drainEvents());
      }
      return true;
    },
    armMute: () => muted,
  },
};

// ---------- 启动 ----------
bind();
syncDocumentLang();
ui.applyLang();
{
  const rt = $('rotate-text');
  const rb = $('btn-rotate-skip');
  if (rt) rt.textContent = t('rotateHint');
  if (rb) rb.textContent = t('rotateSkip');
}
buildLevelGrid();
$('btn-mute').classList.toggle('is-muted', muted);
Sdk.track('load', {});
requestAnimationFrame(frame);
