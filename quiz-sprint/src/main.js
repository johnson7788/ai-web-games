// src/main.js — 装配：固定步长 / 输入 / 事件分发 / 状态机 / SDK / BGM（Lead 所有）
import { STEP, WORLD } from '../config/game.config.js';
import { createRun } from './game/sim.js';
import { createRender } from './render/index.js';
import { createUI } from './ui/index.js';
import { createAudio } from './core/audio.js';
import { i18n } from './core/i18n.js';
import Sdk from './core/sdk.js';

// ---------- 装配 ----------
const canvas = document.getElementById('canvas');
const uiRoot = document.getElementById('ui-root');
const loadingEl = document.getElementById('loading');

const renderer = createRender(canvas);
const audio = createAudio();

// ---------- 状态 ----------
let state = 'boot';             // boot | title | playing | paused | finished
let run = null;
let lastTime = 0;
let accumulator = 0;
let hover = null;               // 指针当前悬浮的选项下标（0-3 或 null）
let pendingChoose = null;       // 作答提交（0-3 | 'skip' | null，消费一次）
let bestWins = 0;

// ---------- 输入（边沿检测归 main） ----------
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'KeyR' && state === 'finished') startGame();
  if (e.code === 'Enter' && state === 'title') startGame();
  // 数字键 1-4 快捷作答（桌面可玩性）
  if (state === 'playing' && run && run.question && !run.question.answered) {
    const idx = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code);
    if (idx >= 0) pendingChoose = idx;
  }
});

// ---------- UI ----------
const ui = createUI(uiRoot, {
  onStart: () => startGame(),
  onResume: () => resumeGame(),
  onRestart: () => startGame(),
  onShare: () => shareResult(),
  onHow: () => { /* 重看引导已在 UI 内部处理 */ },
  onAnswer: (i) => { pendingChoose = i; audio.unlock(); },
  onSkip: () => { pendingChoose = 'skip'; audio.unlock(); },
  onHover: (i) => { hover = i; },
});
ui.onTutorial((result) => {
  Sdk.track('tutorial_done', { skipped: !!result?.skipped });
});
ui.setBest(bestWins);

// ---------- 音频设置持久化 ----------
function applyAudioSettings() {
  const muted = Sdk.load('muted', false);
  const vol = Sdk.load('volume', 0.8);
  audio.setMuted(!!muted);
  audio.setVolume(vol);
}

// ---------- 游戏流转 ----------
function startGame() {
  audio.unlock();
  run = createRun({ seed: (Date.now() & 0xffff) * 2654435761 >>> 0 });
  state = 'playing';
  hover = null;
  pendingChoose = null;
  accumulator = 0;
  lastTime = performance.now();
  ui.show('playing');
  Sdk.newRun({ zone: 1 });
  audio.playBgm('bgm');
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

function onFinish() {
  state = 'finished';
  const stats = run.stats || {};
  const wins = stats.wins || 0;
  const isRecord = wins > bestWins;
  if (isRecord) {
    bestWins = wins;
    Sdk.save('bestWins', bestWins);
  }
  ui.setBest(bestWins);
  ui.show('finished', {
    wins,
    bestRank: stats.bestRank ?? 4,
    maxCombo: stats.maxCombo || 0,
    best: bestWins,
    newRecord: isRecord,
  });
  Sdk.gameOver({ wins, bestRank: stats.bestRank, maxCombo: stats.maxCombo });
  audio.stopBgm();
}

function showToast(text) {
  let t = uiRoot.querySelector('#race-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'race-toast';
    t.className = 'race-toast';
    uiRoot.appendChild(t);
  }
  t.textContent = text;
  t.classList.remove('show');
  void t.offsetWidth;
  t.classList.add('show');
}

// ---------- 分享 ----------
async function shareResult() {
  const wins = run?.stats?.wins ?? 0;
  await Sdk.share({
    title: 'QUIZ SPRINT',
    text: `${i18n.lang === 'zh' ? `我在知识马拉松里拿了 ${wins} 胜！` : `I won ${wins} races in the knowledge marathon!`} QUIZ SPRINT`,
  });
  Sdk.track('share', { wins });
}

// ---------- 事件分发 ----------
function dispatchEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);

    if (ev.type === 'answerCorrect') {
      const p = renderer.playerPos(run);
      renderer.burst(p.x, p.y, 'correct');
    } else if (ev.type === 'answerWrong') {
      const p = renderer.playerPos(run);
      renderer.burst(p.x, p.y, 'wrong');
    } else if (ev.type === 'scholarSprint' && ev.on) {
      const p = renderer.playerPos(run);
      renderer.burst(p.x, p.y, 'scholar');
    } else if (ev.type === 'raceFinish') {
      const txt = ev.won ? i18n.get('race.win', { n: ev.level }) : i18n.get('race.lose', { n: ev.level, rank: ev.rank });
      showToast(txt);
    }

    if (state === 'playing') ui.tutorial.onGameEvent(ev, performance.now());

    if (ev.type === 'raceFinish') Sdk.track('raceWin', { level: ev.level, won: ev.won, rank: ev.rank });
    else if (ev.type === 'wagerReveal') Sdk.track('wager', { category: ev.category });
    else if (ev.type === 'scholarSprint' && ev.on) Sdk.track('scholarSprint', { level: run.level });
  }
}

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
    run.step({ hover, choose: pendingChoose });
    pendingChoose = null;
    accumulator -= STEP;
    steps++;
    dispatchEvents(run.drainEvents());
    if (run.phase === 'finished') { onFinish(); return; }
  }

  renderer.setLastRun(run);
  renderer.draw(run, accumulator / STEP);
  ui.setHud(run.getHud());
  ui.tutorial.tick(performance.now());
}

// ---------- 失焦自动暂停 ----------
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'playing') togglePause();
});

// ---------- 广告期间静音 ----------
Sdk.onAdStart(() => audio.setMuted(true));
Sdk.onAdEnd(() => { audio.setMuted(!!Sdk.load('muted', false)); });

// ---------- 启动 ----------
(async () => {
  bestWins = Math.floor(Sdk.load('bestWins', 0)) || 0;
  ui.setBest(bestWins);
  applyAudioSettings();
  await Sdk.ready();
  Sdk.track('load', { lang: i18n.lang });
  // 玩家可能在 boot 期间已点 Start（异步 SDK 加载窗口）；只在还没开局时才显示标题
  if (state === 'boot') { state = 'title'; ui.show('title'); }
  renderer.draw(null, 1);
  loadingEl.classList.add('hidden');
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
  tutorial: {
    get active() { return ui.tutorial.active; },
    get step() { return ui.tutorial.step; },
    get steps() { return ui.tutorial.steps; },
    get current() { return ui.tutorial.current; },
    skip: () => ui.tutorial.skip(),
  },
  save: () => Sdk.save,
  ui: () => ui,
  debug: { layout: () => ({ viewport: [canvas.clientWidth, canvas.clientHeight], question: !ui.hud.questionPanel.classList.contains('hidden') }) },
};
