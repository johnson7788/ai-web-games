// LAUNCH LEGENDS · 主入口：60Hz 固定步长 + 标题/选关/游戏/暂停/结算 + 教程引导 + SDK 统一出口
// 装配：sim(M1) / render+ui(M2) / audio(M4) / Lead 集成。
// 职责划分：ui.js 只做语言与屏幕显隐；HUD/结算/关卡格/教程的 DOM 由这里直写。
import { STEP, WORLD } from '../config/game.config.js';
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

let run = null;            // 当前对局
let phase = 'title';       // title | playing | paused | result
let autopilotMode = false; // 录屏/自动化时由 __ll.debug.setAutopilot 开启
let lastTime = performance.now();
let accumulator = 0;
let fpsSamples = [];
let tutorialStep = -1;     // -1 = 未激活

// 视图状态传给 renderer
const view = {
  shake: 0,
  sparks: [],              // {x,y,ttl,max}
  fireworks: [],           // {x,y,ttl,max,seed}
  sceneKey: 'town',
};

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let unlocked = Math.max(1, Sdk.load('unlocked', 1) | 0);
let starsByLevel = Sdk.load('stars', {}) || {};
let best = Sdk.load('best', 0) | 0;
let tutorialDone = !!Sdk.load('tutorialDone', false);
let lastLevel = Sdk.load('lastLevel', 0) | 0;

Sdk.ready(); // 不 await，不阻塞首屏
Sdk.onAdStart(() => { if (phase === 'playing') pauseGame(true); });
Sdk.onAdEnd(() => { if (phase === 'paused') resumeGame(); });
audio.setMuted(muted);
ui.setMuted(muted);

function persist() {
  Sdk.save('unlocked', unlocked);
  Sdk.save('stars', starsByLevel);
  Sdk.save('muted', muted);
  Sdk.save('tutorialDone', tutorialDone);
  Sdk.save('best', best);
  Sdk.save('lastLevel', lastLevel);
}

function totalStars() {
  return Object.values(starsByLevel).reduce((a, b) => a + (b | 0), 0);
}

// ---------- 阶段状态机 ----------
function setPhase(p) { phase = p; }

function beginRun(idx, seed) {
  idx = Math.max(0, Math.min(LEVEL_COUNT - 1, idx | 0));
  lastLevel = idx;
  run = createRun(idx, { seed: seed >>> 0 || 1 });
  view.sceneKey = (LEVELS[idx] && LEVELS[idx].scene) || 'town';
  view.sparks = [];
  view.fireworks = [];
  setPhase('playing');
  ui.showGame();
  hideResult();
  updateHud();
  audio.startBgm();
  Sdk.track('start', { level: idx + 1 });
}

function startLevel(idx) {
  beginRun(idx, (Date.now() % 2147483647) || 1);
  if (!tutorialDone && run.state.level === 1) startTutorial();
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
  beginRun(run ? run.state.levelIndex : lastLevel, (Date.now() % 2147483647) || 1);
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
  $('hud-height').textContent = t('meters', { n: h.height });
  $('hud-goal').textContent = `${t('goal')} ${h.targetHeight}m`;
  $('hud-clouds').textContent = t('sparks', { n: h.clouds });
  const fuseEl = $('hud-fuse');
  fuseEl.classList.toggle('full', h.incandescent);
  $('fuse-fill').style.width = `${Math.round(h.incandescent ? 100 : h.fuse)}%`;
  $('fuse-label').textContent = h.incandescent ? '✦' : 'FUSE';
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
  $('best-total').textContent = `${t('best')} ${best} m · ★ ${totalStars()}/${LEVEL_COUNT * 3}`;
}

function showResult(res) {
  const { won, stars, height, clouds, revived, bestCombo, hasNext } = res;
  $('result-title').textContent = won ? t('winTitle') : t('loseTitle');
  $('result-title').classList.toggle('lose', !won);
  $('result-stars').innerHTML = won
    ? `<span class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>`
    : '';
  $('result-height').textContent = t('meters', { n: height });
  $('result-meta').textContent = won
    ? `${t('sparks', { n: clouds })} · ${t('best')} ${bestCombo}x${!revived ? ' · ' + t('perfect') : ''}`
    : t('crashMsg');
  $('btn-next').style.display = won && hasNext ? '' : 'none';
  const canRevive = !won && !revived && SdcAdsEnabled('revive');
  $('btn-revive').classList.toggle('hidden', !canRevive);
  $('screen-result').classList.remove('hidden');
}

function hideResult() {
  $('screen-result').classList.add('hidden');
}

function SdcAdsEnabled(placement) {
  try { return !!(Sdk.canShowAd && Sdk.canShowAd(placement)); } catch { return false; }
}

function finishRun(ev) {
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial(); // 结算屏出现时引导必须退场
  const st = run.state;
  const won = ev.type === 'win';
  const stars = won ? (ev.stars || st.stars || 1) : 0;
  if (won) {
    const idx = st.level;
    starsByLevel[idx] = Math.max(starsByLevel[idx] | 0, stars);
    if (idx < LEVEL_COUNT) unlocked = Math.max(unlocked, idx + 1);
    if (st.height > best) best = st.height;
    buildLevelGrid();
    Sdk.levelCleared({ level: idx, stars, height: st.height, clouds: st.clouds });
    // 插屏频控（每 3 关）
    Sdk.showInterstitial('stageClear', { levelIndex: idx });
  } else {
    Sdk.gameOver({ level: st.level, height: st.height, clouds: st.clouds });
  }
  persist();
  Sdk.track(won ? 'win' : 'fail', {
    level: st.level, stars, height: st.height, clouds: st.clouds, revived: st.revived,
  });
  showResult({
    won, stars, height: st.height, clouds: st.clouds, revived: st.revived,
    bestCombo: st.bestCombo, hasNext: st.level + 1 <= LEVEL_COUNT,
  });
  audio.event(won ? 'win' : 'lose');
}

// ---------- 教程引导（首次自动弹，可跳过，完成/跳过后持久化不再自动弹） ----------
const TUT_SPOTS = ['playfield', 'cloud', 'fuse'];
const TUT_TRIGGER = ['firstInput', 'cloudBreak', 'firework'];

const TUT_STEPS = () => [
  { text: t('tutStep1'), spot: 'playfield' },
  { text: t('tutStep2'), spot: 'cloud' },
  { text: t('tutStep3'), spot: 'fuse' },
];

function layoutRect(which) {
  if (which === 'fuse') {
    const el = $('hud-fuse');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left * (1280 / canvas.getBoundingClientRect().width), y: r.top * (720 / canvas.getBoundingClientRect().height), w: r.width, h: r.height };
  }
  try {
    const lay = renderer.debugLayout();
    return lay && lay[which] ? lay[which] : null;
  } catch { return null; }
}

function startTutorial() {
  if (!run) return;
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
      case 'cloudBreak':
        view.shake = 2;
        view.sparks.push({ x: ev.x, y: 150, ttl: 0.4, max: 0.4 });
        break;
      case 'steelBreak':
        view.shake = 3;
        view.sparks.push({ x: ev.x, y: 150, ttl: 0.4, max: 0.4 });
        break;
      case 'firework':
        view.fireworks.push({ x: run ? run.state.x : 640, y: 150, ttl: 0.9, max: 0.9, seed: (ev.height % 7) * 0.7 });
        break;
      case 'crash':
      case 'lose':
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
let keyLeft = false;
let keyRight = false;
let pointerActive = false;
let pointerX = WORLD.WIDTH / 2;

function effectiveDir() {
  if (pointerActive) {
    const dx = pointerX - (run ? run.state.x : WORLD.WIDTH / 2);
    if (dx > 12) return 1;
    if (dx < -12) return -1;
    return 0;
  }
  return (keyRight ? 1 : 0) + (keyLeft ? -1 : 0);
}

function canvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  return { x: (e.clientX - rect.left) * (1280 / rect.width), y: (e.clientY - rect.top) * (720 / rect.height) };
}

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  pointerActive = true;
  pointerX = canvasPos(e).x;
  if (tutorialStep === 0) tutorialAdvance('firstInput');
});
canvas.addEventListener('pointermove', (e) => {
  if (pointerActive) pointerX = canvasPos(e).x;
});
window.addEventListener('pointerup', () => { pointerActive = false; });
window.addEventListener('pointercancel', () => { pointerActive = false; });

window.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
    keyLeft = true;
    if (tutorialStep === 0) tutorialAdvance('firstInput');
  }
  if (e.code === 'ArrowRight' || e.code === 'KeyD') {
    keyRight = true;
    if (tutorialStep === 0) tutorialAdvance('firstInput');
  }
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
  if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'result')) restartLevel();
  if (e.code === 'KeyM') toggleMute();
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keyLeft = false;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') keyRight = false;
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
  on('btn-next', () => startLevel((run ? run.state.level : lastLevel) + 1));
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-tut-replay', () => {
    if (phase === 'paused') resumeGame();
    if (phase === 'playing') startTutorial();
  });
  on('btn-howto', () => { if (phase === 'playing') startTutorial(); });
  on('btn-rotate-skip', () => {
    const rs = $('rotate-screen');
    if (rs) rs.style.display = 'none';
  });
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);

  $('btn-revive')?.addEventListener('click', async () => {
    if (!run || phase !== 'result') return;
    const ok = await Sdk.showRewarded('revive');
    if (!ok) return;
    Sdk.track('revive', { level: run.state.level });
    run.revive();
    hideResult();
    setPhase('playing');
    ui.showGame();
    audio.startBgm();
    updateHud();
  });

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
    if (autopilotMode) run.autopilotStep();
    else run.setInput(effectiveDir());
    accumulator += dt;
    while (accumulator >= STEP) {
      run.step(STEP);
      accumulator -= STEP;
    }
    handleEvents(run.drainEvents());
    if (run && phase === 'playing') updateHud();
  }

  if (view.shake > 0) view.shake = Math.max(0, view.shake - dt * 16);
  for (const s of view.sparks) s.ttl -= dt;
  for (const f of view.fireworks) f.ttl -= dt;
  view.sparks = view.sparks.filter((s) => s.ttl > 0);
  view.fireworks = view.fireworks.filter((f) => f.ttl > 0);

  try {
    renderer.draw(run ? run.state : null, dt, view);
  } catch (err) {
    console.warn('render error', err);
  }

  if (fpsSamples.length < 600 && dt > 0) fpsSamples.push(1 / dt);

  requestAnimationFrame(frame);
}

// ---------- 调试契约（截图/验收脚本通用） ----------
function driveToEnd(steer) {
  if (!run) return false;
  let guard = 20000;
  while (guard-- > 0 && run.state.phase === 'playing') {
    if (steer) run.autopilotStep();
    run.step(1 / 60);
    handleEvents(run.drainEvents());
    if (phase === 'result') break;
  }
  return phase === 'result' || run.state.phase === 'won' || run.state.phase === 'lost';
}

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
    get steps() { return TUT_TRIGGER.slice(); },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
  save: (k, v) => Sdk.save(k, v),
  share: (p) => Sdk.share(p),
  ui: () => ui,
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: () => {
      if (!run) return null;
      const st = run.state;
      return { ...st, layers: st.layers, corridor: st.corridor, cols: st.cols, targetHeight: st.targetHeight };
    },
    layout: () => { try { return renderer.debugLayout(); } catch { return null; } },
    loadLevel: (i) => startLevel(i),
    startSeeded: (i, seed) => {
      beginRun(i, seed >>> 0 || 1);
      return true;
    },
    autoPlaceSolution: () => driveToEnd(true),
    autoWin: () => driveToEnd(true),
    fastForward: () => driveToEnd(false),
    setAutopilot: (b) => { autopilotMode = !!b; },
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    startTutorial: () => startTutorial(),
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
