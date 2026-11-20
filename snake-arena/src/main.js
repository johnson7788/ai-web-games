// src/main.js — 装配：固定步长 / 输入 / 事件分发 / 状态机 / SDK / BGM（Lead 所有）
import { STEP, WORLD } from '../config/game.config.js';
import { createRun } from './game/sim.js';
import { createRender } from './render/index.js';
import { createUI } from './ui/index.js';
import { createAudio } from './core/audio.js';
import { i18n } from './core/i18n.js';
import Sdk from './core/sdk.js';

const canvas = document.getElementById('canvas');
const uiRoot = document.getElementById('ui-root');
const btnBoost = document.getElementById('btn-boost');
const btnPulse = document.getElementById('btn-pulse');
const loadingEl = document.getElementById('loading');

const renderer = createRender(canvas);
const audio = createAudio();

// ---------- 状态 ----------
let state = 'boot';             // boot | title | playing | choosing | paused | dead | won
let run = null;
let lastTime = 0;
let accumulator = 0;
let boostHeld = false;
let pulseQueued = false;
let bestLength = 0;
let steerMoved = false;
let bgmMode = 'none';

// ---------- 输入 ----------
const keys = { up: false, down: false, left: false, right: false };
let pointer = null; // 世界坐标 {x,y}

function canvasToWorld(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(rect.width / WORLD.WIDTH, rect.height / WORLD.HEIGHT);
  const ox = (rect.width - WORLD.WIDTH * scale) / 2;
  const oy = (rect.height - WORLD.HEIGHT * scale) / 2;
  return { x: (clientX - rect.left - ox) / scale, y: (clientY - rect.top - oy) / scale };
}

function kbVector() {
  let x = 0;
  let y = 0;
  if (keys.left) x -= 1;
  if (keys.right) x += 1;
  if (keys.up) y -= 1;
  if (keys.down) y += 1;
  return { x, y };
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;
  if (e.code === 'ArrowUp' || e.code === 'KeyW') keys.up = true;
  if (e.code === 'ArrowDown' || e.code === 'KeyS') keys.down = true;
  if (e.code === 'Space') { boostHeld = true; e.preventDefault(); }
  if (e.code === 'KeyE') pulseQueued = true;
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'KeyR' && (state === 'dead' || state === 'won')) startGame();
  if (e.code === 'Enter' && state === 'title') startGame();
  if (state === 'playing' && (keys.left || keys.right || keys.up || keys.down)) steerMoved = true;
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
  if (e.code === 'ArrowUp' || e.code === 'KeyW') keys.up = false;
  if (e.code === 'ArrowDown' || e.code === 'KeyS') keys.down = false;
  if (e.code === 'Space') boostHeld = false;
});

canvas.addEventListener('pointermove', (e) => {
  if (state === 'playing') {
    pointer = canvasToWorld(e.clientX, e.clientY);
    steerMoved = true;
  }
});
canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  pointer = canvasToWorld(e.clientX, e.clientY);
  if (state === 'playing') steerMoved = true;
});
canvas.addEventListener('pointerleave', () => { pointer = null; });

if (window.matchMedia && matchMedia('(pointer: coarse)').matches) {
  btnBoost.hidden = false;
  btnPulse.hidden = false;
}
btnBoost.addEventListener('pointerdown', (e) => { e.preventDefault(); audio.unlock(); boostHeld = true; });
btnBoost.addEventListener('pointerup', () => { boostHeld = false; });
btnBoost.addEventListener('pointercancel', () => { boostHeld = false; });
btnPulse.addEventListener('pointerdown', (e) => { e.preventDefault(); audio.unlock(); pulseQueued = true; });

// ---------- UI ----------
const ui = createUI(uiRoot, {
  onStart: () => startGame(),
  onResume: () => resumeGame(),
  onRestart: () => startGame(),
  onShare: () => shareResult(),
  onUpgrade: (i) => chooseUpgrade(i),
  onHow: () => {},
});
ui.onTutorial((result) => {
  Sdk.track('tutorial_done', { skipped: !!result?.skipped });
});
ui.setBest(bestLength);

// ---------- 音频设置持久化 ----------
function applyAudioSettings() {
  const muted = Sdk.load('muted', false);
  const vol = Sdk.load('volume', 0.7);
  audio.setMuted(!!muted);
  audio.setVolume(vol);
}

// ---------- 游戏流转 ----------
function startGame() {
  audio.unlock();
  run = createRun({ seed: (Date.now() & 0xffff) * 2654435761 >>> 0 });
  state = 'playing';
  boostHeld = false;
  pulseQueued = false;
  pointer = null;
  accumulator = 0;
  lastTime = performance.now();
  ui.show('playing');
  Sdk.newRun({ zone: 1 });
  setBgm(run.getHud().theme);
  applyAudioSettings();
}

function togglePause() {
  if (state === 'playing') { state = 'paused'; ui.show('paused'); audio.event('ui', {}); }
  else if (state === 'paused') resumeGame();
}

function resumeGame() {
  if (state === 'paused') { state = 'playing'; ui.show('playing'); lastTime = performance.now(); }
}

function toTitle() {
  state = 'title';
  run = null;
  ui.show('title');
  renderer.draw(null);
  setBgm('none');
}

function chooseUpgrade(i) {
  if (state !== 'choosing' || !run) return;
  run.chooseUpgrade(i);
  state = 'playing';
  ui.show('playing');
  setBgm(run.getHud().theme);
  Sdk.track('unlock', { id: run.upgradeOffers.length ? run.upgradeOffers[0] : 'none' });
}

function onEnd() {
  const won = run.phase === 'won';
  state = won ? 'won' : 'dead';
  const stats = run.stats;
  const length = run.player ? run.player.segments.length : stats.score;
  const isRecord = length > bestLength;
  if (isRecord) {
    bestLength = length;
    Sdk.save('bestLength', bestLength);
  }
  ui.setBest(bestLength);
  ui.show('result', {
    won,
    rank: stats.rank,
    length,
    kills: stats.kills,
    round: run.round,
    best: bestLength,
    newRecord: isRecord,
  });
  if (won) Sdk.levelCleared({ length, rank: stats.rank, rounds: stats.roundsCleared });
  else Sdk.gameOver({ length, rank: stats.rank, round: run.round });
  setBgm('none');
  if (isRecord) audio.event('newRecord', {});
}

// ---------- 分享 ----------
async function shareResult() {
  const length = run?.player?.segments.length ?? 0;
  await Sdk.share({
    title: 'SNAKE ARENA',
    text: `${i18n.lang === 'zh' ? `我在霓虹蛇竞技场打出了 ${length} 长度！` : `I grew to ${length} length in the neon snake arena!`} SNAKE ARENA`,
  });
  Sdk.track('share', { length });
}

// ---------- BGM ----------
function setBgm(mode) {
  if (bgmMode === mode) return;
  bgmMode = mode;
  if (mode === 'none') audio.stopBgm();
  else audio.playBgm(mode);
}

// ---------- 事件分发 ----------
function dispatchEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    if (ev.type === 'eat') renderer.eatPop(ev.x, ev.y);
    else if (ev.type === 'death') renderer.burst(ev.x, ev.y, 'kill');
    else if (ev.type === 'kill') renderer.burst(ev.x, ev.y, 'kill');
    else if (ev.type === 'pulse') renderer.shockwave(ev.x, ev.y);
    else if (ev.type === 'shardDrop') renderer.shard(ev.x, ev.y);

    if (state === 'playing') ui.tutorial.onGameEvent(ev, performance.now());

    if (ev.type === 'kill') Sdk.track('kill', {});
    else if (ev.type === 'roundWin') Sdk.track('roundWin', { round: ev.round });
    else if (ev.type === 'pulse') Sdk.track('pulse', {});
  }
}

// ---------- 主循环 ----------
function loop(now) {
  requestAnimationFrame(loop);

  if (state === 'playing') {
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;
    accumulator += dt;

    let steps = 0;
    while (accumulator >= STEP && steps < 6) {
      const p = run.player;
      let sa = null;
      const kv = kbVector();
      if (kv.x || kv.y) sa = Math.atan2(kv.y, kv.x);
      else if (pointer && p) sa = Math.atan2(pointer.y - p.segments[0].y, pointer.x - p.segments[0].x);
      run.step({ steerAngle: sa, boost: boostHeld, pulse: pulseQueued });
      pulseQueued = false;
      accumulator -= STEP;
      steps += 1;

      if (steerMoved) {
        ui.tutorial.onGameEvent({ type: 'steer' }, performance.now());
        steerMoved = false;
      }
      dispatchEvents(run.drainEvents());

      if (run.phase === 'choosing') {
        state = 'choosing';
        ui.show('upgrade', { offers: run.upgradeOffers, round: run.round });
        return;
      }
      if (run.phase === 'dead' || run.phase === 'won') {
        onEnd();
        return;
      }
    }

    renderer.draw(run);
    ui.setHud(run.getHud());
    ui.tutorial.tick(performance.now());
    setBgm(run.getHud().theme);
  } else {
    const frozen = (state === 'paused' || state === 'choosing' || state === 'dead' || state === 'won') ? run : null;
    renderer.draw(frozen);
  }
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
  bestLength = Math.floor(Sdk.load('bestLength', 0)) || 0;
  ui.setBest(bestLength);
  applyAudioSettings();
  await Sdk.ready();
  Sdk.track('load', { lang: i18n.lang });
  // boot 竞态守卫：玩家可能在 boot 期间已点 Start
  if (state === 'boot') { state = 'title'; ui.show('title'); }
  renderer.draw(null);
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
  debug: { layout: () => ({ viewport: [canvas.clientWidth, canvas.clientHeight], boost: !btnBoost.hidden, pulse: !btnPulse.hidden }) },
};
