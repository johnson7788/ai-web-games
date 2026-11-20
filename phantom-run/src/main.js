// 主入口：60Hz 固定步长 + 标题/选关/游戏/暂停/结算 + 交互式引导 + SDK 统一出口。
// 装配：sim(M1) / render(M2) / audio(M4) / ui(M3) / Lead 集成。
import { STEP } from '../config/game.config.js';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';
import { createRun } from './game/sim.js';
import { shouldJump } from './game/level.js';
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
let phase = 'title';        // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let fpsSamples = [];
let tutorialStep = -1;
let jumpQueued = false;
let holdSim = false;
let autoPlay = false;

const view = {
  fxQueue: [],
  shake: 0,
  sceneKey: 'dusk-tower',
};

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let unlocked = Math.max(1, Sdk.load('unlocked', 1) | 0);
let starsByLevel = Sdk.load('stars', {}) || {};
let tutorialDone = !!Sdk.load('tutorialDone', false);
let lastLevel = Sdk.load('lastLevel', 0) | 0;

Sdk.ready();
Sdk.onAdStart(() => { if (phase === 'playing') pauseGame(true); });
Sdk.onAdEnd(() => { if (phase === 'paused') resumeGame(); });
audio.setMuted(muted);
ui.setMuted(muted);

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

// ---------- 阶段状态机 ----------
function setPhase(p) { phase = p; }

function startLevel(idx) {
  idx = Math.max(0, Math.min(LEVEL_COUNT - 1, idx | 0));
  lastLevel = idx;
  run = createRun(idx, { seed: (Date.now() % 2147483647) || 1 });
  view.sceneKey = run.state.scene;
  view.fxQueue = [];
  view.shake = 0;
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
  startLevel(run ? run.state.level - 1 : lastLevel);
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
  const lv = LEVELS[h.level - 1] || {};
  $('hud-level').textContent = `${t('level')} ${h.level} · ${lv.name[i18n.lang] || lv.name.en || ''}`;
  $('hud-distance').textContent = `${t('distance', { d: Math.floor(h.distance / 60) })}`;
  $('hud-stars').textContent = `★ ${h.starsGot}/${h.starsTotal}`;
  const formEl = $('hud-form');
  formEl.textContent = h.form === 'corporeal' ? t('formCorporeal') : t('formPhantom');
  formEl.classList.toggle('corporeal', h.form === 'corporeal');
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
    const lv = LEVELS[i];
    cell.innerHTML =
      `<span class="lv-num">${i + 1}</span>` +
      `<span class="lv-name">${lv.name.en}</span>` +
      `<span class="lv-stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>`;
    cell.setAttribute('aria-label', `${t('level')} ${i + 1}${i + 1 > unlocked ? ' ' + t('locked') : ''}`);
    grid.appendChild(cell);
  }
  $('stars-total').textContent = `★ ${totalStars()} / ${LEVEL_COUNT * 3}`;
}

function showResult(res) {
  const { won, stars } = res;
  $('result-title').textContent = won ? t('winTitle') : t('loseTitle');
  $('result-title').classList.toggle('lose', !won);
  const starsEl = $('result-stars');
  starsEl.innerHTML = won
    ? `<span class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>${stars >= 3 ? `<em>${t('perfect')}</em>` : ''}`
    : '';
  $('result-meta').textContent = won ? t('distance', { d: Math.floor(res.distance / 60) }) : (res.reason === 'caught' ? t('loseCaught') : t('loseHit'));
  $('btn-next').style.display = won && res.hasNext ? '' : 'none';
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
  const stars = won ? (ev.stars || 1) : 0;
  if (won) {
    const idx = st.level;
    starsByLevel[idx] = Math.max(starsByLevel[idx] | 0, stars);
    if (idx < LEVEL_COUNT) unlocked = Math.max(unlocked, idx + 1);
    buildLevelGrid();
  }
  persist();
  Sdk.track(won ? 'win' : 'fail', { level: st.level, stars, distance: Math.floor(st.distance / 60) });
  showResult({ won, stars, distance: st.distance, reason: ev.reason || null, hasNext: st.level < LEVEL_COUNT });
  audio.event(won ? 'win' : 'lose');
}

// ---------- 交互式引导（首次自动弹，可跳过，完成/跳过后持久化） ----------
const TUT_STEPS = () => [
  { text: t('tutStep1'), spot: 'player' },
  { text: t('tutStep2'), spot: 'rune' },
  { text: t('tutStep3'), spot: 'wall' },
];

function layoutRect(which) {
  try {
    const lay = renderer.debugLayout();
    return lay && lay[which] ? lay[which] : null;
  } catch { return null; }
}

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
  const rect = s && s.spot ? layoutRect(s.spot) : null;
  const spot = $('tut-spotlight');
  if (rect && rect.x != null) {
    spot.style.display = 'block';
    spot.style.left = `${rect.x - 8}px`;
    spot.style.top = `${rect.y - 8}px`;
    spot.style.width = `${rect.w + 16}px`;
    spot.style.height = `${rect.h + 16}px`;
  } else {
    spot.style.display = 'none';
  }
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

// 真实动作驱动的自动推进（第 0 步 = 第一次跳跃）
function tutorialAdvance(evType) {
  if (tutorialStep !== 0) return;
  if (evType === 'jump') tutorialNext();
}

// ---------- 事件消费 ----------
function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    tutorialAdvance(ev.type);
    switch (ev.type) {
      case 'runeToggle':
        view.fxQueue.push({ type: 'dissolve', ttl: 0.5 });
        view.shake = 2;
        break;
      case 'moonPickup':
        view.fxQueue.push({ type: 'glow', ttl: 0.4 });
        break;
      case 'nearMiss':
        view.shake = 1;
        break;
      case 'collapse':
        view.shake = 3;
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
canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (run && phase === 'playing') jumpQueued = true;
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
    e.preventDefault();
    if (run && phase === 'playing') jumpQueued = true;
  }
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
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result') startTutorial(); });
  on('btn-tut-replay', () => { if (phase === 'paused') resumeGame(); startTutorial(); });
  on('btn-rotate-skip', () => { const rs = $('rotate-screen'); if (rs) rs.style.display = 'none'; });
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

  if (phase === 'playing' && run && !holdSim) {
    if (autoPlay) jumpQueued = jumpQueued || shouldJump(run.state);
    accumulator += dt;
    while (accumulator >= STEP) {
      run.step({ jump: jumpQueued });
      jumpQueued = false;
      accumulator -= STEP;
    }
    handleEvents(run.drainEvents());
    if (run && phase === 'playing') updateHud();
  }

  if (view.shake > 0) view.shake = Math.max(0, view.shake - dt * 18);
  for (const fx of view.fxQueue) if (fx.ttl > 0) fx.ttl -= dt;

  try {
    renderer.draw(run ? run.state : null, dt, view);
  } catch (err) {
    console.warn('render error', err);
  }
  view.fxQueue = view.fxQueue.filter((fx) => fx.ttl > 0);

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
    get steps() { return ['jump', 'rune', 'wall']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
  },
  startTutorial: () => startTutorial(),
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  save: (k, v) => Sdk.save(k, v),
  ui: () => ui,
  debug: {
    state: () => (run ? { ...run.state } : null),
    layout: () => { try { return renderer.debugLayout(); } catch { return null; } },
    loadLevel: (i) => startLevel(i),
    startSeeded: (i, seed) => {
      const idx = Math.max(0, Math.min(LEVEL_COUNT - 1, i | 0));
      lastLevel = idx;
      run = createRun(idx, { seed: seed | 0 || 1 });
      view.sceneKey = run.state.scene;
      view.fxQueue = [];
      view.shake = 0;
      setPhase('playing');
      ui.showGame();
      hideResult();
      updateHud();
      return true;
    },
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    startTutorial: () => startTutorial(),
    tutorialStep: () => tutorialStep,
    // 验收辅助：用完美跳跃策略把当前局推到终局
    fastForward: () => {
      if (!run) return false;
      let guard = 20000;
      while (guard-- > 0 && run.state.phase === 'running') {
        run.step({ jump: shouldJump(run.state) });
      }
      handleEvents(run.drainEvents());
      return true;
    },
    autoRun: () => window.__ll.debug.fastForward(),
    hold: (b) => { holdSim = !!b; },
    setAutoPlay: (b) => { autoPlay = !!b; },
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
