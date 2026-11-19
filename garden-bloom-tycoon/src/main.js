// 主入口：60Hz 固定步长 + 标题→经营→暂停/升级庆祝 + 教程引导 + SDK 统一出口。
// 装配：sim（纯逻辑）/ render（程序化画布）/ ui（DOM+CSS）/ audio（WebAudio）。
import { STEP, WORLD } from '../config/game.config.js';
import { createRun, restoreState, growthAt, plantById } from './game/sim.js';
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
let phase = 'title'; // title | playing | paused
let lastTime = performance.now();
let accumulator = 0;
let fpsSamples = [];
let tutorialStep = -1;
let tutorialDone = false;
let muted = false;
let levelupTimer = null;

const view = { fxQueue: [] };

// ---------- 存档 ----------
muted = !!Sdk.load('muted', false);
tutorialDone = !!Sdk.load('tutorialDone', false);
Sdk.ready(); // 不 await，不阻塞首屏
audio.setMuted(muted);
ui.setMuted(muted);

function serializeGarden() {
  const s = run.state;
  return {
    coins: s.coins,
    blooms: s.blooms,
    water: s.water,
    plots: s.plots.map((p) => ({ unlocked: p.unlocked, species: p.species, level: p.level, stageGold: p.stageGold })),
  };
}

function persist() {
  Sdk.save('muted', muted);
  Sdk.save('tutorialDone', tutorialDone);
  if (run) Sdk.save('garden', serializeGarden());
}

function tryLoadGarden() {
  try {
    const saved = Sdk.load('garden', null);
    if (!saved) return null;
    return restoreState(saved);
  } catch {
    return null;
  }
}

// ---------- 阶段状态机 ----------
function setPhase(p) { phase = p; }

function startGarden() {
  run = tryLoadGarden() || createRun({ seed: (Date.now() % 2147483647) || 1 });
  setPhase('playing');
  hideLevelup();
  ui.showGame();
  updateHud();
  audio.startBgm();
  Sdk.track('start', {});
  if (!tutorialDone) startTutorial();
}

function restartGarden() {
  run = createRun({ seed: (Date.now() % 2147483647) || 1 });
  setPhase('playing');
  hideLevelup();
  ui.showGame();
  updateHud();
  audio.startBgm();
  Sdk.track('restart', {});
}

function goHome() {
  run = null;
  setPhase('title');
  hideLevelup();
  ui.showTitle();
  audio.stopBgm();
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

// ---------- HUD ----------
function updateHud() {
  if (!run) return;
  const h = run.getHud();
  $('hud-coins').textContent = h.coins;
  $('hud-blooms').textContent = h.blooms;
  $('hud-water').textContent = h.water;
  $('hud-level').textContent = h.gardenLevel;
}

// ---------- 升级庆祝（结算时刻） ----------
function showLevelup(level) {
  const plant = plantById(level);
  $('levelup-title').textContent = t('levelUp');
  $('levelup-text').textContent = `${t('newPlant')} ${t('plant_' + plant.key)}`;
  $('screen-levelup').classList.remove('hidden');
  if (levelupTimer) clearTimeout(levelupTimer);
  levelupTimer = setTimeout(hideLevelup, 2200);
}

function hideLevelup() {
  $('screen-levelup').classList.add('hidden');
  if (levelupTimer) { clearTimeout(levelupTimer); levelupTimer = null; }
}

// ---------- 浮动文字 ----------
function plotHeadPos(index) {
  try {
    const lay = renderer.debugLayout();
    const r = lay.plots[index];
    return { x: r.x + r.w / 2, y: r.y + 8 };
  } catch { return { x: WORLD.WIDTH / 2, y: 200 }; }
}

function rockPos(id) {
  try {
    const lay = renderer.debugLayout();
    const r = lay.rocks[id];
    return { x: r.x + r.w / 2, y: r.y - 6 };
  } catch { return { x: WORLD.WIDTH / 2, y: 600 }; }
}

function spawnFx(x, y, text, color = '#ffd86b', size = 22) {
  view.fxQueue.push({ x, y, text, color, size, ttl: 0.9, maxTtl: 0.9 });
}

// ---------- 教程 ----------
const TUT_STEPS = () => [
  { id: 'harvest', text: t('tutStep1'), spot: 'plot0' },
  { id: 'upgrade', text: t('tutStep2'), spot: 'plot0' },
  { id: 'evolve', text: t('tutStep3'), spot: 'plot0' },
  { id: 'rocks', text: t('tutStep4'), spot: 'rock0' },
];

function spotRect(which) {
  try {
    const lay = renderer.debugLayout();
    if (which === 'rock0') return lay.rocks[0];
    return lay.plots[0];
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
  const rect = s && s.spot ? spotRect(s.spot) : null;
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

// ---------- 事件消费 ----------
function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    switch (ev.type) {
      case 'harvest': {
        const p = plotHeadPos(ev.index);
        spawnFx(p.x, p.y - 30, `+${ev.gained}`, '#ffd86b', ev.mult >= 2 ? 26 : 20);
        break;
      }
      case 'combo': {
        const p = plotHeadPos(ev.index);
        spawnFx(p.x, p.y - 52, `COMBO ×${ev.mult}`, '#ff7f50', 24);
        break;
      }
      case 'rock': {
        const p = rockPos(ev.id);
        spawnFx(p.x, p.y, `+${ev.gained}`, '#cfd6de', 20);
        if (ev.waterGain) spawnFx(p.x, p.y - 24, `+💧`, '#8fd0ff', 20);
        break;
      }
      case 'water': {
        const p = plotHeadPos(ev.index);
        spawnFx(p.x, p.y - 40, `+${ev.gained}`, '#8fd0ff', 18);
        break;
      }
      case 'upgrade': {
        const p = plotHeadPos(ev.index);
        spawnFx(p.x, p.y - 30, `Lv${ev.level}`, '#b7f0a0', 18);
        break;
      }
      case 'evolve': {
        const p = plotHeadPos(ev.index);
        spawnFx(p.x, p.y - 30, '✨', '#fff6b0', 28);
        break;
      }
      case 'bloom': {
        spawnFx(WORLD.WIDTH / 2, 120, `🌸 ${ev.blooms}`, '#ffc9e0', 26);
        break;
      }
      case 'levelup':
        showLevelup(ev.level);
        break;
      default:
        break;
    }
  }
}

// ---------- 输入：单点智能动作 ----------
function tapPlot(index) {
  const info = growthAt(run.state, index);
  if (info.accumulated >= 1) return run.harvest(index);
  if (run.canEvolve(index)) return run.evolve(index);
  if (run.canUpgrade(index)) return run.upgrade(index);
  if (run.canUnlock(index)) return run.unlockPlot(index);
  return { ok: false };
}

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
  const hit = renderer.hitTest(p.x, p.y);
  if (!hit) return;
  if (hit.kind === 'rock') {
    run.breakRock(hit.id);
    updateHud();
  } else if (hit.kind === 'plot') {
    tapPlot(hit.index);
    updateHud();
  }
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
  if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused')) restartGarden();
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
  on('btn-start', startGarden);
  on('btn-resume', resumeGame);
  on('btn-restart', restartGarden);
  on('btn-restart2', restartGarden);
  on('btn-home', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-levelup-ok', hideLevelup);
  on('btn-howto', () => startTutorial());
  on('btn-tut-replay', () => { if (phase === 'paused') resumeGame(); startTutorial(); });
  on('btn-rotate-skip', () => { const rs = $('rotate-screen'); if (rs) rs.style.display = 'none'; });
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);

  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = $(id);
    if (!sel) continue;
    sel.addEventListener('change', () => {
      ui.setLang(sel.value);
      renderTutorialStep();
      if (run) updateHud();
      $('rotate-text').textContent = t('rotateHint');
      $('btn-rotate-skip').textContent = t('rotateSkip');
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

  for (const fx of view.fxQueue) if (fx.ttl > 0) fx.ttl -= dt;
  view.fxQueue = view.fxQueue.filter((fx) => fx.ttl > 0);

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
  start: () => startGarden(),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => restartGarden(),
  home: () => goHome(),
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return TUT_STEPS().map((s) => s.id); },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  save: () => Sdk,
  ui: () => ui,
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: () => (run ? run.state : null),
    hud: () => (run ? run.getHud() : null),
    layout: () => { try { return renderer.debugLayout(); } catch { return null; } },
    harvest: (i) => (run ? run.harvest(i) : { ok: false }),
    upgrade: (i) => (run ? run.upgrade(i) : { ok: false }),
    evolve: (i) => (run ? run.evolve(i) : { ok: false }),
    unlockPlot: (i) => (run ? run.unlockPlot(i) : { ok: false }),
    breakRock: (id) => (run ? run.breakRock(id) : { ok: false }),
    water: (i) => (run ? run.water(i) : { ok: false }),
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
  },
};

// ---------- 启动 ----------
bind();
syncDocumentLang();
ui.applyLang();
{
  $('rotate-text').textContent = t('rotateHint');
  $('btn-rotate-skip').textContent = t('rotateSkip');
}
ui.showTitle();
$('btn-mute').classList.toggle('is-muted', muted);
Sdk.track('load', {});
setInterval(persist, 2000);
requestAnimationFrame(frame);
