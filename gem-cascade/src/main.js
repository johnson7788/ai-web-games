// src/main.js — 装配：固定步长 / 输入（点选/矿镐/淘洗）/ 事件分发 / 状态机 / SDK / 程序化 BGM。
import { STEP, WORLD, CONFIG } from '../config/game.config.js';
import { PICKAXE } from '../config/gameplay.js';
import { createRun, componentAt, allComponents } from './game/sim.js';
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

let state = 'boot';          // boot | title | playing | paused | dead | won
let run = null;
let lastTime = 0;
let accumulator = 0;
let queuedAction = null;
let pickMode = false;        // 矿镐武装：下一次点选 = 劈碎
let bestLevel = 1;
let bgmMode = 'none';

const ui = createUI(uiRoot, {
  onStart: () => startGame(),
  onResume: () => resumeGame(),
  onRestart: () => startGame(),
  onShare: () => shareResult(),
  onHow: () => {},
});
ui.onTutorial((result) => {
  Sdk.track('tutorial_done', { skipped: !!result?.skipped });
});
ui.setBest(bestLevel);

// ---------- 坐标换算（与 renderer 的 letterbox 一致） ----------
function canvasToWorld(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(rect.width / WORLD.WIDTH, rect.height / WORLD.HEIGHT);
  const ox = (rect.width - WORLD.WIDTH * scale) / 2;
  const oy = (rect.height - WORLD.HEIGHT * scale) / 2;
  return { x: (clientX - rect.left - ox) / scale, y: (clientY - rect.top - oy) / scale };
}

function worldToCell(wx, wy) {
  const x = Math.floor((wx - WORLD.BOARD_X) / WORLD.CELL);
  const y = Math.floor((wy - WORLD.BOARD_Y) / WORLD.CELL);
  if (x < 0 || x >= 10 || y < 0 || y >= 10) return null;
  return { x, y };
}

function cellCenterWorld(cx, cy) {
  return {
    x: WORLD.BOARD_X + cx * WORLD.CELL + WORLD.CELL / 2,
    y: WORLD.BOARD_Y + cy * WORLD.CELL + WORLD.CELL / 2,
  };
}

// ---------- 输入 ----------
canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (state !== 'playing') return;
  const w = canvasToWorld(e.clientX, e.clientY);
  const cell = worldToCell(w.x, w.y);
  if (!cell) return;
  if (pickMode) {
    queuedAction = { action: 'pick', x: cell.x, y: cell.y };
    pickMode = false;
    renderer.setPickMode(false);
  } else {
    queuedAction = { action: 'tap', x: cell.x, y: cell.y };
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (state !== 'playing' || !run) { renderer.setHover(null); return; }
  const w = canvasToWorld(e.clientX, e.clientY);
  const cell = worldToCell(w.x, w.y);
  if (!cell) { renderer.setHover(null); return; }
  const cells = componentAt(run.grid, run.frozen, cell.x, cell.y);
  renderer.setHover(cells.length >= 2 ? cells : null);
});

canvas.addEventListener('pointerleave', () => renderer.setHover(null));

ui.hud.els.pick.addEventListener('click', () => {
  audio.unlock();
  if (state !== 'playing' || !run) return;
  if (run.charge >= PICKAXE.MAX_CHARGE) {
    pickMode = !pickMode;
    renderer.setPickMode(pickMode);
    audio.event('ui', {});
  }
});

ui.hud.els.wash.addEventListener('click', () => {
  audio.unlock();
  if (state !== 'playing' || !run) return;
  queuedAction = { action: 'wash' };
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'KeyR' && (state === 'dead' || state === 'won')) startGame();
  if (e.code === 'Enter' && state === 'title') startGame();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'playing') togglePause();
});

// ---------- 流转 ----------
function startGame() {
  audio.unlock();
  run = createRun({ seed: (Date.now() & 0xffff) * 2654435761 >>> 0 });
  state = 'playing';
  pickMode = false;
  renderer.setPickMode(false);
  accumulator = 0;
  lastTime = performance.now();
  ui.setBest(bestLevel);
  ui.show('playing');
  Sdk.newRun({ level: 1 });
  setBgm('main');
  applyAudioSettings();
}

function togglePause() {
  if (state === 'playing') { state = 'paused'; ui.show('paused'); setBgm('quiet'); }
  else if (state === 'paused') { resumeGame(); }
}

function resumeGame() {
  if (state === 'paused') { state = 'playing'; ui.show('playing'); lastTime = performance.now(); setBgm('main'); }
}

function toTitle() {
  state = 'title';
  run = null;
  pickMode = false;
  renderer.setPickMode(false);
  renderer.setHover(null);
  ui.show('title');
  renderer.draw(null, 1);
  setBgm('quiet');
  Sdk.track('restart', {});
}

function onEnd() {
  const won = run.phase === 'won';
  state = won ? 'won' : 'dead';
  const level = run.level || 1;
  const isRecord = level > bestLevel;
  if (isRecord) {
    bestLevel = level;
    Sdk.save('bestLevel', bestLevel);
  }
  ui.setBest(bestLevel);
  ui.show('dead', {
    score: run.score,
    level,
    best: bestLevel,
    win: won,
    newRecord: isRecord,
  });
  setBgm('quiet');
}

// ---------- 音频 ----------
function applyAudioSettings() {
  const muted = Sdk.load('muted', false);
  const vol = Sdk.load('volume', 0.8);
  audio.setMuted(!!muted);
  audio.setVolume(vol);
}

async function shareResult() {
  const level = run ? run.level : 1;
  await Sdk.share({
    title: 'GEM CASCADE',
    text: i18n.lang === 'zh' ? `我打到了第 ${level} 关！GEM CASCADE` : `I reached level ${level} in GEM CASCADE!`,
  });
  Sdk.track('share', { level });
}

function setBgm(mode) {
  if (bgmMode === mode) return;
  bgmMode = mode;
  audio.stopBgm();
  if (mode === 'main') audio.playBgm('main');
  else if (mode === 'quiet') audio.playBgm('quiet');
}

// ---------- 事件分发 ----------
function dispatchEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);

    if (ev.type === 'pop') {
      const c = cellCenterWorld(ev.x, ev.y);
      renderer.burst(c.x, c.y, ev.avalanche ? 'avalanche' : 'pop');
    } else if (ev.type === 'avalanche') {
      const c = cellCenterWorld(ev.x, ev.y);
      renderer.burst(c.x, c.y, 'avalanche');
    } else if (ev.type === 'pickUse') {
      const c = cellCenterWorld(ev.x, ev.y);
      renderer.burst(c.x, c.y, 'pop');
    } else if (ev.type === 'wash' || ev.type === 'thaw') {
      renderer.burst(WORLD.BOARD_X + WORLD.BOARD_SIZE / 2, WORLD.BOARD_Y + WORLD.BOARD_SIZE / 2, 'pop');
    }

    if (state === 'playing') ui.tutorial.onGameEvent(ev);

    if (ev.type === 'levelClear') Sdk.levelCleared({ level: ev.level, score: ev.score });
    else if (ev.type === 'win') { Sdk.levelCleared({ level: ev.level, score: ev.score }); Sdk.track('session_end', {}); }
    else if (ev.type === 'fail') Sdk.gameOver({ level: ev.level, score: ev.score });
    else if (ev.type === 'avalanche') Sdk.track('avalanche', { n: ev.n });
  }
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
    run.step(queuedAction || {});
    queuedAction = null;
    accumulator -= STEP;
    steps += 1;
    dispatchEvents(run.drainEvents());
    if (run.phase !== 'playing') { onEnd(); break; }
  }

  renderer.draw(run, accumulator / STEP);
  ui.setHud(run.getHud());
}

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
  // boot 竞态守卫：异步 SDK 就绪期间玩家可能已点 Start
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
  startAct: startGame,
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
      board: [WORLD.BOARD_X, WORLD.BOARD_Y, WORLD.BOARD_SIZE, WORLD.BOARD_SIZE],
      lang: i18n.lang,
    }),
    popAt: (x, y) => { if (run && state === 'playing') { queuedAction = { action: 'tap', x, y }; } },
    pickAt: (x, y) => { if (run && state === 'playing') { queuedAction = { action: 'pick', x, y }; } },
    popLargest: () => {
      if (run && state === 'playing') {
        const comps = allComponents(run.grid, run.frozen);
        if (comps.length) queuedAction = { action: 'tap', x: comps[0].x, y: comps[0].y };
      }
    },
    setTutorialDone: (v) => {
      Sdk.save('tutorial-done', !!v);
      ui.tutorial.machine.done = !!v;
      ui.tutorial.machine.active = false;
      ui.tutorial.overlay.hide();
    },
    startSeeded: (level, seed) => {
      run = createRun({ seed: seed >>> 0, startLevel: level });
      state = 'playing';
      pickMode = false;
      renderer.setPickMode(false);
      accumulator = 0;
      lastTime = performance.now();
      ui.show('playing');
      Sdk.newRun({ level });
      setBgm('main');
      applyAudioSettings();
    },
  },
};
