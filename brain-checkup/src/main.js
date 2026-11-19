// BRAIN CHECKUP · 主入口：60Hz 固定步长 + 标题/选关/游戏/暂停/结算 + 教程引导 + SDK 统一出口
import { STEP, GAME } from '../config/game.config.js';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';
import { createRun } from './game/sim.js';
import { createRenderer } from './render/index.js';
import { createAudio } from './core/audio.js';
import { i18n, t, syncDocumentLang } from './core/i18n.js';
import Sdk from './core/sdk.js';

const $ = (id) => document.getElementById(id);
const canvas = $('canvas');
const renderer = createRenderer(canvas);
const audio = createAudio();

let run = createRun();
let phase = 'title';       // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let fpsSamples = [];
let lastCountSec = 99;
let tutorialStep = -1;    // -1 = 未激活
let puzzle = { update: null, cleanup: null, state: {} };
let feedbackTimer = null;

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let unlocked = Math.max(1, Sdk.load('unlocked', 1) | 0);
let tutorialDone = !!Sdk.load('tutorialDone', false);
let lastLevel = Sdk.load('lastLevel', 0) | 0;
run.state.wisdom = Sdk.load('wisdom', GAME.START_WISDOM) | 0;
run.state.stars = Sdk.load('stars', {}) || {};
run.state.bestCombo = Sdk.load('bestCombo', 0) | 0;

Sdk.ready();
Sdk.onAdStart(() => { if (phase === 'playing') pauseGame(true); });
Sdk.onAdEnd(() => { if (phase === 'paused') resumeGame(); });
audio.setMuted(muted);

function persist() {
  Sdk.save('unlocked', unlocked);
  Sdk.save('stars', run.state.stars);
  Sdk.save('muted', muted);
  Sdk.save('tutorialDone', tutorialDone);
  Sdk.save('lastLevel', lastLevel);
  Sdk.save('bestCombo', run.state.bestCombo);
  Sdk.save('wisdom', run.state.wisdom);
}

function totalStars() {
  return Object.values(run.state.stars).reduce((a, b) => a + (b | 0), 0);
}

function L(field) {
  const lv = LEVELS[run.state.levelIndex] || {};
  return lv[field]?.[i18n.lang] ?? lv[field]?.en ?? '';
}

function setPhase(p) { phase = p; }

function show(screen) {
  for (const id of ['screen-title', 'screen-game', 'screen-pause', 'screen-result']) {
    const el = $(id);
    if (el) el.classList.add('hidden');
  }
  const active = $('screen-' + screen);
  if (active) active.classList.remove('hidden');
  $('hud').classList.toggle('hidden', screen !== 'game');
}

// ---------- 阶段状态机 ----------
function startLevel(i) {
  const idx = Math.max(0, Math.min(LEVEL_COUNT - 1, i | 0));
  lastLevel = idx;
  run.startLevel(idx);
  lastCountSec = 99;
  setPhase('playing');
  show('game');
  hideFeedback();
  renderLevel(idx);
  updateHud();
  audio.startBgm();
  Sdk.track('start', { level: idx + 1 });
  if (!tutorialDone && idx === 0) startTutorial();
}

function pauseGame(silent) {
  if (phase !== 'playing') return;
  setPhase('paused');
  audio.stopBgm();
  if (!silent) show('pause');
}

function resumeGame() {
  if (phase !== 'paused') return;
  setPhase('playing');
  show('game');
  audio.startBgm();
}

function restartLevel() {
  Sdk.track('restart', { level: (run.state.level || lastLevel + 1) });
  startLevel(run.state.phase === 'idle' ? lastLevel : run.state.levelIndex);
}

function goHome() {
  run = createRun();
  run.state.wisdom = Sdk.load('wisdom', GAME.START_WISDOM) | 0;
  run.state.stars = Sdk.load('stars', {}) || {};
  run.state.bestCombo = Sdk.load('bestCombo', 0) | 0;
  setPhase('title');
  tutorialStep = -1;
  renderTutorialStep();
  show('title');
  buildLevelGrid();
  audio.stopBgm();
}

// ---------- HUD / 关卡格 ----------
function updateHud() {
  if (!run || run.state.phase === 'idle') return;
  $('hud-level').textContent = t('scanOf', { n: run.state.level, total: LEVEL_COUNT });
  $('hud-wisdom').textContent = `◉ ${run.state.wisdom}`;
  const comboEl = $('hud-combo');
  comboEl.style.display = run.state.combo >= 2 ? '' : 'none';
  comboEl.textContent = `x${run.state.combo}`;
  const secs = Math.max(0, Math.ceil(run.state.timeLeft));
  const timeEl = $('hud-time');
  timeEl.textContent = t('timeLeft', { s: secs });
  timeEl.classList.toggle('time-low', secs <= 10 && run.state.phase === 'playing');
}

function buildLevelGrid() {
  const grid = $('level-grid');
  if (!grid) return;
  grid.innerHTML = '';
  for (let i = 0; i < LEVEL_COUNT; i += 1) {
    const cell = document.createElement('button');
    cell.className = 'level-cell' + (i + 1 > unlocked ? ' locked' : '');
    cell.dataset.level = i;
    const stars = run.state.stars[i + 1] | 0;
    cell.innerHTML = `<span class="lv-num">${i + 1}</span><span class="lv-stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>`;
    cell.setAttribute('aria-label', `${t('level')} ${i + 1}${i + 1 > unlocked ? ' ' + t('locked') : ''}`);
    grid.appendChild(cell);
  }
  $('stars-total').textContent = `★ ${totalStars()} / ${LEVEL_COUNT * 3}`;
}

// ---------- 反馈闪层 ----------
function flashFeedback(cls, text) {
  const el = $('feedback');
  el.textContent = text;
  el.className = cls;
  if (feedbackTimer) clearTimeout(feedbackTimer);
  feedbackTimer = setTimeout(hideFeedback, 900);
}
function hideFeedback() { $('feedback').classList.add('hidden'); }

function showHintToast() {
  flashFeedback('correct', t('hint'));
  const lv = LEVELS[run.state.levelIndex] || {};
  $('prompt').textContent = `${L('prompt')}  💡 ${lv.hint?.[i18n.lang] ?? lv.hint?.en ?? ''}`;
}

// ---------- 结算 ----------
function finishRun(ev) {
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  teardownPuzzle();
  const st = run.state;
  const won = ev.type === 'win';
  const stars = won ? (ev.stars || st.stars[st.level] || 1) : 0;
  if (won) {
    if (st.level < LEVEL_COUNT) unlocked = Math.max(unlocked, st.level + 1);
  }
  persist();
  if (won) {
    Sdk.levelCleared({ level: st.level, stars, combo: st.combo });
  } else {
    Sdk.gameOver({ level: st.level });
  }
  show('result');
  $('result-title').textContent = won ? t('winTitle') : t('skip');
  $('result-title').classList.toggle('lose', !won);
  const starsEl = $('result-stars');
  starsEl.innerHTML = won
    ? `<span class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>${stars >= 3 ? `<em>${t('perfect')}</em>` : ''}`
    : '';
  const custom = L('custom');
  $('result-meta').textContent = won
    ? `${custom}  ${t('winMeta', { wisdom: ev.bonus != null ? ev.bonus : GAME.WIN_BONUS })}`
    : custom;
  $('btn-next').style.display = (won && st.level < LEVEL_COUNT) ? '' : 'none';
  if (st.completed) $('result-meta').textContent = t('allClear');
  buildLevelGrid();
  audio.event(won ? 'win' : 'skip');
}

// ---------- 事件消费 ----------
function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    if (ev.type === 'correct' || ev.type === 'answered') {
      if (tutorialStep === 0) tutorialNext();
    }
    switch (ev.type) {
      case 'win':
        finishRun(ev);
        return;
      case 'skip':
        finishRun(ev);
        return;
      case 'wrong':
        flashFeedback('wrong', t('wrong'));
        break;
      case 'hint':
        showHintToast();
        break;
      case 'hintDenied':
        flashFeedback('wrong', t('hintDenied'));
        break;
      case 'skipDenied':
        flashFeedback('wrong', t('skipDenied'));
        break;
      case 'combo':
        flashFeedback('correct', `${t('combo')} x${ev.combo}`);
        break;
      default:
        break;
    }
  }
}

// ---------- 关卡渲染（每种 kind 一套 DOM + 交互） ----------
function teardownPuzzle() {
  if (puzzle.cleanup) { try { puzzle.cleanup(); } catch { /* noop */ } }
  puzzle = { update: null, cleanup: null, state: {} };
  const el = $('puzzle');
  if (el) el.innerHTML = '';
}

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function renderLevel(idx) {
  teardownPuzzle();
  const lv = LEVELS[idx] || LEVELS[0];
  const stage = $('puzzle');
  $('prompt').textContent = L('prompt');
  const wrap = el('div', 'puzzle-stage');

  if (lv.kind === 'tap') {
    buildTap(wrap, lv);
  } else if (lv.kind === 'hold') {
    buildHold(wrap, lv);
  } else if (lv.kind === 'choice' || lv.kind === 'select') {
    buildChoice(wrap, lv);
  } else if (lv.kind === 'input') {
    buildInput(wrap, lv);
  } else if (lv.kind === 'rate') {
    buildRate(wrap, lv);
  } else if (lv.kind === 'drag') {
    buildDrag(wrap, lv);
  } else if (lv.kind === 'flip') {
    buildFlip(wrap, lv);
  } else if (lv.kind === 'timing') {
    buildTiming(wrap, lv);
  }
  stage.appendChild(wrap);
}

function solveVia(kind, lv, value) {
  const r = kind === 'tap' || kind === 'rate' ? run.act(value) : run.submit(value);
  handleEvents(run.drainEvents());
}

// tap：打地鼠式，点击发光的靶标 N 次
function buildTap(wrap, lv) {
  const count = (lv.decoys || 3) + 1;
  const cells = [];
  const grid = el('div', 'puzzle-stage');
  grid.style.gap = '14px';
  for (let i = 0; i < count; i += 1) {
    const c = el('button', 'big-btn', '');
    c.style.width = '120px'; c.style.height = '120px';
    c.dataset.cell = i;
    grid.appendChild(c);
    cells.push(c);
  }
  wrap.appendChild(grid);
  puzzle.state = { moleIndex: Math.floor(Math.random() * count), timer: 0.9 };
  const paint = () => {
    cells.forEach((c, i) => {
      const on = i === puzzle.state.moleIndex && run.state.phase === 'playing';
      c.classList.toggle('is-target', on);
      c.textContent = on ? '◉' : '';
    });
  };
  puzzle.update = (dt) => {
    if (run.state.phase !== 'playing') return;
    puzzle.state.timer -= dt;
    if (puzzle.state.timer <= 0) {
      let next = puzzle.state.moleIndex;
      while (next === puzzle.state.moleIndex) next = Math.floor(Math.random() * count);
      puzzle.state.moleIndex = next;
      puzzle.state.timer = 0.9;
      paint();
    }
  };
  paint();
}

// hold：长按填满进度环
function buildHold(wrap, lv) {
  const btn = el('button', 'hold-btn', t('holdTarget'));
  const ring = el('div', 'hold-ring');
  ring.innerHTML = `<svg width="100%" height="100%"><circle cx="50%" cy="50%" r="45%" fill="none" stroke="#56f0ff" stroke-width="6" stroke-dasharray="282.7" stroke-dashoffset="282.7" id="hold-ring-circle"></circle></svg>`;
  btn.appendChild(ring);
  wrap.appendChild(btn);
  const secs = lv.holdSec || 3;
  puzzle.state = { holding: false, t: 0 };
  const setRing = (p) => {
    const c = btn.querySelector('circle');
    if (c) c.setAttribute('stroke-dashoffset', String(282.7 * (1 - Math.min(1, p))));
  };
  const start = () => { audio.unlock(); puzzle.state.holding = true; };
  const end = (commit) => {
    if (!puzzle.state.holding) return;
    puzzle.state.holding = false;
    if (commit) return;
    if (puzzle.state.t >= secs) { run.submit(true); }
    else if (puzzle.state.t > 0.05) { run.act(false); }
    else { /* 误触，无惩罚 */ }
    puzzle.state.t = 0; setRing(0);
    handleEvents(run.drainEvents());
  };
  btn.addEventListener('pointerdown', start);
  btn.addEventListener('pointerup', () => end(false));
  btn.addEventListener('pointercancel', () => end(false));
  btn.addEventListener('pointerleave', () => end(false));
  puzzle.cleanup = () => {};
  puzzle.update = (dt) => {
    if (puzzle.state.holding && run.state.phase === 'playing') {
      puzzle.state.t += dt;
      setRing(puzzle.state.t / secs);
      if (puzzle.state.t >= secs) {
        puzzle.state.holding = false;
        run.submit(true);
        setRing(1);
        handleEvents(run.drainEvents());
      }
    }
  };
}

// choice / select：点正确的按钮
function buildChoice(wrap, lv) {
  const opts = lv.options ? (lv.options[i18n.lang] || lv.options.en) : [];
  if (lv.id === 16) {
    // 颜色 vs 文字（特例）：看墨色，不看字
    wrap.style.flexDirection = 'column';
    const swatch = el('div', 'puzzle-stage');
    swatch.style.gap = '10px';
    const chip = el('div', 'color-chip', '');
    chip.style.background = '#5affa0'; chip.style.color = '#033'; chip.textContent = 'GREEN';
    swatch.appendChild(el('span', 'subtitle', 'TAP THIS COLOR →'));
    swatch.appendChild(chip);
    wrap.appendChild(swatch);
  }
  const row = el('div', 'puzzle-stage');
  row.style.gap = '16px';
  opts.forEach((label, i) => {
    const b = el('button', 'big-btn', label);
    b.dataset.submit = i;
    if (lv.id === 16) {
      // 文字用不同墨色，制造「看颜色别看字」的冲突
      const inks = ['#5affa0', '#ff5a6a', '#56f0ff'];
      b.style.color = inks[i];
      b.style.borderColor = inks[i];
    }
    row.appendChild(b);
  });
  wrap.appendChild(row);
}

// input：输入答案
function buildInput(wrap) {
  const row = el('div', 'input-row');
  const input = el('input', 'answer-input');
  input.type = 'text';
  input.inputMode = 'text';
  input.autocomplete = 'off';
  input.setAttribute('aria-label', 'Answer');
  const ok = el('button', 'btn-primary', t('submit'));
  ok.dataset.submitOk = 1;
  const submit = () => {
    const v = input.value;
    if (v === '') return;
    run.submit(v);
    handleEvents(run.drainEvents());
  };
  ok.addEventListener('click', () => { audio.unlock(); submit(); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  row.appendChild(input);
  row.appendChild(ok);
  wrap.appendChild(row);
  puzzle.cleanup = () => {};
  // 自动聚焦
  setTimeout(() => input.focus(), 60);
}

// rate：点满所有星
function buildRate(wrap, lv) {
  const row = el('div', 'puzzle-stage');
  row.style.gap = '6px';
  const total = lv.taps || 5;
  puzzle.state = { on: 0 };
  for (let i = 0; i < total; i += 1) {
    const s = el('button', 'star-btn star-on', '★');
    s.dataset.star = i;
    s.classList.remove('star-on');
    s.textContent = '☆';
    row.appendChild(s);
  }
  wrap.appendChild(row);
}

// drag：拖动把手越过阈值
function buildDrag(wrap, lv) {
  const dir = lv.direction || 'down';
  const track = el('div', 'drag-track');
  const handle = el('div', 'drag-handle', t('dragTarget'));
  const zone = el('div', 'drag-zone');
  if (dir === 'up') { track.appendChild(zone); zone.style.top = '8px'; handle.style.top = 'calc(100% - 86px)'; }
  else { handle.style.top = '8px'; zone.style.bottom = '8px'; track.appendChild(zone); }
  track.appendChild(handle);
  wrap.appendChild(track);
  const thresh = lv.threshold || 120;
  puzzle.state = { startY: 0, y: 0, done: false };
  const clamp = (v) => Math.max(0, Math.min(track.clientHeight - handle.clientHeight, v));
  const commit = () => { run.submit(true); handleEvents(run.drainEvents()); };
  handle.addEventListener('pointerdown', (e) => {
    audio.unlock();
    handle.setPointerCapture(e.pointerId);
    puzzle.state.startY = e.clientY - handle.offsetTop;
  });
  handle.addEventListener('pointermove', (e) => {
    if (puzzle.state.done) return;
    if (!handle.hasPointerCapture(e.pointerId)) return;
    const y = e.clientY - puzzle.state.startY;
    handle.style.top = `${clamp(y)}px`;
    const traveled = dir === 'up' ? (track.clientHeight - handle.clientHeight - y) : y;
    if (traveled >= thresh) { puzzle.state.done = true; commit(); }
  });
  handle.addEventListener('pointerup', () => {
    if (!puzzle.state.done && run.state.phase === 'playing') {
      handle.style.top = dir === 'up' ? 'calc(100% - 86px)' : '8px';
    }
  });
  puzzle.cleanup = () => {};
}

// flip：翻转（按钮触发；移动端可再叠加设备方向）
function buildFlip(wrap) {
  const b = el('button', 'big-btn', '↻ ROTATE');
  b.dataset.submit = true;
  wrap.appendChild(b);
}

// timing：在绿色区间点击停止
function buildTiming(wrap, lv) {
  const meter = el('div', 'meter');
  const sweet = el('div', 'meter-sweet');
  const fill = el('div', 'meter-fill');
  const cursor = el('div', 'meter-cursor');
  const a = lv.sweetMin || 0.4;
  const b = lv.sweetMax || 0.6;
  sweet.style.left = `${a * 100}%`;
  sweet.style.width = `${(b - a) * 100}%`;
  meter.appendChild(fill);
  meter.appendChild(sweet);
  meter.appendChild(cursor);
  const stop = el('button', 'btn-primary', 'STOP');
  stop.dataset.stop = 1;
  const box = el('div', 'puzzle-stage');
  box.style.flexDirection = 'column';
  box.appendChild(meter);
  box.appendChild(stop);
  wrap.appendChild(box);
  puzzle.state = { p: 0 };
  puzzle.update = (dt) => {
    if (run.state.phase !== 'playing') return;
    puzzle.state.p = (puzzle.state.p + dt / 2.4) % 1;
    cursor.style.left = `${puzzle.state.p * 100}%`;
    fill.style.width = `${puzzle.state.p * 100}%`;
  };
}

// ---------- 输入分派（事件委托） ----------
function onPuzzleClick(e) {
  audio.unlock();
  const lv = LEVELS[run.state.levelIndex] || {};
  if (run.state.phase !== 'playing') return;
  const cell = e.target.closest('[data-cell]');
  const sub = e.target.closest('[data-submit]');
  const star = e.target.closest('[data-star]');
  const stopBtn = e.target.closest('[data-stop]');
  const okBtn = e.target.closest('[data-submit-ok]');

  if (cell) {
    const i = +cell.dataset.cell;
    run.act(i === puzzle.state.moleIndex);
  } else if (sub) {
    const v = sub.dataset.submit === 'true' ? true : (sub.dataset.submit === 'false' ? false : +sub.dataset.submit);
    run.submit(v);
  } else if (star) {
    const i = +star.dataset.star;
    if (!star.classList.contains('star-on')) {
      star.classList.add('star-on');
      star.textContent = '★';
      run.act(true);
    }
  } else if (stopBtn) {
    const p = puzzle.state.p;
    const inSweet = p >= (lv.sweetMin || 0.4) && p <= (lv.sweetMax || 0.6);
    if (inSweet) run.submit(true);
    else run.act(false);
  }
  handleEvents(run.drainEvents());
}

// ---------- 教程 ----------
const TUT_STEPS = () => [
  { text: t('tutStep1'), spot: 'puzzle' },
  { text: t('tutStep2'), spot: 'prompt' },
  { text: t('tutStep3'), spot: 'prompt' },
];

function spotRect(which) {
  const target = which === 'puzzle' ? $('puzzle') : $('prompt');
  if (!target) return null;
  const r = target.getBoundingClientRect();
  const box = $('game-container').getBoundingClientRect();
  return { x: r.left - box.left, y: r.top - box.top, w: r.width, h: r.height };
}

function startTutorial() { tutorialStep = 0; renderTutorialStep(); }

function renderTutorialStep() {
  const elx = $('tutorial');
  if (tutorialStep < 0) { elx.classList.add('hidden'); return; }
  const steps = TUT_STEPS();
  const s = steps[tutorialStep];
  elx.classList.remove('hidden');
  $('tut-title').textContent = t('tutTitle');
  $('tut-text').textContent = s ? s.text : '';
  $('tut-skip').textContent = t('tutSkip');
  $('tut-next').textContent = t('tutNext');
  const rect = s && s.spot && spotRect(s.spot);
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

// ---------- 语言 ----------
function applyLang() {
  syncDocumentLang();
  $('title-text').textContent = t('title');
  $('subtitle-text').textContent = t('subtitle');
  $('btn-start').textContent = t('start');
  $('btn-resume').textContent = t('resume');
  $('btn-restart2').textContent = t('restart');
  $('btn-tut-replay').textContent = t('replayGuide');
  $('btn-home3').textContent = t('home');
  $('btn-home2').textContent = t('home');
  $('btn-home').setAttribute('aria-label', t('home'));
  $('btn-retry').textContent = t('retry');
  $('btn-next').textContent = t('nextLevel');
  $('btn-hint').setAttribute('aria-label', t('hint'));
  $('btn-skip').setAttribute('aria-label', t('skip'));
  $('pause-title').textContent = t('paused');
  $('rotate-text').textContent = t('rotateHint');
  $('btn-rotate-skip').textContent = t('rotateSkip');
  fillLangOptions();
  if (phase === 'playing' || phase === 'paused') renderLevel(run.state.levelIndex);
  if (phase === 'playing') updateHud();
  if (tutorialStep >= 0) renderTutorialStep();
}

function fillLangOptions() {
  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = $(id);
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

// ---------- 输入绑定 ----------
function bind() {
  const on = (id, fn) => { const elx = $(id); if (elx) elx.addEventListener('click', () => { audio.unlock(); fn(); }); };
  on('btn-start', () => startLevel(lastLevel || 0));
  on('btn-resume', resumeGame);
  on('btn-restart', restartLevel);
  on('btn-restart2', restartLevel);
  on('btn-retry', restartLevel);
  on('btn-next', () => startLevel((run.state.level || lastLevel + 1)));  // 下一关（1 基 → 0 基）
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-hint', () => { run.hint(); handleEvents(run.drainEvents()); });
  on('btn-skip', () => { run.skip(); handleEvents(run.drainEvents()); });
  on('btn-tut-replay', () => { if (phase === 'paused') resumeGame(); if (phase === 'playing') startTutorial(); });
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result') startTutorial(); });
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);

  $('puzzle').addEventListener('click', onPuzzleClick);

  $('level-grid').addEventListener('click', (e) => {
    const idx = e.target.closest('[data-level]')?.dataset.level;
    if (idx == null) return;
    const i = +idx;
    if (i + 1 > unlocked) return;
    startLevel(i);
  });

  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = $(id);
    if (!sel) continue;
    sel.addEventListener('change', () => { i18n.setLang(sel.value); applyLang(); });
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (phase === 'playing') pauseGame();
      else if (phase === 'paused') resumeGame();
    }
    if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'result')) restartLevel();
    if (e.code === 'KeyM') toggleMute();
  });
}

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  $('btn-mute').classList.toggle('is-muted', muted);
  $('btn-mute').textContent = muted ? '🔇' : '🔊';
  persist();
}

// ---------- 主循环 ----------
function frame(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;

  if (phase === 'playing' && run.state.phase === 'playing') {
    accumulator += dt;
    while (accumulator >= STEP) {
      run.step(STEP);
      accumulator -= STEP;
    }
    if (puzzle.update) puzzle.update(dt);
    const secs = Math.ceil(run.state.timeLeft);
    if (secs !== lastCountSec && secs <= 5 && secs > 0) {
      lastCountSec = secs;
      audio.event('countdownTick', { timeLeft: secs });
    }
    updateHud();
  }

  renderer.draw(dt);

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
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['tap', 'hold', 'streak']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  save: (k, v) => Sdk.save(k, v),
  load: (k, f) => Sdk.load(k, f),
  share: (p) => Sdk.share(p),
  ui: {},
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: () => run.state,
    loadLevel: (i) => startLevel(i),
    startSeeded: (i) => { startLevel(i); return true; },
    autoSolve: () => {
      if (!run || run.state.phase !== 'playing') return false;
      const lv = LEVELS[run.state.levelIndex] || {};
      if (lv.kind === 'tap' || lv.kind === 'rate') {
        const n = lv.taps || 1;
        for (let k = 0; k < n; k += 1) run.act(true);
      } else {
        run.submit(lv.answer);
      }
      handleEvents(run.drainEvents());
      return true;
    },
  },
};

// ---------- 启动 ----------
bind();
applyLang();
buildLevelGrid();
$('btn-mute').textContent = muted ? '🔇' : '🔊';
$('btn-mute').classList.toggle('is-muted', muted);
Sdk.track('load', {});
requestAnimationFrame(frame);
