// 主入口：60Hz 固定步长 + 标题/周日程/暂停/结算 + 交互引导 + SDK 统一出口。
// 装配：sim（日程经营）/ render（三场景+村童）/ audio（山村五声 BGM）/ ui（语言与屏幕）。
// 职责划分：ui.js 只做语言与屏幕显隐；HUD/结算/事件弹窗/教程的 DOM 由这里直写。
import { STEP } from '../config/game.config.js';
import { LEVEL_COUNT, levelOf } from '../config/levels.js';
import { createRun, SUBJECT_ORDER } from './game/sim.js';
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
let phase = 'title';       // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let fpsSamples = [];
let tutorialStep = -1;    // -1 = 未激活
let eventModalShown = false;

const view = {
  hoverSubject: null,
  hoverSlot: null,
  cursor: { x: 0, y: 0 },
  shake: 0,
};

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let starsByWeek = Sdk.load('stars', {}) || {};
let tutorialDone = !!Sdk.load('tutorialDone', false);
let bestStars = Sdk.load('bestStars', 0) | 0;
let bestWeek = Math.max(1, Sdk.load('bestWeek', 1) | 0);

Sdk.ready();
Sdk.onAdStart(() => { if (phase === 'playing') pauseGame(true); });
Sdk.onAdEnd(() => { if (phase === 'paused') resumeGame(); });
audio.setMuted(muted);
ui.setMuted(muted);

function persist() {
  Sdk.save('muted', muted);
  Sdk.save('stars', starsByWeek);
  Sdk.save('tutorialDone', tutorialDone);
  Sdk.save('bestStars', bestStars);
  Sdk.save('bestWeek', bestWeek);
}

function totalStars() {
  return Object.values(starsByWeek).reduce((a, b) => a + (b | 0), 0);
}

// ---------- 阶段状态机 ----------
function setPhase(p) { phase = p; }

function startRun(seed) {
  run = createRun(0, { seed: seed || ((Date.now() % 2147483647) || 1) });
  setPhase('playing');
  ui.showGame();
  hideResult();
  hideEventModal();
  updateHud();
  audio.startBgm();
  Sdk.newRun({});
  if (!tutorialDone) startTutorial();
}

function startLevel(idx) {
  idx = Math.max(0, Math.min(LEVEL_COUNT - 1, idx | 0));
  startRun((idx * 7919 + 13) | 0 || 1);
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

function restartRun() {
  startRun((Date.now() % 2147483647) || 1);
}

function goHome() {
  run = null;
  setPhase('title');
  hideResult();
  hideEventModal();
  ui.showTitle();
  buildLevelGrid();
}

// ---------- HUD ----------
function updateHud() {
  if (!run) return;
  const s = run.state;
  const lv = levelOf(s.week);
  $('hud-week').textContent = `${t('week')}${s.week} · ${t('scene_' + lv.scene)}`;
  $('hud-coins').textContent = `🪙 ${s.coins}`;
  $('hud-energy').textContent = `⚡ ${s.energy}/${s.energyMax}`;
  $('hud-grades').textContent = `${t('grades')} ${s.attrs.grades}`;
  $('hud-fitness').textContent = `${t('fitness')} ${s.attrs.fitness}`;
  $('hud-mood').textContent = `${t('mood')} ${s.attrs.mood}`;
  $('hud-reputation').textContent = `${t('reputation')} ${s.attrs.reputation}`;
  $('btn-endweek').classList.toggle('hidden', s.phase !== 'planning');
}

// ---------- 关卡格（12 周进度） ----------
function buildLevelGrid() {
  const grid = $('level-grid');
  if (!grid) return;
  grid.innerHTML = '';
  for (let i = 0; i < LEVEL_COUNT; i += 1) {
    const cell = document.createElement('button');
    cell.className = 'level-cell' + (i + 1 > bestWeek ? ' locked' : '');
    cell.dataset.level = i;
    const stars = starsByWeek[i + 1] | 0;
    cell.innerHTML =
      `<span class="lv-num">${i + 1}</span>` +
      `<span class="lv-stars">${stars ? '★' : '☆'}</span>`;
    cell.setAttribute('aria-label', `${t('week')} ${i + 1}${i + 1 > bestWeek ? ' ' + t('locked') : ''}`);
    grid.appendChild(cell);
  }
  $('stars-total').textContent = `★ ${totalStars()} / ${LEVEL_COUNT}`;
}

// ---------- 结算 ----------
function showResult() {
  const res = run.state.result;
  if (!res) return;
  const won = res.won;
  $('result-title').textContent = won ? t('winTitle') : t('loseTitle');
  $('result-title').classList.toggle('lose', !won);
  $('result-stars').textContent = '★'.repeat(res.stars) + '☆'.repeat(3 - res.stars);
  const attrNames = { grades: t('grades'), fitness: t('fitness'), mood: t('mood'), reputation: t('reputation') };
  const lines = ['grades', 'fitness', 'mood', 'reputation']
    .map((k) => `${attrNames[k]} ${res.attrs[k]}/${res.targets[k]}${res.attrs[k] >= res.targets[k] ? ' ✓' : ' ✗'}`);
  $('result-meta').textContent = `${t('examResult')}\n${lines.join('  ·  ')}`;
  if (won && res.all4) $('result-meta').textContent += `\n${t('perfect')}`;
  const ranking = res.ranking || [];
  $('result-ranking').innerHTML = ranking
    .map((r) => `<span class="${r.passed ? 'r-pass' : 'r-fail'}">${r.name}${r.passed ? ' ✓' : ''}</span>`)
    .join('  ');
  $('screen-result').classList.remove('hidden');
}

function hideResult() {
  $('screen-result').classList.add('hidden');
}

function finishRun(ev) {
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  const res = run.state.result;
  const won = ev.type === 'win';
  if (won) {
    // 持久化每周之星与最佳周
    run.state.weekStars.forEach((s, i) => {
      const wk = i + 1;
      starsByWeek[wk] = Math.max(starsByWeek[wk] | 0, s);
    });
    bestStars = Math.max(bestStars, totalStars() + (res.stars || 0));
    bestWeek = Math.max(bestWeek, run.state.week);
    buildLevelGrid();
    Sdk.levelCleared({ week: run.state.week, stars: res.stars });
  } else {
    bestWeek = Math.max(bestWeek, run.state.week - 1);
    buildLevelGrid();
    Sdk.gameOver({ week: run.state.week });
  }
  persist();
  showResult();
  audio.event(won ? 'win' : 'lose');
}

// ---------- 事件弹窗 ----------
function showEventModal() {
  const ev = run.state.activeEvent;
  if (!ev) return;
  $('event-title').textContent = t(ev.titleKey);
  $('event-desc').textContent = t(ev.descKey);
  $('event-opt-0').textContent = t(ev.options[0].labelKey);
  $('event-opt-1').textContent = t(ev.options[1].labelKey);
  $('screen-event').classList.remove('hidden');
  eventModalShown = true;
}

function hideEventModal() {
  $('screen-event').classList.add('hidden');
  eventModalShown = false;
}

function syncEventModal() {
  if (run && run.state.activeEvent) {
    if (!eventModalShown) showEventModal();
  } else if (eventModalShown) {
    hideEventModal();
  }
}

function chooseEvent(i) {
  if (!run || !run.state.activeEvent) return;
  run.chooseEvent(i);
  audio.event('eventResolved');
  hideEventModal();
}

// ---------- 教程引导 ----------
const TUT_STEPS = () => [
  { text: t('tutStep1'), spot: 'card-study' },
  { text: t('tutStep2'), spot: 'slot-0' },
  { text: t('tutStep3'), spot: 'endweek' },
  { text: t('tutStep4'), spot: 'students' },
];

function layoutSpot(which) {
  const lay = renderer.debugLayout();
  if (!lay) return null;
  if (which === 'card-study') return lay.cards[0];
  if (which === 'slot-0') return lay.slots[0];
  if (which === 'endweek') return lay.endWeekBtn;
  if (which === 'students') return lay.students[0];
  return null;
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
  const rect = s && layoutSpot(s.spot);
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

// 真实动作推进教学：0=assign 1=assign 2=endWeek 3=weekStart
const TUT_TRIGGER = ['assign', 'assign', 'endWeek', 'weekStart'];
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
      case 'assign':
        view.shake = 2;
        break;
      case 'weekGoalPass':
        view.shake = 3;
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

function pickSubject(p) {
  const lay = renderer.debugLayout();
  if (!lay) return null;
  for (const card of lay.cards) {
    if (p.x >= card.x && p.x <= card.x + card.w && p.y >= card.y && p.y <= card.y + card.h) return card.id;
  }
  return null;
}

function pickSlot(p) {
  const lay = renderer.debugLayout();
  if (!lay) return null;
  for (let i = 0; i < lay.slots.length; i += 1) {
    const s = lay.slots[i];
    if (p.x >= s.x && p.x <= s.x + s.w && p.y >= s.y && p.y <= s.y + s.h) return i;
  }
  return null;
}

canvas.addEventListener('pointermove', (e) => {
  view.cursor = canvasPos(e);
  view.hoverSubject = (run && phase === 'playing' && run.state.phase === 'planning') ? pickSubject(view.cursor) : null;
  view.hoverSlot = (run && phase === 'playing' && run.state.phase === 'planning') ? pickSlot(view.cursor) : null;
});

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (!run || phase !== 'playing' || run.state.phase !== 'planning') return;
  const p = canvasPos(e);
  view.cursor = p;
  const sub = pickSubject(p);
  if (sub) {
    const res = run.assign(sub);
    if (res.ok) audio.event('assign');
    updateHud();
    return;
  }
  const slot = pickSlot(p);
  if (slot != null && run.state.slots[slot]) {
    const res = run.unassign(slot);
    if (res.ok) audio.event('unassign');
    updateHud();
  }
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
  if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'result')) restartRun();
  if (e.code === 'KeyM') toggleMute();
});

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  ui.setMuted(muted);
  $('btn-mute').classList.toggle('is-muted', muted);
  persist();
}

// ---------- 调试自动玩（供 gif / verify / fastForward） ----------
const ATTR_SUBJECT = { grades: 'study', fitness: 'martial', reputation: 'trip', mood: 'rest' };

function debugSubjects() {
  const s = run.state;
  const goal = levelOf(s.week).goal;
  const sub = ATTR_SUBJECT[goal.attr] || 'rest';
  const list = [sub, sub, 'rest'];
  if (s.attrs.grades < 70) list.push('study');
  else if (s.attrs.fitness < 60) list.push('martial');
  else if (s.attrs.reputation < 55) list.push('trip');
  else list.push('rest');
  list.push('rest');
  return list.slice(0, s.slotsPerWeek);
}

function playUntil(targetWeek) {
  let guard = 0;
  while (run && (run.state.phase === 'planning' || run.state.phase === 'resolving') && guard++ < 300000) {
    if (targetWeek != null && run.state.week >= targetWeek && run.state.phase === 'planning') break;
    if (run.state.phase === 'planning') {
      for (const sub of debugSubjects()) run.assign(sub);
      run.endWeek();
    } else {
      if (run.state.activeEvent) run.chooseEvent(0);
      else run.step(0.02);
    }
    handleEvents(run.drainEvents());
    if (phase === 'result') break;
  }
}

function resolveSimAll() {
  playUntil(null);
}

// ---------- UI 绑定 ----------
function bind() {
  const on = (id, fn) => {
    const el = $(id);
    if (el) el.addEventListener('click', () => { audio.unlock(); fn(); });
  };
  on('btn-start', () => startLevel(0));
  on('btn-resume', resumeGame);
  on('btn-restart', restartRun);
  on('btn-restart2', restartRun);
  on('btn-retry', restartRun);
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-endweek', () => {
    if (run && phase === 'playing' && run.state.phase === 'planning') {
      run.endWeek();
      audio.event('endWeek');
      updateHud();
    }
  });
  on('event-opt-0', () => chooseEvent(0));
  on('event-opt-1', () => chooseEvent(1));
  on('btn-tut-replay', () => { if (phase === 'paused') resumeGame(); if (phase === 'playing') startTutorial(); });
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result') startTutorial(); });
  on('btn-rotate-skip', () => { const rs = $('rotate-screen'); if (rs) rs.style.display = 'none'; });
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);

  $('level-grid')?.addEventListener('click', (e) => {
    const idx = e.target.closest('[data-level]')?.dataset.level;
    if (idx == null) return;
    const i = +idx;
    if (i + 1 > bestWeek) return;
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
      if (rt) rt.textContent = t('rotateHint') || 'Rotate for a bigger board';
      if (rb) rb.textContent = t('rotateSkip') || 'Play anyway';
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
    if (phase === 'playing') {
      syncEventModal();
      updateHud();
    }
  }

  if (view.shake > 0) view.shake = Math.max(0, view.shake - dt * 18);

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
    get dir() { return i18n.dir; },
  },
  run: () => run,
  start: (i) => startLevel(i == null ? 0 : i),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => restartRun(),
  home: () => goHome(),
  sim: () => (run ? run.state : null),
  save: (k, v) => Sdk.save(k, v),
  ui: () => ui,
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['assign', 'assign', 'endWeek', 'weekStart']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: () => (run ? { ...run.state, slots: [...run.state.slots] } : null),
    layout: () => { try { return renderer.debugLayout(); } catch { return null; } },
    loadLevel: (i) => {
      const idx = Math.max(0, Math.min(LEVEL_COUNT - 1, i | 0));
      startLevel(idx);
      // 快进到目标周（第 idx+1 周）
      playUntil(idx + 1);
      updateHud();
      return true;
    },
    startSeeded: (i, seed) => {
      const idx = Math.max(0, Math.min(LEVEL_COUNT - 1, i | 0));
      startRun(((idx * 100003 + (seed | 0 || 1)) | 0) || 1);
      return true;
    },
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    startTutorial: () => startTutorial(),
    tutorialStep: () => tutorialStep,
    autoAssign: () => {
      if (!run || run.state.phase !== 'planning') return false;
      for (const sub of debugSubjects()) run.assign(sub);
      updateHud();
      return true;
    },
    fastForward: () => {
      if (!run) return false;
      try { resolveSimAll(); return true; } catch { return false; }
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
  if (rt) rt.textContent = t('rotateHint') || 'Rotate for a bigger board';
  if (rb) rb.textContent = t('rotateSkip') || 'Play anyway';
}
buildLevelGrid();
$('btn-mute').classList.toggle('is-muted', muted);
$('btn-endweek').textContent = t('endWeek');
Sdk.track('load', {});
requestAnimationFrame(frame);
