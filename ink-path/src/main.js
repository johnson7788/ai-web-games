// INK PATH · 主入口：60Hz 固定步长 + 标题/选关/游戏/暂停/结算 + 教程引导 + SDK 统一出口。
// 装配：sim / render / ui / audio；HUD/结算/关卡格/教程的 DOM 由这里直写。
import { STEP } from '../config/game.config.js';
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
let phase = 'title'; // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let fpsSamples = [];
let tutorialStep = -1;
let focusNode = -1; // 键盘 Tab 聚焦的星子

const view = {
  hoverNode: -1,
  cursor: { x: 0, y: 0 },
};

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let unlocked = Math.max(1, Sdk.load('unlocked', 1) | 0);
let starsByLevel = Sdk.load('stars', {}) || {};
let bestByLevel = Sdk.load('best', {}) || {};
let tutorialDone = !!Sdk.load('tutorialDone', false);
let lastLevel = Sdk.load('lastLevel', 0) | 0;

Sdk.ready();
Sdk.onAdStart(() => { if (phase === 'playing') pauseGame(true); });
Sdk.onAdEnd(() => { if (phase === 'paused') resumeGame(); });
audio.setMuted(muted);
ui.setMuted(muted);

function persist() {
  Sdk.save('muted', muted);
  Sdk.save('unlocked', unlocked);
  Sdk.save('stars', starsByLevel);
  Sdk.save('best', bestByLevel);
  Sdk.save('tutorialDone', tutorialDone);
  Sdk.save('lastLevel', lastLevel);
}

function totalStars() {
  return Object.values(starsByLevel).reduce((a, b) => a + (b | 0), 0);
}

// ---------- 阶段状态机 ----------
function setPhase(p) { phase = p; }

function startLevel(idx) {
  idx = Math.max(0, Math.min(LEVEL_COUNT - 1, idx | 0));
  lastLevel = idx;
  run = createRun(idx, { seed: (Date.now() % 2147483647) || 1 });
  focusNode = -1;
  view.hoverNode = -1;
  setPhase('playing');
  ui.showGame();
  hideResult();
  updateHud();
  audio.startBgm();
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
}

function restartLevel() {
  if (run) Sdk.track('restart', { level: run.state.level });
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
function updateHud() {
  if (!run) return;
  const h = run.getHud();
  const lv = LEVELS[run.state.level - 1] || {};
  const name = (lv.name && (lv.name[i18n.lang] || lv.name.en)) || '';
  $('hud-level').textContent = `${t('level')} ${run.state.level}${name ? ' · ' + name : ''}`;
  $('hud-mode').textContent = run.state.mode === 'nodes' ? t('modeNodes') : t('modeEdges');
  $('hud-moves').textContent = `${t('moves')} ${h.moves}/${h.par}`;
  const best = bestByLevel[run.state.level] | 0;
  const bestEl = $('hud-best');
  if (best) {
    bestEl.textContent = `${t('best')} ${best}`;
    bestEl.style.display = '';
  } else {
    bestEl.style.display = 'none';
  }
  $('hud-moves').classList.toggle('over-par', h.moves > h.par);
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
  const { won, stars, moves, par, reason, hasNext } = res;
  $('result-title').textContent = won ? t('winTitle') : t('loseTitle');
  $('result-title').classList.toggle('lose', !won);
  $('result-stars').innerHTML = won
    ? `<span class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>${stars >= 3 ? `<em>${t('perfect')}</em>` : ''}`
    : '';
  $('result-meta').textContent = won
    ? `${t('moves')} ${moves} / ${par}`
    : (reason === 'giveUp' ? t('giveUpReason') : t('deadEnd'));
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
    const prevBest = bestByLevel[idx] | 0;
    bestByLevel[idx] = prevBest ? Math.min(prevBest, st.moves) : st.moves;
    if (idx < LEVEL_COUNT) unlocked = Math.max(unlocked, idx + 1);
    buildLevelGrid();
  }
  persist();
  Sdk.track(won ? 'win' : 'fail', {
    level: st.level, stars, moves: st.moves, par: st.par, undos: st.undos, mode: st.mode,
  });
  showResult({
    won, stars, moves: st.moves, par: st.par,
    reason: ev.reason || null, hasNext: st.level + 1 < LEVEL_COUNT,
  });
  audio.event(won ? 'win' : 'lose');
}

// ---------- 教程引导（首次自动弹，可跳过，完成/跳过后持久化不再自动弹） ----------
const TUT_IDS = ['firstMove', 'weave', 'backtrack', 'win'];

function TUT_STEPS() {
  const st = run ? run.state : null;
  const avail = run ? run.available() : [];
  const adj = st && avail.length ? avail[0].next : (st ? st.start : 0);
  return [
    { text: t('tutStep1'), spot: st ? st.start : 0 },
    { text: t('tutStep2'), spot: adj },
    { text: t('tutStep3'), spot: 'web' },
    { text: t('tutStep4'), spot: 'hud' },
  ];
}

function layoutRect(which) {
  try {
    const lay = renderer.debugLayout();
    if (!lay) return null;
    if (which === 'web') return lay.web;
    if (which === 'hud') return lay.hud;
    if (typeof which === 'number' && lay.nodes && lay.nodes[which]) {
      const n = lay.nodes[which];
      return { x: n.x - n.r, y: n.y - n.r, w: n.r * 2, h: n.r * 2 };
    }
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
  const rect = s && s.spot != null ? layoutRect(s.spot) : null;
  const spot = $('tut-spotlight');
  if (rect) {
    spot.style.display = 'block';
    spot.style.left = `${Math.max(0, rect.x - 8)}px`;
    spot.style.top = `${Math.max(0, rect.y - 8)}px`;
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

// 真实动作驱动的第一步推进：第一次「织丝」后自动进入第 2 步
function tutorialAdvance(evType) {
  if (tutorialStep !== 0) return;
  if (evType !== 'move') return;
  tutorialStep = 1;
  renderTutorialStep();
}

// ---------- 事件消费 ----------
function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    tutorialAdvance(ev.type);
    switch (ev.type) {
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

function actOnNode(id) {
  if (!run || phase !== 'playing' || id < 0) return;
  const s = run.state;
  const idx = s.path.lastIndexOf(id);
  if (idx >= 0 && idx < s.path.length - 1) {
    run.backtrack(id);
    updateHud();
    return;
  }
  if (id === s.current) return;
  run.tryMove(id);
  updateHud();
}

canvas.addEventListener('pointermove', (e) => {
  view.cursor = canvasPos(e);
  if (run && phase === 'playing') {
    view.hoverNode = renderer.hitNode(view.cursor, run.state);
  } else {
    view.hoverNode = -1;
  }
});

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (!run || phase !== 'playing') return;
  const p = canvasPos(e);
  view.cursor = p;
  const id = renderer.hitNode(p, run.state);
  if (id >= 0) {
    focusNode = id;
    actOnNode(id);
  }
});

canvas.addEventListener('pointerleave', () => { view.hoverNode = -1; });

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
    return;
  }
  if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'result')) restartLevel();
  if (e.code === 'KeyM') toggleMute();
  if (e.code === 'KeyU' && phase === 'playing') { undoOnce(); }
  if (phase !== 'playing' || !run) return;

  if (e.code === 'Tab') {
    e.preventDefault();
    const avail = run.available();
    if (avail.length) {
      const ids = avail.map((o) => o.next);
      const cur = ids.indexOf(focusNode);
      focusNode = ids[(cur + 1) % ids.length];
    } else {
      focusNode = (focusNode + 1) % run.state.nodes.length;
    }
  }
  if (e.code === 'Enter' || e.code === 'Space') {
    e.preventDefault();
    if (focusNode >= 0) actOnNode(focusNode);
  }
});

function undoOnce() {
  if (!run || phase !== 'playing') return;
  const ok = run.undo();
  if (ok.ok) updateHud();
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
  on('btn-next', () => startLevel((run ? run.state.level : lastLevel)));
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-undo', undoOnce);
  on('btn-giveup', () => { if (run && phase === 'playing') { run.forfeit(); updateHud(); } });
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

  try {
    renderer.draw(run ? run.state : null, dt, { ...view, focusNode });
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
  save: (k, v) => Sdk.save(k, v),
  ui: () => ui,
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return TUT_IDS; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: () => {
      if (!run) return null;
      const st = run.state;
      return {
        ...st,
        pathLen: st.path.length,
        visitedCount: st.mode === 'nodes' ? bitCount(st.visitedMask) : bitCount(st.traversedMask),
        mode: st.mode,
      };
    },
    layout: () => { try { return renderer.debugLayout(); } catch { return null; } },
    loadLevel: (i) => startLevel(i),
    startSeeded: (i, seed) => {
      const idx = Math.max(0, Math.min(LEVEL_COUNT - 1, i | 0));
      lastLevel = idx;
      run = createRun(idx, { seed: seed | 0 || 1 });
      focusNode = -1;
      view.hoverNode = -1;
      setPhase('playing');
      ui.showGame();
      hideResult();
      updateHud();
      return true;
    },
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    startTutorial: () => startTutorial(),
    tutorialStep: () => tutorialStep,
    autoPlaceSolution: () => {
      if (!run) return false;
      const sol = run._solution;
      if (!sol) return false;
      for (let i = 1; i < sol.length; i += 1) {
        if (run.state.phase !== 'playing') break;
        run.tryMove(sol[i]);
      }
      return true;
    },
    fastForward: () => {
      if (!run) return false;
      try {
        handleEvents(run.drainEvents());
        return true;
      } catch { return false; }
    },
    giveUp: () => { if (run) run.forfeit(); },
    focusNode: () => focusNode,
  },
};

function bitCount(mask) {
  let c = 0;
  let m = mask;
  while (m) { m &= m - 1; c += 1; }
  return c;
}

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
