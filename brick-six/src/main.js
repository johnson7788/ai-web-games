// src/main.js — 装配：固定步长 / 输入 / 事件分发 / 状态机 / SDK / BGM。
import { STEP, WORLD } from '../config/game.config.js';
import { scenePackOf } from '../config/gameplay.js';
import { axialToXY } from './game/hex.js';
import { createRun } from './game/sim.js';
import { createRender } from './render/index.js';
import { createUI } from './ui/index.js';
import { createAudio } from './core/audio.js';
import { i18n } from './core/i18n.js';
import Sdk from './core/sdk.js';

const canvas = document.getElementById('canvas');
const uiRoot = document.getElementById('ui-root');
const loadingEl = document.getElementById('loading');
const btnRotate = document.getElementById('btn-rotate');

const renderer = createRender(canvas);
const audio = createAudio();

// ---------- 状态 ----------
let state = 'boot';              // boot | title | playing | paused | dead
let run = null;
let lastTime = 0;
let accumulator = 0;
let bestScore = 0;
let bgmScene = 'spring';
let hover = null;                // 当前悬停格索引
let kbCell = { q: 0, r: 0 };     // 键盘光标（轴向）

const pending = { select: null, rotate: false, drop: false };

// ---------- 坐标换算 ----------
function canvasToCell(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(rect.width / WORLD.WIDTH, rect.height / WORLD.HEIGHT);
  const ox = (rect.width - WORLD.WIDTH * scale) / 2;
  const oy = (rect.height - WORLD.HEIGHT * scale) / 2;
  const wx = (clientX - rect.left - ox) / scale;
  const wy = (clientY - rect.top - oy) / scale;
  return worldToCell(wx, wy);
}

function worldToCell(wx, wy) {
  const dx = wx - WORLD.BOARD_X;
  const dy = wy - WORLD.BOARD_Y;
  const size = WORLD.HEX_SIZE;
  const qf = (Math.sqrt(3) / 3 * dx - (1 / 3) * dy) / size;
  const rf = (2 / 3 * dy) / size;
  const { q, r } = cubeRound(qf, -qf - rf, rf);
  if (!run) return null;
  const idx = run.indexByCoord.get(`${q},${r}`);
  if (idx == null) return null;
  if (run.cells[idx].wall) return null;
  return idx;
}

function cubeRound(x, y, z) {
  let rx = Math.round(x);
  let ry = Math.round(y);
  let rz = Math.round(z);
  const dx = Math.abs(rx - x);
  const dy = Math.abs(ry - y);
  const dz = Math.abs(rz - z);
  if (dx > dy && dx > dz) rx = -ry - rz;
  else if (dy > dz) ry = -rx - rz;
  else rz = -rx - ry;
  return { q: rx, r: rz };
}

function cellWorldPos(idx) {
  const c = run.cells[idx];
  if (!c) return { x: WORLD.BOARD_X, y: WORLD.BOARD_Y };
  const p = axialToXY(c.q, c.r, WORLD.HEX_SIZE);
  return { x: WORLD.BOARD_X + p.x, y: WORLD.BOARD_Y + p.y };
}

// ---------- 键盘 ----------
const KEY_DIR = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  KeyD: [1, 0],
  KeyW: [0, -1],
  KeyS: [0, 1],
};

function setKbHover(q, r) {
  kbCell = { q, r };
  if (!run) return;
  const idx = run.indexByCoord.get(`${q},${r}`);
  if (idx != null && !run.cells[idx].wall) hover = idx;
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') { togglePause(); return; }
  if (e.code === 'Enter' && state === 'title') { startGame(); return; }
  if (e.code === 'KeyR' && state === 'dead') { startGame(); return; }
  if (state !== 'playing') return;
  if (KEY_DIR[e.code]) {
    const [dq, dr] = KEY_DIR[e.code];
    setKbHover(kbCell.q + dq, kbCell.r + dr);
    e.preventDefault();
  } else if (e.code === 'Space' || e.code === 'Enter') {
    audio.unlock();
    pending.drop = true;
    e.preventDefault();
  } else if (e.code === 'KeyR' || e.code === 'KeyX') {
    pending.rotate = true;
  } else if (e.code === 'Tab' || e.code === 'KeyE' || e.code === 'KeyQ') {
    if (run && run.shapes.length) pending.select = (run.selected + 1) % run.shapes.length;
    e.preventDefault();
  } else if (e.code.startsWith('Digit')) {
    const n = Number(e.code.slice(5));
    if (run && run.shapes[n - 1]) pending.select = n - 1;
  }
});

// ---------- 指针 ----------
canvas.addEventListener('pointermove', (e) => {
  if (state !== 'playing' || !run) return;
  const idx = canvasToCell(e.clientX, e.clientY);
  if (idx != null) {
    hover = idx;
    kbCell = { q: run.cells[idx].q, r: run.cells[idx].r };
  }
});

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (state !== 'playing' || !run) return;
  const idx = canvasToCell(e.clientX, e.clientY);
  if (idx != null) {
    hover = idx;
    kbCell = { q: run.cells[idx].q, r: run.cells[idx].r };
    pending.drop = true;
  }
});

btnRotate.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  audio.unlock();
  if (state === 'playing') pending.rotate = true;
});

// 触屏旋转按钮在粗指针设备显示
if (window.matchMedia && matchMedia('(pointer: coarse)').matches) btnRotate.hidden = false;

// ---------- UI ----------
const ui = createUI(uiRoot, {
  onDive: () => startGame(),
  onResume: () => resumeGame(),
  onRestart: () => startGame(),
  onShare: () => shareResult(),
  onHow: () => {},
  rotateBtn: btnRotate,
});
ui.onTutorial((result) => {
  Sdk.track('tutorial_done', { skipped: !!result?.skipped });
});

function applyAudioSettings() {
  audio.setMuted(!!Sdk.load('muted', false));
  audio.setVolume(Sdk.load('volume', 0.7));
}

// ---------- 游戏流转 ----------
function startGame() {
  audio.unlock();
  run = createRun({ seed: (Date.now() & 0xffff) * 2654435761 >>> 0 });
  state = 'playing';
  hover = null;
  kbCell = { q: 0, r: 0 };
  pending.select = null;
  pending.rotate = false;
  pending.drop = false;
  accumulator = 0;
  lastTime = performance.now();
  ui.show('playing');
  Sdk.newRun({ zone: 1 });
  setBgm(scenePackOf(run.tier));
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

function onDeath() {
  state = 'dead';
  const stats = run.stats || {};
  const score = Math.floor(run.score ?? 0);
  const isRecord = score > bestScore;
  if (isRecord) {
    bestScore = score;
    Sdk.save('bestScore', bestScore);
  }
  ui.setBest(bestScore);
  ui.show('dead', {
    score,
    tier: stats.tierReached || run.tier || 1,
    cascadeCount: stats.cascadeCount || 0,
    maxCombo: stats.maxCombo || 0,
    best: bestScore,
    newRecord: isRecord,
  });
  Sdk.gameOver({ score, tier: stats.tierReached || run.tier || 1 });
  setBgm('none');
}

async function shareResult() {
  const score = Math.floor(run?.score ?? 0);
  await Sdk.share({
    title: 'BRICK SIX',
    text: i18n.lang === 'zh' ? `我在蜂巢工坊拿到了 ${score} 分！BRICK SIX` : `I scored ${score} in the honeycomb workshop! BRICK SIX`,
  });
  Sdk.track('share', { score });
}

function setBgm(scene) {
  if (bgmScene === scene) return;
  bgmScene = scene;
  audio.stopBgm();
  if (scene === 'spring') audio.playBgm('bgm');
  else if (scene === 'honey') audio.playBgm('bgmHoney');
  else if (scene === 'winter') audio.playBgm('bgmWinter');
}

// ---------- 事件分发 ----------
function dispatchEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);

    if (ev.type === 'clear') {
      const ids = ev.cellIds || [];
      const n = Math.min(ids.length, 12);
      for (let i = 0; i < n; i += 1) {
        const p = cellWorldPos(ids[i]);
        renderer.burst(p.x, p.y, 'clear');
      }
    } else if (ev.type === 'cascade') {
      renderer.burst(WORLD.BOARD_X, WORLD.BOARD_Y, 'cascade');
    } else if (ev.type === 'waxBreak' || ev.type === 'pollenSpread') {
      const p = cellWorldPos(ev.cell);
      renderer.burst(p.x, p.y, 'clear');
    }

    if (state === 'playing') ui.tutorial.onGameEvent(ev);

    if (ev.type === 'place') Sdk.track('place', {});
    else if (ev.type === 'clear') Sdk.track('clear', { lines: ev.lines });
    else if (ev.type === 'cascade') Sdk.track('cascade', {});
    else if (ev.type === 'tierUp') Sdk.track('tierUp', { tier: ev.tier });
    else if (ev.type === 'wax') Sdk.track('wax', {});
    else if (ev.type === 'pollen') Sdk.track('pollen', {});
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
    run.step({
      select: pending.select,
      rotate: pending.rotate,
      hover,
      drop: pending.drop,
    });
    pending.select = null;
    pending.rotate = false;
    pending.drop = false;
    accumulator -= STEP;
    steps += 1;
    dispatchEvents(run.drainEvents());
    if (run.phase === 'dead') { onDeath(); return; }
  }

  // 换章切 BGM
  const scene = scenePackOf(run.tier);
  setBgm(scene);

  const hud = run.getHud();
  hud.best = bestScore;
  renderer.draw(run, accumulator / STEP);
  ui.setHud(hud);
}

// ---------- 失焦自动暂停 ----------
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'playing') togglePause();
});

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
  debug: {
    layout: () => ({ viewport: [canvas.clientWidth, canvas.clientHeight], rotate: !btnRotate.hidden }),
    dropAt: (slot, rot, anchor) => run?.debugPlace(slot, rot, anchor) ?? false,
    cellScreen: (idx) => cellWorldPos(idx),
  },
};
