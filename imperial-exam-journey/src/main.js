// src/main.js — 装配：固定步长 / 输入 / 事件分发 / 状态机 / SDK / BGM。
import { STEP } from '../config/game.config.js';
import { createRun } from './game/sim.js';
import { createRender } from './render/index.js';
import { createUI } from './ui/index.js';
import { createAudio } from './core/audio.js';
import { i18n } from './core/i18n.js';
import Sdk from './core/sdk.js';

// ---------- 装配 ----------
const canvas = document.getElementById('canvas');
const uiRoot = document.getElementById('game-container');

const renderer = createRender(canvas);
const audio = createAudio();

// ---------- 状态 ----------
let state = 'boot';             // boot | title | playing | paused | finished
let run = null;
let lastTime = 0;
let accumulator = 0;
let pendingSubmitText = null;
let pendingHint = false;
let bestScore = 0;
let lastRiddleId = -1;

// ---------- UI ----------
const ui = createUI(uiRoot, {
  onStart: () => startGame(),
  onResume: () => resumeGame(),
  onHome: () => toTitle(),
  onPause: () => togglePause(),
  onMute: () => toggleMute(),
  onSubmit: () => submitAnswer(),
  onHint: () => { pendingHint = true; audio.unlock(); },
  save: (k, v) => Sdk.save(k, v),
  load: (k, d) => Sdk.load(k, d),
});

// ---------- 音频 ----------
function applyAudioSettings() {
  const muted = Sdk.load('muted', false);
  audio.setMuted(!!muted);
  ui.els.btnMute.textContent = muted ? '×' : '♪';
}

function toggleMute() {
  const muted = !Sdk.load('muted', false);
  audio.setMuted(muted);
  Sdk.save('muted', muted);
  ui.els.btnMute.textContent = muted ? '×' : '♪';
}

// ---------- 游戏流转 ----------
function startGame() {
  audio.unlock();
  const seed = (Date.now() & 0xffff) * 2654435761 >>> 0;
  run = createRun({ seed, difficulty: ui.getDifficulty() });
  state = 'playing';
  pendingSubmitText = null;
  pendingHint = false;
  lastRiddleId = -1;
  accumulator = 0;
  lastTime = performance.now();
  ui.els.answerInput.value = '';
  ui.show('playing');
  Sdk.newRun({ difficulty: ui.getDifficulty() });
  audio.playBgm('bgm');
  audio.event('start', {});
  applyAudioSettings();
}

function togglePause() {
  if (state === 'playing') { state = 'paused'; ui.show('paused'); }
  else if (state === 'paused') { resumeGame(); }
}

function resumeGame() {
  if (state === 'paused') { state = 'playing'; ui.show('playing'); lastTime = performance.now(); }
}

function toTitle() {
  state = 'title';
  run = null;
  ui.show('title');
  renderer.draw(null, 1);
  audio.stopBgm();
}

function submitAnswer() {
  const val = ui.els.answerInput.value || '';
  if (!val.trim()) return;
  pendingSubmitText = val;
  ui.els.answerInput.value = '';
  audio.unlock();
}

function onFinish() {
  state = 'finished';
  const won = run.stats.wins > 0;
  const score = Math.round(run.score * 10) / 10;
  const isRecord = score > bestScore;
  if (isRecord) {
    bestScore = score;
    Sdk.save('bestScore', bestScore);
  }
  ui.setBest(bestScore);
  ui.show('finished', {
    score,
    totalStars: run.totalStars,
    maxCombo: run.stats.maxCombo,
    riddlesSolved: run.riddlesSolved,
    hintsUsed: run.stats.hintsUsed,
    win: won,
  });
  Sdk.gameOver({ score, win: won, stars: run.totalStars, maxCombo: run.stats.maxCombo });
  audio.stopBgm();
  if (won) audio.playBgm('victory');
}

// ---------- 事件分发 ----------
function dispatchEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);

    if (ev.type === 'answerCorrect') {
      const p = renderer.playerPos(run);
      renderer.burst(p.x, p.y, 'correct');
      if (ev.combo >= 2) toast(i18n.get('toast.combo', { n: ev.combo }));
    } else if (ev.type === 'answerWrong') {
      const p = renderer.playerPos(run);
      renderer.burst(p.x, p.y, 'wrong');
    } else if (ev.type === 'waystation') {
      const p = renderer.playerPos(run);
      renderer.burst(p.x, p.y, 'waystation');
      toast(i18n.get('toast.waystation'));
      Sdk.track('waystation', { level: ev.level });
    } else if (ev.type === 'hintUsed') {
      Sdk.track('hint', {});
    }
  }
}

function showToast(text) {
  let t = uiRoot.querySelector('#toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.className = 'toast';
    uiRoot.appendChild(t);
  }
  t.textContent = text;
  t.classList.remove('show');
  void t.offsetWidth;
  t.classList.add('show');
}

// ---------- 输入 ----------
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'KeyR' && state === 'finished') startGame();
  if (e.code === 'Enter' && state === 'title') startGame();
});

ui.els.answerInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    e.stopPropagation();
    submitAnswer();
  }
});
ui.els.answerInput.addEventListener('input', () => audio.unlock());

// ---------- 主循环 ----------
function loop(now) {
  requestAnimationFrame(loop);

  if (state !== 'playing') {
    renderer.draw(state === 'paused' || state === 'finished' ? run : null, 1);
    return;
  }

  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  accumulator += dt;

  let steps = 0;
  while (accumulator >= STEP && steps < 6) {
    run.step({ submitText: pendingSubmitText, hint: pendingHint });
    pendingSubmitText = null;
    pendingHint = false;
    accumulator -= STEP;
    steps += 1;
    dispatchEvents(run.drainEvents());
    if (run.phase === 'finished') { onFinish(); return; }
  }

  // 新题出现 → 清空输入框与提示卡
  const hud = run.getHud();
  if (hud.current && hud.current.riddleId !== lastRiddleId) {
    lastRiddleId = hud.current.riddleId;
    ui.els.answerInput.value = '';
  }

  renderer.setLastRun(run);
  renderer.draw(run, accumulator / STEP);
  ui.setHud(hud);
}

// ---------- 失焦自动暂停 ----------
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'playing') togglePause();
});

// ---------- 启动 ----------
(async () => {
  bestScore = Math.floor(Sdk.load('bestScore', 0) * 10) / 10 || 0;
  ui.setBest(bestScore);
  applyAudioSettings();
  await Sdk.ready();
  Sdk.track('load', { lang: i18n.lang });
  if (state === 'boot') { state = 'title'; ui.show('title'); }
  renderer.draw(null, 1);
  ui.els.loading.classList.add('hidden');
  lastTime = performance.now();
  requestAnimationFrame(loop);
})();

// ---------- 标准调试契约 ----------
window.G = {
  get run() { return run; },
  ui,
  renderer,
  audio,
  Sdk,
  get state() { return state; },
};

window.__ll = {
  get state() { return { phase: state, lang: i18n.lang, dir: i18n.dir }; },
  lang: () => i18n.lang,
  setLang: (l) => { i18n.setLang(l); ui.applyLang(); },
  get run() { return run; },
  start: startGame,
  pause: togglePause,
  resume: resumeGame,
  restart: toTitle,
  startTutorial: () => {
    const ok = ui.tutorial.begin() || ui.tutorial.replay();
    if (ok) ui.tutorial.overlay.show();
    return ok;
  },
  tutorial: {
    get active() { return ui.tutorial.active; },
    get step() { return ui.tutorial.step; },
    get steps() { return ui.tutorial.steps; },
    get current() { return ui.tutorial.current; },
    skip: () => ui.tutorial.skip(),
  },
  save: () => Sdk.save,
  ui: () => ui,
  debug: { layout: () => ({ viewport: [canvas.clientWidth, canvas.clientHeight] }) },
};
