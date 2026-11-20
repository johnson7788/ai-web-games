// src/main.js — 装配：固定步长 / 输入 / 事件分发 / 状态机 / SDK / BGM（Lead 所有）
import { WORLD, STEP } from '../config/game.config.js';
import { BALL } from '../config/gameplay.js';
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
let steerX = null;              // 绝对目标 x（0..1280）
let bestScore = 0;
let steerMoved = false;         // 教程：真实拖动信号
let frozen = false;             // 截图调试：暂停步进但继续绘制
let autopilot = false;          // 验收调试：自动朝下一个同色环目标横移（保活）

// ---------- 输入（边沿检测归 main） ----------
const keys = { left: false, right: false };
let keyVelX = 0;
let pointerX = null;

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

function canvasToWorldX(clientX) {
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(rect.width / WORLD.WIDTH, rect.height / WORLD.HEIGHT);
  const ox = (rect.width - WORLD.WIDTH * scale) / 2;
  return (clientX - rect.left - ox) / scale;
}

function updateSteerFromInputs() {
  if (autopilot && run && run.phase === 'playing') {
    const tx = nextDyeTargetX(run);
    if (tx != null) {
      steerX = tx;
      steerMoved = true;
      return;
    }
  }
  if (keys.left || keys.right) {
    const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    keyVelX = clamp(keyVelX + dir * 2.6, -26, 26);
    if (steerX == null) steerX = WORLD.WIDTH / 2;
    steerX = clamp(steerX + keyVelX, BALL.R, WORLD.WIDTH - BALL.R);
    if (Math.abs(keyVelX) > 1.5) steerMoved = true;
  } else {
    keyVelX = 0;
    if (pointerX != null) steerX = pointerX;
  }
}

function nextDyeTargetX(r) {
  let ring = null;
  let bestY = Infinity;
  for (const rr of r.rings) {
    if (rr.resolved || rr.worldY <= r.depth) continue;
    if (rr.worldY < bestY) { bestY = rr.worldY; ring = rr; }
  }
  if (!ring) return null;
  let bx = null;
  let bd = Infinity;
  for (let i = 0; i < ring.cellsCount; i += 1) {
    if (ring.colors[i] !== r.dye) continue;
    const cx = (((ring.xOffset + i * ring.cellW + ring.cellW / 2) % WORLD.WIDTH) + WORLD.WIDTH) % WORLD.WIDTH;
    const d = Math.min(Math.abs(cx - r.ball.x), WORLD.WIDTH - Math.abs(cx - r.ball.x));
    if (d < bd) { bd = d; bx = cx; }
  }
  return bx;
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'KeyR' && state === 'dead') startGame();
  if (e.code === 'Enter' && state === 'title') startGame();
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
});

canvas.addEventListener('pointermove', (e) => {
  pointerX = canvasToWorldX(e.clientX);
  if (pointerX != null && state === 'playing') steerMoved = true;
});
canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  pointerX = canvasToWorldX(e.clientX);
  if (state === 'playing') steerMoved = true;
});
canvas.addEventListener('pointerleave', () => { pointerX = null; });

// ---------- UI ----------
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
ui.setBest(bestScore);

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
  steerX = WORLD.WIDTH / 2;
  pointerX = null;
  keyVelX = 0;
  accumulator = 0;
  lastTime = performance.now();
  ui.show('playing');
  Sdk.newRun({ zone: 1 });
  audio.playBgm();
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
    band: run.band || 1,
    bandName: `band.${run.band || 1}`,
    maxCombo: stats.maxCombo || 0,
    rainbow: stats.rainbowCount || 0,
    best: bestScore,
    newRecord: isRecord,
  });
  Sdk.gameOver({ score, band: run.band || 1, maxCombo: stats.maxCombo || 0, rainbow: stats.rainbowCount || 0 });
  audio.stopBgm();
}

// ---------- 分享 ----------
async function shareResult() {
  const score = Math.floor(run?.score ?? 0);
  await Sdk.share({
    title: 'RING CYCLE',
    text: i18n.lang === 'zh' ? `我在糖果工厂拿了 ${score} 分！` : `I scored ${score} in the candy factory!`,
  });
  Sdk.track('share', { score });
}

// ---------- 事件分发 ----------
function dispatchEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);

    if (ev.type === 'ringClear') {
      renderer.burst(ev.x, ev.y, 'pop', ev.kind === 'match' ? ev.color : 0);
    } else if (ev.type === 'ringBounce') {
      renderer.burst(ev.x, ev.y, 'pop', 2);
    } else if (ev.type === 'rainbow') {
      renderer.rain(run.dye);
      renderer.burst(ev.x, ev.y, 'rainbow', run.dye);
      renderer.shakeScreen(6);
    } else if (ev.type === 'death') {
      renderer.burst(ev.x, ev.y, 'death', run.dye);
      renderer.shakeScreen(14);
    } else if (ev.type === 'bandEnter') {
      renderer.shakeScreen(4);
    }

    if (state === 'playing') ui.tutorial.onGameEvent(ev, performance.now());

    if (ev.type === 'ringClear') Sdk.track('ring_clear', { kind: ev.kind });
    else if (ev.type === 'rainbow') Sdk.track('rainbow', { score: run.score });
    else if (ev.type === 'bandEnter') Sdk.track('band_enter', { band: ev.band });
  }
}

// ---------- 主循环 ----------
function loop(now) {
  requestAnimationFrame(loop);

  if (state !== 'playing') {
    renderer.draw(state === 'paused' || state === 'dead' ? run : null, 1);
    return;
  }

  if (frozen) {
    renderer.draw(run, 1);
    ui.setHud(run.getHud());
    return;
  }

  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  accumulator += dt;

  let steps = 0;
  while (accumulator >= STEP && steps < 6) {
    updateSteerFromInputs();
    run.step({ steerX });
    accumulator -= STEP;
    steps++;
    if (steerMoved) {
      ui.tutorial.onGameEvent({ type: 'steer' }, performance.now());
      steerMoved = false;
    }
    dispatchEvents(run.drainEvents());
    if (run.phase === 'dead') { onDeath(); return; }
  }

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
  bestScore = Math.floor(Sdk.load('bestScore', 0)) || 0;
  ui.setBest(bestScore);
  applyAudioSettings();
  await Sdk.ready();
  Sdk.track('load', { lang: i18n.lang });
  // 玩家可能在 boot 期间已点 Play（异步 SDK 加载窗口）；只在还没开局时才显示标题
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
    layout: () => ({ viewport: [canvas.clientWidth, canvas.clientHeight], ballY: WORLD.BALL_Y }),
    freeze: (v) => { frozen = !!v; return frozen; },
    setTutorialDone: () => { ui.tutorial.machine.done = true; ui.tutorial.overlay.hide(); },
    autopilot: (v) => { autopilot = !!v; return autopilot; },
  },
};
