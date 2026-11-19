// 主入口：60Hz 固定步长 + 标题/游戏/暂停/结算 + 教程引导 + SDK 统一出口
// 契约：window.__ll = { state:{phase,lang}, start, pause, resume, restart, run,
//   tutorial:{active,step,steps,current,skip,startTutorial}, startTutorial, debug }。
import { STEP, GAME, WORLD } from '../config/game.config.js';
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
let phase = 'title'; // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let fpsSamples = [];
let tutorialStep = -1; // -1 = 未激活

const view = { time: 0, fxQueue: [], shake: 0 };

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let best = Sdk.load('best', 0) | 0;
let tutorialDone = !!Sdk.load('tutorialDone', false);

Sdk.ready();
audio.setMuted(muted);
ui.setMuted(muted);

function persist() {
  Sdk.save('muted', muted);
  Sdk.save('best', best);
  Sdk.save('tutorialDone', tutorialDone);
}

// ---------- 阶段状态机 ----------
function setPhase(p) { phase = p; }

function startRun(seed) {
  seed = (seed == null ? ((Date.now() % 2147483647) || 1) : (seed >>> 0));
  run = createRun({ seed });
  view.fxQueue = [];
  view.shake = 0;
  setPhase('playing');
  ui.applyLang();
  showPlaying();
  hideResult();
  updateHud();
  audio.startBgm();
  Sdk.newRun({ seed });
  Sdk.track('start', { seed });
  if (!tutorialDone) startTutorial();
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

function restartRun() {
  if (run) Sdk.track('restart', {});
  startRun();
}

function goHome() {
  run = null;
  setPhase('title');
  hideResult();
  $('screen-pause').classList.add('hidden');
  showTitle();
}

function showPlaying() {
  $('hud').classList.remove('hidden');
  $('controls').classList.remove('hidden');
  $('screen-title').classList.add('hidden');
  $('screen-pause').classList.add('hidden');
  $('screen-result').classList.add('hidden');
}

function showTitle() {
  $('hud').classList.add('hidden');
  $('controls').classList.add('hidden');
  $('screen-title').classList.remove('hidden');
  $('screen-pause').classList.add('hidden');
  $('screen-result').classList.add('hidden');
  $('best-score').textContent = `${t('best')}: ${best}`;
}

function hideResult() {
  $('screen-result').classList.add('hidden');
}

// ---------- HUD / 结算 ----------
function updateHud() {
  if (!run) return;
  const h = run.getHud();
  $('hud-score').textContent = `${t('score')} ${h.score}`;
  const comboEl = $('hud-combo');
  comboEl.classList.toggle('hidden', h.comboMult <= 1);
  comboEl.textContent = `×${h.comboMult}`;
  $('hud-level').textContent = `${t('level')} ${h.level}`;
  const sh = $('hud-shield');
  sh.classList.toggle('hidden', h.shield <= 0);
  sh.textContent = `${t('shield')} ${h.shield}`;
}

function starsOf(score) {
  let n = 0;
  for (const th of GAME.STARS) if (score >= th) n += 1;
  return n;
}

function showResult(st) {
  const stars = starsOf(st.score);
  const isBest = st.score > best;
  $('result-title').textContent = t('resultTitle');
  $('result-stars').innerHTML =
    `<span class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>` +
    (stars >= 3 ? `<em>${t('perfect')}</em>` : '');
  $('result-score').textContent = t('resultScore', { s: st.score });
  $('result-best').textContent = t('resultBest', { b: Math.max(best, st.score) });
  $('result-best').classList.toggle('newbest', isBest);
  $('result-newbest').classList.toggle('hidden', !isBest);
  $('result-newbest').textContent = t('newBest');
  $('result-stats').textContent = t('resultStats', { c: st.stats.collected, d: st.stats.dodged });
  $('screen-result').classList.remove('hidden');
}

function finishRun(ev) {
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  const st = run.state;
  if (st.score > best) best = st.score;
  persist();
  Sdk.gameOver({ score: st.score, level: st.level, reason: ev.reason });
  showResult({ score: st.score, stats: st.stats });
  audio.event('lose', ev);
}

// ---------- 教程引导 ----------
const TUT_STEPS = () => [
  { id: 'move', text: t('tutStep1'), spot: 'controls' },
  { id: 'collect', text: t('tutStep2'), spot: 'playfield' },
  { id: 'shield', text: t('tutStep3'), spot: 'playfield' },
];

function startTutorial() {
  if (!run) return;
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
  $('tut-text').textContent = s.text;
  $('tut-skip').textContent = t('tutSkip');
  $('tut-next').textContent = t('tutNext');
  const spot = $('tut-spotlight');
  const rect = layoutRect(s.spot);
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

function layoutRect(which) {
  const lay = renderer.debugLayout();
  if (which === 'controls') {
    const el = $('controls');
    const r = el.getBoundingClientRect();
    const c = canvas.getBoundingClientRect();
    return { x: (r.left - c.left) * (WORLD.WIDTH / c.width), y: (r.top - c.top) * (WORLD.HEIGHT / c.height), w: r.width * (WORLD.WIDTH / c.width), h: r.height * (WORLD.HEIGHT / c.height) };
  }
  if (which === 'playfield' && lay) {
    return { x: lay.playfield.x + 300, y: lay.horizon + 60, w: 680, h: 320 };
  }
  return null;
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

const TUT_TRIGGER = ['move', 'collect', 'shieldGet'];
function tutorialAdvance(evType) {
  if (tutorialStep < 0 || tutorialStep >= TUT_TRIGGER.length) return;
  if (TUT_TRIGGER[tutorialStep] !== evType) return;
  tutorialNext();
}

// ---------- 事件消费 ----------
function burst(x, y, color, n = 8) {
  for (let i = 0; i < n; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const sp = 60 + Math.random() * 140;
    view.fxQueue.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, r: 2 + Math.random() * 4, ttl: 0.5 + Math.random() * 0.3, max: 0.8, color });
  }
}

function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    tutorialAdvance(ev.type);
    switch (ev.type) {
      case 'move':
        view.fxQueue.push({ x: GAME.LANE_X[ev.lane], y: GAME.PLAYER_Y + 30, vx: -ev.dir * 60, vy: 0, r: 5, ttl: 0.25, max: 0.25, color: '#59f2ff' });
        break;
      case 'collect':
        burst(GAME.LANE_X[ev.lane ?? run.state.lane], GAME.PLAYER_Y, '#39ff88', 10);
        view.shake = Math.min(4, view.shake + 1);
        break;
      case 'dodge':
        view.fxQueue.push({ x: GAME.LANE_X[run.state.lane], y: GAME.PLAYER_Y, vx: 0, vy: -40, r: 4, ttl: 0.3, max: 0.3, color: '#ffd84e' });
        break;
      case 'shieldGet':
        burst(GAME.LANE_X[ev.lane ?? run.state.lane], GAME.PLAYER_Y, '#22d3ee', 8);
        break;
      case 'shieldBlock':
        burst(GAME.LANE_X[ev.lane ?? run.state.lane], GAME.PLAYER_Y, '#22d3ee', 14);
        view.shake = 6;
        break;
      case 'combo':
        burst(GAME.LANE_X[run.state.lane], GAME.PLAYER_Y - 30, '#ffd84e', 6);
        break;
      case 'lose':
        burst(GAME.LANE_X[run.state.lane], GAME.PLAYER_Y, '#ff2e63', 20);
        view.shake = 10;
        finishRun(ev);
        return;
      default:
        break;
    }
  }
}

// ---------- 输入 ----------
function tryMove(dir) {
  if (!run || phase !== 'playing') return;
  const res = run.move(dir);
  if (res.ok) {
    audio.unlock();
    updateHud();
  }
}

function bind() {
  const on = (id, fn) => {
    const el = $(id);
    if (el) el.addEventListener('click', () => { audio.unlock(); fn(); });
  };
  on('btn-start', () => startRun());
  on('btn-resume', resumeGame);
  on('btn-restart', restartRun);
  on('btn-restart2', restartRun);
  on('btn-retry', restartRun);
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-howto', () => { if (phase === 'playing') startTutorial(); });
  on('btn-howto2', () => { if (phase === 'paused') { resumeGame(); } startTutorial(); });
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);
  on('btn-left', () => tryMove(-1));
  on('btn-right', () => tryMove(1));

  // rotate skip：内联 onclick 兜底（模块未加载也能关遮罩）
  on('btn-rotate-skip', () => {
    const rs = $('rotate-screen');
    if (rs) rs.style.display = 'none';
  });

  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = $(id);
    if (!sel) continue;
    sel.addEventListener('change', () => {
      ui.setLang(sel.value);
      refreshTexts();
    });
  }

  window.addEventListener('keydown', (e) => {
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') { e.preventDefault(); tryMove(-1); }
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') { e.preventDefault(); tryMove(1); }
    else if (k === 'Escape' || k === 'p' || k === 'P') {
      if (phase === 'playing') pauseGame();
      else if (phase === 'paused') resumeGame();
    } else if (k === 'r' || k === 'R') { if (phase !== 'title') restartRun(); }
    else if (k === 'm' || k === 'M') { toggleMute(); }
  });

  // 触屏滑扫换道
  let swipeX = null;
  canvas.addEventListener('pointerdown', (e) => { audio.unlock(); swipeX = e.clientX; });
  canvas.addEventListener('pointerup', (e) => {
    if (swipeX == null) return;
    const dx = e.clientX - swipeX;
    swipeX = null;
    if (Math.abs(dx) < 28) return;
    tryMove(dx > 0 ? 1 : -1);
  });
}

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  ui.setMuted(muted);
  persist();
}

function refreshTexts() {
  $('title-text').textContent = t('title');
  $('subtitle-text').textContent = t('subtitle');
  $('btn-start').textContent = t('start');
  $('btn-resume').textContent = t('resume');
  $('btn-restart').setAttribute('aria-label', t('restart'));
  $('btn-restart2').textContent = t('restart');
  $('btn-home').setAttribute('aria-label', t('home'));
  $('btn-home2').textContent = t('home');
  $('btn-home3').textContent = t('home');
  $('btn-retry').textContent = t('retry');
  $('btn-mute').setAttribute('aria-label', t('mute'));
  $('btn-howto').setAttribute('aria-label', t('howto'));
  $('btn-howto2').textContent = t('howto');
  $('pause-title').textContent = t('paused');
  $('btn-left').setAttribute('aria-label', t('left'));
  $('btn-right').setAttribute('aria-label', t('right'));
  $('best-score').textContent = `${t('best')}: ${best}`;
  $('rotate-text').textContent = t('rotateHint');
  $('btn-rotate-skip').textContent = t('rotateSkip');
  if (run) updateHud();
  renderTutorialStep();
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
  view.fxQueue = view.fxQueue.filter((p) => p.ttl > 0);

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
  sim: () => (run ? run.state : null),
  start: (seed) => startRun(seed),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => restartRun(),
  home: () => goHome(),
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['move', 'collect', 'shield']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
    startTutorial: () => startTutorial(),
  },
  startTutorial: () => startTutorial(),
  save: (key, value) => Sdk.save(key, value),
  load: (key, fallback) => Sdk.load(key, fallback),
  share: (payload) => Sdk.share(payload || {}),
  ui,
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: () => (run ? run.state : null),
    startSeeded: (seed) => startRun(seed),
    setLane: (lane) => { if (run) run.state.lane = Math.max(0, Math.min(3, lane | 0)); },
    fastForward: () => {
      if (!run) return false;
      let guard = 6000;
      while (guard-- > 0 && run.state.phase !== 'over') {
        run.step(0.5);
        handleEvents(run.drainEvents());
        if (phase === 'result') break;
      }
      return phase === 'result';
    },
    seekOnce: () => {
      // 简单 bot：朝最近的包裹/护盾/威胁做一次换道
      if (!run || phase !== 'playing') return { ok: false };
      const s = run.state;
      let target = null;
      let bestY = -Infinity;
      for (const e of s.entities) {
        if (e.removed) continue;
        if (e.kind === 'goods' || e.kind === 'shield') {
          if (e.y > bestY) { bestY = e.y; target = e.lane; }
        }
      }
      if (target == null) {
        // 找最近的路障，避免撞上
        let threat = null;
        let bestT = -Infinity;
        for (const e of s.entities) {
          if (e.kind === 'barrier' && !e.removed) {
            if (e.y > bestT) { bestT = e.y; threat = e.lane; }
          }
        }
        if (threat == null || threat !== s.lane) return { ok: false };
        target = (s.lane + 1) % 4;
      }
      if (target === s.lane) return { ok: false };
      return run.move(target > s.lane ? 1 : -1);
    },
    giveUp: () => window.__ll.debug.fastForward(),
    forceResult: (score) => {
      if (!run) return false;
      const s = run.state;
      if (score != null) {
        s.score = Math.max(0, score | 0);
        s.stats.collected = Math.floor(s.score / 2);
        s.stats.dodged = Math.max(0, s.score - s.stats.collected);
      }
      finishRun({ type: 'lose', reason: 'crash' });
      return phase === 'result';
    },
  },
};

// ---------- 启动 ----------
ui.onLang = refreshTexts;
bind();
syncDocumentLang();
ui.applyLang();
showTitle();
Sdk.track('load', {});
requestAnimationFrame(frame);
