// HARDCORE MATCHPOP · 主入口：60Hz 固定步长 + 标题/选关/游戏/暂停/结算 + 教程 + SDK 统一出口
// 契约见 docs/batch3/hardcore-matchpop.md。装配：sim / render / audio / ui + main。
import { STEP, GAME } from '../config/game.config.js';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';
import { createRun, createRushRun } from './game/sim.js';
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
let bombArmed = false;
let tutorialStep = -1;     // -1 = 未激活

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let unlocked = Math.max(1, Sdk.load('unlocked', 1) | 0);
let starsByLevel = Sdk.load('stars', {}) || {};
let tutorialDone = !!Sdk.load('tutorialDone', false);
let lastLevel = Sdk.load('lastLevel', 0) | 0;

Sdk.ready(); // 不 await，不阻塞首屏
Sdk.onAdStart(() => { if (phase === 'playing') pauseGame(); });
Sdk.onAdEnd(() => { if (phase === 'paused') resumeGame(); });
audio.setMuted(muted);
ui.setMuted(muted);

function persist() {
  Sdk.save('muted', muted);
  Sdk.save('unlocked', unlocked);
  Sdk.save('stars', starsByLevel);
  Sdk.save('tutorialDone', tutorialDone);
  Sdk.save('lastLevel', lastLevel);
}

function setPhase(p) { phase = p; }

// ---------- 开局 ----------
function startLevel(idx) {
  idx = Math.max(0, Math.min(LEVEL_COUNT - 1, idx | 0));
  lastLevel = idx;
  bombArmed = false;
  run = createRun(idx, { seed: (Date.now() % 2147483647) || 1 });
  setPhase('playing');
  ui.showGame();
  ui.hideResult();
  updateHud();
  renderTutorialStep();
  audio.startBgm();
  Sdk.newRun({ level: idx + 1 });
  Sdk.track('start', { level: idx + 1 });
  if (!tutorialDone && idx === 0) startTutorial();
}

function startRush() {
  bombArmed = false;
  run = createRushRun({ seed: (Date.now() % 2147483647) || 1 });
  setPhase('playing');
  ui.showGame();
  ui.hideResult();
  updateHud();
  renderTutorialStep();
  audio.startBgm();
  Sdk.newRun({ level: 0, mode: 'rush' });
  Sdk.track('start', { mode: 'rush' });
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
  if (run) Sdk.track('restart', { level: run.state.level + 1, mode: run.state.mode });
  if (run && run.state.mode === 'rush') startRush();
  else startLevel(run ? run.state.level - 1 : lastLevel);
}

function goHome() {
  run = null;
  setPhase('title');
  ui.hideResult();
  ui.showTitle();
  buildLevelGrid();
  audio.stopBgm();
}

// ---------- HUD / 关卡格 / 结算 ----------
function updateHud() {
  if (!run) return;
  const h = run.getHud();
  const lv = LEVELS[run.state.level - 1] || {};
  const name = lv.name ? (lv.name[i18n.lang] || lv.name.en || '') : '';
  if (run.state.mode === 'rush') {
    $('hud-level').textContent = t('rush');
  } else {
    $('hud-level').textContent = `${t('level')} ${run.state.level}${name ? ' · ' + name : ''}`;
  }
  const secs = Math.max(0, Math.ceil(h.timeLeft));
  const timeEl = $('hud-time');
  timeEl.textContent = `${t('time')} ${secs}s`;
  timeEl.classList.toggle('time-low', secs <= 10);
  $('hud-score').textContent = `${t('score')} ${h.score}`;
  if (run.state.mode === 'rush') {
    $('hud-target').textContent = `${t('rival')} ${h.rival}`;
  } else {
    $('hud-target').textContent = `${t('target')} ${h.target}`;
  }
  $('hud-gems').textContent = `${t('gems')} ${h.gems}`;
  const comboEl = $('hud-combo');
  if (h.combo >= 2) {
    comboEl.textContent = `×${h.combo}`;
    comboEl.classList.remove('off');
  } else {
    comboEl.textContent = '×1';
    comboEl.classList.add('off');
  }
  $('bomb-badge').textContent = h.bombLeft;
  $('shuffle-badge').textContent = h.shuffleLeft;
  $('btn-bomb').classList.toggle('armed', bombArmed);
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
}

function showResult(ev) {
  const won = ev.type === 'win';
  $('result-title').textContent = won ? t('winTitle') : t('loseTitle');
  $('result-title').classList.toggle('lose', !won);
  const starsEl = $('result-stars');
  const stars = ev.stars || 0;
  starsEl.innerHTML = won
    ? `<span class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>${stars >= 3 ? `<em>${t('perfect')}</em>` : ''}`
    : '';
  let meta = '';
  if (won) {
    meta = `${t('score')} ${ev.score} · ${t('starHint', { s: stars })} · ${t('timeLeft', { s: Math.ceil(ev.timeLeft) })}`;
  } else if (ev.reason === 'rival') {
    meta = t('loseRival');
  } else if (ev.reason === 'lowScore') {
    meta = t('loseLowScore');
  } else {
    meta = t('loseTimeOut');
  }
  $('result-meta').textContent = meta;
  $('btn-next').style.display = (won && run && run.state.mode === 'campaign' && run.state.level < LEVEL_COUNT) ? '' : 'none';
  ui.showResult();
}

function finishRun(ev) {
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  const st = run ? run.state : null;
  if (ev.type === 'win' && st && st.mode === 'campaign') {
    const idx = st.level; // 1 基
    starsByLevel[idx] = Math.max(starsByLevel[idx] | 0, st.stars || 1);
    if (idx < LEVEL_COUNT) unlocked = Math.max(unlocked, idx + 1);
    buildLevelGrid();
  }
  persist();
  Sdk.track(ev.type === 'win' ? 'win' : 'fail', {
    level: st ? st.level : 0,
    mode: st ? st.mode : 'rush',
    stars: ev.stars || 0,
    score: ev.score,
    durationMs: st ? Math.round((st.initialTime - st.timeLeft) * 1000) : 0,
  });
  showResult(ev);
  audio.event(ev.type);
}

// ---------- 教程（首次自动弹，可跳过，完成/跳过后持久化） ----------
const TUT_STEPS = () => [
  { text: t('tutStep1'), spot: 'board' },
  { text: t('tutStep2'), spot: 'board' },
  { text: t('tutStep3'), spot: 'board' },
];

function boardRect() {
  try {
    const lay = renderer.debugLayout();
    return { x: lay.boardX, y: lay.boardY, w: lay.board, h: lay.board };
  } catch { return { x: 360, y: 106, w: 560, h: 560 }; }
}

function startTutorial() {
  tutorialStep = 0;
  renderTutorialStep();
}

function renderTutorialStep() {
  const el = $('tutorial');
  if (!el) return;
  if (tutorialStep < 0 || phase !== 'playing') {
    el.classList.add('hidden');
    return;
  }
  const steps = TUT_STEPS();
  const s = steps[tutorialStep];
  el.classList.remove('hidden');
  $('tut-title').textContent = t('tutTitle');
  $('tut-text').textContent = s ? s.text : '';
  $('tut-skip').textContent = t('tutSkip');
  $('tut-next').textContent = t('tutNext');
  const rect = boardRect();
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
const TUT_TRIGGER = ['pop', 'combo', 'win'];

function tutorialAdvance(evType) {
  if (tutorialStep < 0 || tutorialStep >= TUT_TRIGGER.length) return;
  if (TUT_TRIGGER[tutorialStep] !== evType) return;
  tutorialStep += 1;
  if (tutorialStep >= TUT_TRIGGER.length) endTutorial();
  else renderTutorialStep();
}

function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    tutorialAdvance(ev.type);
    switch (ev.type) {
      case 'pop':
      case 'bomb': {
        const color = ev.type === 'bomb' ? ((ev.r + ev.c) % 5) : (typeof ev.color === 'number' && ev.color >= 0 ? ev.color : 0);
        renderer.burst(ev.cells || [[ev.r, ev.c]], color, ev.gain);
        const gainColor = ev.combo >= 2 ? '#facc15' : '#ffffff';
        renderer.floatAt(ev.r, ev.c, `+${ev.gain}`, gainColor);
        break;
      }
      case 'fall':
        if (ev.moved > 0) renderer.shakeAmt(1.2);
        break;
      case 'shuffle':
        renderer.shakeAmt(2);
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

function pickCell(p) {
  const lay = renderer.debugLayout();
  const c = Math.floor((p.x - lay.boardX) / lay.cell);
  const r = Math.floor((p.y - lay.boardY) / lay.cell);
  if (r < 0 || r >= GAME.N || c < 0 || c >= GAME.N) return null;
  return { r, c };
}

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (!run || phase !== 'playing') return;
  const cell = pickCell(canvasPos(e));
  if (!cell) return;
  if (bombArmed) {
    const res = run.bomb(cell.r, cell.c);
    if (res.ok) { bombArmed = false; updateHud(); }
    else audio.event('click');
    return;
  }
  const res = run.tap(cell.r, cell.c);
  if (!res.ok) audio.event('click');
  updateHud();
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
  if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'result')) restartLevel();
  if (e.code === 'KeyM') toggleMute();
  if (e.code === 'KeyB' && phase === 'playing' && run) { bombArmed = !bombArmed; updateHud(); }
  if (e.code === 'KeyS' && phase === 'playing' && run) { run.shuffle(); audio.event('shuffle'); updateHud(); }
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
    if (el) el.addEventListener('click', () => { audio.unlock(); audio.event('click'); fn(); });
  };
  on('btn-start', () => startLevel(lastLevel || 0));
  on('btn-rush', startRush);
  on('btn-resume', resumeGame);
  on('btn-restart', restartLevel);
  on('btn-restart2', restartLevel);
  on('btn-retry', restartLevel);
  on('btn-next', () => startLevel((run ? run.state.level : lastLevel) + 0));
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-bomb', () => { if (run && phase === 'playing') { bombArmed = !bombArmed; updateHud(); } });
  on('btn-shuffle', () => { if (run && phase === 'playing') { if (run.shuffle().ok) updateHud(); } });
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result' || phase === 'paused') startTutorial(); });
  on('btn-tut-replay', () => { if (phase === 'paused') resumeGame(); if (phase === 'playing') startTutorial(); });
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
    renderer.draw(run ? run.state : null, dt, {});
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
  start: (i) => (i === 'rush' ? startRush() : startLevel(i == null ? (lastLevel || 0) : i)),
  startRush: () => startRush(),
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
    get steps() { return ['pop', 'combo', 'win']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
  },
  startTutorial: () => startTutorial(),
  debug: {
    state: () => (run ? run.state : null),
    layout: () => { try { return renderer.debugLayout(); } catch { return null; } },
    loadLevel: (i) => startLevel(i),
    popBest: () => {
      if (!run || run.state.phase !== 'playing') return false;
      const g = run.state.grid;
      let best = null;
      let bestLen = 0;
      const seen = new Set();
      for (let r = 0; r < GAME.N; r += 1) {
        for (let c = 0; c < GAME.N; c += 1) {
          if (g[r][c] < 0 || seen.has(`${r},${c}`)) continue;
          const stack = [[r, c]];
          const local = new Set([`${r},${c}`]);
          const color = g[r][c];
          let n = 0;
          while (stack.length) {
            const [cr, cc] = stack.pop();
            n += 1;
            for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
              const nr = cr + dr;
              const nc = cc + dc;
              if (nr < 0 || nr >= GAME.N || nc < 0 || nc >= GAME.N) continue;
              if (g[nr][nc] !== color) continue;
              const k = `${nr},${nc}`;
              if (local.has(k)) continue;
              local.add(k);
              stack.push([nr, nc]);
            }
          }
          for (const k of local) seen.add(k);
          if (n > bestLen) { bestLen = n; best = { r, c }; }
        }
      }
      if (!best) return false;
      const res = run.tap(best.r, best.c);
      updateHud();
      return res.ok;
    },
    forceWin: () => {
      if (!run || run.state.phase !== 'playing') return false;
      const s = run.state;
      s.score = s.target + 1;
      for (let r = 0; r < GAME.N; r += 1) {
        for (let c = 0; c < GAME.N; c += 1) if (s.grid[r][c] >= 0) s.grid[r][c] = -1;
      }
      s.gems = 0;
      run._checkEnd();
      updateHud();
      return true;
    },
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
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
