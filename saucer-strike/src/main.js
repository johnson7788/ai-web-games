// src/main.js — 装配：固定步长 / 输入 / 事件分发 / 状态机 / SDK / BGM（Lead 所有）
import { WORLD, STEP } from '../config/game.config.js';
import { GUN } from '../config/gameplay.js';
import { createRun } from './game/sim.js';
import { createRender } from './render/index.js';
import { createUI } from './ui/index.js';
import { createAudio } from './core/audio.js';
import { i18n } from './core/i18n.js';
import Sdk from './core/sdk.js';

// ---------- 装配 ----------
const canvas = document.getElementById('canvas');
const uiRoot = document.getElementById('ui-root');
const btnTracer = document.getElementById('btn-tracer');
const loadingEl = document.getElementById('loading');

const renderer = createRender(canvas);
const audio = createAudio();

// ---------- 状态 ----------
let state = 'boot';             // boot | title | playing | paused | dead | won
let run = null;
let lastTime = 0;
let accumulator = 0;
let pointerActive = false;
let aimX = GUN.MUZZLE_X;
let aimY = GUN.MUZZLE_Y - 200;
let fireQueued = false;
let tracerQueued = false;
let aimMoved = false;           // 教程：真实拖动信号
let bestScore = 0;
let bgmMode = 'none';

// ---------- 坐标转换（letterbox） ----------
function canvasToWorld(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(rect.width / WORLD.WIDTH, rect.height / WORLD.HEIGHT);
  const ox = (rect.width - WORLD.WIDTH * scale) / 2;
  const oy = (rect.height - WORLD.HEIGHT * scale) / 2;
  return {
    x: (clientX - rect.left - ox) / scale,
    y: (clientY - rect.top - oy) / scale,
  };
}

// ---------- 指针输入：按住拖动瞄准蓄力，松开发射 ----------
canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  const p = canvasToWorld(e.clientX, e.clientY);
  pointerActive = true;
  aimX = p.x;
  aimY = p.y;
  aimMoved = true;
});
canvas.addEventListener('pointermove', (e) => {
  if (!pointerActive) return;
  const p = canvasToWorld(e.clientX, e.clientY);
  aimX = p.x;
  aimY = p.y;
  aimMoved = true;
});
function releasePointer() {
  if (pointerActive) {
    pointerActive = false;
    fireQueued = true;
  }
}
canvas.addEventListener('pointerup', releasePointer);
canvas.addEventListener('pointercancel', () => { pointerActive = false; });

// ---------- 键盘兜底（方向移瞄准 / 空格发射 / Q 曳光） ----------
const keys = { up: false, down: false, left: false, right: false };
window.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowUp' || e.code === 'KeyW') { keys.up = true; aimMoved = true; }
  if (e.code === 'ArrowDown' || e.code === 'KeyS') { keys.down = true; aimMoved = true; }
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') { keys.left = true; aimMoved = true; }
  if (e.code === 'ArrowRight' || e.code === 'KeyD') { keys.right = true; aimMoved = true; }
  if (e.code === 'Space') { fireQueued = true; e.preventDefault(); }
  if (e.code === 'KeyQ' || e.code === 'KeyT') { tracerQueued = true; }
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'KeyR' && (state === 'dead' || state === 'won')) startGame();
  if (e.code === 'Enter' && state === 'title') startGame();
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowUp' || e.code === 'KeyW') keys.up = false;
  if (e.code === 'ArrowDown' || e.code === 'KeyS') keys.down = false;
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
});

function updateKeyboardAim() {
  if (pointerActive) return;
  const sp = 420;
  if (keys.left) aimX -= sp * STEP;
  if (keys.right) aimX += sp * STEP;
  if (keys.up) aimY -= sp * STEP;
  if (keys.down) aimY += sp * STEP;
  aimX = Math.max(0, Math.min(WORLD.WIDTH, aimX));
  aimY = Math.max(0, Math.min(WORLD.HEIGHT, aimY));
}

// ---------- 曳光按钮（触屏） ----------
if (window.matchMedia && matchMedia('(pointer: coarse)').matches) btnTracer.hidden = false;
btnTracer.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  audio.unlock();
  tracerQueued = true;
});

// ---------- UI ----------
const ui = createUI(uiRoot, {
  onDive: () => startGame(),
  onResume: () => resumeGame(),
  onRestart: () => startGame(),
  onShare: () => shareResult(),
  onUpgrade: (i) => {
    if (run && run.chooseUpgrade) {
      audio.unlock();
      run.chooseUpgrade(i);
      audio.event('ui');
    }
  },
});
ui.onTutorial((result) => {
  Sdk.track('tutorial_done', { skipped: !!result?.skipped });
  // 教程结束（含跳过）：立即放一个碟入场并瞬移到屏幕内可见位，保证画面上永远有完整目标
  if (run && run.saucers) {
    const pending = run.saucers.filter((s) => !s.active).sort((a, b) => (a.path[0].hold || 0) - (b.path[0].hold || 0));
    if (pending.length && run.saucers.every((s) => !s.active)) {
      const s = pending[0];
      s.path[0].hold = 0;
      s.wayHold = 0;
      // 首路点若在屏幕外，替换为屏幕内安全点（可见性兜底）
      if (s.path[0].x < 80 || s.path[0].x > WORLD.WIDTH - 80 || s.path[0].y < 80 || s.path[0].y > WORLD.HEIGHT - 140) {
        s.path[0] = { x: WORLD.WIDTH * 0.5 + (s.path[0].x > WORLD.WIDTH / 2 ? 120 : -120), y: 260 };
      }
      s.x = s.path[0].x;
      s.y = s.path[0].y;
    }
  }
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
  pointerActive = false;
  aimX = GUN.MUZZLE_X;
  aimY = GUN.MUZZLE_Y - 200;
  fireQueued = false;
  tracerQueued = false;
  accumulator = 0;
  lastTime = performance.now();
  ui.show('playing');
  Sdk.newRun({ wave: 1 });
  setBgm('main');
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

function ratingFor(score) {
  if (score >= 25000) return 'S';
  if (score >= 15000) return 'A';
  if (score >= 8000) return 'B';
  return 'C';
}

function onGameEnd(victory) {
  state = victory ? 'won' : 'dead';
  const stats = run.stats || {};
  const score = Math.floor(stats.score ?? 0);
  const wave = stats.waveReached || run.wave || 1;
  const isRecord = score > bestScore;
  if (isRecord) {
    bestScore = score;
    Sdk.save('bestScore', bestScore);
  }
  ui.setBest(bestScore);
  ui.show('dead', {
    victory,
    score,
    wave,
    rating: ratingFor(score),
    best: bestScore,
    newRecord: isRecord,
  });
  Sdk.gameOver({ score, wave, victory });
  if (victory) Sdk.levelCleared({ score, wave });
  setBgm('none');
}

async function shareResult() {
  const score = Math.floor(run?.stats?.score ?? 0);
  await Sdk.share({
    title: 'SAUCER STRIKE',
    text: `${i18n.lang === 'zh' ? `我守到第 ${run?.stats?.waveReached || 1} 波，得分 ${score}！` : `I held the radar to wave ${run?.stats?.waveReached || 1} — score ${score}!`} SAUCER STRIKE`,
  });
  Sdk.track('share', { score });
}

function setBgm(mode) {
  if (bgmMode === mode) return;
  bgmMode = mode;
  audio.stopBgm();
  if (mode === 'main') audio.playBgm('main');
}

// ---------- 事件分发 ----------
function dispatchEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);

    if (ev.type === 'kill') renderer.burst(ev.x, ev.y, 'kill');
    else if (ev.type === 'hit') renderer.burst(ev.x, ev.y, 'hit');
    else if (ev.type === 'tracerFired') renderer.burst(GUN.MUZZLE_X, GUN.MUZZLE_Y, 'tracer');
    else if (ev.type === 'meteorBlock') renderer.burst(ev.x, ev.y, 'meteorBlock');
    else if (ev.type === 'signature') renderer.signature();

    if (state === 'playing') ui.tutorial.onGameEvent(ev, performance.now());

    if (ev.type === 'waveStart') Sdk.track('wave_start', { wave: ev.wave });
    else if (ev.type === 'upgrade') Sdk.track('upgrade', { id: ev.id });
    else if (ev.type === 'kill') Sdk.track('kill', { saucer: ev.saucer });
    else if (ev.type === 'win') Sdk.track('win', { score: ev.score });
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
    updateKeyboardAim();
    const charging = pointerActive || keys.left || keys.right || keys.up || keys.down;
    run.step({ aimX, aimY, charging, fire: fireQueued, tracer: tracerQueued });
    fireQueued = false;
    tracerQueued = false;
    accumulator -= STEP;
    steps++;

    if (aimMoved) {
      ui.tutorial.onGameEvent({ type: 'aim' }, performance.now());
      aimMoved = false;
    }
    dispatchEvents(run.drainEvents());
    if (run.phase === 'dead') { onGameEnd(false); return; }
    if (run.phase === 'won') { onGameEnd(true); return; }
  }

  const hud = run.getHud();
  renderer.draw(run, accumulator / STEP);
  ui.setHud(hud);
  ui.showUpgrade(hud.pendingUpgrade, hud.upgradeOffers);
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
  // boot 竞态守卫：玩家可能在 boot 期间已点 Start
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
      tracer: !btnTracer.hidden,
      cannon: [GUN.MUZZLE_X, GUN.MUZZLE_Y],
    }),
  },
};
