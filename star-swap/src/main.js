// src/main.js — STAR SWAP 装配：输入 / 事件分发 / 状态机 / 固定步长 / SDK / BGM（Lead 所有）
import { STEP, WORLD, CONFIG } from '../config/game.config.js';
import { createRun } from './game/sim.js';
import { areAdjacent, findValidSwaps } from './game/board.js';
import { createRender } from './render/index.js';
import { createUI } from './ui/index.js';
import { createAudio } from './core/audio.js';
import { i18n } from './core/i18n.js';
import Sdk from './core/sdk.js';

// ---------- 装配 ----------
const canvas = document.getElementById('canvas');
const uiRoot = document.getElementById('ui-root');
const loadingEl = document.getElementById('loading');
const container = document.getElementById('game-container');

const renderer = createRender(canvas);
const audio = createAudio();
const ui = createUI(uiRoot, {
  onStart: () => startGame(),
  onResume: () => resumeGame(),
  onRestart: () => startGame(),
  onShare: () => shareResult(),
  onLensToggle: () => setLensMode(!lensMode),
});

// ---------- 状态 ----------
let state = 'boot';          // boot | title | playing | paused | dead | win
let run = null;
let lastTime = 0;
let accumulator = 0;
let selected = null;         // 常规交换：已选中的格索引
let lensMode = false;        // 引力透镜模式
let lensPick = null;         // 透镜模式下选中的第一格
let bestScore = 0;

function setLensMode(on) {
  lensMode = !!on;
  lensPick = null;
  selected = null;
  renderer.setLens(null);
  renderer.setSelection(null);
  ui.hud.setLensMode(lensMode);
}

// ---------- 输入：指针 → 格索引 ----------
function canvasToCell(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  const wx = ((clientX - rect.left) / rect.width) * WORLD.WIDTH;
  const wy = ((clientY - rect.top) / rect.height) * WORLD.HEIGHT;
  const L = renderer.layout();
  const c = Math.floor((wx - L.x) / (L.cell + L.gap));
  const r = Math.floor((wy - L.y) / (L.cell + L.gap));
  if (r < 0 || r >= L.rows || c < 0 || c >= L.cols) return null;
  const cx = L.x + c * (L.cell + L.gap);
  const cy = L.y + r * (L.cell + L.gap);
  if (wx > cx + L.cell || wy > cy + L.cell) return null;
  return r * L.cols + c;
}

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (state !== 'playing' || !run) return;
  const i = canvasToCell(e.clientX, e.clientY);
  if (i == null) return;

  if (lensMode) {
    if (lensPick == null) {
      lensPick = i;
      renderer.setLens({ a: i, b: null });
      renderer.setSelection(null);
    } else if (lensPick === i) {
      lensPick = null;
      renderer.setLens(null);
    } else {
      doSwap({ lens: { a: lensPick, b: i } });
      setLensMode(false);
    }
    return;
  }

  if (selected == null) {
    selected = i;
    renderer.setSelection(i);
  } else if (selected === i) {
    selected = null;
    renderer.setSelection(null);
  } else if (areAdjacent(selected, i)) {
    doSwap({ swap: { a: selected, b: i } });
    selected = null;
    renderer.setSelection(null);
  } else {
    selected = i;
    renderer.setSelection(i);
  }
});
canvas.addEventListener('pointerleave', () => { renderer.setHover(null); });
canvas.addEventListener('pointermove', (e) => {
  if (state !== 'playing' || !run) return;
  const i = canvasToCell(e.clientX, e.clientY);
  renderer.setHover(i);
});

// ---------- 键盘 ----------
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'Enter' && state === 'title') startGame();
  if (e.code === 'KeyR' && (state === 'dead' || state === 'win')) startGame();
});

// ---------- UI ----------
ui.onTutorial((result) => Sdk.track('tutorial_done', { skipped: !!result?.skipped }));
ui.setBest(bestScore);

function applyAudioSettings() {
  audio.setMuted(!!Sdk.load('muted', false));
  audio.setVolume(Sdk.load('volume', 0.8));
}

// ---------- 游戏流转 ----------
function startGame() {
  startGameAt(1);
}

function startGameAt(level) {
  audio.unlock();
  run = createRun({ seed: (Date.now() & 0xffff) * 2654435761 >>> 0, startLevel: level });
  state = 'playing';
  selected = null;
  setLensMode(false);
  accumulator = 0;
  lastTime = performance.now();
  ui.show('playing');
  ui.setHud(run.getHud());
  Sdk.newRun({ zone: level });
  applyAudioSettings();
  audio.playBgm('bgm');
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
  selected = null;
  setLensMode(false);
  ui.show('title');
  renderer.draw(null, 1);
  audio.stopBgm();
}

function onRunEnd() {
  const win = run.phase === 'win';
  const score = run.score;
  const level = run.level;
  const isRecord = score > bestScore;
  if (isRecord) { bestScore = score; Sdk.save('best', bestScore); }
  ui.setBest(bestScore);

  state = win ? 'win' : 'dead';
  ui.show(win ? 'win' : 'dead', {
    win,
    score,
    level,
    stars: win ? 3 : ratingStars(score, run.target),
    best: bestScore,
    newRecord: isRecord,
  });
  renderer.draw(run, 1);
  if (win) Sdk.levelCleared({ level, score });
  else Sdk.gameOver({ level, score });
  audio.stopBgm();
}

function ratingStars(score, target) {
  const r = score / Math.max(1, target);
  if (r >= 1) return 3;
  if (r >= 0.6) return 2;
  if (r >= 0.3) return 1;
  return 0;
}

async function shareResult() {
  const score = run ? run.score : 0;
  await Sdk.share({
    title: 'STAR SWAP',
    text: i18n.lang === 'zh' ? `我在深空观测站里拿到了 ${score} 分！` : `I scored ${score} in the deep-space observatory! STAR SWAP`,
  });
  Sdk.track('share', { score });
}

// ---------- 执行一次交换（透镜 / 常规） ----------
function doSwap(input) {
  if (!run || run.phase !== 'playing') return;
  run.step(input);
  dispatchEvents(run.drainEvents());
  ui.setHud(run.getHud());
}

// ---------- 事件分发 ----------
function dispatchEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);

    // 视觉反馈
    if (ev.type === 'clearStar') {
      const L = renderer.layout();
      const r = Math.floor(ev.i / L.cols); const c = ev.i % L.cols;
      const x = L.x + c * (L.cell + L.gap) + L.cell / 2;
      const y = L.y + r * (L.cell + L.gap) + L.cell / 2;
      renderer.burst(x, y, '#ffffff');
    } else if (ev.type === 'novaBlast') {
      renderer.flashNova();
    } else if (ev.type === 'specialCreate') {
      const { x, y } = renderer.cellCenter(ev.i);
      renderer.burst(x, y, '#ffe27a', 16);
    } else if (ev.type === 'score') {
      renderer.addFloater(640, 130, `+${ev.amount}`, '#ffffff');
    } else if (ev.type === 'darkBreak') {
      const { x, y } = renderer.cellCenter(ev.i);
      renderer.burst(x, y, '#a06bff', 8);
    }

    // 教程
    if (state === 'playing') ui.tutorial.onGameEvent(ev);

    // 关键埋点（失败不影响玩法）
    if (ev.type === 'levelClear') Sdk.track('levelClear', { level: ev.level });
    else if (ev.type === 'novaBlast') Sdk.track('nova', { level: run.level });
    else if (ev.type === 'specialCreate') Sdk.track('special', { level: run.level });
  }
}

// ---------- 主循环 ----------
function loop(now) {
  requestAnimationFrame(loop);

  if (state === 'playing' && run) {
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;
    accumulator += dt;
    let steps = 0;
    while (accumulator >= STEP && steps < 6) {
      run.step({});  // 推进 simTime（连击窗口衰减）
      accumulator -= STEP;
      steps += 1;
      dispatchEvents(run.drainEvents());
      if (run.phase !== 'playing') { onRunEnd(); break; }
    }
    ui.setHud(run.getHud());
  } else {
    lastTime = now;
  }

  renderer.tick();
  renderer.draw(run, 1);
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
  bestScore = Math.floor(Sdk.load('best', 0)) || 0;
  ui.setBest(bestScore);
  applyAudioSettings();
  await Sdk.ready();
  Sdk.track('load', { lang: i18n.lang });
  // boot 竞态守卫：异步 SDK 加载窗口内玩家可能已点 Start；只在还没开局时才显示标题
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
  startLevel: (n) => startGameAt(n),
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
  hint: () => {
    if (!run || run.phase !== 'playing') return null;
    const s = findValidSwaps(run.grid);
    return s.length ? s[0] : null;
  },
  debug: {
    layout: () => ({ viewport: [canvas.clientWidth, canvas.clientHeight], board: renderer.layout(), lens: !ui.hud.els.lensBtn.classList.contains('hidden') }),
    autoSwap: () => {
      if (!run || run.phase !== 'playing') return null;
      const s = findValidSwaps(run.grid);
      if (!s.length) return null;
      doSwap({ swap: { a: s[0][0], b: s[0][1] } });
      return s[0];
    },
    setScore: (n) => { if (run) run.score = n; },
  },
};
