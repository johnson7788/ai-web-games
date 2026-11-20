// Sprout Hop · 主入口：60Hz 固定步长 + 标题/选关/游戏/暂停/结算 + 拖拽蓄力跳 + 教程引导 + SDK 统一出口。
// 契约见 docs/DELIVERY.md 与 README。装配：sim(M1) / render+ui(M2) / audio(M4) / Lead 集成。
// 职责：ui.js 只做语言与屏幕显隐；HUD/结算/关卡格/教程的 DOM 由这里直写。
import { STEP, WORLD, PHYS } from '../config/game.config.js';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';
import { createRun } from './game/sim.js';
import { aimToPlatform } from './game/level.js';
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
let tutorialStep = -1;
let dragStart = null;      // {x,y} 拖拽起点（逻辑坐标）
let dragVec = { x: 0, y: 0 };

const view = {
  fxQueue: [],
  shake: 0,
  sceneKey: 'dawn',
};

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let unlocked = Math.max(1, Sdk.load('unlocked', 1) | 0);
let starsByLevel = Sdk.load('stars', {}) || {};
let tutorialDone = !!Sdk.load('tutorialDone', false);
let bestScore = Sdk.load('best', 0) | 0;
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
  Sdk.save('best', bestScore);
  Sdk.save('lastLevel', lastLevel);
}

function totalStars() {
  return Object.values(starsByLevel).reduce((a, b) => a + (b | 0), 0);
}

// ---------- 阶段状态机 ----------
function setPhase(p) { phase = p; }

function startLevel(idx, seed) {
  idx = Math.max(0, Math.min(LEVEL_COUNT - 1, idx | 0));
  lastLevel = idx;
  run = createRun(idx, { seed: (seed ?? (Date.now() % 2147483647)) || 1 });
  view.sceneKey = (LEVELS[idx] && LEVELS[idx].scene) || 'dawn';
  view.fxQueue = [];
  view.shake = 0;
  dragStart = null;
  dragVec = { x: 0, y: 0 };
  setPhase('playing');
  ui.showGame();
  hideResult();
  hideRevivePanel();
  updateHud();
  audio.startBgm();
  Sdk.newRun({ level: idx + 1 });
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
  lastTime = performance.now();
}

function restartLevel() {
  if (run) Sdk.track('restart', { level: run.state.level });
  startLevel(run ? run.state.level - 1 : lastLevel);
}

function goHome() {
  run = null;
  setPhase('title');
  hideResult();
  hideRevivePanel();
  ui.showTitle();
  buildLevelGrid();
}

// ---------- HUD / 关卡格 / 结算 ----------
function updateHud() {
  if (!run) return;
  const h = run.getHud();
  const lv = LEVELS[run.state.level - 1] || {};
  const name = lv.name ? (lv.name[i18n.lang] || lv.name.en || '') : '';
  $('hud-level').textContent = `${t('level')} ${run.state.level}${name ? ' · ' + name : ''}`;
  $('hud-jumps').textContent = `🚩 ${h.jumps}/${h.goalJumps}`;
  $('hud-score').textContent = `✦ ${h.score}`;
  $('hud-combo').textContent = h.combo >= 2 ? `${t('combo')} ×${h.combo}` : '';
  const windEl = $('hud-wind');
  if (h.wind > 1) { windEl.style.display = ''; windEl.textContent = `🌬 ${t('windTail')}`; }
  else if (h.wind < 1) { windEl.style.display = ''; windEl.textContent = `💨 ${t('windHead')}`; }
  else windEl.style.display = 'none';
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
  const { won, stars, score, jumps, reason, hasNext, canRevive } = res;
  $('result-title').textContent = won ? t('winTitle') : t('loseTitle');
  $('result-title').classList.toggle('lose', !won);
  const starsEl = $('result-stars');
  starsEl.innerHTML = won
    ? `<span class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>${stars >= 3 ? `<em>${t('perfect')}</em>` : ''}`
    : '';
  $('result-meta').textContent = won
    ? `${t('score')} ${score} · ${jumps}/${run ? run.state.goalJumps : ''}`
    : (reason === 'water' ? t('water') : reason === 'oob' ? t('oob') : t('collapse'));
  $('btn-next').style.display = won && hasNext ? '' : 'none';
  showRevivePanel(canRevive);
  $('screen-result').classList.remove('hidden');
}

function hideResult() {
  $('screen-result').classList.add('hidden');
}

function showRevivePanel(canRevive) {
  const el = $('revive-panel');
  if (!el) return;
  el.classList.toggle('hidden', !canRevive);
}

function hideRevivePanel() {
  const el = $('revive-panel');
  if (el) el.classList.add('hidden');
}

function finishRun(ev) {
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  const st = run.state;
  const won = ev.type === 'win';
  if (won) {
    const stars = ev.stars || st.stars || 1;
    const idx = st.level;
    starsByLevel[idx] = Math.max(starsByLevel[idx] | 0, stars);
    if (idx < LEVEL_COUNT) unlocked = Math.max(unlocked, idx + 1);
    bestScore = Math.max(bestScore, st.score);
    persist();
    buildLevelGrid();
    Sdk.levelCleared({ level: idx, stars, score: st.score });
  }
  showResult({
    won, stars: won ? (ev.stars || st.stars || 1) : 0, score: st.score, jumps: st.jumps,
    reason: ev.reason || null, hasNext: st.level < LEVEL_COUNT,
    canRevive: !won && st.relivesUsed < st.maxRelives,
  });
  audio.event(won ? 'win' : 'lose', ev);
}

function doRevive() {
  if (!run || run.state.phase !== 'lost') return;
  const ok = run.revive();
  if (!ok) return;
  hideResult();
  hideRevivePanel();
  setPhase('playing');
  audio.startBgm();
  Sdk.track('revive', { level: run.state.level });
  updateHud();
}

function doGiveUp() {
  if (!run) return;
  run.denyRevive();
  Sdk.gameOver({ level: run.state.level, score: run.state.score });
  Sdk.track('fail', { level: run.state.level });
  showRevivePanel(false);
}

// ---------- 教程引导（首次自动弹，可跳过，完成/跳过后持久化不再自动弹） ----------
const TUT_STEPS = () => [
  { text: t('tutStep1'), spot: 'pea' },
  { text: t('tutStep2'), spot: 'pea' },
  { text: t('tutStep3'), spot: 'goal' },
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
  const rect = s && s.spot && layoutRect(s.spot);
  const spot = $('tut-spotlight');
  if (rect) {
    spot.style.display = 'block';
    spot.style.left = `${rect.x - 10}px`;
    spot.style.top = `${rect.y - 10}px`;
    spot.style.width = `${rect.w + 20}px`;
    spot.style.height = `${rect.h + 20}px`;
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

const TUT_TRIGGER = ['aim', 'launch', 'land'];

function tutorialAdvance(evType) {
  if (tutorialStep < 0 || tutorialStep >= TUT_TRIGGER.length) return;
  if (TUT_TRIGGER[tutorialStep] !== evType) return;
  tutorialStep += 1;
  if (tutorialStep >= TUT_TRIGGER.length) endTutorial();
  else renderTutorialStep();
}

// ---------- 事件消费 ----------
function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    tutorialAdvance(ev.type);
    switch (ev.type) {
      case 'launch':
        view.shake = 2;
        break;
      case 'land':
        view.shake = 3;
        view.fxQueue.push({ type: ev.perfect ? 'ring' : 'podBurst', x: run ? run.state.pea.x : 0, y: run ? run.state.pea.y : 0, ttl: 0.4, max: 0.4, seed: Math.random() * 6 });
        if (ev.perfect) view.fxQueue.push({ type: 'podBurst', x: run ? run.state.pea.x : 0, y: run ? run.state.pea.y : 0, ttl: 0.5, max: 0.5, seed: Math.random() * 6 });
        break;
      case 'perfect':
        view.shake = 2;
        break;
      case 'water':
      case 'oob':
        view.fxQueue.push({ type: 'splash', x: run ? run.state.pea.x : 0, y: run ? run.state.pea.y : 0, ttl: 0.6, max: 0.6, seed: Math.random() * 6 });
        break;
      case 'collapse':
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
  const p = canvasPos(e);
  dragStart = p;
  dragVec = { x: 0, y: 0 };
  run.aimStart();
});

canvas.addEventListener('pointermove', (e) => {
  if (!run || phase !== 'playing' || !dragStart) return;
  const p = canvasPos(e);
  dragVec = { x: dragStart.x - p.x, y: dragStart.y - p.y };
  run.aimSet(dragVec);
});

function pointerUp(e) {
  if (!run || phase !== 'playing' || !dragStart) return;
  const p = canvasPos(e);
  const dv = { x: dragStart.x - p.x, y: dragStart.y - p.y };
  run.aimSet(dv);
  const speed = { x: dv.x * PHYS.DRAG_K, y: dv.y * PHYS.DRAG_K };
  run.launch(speed);
  dragStart = null;
  dragVec = { x: 0, y: 0 };
}

canvas.addEventListener('pointerup', pointerUp);
canvas.addEventListener('pointercancel', pointerUp);

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
  on('btn-next', () => startLevel((run ? run.state.level : lastLevel))); // run.state.level 是 1 基
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-revive', doRevive);
  on('btn-giveup', doGiveUp);
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

  if (view.shake > 0) view.shake = Math.max(0, view.shake - dt * 16);
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

// ---------- 调试契约（截图/验收脚本通用） ----------
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
    get steps() { return ['aim', 'launch', 'land']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  save: (key, value) => Sdk.save(key, value),
  load: (key, fallback) => Sdk.load(key, fallback),
  ui: () => ui,
  debug: {
    state: () => {
      if (!run) return null;
      const st = run.state;
      return { ...st, platforms: st.platforms.length, jumps: st.jumps, goalJumps: st.goalJumps };
    },
    layout: () => { try { return renderer.debugLayout(); } catch { return null; } },
    loadLevel: (i) => startLevel(i),
    startSeeded: (i, seed) => {
      const idx = Math.max(0, Math.min(LEVEL_COUNT - 1, i | 0));
      startLevel(idx, seed | 0 || 1);
      return true;
    },
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    startTutorial: () => startTutorial(),
    tutorialStep: () => tutorialStep,
    // 自动玩：从当前关打到结算（bot/验收/录 gif 共用）
    autoPlaceSolution: () => {
      if (!run) return false;
      let guard = 30000;
      while (guard-- > 0) {
        if (run.state.phase === 'won') break;
        if (run.state.phase === 'lost') {
          if (run.state.relivesUsed < run.state.maxRelives) { run.revive(); continue; }
          break;
        }
        if (run.state.phase === 'aiming') {
          const spd = aimToPlatform(run.state, run.state.cur + 1);
          if (!spd) break;
          run.launch(spd);
        } else {
          run.step(1 / 60);
        }
        handleEvents(run.drainEvents());
        if (phase === 'result') break;
      }
      return true;
    },
    // 营销录屏辅助：瞄准下一平台（露出轨迹弧线）与松手跳
    aimNext: () => {
      if (!run) return false;
      const spd = aimToPlatform(run.state, run.state.cur + 1);
      if (!spd) return false;
      run.aimStart();
      run.aimSet({ x: spd.x / PHYS.DRAG_K, y: spd.y / PHYS.DRAG_K });
      return true;
    },
    launchAimed: () => {
      if (!run || run.state.phase !== 'aiming') return false;
      const d = run.state.aiming.drag;
      return run.launch({ x: d.x * PHYS.DRAG_K, y: d.y * PHYS.DRAG_K }).ok;
    },
    // 快进飞行到本跳结束（营销/验收辅助）
    fastForward: () => {
      if (!run) return false;
      try {
        let guard = 2000;
        while (guard-- > 0 && run.state.phase === 'flying') {
          run.step(1 / 60);
          handleEvents(run.drainEvents());
        }
        return true;
      } catch { return false; }
    },
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
