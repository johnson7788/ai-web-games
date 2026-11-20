// src/main.js — 装配：固定步长 / 输入 / 事件分发 / 状态机 / SDK / BGM（Lead 所有）
import { STEP, WORLD, CONFIG } from '../config/game.config.js';
import { createRun } from './game/sim.js';
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

// ---------- 状态 ----------
let state = 'boot'; // boot | title | playing | paused | dead | win
let run = null;
let lastTime = 0;
let accumulator = 0;
let bestWave = 0;
let upgradeShown = false;
let chooseUpgrade = null;
let steerMoved = false;
let bgmMode = 'none';

// 输入：移动向量（键盘 + 摇杆），技能/换位边沿
const keys = { up: false, down: false, left: false, right: false };
let pendingSwap = false;
let pendingJ = false;
let pendingK = false;

function moveFromKeys() {
  let x = 0; let y = 0;
  if (keys.left) x -= 1;
  if (keys.right) x += 1;
  if (keys.up) y -= 1;
  if (keys.down) y += 1;
  return { x, y };
}

function buildMoveInput() {
  const tv = ui.touch.vector;
  if (tv && (tv.x || tv.y)) return { x: tv.x, y: tv.y };
  return moveFromKeys();
}

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
ui.setBest(bestWave);

// 触屏按钮 → 边沿
ui.touch.buttons.swap.addEventListener('pointerdown', (e) => { e.preventDefault(); audio.unlock(); pendingSwap = true; });
ui.touch.buttons.j.addEventListener('pointerdown', (e) => { e.preventDefault(); audio.unlock(); pendingJ = true; });
ui.touch.buttons.k.addEventListener('pointerdown', (e) => { e.preventDefault(); audio.unlock(); pendingK = true; });

// ---------- 键盘 ----------
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = true;
  if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = true;
  if (e.code === 'KeyW' || e.code === 'ArrowUp') keys.up = true;
  if (e.code === 'KeyS' || e.code === 'ArrowDown') keys.down = true;
  if (e.code === 'KeyJ') { pendingJ = true; e.preventDefault(); }
  if (e.code === 'KeyK') { pendingK = true; e.preventDefault(); }
  if (e.code === 'Tab' || e.code === 'KeyQ') { pendingSwap = true; e.preventDefault(); }
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'KeyR' && (state === 'dead' || state === 'win')) startGame();
  if (e.code === 'Enter' && state === 'title') startGame();
  audio.unlock();
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = false;
  if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = false;
  if (e.code === 'KeyW' || e.code === 'ArrowUp') keys.up = false;
  if (e.code === 'KeyS' || e.code === 'ArrowDown') keys.down = false;
});

// 指针：解锁音频 + 教程移动信号
canvas.addEventListener('pointerdown', () => audio.unlock());
window.addEventListener('pointerdown', () => audio.unlock());

// ---------- 音频设置 ----------
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
  accumulator = 0;
  lastTime = performance.now();
  upgradeShown = false;
  chooseUpgrade = null;
  steerMoved = false;
  ui.show('playing');
  Sdk.newRun({ zone: 1 });
  setBgm('main');
  applyAudioSettings();
}

function togglePause() {
  if (state === 'playing') { state = 'paused'; ui.show('paused'); }
  else if (state === 'paused') resumeGame();
}

function pauseGame() {
  if (state === 'playing') { state = 'paused'; ui.show('paused'); }
}

function resumeGame() {
  if (state === 'paused') { state = 'playing'; ui.show('playing'); lastTime = performance.now(); }
}

function toTitle() {
  state = 'title';
  run = null;
  upgradeShown = false;
  chooseUpgrade = null;
  ui.show('title');
  renderer.draw(null, 1, 0, performance.now() / 1000);
  setBgm('none');
}

function onDeath() {
  state = 'dead';
  const stats = run.stats || {};
  const wave = stats.wavesReached || run.wave || 1;
  const isRecord = wave > bestWave;
  if (isRecord) {
    bestWave = wave;
    Sdk.save('bestWave', bestWave);
  }
  ui.setBest(bestWave);
  ui.show('dead', { win: false, wave, kills: stats.kills || 0, best: bestWave, newRecord: isRecord });
  Sdk.gameOver({ wave, kills: stats.kills || 0 });
  setBgm('none');
}

function onWin() {
  state = 'win';
  const wave = run.waveMax || run.wave;
  const isRecord = wave > bestWave;
  if (isRecord) {
    bestWave = wave;
    Sdk.save('bestWave', bestWave);
  }
  ui.setBest(bestWave);
  ui.show('win', { win: true, wave, kills: run.stats.kills || 0, best: bestWave, newRecord: isRecord });
  Sdk.levelCleared({ wave, kills: run.stats.kills || 0 });
  setBgm('none');
}

async function shareResult() {
  const wave = run?.stats?.wavesReached ?? run?.wave ?? 0;
  await Sdk.share({
    title: 'HERO VANGUARD',
    text: `${i18n.lang === 'zh' ? `我守住了 ${wave} 波轨道站防线！` : `I held ${wave} waves at the station line!`} HERO VANGUARD`,
  });
  Sdk.track('share', { wave });
}

function setBgm(mode) {
  if (bgmMode === mode) return;
  bgmMode = mode;
  audio.stopBgm();
  if (mode === 'main') audio.playBgm('main');
  else if (mode === 'boss') audio.playBgm('boss');
}

// ---------- 事件分发 ----------
function dispatchEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);

    if (ev.type === 'resonance') renderer.spawnFx('resonance', ev);
    else if (ev.type === 'swap') renderer.spawnFx('swap', ev);
    else if (ev.type === 'kill') { renderer.spawnFx('kill', ev); renderer.burst(ev.x, ev.y, 'pop'); }
    else if (ev.type === 'hit') renderer.spawnFx('hit', ev);
    else if (ev.type === 'shot') renderer.spawnFx('shot', ev);
    else if (ev.type === 'baseHit') renderer.shake(4);
    else if (ev.type === 'bossSpawn') renderer.shake(6);

    if (state === 'playing') ui.tutorial.onGameEvent(ev);

    if (ev.type === 'kill') Sdk.track('kill', { enemy: ev.enemy });
    else if (ev.type === 'waveClear') Sdk.track('wave_clear', { wave: ev.wave });
    else if (ev.type === 'resonance') Sdk.track('resonance', {});
  }
}

// ---------- 主循环 ----------
function loop(now) {
  requestAnimationFrame(loop);
  const t = now / 1000;

  if (state !== 'playing') {
    renderer.draw(state === 'paused' || state === 'dead' || state === 'win' ? run : null, 1, 0, t);
    return;
  }

  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  accumulator += dt;

  let steps = 0;
  while (accumulator >= STEP && steps < 6) {
    const move = buildMoveInput();
    const input = {
      moveX: move.x,
      moveY: move.y,
      swap: pendingSwap,
      j: pendingJ,
      k: pendingK,
      chooseUpgrade,
    };
    if (move.x || move.y) steerMoved = true;
    pendingSwap = false;
    pendingJ = false;
    pendingK = false;
    chooseUpgrade = null;

    run.step(input);
    accumulator -= STEP;
    steps += 1;

    if (steerMoved) {
      ui.tutorial.onGameEvent({ type: 'steer' });
      steerMoved = false;
    }
    dispatchEvents(run.drainEvents());

    if (run.phase === 'dead') { onDeath(); return; }
    if (run.phase === 'win') { onWin(); return; }

    if (run.phase === 'upgrade' && !upgradeShown) {
      upgradeShown = true;
      ui.show('upgrade', {
        choices: run.upgradeChoices,
        wave: run.wave,
        onPick: (i) => { chooseUpgrade = i; },
      });
    } else if (run.phase !== 'upgrade' && upgradeShown) {
      upgradeShown = false;
      ui.show('playing');
    }
  }

  const hud = run.getHud();
  setBgm(hud.bossHp > 0 ? 'boss' : 'main');
  ui.setHud(hud);
  renderer.draw(run, accumulator / STEP, STEP, t);
}

// ---------- 失焦自动暂停 ----------
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'playing') pauseGame();
});

Sdk.onAdStart(() => audio.setMuted(true));
Sdk.onAdEnd(() => { audio.setMuted(!!Sdk.load('muted', false)); });

// ---------- 启动 ----------
(async () => {
  bestWave = Math.floor(Sdk.load('bestWave', 0)) || 0;
  ui.setBest(bestWave);
  applyAudioSettings();
  await Sdk.ready();
  Sdk.track('load', { lang: i18n.lang });
  // boot 竞态守卫：异步 SDK 加载窗口内玩家可能已点 Deploy
  if (state === 'boot') { state = 'title'; ui.show('title'); }
  renderer.draw(null, 1, 0, performance.now() / 1000);
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
  pause: pauseGame,
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
  debug: { layout: () => ({ viewport: [canvas.clientWidth, canvas.clientHeight], touch: !ui.touch.el.classList.contains('hidden') }) },
};
