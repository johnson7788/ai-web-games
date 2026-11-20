// src/main.js — 装配：固定步长 / 输入 / 事件分发 / 状态机 / SDK / 音频（Lead 所有）
import { STEP, WORLD, CONFIG } from '../config/game.config.js';
import { createRun } from './game/sim.js';
import { createRender } from './render/index.js';
import { createUI } from './ui/index.js';
import { createAudio } from './core/audio.js';
import { i18n } from './core/i18n.js';
import Sdk from './core/sdk.js';

const canvas = document.getElementById('canvas');
const uiRoot = document.getElementById('ui-root');
const loadingEl = document.getElementById('loading');

const renderer = createRender(canvas);
const audio = createAudio();

let state = 'boot';            // boot | title | playing | paused | dead | won
let run = null;
let lastTime = 0;
let accumulator = 0;
let bestScore = 0;

// ---------- UI ----------
const ui = createUI(uiRoot, {
  onStart: () => startGame(),
  onResume: () => resumeGame(),
  onRestart: () => startGame(),
  onShare: () => shareResult(),
  onHow: () => {},
  onBet: (i) => { if (state === 'playing' && run) run.toggleBet(i); },
  onRoll: () => { if (state === 'playing' && run) run.roll(); },
  onBank: () => { if (state === 'playing' && run) run.bank(); },
});
ui.onTutorial((result) => {
  Sdk.track('tutorial_done', { skipped: !!result?.skipped });
});
ui.setBest(bestScore);

// ---------- 音频设置 ----------
function applyAudioSettings() {
  const muted = Sdk.load('muted', false);
  const vol = Sdk.load('volume', 0.7);
  audio.setMuted(!!muted);
  audio.setVolume(vol);
}

// ---------- 游戏流转 ----------
function startGame() {
  audio.unlock();
  const runeLevel = Sdk.load('runeLevel', 0);
  run = createRun({
    seed: (Date.now() & 0xffff) * 2654435761 >>> 0,
    runeLevel,
  });
  state = 'playing';
  accumulator = 0;
  lastTime = performance.now();
  ui.show('playing');
  Sdk.newRun({ stage: 1 });
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
}

function onEnd() {
  const score = Math.floor(run.stats.score ?? run.score ?? 0);
  const stage = Math.max(1, run.stats.stageReached ?? (run.stageIndex + 1));
  const isRecord = score > bestScore;
  if (isRecord) {
    bestScore = score;
    Sdk.save('bestScore', bestScore);
  }
  const savedRune = Math.floor(Sdk.load('runeLevel', 0)) || 0;
  const newRune = Math.max(savedRune, run.runeLevel || 0);
  if (newRune > savedRune) Sdk.save('runeLevel', newRune);
  ui.setBest(bestScore);
  state = run.won ? 'won' : 'dead';
  ui.show(state, {
    score,
    stage,
    runeLevel: newRune,
    best: bestScore,
    won: run.won,
    newRecord: isRecord,
  });
  if (run.won) Sdk.levelCleared({ score, stage });
  else Sdk.gameOver({ score, stage });
  audio.stopBgm();
}

async function shareResult() {
  const score = Math.floor(run?.stats?.score ?? 0);
  await Sdk.share({
    title: 'DICE CASCADE',
    text: `${i18n.lang === 'zh' ? `我在概率神殿拿下了 ${score} 分！` : `I scored ${score} in the Dice Cascade temple!`} DICE CASCADE`,
  });
  Sdk.track('share', { score });
}

// ---------- 事件分发 ----------
function dispatchEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);

    if (ev.type === 'beadSettled') {
      const x = 300 + ((980 - 300) / 7) * ((ev.bucket ?? 3) + 0.5);
      renderer.burst(x, 520, ev.gain < 0 ? 'cursed' : 'gold');
    } else if (ev.type === 'runeGain' || ev.type === 'runeLevelUp') {
      renderer.burst(640, 300, 'rune');
    } else if (ev.type === 'triple') {
      renderer.burst(640, 300, 'triple');
    } else if (ev.type === 'stageClear') {
      renderer.burst(640, 360, 'gold');
    }

    if (state === 'playing') ui.tutorial.onGameEvent(ev);

    if (ev.type === 'stageClear') Sdk.track('stageClear', { stage: ev.stage });
    else if (ev.type === 'triple') Sdk.track('triple', { bonus: ev.bonus });
  }
}

// ---------- 主循环 ----------
function loop(now) {
  requestAnimationFrame(loop);

  if (state !== 'playing') {
    renderer.draw((state === 'paused' || state === 'dead' || state === 'won') ? run : null, 1);
    return;
  }

  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  accumulator += dt;

  let steps = 0;
  while (accumulator >= STEP && steps < 6) {
    run.step({});
    accumulator -= STEP;
    steps += 1;
    dispatchEvents(run.drainEvents());
    if (run.phase !== 'playing') { onEnd(); return; }
  }

  renderer.draw(run, accumulator / STEP);
  ui.setHud(run.getHud());
}

// ---------- 键盘 ----------
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'KeyR' && (state === 'dead' || state === 'won')) startGame();
  if (e.code === 'Enter' && state === 'title') startGame();
});

// ---------- 失焦自动暂停 ----------
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'playing') togglePause();
});

// ---------- 广告期间静音 ----------
Sdk.onAdStart(() => audio.setMuted(true));
Sdk.onAdEnd(() => { audio.setMuted(!!Sdk.load('muted', false)); });

// ---------- 启动 ----------
(async () => {
  bestScore = Math.floor(Sdk.load('bestScore', 0)) || 0;
  ui.setBest(bestScore);
  applyAudioSettings();
  await Sdk.ready();
  Sdk.track('load', { lang: i18n.lang });
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
  debug: { layout: () => ({ viewport: [canvas.clientWidth, canvas.clientHeight], bank: !ui.barEls.btnBank.disabled }) },
};
