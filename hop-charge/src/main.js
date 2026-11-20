// HOP CHARGE · 主入口：60Hz 固定步长 + 标题/游戏/暂停/结算 + 教程引导 + SDK 统一出口。
// 契约见 docs/README.md。装配：sim / render+ui / audio / Lead 集成。
// 职责：ui.js 只做语言与屏幕显隐；HUD/结算/关卡格/教程的 DOM 由这里直写。
import { STEP, LAYOUT } from '../config/game.config.js';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';
import { createRun, greedyCharge } from './game/sim.js';
import { createRenderer } from './render/index.js';
import { createAudio } from './core/audio.js';
import { ui } from './ui/ui.js';
import { i18n, t, syncDocumentLang } from './core/i18n.js';
import Sdk from './core/sdk.js';

const $ = (id) => document.getElementById(id);
const canvas = $('canvas');
const renderer = createRenderer(canvas);
const audio = createAudio();
const GROUND = LAYOUT.GROUND_Y;

let run = null;
let phase = 'title'; // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let fpsSamples = [];
let tutorialStep = -1;      // -1 = 未激活
let botMode = false;        // 自动玩（截图/gif 用）
let renderFrozen = false;   // 素材脚本冻结渲染用

const view = {
  sceneKey: 'dusk-town',
  fxQueue: [],             // {type:'halo'|'dust', x, y, ttl, maxTtl}
  shake: 0,
};

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let unlocked = Math.max(1, Sdk.load('unlocked', 1) | 0);
let starsByLevel = Sdk.load('stars', {}) || {};
let tutorialDone = !!Sdk.load('tutorialDone', false);
let best = Sdk.load('best', 0) | 0;
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
  Sdk.save('best', best);
  Sdk.save('lastLevel', lastLevel);
}

function totalStars() {
  return Object.values(starsByLevel).reduce((a, b) => a + (b | 0), 0);
}

function chapterName(lv) {
  const idx = (lv && lv.index) || 1;
  const key = idx <= 4 ? 'chapter1' : idx <= 8 ? 'chapter2' : 'chapter3';
  return t(key);
}

// ---------- 阶段状态机 ----------
function setPhase(p) { phase = p; }

function startLevel(idx) {
  idx = Math.max(0, Math.min(LEVEL_COUNT - 1, idx | 0));
  lastLevel = idx;
  botMode = false;
  run = createRun(idx, { seed: (Date.now() % 2147483647) || 1 });
  view.sceneKey = (LEVELS[idx] && LEVELS[idx].scene) || 'dusk-town';
  view.fxQueue = [];
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
  $('hud-level').textContent = `${t('level')} ${run.state.level} · ${chapterName(lv)}`;
  $('hud-score').textContent = `${t('score')} ${h.score}`;
  const comboEl = $('hud-combo');
  if (h.combo >= 2) { comboEl.classList.remove('hidden'); comboEl.textContent = `${t('combo')} ×${h.combo}`; }
  else comboEl.classList.add('hidden');
  $('hud-goal').textContent = `🎯 ${h.jumps}/${h.goalJumps}`;
  $('hud-breath').textContent = `${t('time')} ${Math.max(0, Math.ceil(h.timeLeft))}s`;
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
  const { won, stars, score, combo, reason, hasNext } = res;
  $('result-title').textContent = won ? t('winTitle') : t('loseTitle');
  $('result-title').classList.toggle('lose', !won);
  const starsEl = $('result-stars');
  starsEl.innerHTML = won
    ? `<span class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>${stars >= 3 ? `<em>${t('perfect')}</em>` : ''}`
    : '';
  $('result-meta').textContent = won
    ? `${t('score')} ${score} · ${t('combo')} ×${combo}`
    : (reason === 'timeOut' ? t('timeOutReason') : reason === 'slip' ? t('slipReason') : t('fallReason'));
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
    if (idx < LEVEL_COUNT) unlocked = Math.max(unlocked, idx + 1);
    best = Math.max(best, st.score);
    buildLevelGrid();
  }
  persist();
  Sdk.track(won ? 'win' : 'fail', {
    level: st.level, stars, score: st.score, combo: st.maxCombo,
    jumps: st.jumps, reason: ev.reason || null,
  });
  showResult({
    won, stars, score: st.score, combo: st.maxCombo,
    reason: ev.reason || null, hasNext: st.level < LEVEL_COUNT,
  });
}

// ---------- 教程引导（首次自动弹，可跳过，完成/跳过后持久化不再自动弹） ----------
const TUT_STEPS = () => [
  { text: t('tutStep1'), spot: 'chargeBar' },
  { text: t('tutStep2'), spot: 'nextPlatform' },
  { text: t('tutStep3'), spot: 'nextPlatform' },
  { text: t('tutStep4'), spot: 'hud' },
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
  if (rect && rect.w > 0) {
    spot.style.display = 'block';
    spot.style.left = `${rect.x - 10}px`;
    spot.style.top = `${rect.y - 10}px`;
    spot.style.width = `${rect.w + 20}px`;
    spot.style.height = `${rect.h + 20}px`;
  } else {
    spot.style.display = 'none';
  }
  const card = $('tut-card');
  card.classList.remove('side');
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

// 真实动作驱动：0=chargeStart 1=jump 2=perfect 3=levelClear
const TUT_TRIGGER = ['chargeStart', 'jump', 'perfect', 'levelClear'];

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
      case 'perfect': {
        const px = run.state.platforms[ev.targetIndex]?.x ?? run.state.player.x;
        view.fxQueue.push({ type: 'halo', x: px, y: GROUND, ttl: 0.5, maxTtl: 0.5 });
        view.shake = 2;
        break;
      }
      case 'land': {
        const px = run.state.platforms[ev.targetIndex]?.x ?? run.state.player.x;
        view.fxQueue.push({ type: 'dust', x: px, y: GROUND, ttl: 0.4, maxTtl: 0.4, seed: Math.random() * 6 });
        break;
      }
      case 'springBounce': {
        const px = run.state.platforms[ev.targetIndex]?.x ?? run.state.player.x;
        view.fxQueue.push({ type: 'halo', x: px, y: GROUND, ttl: 0.5, maxTtl: 0.5 });
        break;
      }
      case 'slip':
      case 'fall':
        view.shake = 6;
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

// ---------- 输入（按住蓄力，松开起跳；空格同） ----------
function pressIfReady() {
  if (!run || phase !== 'playing') return;
  if (run.state.phase === 'ready') run.press();
}

function releaseIfCharging() {
  if (!run || phase !== 'playing') return;
  if (run.state.phase === 'charging') run.release();
}

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  audio.unlock();
  pressIfReady();
});

window.addEventListener('pointerup', () => {
  releaseIfCharging();
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') { e.preventDefault(); audio.unlock(); pressIfReady(); }
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
  if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'result')) restartLevel();
  if (e.code === 'KeyM') toggleMute();
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'Space') releaseIfCharging();
});

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  ui.setMuted(muted);
  $('btn-mute').classList.toggle('is-muted', muted);
  $('btn-mute').textContent = muted ? '🔇' : '♪';
  persist();
}

// ---------- 自动玩（截图/gif/验收用） ----------
function oneJumpSync() {
  if (!run) return false;
  let guard = 2000;
  let released = false;
  while (guard-- > 0) {
    const ph = run.state.phase;
    if (ph === 'won' || ph === 'lost') break;
    if (ph === 'ready') {
      if (released) break; // 已落地
      run.press();
    } else if (ph === 'charging') {
      const gc = greedyCharge(run);
      if (!gc || run.state.player.charge >= gc.charge) { run.release(); released = true; }
      else run.step(1 / 60);
    } else if (ph === 'jumping') {
      run.step(1 / 60);
    }
  }
  handleEvents(run.drainEvents());
  updateHud();
  return true;
}

function autoPlaySync() {
  if (!run) return false;
  let guard = 4000;
  while (guard-- > 0) {
    const ph = run.state.phase;
    if (ph === 'won' || ph === 'lost') break;
    oneJumpSync();
  }
  handleEvents(run.drainEvents());
  updateHud();
  return true;
}

function botStep() {
  if (!run || run.state.phase === 'won' || run.state.phase === 'lost') return;
  const ph = run.state.phase;
  if (ph === 'ready') run.press();
  else if (ph === 'charging') {
    const gc = greedyCharge(run);
    if (!gc || run.state.player.charge >= gc.charge) run.release();
  }
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
  on('btn-next', () => startLevel((run ? run.state.level : lastLevel) + 1));
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
    if (botMode) botStep();
    accumulator += dt;
    while (accumulator >= STEP) {
      run.step(STEP);
      accumulator -= STEP;
    }
    handleEvents(run.drainEvents());
    if (run && phase === 'playing') updateHud();
  }

  if (view.shake > 0) view.shake = Math.max(0, view.shake - dt * 18);
  for (const fx of view.fxQueue) if (fx.ttl > 0) fx.ttl -= dt;

  if (!renderFrozen) {
    try {
      renderer.draw(run ? run.state : null, dt, view);
    } catch (err) {
      console.warn('render error', err);
    }
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
  save: (k, v) => Sdk.save(k, v),
  share: (p) => Sdk.share(p),
  ui: () => ui,
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['chargeStart', 'jump', 'perfect', 'levelClear']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: () => (run ? run.state : null),
    layout: () => { try { return renderer.debugLayout(); } catch { return null; } },
    loadLevel: (i) => startLevel(i),
    startSeeded: (i, seed) => {
      const idx = Math.max(0, Math.min(LEVEL_COUNT - 1, i | 0));
      lastLevel = idx;
      botMode = false;
      run = createRun(idx, { seed: seed | 0 || 1 });
      view.sceneKey = (LEVELS[idx] && LEVELS[idx].scene) || 'dusk-town';
      view.fxQueue = [];
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
    bot: (b) => { botMode = !!b; return botMode; },
    freezeRender: (b) => { renderFrozen = !!b; return renderFrozen; },
    // 验收辅助：greedy 自动玩（一跳 / 整关），与 tools/selfplay.mjs 同策略
    autoJump: () => oneJumpSync(),
    autoPlaceSolution: () => autoPlaySync(),
    autoPlay: () => autoPlaySync(),
    fastForward: () => autoPlaySync(),
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
$('btn-mute').textContent = muted ? '🔇' : '♪';
Sdk.track('load', {});
requestAnimationFrame(frame);
