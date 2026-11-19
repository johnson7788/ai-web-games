// SKY STRIKE 1942 · 主入口：60Hz 固定步长 + 标题/游戏/暂停/结算 + 教程 + SDK 统一出口
import { STEP, WORLD } from '../config/game.config.js';
import { createRun } from './game/sim.js';
import { createRenderer } from './render/index.js';
import { createAudio } from './core/audio.js';
import { ui } from './ui/ui.js';
import { i18n, syncDocumentLang } from './core/i18n.js';
import Sdk from './core/sdk.js';

const canvas = document.getElementById('canvas');
const renderer = createRenderer(canvas);
const audio = createAudio();

let run = null;
let phase = 'title'; // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let tutorialStep = -1; // -1 = 未激活
let pointerDown = false;
let frozen = false;
const kb = { up: false, down: false, left: false, right: false };

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let best = Sdk.load('best', 0) | 0;
let tutorialDone = !!Sdk.load('tutorialDone', false);

Sdk.ready();
Sdk.onAdStart(() => { if (phase === 'playing') pauseGame(true); });
Sdk.onAdEnd(() => { if (phase === 'paused') resumeGame(); });
audio.setMuted(muted);
ui.setMuted(muted);

function persist() {
  Sdk.save('muted', muted);
  Sdk.save('best', best);
  Sdk.save('tutorialDone', tutorialDone);
}

// ---------- 阶段状态机 ----------
function setPhase(p) { phase = p; }

function startRun(levelIndex = 0, seed) {
  run = createRun(levelIndex | 0, { seed: seed == null ? ((Date.now() % 2147483647) || 1) : seed });
  setPhase('playing');
  ui.showGame();
  ui.hideResult();
  {
    const h = document.getElementById('action-hint');
    if (h) { h.classList.remove('hidden'); h.style.opacity = '1'; clearTimeout(h._t); h._t = setTimeout(() => { h.style.opacity = '0'; }, 6000); }
  }
  updateHud();
  audio.startBgm();
  Sdk.track('start', { level: run.state.level });
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
  if (run) Sdk.track('restart', {});
  startRun(0);
}

function goHome() {
  run = null;
  setPhase('title');
  ui.showTitle();
  ui.hideResult();
  updateBestLabel();
}

// ---------- HUD / 结算 ----------
function updateHud() {
  if (!run) return;
  const h = run.getHud();
  ui.el.hudScore.textContent = `${i18n.get('score')} ${h.score}`;
  ui.el.hudLevel.textContent = `${i18n.get('level')} ${h.level}`;
  ui.el.hudKills.textContent = `${i18n.get('target')} ${h.kills}/${h.killTarget}`;
  ui.el.hudCombo.textContent = `${i18n.get('combo')} ${h.combo}`;
  ui.el.hudCombo.classList.toggle('combo-hot', h.combo >= 5);
  ui.el.hudLives.textContent = '♥'.repeat(Math.max(0, h.lives));
}

function updateBestLabel() {
  ui.el.bestScore.textContent = `${i18n.get('bestLabel')} ${best}`;
}

function showResult({ won, stars, score }) {
  const e = ui.el;
  const isNewBest = won && score > best && best > 0;
  if (won && score > best) best = score;
  persist();
  e.resultTitle.textContent = won ? i18n.get('resultWin') : i18n.get('resultLose');
  e.resultTitle.classList.toggle('lose', !won);
  e.resultStars.innerHTML = won
    ? `<span class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>`
    : '';
  e.resultScore.textContent = `${i18n.get('scoreLabel')} ${score}`;
  e.resultBest.textContent = `${i18n.get('bestLabel')} ${best}`;
  e.resultNewBest.classList.toggle('hidden', !isNewBest);
  e.btnNext.style.display = 'none';
  ui.showResult();
}

function finishRun(ev) {
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  const won = ev.type === 'win';
  const stars = won ? (ev.stars || run.state.stars || 1) : 0;
  const score = run.state.score;
  Sdk.track(won ? 'win' : 'fail', { level: run.state.level, score, stars });
  showResult({ won, stars, score });
  audio.event(won ? 'win' : 'lose');
}

// ---------- 教程引导 ----------
const TUT_STEPS = () => [
  { text: i18n.get('tutStep1'), trigger: 'move' },
  { text: i18n.get('tutStep2'), trigger: 'kill' },
  { text: i18n.get('tutStep3'), trigger: 'powerup' },
];

function renderTutorialStep() {
  const el = ui.el.tutorial;
  if (tutorialStep < 0) {
    el.classList.add('hidden');
    return;
  }
  const s = TUT_STEPS()[tutorialStep];
  el.classList.remove('hidden');
  ui.el.tutText.textContent = s ? s.text : '';
}

function startTutorial() {
  tutorialStep = 0;
  renderTutorialStep();
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
  if (tutorialStep < 0 || tutorialStep >= TUT_STEPS().length) return;
  if (TUT_STEPS()[tutorialStep].trigger !== evType) return;
  tutorialStep += 1;
  if (tutorialStep >= TUT_STEPS().length) endTutorial();
  else renderTutorialStep();
}

// ---------- 事件消费 ----------
function handleEvents(events) {
  for (const ev of events) {
    // 炸弹使用独立音效
    if (ev.type === 'powerup' && ev.kind === 'bomb') {
      audio.event('boom');
    } else if (ev.type !== 'spawn' && ev.type !== 'rock' && ev.type !== 'powerupSpawn') {
      audio.event(ev.type, ev);
    }
    if (ev.type === 'move') tutorialAdvance('move');
    else if (ev.type === 'kill') tutorialAdvance('kill');
    else if (ev.type === 'powerup') tutorialAdvance('powerup');
    else if (ev.type === 'win' || ev.type === 'lose') {
      finishRun(ev);
      return;
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
  pointerDown = true;
  canvas.setPointerCapture(e.pointerId);
  const p = canvasPos(e);
  run.setTarget(p.x, p.y);
  tutorialAdvance('move');
});

canvas.addEventListener('pointermove', (e) => {
  if (!run || phase !== 'playing' || !pointerDown) return;
  const p = canvasPos(e);
  run.setTarget(p.x, p.y);
});

canvas.addEventListener('pointerup', () => { pointerDown = false; });
canvas.addEventListener('pointercancel', () => { pointerDown = false; });

window.addEventListener('keydown', (e) => {
  audio.unlock();
  const k = e.code;
  if (k === 'ArrowLeft' || k === 'KeyA') kb.left = true;
  else if (k === 'ArrowRight' || k === 'KeyD') kb.right = true;
  else if (k === 'ArrowUp' || k === 'KeyW') kb.up = true;
  else if (k === 'ArrowDown' || k === 'KeyS') kb.down = true;
  else if (k === 'Escape' || k === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  } else if (k === 'KeyR') {
    if (phase === 'playing' || phase === 'paused' || phase === 'result') restartRun();
  } else if (k === 'KeyM') {
    toggleMute();
  }
});

window.addEventListener('keyup', (e) => {
  const k = e.code;
  if (k === 'ArrowLeft' || k === 'KeyA') kb.left = false;
  else if (k === 'ArrowRight' || k === 'KeyD') kb.right = false;
  else if (k === 'ArrowUp' || k === 'KeyW') kb.up = false;
  else if (k === 'ArrowDown' || k === 'KeyS') kb.down = false;
});

function applyKeyboard() {
  if (!run || phase !== 'playing' || pointerDown) return;
  if (!kb.left && !kb.right && !kb.up && !kb.down) return;
  const h = run.state.hero;
  const step = 60;
  run.setTarget(h.x + (kb.right ? step : 0) - (kb.left ? step : 0), h.y + (kb.down ? step : 0) - (kb.up ? step : 0));
}

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  ui.setMuted(muted);
  persist();
}

// ---------- UI 绑定 ----------
function bind() {
  const on = (id, fn) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', () => { audio.unlock(); fn(); });
  };
  on('btn-start', () => {
    startRun(0);
    if (!tutorialDone) startTutorial();
  });
  on('btn-resume', resumeGame);
  on('btn-restart2', restartRun);
  on('btn-retry', restartRun);
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-help', () => { if (phase === 'playing' || phase === 'result') startTutorial(); });
  on('btn-howto-title', startTutorial);
  on('btn-tut-replay', () => { if (phase === 'paused') resumeGame(); startTutorial(); });
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);

  const btnRestart = document.getElementById('btn-restart');
  if (btnRestart) btnRestart.addEventListener('click', () => { audio.unlock(); restartRun(); });

  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = document.getElementById(id);
    if (!sel) continue;
    sel.addEventListener('change', () => {
      ui.setLang(sel.value);
      renderTutorialStep();
      updateHud();
      updateBestLabel();
    });
  }
}

// ---------- 主循环 ----------
function frame(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;

  if (phase === 'playing' && run && !frozen) {
    applyKeyboard();
    accumulator += dt;
    while (accumulator >= STEP) {
      run.step(STEP);
      accumulator -= STEP;
      if (phase !== 'playing') break;
    }
    if (run && run.state.phase !== 'playing') handleEvents(run.drainEvents());
    else if (run) handleEvents(run.drainEvents());
    if (run && phase === 'playing') updateHud();
  }

  renderer.draw(run ? run.state : null);
  requestAnimationFrame(frame);
}

// ---------- 调试契约（截图/验收脚本通用） ----------
window.__ll = {
  state: {
    get phase() { return phase; },
    get lang() { return i18n.lang; },
  },
  run: () => run,
  start: (i) => startRun(i == null ? 0 : i),
  startAct: (i) => startRun(i),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => goHome(),
  home: () => goHome(),
  sim: () => (run ? run.state : null),
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['move', 'shoot', 'dodge']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
  },
  startTutorial: () => startTutorial(),
  save: () => Sdk,
  ui: () => ui,
  debug: {
    state: () => (run ? { ...run.getHud(), phase: run.state.phase } : null),
    spawnEnemy: (type) => (run ? run._spawnEnemy(type || 1) : null),
    spawnRock: () => (run ? run._spawnRock() : null),
    spawnPowerup: (type) => (run ? run._spawnPowerup(type || 'spread') : null),
    setCombo: (n) => { if (run) { run.state.combo = n | 0; run.state.comboTimer = 2.6; } },
    setScore: (n) => { if (run) run.state.score = n | 0; },
    forceWin: () => {
      if (!run) return;
      run.state.phase = 'won';
      run.state.stars = 3;
      run.state.score = Math.max(run.state.score, 1500);
      finishRun({ type: 'win', stars: 3 });
    },
    forceLose: () => {
      if (!run) return;
      run.state.phase = 'lost';
      finishRun({ type: 'lose' });
    },
    freeze: () => { frozen = true; },
    unfreeze: () => { frozen = false; },
    startSeeded: (i, seed) => { frozen = false; startRun(i, seed); return true; },
  },
};

// ---------- 启动 ----------
bind();
ui.init();
syncDocumentLang();
ui.applyLang();
updateBestLabel();
ui.showTitle();
Sdk.track('load', {});
requestAnimationFrame(frame);
