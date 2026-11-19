// YUNTU MATCH POP · 主入口：60Hz 固定步长 + 标题/游戏/暂停/结算 + 教程 + SDK 统一出口
// 装配：sim（纯逻辑）/ render（canvas 程序化）/ audio（WebAudio）/ ui（DOM+CSS）。
import { STEP, WORLD, LAYOUT, CONFIG } from '../config/game.config.js';
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
let phase = 'title';        // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let fpsSamples = [];
let bombArmed = false;
let tutorialStep = -1;

// 存档（统一走 Sdk）
let muted = !!Sdk.load('muted', false);
let best = Sdk.load('best', 0) | 0;
let unlocked = Math.max(0, Sdk.load('unlocked', 0) | 0);
let lastLevel = Math.max(0, Math.min(unlocked, Sdk.load('lastLevel', 0) | 0));
let tutorialDone = !!Sdk.load('tutorialDone', false);

const view = {
  hoverCol: null,
  cursor: { x: 0, y: 0 },
  fx: [],               // {x,y,size,ttl,maxTtl,color}
  shake: 0,
  comboText: '',
  comboTtl: 0,
};

Sdk.ready();
audio.setMuted(muted);

function persist() {
  Sdk.save('muted', muted);
  Sdk.save('best', best);
  Sdk.save('unlocked', unlocked);
  Sdk.save('lastLevel', lastLevel);
  Sdk.save('tutorialDone', tutorialDone);
}

// ---------- 阶段状态机 ----------
function setPhase(p) { phase = p; }

function startLevel(idx) {
  idx = Math.max(0, Math.min(LEVEL_COUNT - 1, idx | 0));
  lastLevel = idx;
  bombArmed = false;
  run = createRun(idx, { seed: (Date.now() % 2147483647) || 1 });
  view.fx = [];
  view.comboText = '';
  view.comboTtl = 0;
  setPhase('playing');
  ui.showGame();
  ui.hideResult();
  updateHud();
  renderResultTitle();
  audio.unlock();
  audio.startBgm();
  Sdk.newRun({ level: idx + 1 });
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
  startLevel(run ? run.state.levelIndex : lastLevel);
}

function goHome() {
  run = null;
  setPhase('title');
  ui.hideResult();
  ui.showTitle();
  audio.stopBgm();
  const tgt = LEVELS[lastLevel].target;
  $('title-goal-tile').textContent = tgt;
}

// ---------- HUD ----------
function updateHud() {
  if (!run) return;
  const h = run.getHud();
  $('hud-level').textContent = `${t('level')} ${h.level}`;
  $('hud-score').textContent = `${t('score')} ${h.score}`;
  $('hud-best').textContent = `${t('best')} ${best}`;
  $('hud-target-label').textContent = t('target');
  $('hud-target').textContent = h.target;
  $('hud-next-label').textContent = t('next');
  $('hud-next').textContent = h.nextValue;
  $('hud-diamonds').textContent = `◆ ${h.diamonds}`;
  $('btn-bomb').classList.toggle('armed', bombArmed);
  $('btn-bomb').title = `${t('bomb')} (${h.diamonds < 50 ? t('diamonds') : '50'})`;
}

function renderResultTitle() {
  // 切语言时刷新结果屏静态文案（若有结果屏在显）
  $('result-title').textContent = run && run.state.phase === 'won' ? t('winTitle') : t('loseTitle');
}

function showResult(ev) {
  const st = run.state;
  const won = ev.type === 'win';
  const stars = won ? st.stars : 0;
  $('result-title').textContent = won ? t('winTitle') : t('loseTitle');
  $('result-title').classList.toggle('lose', !won);
  const starsEl = $('result-stars');
  starsEl.innerHTML = won ? `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}` : '';
  $('result-meta').textContent = won
    ? `${t('resultScore')}: ${st.score} · ${t('resultBest')}: ${st.bestValue}${st.maxCombo > 1 ? ' · ' + t('combo') + ' ×' + st.maxCombo : ''}`
    : `${t('resultScore')}: ${st.score}`;
  $('btn-next').style.display = won && st.levelIndex + 1 < LEVEL_COUNT ? '' : 'none';
  $('screen-result').classList.remove('hidden');
}

function finishRun(ev) {
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  const st = run.state;
  const won = ev.type === 'win';
  if (won) {
    const idx = st.levelIndex;
    if (idx + 1 < LEVEL_COUNT) unlocked = Math.max(unlocked, idx + 1);
    if (st.score > best) best = st.score;
    Sdk.levelCleared({ level: idx + 1, stars: st.stars, score: st.score });
  } else {
    if (st.score > best) best = st.score;
    Sdk.gameOver({ level: st.levelIndex + 1, score: st.score });
  }
  persist();
  showResult(ev);
  audio.event(won ? 'win' : 'lose', ev);
}

// ---------- 教程（首次自动弹，可跳过，完成/跳过后持久化） ----------
const TUT_STEPS = () => [
  { id: 'place', text: t('tutStep1'), spot: 'board' },
  { id: 'merge', text: t('tutStep2'), spot: 'board' },
  { id: 'target', text: t('tutStep3'), spot: 'board' },
];

function layoutRect() {
  try { return renderer.debugLayout(); } catch { return null; }
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
  const lay = layoutRect();
  const spot = $('tut-spotlight');
  if (lay && s && s.spot) {
    const b = lay.board;
    spot.style.display = 'block';
    spot.style.left = `${b.x - 8}px`;
    spot.style.top = `${b.y - 8}px`;
    spot.style.width = `${b.w + 16}px`;
    spot.style.height = `${b.h + 16}px`;
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

const TUT_TRIGGER = ['place', 'merge', 'merge'];
function tutorialAdvance(evType) {
  if (tutorialStep < 0 || tutorialStep >= TUT_TRIGGER.length) return;
  if (TUT_TRIGGER[tutorialStep] !== evType) return;
  tutorialStep += 1;
  if (tutorialStep >= TUT_TRIGGER.length) endTutorial();
  else renderTutorialStep();
}

// ---------- 事件消费 ----------
function cellCenter(c, r) {
  const lay = layoutRect();
  if (!lay) return { x: WORLD.WIDTH / 2, y: WORLD.HEIGHT / 2 };
  const b = lay.board;
  return {
    x: b.x + c * (lay.cell + lay.gap) + lay.cell / 2,
    y: b.y + (lay.rows - 1 - r) * (lay.cell + lay.gap) + lay.cell / 2,
  };
}

function spawnFx(c, r, color, size, ttl) {
  const p = cellCenter(c, r);
  view.fx.push({ x: p.x + (Math.random() * 30 - 15), y: p.y + (Math.random() * 30 - 15), size, ttl, maxTtl: ttl, color });
}

function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    tutorialAdvance(ev.type);
    switch (ev.type) {
      case 'place':
        view.shake = 1;
        break;
      case 'merge':
        spawnFx(ev.c, ev.r, '#ffffff', 8, 0.35);
        view.shake = 2;
        break;
      case 'combo':
        view.comboText = `${t('combo')} ×${ev.chain}`;
        view.comboTtl = 0.9;
        view.shake = 4;
        break;
      case 'rockClear':
        spawnFx(ev.c, ev.r, '#9aa0d0', 10, 0.4);
        view.shake = 3;
        break;
      case 'rockSpawn':
        view.shake = 1;
        break;
      case 'bomb':
        view.shake = 5;
        spawnFx(ev.col, 0, '#ff5bd6', 14, 0.5);
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

function pickCol(p) {
  const lay = layoutRect();
  if (!lay) return null;
  const b = lay.board;
  if (p.x < b.x || p.x > b.x + b.w || p.y < b.y || p.y > b.y + b.h) return null;
  const c = Math.floor((p.x - b.x) / (lay.cell + lay.gap));
  if (c < 0 || c >= LAYOUT.BOARD_COLS) return null;
  return c;
}

canvas.addEventListener('pointermove', (e) => {
  view.cursor = canvasPos(e);
  view.hoverCol = (run && phase === 'playing' && !bombArmed) ? pickCol(view.cursor) : null;
});

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (!run || phase !== 'playing') return;
  const p = canvasPos(e);
  view.cursor = p;
  const c = pickCol(p);
  if (c == null) return;
  if (bombArmed) {
    const res = run.bomb(c);
    if (res.ok) { bombArmed = false; }
    updateHud();
    return;
  }
  const res = run.place(c);
  if (!res.ok && res.reason === 'full') {
    // 满列 → 由 place 内部发 lose 事件，主循环会消费
  }
  updateHud();
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
  if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'result')) restartLevel();
  if (e.code === 'KeyM') toggleMute();
  if (e.code === 'KeyB' && phase === 'playing') { bombArmed = !bombArmed; updateHud(); }
});

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  $('btn-mute').classList.toggle('is-muted', muted);
  $('btn-mute').textContent = muted ? '🔇' : '🔊';
  persist();
}

// ---------- UI 绑定 ----------
function bind() {
  const on = (id, fn) => {
    const el = $(id);
    if (el) el.addEventListener('click', () => { audio.unlock(); audio.event('click'); fn(); });
  };
  on('btn-start', () => startLevel(lastLevel));
  on('btn-resume', resumeGame);
  on('btn-restart', restartLevel);
  on('btn-restart2', restartLevel);
  on('btn-retry', restartLevel);
  on('btn-next', () => startLevel((run ? run.state.levelIndex : lastLevel) + 1));
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-bomb', () => { if (run && phase === 'playing') { bombArmed = !bombArmed; updateHud(); } });
  on('btn-tut-replay', () => { if (phase === 'paused') resumeGame(); if (phase === 'playing') startTutorial(); });
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result') startTutorial(); });
  on('btn-howto2', () => { startTutorial(); });
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);

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
      const hint = $('tap-hint');
      if (hint) hint.textContent = t('tapHint');
      const tgt = LEVELS[lastLevel].target;
      $('title-goal-tile').textContent = tgt;
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
  if (view.comboTtl > 0) view.comboTtl -= dt;
  for (const fx of view.fx) if (fx.ttl > 0) fx.ttl -= dt;

  // 震屏
  const shakeX = view.shake > 0 ? (Math.random() * 2 - 1) * view.shake : 0;
  const shakeY = view.shake > 0 ? (Math.random() * 2 - 1) * view.shake : 0;

  const gctx = canvas.getContext('2d');
  gctx.save();
  if (shakeX || shakeY) gctx.translate(shakeX, shakeY);
  try {
    renderer.draw(run ? run.state : null, dt, view);
  } catch (err) {
    console.warn('render error', err);
  }
  gctx.restore();
  view.fx = view.fx.filter((fx) => fx.ttl > 0);

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
  sim: () => (run ? run.state : null),
  start: (i) => startLevel(i == null ? lastLevel : i),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => restartLevel(),
  home: () => goHome(),
  save: () => Sdk,
  ui: () => ui,
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return TUT_STEPS().map((s) => s.id); },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
    startTutorial: () => startTutorial(),
  },
  startTutorial: () => startTutorial(),
  debug: {
    state: () => (run ? run.state : null),
    loadLevel: (i) => startLevel(i),
    startSeeded: (i, seed) => {
      const idx = Math.max(0, Math.min(LEVEL_COUNT - 1, i | 0));
      lastLevel = idx;
      bombArmed = false;
      run = createRun(idx, { seed: seed | 0 || 1 });
      view.fx = [];
      setPhase('playing');
      ui.showGame();
      ui.hideResult();
      updateHud();
      return true;
    },
    layout: () => { try { return renderer.debugLayout(); } catch { return null; } },
    place: (c) => { if (run) { const r = run.place(c); updateHud(); return r; } return { ok: false }; },
    bomb: (c) => { if (run) { const r = run.bomb(c); updateHud(); return r; } return { ok: false }; },
    // 贪心自动落一块并同步推进到结算完（供截图/验收）
    settle: () => {
      if (!run) return;
      let guard = 4000;
      while (guard-- > 0 && run.state.phase === 'playing' && run.state.busy > 0) run.step(1 / 60);
      handleEvents(run.drainEvents());
      updateHud();
    },
    greedyCol: () => {
      if (!run) return -1;
      const st = run.state;
      let chosen = -1;
      for (let c = 0; c < st.cols; c += 1) {
        const col = st.grid[c];
        if (col.length && col[col.length - 1].v === st.nextValue && col.length < st.rows) { chosen = c; break; }
      }
      if (chosen < 0) {
        let bestH = Infinity;
        for (let c = 0; c < st.cols; c += 1) {
          if (st.grid[c].length < st.rows && st.grid[c].length < bestH) { bestH = st.grid[c].length; chosen = c; }
        }
      }
      return chosen;
    },
    playGreedy: (n) => {
      if (!run) return 0;
      let done = 0;
      for (let i = 0; i < n && run.state.phase === 'playing'; i += 1) {
        if (run.state.busy > 0) { window.__ll.debug.settle(); }
        const c = window.__ll.debug.greedyCol();
        if (c < 0) break;
        if (run.place(c).ok) {
          done += 1;
          window.__ll.debug.settle();
        } else break;
      }
      updateHud();
      return done;
    },
    fastWin: () => {
      if (!run) return false;
      let guard = 3000;
      while (guard-- > 0 && run.state.phase === 'playing') {
        const c = window.__ll.debug.greedyCol();
        if (c < 0) break;
        if (!run.place(c).ok) break;
        window.__ll.debug.settle();
      }
      updateHud();
      return run.state.phase === 'won';
    },
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    tutorialStep: () => tutorialStep,
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
  $('tap-hint').textContent = t('tapHint');
  $('title-goal-tile').textContent = LEVELS[lastLevel].target;
}
$('btn-mute').textContent = muted ? '🔇' : '🔊';
$('btn-mute').classList.toggle('is-muted', muted);
Sdk.track('load', {});
requestAnimationFrame(frame);
