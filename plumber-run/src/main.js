// src/main.js — 装配：固定步长 / 输入 / 事件分发 / 状态机 / SDK / BGM / 调试契约
import { STEP } from '../config/game.config.js';
import { createRun } from './game/sim.js';
import { createRender } from './render/index.js';
import { createUI } from './ui/index.js';
import { createAudio } from './core/audio.js';
import { i18n } from './core/i18n.js';
import Sdk from './core/sdk.js';

const canvas = document.getElementById('canvas');
const uiRoot = document.getElementById('ui-root');
const loadingEl = document.getElementById('loading');
const touchBar = document.getElementById('touch-bar');

const renderer = createRender(canvas);
const audio = createAudio();

let state = 'boot'; // boot | title | playing | paused | dead | win
let run = null;
let lastTime = 0;
let accumulator = 0;
let bestLevel = 1;
let bgmTheme = 0;

const input = { left: false, right: false, jumpHeld: false, wrenchHeld: false, steamHeld: false };
let botInput = null; // 录屏/自动玩测试用：非空时覆盖键盘输入

// ---------- 输入（边沿检测归 sim：这里只维护按住布尔） ----------
function bindKey(code, set) {
  return (e) => {
    if (e.code === code) {
      set(true);
      if (['Space', 'ArrowUp', 'ArrowDown'].includes(code)) e.preventDefault();
      audio.unlock();
    }
  };
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') input.left = true;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') input.right = true;
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') { input.jumpHeld = true; e.preventDefault(); }
  if (e.code === 'KeyJ') input.wrenchHeld = true;
  if (e.code === 'KeyK' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.steamHeld = true;
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'KeyR' && (state === 'dead' || state === 'win')) startGame();
  if (e.code === 'Enter' && state === 'title') startGame();
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') input.left = false;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') input.right = false;
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') input.jumpHeld = false;
  if (e.code === 'KeyJ') input.wrenchHeld = false;
  if (e.code === 'KeyK' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.steamHeld = false;
});

// 触屏按钮（粗指针设备显示）
function bindTouchButton(id, key) {
  const el = document.getElementById(id);
  if (!el) return;
  const on = (e) => { e.preventDefault(); audio.unlock(); input[key] = true; };
  const off = () => { input[key] = false; };
  el.addEventListener('pointerdown', on);
  el.addEventListener('pointerup', off);
  el.addEventListener('pointercancel', off);
  el.addEventListener('pointerleave', off);
}
bindTouchButton('btn-left', 'left');
bindTouchButton('btn-right', 'right');
bindTouchButton('btn-jump', 'jumpHeld');
bindTouchButton('btn-wrench', 'wrenchHeld');
bindTouchButton('btn-steam', 'steamHeld');

if (window.matchMedia && matchMedia('(pointer: coarse)').matches) {
  touchBar.classList.remove('hidden');
}

// ---------- UI ----------
const ui = createUI(uiRoot, {
  onStart: () => startGame(),
  onResume: () => resumeGame(),
  onRestart: () => startGame(),
  onShare: () => shareResult(),
});
ui.onTutorial((result) => {
  Sdk.track('tutorial_done', { skipped: !!result?.skipped });
});
ui.setBest(bestLevel);

function applyAudioSettings() {
  const muted = Sdk.load('muted', false);
  const vol = Sdk.load('volume', 0.8);
  audio.setMuted(!!muted);
  audio.setVolume(vol);
}

// ---------- 游戏流转 ----------
function startGame() {
  audio.unlock();
  run = createRun({ seed: (Date.now() & 0xffff) * 2654435761 >>> 0, level: 1 });
  state = 'playing';
  accumulator = 0;
  lastTime = performance.now();
  input.left = input.right = input.jumpHeld = input.wrenchHeld = input.steamHeld = false;
  ui.show('playing');
  Sdk.newRun({ zone: 1 });
  applyAudioSettings();
  setBgm(themeForLevel(run.level));
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
  setBgm(0);
}

function themeForLevel(level) {
  return Math.floor((level - 1) / 4) + 1; // 1/2/3
}

function onDeath() {
  state = 'dead';
  const stats = run.stats || {};
  const level = stats.levelsReached || 1;
  const isRecord = level > bestLevel;
  if (isRecord) { bestLevel = level; Sdk.save('bestLevel', bestLevel); }
  ui.setBest(bestLevel);
  ui.show('dead', {
    level,
    coins: run.coins,
    score: run.score,
    best: bestLevel,
    stars: run.stars,
    newRecord: isRecord,
    win: false,
  });
  Sdk.gameOver({ level, coins: run.coins, score: run.score });
  setBgm(0);
}

function onWin() {
  state = 'win';
  const level = run.stats.levelsReached || 12;
  const isRecord = true;
  bestLevel = Math.max(bestLevel, level);
  Sdk.save('bestLevel', bestLevel);
  ui.setBest(bestLevel);
  ui.show('dead', {
    level,
    coins: run.coins,
    score: run.score,
    best: bestLevel,
    stars: run.stars,
    newRecord: isRecord,
    win: true,
  });
  Sdk.levelCleared({ level: 12, score: run.score, stars: run.stars });
  Sdk.track('session_end', { win: true });
  setBgm(0);
}

async function shareResult() {
  const level = run?.stats?.levelsReached ?? 1;
  await Sdk.share({
    title: 'PLUMBER RUN',
    text: i18n.lang === 'zh' ? `我修到了第 ${level} 关！` : `I fixed my way to level ${level}! PLUMBER RUN`,
  });
  Sdk.track('share', { level });
}

function setBgm(theme) {
  if (bgmTheme === theme) return;
  bgmTheme = theme;
  audio.stopBgm();
  if (theme > 0) audio.playBgm(theme);
}

// ---------- 事件分发 ----------
function dispatchEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    if (ev.type === 'brickBreak') renderer.setShake(4);
    if (ev.type === 'death') renderer.setShake(8);
    if (ev.type === 'hit') renderer.setShake(5);
    if (state === 'playing') ui.tutorial.onGameEvent(ev);

    if (ev.type === 'levelClear') Sdk.track('levelClear', { level: ev.level, stars: ev.stars });
    else if (ev.type === 'stomp') Sdk.track('stomp', {});
    else if (ev.type === 'coin') Sdk.track('coin', {});
    else if (ev.type === 'powerUp') Sdk.track('powerUp', { kind: ev.kind });
    else if (ev.type === 'wrenchThrow') Sdk.track('wrenchThrow', {});
  }
}

// ---------- 主循环 ----------
function loop(now) {
  requestAnimationFrame(loop);

  if (state !== 'playing' && state !== 'paused') {
    renderer.draw(state === 'paused' ? run : null, 1);
    return;
  }

  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  accumulator += dt;

  if (state === 'playing') {
    let steps = 0;
    while (accumulator >= STEP && steps < 6) {
      const beforeLevel = run.level;
      const beforeTheme = themeForLevel(beforeLevel);
      run.step(botInput ? botInput(run) : input);
      accumulator -= STEP;
      steps += 1;
      dispatchEvents(run.drainEvents());

      if (run.phase === 'dead') { onDeath(); return; }
      if (run.phase === 'win') { onWin(); return; }
      if (themeForLevel(run.level) !== beforeTheme) setBgm(themeForLevel(run.level));
    }
  }

  renderer.draw(run, accumulator / STEP);
  ui.setHud(run.getHud());
  const steamFull = run.getHud().steam >= 100;
  const btnSteam = document.getElementById('btn-steam');
  if (btnSteam) btnSteam.classList.toggle('ready', steamFull);
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
  bestLevel = Math.max(1, Math.floor(Sdk.load('bestLevel', 1)) || 1);
  ui.setBest(bestLevel);
  applyAudioSettings();
  await Sdk.ready();
  Sdk.track('load', { lang: i18n.lang });
  // boot 竞态守卫：异步 SDK 加载窗口内点了 Start 也不覆盖
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
  debug: {
    layout: () => ({
      viewport: [canvas.clientWidth, canvas.clientHeight],
      touch: !touchBar.classList.contains('hidden'),
    }),
    startLevel: (n) => {
      run = createRun({ seed: (Date.now() & 0xffff) * 2654435761 >>> 0, level: n });
      state = 'playing';
      accumulator = 0;
      lastTime = performance.now();
      ui.show('playing');
      setBgm(themeForLevel(run.level));
    },
    placePlayer: (x) => {
      if (run) { run.player.x = x; run.cameraX = Math.max(0, Math.min(x - 1280 * 0.42, run.width * 45 - 1280)); }
    },
    setBot: (fn) => { botInput = fn; },
    setTutorialDone: () => {
      Sdk.save('tutorial-done', true);
      ui.tutorial.machine.done = true;
      ui.tutorial.overlay.hide();
    },
  },
};
