// BLADE BARRAGE · 主入口：60Hz 固定步长 + 标题/游戏/暂停/结算 + 教程引导 + SDK 统一出口
// 契约见 docs/batch3/blade-barrage.md。装配：sim / render / audio / ui / sdk。

import { STEP, GAME } from '../config/game.config.js';
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
let phase = 'title';       // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let fpsSamples = [];
let tutorialStep = -1;     // -1 = 未激活
let firstRun = true;

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let best = Sdk.load('best', 0) | 0;
let bestStars = Sdk.load('bestStars', 0) | 0;
let tutorialDone = !!Sdk.load('tutorialDone', false);

Sdk.ready(); // 不 await，不阻塞首屏
Sdk.onAdStart(() => { if (phase === 'playing') pauseGame(true); });
Sdk.onAdEnd(() => { if (phase === 'paused') resumeGame(); });
audio.setMuted(muted);

function persist() {
  Sdk.save('muted', muted);
  Sdk.save('best', best);
  Sdk.save('bestStars', bestStars);
  Sdk.save('tutorialDone', tutorialDone);
}

function starsOf(score) {
  if (score >= GAME.STAR_3) return 3;
  if (score >= GAME.STAR_2) return 2;
  if (score >= GAME.STAR_1) return 1;
  return 0;
}

// ---------- 阶段状态机 ----------
function setPhase(p) { phase = p; }

function startGame(seed) {
  run = createRun({ seed: (seed != null ? seed : (Date.now() % 2147483647)) || 1 });
  setPhase('playing');
  ui.showGame();
  hideResult();
  updateHud();
  renderer.shake(0);
  audio.startBgm();
  Sdk.newRun({ seed: run.state && seed });
  if (!tutorialDone && firstRun) startTutorial();
  firstRun = false;
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

function restartGame() {
  startGame();
}

function goHome() {
  run = null;
  setPhase('title');
  hideResult();
  ui.showTitle();
  updateTitleBest();
}

// ---------- HUD ----------
function hearts(n) {
  let s = '';
  for (let i = 0; i < GAME.LIVES; i += 1) s += i < n ? '♥' : '♡';
  return s;
}

function updateHud() {
  if (!run) return;
  const h = run.getHud();
  $('hud-score').textContent = `${t('score')} ${h.score}`;
  $('hud-combo').textContent = `×${h.combo || 1}`;
  $('hud-combo').classList.toggle('combo-hot', h.combo >= 3);
  $('hud-wave').textContent = `${t('wave')} ${h.wave}`;
  $('hud-gems').textContent = `${t('gems')} ${h.gems}`;
  $('hud-lives').textContent = hearts(h.lives);
  $('hud-best').textContent = `${t('best')} ${Math.max(best, h.score)}`;
  $('hud-surge').classList.toggle('hidden', !h.surge);
}

function updateTitleBest() {
  const el = $('title-best');
  if (el) el.textContent = `${t('best')} ★${bestStars} · ${best}`;
}

// ---------- 结算 ----------
function showResult(res) {
  const { score, stars, maxCombo, hits, gems, wave } = res;
  const isNew = score > best;
  $('result-title').textContent = t('resultTitle');
  $('result-stars').innerHTML = `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}`;
  $('result-score').textContent = String(score);
  $('result-best').textContent = String(Math.max(best, score));
  $('result-maxcombo').textContent = `×${maxCombo}`;
  $('result-hits').textContent = String(hits);
  $('result-gems').textContent = String(gems);
  $('result-wave').textContent = String(wave);
  $('result-newbest').classList.toggle('hidden', !isNew);
  ui.showResult();
}

function hideResult() {
  $('screen-result').classList.add('hidden');
}

function finishRun(ev) {
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  const s = run.state;
  const score = s.score;
  const stars = starsOf(score);
  if (score > best) { best = score; bestStars = stars; }
  persist();
  Sdk.gameOver({ score, stars, hits: s.hits, maxCombo: s.maxCombo, wave: s.wave });
  showResult({ score, stars, maxCombo: s.maxCombo, hits: s.hits, gems: s.gems, wave: s.wave });
  audio.event('lose', ev);
}

// ---------- 教程（首次自动弹，可跳过，完成/跳过后持久化） ----------
const TUT_STEPS = () => [
  { text: t('tutStep1'), spot: 'blade' },
  { text: t('tutStep2'), spot: 'core' },
  { text: t('tutStep3'), spot: 'gem' },
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
  const spot = $('tut-spotlight');
  const card = $('tut-card');
  const rect = s && s.spot ? layoutRect(s.spot) : null;
  if (rect) {
    spot.style.display = 'block';
    spot.style.left = `${rect.x - 10}px`;
    spot.style.top = `${rect.y - 10}px`;
    spot.style.width = `${rect.w + 20}px`;
    spot.style.height = `${rect.h + 20}px`;
  } else {
    spot.style.display = 'none';
  }
  // 卡片固定底部居中（vision-review 要求，不遮挡顶部目标）
  card.style.left = '50%';
  card.style.top = 'auto';
  card.style.bottom = '36px';
  card.style.transform = 'translateX(-50%)';
}

function layoutRect(which) {
  try {
    const lay = renderer.debugLayout();
    return lay && lay[which] ? lay[which] : null;
  } catch { return null; }
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

const TUT_TRIGGER = ['fire', 'hit', 'combo'];
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
      case 'fire':
        renderer.fx('fire', GAME.BLADE_X, run.state.blade.y);
        break;
      case 'hit':
        renderer.fx('hit', GAME.BLADE_X, run.state.core ? run.state.core.y : 200);
        renderer.shake(2);
        break;
      case 'perfect':
        renderer.fx('perfect', GAME.BLADE_X, run.state.core ? run.state.core.y : 200);
        break;
      case 'combo':
        break;
      case 'wave':
        renderer.shake(3);
        break;
      case 'gem':
        renderer.fx('gem', GAME.BLADE_X, run.state.blade.y);
        break;
      case 'surge':
        renderer.fx('surge', GAME.BLADE_X, run.state.blade.y);
        renderer.shake(4);
        break;
      case 'burst':
        renderer.fx('burst', ev.x, ev.y);
        renderer.shake(4);
        break;
      case 'die':
        renderer.fx('die', GAME.BLADE_X, run.state.blade.y);
        renderer.shake(6);
        break;
      case 'lose':
        finishRun(ev);
        return;
      default:
        break;
    }
  }
}

// ---------- 输入 ----------
function tapAction() {
  audio.unlock();
  if (!run || phase !== 'playing') return;
  if (!run.state.blade.fired) run.fire();
  else run.burst();
  updateHud();
}

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  tapAction();
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
    e.preventDefault();
    tapAction();
  }
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
  if (e.code === 'KeyR') {
    if (phase === 'playing' || phase === 'paused' || phase === 'result') restartGame();
  }
  if (e.code === 'KeyM') toggleMute();
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
  on('btn-start', () => startGame());
  on('btn-resume', resumeGame);
  on('btn-restart', restartGame);
  on('btn-restart2', restartGame);
  on('btn-retry', restartGame);
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-howto', () => { if (phase === 'playing') startTutorial(); });
  on('btn-tut-replay', () => {
    if (phase === 'paused') resumeGame();
    if (phase === 'playing') startTutorial();
  });
  on('btn-rotate-skip', () => {
    const rs = $('rotate-screen');
    if (rs) rs.style.display = 'none';
  });
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);

  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = $(id);
    if (!sel) continue;
    sel.addEventListener('change', () => {
      ui.setLang(sel.value);
      renderTutorialStep();
      updateTitleBest();
      if (run) updateHud();
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
  start: (seed) => startGame(seed),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => restartGame(),
  home: () => goHome(),
  startTutorial: () => startTutorial(),
  save: (k, v) => Sdk.save(k, v),
  load: (k, f) => Sdk.load(k, f),
  share: (p) => Sdk.share(p),
  ui: { share: () => Sdk.share({}) },
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['fire', 'hit', 'combo']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: () => (run ? { ...run.state, core: { ...(run.state.core || {}) } } : null),
    startSeeded: (seed) => startGame(seed),
    fire: () => { if (run && phase === 'playing') run.fire(); return true; },
    burst: () => { if (run && phase === 'playing') return run.burst(); return false; },
    // 强制一次 PERFECT 命中（验收截图用）
    perfectHit: () => {
      if (!run || phase !== 'playing') return false;
      const s = run.state;
      if (!s.core) return false;
      s.core.x = GAME.BLADE_X;
      s.blade.y = s.core.y;
      run._onHit(true);
      return true;
    },
    // 强制本局结束（验收截图用）
    lose: () => {
      if (!run || phase !== 'playing') return false;
      run.state.lives = 1;
      run._die('topSpike');
      return true;
    },
    fastForward: () => {
      if (!run) return false;
      let guard = 4000;
      while (guard-- > 0 && run.state.phase === 'playing') {
        run.step(0.5);
        handleEvents(run.drainEvents());
      }
      return true;
    },
  },
};

// ---------- 启动 ----------
bind();
syncDocumentLang();
ui.applyLang();
updateTitleBest();
$('btn-mute').classList.toggle('is-muted', muted);
Sdk.track('load', {});
requestAnimationFrame(frame);
