// src/main.js — 装配：固定步长 / 输入 / 事件分发 / 状态机 / SDK / 教程 / 程序化 BGM
import { STEP, CONFIG } from '../config/game.config.js';
import { createRun } from './game/sim.js';
import { createRender } from './render/index.js';
import { createUI } from './ui/index.js';
import { createAudio } from './core/audio.js';
import { i18n } from './core/i18n.js';
import Sdk from './core/sdk.js';

const canvas = document.getElementById('canvas');
const renderer = createRender(canvas);
const audio = createAudio();

let state = 'boot';        // boot | title | playing | paused | victory | dead
let run = null;
let lastTime = 0;
let accumulator = 0;
let bestStars = 0;

// 输入：held（方向） + press（边沿动作）
const keys = { left: false, right: false };
const press = { jump: false, attack: false, dash: false, special: false };

function buildInput() {
  const touch = ui.getTouch();
  return {
    left: keys.left || touch.left,
    right: keys.right || touch.right,
    jump: press.jump,
    attack: press.attack,
    dash: press.dash,
    special: press.special,
  };
}
function clearPress() {
  press.jump = press.attack = press.dash = press.special = false;
}

// ---------- UI ----------
const ui = createUI(document.getElementById('game-container'), {
  onStart: () => startGame(),
  onResume: () => resumeGame(),
  onRestart: () => startGame(),
  onHome: () => toTitle(),
  onRetry: () => startGame(),
  onHow: () => { ui.tutorial.show(); },
  onMute: () => { const m = audio.setMuted(!Sdk.load('muted', false)); Sdk.save('muted', m); ui.setMuted(m); },
  onLang: (l) => { i18n.setLang(l); ui.applyLang(); },
  onAct: (act) => { if (act === 'jump') press.jump = true; else if (act === 'attack') press.attack = true; else if (act === 'dash') press.dash = true; else if (act === 'special') press.special = true; },
  onUnlock: () => audio.unlock(),
}, { save: Sdk });

ui.tutorial.onDone(() => Sdk.track('tutorial_done', { skipped: true }));

// ---------- 键盘 ----------
window.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;
  if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') { press.jump = true; e.preventDefault(); }
  if (e.code === 'KeyJ' || e.code === 'KeyZ') press.attack = true;
  if (e.code === 'KeyK' || e.code === 'KeyX') press.dash = true;
  if (e.code === 'KeyL' || e.code === 'KeyC') press.special = true;
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'KeyR' && (state === 'dead' || state === 'victory')) startGame();
  if ((e.code === 'Enter' || e.code === 'Space') && state === 'title') startGame();
  audio.unlock();
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
});

// 触屏/点击任意处解锁音频
canvas.addEventListener('pointerdown', () => audio.unlock());

// ---------- 游戏流转 ----------
function startGame() {
  audio.unlock();
  run = createRun({ seed: (Date.now() & 0xffff) * 2654435761 >>> 0 });
  state = 'playing';
  accumulator = 0;
  lastTime = performance.now();
  clearPress();
  ui.show('playing');
  ui.setHud(run.getHud());
  Sdk.newRun({ level: 1 });
  audio.playBgm();
  const muted = Sdk.load('muted', false);
  audio.setMuted(!!muted);
  ui.setMuted(!!muted);
  // 首次进入显示交互引导（可跳过/可重看）
  if (!ui.tutorial.isDone()) ui.tutorial.show();
}

function togglePause() {
  if (state === 'playing') { state = 'paused'; ui.show('paused'); audio.stopBgm(); }
  else if (state === 'paused') resumeGame();
}
function resumeGame() {
  if (state === 'paused') {
    state = 'playing';
    ui.show('playing');
    lastTime = performance.now();
    audio.playBgm();
  }
}
function toTitle() {
  state = 'title';
  run = null;
  ui.tutorial.hide();
  ui.show('title');
  renderer.draw(null, 1);
  audio.stopBgm();
}

function onEnd(victory) {
  state = victory ? 'victory' : 'dead';
  const stars = run.stars;
  if (stars > bestStars) { bestStars = stars; Sdk.save('bestStars', bestStars); }
  ui.setBest(bestStars);
  ui.show(victory ? 'victory' : 'dead', { stars, score: run.score, bestCombo: run.player.bestCombo });
  if (victory) Sdk.levelCleared({ level: run.level, stars });
  else Sdk.gameOver({ level: run.level });
  audio.stopBgm();
}

// ---------- 事件分发 ----------
function dispatchEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    ui.tutorial.onGameEvent(ev);
    if (ev.type === 'levelStart') Sdk.track('levelStart', { level: ev.level });
    else if (ev.type === 'levelClear') Sdk.track('levelClear', { level: ev.level, stars: ev.stars });
  }
}

// ---------- 关卡横幅 ----------
function updateBanner() {
  if (!run) return;
  if (run.levelClearT >= 0) {
    ui.setBanner(i18n.lang === 'zh' ? `第 ${run.level} 关 · 清空！` : `DISTRICT ${run.level} CLEARED`);
  } else if (run.levelIntroT > 0) {
    ui.setBanner(i18n.lang === 'zh' ? `第 ${run.level} 关 — 清光所有敌人` : `DISTRICT ${run.level} — DEFEAT ALL FOES`);
  } else {
    ui.setBanner('');
  }
}

// ---------- 主循环 ----------
function loop(now) {
  requestAnimationFrame(loop);

  if (state !== 'playing') {
    renderer.draw(state === 'paused' || state === 'victory' || state === 'dead' ? run : null, 1);
    return;
  }

  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  accumulator += dt;

  let steps = 0;
  while (accumulator >= STEP && steps < 6) {
    run.step(buildInput());
    clearPress();
    accumulator -= STEP;
    steps += 1;

    dispatchEvents(run.drainEvents());

    if (run.phase === 'victory') { onEnd(true); return; }
    if (run.phase === 'dead') { onEnd(false); return; }
  }

  updateBanner();
  renderer.draw(run, accumulator / STEP);
  ui.setHud(run.getHud());
  ui.tutorial.tick(run);
}

// ---------- 失焦自动暂停 ----------
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'playing') togglePause();
});

// ---------- 启动 ----------
(async () => {
  bestStars = Math.floor(Sdk.load('bestStars', 0)) || 0;
  ui.setBest(bestStars);
  ui.applyLang();
  const muted = Sdk.load('muted', false);
  audio.setMuted(!!muted);
  ui.setMuted(!!muted);
  await Sdk.ready();
  Sdk.track('load', { lang: i18n.lang });
  if (state === 'boot') { state = 'title'; ui.show('title'); }
  renderer.draw(null, 1);
  lastTime = performance.now();
  requestAnimationFrame(loop);
})();

// ---------- 标准调试契约 ----------
window.G = {
  get run() { return run; },
  get state() { return state; },
  ui,
  renderer,
  audio,
  Sdk,
};

window.__ll = {
  get state() { return { phase: state, lang: i18n.lang, dir: i18n.dir }; },
  lang: () => i18n.lang,
  setLang: (l) => { i18n.setLang(l); ui.applyLang(); },
  get run() { return run; },
  start: startGame,
  startTutorial: () => { ui.tutorial.show(); },
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
  save: () => Sdk,
  ui: () => ui,
};
