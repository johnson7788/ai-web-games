// 主入口：60Hz 固定步长 + 标题/选关/游戏/暂停/结算 + 教程引导 + SDK 统一出口。
// 契约见 docs/README.md。装配：sim / render / ui / audio / sdk。
// 职责划分：ui.js 只做语言与屏幕显隐；HUD/结算/关卡格/教程的 DOM 由这里直写。
import { STEP, LANE_CODES, TRACK_COUNT } from '../config/game.config.js';
import { LEVELS, LEVEL_COUNT, CHAPTERS } from '../config/levels.js';
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

const REAL = new Set(['tap', 'hold', 'slide', 'slideEnd']);

let run = null;
let phase = 'title'; // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let fpsSamples = [];
let tutorialStep = -1;

const view = {
  fxQueue: [], // { type:'hit'|'miss', track, grade, ttl, maxTtl }
  shake: 0,
  cursor: { x: 0, y: 0 },
};

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let unlocked = Math.max(1, Sdk.load('unlocked', 1) | 0);
let starsByLevel = Sdk.load('stars', {}) || {};
let tutorialDone = !!Sdk.load('tutorialDone', false);
let best = Sdk.load('best', 0) | 0;
let lastLevel = Sdk.load('lastLevel', 0) | 0;

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
  setPhase('playing');
  ui.showGame();
  hideResult();
  view.fxQueue = [];
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
function updateHud() {
  if (!run) return;
  const h = run.getHud();
  const lv = LEVELS[run.state.level - 1] || {};
  $('hud-level').textContent = `${t('level')} ${run.state.level}${lv.name ? ' · ' + (lv.name[i18n.lang] || lv.name.en || '') : ''}`;
  $('hud-score').textContent = String(h.score);
  $('hud-combo').textContent = h.combo > 0 ? `${h.combo}×` : '';
  $('hud-combo').style.display = h.combo > 0 ? '' : 'none';
  $('hud-combo').classList.toggle('combo-hot', h.combo >= 8);
  const pct = Math.max(0, Math.min(100, (h.hp / h.hpMax) * 100));
  $('hp-fill').style.width = `${pct}%`;
  $('hp-fill').classList.toggle('hp-low', pct <= 30);
  $('hud-groove').style.display = h.groove ? '' : 'none';
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
  $('chapter-tag').textContent = chapterLabelFor(lastLevel || 0);
}

function chapterLabelFor(idx) {
  const scene = (LEVELS[idx] || LEVELS[0]).scene;
  const ch = CHAPTERS.find((c) => c.scene === scene);
  return ch ? (ch.name[i18n.lang] || ch.name.en) : '';
}

function showResult(res) {
  const { won, stars, score, accuracy, maxCombo, hasNext, reason } = res;
  $('result-title').textContent = won ? t('winTitle') : t('loseTitle');
  $('result-title').classList.toggle('lose', !won);
  $('result-stars').innerHTML = won
    ? `<span class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>` + (stars >= 3 ? `<em>${t('perfectFull')}</em>` : '')
    : `<span class="lose-reason">${reason === 'hp' ? t('loseReasonHp') : t('loseTitle')}</span>`;
  $('result-meta').textContent = won
    ? `${t('score')} ${score} · ${t('accuracy')} ${Math.round(accuracy * 100)}% · ${t('maxCombo')} ${maxCombo}`
    : `${t('score')} ${score}`;
  $('btn-next').style.display = won && hasNext ? '' : 'none';
  $('screen-result').classList.remove('hidden');
}

function hideResult() {
  $('screen-result').classList.add('hidden');
}

function finishRun(ev) {
  setPhase('result');
  audio.stopBgm();
  view.fxQueue = [];
  if (tutorialStep >= 0) endTutorial();
  const st = run.state;
  const res = st.result || { won: false, stars: 0, score: 0, accuracy: 0, maxCombo: 0 };
  if (res.won) {
    const idx = st.level;
    starsByLevel[idx] = Math.max(starsByLevel[idx] | 0, res.stars);
    if (idx < LEVEL_COUNT) unlocked = Math.max(unlocked, idx + 1);
    best = Math.max(best, res.score | 0);
    buildLevelGrid();
  }
  persist();
  Sdk.track(res.won ? 'win' : 'fail', {
    level: st.level + 1, score: res.score, stars: res.stars,
    accuracy: res.accuracy, maxCombo: res.maxCombo, durationMs: Math.round(st.duration * 1000),
  });
  showResult({ ...res, hasNext: st.level + 1 < LEVEL_COUNT });
  audio.event(res.won ? 'win' : 'lose', {});
}

// ---------- 教程引导 ----------
const TUT_STEPS = () => [
  { text: t('tutStep1'), spot: 'lanes' },
  { text: t('tutStep2'), spot: 'judge' },
  { text: t('tutStep3'), spot: 'hp' },
];

function layoutRect(which) {
  try {
    const lay = renderer.debugLayout();
    if (!lay) return null;
    if (which === 'lanes') {
      const first = lay.lanes[0];
      const last = lay.lanes[lay.lanes.length - 1];
      return { x: first.x - 8, y: first.y - 8, w: (last.x + last.w - first.x) + 16, h: first.h + 16 };
    }
    if (which === 'judge') return { x: lay.judge.x, y: lay.judge.y - 10, w: lay.judge.w, h: lay.judge.h + 20 };
    if (which === 'hp') {
      const el = $('hud-hp');
      if (el) { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }
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
  const rect = s && s.spot && layoutRect(s.spot);
  const spot = $('tut-spotlight');
  if (rect) {
    spot.style.display = 'block';
    spot.style.left = `${rect.x}px`;
    spot.style.top = `${rect.y}px`;
    spot.style.width = `${rect.w}px`;
    spot.style.height = `${rect.h}px`;
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

// 真实动作驱动的推进：0=noteHit 1=grooveOn（第 3 步靠 Got it 收尾）
const TUT_TRIGGER = ['noteHit', 'grooveOn', null];
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
      case 'noteHit':
        view.fxQueue.push({ type: 'hit', track: ev.track, grade: ev.grade, ttl: 0.6, maxTtl: 0.6 });
        if (ev.grade === 'perfect') view.shake = Math.max(view.shake, 1.5);
        break;
      case 'noteMiss':
      case 'ghostTap':
      case 'fakeHit':
        view.fxQueue.push({ type: 'miss', track: ev.track != null ? ev.track : 0, ttl: 0.5, maxTtl: 0.5 });
        break;
      case 'grooveOn':
        view.shake = 4;
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
  return { x: (e.clientX - rect.left) * (1280 / rect.width), y: (e.clientY - rect.top) * (720 / rect.height) };
}

function laneAt(p) {
  const lay = renderer.debugLayout();
  if (!lay || !run) return -1;
  for (const lane of lay.lanes) {
    if (p.x >= lane.x && p.x <= lane.x + lane.w) return lane.track;
  }
  return -1;
}

const heldKeys = new Set();
window.addEventListener('keydown', (e) => {
  const idx = LANE_CODES.indexOf(e.code);
  if (idx >= 0) {
    e.preventDefault();
    if (e.repeat) return;
    heldKeys.add(idx);
    audio.unlock();
    if (run && phase === 'playing') run.tap(idx);
    return;
  }
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
  if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'result')) restartLevel();
  if (e.code === 'KeyM') toggleMute();
});

window.addEventListener('keyup', (e) => {
  const idx = LANE_CODES.indexOf(e.code);
  if (idx >= 0) {
    heldKeys.delete(idx);
    if (run && phase === 'playing') run.release(idx);
  }
});

let touchLanes = new Map(); // pointerId -> track
canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (!run || phase !== 'playing') return;
  const p = canvasPos(e);
  const tr = laneAt(p);
  if (tr >= 0) {
    touchLanes.set(e.pointerId, tr);
    run.tap(tr);
  }
});
canvas.addEventListener('pointerup', (e) => {
  const tr = touchLanes.get(e.pointerId);
  if (tr != null) {
    touchLanes.delete(e.pointerId);
    if (run && phase === 'playing') run.release(tr);
  }
});
canvas.addEventListener('pointercancel', (e) => {
  const tr = touchLanes.get(e.pointerId);
  if (tr != null) {
    touchLanes.delete(e.pointerId);
    if (run && phase === 'playing') run.release(tr);
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

  if (view.shake > 0) view.shake = Math.max(0, view.shake - dt * 14);
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
  save: () => Sdk,
  ui: () => ui,
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['tap', 'groove', 'hp']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: () => {
      if (!run) return null;
      return { ...run.state, noteCount: run.state.notes.length, groove: run.state.groove };
    },
    layout: () => { try { return renderer.debugLayout(); } catch { return null; } },
    loadLevel: (i) => startLevel(i),
    startSeeded: (i, seed) => {
      const idx = Math.max(0, Math.min(LEVEL_COUNT - 1, i | 0));
      lastLevel = idx;
      run = createRun(idx, { seed: seed | 0 || 1 });
      setPhase('playing');
      ui.showGame();
      hideResult();
      view.fxQueue = [];
      updateHud();
      audio.startBgm();
      return true;
    },
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    startTutorial: () => startTutorial(),
    tutorialStep: () => tutorialStep,
    // 自动完美通关（与 tools/selfplay.mjs 同策略），返回是否通关
    autoPlay: () => {
      if (!run) return false;
      const stepTo = (t) => {
        let guard = 0;
        while (run.state.phase === 'countdown' && guard++ < 500) run.step(1 / 60);
        guard = 0;
        while (run.state.time < t && run.state.phase === 'playing' && guard++ < 200000) {
          run.step(Math.min(1 / 60, t - run.state.time));
        }
      };
      const real = run.state.notes.filter((n) => REAL.has(n.kind));
      for (const n of real) {
        if (run.state.phase === 'won' || run.state.phase === 'lost') break;
        stepTo(n.time);
        if (run.state.phase === 'won' || run.state.phase === 'lost') break;
        run.tap(n.track);
      }
      stepTo(run.state.duration);
      handleEvents(run.drainEvents());
      return run.state.phase === 'won';
    },
    // 快进到终局（不点任何 note → 漏判扣血 → 失败结算）
    fastForward: () => {
      if (!run) return false;
      let guard = 0;
      while ((run.state.phase === 'countdown' || run.state.phase === 'playing') && guard++ < 200000) {
        run.step(1 / 60);
      }
      handleEvents(run.drainEvents());
      return true;
    },
    // 推进到歌曲时间 t（截图/物料用）
    seek: (t) => {
      if (!run) return false;
      let guard = 0;
      while (run.state.phase === 'countdown' && guard++ < 500) run.step(1 / 60);
      guard = 0;
      while (run.state.time < t && run.state.phase === 'playing' && guard++ < 200000) {
        run.step(Math.min(1 / 60, t - run.state.time));
      }
      handleEvents(run.drainEvents());
      return run.state.time >= t;
    },
    // 冻结 sim（不推进、不弹屏），供截图保持干净画面
    freeze: () => { setPhase('paused'); return true; },
    unfreeze: () => { setPhase('playing'); return true; },
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
