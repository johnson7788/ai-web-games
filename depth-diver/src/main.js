// 主入口：60Hz 固定步长 + 标题/选关/游戏/暂停/结算 + 交互引导 + SDK 统一出口 + i18n。
// 装配：sim(M1) / render+ui(M2) / audio(M4) / Lead 集成。HUD/结算/教程的 DOM 由这里直写。
import { STEP, GAME, MODULES } from '../config/game.config.js';
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
let tutorialStep = -1;
let resultShown = false;

const view = {
  shake: 0,
  layerFlash: 0,
  scatter: [],
  clock: 0,
};

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let unlocked = Math.max(1, Sdk.load('unlocked', 1) | 0);
let starsByLevel = Sdk.load('stars', {}) || {};
let tutorialDone = !!Sdk.load('tutorialDone', false);
let bestDepth = Sdk.load('bestDepth', 0) | 0;
let lastLevel = Sdk.load('lastLevel', 0) | 0;

Sdk.ready(); // 不 await，不阻塞首屏
Sdk.onAdStart(() => { if (phase === 'playing') pauseGame(true); });
Sdk.onAdEnd(() => { if (phase === 'paused') resumeGame(); });
audio.setMuted(muted);
ui.setMuted(muted);

function totalStars() {
  return Object.values(starsByLevel).reduce((a, b) => a + (b | 0), 0);
}

// 跨局成长模块：由总星数解锁（见 config/game.config.js MODULES）
function unlockedModules() {
  const out = {};
  for (const def of MODULES) out[def.id] = totalStars() >= def.stars;
  return out;
}

function persist() {
  Sdk.save('unlocked', unlocked);
  Sdk.save('stars', starsByLevel);
  Sdk.save('muted', muted);
  Sdk.save('tutorialDone', tutorialDone);
  Sdk.save('bestDepth', bestDepth);
  Sdk.save('lastLevel', lastLevel);
}

// ---------- 阶段状态机 ----------
function setPhase(p) { phase = p; }

function startLevel(idx) {
  idx = Math.max(0, Math.min(LEVEL_COUNT - 1, idx | 0));
  lastLevel = idx;
  resultShown = false;
  run = createRun(idx, { seed: (Date.now() % 2147483647) || 1, modules: unlockedModules() });
  view.shake = 0; view.layerFlash = 0; view.scatter = [];
  setPhase('playing');
  ui.showGame();
  hideResult();
  updateHud();
  audio.startBgm();
  Sdk.newRun({ level: idx + 1 });
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
  if (run) Sdk.track('restart', { level: run.state.level + 1 });
  startLevel(run ? run.state.level : lastLevel);
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
  $('hud-level').textContent = `${t('level')} ${run.state.level}${lv.name ? ' · ' + (lv.name[i18n.lang] || lv.name.en || '') : ''}`;
  $('hud-depth').textContent = `${t('depth')} ${h.depth}m · ${h.depthTarget}m`;
  $('hud-oxygen').textContent = `${t('oxygen')} ${Math.max(0, Math.ceil(h.oxygen))}s`;
  const ox = $('oxygen-fill');
  if (ox) ox.style.width = `${Math.max(0, Math.min(100, (h.oxygen / h.oxygenMax) * 100))}%`;
  $('hud-oxygen').classList.toggle('oxygen-low', h.oxygen <= h.oxygenMax * 0.3);
  $('hud-samples').textContent = `${t('samples')} ${'★'.repeat(h.samples)}${'☆'.repeat(Math.max(0, h.sampleTotal - h.samples))} ${h.samples}/${h.sampleTotal}`;
  $('hud-modules').textContent = moduleBadgeText();
}

function moduleBadgeText() {
  const m = unlockedModules();
  const on = MODULES.filter((d) => m[d.id]);
  return on.length ? '◈ ' + on.map((d) => d.id[0].toUpperCase()).join('') : '';
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
  $('best-depth').textContent = `${t('best')} ${bestDepth}m`;
}

function showResult(res) {
  const { won, stars, samples, sampleTotal, depth, reason, hasNext } = res;
  $('result-title').textContent = won ? t('winTitle') : t('loseTitle');
  $('result-title').classList.toggle('lose', !won);
  $('result-stars').innerHTML = won
    ? `<span class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>${stars >= 3 ? `<em>${t('perfect')}</em>` : ''}`
    : '';
  $('result-depth').textContent = `${t('depth')} ${depth}m`;
  $('result-meta').textContent = won
    ? `${t('samples')} ${samples}/${sampleTotal}`
    : (reason === 'crush' ? t('crushed') : t('suffocation'));
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
    if (st.depth > bestDepth) bestDepth = Math.floor(st.depth);
    buildLevelGrid();
  }
  persist();
  Sdk.track(won ? 'win' : 'fail', {
    level: st.level, stars, samples: st.samples, depth: Math.floor(st.depth),
    durationMs: Math.round((st.depth / Math.max(1, st.diveSpeed)) * 10000),
  });
  showResult({
    won, stars, samples: st.samples, sampleTotal: st.sampleTotal, depth: Math.floor(st.depth),
    reason: ev.reason || null, hasNext: st.level + 1 < LEVEL_COUNT,
  });
  audio.event(won ? 'win' : (ev.reason === 'crush' ? 'crush' : 'suffocate'));
}

// ---------- 交互引导（首次自动弹，可跳过，完成/跳过后持久化不再自动弹） ----------
const TUT_STEPS = () => [
  { text: t('tutStep1'), spot: 'play' },
  { text: t('tutStep2'), spot: 'play' },
  { text: t('tutStep3'), spot: 'hud' },
];

function layoutRect(which) {
  try {
    const lay = renderer.debugLayout();
    if (!lay) return null;
    if (which === 'play') return lay.play;
    if (which === 'hud') return lay.hud;
    return null;
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
  const card = $('tut-card');
  if (rect) {
    spot.style.display = 'block';
    spot.style.left = `${rect.x - 8}px`;
    spot.style.top = `${rect.y - 8}px`;
    spot.style.width = `${rect.w + 16}px`;
    spot.style.height = `${rect.h + 16}px`;
  } else {
    spot.style.display = 'none';
  }
  card.style.left = '';
  card.style.top = '';
  card.classList.remove('side');
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
const TUT_TRIGGER = ['thrust', 'sample', 'win'];

function tutorialAdvance(evType) {
  if (tutorialStep < 0 || tutorialStep >= TUT_TRIGGER.length) return;
  if (TUT_TRIGGER[tutorialStep] !== evType) return;
  tutorialStep += 1;
  if (tutorialStep >= TUT_TRIGGER.length) endTutorial();
  else renderTutorialStep();
}

function spawnScatter() {
  const st = run.state;
  const out = [];
  for (let i = 0; i < 14; i += 1) {
    out.push({
      x: st.player.x + (Math.random() * 2 - 1) * 220,
      y: st.player.y + (Math.random() * 2 - 1) * 180,
      r: 2 + Math.random() * 3,
      a: 1,
    });
  }
  view.scatter = out;
}

function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    tutorialAdvance(ev.type);
    switch (ev.type) {
      case 'sample': view.shake = 2; break;
      case 'sampleStar': view.shake = 4; break;
      case 'nearMiss': view.shake = 1; break;
      case 'layerChange': view.layerFlash = 1; spawnScatter(); break;
      case 'scatter': spawnScatter(); break;
      case 'crush': case 'suffocate': view.shake = 6; break;
      case 'win':
      case 'lose':
        finishRun(ev);
        return;
      default: break;
    }
  }
}

// ---------- 输入 ----------
const keys = { thrust: false, left: false, right: false, dive: false };
const pointer = { active: false, x: 0 };

function canvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  return { x: (e.clientX - rect.left) * (1280 / rect.width), y: (e.clientY - rect.top) * (720 / rect.height) };
}

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  pointer.active = true;
  pointer.x = canvasPos(e).x;
  if (run && phase === 'playing') {
    // 立即把当前指针位置当作水平目标
  }
});
canvas.addEventListener('pointermove', (e) => {
  if (pointer.active) pointer.x = canvasPos(e).x;
});
canvas.addEventListener('pointerup', () => { pointer.active = false; });
canvas.addEventListener('pointercancel', () => { pointer.active = false; });

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') { keys.thrust = true; e.preventDefault(); }
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;
  if (e.code === 'KeyS' || e.code === 'ArrowDown') keys.dive = true;
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
  if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'result')) restartLevel();
  if (e.code === 'KeyM') toggleMute();
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') keys.thrust = false;
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
  if (e.code === 'KeyS' || e.code === 'ArrowDown') keys.dive = false;
});

function computeInput() {
  const thrust = keys.thrust || pointer.active;
  let left = keys.left;
  let right = keys.right;
  if (pointer.active && run) {
    const px = run.state.player.x;
    if (pointer.x < px - 26) left = true;
    else if (pointer.x > px + 26) right = true;
  }
  return { thrust, left, right, dive: keys.dive };
}

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
  on('btn-next', () => startLevel((run ? run.state.level : lastLevel) + 1));
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result') startTutorial(); });
  on('btn-tut-replay', () => {
    if (phase === 'paused') resumeGame();
    if (phase === 'playing') startTutorial();
  });
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
  view.clock += dt;

  if (phase === 'playing' && run) {
    accumulator += dt;
    while (accumulator >= STEP) {
      run.input(computeInput());
      run.step(STEP);
      accumulator -= STEP;
    }
    handleEvents(run.drainEvents());
    if (run && phase === 'playing') updateHud();
  }

  if (view.shake > 0) view.shake = Math.max(0, view.shake - dt * 18);
  if (view.layerFlash > 0) view.layerFlash = Math.max(0, view.layerFlash - dt * 1.2);
  for (const sp of view.scatter) { sp.a -= dt * 2.2; sp.x += (Math.random() * 2 - 1) * 30; }
  view.scatter = view.scatter.filter((sp) => sp.a > 0);

  try {
    renderer.draw(run ? run.state : null, dt, view);
  } catch (err) {
    console.warn('render error', err);
  }

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
  save: Sdk,
  ui: () => ui,
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['thrust', 'sample', 'win']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: () => {
      if (!run) return null;
      const st = run.state;
      return { ...st, obstacleCount: st.obstacles.length, pickupCount: st.pickups.length, hasChaser: !!st.chaser };
    },
    layout: () => { try { return renderer.debugLayout(); } catch { return null; } },
    loadLevel: (i) => startLevel(i),
    startSeeded: (i, seed) => {
      const idx = Math.max(0, Math.min(LEVEL_COUNT - 1, i | 0));
      lastLevel = idx;
      resultShown = false;
      run = createRun(idx, { seed: seed | 0 || 1, modules: unlockedModules() });
      view.shake = 0; view.layerFlash = 0; view.scatter = [];
      setPhase('playing');
      ui.showGame();
      hideResult();
      updateHud();
      audio.startBgm();
      return true;
    },
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    startTutorial: () => startTutorial(),
    tutorialStep: () => tutorialStep,
    autoPlaceSolution: () => false, // 本游戏无「铺路」概念
    // 快进到终局（verify/gif 用）：无输入自动推进，直到 won/lost
    fastForward: () => {
      if (!run) return false;
      try {
        let guard = 4000;
        while (guard-- > 0 && run.state.phase === 'playing') {
          run.step(0.2);
          handleEvents(run.drainEvents());
        }
        return true;
      } catch { return false; }
    },
    giveUp: () => window.__ll.debug.fastForward(),
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
