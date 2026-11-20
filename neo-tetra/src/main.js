// src/main.js — 装配：固定步长 / 输入（键盘 + 触屏滑动）/ 事件分发 / 状态机 / SDK / BGM。
import { STEP } from '../config/game.config.js';
import { createRun, dropResult, clearableRows, clearRows, placeCells } from './game/sim.js';
import { createRender } from './render/index.js';
import { createUI } from './ui/index.js';
import { createAudio } from './core/audio.js';
import { i18n } from './core/i18n.js';
import Sdk from './core/sdk.js';
import { sceneOf } from '../config/levels.js';

// ---------- 装配 ----------
const canvas = document.getElementById('canvas');
const uiRoot = document.getElementById('ui-root');
const loadingEl = document.getElementById('loading');

const renderer = createRender(canvas);
const audio = createAudio();
const ui = createUI(uiRoot, {
  onDive: () => startGame(),
  onResume: () => resumeGame(),
  onRestart: () => startGame(),
  onShare: () => shareResult(),
  onHow: () => {},
  onToggleMute: () => toggleMute(),
});

// ---------- 状态 ----------
let state = 'boot';             // boot | title | playing | paused | dead | won
let run = null;
let lastTime = 0;
let accumulator = 0;
let bestScore = 0;
let muted = false;

const held = { left: false, right: false, softDrop: false };
const edge = { rotateCW: false, rotateCCW: false, hardDrop: false, hold: false };

// ---------- 触屏 ----------
const touch = { startX: 0, startY: 0, startT: 0, moveHeld: 0, softHeld: false, moved: false };
let hasTouch = false;

// ---------- 输入 ----------
function press(act) {
  if (act === 'left') held.left = true;
  else if (act === 'right') held.right = true;
  else if (act === 'softDrop') held.softDrop = true;
  else if (act === 'rotateCW') edge.rotateCW = true;
  else if (act === 'rotateCCW') edge.rotateCCW = true;
  else if (act === 'hardDrop') edge.hardDrop = true;
  else if (act === 'hold') edge.hold = true;
}

function release(act) {
  if (act === 'left') held.left = false;
  else if (act === 'right') held.right = false;
  else if (act === 'softDrop') held.softDrop = false;
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') { press('left'); e.preventDefault(); }
  else if (e.code === 'ArrowRight' || e.code === 'KeyD') { press('right'); e.preventDefault(); }
  else if (e.code === 'ArrowDown' || e.code === 'KeyS') { press('softDrop'); e.preventDefault(); }
  else if (e.code === 'ArrowUp' || e.code === 'KeyX' || e.code === 'KeyW') { press('rotateCW'); e.preventDefault(); }
  else if (e.code === 'KeyZ') { press('rotateCCW'); e.preventDefault(); }
  else if (e.code === 'Space') { press('hardDrop'); e.preventDefault(); }
  else if (e.code === 'KeyC') { press('hold'); e.preventDefault(); }
  else if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  else if (e.code === 'KeyR' && (state === 'dead' || state === 'won')) startGame();
  else if (e.code === 'Enter' && state === 'title') startGame();
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') release('left');
  else if (e.code === 'ArrowRight' || e.code === 'KeyD') release('right');
  else if (e.code === 'ArrowDown' || e.code === 'KeyS') release('softDrop');
});

// 触屏滑动：左右滑 = 移动，下滑 = 软降，点按 = 旋转。
canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (e.pointerType === 'touch') hasTouch = true;
  touch.startX = e.clientX;
  touch.startY = e.clientY;
  touch.startT = performance.now();
  touch.moved = false;
  touch.moveHeld = 0;
  touch.softHeld = false;
});
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'touch') return;
  const dx = e.clientX - touch.startX;
  const dy = e.clientY - touch.startY;
  if (dx > 34) { touch.moveHeld = 1; touch.moved = true; }
  else if (dx < -34) { touch.moveHeld = -1; touch.moved = true; }
  else touch.moveHeld = 0;
  touch.softHeld = dy > 44;
});
canvas.addEventListener('pointerup', (e) => {
  if (e.pointerType !== 'touch') return;
  const dt = performance.now() - touch.startT;
  const dx = e.clientX - touch.startX;
  const dy = e.clientY - touch.startY;
  if (!touch.moved && dt < 300 && Math.hypot(dx, dy) < 12) {
    press('rotateCW'); // 点按 = 旋转
  }
  held.left = held.left && !(touch.moveHeld === -1);
  held.right = held.right && !(touch.moveHeld === 1);
  held.softDrop = held.softDrop && !touch.softHeld;
  touch.moveHeld = 0;
  touch.softHeld = false;
});
canvas.addEventListener('pointercancel', () => {
  touch.moveHeld = 0;
  touch.softHeld = false;
});

// 触屏按钮（coarse 指针显示）：左/右/软降为 held，旋转/暂存/硬降为 edge。
function wireTouchButton(id, act, isHold) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    audio.unlock();
    if (isHold) press(act);
    else press(act);
  });
  if (isHold) {
    btn.addEventListener('pointerup', () => release(act));
    btn.addEventListener('pointercancel', () => release(act));
    btn.addEventListener('pointerleave', () => release(act));
  }
}
wireTouchButton('btn-t-left', 'left', true);
wireTouchButton('btn-t-right', 'right', true);
wireTouchButton('btn-t-soft', 'softDrop', true);
wireTouchButton('btn-t-rotate', 'rotateCW', false);
wireTouchButton('btn-t-hold', 'hold', false);
wireTouchButton('btn-t-drop', 'hardDrop', false);

// ---------- UI ----------
ui.onTutorial((result) => {
  Sdk.track('tutorial_done', { skipped: !!result?.skipped });
});
ui.setBest(bestScore);

// ---------- 音频 ----------
function applyAudioSettings() {
  muted = !!Sdk.load('muted', false);
  const vol = Sdk.load('volume', 0.7);
  audio.setMuted(muted);
  audio.setVolume(vol);
  ui.setMuted(muted);
}
function toggleMute() {
  muted = !muted;
  Sdk.save('muted', muted);
  audio.setMuted(muted);
  ui.setMuted(muted);
}

// ---------- 流转 ----------
function startGame() {
  audio.unlock();
  run = createRun({ seed: (Date.now() & 0xffff) * 2654435761 >>> 0 });
  state = 'playing';
  accumulator = 0;
  lastTime = performance.now();
  ui.show('playing');
  Sdk.newRun({ layer: 1 });
  applyAudioSettings();
  renderer.setScene(sceneOf(1));
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
  renderer.setScene('copper');
  renderer.draw(null, 1);
  audio.stopBgm();
}

function onDeath() {
  state = 'dead';
  const stats = run.stats || {};
  const score = Math.floor(stats.score ?? run.score ?? 0);
  const isRecord = score > bestScore;
  if (isRecord) {
    bestScore = score;
    Sdk.save('bestScore', bestScore);
  }
  ui.setBest(bestScore);
  ui.show('dead', {
    score,
    level: stats.level || run.level || 1,
    layerReached: stats.layerReached || run.layer || 1,
    lines: run.lines || 0,
    best: bestScore,
    newRecord: isRecord,
  });
  Sdk.gameOver({ score, level: stats.level || run.level, layer: stats.layerReached || run.layer, lines: run.lines });
  Sdk.track('session_end', { score, lines: run.lines, layer: stats.layerReached || run.layer });
  audio.stopBgm();
  audio.event('death', {});
  audio.event('newRecord', {}); // 非新纪录也轻响，主音效在 death
}

function onWin() {
  state = 'won';
  const score = Math.floor(run.score ?? 0);
  if (score > bestScore) {
    bestScore = score;
    Sdk.save('bestScore', bestScore);
  }
  ui.setBest(bestScore);
  ui.show('won', { score });
  Sdk.levelCleared({ score, layer: 12 });
  Sdk.track('session_end', { score, lines: run.lines, layer: 12, won: true });
  audio.stopBgm();
  audio.event('win', {});
}

async function shareResult() {
  const score = Math.floor(run?.stats?.score ?? 0);
  await Sdk.share({
    title: 'NEO TETRA',
    text: i18n.lang === 'zh'
      ? `我在熔炉里炼到了 ${score} 分！NEO TETRA`
      : `I smelted ${score} points in the furnace! NEO TETRA`,
  });
  Sdk.track('share', { score });
}

// ---------- 事件分发 ----------
function dispatchEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);

    // 视觉粒子
    if (ev.type === 'lineClear') {
      // 在活动块附近爆粒子（用井中央偏下近似）
      renderer.burst(640, 360, ev.n === 4 ? 'tetra' : 'clear');
    }

    // 教程
    if (state === 'playing') ui.tutorial.onGameEvent(ev, performance.now());

    // 关键埋点
    if (ev.type === 'lineClear') Sdk.track('lineClear', { n: ev.n });
    else if (ev.type === 'tetra') Sdk.track('tetra', {});
    else if (ev.type === 'layerEnter') Sdk.track('layerEnter', { layer: ev.layer });
  }
}

// ---------- BGM 切换（场景包 / 白热态） ----------
let bgmMode = null;
function setBgm(mode) {
  if (bgmMode === mode) return;
  bgmMode = mode;
  audio.playBgm(mode);
}

// ---------- 主循环 ----------
function loop(now) {
  requestAnimationFrame(loop);

  if (state !== 'playing') {
    renderer.draw(state === 'paused' || state === 'dead' || state === 'won' ? run : null, 1);
    return;
  }

  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  accumulator += dt;

  let steps = 0;
  while (accumulator >= STEP && steps < 6) {
    const input = {
      moveLeft: held.left || touch.moveHeld === -1,
      moveRight: held.right || touch.moveHeld === 1,
      softDrop: held.softDrop || touch.softHeld,
      rotateCW: edge.rotateCW,
      rotateCCW: edge.rotateCCW,
      hardDrop: edge.hardDrop,
      hold: edge.hold,
    };
    edge.rotateCW = edge.rotateCCW = edge.hardDrop = edge.hold = false;

    run.step(input);
    accumulator -= STEP;
    steps += 1;
    dispatchEvents(run.drainEvents());
    if (run.phase === 'dead') { onDeath(); return; }
    if (run.phase === 'won') { onWin(); return; }
  }

  const hud = run.getHud();
  setBgm(hud.whiteHot ? 'whiteHot' : hud.scene);
  renderer.draw(run, accumulator / STEP);
  ui.setHud(hud);
  ui.tutorial.tick(performance.now());
}

// ---------- 失焦自动暂停 ----------
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'playing') togglePause();
});

// ---------- 广告期间静音 ----------
Sdk.onAdStart(() => audio.setMuted(true));
Sdk.onAdEnd(() => { audio.setMuted(muted); });

// ---------- 启动 ----------
(async () => {
  bestScore = Math.floor(Sdk.load('bestScore', 0)) || 0;
  ui.setBest(bestScore);
  applyAudioSettings();
  await Sdk.ready();
  Sdk.track('load', { lang: i18n.lang });
  // boot 竞态守卫：SDK 异步加载窗口内可能已点 Start，只在还没开局时才显示标题
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
  sim: { dropResult, clearableRows, clearRows, placeCells },
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
  save: () => Sdk.save,
  ui: () => ui,
  tutorial: {
    get active() { return ui.tutorial.active; },
    get step() { return ui.tutorial.step; },
    get steps() { return ui.tutorial.steps; },
    get current() { return ui.tutorial.current; },
    skip: () => ui.tutorial.skip(),
  },
  debug: { layout: () => ({ viewport: [canvas.clientWidth, canvas.clientHeight], touch: hasTouch }) },
};
