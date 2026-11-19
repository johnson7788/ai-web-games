// ANT FIRE SQUAD · 主入口：60Hz 固定步长 + 标题/游戏/暂停/结算 + 教程 + SDK 统一出口。
// 装配：sim(M1) / render(M2) / audio(M4) / ui(语言+屏幕显隐)。HUD/结算/教程 DOM 由这里直写。
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
const reduceMotion = typeof window !== 'undefined'
  && window.matchMedia
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let run = null;
let phase = 'title';        // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let fpsSamples = [];
let lastLevel = 0;
let muted = !!Sdk.load('muted', false);
let bestHeat = Sdk.load('bestHeat', 0) | 0;
let tutorialDone = !!Sdk.load('tutorialDone', false);
let tutorialStep = -1;

const view = {
  cursor: { x: 0, y: 0 },
};

Sdk.ready(); // 不 await，不阻塞首屏
Sdk.onAdStart(() => { if (phase === 'playing') pauseGame(true); });
Sdk.onAdEnd(() => { if (phase === 'paused') resumeGame(); });
audio.setMuted(muted);
ui.setMuted(muted);

function persist() {
  Sdk.save('muted', muted);
  Sdk.save('bestHeat', bestHeat);
  Sdk.save('tutorialDone', tutorialDone);
}

function setPhase(p) { phase = p; }

// ---------- 关卡 ----------
function startLevel(idx) {
  idx = Math.max(0, Math.min(LEVEL_COUNT - 1, idx | 0));
  lastLevel = idx;
  run = createRun(idx, { seed: (Date.now() % 2147483647) || 1 });
  setPhase('playing');
  ui.showGame();
  ui.hideResult();
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
  Sdk.track('restart', { level: (run ? run.state.level : lastLevel + 1) });
  startLevel(run ? run.state.level - 1 : lastLevel);
}

function goHome() {
  run = null;
  setPhase('title');
  ui.hideResult();
  ui.showTitle();
  updateBestLabel();
}

// ---------- HUD / 结算 ----------
function updateHud() {
  if (!run) return;
  const h = run.getHud();
  $('hud-level').textContent = `${t('level')} ${h.level}`;
  $('hud-heat').textContent = `${t('heat')} ${h.heat}/${h.target}`;
  $('heat-fill').style.width = `${Math.min(100, (h.heat / h.target) * 100)}%`;
  const secs = Math.max(0, Math.ceil(h.timeLeft));
  const timeEl = $('hud-time');
  timeEl.textContent = `${t('time')} ${secs}s`;
  timeEl.classList.toggle('time-low', secs <= 10);
  const comboEl = $('hud-combo');
  comboEl.classList.toggle('hidden', h.combo <= 1);
  comboEl.textContent = `×${h.combo}`;
  $('hud-soldiers').textContent = `${t('soldiers')} ${h.soldierCharges}/${h.soldierMax}`;
  $('hud-hint').textContent = t('tapHint');
}

function updateBestLabel() {
  $('best-heat').textContent = bestHeat > 0 ? `${t('best')}: ${bestHeat}` : '';
}

function showResult(res) {
  const { won, heat, target, bestCombo, reason, hasNext } = res;
  const titleEl = $('result-title');
  titleEl.textContent = won ? t('winTitle') : t('loseTitle');
  titleEl.classList.toggle('lose', !won);
  $('result-heat').textContent = `${t('heat')} ${Math.floor(heat)}/${target} · ${t('combo')} ×${bestCombo}`;
  $('result-meta').textContent = won ? t('levelClear') : (reason === 'timeOut' ? t('timeOut') : t('loseTitle'));
  $('btn-next').style.display = won && hasNext ? '' : 'none';
  ui.showResult();
}

function hideResult() { ui.hideResult(); }

function finishRun(ev) {
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  const st = run.state;
  const won = ev.type === 'win';
  if (won) {
    if (st.heat > bestHeat) { bestHeat = Math.floor(st.heat); updateBestLabel(); }
    Sdk.levelCleared({ level: st.level, heat: Math.floor(st.heat), bestCombo: st.bestCombo });
  } else {
    Sdk.gameOver({ level: st.level, heat: Math.floor(st.heat), reason: ev.reason });
  }
  persist();
  showResult({
    won,
    heat: st.heat,
    target: st.target,
    bestCombo: st.bestCombo,
    reason: ev.reason || null,
    hasNext: st.level < LEVEL_COUNT,
  });
  audio.event(won ? 'win' : 'lose');
  if (won && !reduceMotion) { renderer.flash(); renderer.addShake(4); }
}

// ---------- 教程（首次自动弹，可跳过/重看，动作驱动推进） ----------
const TUT_TRIGGER = ['drop', 'deliver', 'killWasp'];
const TUT_TEXTS = () => [t('tutStep1'), t('tutStep2'), t('tutStep3')];

function startTutorial() {
  tutorialStep = 0;
  renderTutorialStep();
}

function renderTutorialStep() {
  const el = $('tutorial');
  if (tutorialStep < 0) { el.classList.add('hidden'); return; }
  const steps = TUT_TEXTS();
  el.classList.remove('hidden');
  $('tut-title').textContent = t('tutTitle');
  $('tut-text').textContent = steps[tutorialStep] || '';
  $('tut-skip').textContent = t('tutSkip');
  $('tut-next').textContent = t('tutNext');
}

function tutorialNext() {
  tutorialStep += 1;
  if (tutorialStep >= TUT_TRIGGER.length) endTutorial();
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

// ---------- 事件消费（音频 + 粒子 + 教程推进 + 结算） ----------
function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    tutorialAdvance(ev.type);
    if (reduceMotion) continue;
    switch (ev.type) {
      case 'drop':
        renderer.spawn(ev.x, ev.y, '#35f0ff', 5, 120);
        break;
      case 'deliver':
        renderer.spawn(FORGE_X, FORGE_Y - 20, '#ffd24a', 8, 200);
        break;
      case 'combo':
        renderer.spawn(WORLD.WIDTH / 2, 120, '#ffd24a', 6, 160);
        break;
      case 'killWasp':
        renderer.spawn(ev.x, ev.y, '#c44dff', 10, 220);
        renderer.addShake(3);
        break;
      case 'forgeHit':
        renderer.spawn(FORGE_X, FORGE_Y - 20, '#ff5a7a', 10, 200);
        renderer.addShake(5);
        break;
      case 'stun':
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

const FORGE_X = WORLD.WIDTH / 2;
const FORGE_Y = 646;

// ---------- 输入 ----------
function canvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (WORLD.WIDTH / rect.width),
    y: (e.clientY - rect.top) * (WORLD.HEIGHT / rect.height),
  };
}

function findWaspAt(p) {
  if (!run) return null;
  let best = null;
  let bestD = Infinity;
  for (const w of run.state.wasps) {
    const d = Math.hypot(w.x - p.x, w.y - p.y);
    if (d < bestD) { bestD = d; best = w; }
  }
  return bestD < 38 ? best : null;
}

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (!run || phase !== 'playing') return;
  const p = canvasPos(e);
  view.cursor = p;
  const wasp = findWaspAt(p);
  if (wasp) run.dropSoldier(wasp.x, wasp.y);
  else run.tap(p.x, p.y);
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
  on('btn-next', () => startLevel((run ? run.state.level : lastLevel + 1)));
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-tut-replay', () => {
    if (phase === 'paused') resumeGame();
    if (phase === 'playing') startTutorial();
  });
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result') startTutorial(); });
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);

  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = $(id);
    if (!sel) continue;
    sel.addEventListener('change', () => {
      ui.setLang(sel.value);
      applyTexts();
      if (run) updateHud();
    });
  }
}

function applyTexts() {
  $('title-text').textContent = t('title');
  $('subtitle-text').textContent = t('subtitle');
  $('btn-start').textContent = t('start');
  $('btn-resume').textContent = t('resume');
  $('pause-title').textContent = t('paused');
  $('btn-restart2').textContent = t('restart');
  $('btn-tut-replay').textContent = t('howto');
  $('btn-home3').textContent = t('menu');
  $('btn-retry').textContent = t('retry');
  $('btn-next').textContent = t('next');
  $('btn-home2').textContent = t('menu');
  const rt = $('rotate-text');
  const rb = $('btn-rotate-skip');
  if (rt) rt.textContent = t('rotateHint');
  if (rb) rb.textContent = t('rotateSkip');
  renderTutorialStep();
  updateBestLabel();
}

// ---------- 主循环 ----------
function frame(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;

  if (phase === 'playing' && run) {
    accumulator += dt;
    let guard = 0;
    while (accumulator >= STEP && guard < 8) {
      run.step(STEP);
      accumulator -= STEP;
      guard += 1;
    }
    if (guard >= 8) accumulator = 0;
    handleEvents(run.drainEvents());
    if (run && phase === 'playing') updateHud();
  }

  if (phase === 'title') {
    renderer.drawAttract(now / 1000);
  } else {
    renderer.draw(run ? run.state : null, dt, view);
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
  save: (k, v) => Sdk.save(k, v),
  ui: () => ui,
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['drop', 'deliver', 'killWasp']; },
    get current() { return tutorialStep >= 0 ? TUT_TEXTS()[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: () => {
      if (!run) return null;
      const st = run.state;
      return {
        level: st.level, phase: st.phase, heat: st.heat, target: st.target,
        timeLeft: st.timeLeft, combo: st.combo, ants: st.ants.length,
        wasps: st.wasps.length, orbs: st.orbs.length, spark: st.spark,
        soldierCharges: st.soldierCharges,
      };
    },
    fastForward: (sec) => {
      if (!run) return false;
      const n = Math.max(0, Math.floor((sec || 1) * 60));
      for (let i = 0; i < n && run.state.phase === 'playing'; i += 1) run.step(STEP);
      handleEvents(run.drainEvents());
      if (phase === 'playing') updateHud();
      return true;
    },
    tap: (x, y) => (run ? run.tap(x, y) : { ok: false }),
    dropSoldier: (x, y) => (run ? run.dropSoldier(x, y) : { ok: false }),
    spawnWasp: () => {
      if (!run) return false;
      const st = run.state;
      st.wasps.push({ id: 9999, x: WORLD.WIDTH / 2, y: 110, hp: 1, speed: 70 });
      return true;
    },
    forceWin: () => {
      if (!run) return false;
      run.state.heat = run.state.target;
      run.step(STEP);
      handleEvents(run.drainEvents());
      return true;
    },
    forceLose: () => {
      if (!run) return false;
      run.state.timeLeft = 0;
      run.step(STEP);
      handleEvents(run.drainEvents());
      return true;
    },
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
  },
};

// ---------- 启动 ----------
bind();
syncDocumentLang();
ui.applyLang();
applyTexts();
$('btn-mute').classList.toggle('is-muted', muted);
Sdk.track('load', {});
requestAnimationFrame(frame);
