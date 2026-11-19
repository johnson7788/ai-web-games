// Bubble Tap Pop · 主入口：60Hz 固定步长 + 标题→游戏→暂停→结算 + 教程引导 + SDK 统一出口。
// 装配：sim（纯逻辑）/ render（canvas 程序化）/ ui（语言与显隐）/ audio（WebAudio 程序化）。
import { STEP, GAME, WORLD } from '../config/game.config.js';
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
let best = Sdk.load('best', 0) | 0;
let bestStars = Sdk.load('bestStars', 0) | 0;
let muted = !!Sdk.load('muted', false);
let tutorialDone = !!Sdk.load('tutorialDone', false);
let tutorialStep = -1;

Sdk.ready(); // 不 await，不阻塞首屏
audio.setMuted(muted);
ui.setMuted(muted);

function persist() {
  Sdk.save('best', best);
  Sdk.save('bestStars', bestStars);
  Sdk.save('muted', muted);
  Sdk.save('tutorialDone', tutorialDone);
}

// ---------- 阶段状态机 ----------
function setPhase(p) { phase = p; }

function startGame() {
  run = createRun({ seed: (Date.now() % 2147483647) || 1, best });
  setPhase('playing');
  ui.showGame();
  hideResult();
  updateHud();
  audio.unlock();
  audio.startBgm();
  Sdk.newRun({});
  if (!tutorialDone) startTutorial();
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

function restartGame() {
  startGame();
}

function goHome() {
  run = null;
  setPhase('title');
  hideResult();
  ui.showTitle();
  audio.stopBgm();
  refreshTitleBest();
}

// ---------- HUD / 结算 ----------
function refreshTitleBest() {
  const el = $('title-best');
  if (!el) return;
  el.textContent = `${t('best')} ${best} · ${'★'.repeat(bestStars)}${bestStars ? '' : ''}`;
}

function renderLives(n) {
  const el = $('hud-lives');
  if (!el) return;
  el.innerHTML = '';
  for (let i = 0; i < GAME.MAX_LIVES; i += 1) {
    const s = document.createElement('span');
    s.className = 'heart' + (i < n ? '' : ' heart-empty');
    s.textContent = '♥';
    el.appendChild(s);
  }
}

function updateHud() {
  if (!run) return;
  const h = run.getHud();
  $('hud-score').textContent = `${t('score')} ${h.score}`;
  $('hud-best').textContent = `${t('best')} ${Math.max(best, h.score)}`;
  $('hud-level').textContent = `${t('level')} ${h.level}`;
  const comboEl = $('hud-combo');
  if (h.combo >= 2) {
    comboEl.classList.remove('hidden');
    comboEl.textContent = `${t('combo')} ×${h.combo}`;
  } else {
    comboEl.classList.add('hidden');
  }
  renderLives(h.lives);
}

function showResult(res) {
  $('result-title').textContent = t('resultTitle');
  $('result-stars').innerHTML = `${'★'.repeat(res.stars)}${'☆'.repeat(3 - res.stars)}`;
  $('result-score').textContent = `${t('resultScore')}: ${res.score}`;
  $('result-meta').textContent = `${t('resultBestCombo')}: ${res.bestCombo}${res.newBest ? '  ·  ' + t('newRecord') : ''}`;
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
  const isNewBest = st.score > best;
  if (isNewBest) best = st.score;
  if (st.stars > bestStars) bestStars = st.stars;
  persist();
  Sdk.gameOver({ score: st.score, stars: st.stars, bestCombo: st.bestCombo });
  showResult({ score: st.score, stars: st.stars, bestCombo: st.bestCombo, newBest: isNewBest });
}

// ---------- 教程引导（首次自动弹，可跳过，可重看） ----------
function TUT_STEPS() {
  return [
    { text: t('tutStep1'), spot: 'target' },
    { text: t('tutStep2'), spot: 'bubble' },
    { text: t('tutStep3'), spot: 'bubble' },
  ];
}

function layoutRect(which) {
  if (!run) return null;
  try {
    const lay = renderer.debugLayout(run.state);
    return lay && lay[which] ? lay[which] : null;
  } catch { return null; }
}

function startTutorial() {
  tutorialStep = 0;
  renderTutorialStep();
}

function renderTutorialStep() {
  const el = $('tutorial');
  if (!el) return;
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

// 真实动作推进：连续点对一次前进一步
function tutorialAdvance(evType) {
  if (tutorialStep < 0 || tutorialStep >= TUT_STEPS().length) return;
  if (evType !== 'correct') return;
  tutorialStep += 1;
  if (tutorialStep >= TUT_STEPS().length) endTutorial();
  else renderTutorialStep();
}

// ---------- 事件消费 ----------
function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    tutorialAdvance(ev.type);
    switch (ev.type) {
      case 'levelUp':
        renderer.flash();
        break;
      case 'timeout':
        renderer.shake(4);
        break;
      case 'newBest':
        renderer.float(WORLD.WIDTH / 2, 190, t('newRecord'), '#FFE95C');
        break;
      case 'gameover':
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
    x: (e.clientX - rect.left) * (WORLD.WIDTH / rect.width),
    y: (e.clientY - rect.top) * (WORLD.HEIGHT / rect.height),
  };
}

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (!run || phase !== 'playing') return;
  const p = canvasPos(e);
  const id = renderer.hitTest(p.x, p.y, run.state);
  if (!id) return;
  const rect = renderer.bubbleRects(run.state).find((r) => r.id === id);
  const cx = rect ? rect.x : p.x;
  const cy = rect ? rect.y : p.y;
  const b = run.state.bubbles.find((x) => x.id === id);
  const res = run.tap(id);
  if (res.ok) {
    if (res.gain != null) {
      renderer.burst(cx, cy, b ? b.color : 'blue');
      renderer.float(cx, cy - 60, `+${res.gain}`, '#FFFFFF');
    } else if (res.reason === 'rock') {
      renderer.burst(cx, cy, 'rock');
      renderer.shake(9);
      renderer.flash();
    } else if (res.reason === 'wrong') {
      renderer.burst(cx, cy, 'rock');
      renderer.shake(5);
    }
    updateHud();
  }
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
  if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'result')) restartGame();
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
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result') startTutorial(); });
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);
  on('btn-rotate-skip', () => {
    const rs = $('rotate-screen');
    if (rs) rs.style.display = 'none';
  });

  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = $(id);
    if (!sel) continue;
    sel.addEventListener('change', () => {
      ui.setLang(sel.value);
      renderTutorialStep();
      if (run) updateHud();
      refreshTitleBest();
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
    get dir() { return i18n.dir; },
  },
  run: () => run,
  sim: () => (run ? run.state : null),
  start: () => startGame(),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => restartGame(),
  home: () => goHome(),
  save: (k, v) => Sdk.save(k, v),
  ui: () => ui,
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['tap', 'combo', 'survive']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  debug: {
    state: () => {
      if (!run) return null;
      return { ...run.state, bubbles: run.state.bubbles.map((b) => ({ ...b })) };
    },
    tapCorrect: () => {
      if (!run || run.state.phase !== 'playing') return false;
      const b = run.state.bubbles.find((x) => x.kind === 'bubble' && x.color === run.state.target);
      if (!b) return false;
      run.tap(b.id);
      return true;
    },
    tapWrong: () => {
      if (!run || run.state.phase !== 'playing') return false;
      const b = run.state.bubbles.find((x) => x.kind === 'bubble' && x.color !== run.state.target);
      if (!b) return false;
      run.tap(b.id);
      return true;
    },
    hasRock: () => {
      if (!run) return false;
      return run.state.bubbles.some((x) => x.kind === 'rock');
    },
    forceScore: (n) => {
      if (!run) return false;
      run.state.score = Math.max(0, n | 0);
      run.state.level = 1 + Math.floor(run.state.score / GAME.LEVEL_EVERY);
      return true;
    },
    giveUp: () => {
      if (!run) return false;
      let guard = 4000;
      while (guard-- > 0 && run.state.phase !== 'over') {
        run.step(0.5);
        handleEvents(run.drainEvents());
      }
      if (run.state.phase === 'over' && phase !== 'result') finishRun({ type: 'gameover' });
      return true;
    },
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
  },
};

// ---------- 启动 ----------
bind();
syncDocumentLang();
ui.applyLang();
refreshTitleBest();
$('btn-mute').classList.toggle('is-muted', muted);
Sdk.track('load', {});
requestAnimationFrame(frame);
