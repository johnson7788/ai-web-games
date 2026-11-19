// src/main.js — 装配：固定步长 / 输入 / 事件分发 / 状态机 / SDK / 程序化 BGM（Lead 所有）
import { WORLD, STEP } from '../config/game.config.js';
import { PLAYER } from '../config/gameplay.js';
import { createRun } from './game/sim.js';
import { createRender } from './render/index.js';
import { createUI } from './ui/index.js';
import { createAudio } from './core/audio.js';
import { i18n } from './core/i18n.js';
import Sdk from './core/sdk.js';
import { sceneForLevel } from '../config/levels.js';

// ---------- 装配 ----------
const canvas = document.getElementById('canvas');
const uiRoot = document.getElementById('ui-root');
const loadingEl = document.getElementById('loading');

const renderer = createRender(canvas);
const audio = createAudio();

// ---------- 状态 ----------
let state = 'boot';              // boot | title | playing | paused | dead | won
let run = null;
let lastTime = 0;
let accumulator = 0;
let aimX = null;
let aimY = null;
let charging = false;
let bgmKind = 'none';
let bestLevel = 1;
let bestStars = 0;
let aimMoved = false;

// ---------- 坐标换算（letterbox） ----------
function canvasToWorld(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(rect.width / WORLD.WIDTH, rect.height / WORLD.HEIGHT);
  const ox = (rect.width - WORLD.WIDTH * scale) / 2;
  const oy = (rect.height - WORLD.HEIGHT * scale) / 2;
  return { x: (clientX - rect.left - ox) / scale, y: (clientY - rect.top - oy) / scale };
}

// ---------- 输入 ----------
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'KeyR') {
    if (state === 'dead' || state === 'won') startGame();
  }
  if (e.code === 'Enter' && state === 'title') startGame();
});
canvas.addEventListener('pointermove', (e) => {
  const p = canvasToWorld(e.clientX, e.clientY);
  aimX = p.x;
  aimY = p.y;
  if (state === 'playing' && charging) aimMoved = true;
});
canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  const p = canvasToWorld(e.clientX, e.clientY);
  aimX = p.x;
  aimY = p.y;
  if (state === 'playing') {
    charging = true;
    aimMoved = true;
  }
});
const stopCharge = () => { charging = false; };
canvas.addEventListener('pointerup', stopCharge);
canvas.addEventListener('pointercancel', stopCharge);
canvas.addEventListener('pointerleave', () => { /* 保留最后瞄准 */ });

// ---------- UI ----------
const ui = createUI(uiRoot, {
  onDive: () => startGame(),
  onResume: () => resumeGame(),
  onRestart: () => startGame(),
  onShare: () => shareResult(),
  onHow: () => { /* 重看引导 */ },
});
ui.onTutorial((result) => {
  Sdk.track('tutorial_done', { skipped: !!result?.skipped });
});
ui.setBest(bestLevel, bestStars);

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
  aimX = null;
  aimY = null;
  charging = false;
  accumulator = 0;
  lastTime = performance.now();
  ui.show('playing');
  Sdk.newRun({ zone: 1 });
  setBgm(sceneForLevel(run.level).id);
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

function onEnd(phase) {
  state = phase;
  const stats = run.stats || {};
  const sector = Math.max(1, Math.floor(stats.levelsReached ?? run.level ?? 1));
  const isRecord = sector > bestLevel;
  if (isRecord) {
    bestLevel = sector;
    Sdk.save('bestLevel', bestLevel);
  }
  bestStars = Math.max(stats.totalStars || 0, Sdk.load('bestStars', 0));
  Sdk.save('bestStars', bestStars);
  ui.setBest(bestLevel, bestStars);
  ui.show('dead', {
    sector,
    score: stats.score || 0,
    maxCombo: stats.maxCombo || 0,
    stars: stats.totalStars || 0,
    best: bestLevel,
    newRecord: isRecord,
    victory: phase === 'won',
  });
  Sdk.gameOver({ sector, score: stats.score || 0, maxCombo: stats.maxCombo || 0 });
  setBgm('none');
}

async function shareResult() {
  const sector = Math.max(1, Math.floor(run?.stats?.levelsReached ?? 0));
  await Sdk.share({
    title: 'ELITE GUNSTRIKE',
    text: `${i18n.lang === 'zh' ? `我在霓虹战场打到了第 ${sector} 区！` : `I reached sector ${sector} in the neon warzone!`} ELITE GUNSTRIKE`,
  });
  Sdk.track('share', { sector });
}

function setBgm(kind) {
  if (bgmKind === kind) return;
  bgmKind = kind;
  audio.stopBgm();
  if (kind !== 'none') audio.playBgm(kind);
}

// ---------- 事件分发 ----------
function dispatchEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);

    if (ev.type === 'shot') renderer.burst(ev.x, ev.y, 'muzzle');
    else if (ev.type === 'hit') renderer.burst(ev.x, ev.y, 'hit');
    else if (ev.type === 'kill') { renderer.burst(ev.x, ev.y, 'kill'); renderer.setShake(3); Sdk.track('kill', { enemy: ev.enemy, combo: ev.combo }); }
    else if (ev.type === 'explosion') { renderer.burst(ev.x, ev.y, 'explosion'); renderer.setShake(6); Sdk.track('explosion', {}); }
    else if (ev.type === 'chainExplosion') { renderer.burst(ev.x, ev.y, 'kill'); renderer.setShake(4); }
    else if (ev.type === 'captiveHit') { renderer.burst(ev.x, ev.y, 'captive'); renderer.setShake(8); }
    else if (ev.type === 'playerHit') renderer.setShake(5);
    else if (ev.type === 'levelCleared') {
      Sdk.levelCleared({ level: ev.level });
      ui.showBanner('banner.clear', null, 1400);
      renderer.burst(PLAYER.X, 200, 'explosion');
    }
    else if (ev.type === 'sceneEnter' && run && run.level > 1) ui.showBanner(ev.name, null, 1600);

    if (state === 'playing') ui.tutorial.onGameEvent(ev, performance.now());
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
    run.step({ aimX, aimY, fire: charging });
    accumulator -= STEP;
    steps++;
    if (aimMoved) {
      ui.tutorial.onGameEvent({ type: 'aim' }, performance.now());
      aimMoved = false;
    }
    dispatchEvents(run.drainEvents());
    if (run.phase === 'dead') { onEnd('dead'); return; }
    if (run.phase === 'won') { onEnd('won'); return; }
  }

  const hud = run.getHud();
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
Sdk.onAdEnd(() => { audio.setMuted(!!Sdk.load('muted', false)); });

// ---------- 启动 ----------
(async () => {
  bestLevel = Math.max(1, Math.floor(Sdk.load('bestLevel', 1))) || 1;
  bestStars = Math.max(0, Math.floor(Sdk.load('bestStars', 0))) || 0;
  ui.setBest(bestLevel, bestStars);
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
  startTutorial: () => ui.tutorial.replay(),
  pause: togglePause,
  resume: resumeGame,
  restart: toTitle,
  tutorial: {
    get active() { return ui.tutorial.active; },
    get step() { return ui.tutorial.step; },
    get steps() { return ui.tutorial.steps; },
    get current() { return ui.tutorial.current; },
    skip: () => ui.tutorial.skip(),
    startTutorial: () => ui.tutorial.replay(),
  },
  save: (key, value) => Sdk.save(key, value),
  ui: () => ui,
  debug: { layout: () => ({ viewport: [canvas.clientWidth, canvas.clientHeight] }) },
};
