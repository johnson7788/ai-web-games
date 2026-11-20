// ACE GUNNER · 主入口：60Hz 固定步长 + 标题/战斗/升级/暂停/结算 + 教程引导 + SDK 统一出口。
// 契约见 docs/README.md。装配：sim（逻辑）/ render（画面）/ audio（音频）/ ui（语言与屏幕显隐）。
import { STEP, GAME } from '../config/game.config.js';
import { createRun } from './game/sim.js';
import { WAVE_COUNT, LEVELS } from '../config/levels.js';
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
let phase = 'title';         // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let fpsSamples = [];
let tutorialStep = -1;
let drawing = false;
let drawStartT = 0;

const view = {
  cursor: { x: 700, y: 400 },
  fxQueue: [],
  shake: 0,
  sceneKey: 'noon-desert',
};

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let best = Sdk.load('best', 0) | 0;
let tutorialDone = !!Sdk.load('tutorialDone', false);

Sdk.ready();
Sdk.onAdStart(() => { if (phase === 'playing') pauseGame(true); });
Sdk.onAdEnd(() => { if (phase === 'paused') resumeGame(); });
audio.setMuted(muted);
ui.setMuted(muted);

function persist() {
  Sdk.save('muted', muted);
  Sdk.save('best', best);
  Sdk.save('tutorialDone', tutorialDone);
}

// ---------- 阶段状态机 ----------
function setPhase(p) { phase = p; }

function startWaveGame(idx) {
  idx = Math.max(0, Math.min(WAVE_COUNT - 1, idx | 0));
  run = createRun(idx, { seed: (Date.now() % 2147483647) || 1 });
  view.sceneKey = run.state.sceneKey;
  view.fxQueue = [];
  setPhase('playing');
  ui.showGame();
  hideResult();
  hideUpgrade();
  updateHud();
  audio.startBgm();
  Sdk.track('start', { wave: idx + 1 });
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

function restartGame() {
  if (run) Sdk.track('restart', { wave: run.state.wave });
  startWaveGame(run ? run.state.wave - 1 : 0);
}

function goHome() {
  run = null;
  setPhase('title');
  hideResult();
  hideUpgrade();
  ui.showTitle();
  updateBestLabel();
}

// ---------- HUD ----------
function updateHud() {
  if (!run) return;
  const h = run.getHud();
  $('hud-wave').textContent = `${t('wave')} ${h.wave}/${WAVE_COUNT}`;
  $('hud-base').textContent = `${t('base')} ${h.baseHp}`;
  $('hud-base-bar').style.width = `${Math.max(0, Math.min(100, (h.baseHp / h.baseMaxHp) * 100))}%`;
  $('hud-gold').textContent = `${h.gold}`;
  const quiverEl = $('hud-quiver');
  quiverEl.textContent = h.reloading ? t('reloading') : `${h.arrows}/${h.maxArrows}`;
  quiverEl.classList.toggle('reloading', h.reloading);
  const streakEl = $('hud-streak');
  streakEl.style.display = h.killStreak >= 2 || h.eagleLeft > 0 ? '' : 'none';
  streakEl.textContent = h.eagleLeft > 0 ? `${t('eagleEye')}` : `${t('streak')} ×${h.killStreak}`;
  const baseBar = $('hud-base-bar');
  baseBar.classList.toggle('low', h.baseHp / h.baseMaxHp < 0.3);
}

function updateBestLabel() {
  $('best-label').textContent = `${t('best')}: ${best}`;
}

// ---------- 升级屏 ----------
function showUpgrade() {
  if (!run || run.state.phase !== 'upgrade') return;
  const offers = run.state.offered || [];
  const grid = $('upgrade-cards');
  grid.innerHTML = '';
  for (const id of offers) {
    const btn = document.createElement('button');
    btn.className = 'upgrade-card';
    btn.dataset.id = id;
    btn.innerHTML = `<strong>${t('up_' + id)}</strong><span>${t('up_' + id + '_d')}</span>`;
    grid.appendChild(btn);
  }
  $('screen-upgrade').classList.remove('hidden');
}

function hideUpgrade() {
  $('screen-upgrade').classList.add('hidden');
}

function chooseUpgrade(id) {
  if (!run || run.state.phase !== 'upgrade') return;
  const ok = run.chooseUpgrade(id);
  if (ok.ok) {
    hideUpgrade();
    run.nextWave();
    view.sceneKey = run.state.sceneKey;
    updateHud();
  }
}

// ---------- 结算 ----------
function showResult() {
  const st = run.state;
  const won = st.phase === 'won';
  $('result-title').textContent = won ? t('winTitle') : t('loseTitle');
  $('result-title').classList.toggle('lose', !won);
  $('result-meta').textContent = won
    ? `${t('wave')} ${st.wave}/${WAVE_COUNT} · ${t('gold')} ${Math.floor(st.gold)}`
    : t('wallLost');
  $('result-score').textContent = `${st.score}`;
  $('screen-result').classList.remove('hidden');
}

function hideResult() {
  $('screen-result').classList.add('hidden');
}

function finishRun() {
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  const st = run.state;
  const won = st.phase === 'won';
  if (won) best = Math.max(best, st.wave);
  persist();
  Sdk.track(won ? 'win' : 'fail', { wave: st.wave, score: st.score, kills: st.kills });
  showResult();
  audio.event(won ? 'win' : 'lose');
  updateBestLabel();
}

// ---------- 教程（首次自动弹，可跳过，完成/跳过后持久化不再自动弹） ----------
const TUT_STEPS = () => [
  { text: t('tutStep1'), spot: 'road' },
  { text: t('tutStep2'), spot: 'road' },
  { text: t('tutStep3'), spot: 'gate' },
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

function tutorialSkip() {
  endTutorial();
}

function endTutorial() {
  tutorialStep = -1;
  tutorialDone = true;
  persist();
  renderTutorialStep();
}

const TUT_TRIGGER = ['aim', 'shot', 'kill'];
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
      case 'shot':
        view.shake = 2;
        break;
      case 'arrowHit':
        view.fxQueue.push({ type: 'hitFlash', x: ev.x, y: ev.y, ttl: 0.25 });
        break;
      case 'explosion':
        view.fxQueue.push({ type: 'explosion', x: ev.x, y: ev.y, ttl: 0.4 });
        view.shake = 5;
        break;
      case 'kill':
        view.shake = 2;
        break;
      case 'wallHit':
        view.shake = 3;
        break;
      case 'waveClear':
        showUpgrade();
        break;
      case 'win':
      case 'lose':
        finishRun();
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
    x: (e.clientX - rect.left) * (1280 / rect.width),
    y: (e.clientY - rect.top) * (720 / rect.height),
  };
}

canvas.addEventListener('pointermove', (e) => {
  view.cursor = canvasPos(e);
  if (run && phase === 'playing' && run.state.phase === 'wave') {
    run.aim(view.cursor.x, view.cursor.y);
    tutorialAdvance('aim');
  }
});

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (!run || phase !== 'playing' || run.state.phase !== 'wave') return;
  e.preventDefault();
  drawing = true;
  drawStartT = performance.now();
  run.pressFire();
});

function releasePointer() {
  if (!drawing) return;
  drawing = false;
  if (!run || phase !== 'playing' || run.state.phase !== 'wave') return;
  const held = performance.now() - drawStartT;
  if (held < 120) run.fire();
  else run.releaseFire();
}
canvas.addEventListener('pointerup', releasePointer);
canvas.addEventListener('pointerleave', releasePointer);

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
  if (e.code === 'KeyR' && phase === 'playing' && run && run.state.phase === 'wave') run.reload();
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
  on('btn-start', () => startWaveGame(0));
  on('btn-resume', resumeGame);
  on('btn-restart', restartGame);
  on('btn-restart2', restartGame);
  on('btn-retry', restartGame);
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-howto', () => { if (phase === 'playing' || phase === 'paused') startTutorial(); });
  on('btn-tut-replay', () => { if (phase === 'paused') resumeGame(); if (phase === 'playing') startTutorial(); });
  on('tut-next', tutorialNext);
  on('tut-skip', tutorialSkip);
  on('btn-upgrade-skip', () => {
    if (run && run.state.phase === 'upgrade') { hideUpgrade(); run.nextWave(); view.sceneKey = run.state.sceneKey; updateHud(); }
  });
  on('btn-rotate-skip', () => {
    const rs = $('rotate-screen');
    if (rs) rs.style.display = 'none';
  });

  $('upgrade-cards')?.addEventListener('click', (e) => {
    const card = e.target.closest('[data-id]');
    if (card) chooseUpgrade(card.dataset.id);
  });

  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = $(id);
    if (!sel) continue;
    sel.addEventListener('change', () => {
      ui.setLang(sel.value);
      renderTutorialStep();
      if (run) updateHud();
      const rt = $('rotate-text');
      const rb = $('btn-rotate-skip');
      if (rt) rt.textContent = t('rotateHint');
      if (rb) rb.textContent = t('rotateSkip');
      updateBestLabel();
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
    if (run) view.sceneKey = run.state.sceneKey;
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
  start: (i) => startWaveGame(i == null ? 0 : i),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => restartGame(),
  home: () => goHome(),
  sim: () => (run ? run.state : null),
  save: (k, v) => Sdk.save(k, v),
  load: (k, f) => Sdk.load(k, f),
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['aim', 'shot', 'survive']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip() { tutorialSkip(); },
  },
  startTutorial: () => startTutorial(),
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: () => {
      if (!run) return null;
      const st = run.state;
      return { ...st, enemies: st.enemies.map((e) => ({ kind: e.kind, x: e.x, y: e.y, hp: e.hp, state: e.state })) };
    },
    layout: () => { try { return renderer.debugLayout(); } catch { return null; } },
    loadLevel: (i) => startWaveGame(i),
    startSeeded: (i, seed) => {
      const idx = Math.max(0, Math.min(WAVE_COUNT - 1, i | 0));
      run = createRun(idx, { seed: seed | 0 || 1 });
      view.sceneKey = run.state.sceneKey;
      view.fxQueue = [];
      setPhase('playing');
      ui.showGame();
      hideResult();
      hideUpgrade();
      updateHud();
      return true;
    },
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    startTutorial: () => startTutorial(),
    tutorialStep: () => tutorialStep,
    // 验收辅助：自动瞄准最近敌人并连射，直到本波结束
    autoPlaceSolution: () => {
      if (!run) return false;
      let guard = 4000;
      while (guard-- > 0 && run.state.phase === 'wave') {
        const st = run.state;
        let bestE = null;
        let bx = 1e9;
        for (const e of st.enemies) { if (e.state === 'dead') continue; if (e.x < bx) { bx = e.x; bestE = e; } }
        if (bestE) {
          run.aim(bestE.x, bestE.y);
          run.fire();
        }
        run.step(1 / 60);
      }
      return true;
    },
    // 快进：自动玩直到本波结束（或终局）
    fastForward: () => {
      if (!run) return false;
      try {
        let guard = 6000;
        while (guard-- > 0 && run.state.phase !== 'won' && run.state.phase !== 'lost') {
          const st = run.state;
          if (st.phase === 'wave') {
            let bestE = null;
            let bx = 1e9;
            for (const e of st.enemies) { if (e.state === 'dead') continue; if (e.x < bx) { bx = e.x; bestE = e; } }
            if (bestE) { run.aim(bestE.x, bestE.y); run.fire(); }
            else run.reload();
          } else if (st.phase === 'upgrade') {
            run.chooseUpgrade(st.offered[0] || 'rapidFire');
            run.nextWave();
          }
          run.step(1 / 60);
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
updateBestLabel();
$('btn-mute').classList.toggle('is-muted', muted);

// 竖屏提示（可跳过；仅竖屏显示）
function checkRotate() {
  const portrait = typeof window.matchMedia === 'function' && window.matchMedia('(orientation: portrait)').matches;
  const rs = $('rotate-screen');
  if (rs) rs.hidden = !portrait;
}
if (typeof window.matchMedia === 'function') {
  window.matchMedia('(orientation: portrait)').addEventListener?.('change', checkRotate);
  checkRotate();
}

Sdk.track('load', {});
requestAnimationFrame(frame);
