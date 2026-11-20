// COLOR FLUX · main.js — 装配：固定步长 / 输入 / 事件分发 / 状态机 / SDK / BGM
import { STEP, WORLD, CONFIG } from '../config/game.config.js';
import { createRun, topColorOf, nextMatchCenter } from './game/sim.js';
import { RING, BALL } from '../config/gameplay.js';
import { createRender } from './render/index.js';
import { createUI } from './ui/index.js';
import { createAudio } from './core/audio.js';
import { i18n } from './core/i18n.js';
import Sdk from './core/sdk.js';

const HOLD_MS = 180; // 按住超过该时长才进入悬浮（区分 tap 起跳 vs hold 悬浮）

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
let bestScore = 0;

// 输入：tap = 起跳（边沿），hold = 悬浮（按住 180ms 后）
let jumpQueued = false;
let hoverHeld = false;
let pressed = false;
let pressStart = 0;
let holdTimer = null;
let autoPlay = false;

// ---------- UI ----------
const ui = createUI(uiRoot, {
  onDive: () => startGame(),
  onResume: () => resumeGame(),
  onRestart: () => startGame(),
  onShare: () => shareResult(),
  onMute: () => toggleMute(),
  onHow: () => { /* 重看引导 */ },
});
ui.onTutorial((result) => {
  Sdk.track('tutorial_done', { skipped: !!result?.skipped });
});
ui.setBest(bestScore);

// ---------- 音频 ----------
function applyAudioSettings() {
  const muted = Sdk.load('muted', false);
  const vol = Sdk.load('volume', 0.8);
  audio.setMuted(!!muted);
  audio.setVolume(vol);
  ui.setMuted(!!muted);
}

function toggleMute() {
  const next = !Sdk.load('muted', false);
  audio.setMuted(next);
  Sdk.save('muted', next);
  ui.setMuted(next);
  audio.event('ui', {});
}

// ---------- 输入 ----------
function press() {
  if (pressed) return;
  pressed = true;
  pressStart = performance.now();
  jumpQueued = true;
  audio.unlock();
  holdTimer = setTimeout(() => {
    if (pressed) hoverHeld = true;
  }, HOLD_MS);
}

function release() {
  if (!pressed) return;
  pressed = false;
  hoverHeld = false;
  if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
    press();
    e.preventDefault();
  }
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'KeyR' && state === 'dead') startGame();
  if (e.code === 'Enter' && state === 'title') startGame();
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') release();
});

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  press();
});
window.addEventListener('pointerup', release);
window.addEventListener('pointercancel', release);
window.addEventListener('blur', release);

// ---------- 游戏流转 ----------
function startGame() {
  audio.unlock();
  run = createRun({ seed: (Date.now() & 0xffff) * 2654435761 >>> 0 });
  state = 'playing';
  accumulator = 0;
  lastTime = performance.now();
  jumpQueued = false;
  hoverHeld = false;
  ui.show('playing');
  Sdk.newRun({ zone: 1 });
  audio.playBgm('bgm');
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
  const score = Math.floor(run.score);
  const isRecord = score > bestScore;
  if (isRecord) {
    bestScore = score;
    Sdk.save('best', bestScore);
  }
  ui.setBest(bestScore);
  ui.show('dead', {
    score,
    best: bestScore,
    scene: run.scene,
    newRecord: isRecord,
  });
  Sdk.gameOver({ score, segment: run.segment, rings: run.ringsPassed });
  audio.stopBgm();
}

async function shareResult() {
  const score = Math.floor(run?.score ?? 0);
  await Sdk.share({
    title: 'COLOR FLUX',
    text: i18n.get('share.text', { score }),
  });
  Sdk.track('share', { score });
}

// ---------- 事件分发 ----------
function dispatchEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);

    if (ev.type === 'pass') renderer.particles.passFx(WORLD.BALL_X, run.ball.y, ev.segmentColor ?? 0);
    else if (ev.type === 'wrongColor' || ev.type === 'death') renderer.particles.burst(WORLD.BALL_X, run.ball.y, run.ball.color);
    else if (ev.type === 'auroraBurst') renderer.triggerBurst();

    if (state === 'playing') ui.tutorial.onGameEvent(ev);

    if (ev.type === 'segmentEnter') Sdk.track('segment_enter', { segment: ev.segment, scene: ev.scene });
    else if (ev.type === 'auroraBurst') Sdk.track('aurora_burst', { score: Math.floor(run.score) });
    else if (ev.type === 'pass') Sdk.track('pass', { ring: ev.ring });
  }
}

// 自动演示（录制 game.gif 用）：用 greedy 预测匹配高度驱动萤
function autoPlayInput(r) {
  const b = r.ball;
  let best = null;
  for (const o of r.obstacles) {
    if (o.passed) continue;
    if (o.y > b.y + RING.PASS_BAND + 10) continue;
    if (!best || o.y > best.y) best = o;
  }
  if (!best) return { jump: b.mode === 'falling' && b.y > 560, hover: false };
  let Hc = null;
  let base = r.time;
  for (let k = 0; k < 6; k += 1) {
    const tc = nextMatchCenter(best, b.color, base);
    if (tc == null) break;
    const h = best.y + r.scroll * (tc - r.time);
    base = tc + 0.001;
    if (h >= 90 && h <= 560) {
      const dist = Math.abs(b.y - h);
      const spd = h < b.y ? BALL.V_RISE : BALL.V_FALL;
      if (dist / spd <= (tc - r.time) - 0.35) { Hc = h; break; }
    }
  }
  if (Hc == null) Hc = 300;
  if (b.y > Hc + 12) return { jump: true, hover: false };
  if (b.y < Hc - 12) return { jump: false, hover: false };
  return { jump: false, hover: true };
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
    const input = autoPlay ? autoPlayInput(run) : { jump: jumpQueued, hover: hoverHeld };
    run.step(input);
    jumpQueued = false;
    accumulator -= STEP;
    steps++;
    dispatchEvents(run.drainEvents());
    if (run.phase === 'dead') { onDeath(); return; }
  }

  renderer.draw(run, accumulator / STEP);
  ui.setHud(run.getHud());
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
  // boot 竞态守卫：异步 SDK 加载窗口内点了 Start 也不会被顶掉
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
    layout: () => ({ viewport: [canvas.clientWidth, canvas.clientHeight] }),
    topColor: (o, t) => topColorOf(o, t),
    forceDie: () => { if (run && state === 'playing') run.phase = 'dead'; },
    setAutoPlay: (v) => { autoPlay = !!v; },
  },
};
