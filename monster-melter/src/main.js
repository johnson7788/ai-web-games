// MONSTER MELTER · 主入口：60Hz 固定步长 + 标题/游戏/暂停/结算 + 教程 + SDK + 调试契约
import { STEP, WORLD, BOARD } from '../config/game.config.js';
import { createRun, CELLS } from './game/sim.js';
import { greedyMove } from './game/ai.js';
import { createRenderer } from './render/index.js';
import { createAudio } from './core/audio.js';
import { i18n, t, syncDocumentLang } from './core/i18n.js';
import Sdk from './core/sdk.js';

const $ = (id) => document.getElementById(id);
const canvas = $('canvas');
const renderer = createRenderer(canvas);
const audio = createAudio();

const { SCALE, CX, CY, SNAP } = BOARD;
const TRAY_X = [400, 640, 880];
const TRAY_Y = 650;
const TRAY_R = 50;

let run = null;
let phase = 'title'; // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let bombArmed = false;

const view = {
  time: 0,
  held: null,           // { trayIndex, sx, sy }
  heldTargets: null,    // { ok, indices }
  hoverAnchor: null,
  fx: [],
  shake: 0,
  monsterFlash: 0,
  talk: null,
};

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let lastLevel = Sdk.load('lastLevel', 0) | 0;
let bestScore = Sdk.load('bestScore', 0) | 0;
let tutorialDone = !!Sdk.load('tutorialDone', false);

Sdk.ready();
audio.setMuted(muted);

function persist() {
  Sdk.save('muted', muted);
  Sdk.save('lastLevel', lastLevel);
  Sdk.save('bestScore', bestScore);
  Sdk.save('tutorialDone', tutorialDone);
}

// ---------- 阶段状态机 ----------
function setPhase(p) { phase = p; }

function startLevel(idx, opts = {}) {
  idx = Math.max(0, idx | 0);
  lastLevel = idx;
  bombArmed = false;
  run = createRun(idx, { seed: (Date.now() % 2147483647) || 1, score: opts.score || 0, bombs: opts.bombs == null ? 1 : opts.bombs });
  view.held = null;
  view.heldTargets = null;
  view.hoverAnchor = null;
  view.fx = [];
  setPhase('playing');
  showGame();
  hideResult();
  updateHud();
  audio.startBgm();
  Sdk.track('start', { level: idx + 1 });
  if (!tutorialDone && idx === 0) startTutorial();
}

function pauseGame() {
  if (phase !== 'playing') return;
  setPhase('paused');
  audio.stopBgm();
  $('screen-pause').classList.remove('hidden');
}

function resumeGame() {
  if (phase !== 'paused') return;
  setPhase('playing');
  $('screen-pause').classList.add('hidden');
  audio.startBgm();
}

function restartLevel() {
  Sdk.track('restart', { level: run ? run.state.level : lastLevel + 1 });
  startLevel(run ? run.state.level - 1 : lastLevel);
}

function goHome() {
  run = null;
  bombArmed = false;
  setPhase('title');
  hideResult();
  $('screen-pause').classList.add('hidden');
  $('screen-title').classList.remove('hidden');
  $('screen-title').classList.add('is-active');
  $('hud').classList.add('hidden');
  $('best-line').textContent = bestScore > 0 ? `${t('best')} ${bestScore}` : '';
  updateLangTexts();
}

function nextLevel() {
  if (!run) return;
  startLevel(run.state.level, { score: run.state.score, bombs: run.state.bombs + 1 });
}

// ---------- 屏幕显隐 ----------
function showGame() {
  $('screen-title').classList.add('hidden');
  $('screen-title').classList.remove('is-active');
  $('screen-pause').classList.add('hidden');
  $('hud').classList.remove('hidden');
}

function hideResult() { $('screen-result').classList.add('hidden'); }

// ---------- HUD ----------
function updateHud() {
  if (!run) return;
  const h = run.getHud();
  view.monsterName = `${t('monster' + h.monType)} · LV ${h.level}`;
  view.hint = t('hint');
  $('hud-level').textContent = `${t('level')} ${h.level}`;
  $('hud-score').textContent = `${t('score')} ${h.score}`;
  $('hud-best').textContent = `${t('best')} ${bestScore}`;
  $('hud-moves').textContent = `${t('moves')} ${h.moves}`;
  const comboEl = $('hud-combo');
  if (h.combo >= 2) {
    comboEl.textContent = `${t('combo')} ×${h.combo}`;
    comboEl.classList.remove('hidden');
  } else {
    comboEl.classList.add('hidden');
  }
  $('bomb-badge').textContent = h.bombs;
  $('btn-bomb').classList.toggle('armed', bombArmed);
  $('btn-bomb').disabled = h.bombs <= 0;
}

// ---------- 结算 ----------
function finishRun(ev) {
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  const won = ev.type === 'win';
  const stars = won ? (ev.stars || 1) : 0;
  if (won) {
    if (ev.score > bestScore) { bestScore = ev.score; Sdk.track('newBest', { bestScore }); }
  } else {
    if (run && run.state.score > bestScore) bestScore = run.state.score;
  }
  persist();
  Sdk.track(won ? 'win' : 'fail', { level: run.state.level, score: run.state.score, stars, moves: run.state.moves });
  $('result-title').textContent = won ? t('winTitle') : t('loseTitle');
  $('result-title').classList.toggle('lose', !won);
  $('result-stars').innerHTML = won
    ? `<span>${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>${stars >= 3 ? `<em>${t('perfect')}</em>` : ''}`
    : '';
  const meta = [
    `${t('resultScore')}: ${run.state.score}`,
    `${t('resultMoves')}: ${run.state.moves}`,
    won && stars >= 3 ? t('newBest') : `${t('resultBest')}: ${bestScore}`,
  ].filter(Boolean);
  $('result-meta').textContent = meta.join('  ·  ');
  $('btn-next').style.display = won ? '' : 'none';
  $('screen-result').classList.remove('hidden');
  audio.event(won ? 'win' : 'lose', ev);
}

// ---------- 事件消费 ----------
function spawnBeams(indices) {
  for (const i of indices.slice(0, 8)) {
    const p = renderer.cellScreen(i);
    view.fx.push({ type: 'beam', x: p.x, y: p.y, tx: 790, ty: 104, ttl: 0.45, max: 0.45 });
  }
}

function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    tutorialAdvance(ev.type);
    switch (ev.type) {
      case 'place':
        view.shake = 2;
        break;
      case 'clear':
        spawnBeams(ev.indices || []);
        view.shake = 3;
        break;
      case 'hit':
        view.monsterFlash = 0.18;
        view.shake = 3;
        break;
      case 'bomb':
        view.shake = 6;
        break;
      case 'talk':
        view.talk = { text: t('taunt' + ev.line), ttl: 2.6 };
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

// ---------- 教程 ----------
const TUT_STEPS = () => [
  { id: 'grab', text: t('tutStep1') },
  { id: 'place', text: t('tutStep2') },
  { id: 'clear', text: t('tutStep3') },
];
let tutorialStep = -1;

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
  if (tutorialStep < 0 || tutorialStep >= TUT_STEPS().length) return;
  if (TUT_STEPS()[tutorialStep].id !== evType) return;
  tutorialStep += 1;
  if (tutorialStep >= TUT_STEPS().length) endTutorial();
  else renderTutorialStep();
}

// ---------- 输入：坐标换算 ----------
function canvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (WORLD.WIDTH / rect.width),
    y: (e.clientY - rect.top) * (WORLD.HEIGHT / rect.height),
  };
}

function cellAt(sx, sy) {
  const wx = (sx - CX) / SCALE;
  const wy = (sy - CY) / SCALE;
  let best = -1;
  let bd = Infinity;
  for (const c of CELLS) {
    const d = Math.hypot(c.x - wx, c.y - wy);
    if (d < bd) { bd = d; best = c.index; }
  }
  return bd <= SNAP ? best : -1;
}

function trayAt(sx, sy) {
  for (let i = 0; i < 3; i += 1) {
    if (Math.hypot(sx - TRAY_X[i], sy - TRAY_Y) <= TRAY_R) return i;
  }
  return -1;
}

function computeHeldTargets() {
  if (!view.held || !run) { view.heldTargets = null; return; }
  const tray = run.state.trays[view.held.trayIndex];
  if (!tray) { view.heldTargets = null; return; }
  const anchor = cellAt(view.held.sx, view.held.sy);
  view.hoverAnchor = anchor;
  if (anchor < 0) { view.heldTargets = null; return; }
  const targets = run.resolveTargets(anchor, tray.shape);
  if (!targets) { view.heldTargets = { ok: false, indices: [] }; return; }
  let ok = true;
  for (const t of targets) if (run.state.board[t].kind !== 'empty') ok = false;
  view.heldTargets = { ok, indices: targets };
}

function selectTray(trayIndex) {
  if (!run || phase !== 'playing') return;
  audio.unlock();
  audio.event('grab', {});
  tutorialAdvance('grab');
  view.held = { trayIndex, sx: TRAY_X[trayIndex], sy: TRAY_Y };
  computeHeldTargets();
}

function tryPlace() {
  if (!view.held || !run) return;
  const tray = run.state.trays[view.held.trayIndex];
  const anchor = cellAt(view.held.sx, view.held.sy);
  if (tray && anchor >= 0) {
    const res = run.place(view.held.trayIndex, anchor);
    if (res.ok) handleEvents(run.drainEvents());
  }
  view.held = null;
  view.heldTargets = null;
  view.hoverAnchor = null;
  updateHud();
}

function useBombAt(sx, sy) {
  if (!run || phase !== 'playing') return;
  const cell = cellAt(sx, sy);
  if (cell < 0) return;
  const res = run.useBomb(cell);
  if (res.ok) {
    const p = renderer.cellScreen(cell);
    view.fx.push({ type: 'boom', x: p.x, y: p.y, ttl: 0.5, max: 0.5 });
    bombArmed = false;
    handleEvents(run.drainEvents());
    updateHud();
  }
}

// ---------- 指针事件 ----------
canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (!run || phase !== 'playing') return;
  const p = canvasPos(e);
  if (bombArmed) {
    useBombAt(p.x, p.y);
    return;
  }
  const tIdx = trayAt(p.x, p.y);
  if (tIdx >= 0) {
    selectTray(tIdx);
    canvas.setPointerCapture(e.pointerId);
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (!view.held) return;
  const p = canvasPos(e);
  view.held.sx = p.x;
  view.held.sy = p.y;
  computeHeldTargets();
});

canvas.addEventListener('pointerup', (e) => {
  if (!view.held) return;
  tryPlace();
});

canvas.addEventListener('pointercancel', () => {
  view.held = null;
  view.heldTargets = null;
  view.hoverAnchor = null;
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
  $('btn-mute').classList.toggle('is-muted', muted);
  $('btn-mute').textContent = muted ? '🔇' : '🔊';
  persist();
}

// ---------- 语言 ----------
function updateLangTexts() {
  $('title-text').textContent = t('title');
  $('subtitle-text').textContent = t('subtitle');
  $('btn-start').textContent = t('start');
  $('btn-resume').textContent = t('resume');
  $('btn-restart2').textContent = t('restart');
  $('btn-tut-replay').textContent = t('howto');
  $('btn-home3').textContent = t('home');
  $('btn-retry').textContent = t('retry');
  $('btn-next').textContent = t('next');
  $('btn-home2').textContent = t('home');
  $('pause-title').textContent = t('paused');
  $('rotate-text').textContent = t('rotateHint');
  $('btn-rotate-skip').textContent = t('rotateSkip');
  $('btn-mute').textContent = muted ? '🔇' : '🔊';
  const sels = [$('lang-select'), $('lang-select-pause')];
  for (const sel of sels) {
    if (!sel) continue;
    sel.innerHTML = '';
    for (const item of i18n.options()) {
      const opt = document.createElement('option');
      opt.value = item.code;
      opt.textContent = item.name;
      if (item.code === i18n.lang) opt.selected = true;
      sel.appendChild(opt);
    }
  }
}

function applyLang() {
  syncDocumentLang();
  updateLangTexts();
  renderTutorialStep();
  if (run) updateHud();
  if (phase === 'title') $('best-line').textContent = bestScore > 0 ? `${t('best')} ${bestScore}` : '';
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
  on('btn-next', nextLevel);
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-bomb', () => {
    if (!run || phase !== 'playing') return;
    if (run.state.bombs <= 0) return;
    bombArmed = !bombArmed;
    updateHud();
  });
  on('btn-tut-replay', () => { if (phase === 'playing') startTutorial(); });
  on('btn-howto', () => { if (phase === 'playing') startTutorial(); });
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);

  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = $(id);
    if (!sel) continue;
    sel.addEventListener('change', () => {
      i18n.setLang(sel.value);
      applyLang();
    });
  }
}

// ---------- 主循环 ----------
function frame(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;
  view.time += dt;

  if (phase === 'playing' && run) {
    accumulator += dt;
    while (accumulator >= STEP) {
      run.step(STEP);
      accumulator -= STEP;
    }
    handleEvents(run.drainEvents());
    if (run && phase === 'playing') updateHud();
  }

  if (view.shake > 0) view.shake = Math.max(0, view.shake - dt * 22);
  if (view.monsterFlash > 0) view.monsterFlash = Math.max(0, view.monsterFlash - dt);
  if (view.talk) {
    view.talk.ttl -= dt;
    if (view.talk.ttl <= 0) view.talk = null;
  }
  for (const fx of view.fx) if (fx.ttl > 0) fx.ttl -= dt;
  view.fx = view.fx.filter((fx) => fx.ttl > 0);

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
  sim: () => (run ? run.state : null),
  start: (i) => startLevel(i == null ? (lastLevel || 0) : i),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => restartLevel(),
  home: () => goHome(),
  save: () => Sdk,
  ui: () => ({ lang: i18n.lang }),
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['grab', 'place', 'clear']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
  },
  startTutorial: () => startTutorial(),
  debug: {
    state: () => (run ? run.state : null),
    startSeeded: (i, seed) => {
      const idx = Math.max(0, i | 0);
      lastLevel = idx;
      bombArmed = false;
      run = createRun(idx, { seed: seed | 0 || 1 });
      setPhase('playing');
      showGame();
      hideResult();
      updateHud();
      return true;
    },
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    autoPlaceSolution: () => {
      if (!run) return false;
      let guard = 5000;
      while (run.state.phase === 'playing' && guard-- > 0) {
        const m = greedyMove(run);
        if (m) run.place(m.ti, m.a);
        else if (run.state.bombs > 0) run.useBomb(0);
        else break;
        handleEvents(run.drainEvents());
        if (phase !== 'playing') break;
      }
      return run.state.phase === 'won';
    },
    layout: () => renderer.debugLayout(),
  },
};

// ---------- 启动 ----------
bind();
syncDocumentLang();
applyLang();
$('btn-mute').textContent = muted ? '🔇' : '🔊';
$('btn-mute').classList.toggle('is-muted', muted);
$('best-line').textContent = bestScore > 0 ? `${t('best')} ${bestScore}` : '';
view.monsterName = t('monster0');
view.hint = t('hint');
$('hud').classList.add('hidden');
Sdk.track('load', {});
requestAnimationFrame(frame);
