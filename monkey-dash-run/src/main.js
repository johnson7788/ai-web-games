// 主入口：60Hz 固定步长 + 标题/游戏/暂停/结算 + 教程 + SDK + 标准调试契约
import { STEP, LANES_X, PLAYER_Y, ENTITY_R } from '../config/game.config.js';
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
let tutorialStep = -1; // -1 未激活
let tutorialShown = false;
let muted = !!Sdk.load('muted', false);
let best = Sdk.load('best', 0) | 0;
let tutorialDone = !!Sdk.load('tutorialDone', false);

const reducedMotion = typeof matchMedia === 'function'
  && matchMedia('(prefers-reduced-motion: reduce)').matches;

const view = {
  time: 0,
  shake: 0,
  reducedMotion,
};

audio.setMuted(muted);
ui.setMuted(muted);
Sdk.ready(); // 不 await，不阻塞首屏

function persist() {
  Sdk.save('muted', muted);
  Sdk.save('best', best);
  Sdk.save('tutorialDone', tutorialDone);
}

// ---------- 阶段状态机 ----------
function setPhase(p) { phase = p; }

function startGame() {
  run = createRun({ seed: (Date.now() % 2147483647) || 1 });
  setPhase('playing');
  ui.showGame();
  ui.hideResult();
  hideTutorial();
  audio.unlock();
  audio.startBgm();
  Sdk.newRun({});
  Sdk.track('start', {});
  updateHud();
  if (!tutorialDone && !tutorialShown) {
    tutorialShown = true;
    startTutorial();
  }
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
  lastTime = performance.now();
}

function retryRun() {
  run = createRun({ seed: (Date.now() % 2147483647) || 1 });
  setPhase('playing');
  ui.showGame();
  ui.hideResult();
  hideTutorial();
  audio.unlock();
  audio.startBgm();
  Sdk.newRun({});
  updateHud();
}

function goHome() {
  run = null;
  setPhase('title');
  hideTutorial();
  ui.showTitle();
  audio.stopBgm();
}

// ---------- HUD / 结算 ----------
function updateHud() {
  if (!run) return;
  const h = run.getHud();
  $('hud-score').textContent = `${t('score')} ${h.score}`;
  $('hud-best').textContent = `${t('best')} ${best}`;
  $('hud-tier').textContent = `${t('tier')} ${h.tier}`;
  $('hud-combo').textContent = h.combo > 1 ? `×${h.combo}` : '';
  $('hud-combo').style.display = h.combo > 1 ? '' : 'none';
  $('hud-shield').textContent = h.invincible > 0 ? `🛡 ${h.invincible.toFixed(1)}` : '';
  $('hud-shield').style.display = h.invincible > 0 ? '' : 'none';
  // 火花进度：◆◆◇
  const full = '◆'.repeat(h.sparks) + '◇'.repeat(Math.max(0, 3 - h.sparks));
  $('hud-rush').textContent = h.rush > 0 ? `${t('rush')} ${h.rush.toFixed(1)}` : full;
  $('hud-rush').style.display = (h.rush > 0 || h.sparks > 0) ? '' : 'none';
}

function finishRun(ev) {
  setPhase('result');
  audio.stopBgm();
  hideTutorial();
  const st = run.state;
  const score = st.score | 0;
  const isBest = score > best;
  if (isBest) {
    best = score;
    Sdk.save('best', best);
  }
  $('result-score').textContent = score;
  $('result-best').textContent = best;
  $('result-tier').textContent = st.tier;
  $('result-combo').textContent = st.maxCombo;
  $('result-newbest').classList.toggle('hidden', !isBest);
  ui.showResult();
  Sdk.gameOver({ score, tier: st.tier, cause: ev.cause || null });
  audio.event('death');
}

// ---------- 教程（首次自动弹，可跳过，可重看） ----------
const TUT_STEPS = () => [
  { text: t('tutStep1'), action: 'switch' },
  { text: t('tutStep2'), action: 'collect' },
  { text: t('tutStep3'), action: 'rushStart' },
];

function startTutorial() {
  tutorialStep = 0;
  renderTutorialStep();
}

function renderTutorialStep() {
  const el = $('tutorial');
  if (tutorialStep < 0) {
    el.classList.add('hidden');
    return;
  }
  const steps = TUT_STEPS();
  const s = steps[tutorialStep] || steps[steps.length - 1];
  el.classList.remove('hidden');
  $('tut-title').textContent = t('tutTitle');
  $('tut-text').textContent = s.text;
  $('tut-skip').textContent = t('tutSkip');
  $('tut-next').textContent = t('tutNext');
  const spot = $('tut-spotlight');
  if (spot) spot.style.display = 'none';
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

function hideTutorial() {
  tutorialStep = -1;
  renderTutorialStep();
}

function tutorialAdvance(evType) {
  if (tutorialStep < 0) return;
  const steps = TUT_STEPS();
  if (tutorialStep >= steps.length) return;
  if (steps[tutorialStep].action !== evType) return;
  tutorialStep += 1;
  if (tutorialStep >= steps.length) endTutorial();
  else renderTutorialStep();
}

// ---------- 事件消费 ----------
function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    tutorialAdvance(ev.type);
    switch (ev.type) {
      case 'switch':
        view.shake = reducedMotion ? 0 : 2;
        break;
      case 'smash':
        view.shake = reducedMotion ? 0 : 5;
        break;
      case 'rushStart':
        view.shake = reducedMotion ? 0 : 6;
        break;
      case 'death':
        finishRun(ev);
        return;
      default:
        break;
    }
  }
}

// ---------- 输入 ----------
canvas.addEventListener('pointerdown', () => {
  audio.unlock();
  if (phase === 'playing' && run) {
    run.tap();
  }
});

window.addEventListener('keydown', (e) => {
  const code = e.code;
  if (code === 'Space' || code === 'ArrowUp' || code === 'KeyW') {
    e.preventDefault();
    if (phase === 'playing' && run) run.tap();
    else if (phase === 'result') retryRun();
    else if (phase === 'title') startGame();
    return;
  }
  if (code === 'ArrowLeft' || code === 'KeyA') {
    if (phase === 'playing' && run) run.moveLane(0);
    return;
  }
  if (code === 'ArrowRight' || code === 'KeyD') {
    if (phase === 'playing' && run) run.moveLane(1);
    return;
  }
  if (code === 'Escape' || code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
    return;
  }
  if (code === 'KeyR') {
    if (phase === 'playing' || phase === 'paused' || phase === 'result') retryRun();
    return;
  }
  if (code === 'KeyM') {
    toggleMute();
  }
});

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  ui.setMuted(muted);
  persist();
}

// ---------- UI 绑定 ----------
function bind() {
  const on = (id, fn) => {
    const el = $(id);
    if (el) el.addEventListener('click', () => { audio.unlock(); fn(); });
  };
  on('btn-start', startGame);
  on('btn-resume', resumeGame);
  on('btn-restart', retryRun);
  on('btn-restart2', retryRun);
  on('btn-retry', retryRun);
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-howto', startTutorial);
  on('btn-tut-replay', () => { if (phase === 'paused') resumeGame(); startTutorial(); });
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);

  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = $(id);
    if (!sel) continue;
    sel.addEventListener('change', () => {
      ui.setLang(sel.value);
      if (tutorialStep >= 0) renderTutorialStep();
      if (run) updateHud();
    });
  }
}

// ---------- 主循环 ----------
function frame(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;
  view.time += dt;

  if (phase === 'playing' && run) {
    accumulator += dt;
    while (accumulator >= STEP) {
      run.step(STEP);
      accumulator -= STEP;
    }
    handleEvents(run.drainEvents());
    if (run && phase === 'playing') updateHud();
  }

  if (view.shake > 0) view.shake = Math.max(0, view.shake - dt * 16);

  renderer.draw(run ? run.state : null, dt, view);
  requestAnimationFrame(frame);
}

// ---------- 调试契约 ----------
window.__ll = {
  state: {
    get phase() { return phase; },
    get lang() { return i18n.lang; },
  },
  run: () => run,
  start: () => startGame(),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => goHome(),
  save: () => Sdk,
  ui: () => ui,
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['switch', 'collect', 'rush']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
  },
  startTutorial: () => startTutorial(),
  debug: {
    state: () => (run ? run.state : null),
    // 截图辅助：注入收集物/障碍/冲刺，保证画面可读、确定性
    spawnPickups() {
      if (!run) return false;
      const items = [['banana', 0, 150], ['shield', 1, 260], ['spark', 0, 370]];
      for (const [k, lane, y] of items) {
        run.state.entities.push({
          kind: k, lane, x: LANES_X[lane], y, vy: 0, size: ENTITY_R[k], t: 0,
        });
      }
      return true;
    },
    spawnObstacles() {
      if (!run) return false;
      const items = [['cactus', 0, 150], ['wasp', 1, 270], ['rock', 1, 390]];
      for (const [k, lane, y] of items) {
        run.state.entities.push({
          kind: k, lane, x: LANES_X[lane], baseX: LANES_X[lane], y, vy: 0, size: ENTITY_R[k], t: 1.5,
        });
      }
      return true;
    },
    forceRush() {
      if (!run) return false;
      run.state.rush = 3;
      run.state.invincible = 3;
      run.state.sparks = 0;
      return true;
    },
    die() {
      if (!run || phase !== 'playing') return false;
      finishRun({ cause: 'cactus' });
      return true;
    },
    endTutorial() {
      tutorialDone = true;
      persist();
      hideTutorial();
      return true;
    },
  },
};

// ---------- 启动 ----------
bind();
syncDocumentLang();
ui.applyLang();
Sdk.track('load', {});
requestAnimationFrame(frame);
