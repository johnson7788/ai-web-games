// 主入口：60Hz 固定步长 + 标题/选关/游戏/暂停/结算 + 教程引导 + SDK 统一出口 + 调试契约。
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

const keys = { left: false, right: false };
let jumpQueued = false;

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let unlocked = Math.max(1, Sdk.load('unlocked', 1) | 0);
let starsByLevel = Sdk.load('stars', {}) || {};
let tutorialDone = !!Sdk.load('tutorialDone', false);
let best = Sdk.load('best', 0) | 0;
let lastLevel = Sdk.load('lastLevel', 0) | 0;

Sdk.ready(); // 不 await，不阻塞首屏
audio.setMuted(muted);

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
  $('screen-title').classList.add('hidden');
  $('screen-title').classList.remove('is-active');
  $('screen-pause').classList.add('hidden');
  $('screen-result').classList.add('hidden');
  $('card-overlay').classList.add('hidden');
  $('hud').classList.remove('hidden');
  updateHud();
  audio.unlock();
  audio.startBgm();
  Sdk.newRun({ level: idx + 1 });
  Sdk.track('start', { level: idx + 1 });
  if (!tutorialDone && idx === 0) startTutorial();
}

function pauseGame(silent) {
  if (phase !== 'playing') return;
  setPhase('paused');
  audio.stopBgm();
  if (!silent) $('screen-pause').classList.remove('hidden');
}

function resumeGame() {
  if (phase !== 'paused') return;
  setPhase('playing');
  $('screen-pause').classList.add('hidden');
  audio.unlock();
  audio.startBgm();
}

function restartLevel() {
  if (run) Sdk.track('restart', { level: run.state.level });
  startLevel(run ? run.state.levelIndex : lastLevel);
}

function goHome() {
  run = null;
  setPhase('title');
  $('screen-result').classList.add('hidden');
  $('screen-pause').classList.add('hidden');
  $('card-overlay').classList.add('hidden');
  $('hud').classList.add('hidden');
  $('screen-title').classList.remove('hidden');
  $('screen-title').classList.add('is-active');
  buildLevelGrid();
}

// ---------- HUD / 关卡格 / 结算 ----------
function updateHud() {
  if (!run) return;
  const h = run.getHud();
  const lv = LEVELS[run.state.levelIndex] || {};
  $('hud-level').textContent = `${t('level')} ${run.state.level} · ${(lv.name && (lv.name[i18n.lang] || lv.name.en)) || ''}`;
  $('hud-score').textContent = `${t('score')} ${h.score}`;
  $('hud-plate').textContent = `🍽 ${h.collected}/${h.totalIngredients}`;
  const comboEl = $('hud-combo');
  comboEl.style.display = h.combo >= 2 ? '' : 'none';
  comboEl.textContent = `${t('combo')} ×${h.combo}`;
  if (h.spiceLeft > 0) {
    $('hud-plate').textContent = `${t('spiceName')} ${Math.ceil(h.spiceLeft)}s`;
  }
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
    const lv = LEVELS[i];
    cell.innerHTML = `<span class="lv-num">${i + 1}</span><span class="lv-stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>`;
    cell.setAttribute('aria-label', `${t('level')} ${i + 1}${i + 1 > unlocked ? ' ' + t('locked') : ''}${lv ? ' · ' + (lv.name[i18n.lang] || lv.name.en) : ''}`);
    grid.appendChild(cell);
  }
}

function showResult(res) {
  const { won, stars, score, collected, total, hasNext, combo } = res;
  $('result-title').textContent = won ? t('winTitle') : t('loseTitle');
  const starsEl = $('result-stars');
  starsEl.innerHTML = won
    ? `<span class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>${stars >= 3 ? `<em>${t('perfect')}</em>` : ''}`
    : '';
  $('result-msg').textContent = won
    ? `${t('winMsg')} ${collected}/${total} · ${t('score')} ${score}${combo >= 2 ? ` · ${t('combo')} ×${combo}` : ''}`
    : t('loseMsg');
  $('btn-next').style.display = won && hasNext ? '' : 'none';
  $('screen-result').classList.remove('hidden');
}

function finishRun(ev) {
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  const st = run.state;
  const won = ev.type === 'win';
  const stars = won ? (ev.stars || 1) : 0;
  if (won) {
    const idx = st.level;
    starsByLevel[idx] = Math.max(starsByLevel[idx] | 0, stars);
    if (idx < LEVEL_COUNT) unlocked = Math.max(unlocked, idx + 1);
    if (st.score > best) best = st.score;
    buildLevelGrid();
  }
  persist();
  Sdk.track(won ? 'win' : 'fail', { level: st.level, stars, score: st.score, durationSec: Math.round(st.time) });
  showResult({
    won, stars, score: st.score, collected: st.collected, total: st.totalIngredients,
    hasNext: st.level < LEVEL_COUNT, combo: st.bestCombo,
  });
}

// ---------- 菜谱卡（触碰路牌弹出并暂停） ----------
function showCard(titleKey, textKey) {
  $('card-title').textContent = t(titleKey);
  $('card-text').textContent = t(textKey);
  $('card-close').textContent = t('cardClose');
  $('card-overlay').classList.remove('hidden');
}

function hideCard() {
  $('card-overlay').classList.add('hidden');
  resumeGame();
}

// ---------- 教程引导 ----------
const TUT_TRIGGER = ['move', 'jump', 'coin'];
const TUT_STEPS = () => [
  { text: t('tutStep1') },
  { text: t('tutStep2') },
  { text: t('tutStep3') },
];

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
  $('tut-spotlight').style.display = 'none';
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
    const px = run ? run.state.player.x + run.state.player.w / 2 : 0;
    const py = run ? run.state.player.y + run.state.player.h / 2 : 0;
    switch (ev.type) {
      case 'coin':
        renderer.burst(px, py, 'coin');
        break;
      case 'stomp':
      case 'smash':
        renderer.burst(px, py, 'stomp');
        break;
      case 'spice':
        renderer.burst(px, py, 'spice');
        break;
      case 'card':
        showCard(ev.title, ev.text);
        pauseGame(true);
        break;
      case 'win':
      case 'death':
        finishRun(ev);
        return;
      default:
        break;
    }
  }
}

// ---------- 输入 ----------
function bindTouch(id, press, release) {
  const el = $(id);
  if (!el) return;
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); audio.unlock(); press(); });
  el.addEventListener('pointerup', (e) => { e.preventDefault(); release(); });
  el.addEventListener('pointercancel', release);
  el.addEventListener('pointerleave', release);
}

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  $('btn-mute').textContent = muted ? '🔇' : '🔊';
  persist();
}

function applyStaticTexts() {
  $('title-text').textContent = t('title');
  $('subtitle-text').textContent = t('subtitle');
  $('btn-start').textContent = t('start');
  $('pause-title').textContent = t('paused');
  $('btn-resume').textContent = t('resume');
  $('btn-restart2').textContent = t('restart');
  $('btn-home3').textContent = t('home');
  $('btn-retry').textContent = t('retry');
  $('btn-next').textContent = t('nextLevel');
  $('btn-home2').textContent = t('home');
  $('btn-howto').textContent = '?';
  $('btn-howto-title').textContent = t('howto');
  $('card-close').textContent = t('cardClose');
  $('rotate-text').textContent = t('rotateHint');
  $('btn-rotate-skip').textContent = t('rotateSkip');
  $('btn-mute').textContent = muted ? '🔇' : '🔊';
  $('btn-home').textContent = '🏠';
  $('btn-restart').textContent = '↻';
  buildLevelGrid();
  if (run) updateHud();
  if (tutorialStep >= 0) renderTutorialStep();
}

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
  on('btn-next', () => startLevel((run ? run.state.levelIndex : lastLevel) + 1));
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result') startTutorial(); });
  on('btn-howto-title', startTutorial);
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);
  on('card-close', hideCard);

  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = $(id);
    if (!sel) continue;
    sel.addEventListener('change', () => {
      ui.setLang(sel.value);
      applyStaticTexts();
    });
  }

  $('level-grid')?.addEventListener('click', (e) => {
    const idx = e.target.closest('[data-level]')?.dataset.level;
    if (idx == null) return;
    const i = +idx;
    if (i + 1 > unlocked) return;
    startLevel(i);
  });

  bindTouch('t-left', () => { keys.left = true; }, () => { keys.left = false; });
  bindTouch('t-right', () => { keys.right = true; }, () => { keys.right = false; });
  bindTouch('t-jump', () => { jumpQueued = true; }, () => {});
}

window.addEventListener('keydown', (e) => {
  const k = e.code;
  if (k === 'KeyA' || k === 'ArrowLeft') keys.left = true;
  else if (k === 'KeyD' || k === 'ArrowRight') keys.right = true;
  else if (k === 'Space' || k === 'ArrowUp' || k === 'KeyW') { if (!e.repeat) { jumpQueued = true; audio.unlock(); } e.preventDefault(); }
  else if (k === 'Escape' || k === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  } else if (k === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'result')) restartLevel();
  else if (k === 'KeyM') toggleMute();
});

window.addEventListener('keyup', (e) => {
  const k = e.code;
  if (k === 'KeyA' || k === 'ArrowLeft') keys.left = false;
  else if (k === 'KeyD' || k === 'ArrowRight') keys.right = false;
});

// ---------- 主循环 ----------
function frame(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;

  if (phase === 'playing' && run) {
    run.state.input.left = keys.left;
    run.state.input.right = keys.right;
    if (jumpQueued) { run.state.input.jump = true; jumpQueued = false; }
    accumulator += dt;
    while (accumulator >= STEP) {
      run.step(STEP);
      accumulator -= STEP;
    }
    handleEvents(run.drainEvents());
    if (run && phase === 'playing') updateHud();
  }

  try {
    renderer.draw(run ? run.state : null, dt);
  } catch (err) {
    console.warn('render error', err);
  }

  if (fpsSamples.length < 600 && dt > 0) fpsSamples.push(1 / dt);
  requestAnimationFrame(frame);
}

// ---------- 调试契约（截图/验收脚本通用） ----------
function summary() {
  if (!run) return null;
  const st = run.state;
  return {
    phase: st.phase,
    level: st.level,
    score: st.score,
    collected: st.collected,
    totalIngredients: st.totalIngredients,
    combo: st.combo,
    time: st.time,
    playerX: Math.round(st.player.x),
    playerY: Math.round(st.player.y),
    ingredientsLeft: st.ingredients.filter((c) => !c.taken).length,
    enemiesAlive: st.enemies.filter((e) => e.alive).length,
    hazards: st.hazards.length,
    spiceLeft: Math.max(0, st.player.spiceUntil - st.time),
  };
}

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
    get steps() { return TUT_TRIGGER; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  save: (k, v) => Sdk.save(k, v),
  share: (p) => Sdk.share(p || {}),
  ui,
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: summary,
    loadLevel: (i) => startLevel(i),
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    win: () => {
      if (!run) return false;
      run.state.player.x = run.state.end.x + 4;
      run.state.player.y = run.state.end.y - 2;
      return true;
    },
    die: () => {
      if (!run) return false;
      run.state.player.y = 9999;
      return true;
    },
    fastForward: () => {
      if (!run) return false;
      let guard = 1200;
      while (guard-- > 0 && run.state.phase === 'playing') {
        run.step(1 / 60);
        handleEvents(run.drainEvents());
      }
      return true;
    },
  },
};

// ---------- 启动 ----------
bind();
syncDocumentLang();
ui.fillLangOptions();
applyStaticTexts();
buildLevelGrid();
// 触屏按钮：粗指针才显示
if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer: coarse)').matches) {
  $('touch-controls').classList.add('visible');
}
Sdk.track('load', {});
requestAnimationFrame(frame);
