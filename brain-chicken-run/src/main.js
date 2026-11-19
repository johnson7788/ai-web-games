// src/main.js — 装配：固定步长 / 输入 / 事件分发 / 状态机 / SDK / BGM。
import { STEP } from '../config/game.config.js';
import { createRun } from './game/sim.js';
import { createRender } from './render/index.js';
import { createUI } from './ui/ui.js';
import { createAudio } from './core/audio.js';
import { i18n, syncDocumentLang } from './core/i18n.js';
import Sdk from './core/sdk.js';

const canvas = document.getElementById('canvas');
const uiRoot = document.getElementById('game-container');
const loadingEl = document.getElementById('loading');

const renderer = createRender(canvas);
const audio = createAudio();

// ---------- 状态 ----------
let state = 'boot';             // boot | title | playing | paused | finished
let run = null;
let lastTime = 0;
let accumulator = 0;
let pendingChoose = null;       // 'true' | 'false' | null
let bestScore = 0;
let muted = false;

// ---------- 输入 ----------
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (state === 'playing' || state === 'paused') togglePause();
  }
  if (e.code === 'KeyR' && state === 'finished') startGame();
  if (e.code === 'Enter' && state === 'title') startGame();
  if (state === 'playing' && run && run.question && !run.question.answered) {
    if (e.code === 'Digit1' || e.code === 'ArrowLeft') pendingChoose = 'true';
    if (e.code === 'Digit2' || e.code === 'ArrowRight') pendingChoose = 'false';
  }
});

// ---------- UI ----------
const ui = createUI(uiRoot, {
  onStart: () => startGame(),
  onResume: () => resumeGame(),
  onRestart: () => startGame(),
  onRetry: () => startGame(),
  onHome: () => toTitle(),
  onPause: () => togglePause(),
  onMute: () => toggleMute(),
  onAnswer: (camp) => { pendingChoose = camp; audio.unlock(); },
  onShare: () => shareResult(),
});
ui.onTutorial((result) => {
  Sdk.track('tutorial_done', { skipped: !!result?.skipped });
});
ui.setBest(bestScore);

// ---------- 音频 ----------
function applyAudioSettings() {
  muted = !!Sdk.load('muted', false);
  const vol = Sdk.load('volume', 0.8);
  audio.setMuted(muted);
  audio.setVolume(vol);
  ui.els.btnMute.textContent = muted ? '🔇' : '🔊';
}
function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  Sdk.save('muted', muted);
  ui.els.btnMute.textContent = muted ? '🔇' : '🔊';
}

// ---------- 流转 ----------
function startGame() {
  audio.unlock();
  run = createRun({ seed: (Date.now() & 0xffff) * 2654435761 >>> 0 });
  state = 'playing';
  pendingChoose = null;
  accumulator = 0;
  lastTime = performance.now();
  ui.show('playing');
  Sdk.newRun({ zone: 1 });
  audio.playBgm();
  applyAudioSettings();
}

function togglePause() {
  if (state === 'playing') { state = 'paused'; ui.show('paused'); audio.setMuted(true); }
  else if (state === 'paused') { resumeGame(); }
}
function resumeGame() {
  if (state !== 'paused') return;
  state = 'playing';
  ui.show('playing');
  audio.setMuted(muted);
  lastTime = performance.now();
}

function toTitle() {
  state = 'title';
  run = null;
  ui.show('title');
  renderer.draw(null, 1);
  audio.stopBgm();
}

function onFinish() {
  state = 'finished';
  const stats = run.stats || {};
  const won = run.mode === 'won';
  const score = stats.score || 0;
  const isRecord = score > bestScore;
  if (isRecord) {
    bestScore = score;
    Sdk.save('bestScore', bestScore);
  }
  ui.setBest(bestScore);
  ui.show('finished', {
    won,
    rank: stats.rank ?? 20,
    score,
    correct: stats.correct || 0,
    maxCombo: stats.maxCombo || 0,
    stars: stats.stars || 0,
    newRecord: isRecord,
  });
  Sdk.gameOver({ won, rank: stats.rank, score, maxCombo: stats.maxCombo });
  audio.stopBgm();
  audio.event(won ? 'win' : 'lose', {});
}

async function shareResult() {
  const stats = run?.stats || {};
  await Sdk.share({
    title: 'BRAIN CHICKEN RUN',
    text: i18n.lang === 'zh'
      ? `我在 BRAIN CHICKEN RUN 里拿到 ${stats.score ?? 0} 分！`
      : `I scored ${stats.score ?? 0} in BRAIN CHICKEN RUN!`,
  });
  Sdk.track('share', { score: stats.score });
}

// ---------- 事件分发 ----------
function dispatchEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);

    const p = renderer.playerPos(run ? run.getHud() : null);
    if (ev.type === 'answerCorrect') renderer.burst(p.x, p.y, 'correct');
    else if (ev.type === 'answerWrong' && !ev.shielded) renderer.burst(p.x, p.y, 'wrong');
    else if (ev.type === 'shieldGain' || ev.type === 'shieldSaved') renderer.burst(p.x, p.y, 'shield');
    else if (ev.type === 'goldenQuestion') renderer.burst(p.x, 120, 'correct');

    if (state === 'playing') ui.tutorial.onGameEvent(ev);

    if (ev.type === 'stageClear') ui.showToast(i18n.get('toast.stage', { n: ev.stage }));
    else if (ev.type === 'lastStanding') ui.showToast(i18n.get('toast.last'));
    else if (ev.type === 'shieldSaved') ui.showToast(i18n.get('q.shieldSaved'));
    else if (ev.type === 'win') Sdk.track('win', { score: run?.stats?.score });
    else if (ev.type === 'lose') Sdk.track('fail', { rank: ev.rank });
    else if (ev.type === 'goldenQuestion') Sdk.track('golden', {});
    else if (ev.type === 'shieldGain') Sdk.track('shield', {});
    else if (ev.type === 'lastStanding') Sdk.track('lastStanding', {});
  }
}

// ---------- 主循环 ----------
function loop(now) {
  requestAnimationFrame(loop);

  if (state === 'title' || state === 'boot') {
    renderer.draw(null, 1);
    return;
  }

  if (state === 'paused' || state === 'finished') {
    renderer.draw(run ? run.getHud() : null, 1);
    return;
  }

  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  accumulator += dt;

  let steps = 0;
  while (accumulator >= STEP && steps < 6) {
    run.step({ hover: null, choose: pendingChoose });
    pendingChoose = null;
    accumulator -= STEP;
    steps += 1;
    dispatchEvents(run.drainEvents());
    if (run.phase === 'finished') { onFinish(); return; }
  }

  const hud = run.getHud();
  renderer.draw(hud, accumulator / STEP);
  ui.setHud(hud);
  ui.tutorial.tick();
}

// ---------- 失焦自动暂停 ----------
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'playing') togglePause();
});

// ---------- SDK ----------
Sdk.onAdStart(() => audio.setMuted(true));
Sdk.onAdEnd(() => audio.setMuted(muted));

// ---------- 启动 ----------
(async () => {
  syncDocumentLang();
  bestScore = Math.floor(Sdk.load('bestScore', 0)) || 0;
  ui.setBest(bestScore);
  applyAudioSettings();
  await Sdk.ready();
  Sdk.track('load', { lang: i18n.lang });
  if (state === 'boot') { state = 'title'; ui.show('title'); }
  renderer.draw(null, 1);
  if (loadingEl) loadingEl.classList.add('hidden');
  lastTime = performance.now();
  requestAnimationFrame(loop);
})();

// ---------- 调试契约 ----------
window.__ll = {
  get state() { return { phase: state, lang: i18n.lang, dir: i18n.dir }; },
  lang: () => i18n.lang,
  setLang: (l) => { i18n.setLang(l); ui.applyLang(); },
  get run() { return run; },
  start: startGame,
  pause: togglePause,
  resume: resumeGame,
  restart: toTitle,
  tutorial: {
    get active() { return ui.tutorial.active; },
    get step() { return ui.tutorial.step; },
    get steps() { return ui.tutorial.steps; },
    get current() { return ui.tutorial.current; },
    skip: () => ui.tutorial.skip(),
  },
  startTutorial: () => ui.tutorial.replay(),
  save: (k, v) => Sdk.save(k, v),
  ui: () => ui,
};

window.G = {
  get run() { return run; },
  ui,
  renderer,
  audio,
  Sdk,
  get state() { return state; },
};
