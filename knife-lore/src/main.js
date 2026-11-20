// src/main.js — 装配：固定步长 / 输入 / 事件分发 / 状态机 / SDK / BGM（Lead 所有）
import { STEP } from '../config/game.config.js';
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
let state = 'boot'; // boot | title | playing | paused | clear | fail | won
let run = null;
let lastTime = 0;
let accumulator = 0;
let throwQueued = false; // 掷刀边沿（点击/空格）
let currentLevel = 1;
let bestLevel = 1;
let bgmPack = null;
let sessionEnded = false;

// ---------- 输入 ----------
function queueThrow() {
  if (state === 'playing') throwQueued = true;
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'Enter') {
    if (state === 'playing') { queueThrow(); e.preventDefault(); }
    else if (state === 'title' && e.code === 'Enter') startGame();
  }
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'KeyZ' && state === 'playing') useZantie();
  if (e.code === 'KeyR' && (state === 'fail')) startGame(currentLevel);
});

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  audio.unlock();
  queueThrow();
});

// ---------- UI ----------
const ui = createUI(uiRoot, {
  onStart: () => startGame(bestLevel),
  onResume: () => resumeGame(),
  onRestart: () => toTitle(),
  onNext: () => { if (currentLevel < 12) startGame(currentLevel + 1); else toTitle(); },
  onRetry: () => startGame(currentLevel),
  onShare: () => shareResult(),
  onHow: () => {},
});
ui.onTutorial((result) => {
  Sdk.track('tutorial_done', { skipped: !!result?.skipped });
});
ui.setBest(bestLevel);

// 斩铁按钮
ui.els.btnZantie.addEventListener('click', (e) => {
  e.stopPropagation();
  audio.unlock();
  useZantie();
});

// ---------- 音频设置 ----------
function applyAudioSettings() {
  const muted = Sdk.load('muted', false);
  const vol = Sdk.load('volume', 0.7);
  audio.setMuted(!!muted);
  audio.setVolume(vol);
}

// ---------- 游戏流转 ----------
function startGame(levelIndex) {
  audio.unlock();
  const lvl = Math.max(1, Math.min(12, Math.round(levelIndex ?? bestLevel)));
  currentLevel = lvl;
  run = createRun({ seed: (Date.now() & 0xffff) * 2654435761 >>> 0, levelIndex: lvl });
  state = 'playing';
  throwQueued = false;
  accumulator = 0;
  lastTime = performance.now();
  ui.show('playing');
  Sdk.newRun({ level: lvl });
  setBgm(run.level.pack);
  applyAudioSettings();
}

function useZantie() {
  if (run && state === 'playing') {
    if (run.useZantie()) {
      audio.event('zantie', {});
      ui.setHud(run.getHud());
    }
  }
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
  setBgm(null);
  Sdk.track('restart', {});
}

function onClear() {
  state = 'clear';
  const level = run.level.index;
  const isNew = level >= bestLevel;
  if (level + 1 > bestLevel) {
    bestLevel = level + 1;
    Sdk.save('bestLevel', bestLevel);
  }
  ui.setBest(bestLevel);
  ui.show('clear', { score: run.score, bonus: level * 25, newLevel: isNew && level < 12 });
  Sdk.levelCleared({ level, score: run.score });
  renderer.triggerSignature();
  setBgm(null);
}

function onFail() {
  state = 'fail';
  ui.show('fail', { score: run.score, best: bestLevel });
  Sdk.gameOver({ level: currentLevel, score: run.score });
  setBgm(null);
}

function onWon() {
  state = 'won';
  if (12 > bestLevel) { bestLevel = 12; Sdk.save('bestLevel', bestLevel); }
  ui.setBest(bestLevel);
  ui.show('won', { score: run.score });
  Sdk.levelCleared({ level: 12, score: run.score });
  renderer.triggerSignature();
  setBgm(null);
}

async function shareResult() {
  const lvl = run ? run.level.index : currentLevel;
  const score = run ? run.score : 0;
  await Sdk.share({
    title: 'KNIFE LORE',
    text: `${i18n.lang === 'zh' ? `我在卷轴道场打到了第 ${lvl} 关，${score} 分！` : `I cleaved to level ${lvl} with ${score} points in KNIFE LORE!`}`,
  });
  Sdk.track('share', { level: lvl });
}

function setBgm(pack) {
  if (bgmPack === pack) return;
  bgmPack = pack;
  audio.stopBgm();
  if (pack) audio.playBgm(pack);
}

// ---------- 事件分发 ----------
function dispatchEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);

    if (ev.type === 'knifeStick') renderer.burst(ev.x, ev.y, 'stick');
    else if (ev.type === 'knifeBreak') { renderer.burst(ev.x, ev.y, 'break'); }
    else if (ev.type === 'symBonus') renderer.burst(ev.x, ev.y, 'signature');

    if (state === 'playing') ui.tutorial.onGameEvent(ev);

    if (ev.type === 'levelCleared') Sdk.track('level_cleared', { level: ev.level });
  }
}

// ---------- 主循环 ----------
function loop(now) {
  requestAnimationFrame(loop);

  if (state !== 'playing') {
    renderer.draw(state === 'paused' || state === 'clear' || state === 'fail' || state === 'won' ? run : null, 1);
    return;
  }

  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  accumulator += dt;

  let steps = 0;
  while (accumulator >= STEP && steps < 6) {
    run.step({ throw: throwQueued });
    throwQueued = false;
    accumulator -= STEP;
    steps += 1;
    dispatchEvents(run.drainEvents());
    if (run.phase === 'failed') { onFail(); return; }
    if (run.phase === 'cleared') { onClear(); return; }
    if (run.phase === 'won') { onWon(); return; }
  }

  renderer.draw(run, accumulator / STEP);
  ui.setHud(run.getHud());
}

// ---------- 失焦自动暂停 ----------
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'playing') togglePause();
  if (document.hidden && !sessionEnded) {
    sessionEnded = true;
    Sdk.track('session_end', {});
  }
});

// ---------- 广告期间静音 ----------
Sdk.onAdStart(() => audio.setMuted(true));
Sdk.onAdEnd(() => { audio.setMuted(!!Sdk.load('muted', false)); });

// ---------- 启动 ----------
(async () => {
  bestLevel = Math.max(1, Math.floor(Sdk.load('bestLevel', 1)) || 1);
  ui.setBest(bestLevel);
  applyAudioSettings();
  await Sdk.ready();
  Sdk.track('load', { lang: i18n.lang });
  // boot 竞态守卫：玩家可能在 boot 期间已点 Start；只在还没开局时才显示标题
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
  start: () => startGame(bestLevel),
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
  debug: {
    layout: () => ({ viewport: [canvas.clientWidth, canvas.clientHeight], zantie: !ui.els.btnZantie.hidden }),
    setTutorialDone: (v) => Sdk.save('tutorial-done', !!v),
    startLevel: (n) => startGame(n),
    stickOne: () => {
      if (state === 'playing' && run) {
        run.step({ throw: true });
        for (let i = 0; i < 40 && run.flying; i += 1) run.step({});
        dispatchEvents(run.drainEvents());
        if (run.phase === 'cleared') onClear();
        else if (run.phase === 'failed') onFail();
      }
    },
    failNow: () => { if (state === 'playing' && run) onFail(); },
    clearNow: () => { if (state === 'playing' && run) onClear(); },
    state: () => (run ? {
      phase: run.phase, level: run.level.index, stuck: run.stuck.length,
      knivesRemaining: run.knivesRemaining, score: run.score, flying: !!run.flying,
    } : null),
  },
};
