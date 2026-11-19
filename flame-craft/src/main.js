// src/main.js — FLAME CRAFT 装配：输入 / 事件分发 / 状态机 / 固定步长 / SDK / BGM。
import { STEP, WORLD, PLAYER, LEVEL } from '../config/game.config.js';
import { createRun } from './game/sim.js';
import { createRender } from './render/index.js';
import { createUI } from './ui/index.js';
import { createAudio } from './core/audio.js';
import { i18n } from './core/i18n.js';
import Sdk from './core/sdk.js';

const canvas = document.getElementById('canvas');
const uiRoot = document.getElementById('ui-root');
const loadingEl = document.getElementById('loading');
const container = document.getElementById('game-container');

const renderer = createRender(canvas);
const audio = createAudio();
const ui = createUI(uiRoot, {
  onStart: () => startGame(),
  onResume: () => resumeGame(),
  onRestart: () => toTitle(),
  onAgain: () => startGame(),
  onNext: () => startGameAt((run ? run.level : 0) + 1),
  onShare: () => shareResult(),
  onSettings: () => {},
  onSettingsBack: () => toTitle(),
  onTutorial: (result) => Sdk.track('tutorial_done', { skipped: !!result?.skipped }),
  save: (k, v) => Sdk.save(k, v),
  load: (k, f) => Sdk.load(k, f),
});

let state = 'boot';           // boot | title | playing | paused | dead | win
let run = null;
let lastTime = 0;
let accumulator = 0;
let bestLevel = 0;

// 输入
const input = { left: false, right: false };
let pointerActive = false;
let pointerX = null;

// ---------- 输入 ----------
canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (state !== 'playing' || !run) return;
  pointerActive = true;
  pointerX = clientToWorldX(e.clientX);
  markFirstInput();
});
canvas.addEventListener('pointermove', (e) => {
  if (!pointerActive) return;
  pointerX = clientToWorldX(e.clientX);
  markFirstInput();
});
window.addEventListener('pointerup', () => { pointerActive = false; pointerX = null; });
window.addEventListener('pointercancel', () => { pointerActive = false; pointerX = null; });

function clientToWorldX(clientX) {
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0) return WORLD.WIDTH / 2;
  return ((clientX - rect.left) / rect.width) * WORLD.WIDTH;
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') { input.left = true; markFirstInput(); }
  if (e.code === 'ArrowRight' || e.code === 'KeyD') { input.right = true; markFirstInput(); }
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'Enter' && state === 'title') startGame();
  if (e.code === 'Enter' && state === 'win') startGameAt((run ? run.level : 0) + 1);
  if (e.code === 'KeyR' && (state === 'dead' || state === 'win')) startGame();
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') input.left = false;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') input.right = false;
});

let firstInputMarked = false;
function markFirstInput() {
  if (firstInputMarked) return;
  firstInputMarked = true;
  ui.tutorial.onGameEvent({ type: 'move' });
}

// ---------- 音频设置 ----------
function applyAudioSettings() {
  audio.setMuted(!!Sdk.load('muted', false));
  audio.setVolume(Sdk.load('volume', 0.8));
}

// ---------- 状态流转 ----------
function startGame() { startGameAt(1); }

function startGameAt(level) {
  audio.unlock();
  run = createRun({ seed: (Date.now() & 0xffffffff) >>> 0, startLevel: Math.max(1, level || 1) });
  state = 'playing';
  firstInputMarked = false;
  accumulator = 0;
  lastTime = performance.now();
  ui.show('playing');
  ui.setHud(run.getHud());
  Sdk.newRun({ level });
  applyAudioSettings();
  audio.playBgm('bgm');
}

function togglePause() {
  if (state === 'playing') { state = 'paused'; ui.show('paused'); }
  else if (state === 'paused') resumeGame();
}
function resumeGame() {
  if (state === 'paused') { state = 'playing'; ui.show('playing'); lastTime = performance.now(); }
}

function toTitle() {
  state = 'title';
  run = null;
  pointerActive = false;
  pointerX = null;
  ui.show('title');
  renderer.draw(null, 1);
  audio.stopBgm();
}

function ratingStars() {
  if (!run) return 0;
  if (run.phase === 'win') return Math.max(1, Math.min(3, run.lives));
  return 0;
}

function onRunEnd() {
  const win = run.phase === 'win';
  const score = run.score;
  const level = run.level;
  const isRecord = level > bestLevel;
  if (isRecord) { bestLevel = level; Sdk.save('bestLevel', bestLevel); }
  ui.setBest(bestLevel);

  state = win ? 'win' : 'dead';
  ui.show(win ? 'win' : 'dead', {
    win,
    score,
    level,
    stars: ratingStars(),
    best: bestLevel,
    newRecord: isRecord,
  });
  renderer.draw(run, 1);
  if (win) Sdk.levelCleared({ level, score });
  else Sdk.gameOver({ level, score });
  audio.stopBgm();
}

async function shareResult() {
  const score = run ? run.score : 0;
  const level = run ? run.level : 1;
  await Sdk.share({
    title: 'FLAME CRAFT',
    text: i18n.lang === 'zh' ? `我在霓虹炉火里锻到了第 ${level} 关、${score} 分！` : `I forged the flame to level ${level} with ${score} points in FLAME CRAFT!`,
  });
  Sdk.track('share', { score, level });
}

// ---------- 事件分发 ----------
function dispatchEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);

    if (ev.type === 'collect' || ev.type === 'collectCoal') {
      renderer.burst(ev.x, ev.y, '#ffd166', ev.type === 'collectCoal' ? 16 : 8);
      renderer.addFloater(ev.x, ev.y - 20, `+${ev.score}`, '#ffd166');
    } else if (ev.type === 'craftTier') {
      const c = renderer.layout();
      renderer.burst(c.campfireX, c.groundY - 120, ['#38b6ff', '#ffb020', '#ff5a1f'][(ev.tier || 1) - 1] || '#ffffff', 22);
      renderer.addFloater(640, 120, `+${ev.tier === 1 ? 100 : ev.tier === 2 ? 100 : 100}`, '#ffffff');
    } else if (ev.type === 'levelClear') {
      renderer.flashNova();
      renderer.addFloater(640, 300, `LEVEL ${ev.level} CLEAR`, '#ffffff');
    } else if (ev.type === 'levelStart') {
      renderer.addFloater(640, 200, `LEVEL ${ev.level}`, '#ffe27a');
    } else if (ev.type === 'dodge') {
      renderer.addFloater(ev.x, ev.y, `+${ev.score}`, '#9be7ff');
    } else if (ev.type === 'lifeLost') {
      renderer.shake(7);
    }

    if (state === 'playing') ui.tutorial.onGameEvent(ev);

    if (ev.type === 'levelClear') Sdk.track('levelClear', { level: ev.level });
    else if (ev.type === 'craftTier') Sdk.track('craft', { level: run.level, tier: ev.tier });
    else if (ev.type === 'collect') Sdk.track('collect', { level: run.level });
  }
}

// ---------- 主循环 ----------
function loop(now) {
  requestAnimationFrame(loop);

  if (state === 'playing' && run) {
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;
    accumulator += dt;

    // 指针跟随：把指针目标换算成方向
    const inp = { left: input.left, right: input.right };
    if (pointerActive && pointerX != null) {
      const dx = pointerX - run.player.x;
      if (Math.abs(dx) > 6) { inp.left = dx < 0; inp.right = dx > 0; }
    }

    let steps = 0;
    while (accumulator >= STEP && steps < 6) {
      run.step(inp);
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
  renderer.draw(run, state === 'playing' ? 0.016 : 0);
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
  bestLevel = Math.floor(Sdk.load('bestLevel', 0)) || 0;
  ui.setBest(bestLevel);
  applyAudioSettings();
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    renderer.setReduced(true);
  }
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
  setLang: (l) => { ui.setLang(l); },
  get run() { return run; },
  start: startGame,
  startLevel: (n) => startGameAt(n),
  startAct: (n) => startGameAt(n || 1),
  pause: togglePause,
  resume: resumeGame,
  restart: toTitle,
  startTutorial: () => { ui.tutorial.replay(); },
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
    const good = run.entities.filter((e) => e.type === 'fuel' || e.type === 'coal').sort((a, b) => a.y - b.y);
    return good.length ? { x: good[good.length - 1].x } : null;
  },
  debug: {
    setScore: (n) => { if (run) run.score = n; },
    setFuel: (n) => { if (run) run.fuel = n; },
    forceCraft: () => {
      if (!run || run.phase !== 'playing') return null;
      run.fuel = 100;
      run.step({});
      dispatchEvents(run.drainEvents());
      ui.setHud(run.getHud());
      return { tier: run.tier, level: run.level, score: run.score, phase: run.phase };
    },
  },
};
