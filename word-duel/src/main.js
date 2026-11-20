// 主入口：60Hz 固定步长 + 标题/选关/战斗/暂停/结算 + 教程引导 + SDK 统一出口。
// 装配：sim(M1) / render+ui(M2) / audio(M4) / Lead 集成。
// 字母盘在 canvas 上（pointer 命中），Cast/Swap 为 DOM 按钮，HUD/结算/教学由这里直写。
import { STEP, GAME as GAME_CFG } from '../config/game.config.js';
import { LEVELS, LEVEL_COUNT, SCENES } from '../config/levels.js';
import { createRun, findBestWord, indicesForWord } from './game/sim.js';
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
let tutorialStep = -1;     // -1 = 未激活

const view = {
  shake: 0,
  fx: [],
  t: 0,
  sceneKey: 0,
};

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let unlocked = Math.max(1, Sdk.load('unlocked', 1) | 0);
let starsByLevel = Sdk.load('stars', {}) || {};
let tutorialDone = !!Sdk.load('tutorialDone', false);
let lastLevel = Sdk.load('lastLevel', 0) | 0;

Sdk.ready(); // 不 await，不阻塞首屏
Sdk.onAdStart(() => { if (phase === 'playing') pauseGame(true); });
Sdk.onAdEnd(() => { if (phase === 'paused') resumeGame(); });
audio.setMuted(muted);
ui.setMuted(muted);

function persist() {
  Sdk.save('unlocked', unlocked);
  Sdk.save('stars', starsByLevel);
  Sdk.save('muted', muted);
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
  view.sceneKey = (LEVELS[idx] && LEVELS[idx].scene) || 0;
  view.fx = [];
  view.shake = 0;
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
  const name = lv.name ? (lv.name[i18n.lang] || lv.name.en || '') : '';
  $('hud-level').textContent = `${t('level')} ${run.state.level} · ${name}`;
  $('hud-turn').textContent = `${t('turn')} ${h.turn}`;
  $('btn-cast').disabled = phase !== 'playing' || h.frozen;
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
  const { won, stars, turns, enemyName, playerHp } = res;
  $('result-title').textContent = won ? t('winTitle') : t('loseTitle');
  const starsEl = $('result-stars');
  starsEl.innerHTML = won
    ? `<span>${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>${stars >= 3 ? ` <em>${t('perfect')}</em>` : ''}`
    : '';
  $('result-time').textContent = won ? t('victory', { name: enemyName }) : '';
  $('result-meta').textContent = won
    ? `${t('turn')} ${turns} · ${t('hp')} ${playerHp}`
    : t('defeatedBy', { name: enemyName });
  $('btn-next').style.display = won && run && run.state.level < LEVEL_COUNT ? '' : 'none';
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
  const stars = won ? (ev.stars || st.result?.stars || 1) : 0;
  if (won) {
    const idx = st.level; // 1 基
    starsByLevel[idx] = Math.max(starsByLevel[idx] | 0, stars);
    if (idx < LEVEL_COUNT) unlocked = Math.max(unlocked, idx + 1);
    buildLevelGrid();
  }
  persist();
  Sdk.track(won ? 'win' : 'fail', { level: st.level, stars, turns: st.turn, progress: st.level });
  const enemyName = (LEVELS[st.level - 1]?.name || {}).en || '';
  showResult({ won, stars, turns: st.turn, enemyName, playerHp: st.playerHp });
  audio.event(won ? 'win' : 'lose');
}

// ---------- 教程引导（首次自动弹，可跳过，完成/跳过后持久化不再自动弹） ----------
const TUT_STEPS = () => [
  { text: t('tutStep1'), spot: 'tray' },
  { text: t('tutStep2'), spot: 'cast' },
  { text: t('tutStep3'), spot: 'enemy' },
];

function layoutRect(which) {
  try {
    const lay = renderer.debugLayout();
    if (which === 'cast') {
      const el = $('btn-cast');
      if (el) { const r = el.getBoundingClientRect(); const c = canvas.getBoundingClientRect(); return { x: (r.left - c.left) * (1280 / c.width), y: (r.top - c.top) * (720 / c.height), w: r.width * (1280 / c.width), h: r.height * (720 / c.height) }; }
    }
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
  const card = $('tut-card');
  if (rect) {
    spot.style.display = 'block';
    spot.style.left = `${rect.x - 10}px`;
    spot.style.top = `${rect.y - 10}px`;
    spot.style.width = `${rect.w + 20}px`;
    spot.style.height = `${rect.h + 20}px`;
  } else {
    spot.style.display = 'none';
  }
  card.style.left = '';
  card.style.top = '';
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

// 教学步骤推进（真实动作驱动）：0=拼词 1=施法 2=命中
const TUT_TRIGGER = ['letterSelect', 'spell', 'hit'];
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
      case 'letterSelect':
        view.shake = Math.max(view.shake, 1);
        break;
      case 'hit':
        view.shake = Math.max(view.shake, 4);
        view.fx.push({ type: 'hitFlash', ttl: 0.5, seed: Math.random() });
        break;
      case 'wordCloud':
        view.shake = Math.max(view.shake, 5);
        view.fx.push({ type: 'wordCloud', ttl: 1.0, seed: Math.random(), word: ev.word });
        break;
      case 'heal':
        view.fx.push({ type: 'healGlow', ttl: 0.9, seed: Math.random() });
        break;
      case 'frozen':
        view.fx.push({ type: 'freeze', ttl: 1.0, seed: Math.random() });
        view.shake = Math.max(view.shake, 3);
        break;
      case 'playerHit':
        view.shake = Math.max(view.shake, 3);
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

function pickTile(p) {
  const lay = renderer.debugLayout();
  if (!lay || !run) return -1;
  const t = lay.tray;
  if (p.x < t.x || p.x > t.x + t.w || p.y < t.y || p.y > t.y + t.h) return -1;
  const step = lay.tile + lay.tileGap;
  const i = Math.floor((p.x - t.x) / step);
  if (i < 0 || i >= GAME_CFG.HAND_SIZE) return -1;
  if ((p.x - (t.x + i * step)) > lay.tile) return -1;
  return i;
}

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (!run || phase !== 'playing') return;
  const p = canvasPos(e);
  const i = pickTile(p);
  if (i >= 0) {
    run.selectLetter(i);
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

  if (phase === 'playing' && run) {
    if (e.code === 'Enter') { e.preventDefault(); audio.unlock(); run.submitWord(); updateHud(); }
    else if (e.code === 'Backspace') { e.preventDefault(); run.deselectLast(); updateHud(); }
    else if (/^Key[A-Z]$/.test(e.code)) {
      const ch = e.code.slice(3).toLowerCase();
      const idx = run.state.hand.findIndex((t) => !t.selected && t.ch === ch);
      if (idx >= 0) { audio.unlock(); run.selectLetter(idx); updateHud(); }
    }
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
  on('btn-next', () => startLevel((run ? run.state.level - 1 : lastLevel) + 1));
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-cast', () => { if (run && phase === 'playing') { run.submitWord(); updateHud(); } });
  on('btn-swap', () => { if (run && phase === 'playing') { run.swap(); updateHud(); } });
  on('btn-tut-replay', () => {
    if (phase === 'paused') resumeGame();
    if (phase === 'playing') startTutorial();
  });
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result') startTutorial(); });
  on('btn-rotate-skip', () => { const rs = $('rotate-screen'); if (rs) rs.style.display = 'none'; });
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
    });
  }
}

// ---------- 主循环 ----------
function frame(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;
  view.t += dt;

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
  for (const fx of view.fx) if (fx.ttl > 0) fx.ttl -= dt;
  view.fx = view.fx.filter((fx) => fx.ttl > 0);

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
  start: (i) => startLevel(i == null ? (lastLevel || 0) : i),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => restartLevel(),
  home: () => goHome(),
  sim: () => (run ? run.state : null),
  save: (key, value) => Sdk.save(key, value),
  ui: () => ui,
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['letterSelect', 'spell', 'hit']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: () => (run ? { ...run.state, handLen: run.state.hand.length, word: run.state.word } : null),
    layout: () => { try { return renderer.debugLayout(); } catch { return null; } },
    loadLevel: (i) => startLevel(i),
    startSeeded: (i, seed) => {
      const idx = Math.max(0, Math.min(LEVEL_COUNT - 1, i | 0));
      lastLevel = idx;
      run = createRun(idx, { seed: seed | 0 || 1 });
      view.sceneKey = (LEVELS[idx] && LEVELS[idx].scene) || 0;
      view.fx = [];
      view.shake = 0;
      setPhase('playing');
      ui.showGame();
      hideResult();
      updateHud();
      return true;
    },
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    startTutorial: () => startTutorial(),
    tutorialStep: () => tutorialStep,
    // 自动拼出当前手牌最长词并提交（供验收/截图）
    autoSpell: () => { if (!run) return null; const r = run.autoSpell(); updateHud(); return r; },
    autoPlaceSolution: () => window.__ll.debug.autoSpell(),
    // 选中当前手牌最长词的全部字母（不提交），供 gif 录制展示拼字过程
    spellBest: () => {
      if (!run || run.state.phase !== 'playing') return null;
      const letters = run.state.hand.map((h) => h.ch);
      const word = findBestWord(letters);
      if (!word) return null;
      const idx = indicesForWord(letters, word);
      for (const i of idx) run.selectLetter(i);
      updateHud();
      return word;
    },
    submit: () => { if (!run) return null; const r = run.submitWord(); updateHud(); return r; },
    // 快进：反复自动拼词直到终局
    fastForward: () => {
      if (!run) return false;
      try {
        let guard = 400;
        while (guard-- > 0 && run.state.phase === 'playing') {
          run.autoSpell();
          handleEvents(run.drainEvents());
        }
        return true;
      } catch { return false; }
    },
    giveUp: () => window.__ll.debug.fastForward(),
  },
};

// ---------- 启动 ----------
bind();
syncDocumentLang();
ui.applyLang();
buildLevelGrid();
$('btn-mute').classList.toggle('is-muted', muted);
Sdk.track('load', {});
requestAnimationFrame(frame);
