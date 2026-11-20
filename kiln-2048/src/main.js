// KILN 2048 · 主入口：60Hz 固定步长 + 标题/游戏/暂停/结算 + 教程引导 + SDK 统一出口。
// 装配：sim（物理/合并）+ render（场景/釉球）+ audio（窑火 BGM/SFX）+ ui（屏幕/语言）。
// 输入：鼠标/触屏移动投放点 + 点击落下；←→ 精调、空格速降；重锤模式点击砸碎任意球。
import { STEP } from '../config/game.config.js';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';
import { createRun, radius } from './game/sim.js';
import { autoPlay, bestDropX, boardSettled } from './game/ai.js';
import { createRenderer } from './render/index.js';
import { createAudio } from './core/audio.js';
import { ui } from './ui/ui.js';
import { i18n, t, syncDocumentLang } from './core/i18n.js';
import { glazeName } from '../config/glaze.js';
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
let hammerMode = false;
let tutorialStep = -1; // -1 = 未激活
let lastLevel = 0;

const view = {
  cursor: { x: 0, y: 0 },
  hammerMode: false,
  fxQueue: [],       // {type,x,y,r,ttl,maxTtl,seed}
  firePulse: 0,      // 出窑整屏暖光脉冲 0..1
  shake: 0,
};

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let unlocked = Math.max(1, Sdk.load('unlocked', 1) | 0);
let starsByLevel = Sdk.load('stars', {}) || {};
let tutorialDone = !!Sdk.load('tutorialDone', false);
let best = Sdk.load('best', 0) | 0;

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
  Sdk.save('best', best);
}

function totalStars() {
  return Object.values(starsByLevel).reduce((a, b) => a + (b | 0), 0);
}

// ---------- 阶段状态机 ----------
function setPhase(p) { phase = p; }

function startLevel(idx) {
  idx = Math.max(0, Math.min(LEVEL_COUNT - 1, idx | 0));
  lastLevel = idx;
  hammerMode = false;
  run = createRun(idx, { seed: (Date.now() % 2147483647) || 1 });
  setPhase('playing');
  ui.showGame();
  hideResult();
  updateHud();
  audio.startBgm();
  Sdk.track('start', { level: idx + 1 });
  if (!tutorialDone && idx === 0) startTutorial();
}

function startSeeded(idx, seed) {
  idx = Math.max(0, Math.min(LEVEL_COUNT - 1, idx | 0));
  lastLevel = idx;
  hammerMode = false;
  run = createRun(idx, { seed: seed | 0 || 1 });
  setPhase('playing');
  ui.showGame();
  hideResult();
  updateHud();
  return true;
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
function goalText() {
  if (!run) return '';
  const g = run.state.goal;
  const lang = i18n.lang;
  if (g.type === 'mergeTo') return t('goalMergeTo', { v: glazeName(g.target, lang) });
  if (g.type === 'eliminate') return t('goalEliminate', { n: g.count, v: glazeName(g.target, lang) });
  if (g.dropLimit) return t('goalScore', { s: g.target, d: g.dropLimit });
  return t('goalScoreNoLimit', { s: g.target });
}

function dropsText() {
  if (!run) return '';
  const limit = run.state.dropLimit;
  if (!Number.isFinite(limit)) return t('dropsInf');
  const left = Math.max(0, limit - run.state.drops);
  return t('dropsLeft', { n: left });
}

function updateHud() {
  if (!run) return;
  const s = run.state;
  const lv = LEVELS[s.level - 1] || {};
  const nm = (lv.name && (lv.name[i18n.lang] || lv.name.en)) || '';
  $('hud-level').textContent = `${t('level')} ${s.level}${nm ? ' · ' + nm : ''}`;
  $('hud-goal').textContent = `${t('goal')}: ${goalText()}`;
  $('hud-score').textContent = `${t('score')}: ${s.score}`;
  $('hud-drops').textContent = dropsText();
  $('hammer-badge').textContent = s.hammerLeft;
  $('btn-hammer').style.display = s.hammerLeft > 0 ? '' : 'none';
  $('btn-hammer').classList.toggle('hammer-armed', hammerMode);
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

function starsFor() {
  const g = run.state.goal;
  let base = g.target || 1;
  if (g.type === 'eliminate') base = g.target * g.count;
  const s = run.state.score;
  if (s >= base * 2) return 3;
  if (s >= base * 1.5) return 2;
  return 1;
}

function showResult(res) {
  const { won, stars, score, reason, hasNext, maxValue } = res;
  $('result-title').textContent = won ? t('winTitle') : t('loseTitle');
  $('result-title').classList.toggle('lose', !won);
  const starsEl = $('result-stars');
  starsEl.innerHTML = won
    ? `<span class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>${stars >= 3 ? `<em>${t('perfect')}</em>` : ''}`
    : '';
  $('result-meta').textContent = won
    ? `${t('score')}: ${score} · ${t('maxValue', { v: glazeName(maxValue, i18n.lang) })}`
    : (reason === 'dropsOut' ? t('failDropsOut') : t('failOverflow'));
  $('result-score').textContent = won ? `${score}` : '';
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
  const stars = won ? starsFor() : 0;
  if (won) {
    const idx = st.level;
    starsByLevel[idx] = Math.max(starsByLevel[idx] | 0, stars);
    if (idx < LEVEL_COUNT) unlocked = Math.max(unlocked, idx + 1);
    best = Math.max(best, st.score);
    buildLevelGrid();
  }
  persist();
  Sdk.track(won ? 'win' : 'fail', {
    level: st.level, stars, score: st.score, maxValue: st.maxValue, drops: st.drops,
  });
  showResult({
    won, stars, score: st.score, maxValue: st.maxValue,
    reason: ev.reason || null, hasNext: st.level + 1 <= LEVEL_COUNT,
  });
  audio.event(won ? 'win' : 'lose');
}

// ---------- 教程引导（首次自动弹，可跳过，可重看，持久化不再自动弹） ----------
const TUT_STEPS = () => [
  { text: t('tutStep1'), spot: 'spawn' },
  { text: t('tutStep2'), spot: 'chamber' },
  { text: t('tutStep3'), spot: 'chamber' },
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

function endTutorial() {
  tutorialStep = -1;
  tutorialDone = true;
  persist();
  renderTutorialStep();
}

// 真实动作驱动教学推进：0=drop 1=merge 2=eliminate（第 3 步也可用按钮跳过）
const TUT_TRIGGER = ['drop', 'merge', 'eliminate'];

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
      case 'drop':
        view.shake = Math.max(view.shake, 1.5);
        break;
      case 'merge':
        view.fxQueue.push({ type: 'merge', x: ev.x, y: ev.y, r: radius(ev.value), ttl: 0.4, maxTtl: 0.4 });
        break;
      case 'eliminate':
        view.fxQueue.push({ type: 'eliminate', x: ev.x, y: ev.y, r: radius(ev.value), ttl: 0.6, maxTtl: 0.6 });
        view.firePulse = 1;
        view.shake = 4;
        break;
      case 'hammer':
        view.fxQueue.push({ type: 'hammer', x: ev.x, y: ev.y, r: radius(ev.value), ttl: 0.4, maxTtl: 0.4, seed: Math.random() * 6 });
        view.shake = 3;
        break;
      case 'thaw':
        view.fxQueue.push({ type: 'thaw', x: ev.x, y: ev.y, r: radius(ev.value), ttl: 0.4, maxTtl: 0.4, seed: Math.random() * 6 });
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
    x: (e.clientX - rect.left) * (1280 / rect.width),
    y: (e.clientY - rect.top) * (720 / rect.height),
  };
}

function pickBall(p) {
  if (!run) return null;
  let best = null;
  for (const b of run.state.balls) {
    const d = Math.hypot(b.x - p.x, b.y - p.y);
    if (d <= b.r + 6) {
      if (!best || b.y < best.y) best = b;
    }
  }
  return best ? best.id : null;
}

canvas.addEventListener('pointermove', (e) => {
  view.cursor = canvasPos(e);
  if (run && phase === 'playing' && run.state.held && !hammerMode) {
    run.setDropX(view.cursor.x);
  }
});

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (!run || phase !== 'playing') return;
  const p = canvasPos(e);
  view.cursor = p;
  if (hammerMode) {
    const id = pickBall(p);
    if (id != null) {
      run.smash(id);
      hammerMode = false;
      view.hammerMode = false;
      updateHud();
    }
    return;
  }
  if (run.state.held) {
    run.drop();
    updateHud();
  }
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
  if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'result')) restartLevel();
  if (e.code === 'KeyM') toggleMute();
  if (e.code === 'ArrowLeft' && run && phase === 'playing' && run.state.held) {
    e.preventDefault();
    run.setDropX(run.state.held.x - 12);
  }
  if (e.code === 'ArrowRight' && run && phase === 'playing' && run.state.held) {
    e.preventDefault();
    run.setDropX(run.state.held.x + 12);
  }
  if (e.code === 'Space' && run && phase === 'playing' && run.state.held) {
    e.preventDefault();
    run.drop();
    updateHud();
  }
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
  on('btn-hammer', () => {
    if (run && phase === 'playing' && run.state.hammerLeft > 0) {
      hammerMode = !hammerMode;
      view.hammerMode = hammerMode;
      updateHud();
    }
  });
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result') startTutorial(); });
  on('btn-tut-replay', () => { if (phase === 'paused') resumeGame(); if (phase === 'playing') startTutorial(); });
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
    view.hammerMode = hammerMode;
  }

  if (view.firePulse > 0) view.firePulse = Math.max(0, view.firePulse - dt * 2.2);
  if (view.shake > 0) view.shake = Math.max(0, view.shake - dt * 14);
  for (const fx of view.fxQueue) fx.ttl -= dt;
  view.fxQueue = view.fxQueue.filter((fx) => fx.ttl > 0);
  if (run) run.state.killList = [];

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
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['drop', 'merge', 'eliminate']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  save: (k, v) => Sdk.save(k, v),
  share: (p) => Sdk.share(p),
  ui: () => ui,
  debug: {
    state: () => {
      if (!run) return null;
      const st = run.state;
      return { ...st, ballCount: st.balls.length, heldValue: st.held ? st.held.value : null, balls: st.balls.length };
    },
    layout: () => { try { return renderer.debugLayout(); } catch { return null; } },
    loadLevel: (i) => startLevel(i),
    startSeeded: (i, seed) => startSeeded(i, seed),
    setDropX: (x) => (run ? run.setDropX(x) : { ok: false }),
    drop: () => (run ? run.drop() : { ok: false }),
    smash: (id) => (run ? run.smash(id) : { ok: false }),
    hammerLeft: () => (run ? run.state.hammerLeft : 0),
    hammerMode: () => hammerMode,
    // 验收辅助：贪心自动玩到终局（与 selfplay 同策略），返回终局 phase
    autoPlaceSolution: () => {
      if (!run) return false;
      autoPlay(run, 90);
      return run.state.phase;
    },
    fastForward: () => {
      if (!run) return false;
      autoPlay(run, 120);
      return run.state.phase;
    },
    // 贪心投放一枚（营销录屏用：在实时帧循环里体现下落+合并）
    dropNext: () => {
      if (!run) return { ok: false };
      if (run.state.held && boardSettled(run.state)) {
        run.setDropX(bestDropX(run));
        run.drop();
        return { ok: true };
      }
      return { ok: false };
    },
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    startTutorial: () => startTutorial(),
    tutorialStep: () => tutorialStep,
    aim: (x) => (run ? run.setDropX(x) : { ok: false }),
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
