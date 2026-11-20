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
let state = 'boot';             // boot | title | playing | paused | dead
let run = null;
let lastTime = 0;
let accumulator = 0;
let pendingAction = null;
let bgmMode = 'none';
let bestScore = 0;
let bestWeapons = 0;

// ---------- UI ----------
const ui = createUI(uiRoot, {
  onDive: () => startGame(),
  onResume: () => resumeGame(),
  onRestart: () => startGame(),
  onShare: () => shareResult(),
  onHow: () => { /* 重看引导 */ },
  onPick: (idx) => {
    audio.unlock();
    if (state === 'playing') pendingAction = { pick: idx };
  },
  onHint: () => {
    audio.unlock();
    if (state === 'playing') pendingAction = { hint: true };
  },
  onReset: () => {
    audio.unlock();
    if (state === 'playing') pendingAction = { reset: true };
  },
  onMute: (m) => {
    audio.setMuted(m);
    Sdk.save('muted', m);
  },
});
ui.onTutorial((result) => {
  Sdk.track('tutorial_done', { skipped: !!result?.skipped });
});
ui.setBest(bestScore);
ui.setForge(bestWeapons);

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
  run = createRun({ seed: (Date.now() & 0xffff) * 2654435761 >>> 0, lang: i18n.lang });
  state = 'playing';
  pendingAction = null;
  accumulator = 0;
  lastTime = performance.now();
  ui.show('playing');
  Sdk.newRun({ zone: 1 });
  setBgm('bgm' + run.getHud().scene);
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
  setBgm('none');
}

function onGameOver() {
  state = 'dead';
  const stats = run.getStats();
  const score = Math.floor(stats.score);
  const isRecord = score > bestScore;
  if (isRecord) {
    bestScore = score;
    Sdk.save('bestScore', bestScore);
  }
  const weapons = stats.weaponsForged;
  if (weapons > bestWeapons) {
    bestWeapons = weapons;
    Sdk.save('bestWeapons', bestWeapons);
  }
  const bestCombo = Math.max(stats.maxCombo || 0, Sdk.load('bestCombo', 0));
  Sdk.save('bestCombo', bestCombo);
  ui.setBest(bestScore);
  ui.setForge(bestWeapons);
  const won = run.phase === 'won';
  ui.show('dead', {
    won,
    score,
    level: stats.levelReached,
    maxCombo: stats.maxCombo || 0,
    weapons,
    best: bestScore,
    newRecord: isRecord,
  });
  Sdk.gameOver({ score, level: stats.levelReached, weapons, won });
  setBgm('none');
}

// ---------- BGM 切换 ----------
async function shareResult() {
  const stats = run ? run.getStats() : { score: 0 };
  await Sdk.share({
    title: 'IDIOM FORGE',
    text: `${i18n.lang === 'zh' ? `我铸成了 ${stats.weaponsForged} 件神兵，得分 ${stats.score}！` : `I forged ${stats.weaponsForged} weapons and scored ${stats.score}!`} IDIOM FORGE`,
  });
  Sdk.track('share', { score: stats.score });
}

function setBgm(mode) {
  if (bgmMode === mode) return;
  bgmMode = mode;
  audio.stopBgm();
  if (mode === 'bgm0' || mode === 'bgm1' || mode === 'bgm2') audio.playBgm(mode);
}

// ---------- 事件分发 ----------
function dispatchEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);

    if (ev.type === 'forge') renderer.forge(ev.weapon);

    if (state === 'playing') ui.tutorial.onGameEvent(ev, performance.now());

    if (ev.type === 'levelClear') Sdk.levelCleared({ level: ev.level });
    else if (ev.type === 'forge') Sdk.track('forge', { weapon: ev.weapon, index: ev.index });
    else if (ev.type === 'riddle') Sdk.track('riddle', {});
  }
}

// ---------- 主循环 ----------
function loop(now) {
  requestAnimationFrame(loop);

  if (state !== 'playing') {
    renderer.draw(state === 'paused' || state === 'dead' ? run : null, 1);
    return;
  }

  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  accumulator += dt;

  let steps = 0;
  while (accumulator >= STEP && steps < 6) {
    const action = pendingAction;
    pendingAction = null;
    run.step(action || {});
    accumulator -= STEP;
    steps += 1;
    dispatchEvents(run.drainEvents());
    if (run.phase !== 'playing') { onGameOver(); return; }
  }

  const hud = run.getHud();
  setBgm('bgm' + hud.scene);
  renderer.draw(run, accumulator / STEP);
  ui.setHud(hud);
  ui.tutorial.tick(performance.now());
}

// ---------- 失焦自动暂停 ----------
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'playing') togglePause();
});

// ---------- 键盘 ----------
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'KeyR' && state === 'dead') startGame();
  if (e.code === 'Enter' && state === 'title') startGame();
});

// ---------- 广告期间静音 ----------
Sdk.onAdStart(() => audio.setMuted(true));
Sdk.onAdEnd(() => { audio.setMuted(!!Sdk.load('muted', false)); });

// ---------- 启动 ----------
(async () => {
  bestScore = Math.floor(Sdk.load('bestScore', 0)) || 0;
  bestWeapons = Math.floor(Sdk.load('bestWeapons', 0)) || 0;
  ui.setBest(bestScore);
  ui.setForge(bestWeapons);
  applyAudioSettings();
  await Sdk.ready();
  Sdk.track('load', { lang: i18n.lang });
  // 玩家可能在 boot 期间已点 Forge（异步 SDK 加载窗口）；只在还没开局时才显示标题
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
  debug: { layout: () => ({ viewport: [canvas.clientWidth, canvas.clientHeight] }) },
};
