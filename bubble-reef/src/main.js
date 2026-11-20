// src/main.js — 装配：固定步长 / 输入 / 事件分发 / 状态机 / SDK / 程序化 BGM（Lead 所有）
import { STEP } from '../config/game.config.js';
import { WORLD, SHOOTER, MAX_AIM, parityOf, rowColToPos } from '../config/gameplay.js';
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
let state = 'boot';             // boot | title | playing | paused | dead | won
let run = null;
let lastTime = 0;
let accumulator = 0;
let aimAngle = 0;
let shootQueued = false;
let wildcardQueued = false;
let previewQueued = false;
let aimMoved = false;
let bestScore = 0;
let prevLevel = 0;

// ---------- 坐标换算（letterbox → 世界坐标） ----------
function canvasToWorld(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(rect.width / WORLD.WIDTH, rect.height / WORLD.HEIGHT);
  const ox = (rect.width - WORLD.WIDTH * scale) / 2;
  const oy = (rect.height - WORLD.HEIGHT * scale) / 2;
  return { x: (clientX - rect.left - ox) / scale, y: (clientY - rect.top - oy) / scale };
}

function setAimFromPointer(clientX, clientY) {
  const w = canvasToWorld(clientX, clientY);
  const dx = w.x - SHOOTER.x;
  const dy = w.y - SHOOTER.y;
  aimAngle = Math.max(-MAX_AIM, Math.min(MAX_AIM, Math.atan2(dx, -dy)));
  if (state === 'playing') aimMoved = true;
}

// ---------- 输入 ----------
canvas.addEventListener('pointermove', (e) => setAimFromPointer(e.clientX, e.clientY));
canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  setAimFromPointer(e.clientX, e.clientY);
});
canvas.addEventListener('pointerup', (e) => {
  if (state === 'playing') {
    setAimFromPointer(e.clientX, e.clientY);
    shootQueued = true;
  }
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') aimAngle = Math.max(-MAX_AIM, aimAngle - 0.06);
  if (e.code === 'ArrowRight' || e.code === 'KeyD') aimAngle = Math.min(MAX_AIM, aimAngle + 0.06);
  if (e.code === 'Space' || e.code === 'Enter') {
    if (state === 'title') { startGame(); return; }
    if (state === 'playing') { shootQueued = true; }
    e.preventDefault();
  }
  if (e.code === 'KeyP' && state === 'playing') previewQueued = true;
  if (e.code === 'KeyW' && state === 'playing') wildcardQueued = true;
  if (e.code === 'Escape') togglePause();
  if (e.code === 'KeyR' && (state === 'dead' || state === 'won')) startGame();
});
window.addEventListener('keyup', (e) => { /* 无持续按键 */ });

// ---------- UI ----------
const ui = createUI(uiRoot, {
  onStart: () => startGame(),
  onResume: () => resumeGame(),
  onRestart: () => startGame(),
  onShare: () => shareResult(),
  onHow: () => { /* 标题/暂停点 How 即重看引导 */ },
  onToggleMute: () => audio.setMuted(!audioMuted()),
  onWildcard: () => { wildcardQueued = true; },
  onPreview: () => { previewQueued = true; },
});
ui.onTutorial((result) => {
  Sdk.track('tutorial_done', { skipped: !!result?.skipped });
});
ui.setBest(bestScore);

function audioMuted() {
  return !!Sdk.load('audioMuted', false);
}

// ---------- 音频设置持久化 ----------
function applyAudioSettings() {
  const muted = Sdk.load('audioMuted', false);
  const vol = Sdk.load('audioVolume', 0.7);
  audio.setMuted(!!muted);
  audio.setVolume(vol);
}

// ---------- 游戏流转 ----------
function startGame() {
  audio.unlock();
  run = createRun({ seed: (Date.now() & 0xffff) * 2654435761 >>> 0 });
  state = 'playing';
  aimAngle = 0;
  prevLevel = run.level.index;
  shootQueued = false;
  wildcardQueued = false;
  previewQueued = false;
  accumulator = 0;
  lastTime = performance.now();
  ui.show('playing');
  ui.showBanner('', ''); // 清掉旧横幅
  ui.setHud(run.getHud());
  showLevelBanner();
  Sdk.newRun({ level: 1 });
  audio.playBgm('main');
  applyAudioSettings();
}

function showLevelBanner() {
  const hud = run.getHud();
  ui.showBanner(
    i18n.get('level.title', { n: hud.level }),
    i18n.get('level.goal', { pct: Math.round((hud.clearanceTarget || 0) * 100) + '%' }),
  );
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

function onOver(won) {
  state = won ? 'won' : 'dead';
  const stats = run.stats || {};
  const score = Math.floor(run.score ?? 0);
  const level = run.level ? run.level.index : stats.levelsReached;
  const isRecord = score > bestScore;
  if (isRecord) {
    bestScore = score;
    Sdk.save('bestScore', bestScore);
  }
  ui.setBest(bestScore);
  ui.show('result', {
    won,
    score,
    level,
    best: bestScore,
    newRecord: isRecord,
  });
  if (won) Sdk.levelCleared({ level });
  else Sdk.gameOver({ score, level });
  audio.stopBgm();
}

function shareResult() {
  const score = Math.floor(run?.score ?? 0);
  Sdk.share({
    title: 'BUBBLE REEF',
    text: i18n.lang === 'zh' ? `我在珊瑚礁清到了 ${score} 分！` : `I scored ${score} in BUBBLE REEF!`,
  });
  Sdk.track('share', { score });
}

// ---------- 事件分发 ----------
function dispatchEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);

    if (state === 'playing') ui.tutorial.onGameEvent(ev, performance.now());

    if (ev.type === 'match' || ev.type === 'land') {
      const p = rowColToPos(parityOf(run.parities, ev.row), ev.row, ev.col);
      renderer.burst(p.x, p.y, 'pop');
    } else if (ev.type === 'drop') {
      renderer.burst(WORLD.WIDTH / 2, 180, 'drop');
    } else if (ev.type === 'gold') {
      const p = rowColToPos(parityOf(run.parities, ev.row), ev.row, ev.col);
      renderer.burst(p.x, p.y, 'gold');
    } else if (ev.type === 'wildcardArm') {
      renderer.burst(SHOOTER.x, SHOOTER.y, 'wildcard');
    } else if (ev.type === 'death') {
      renderer.setShake(6);
      setTimeout(() => renderer.setShake(0), 180);
    }

    if (ev.type === 'levelClear') {
      ui.showBanner(i18n.get('level.title', { n: ev.level }), i18n.get('level.cleared'));
      Sdk.track('levelClear', { level: ev.level });
    }
  }
}

// ---------- 主循环 ----------
function loop(now) {
  requestAnimationFrame(loop);

  if (state !== 'playing') {
    renderer.draw((state === 'paused' || state === 'dead' || state === 'won') ? run : null, 1);
    return;
  }

  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  accumulator += dt;

  let steps = 0;
  while (accumulator >= STEP && steps < 6) {
    run.step({
      angle: aimAngle,
      shoot: shootQueued,
      useWildcard: wildcardQueued,
      usePreview: previewQueued,
    });
    shootQueued = false;
    wildcardQueued = false;
    previewQueued = false;
    accumulator -= STEP;
    steps += 1;

    if (aimMoved) {
      ui.tutorial.onGameEvent({ type: 'aim' }, performance.now());
      aimMoved = false;
    }
    dispatchEvents(run.drainEvents());

    if (run.phase === 'dead') { onOver(false); return; }
    if (run.phase === 'won') { onOver(true); return; }
    if (run.level.index !== prevLevel) {
      prevLevel = run.level.index;
      showLevelBanner();
    }
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
Sdk.onAdEnd(() => { audio.setMuted(!!Sdk.load('audioMuted', false)); });

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
    layout: () => ({ viewport: [canvas.clientWidth, canvas.clientHeight], preview: ui.els.btnPreview ? !ui.els.btnPreview.classList.contains('hidden') : false }),
    fire: (angle) => { aimAngle = Math.max(-MAX_AIM, Math.min(MAX_AIM, Number(angle) || 0)); shootQueued = true; },
  },
};
