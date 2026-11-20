// src/main.js — 装配：固定步长 / 输入 / 事件分发 / 状态机 / SDK / BGM / 环间升级。
import { WORLD, STEP } from '../config/game.config.js';
import { createRun } from './game/sim.js';
import { createRender } from './render/index.js';
import { createUI } from './ui/index.js';
import { createAudio } from './core/audio.js';
import { i18n } from './core/i18n.js';
import Sdk from './core/sdk.js';
import { RING_COUNT } from '../config/levels.js';
import { pickUpgradeOptions } from '../config/upgrades.js';

const canvas = document.getElementById('canvas');
const uiRoot = document.getElementById('ui-root');
const loadingEl = document.getElementById('loading');

const renderer = createRender(canvas);
const audio = createAudio();

// ---------- 状态 ----------
let state = 'boot';             // boot | title | playing | paused | dead | won | upgrade
let run = null;
let lastTime = 0;
let accumulator = 0;
let fireQueued = false;
let bestScore = 0;
let bgmMode = 'none';

// ---------- 输入（边沿检测归 main） ----------
function queueFire() {
  if (state === 'playing') fireQueued = true;
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') { queueFire(); e.preventDefault(); }
  if (e.code === 'Enter' && state === 'title') startGame();
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'KeyR' && (state === 'dead' || state === 'won')) startGame();
});

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  audio.unlock();
  queueFire();
});

// ---------- UI ----------
const ui = createUI(uiRoot, {
  onStart: () => startGame(),
  onResume: () => resumeGame(),
  onRestart: () => startGame(),
  onShare: () => shareResult(),
  onHow: () => {},
  onUpgrade: (id) => chooseUpgrade(id),
});
ui.onTutorial((result) => {
  Sdk.track('tutorial_done', { skipped: !!result?.skipped });
});
ui.setBest(bestScore);

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
  fireQueued = false;
  accumulator = 0;
  lastTime = performance.now();
  ui.show('playing');
  Sdk.newRun({ zone: 1 });
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

function onDeath() {
  state = 'dead';
  const stats = run.stats || {};
  const score = Math.floor(run.score ?? 0);
  const ring = stats.ringReached || run.ring || 1;
  const isRecord = score > bestScore;
  if (isRecord) {
    bestScore = score;
    Sdk.save('best', bestScore);
  }
  ui.setBest(bestScore);
  ui.show('dead', { score, ring, best: bestScore, newRecord: isRecord });
  Sdk.gameOver({ score, ring });
  setBgm('none');
}

function onWin() {
  state = 'won';
  const score = Math.floor(run.score ?? 0);
  const isRecord = score > bestScore;
  if (isRecord) {
    bestScore = score;
    Sdk.save('best', bestScore);
  }
  ui.setBest(bestScore);
  ui.show('won', { score });
  Sdk.levelCleared({ score, ring: RING_COUNT });
  setBgm('none');
}

function showUpgrade() {
  if (!run) return;
  const options = pickUpgradeOptions(run.rng, run.upgradeIds);
  if (!options.length) return; // 无升级可选时不停顿，直接继续
  state = 'upgrade';
  ui.renderUpgrades(options);
  ui.show('upgrade');
}

function chooseUpgrade(id) {
  if (!run) return;
  run.applyUpgrade(id);
  audio.unlock();
  state = 'playing';
  ui.show('playing');
  lastTime = performance.now();
}

async function shareResult() {
  const score = Math.floor(run?.score ?? 0);
  await Sdk.share({
    title: 'ENDLESS ORB',
    text: `${i18n.lang === 'zh' ? `我在 ENDLESS ORB 拿了 ${score} 分！` : `I scored ${score} in ENDLESS ORB!`}`,
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
    renderer.event(ev.type, ev);
    if (state === 'playing') ui.tutorial.onGameEvent(ev);

    if (ev.type === 'pin') Sdk.track('pin', { heavy: false });
    else if (ev.type === 'heavyPin') Sdk.track('pin', { heavy: true });
    else if (ev.type === 'ringClear') Sdk.track('ringClear', { ring: ev.ring });
    else if (ev.type === 'sceneEnter') Sdk.track('scene_enter', { ring: ev.ring });

    if (ev.type === 'ringClear' && run && run.phase === 'playing' && run.ring <= RING_COUNT) {
      showUpgrade();
    }
  }
}

// ---------- 主循环 ----------
function loop(now) {
  requestAnimationFrame(loop);

  if (state !== 'playing') {
    renderer.draw((state === 'paused' || state === 'dead' || state === 'won' || state === 'upgrade') ? run : null, 1);
    return;
  }

  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  accumulator += dt;

  let steps = 0;
  while (accumulator >= STEP && steps < 6 && state === 'playing') {
    run.step({ fire: fireQueued });
    fireQueued = false;
    accumulator -= STEP;
    steps++;
    dispatchEvents(run.drainEvents());
    if (run.phase === 'dead') { onDeath(); return; }
    if (run.phase === 'won') { onWin(); return; }
  }

  const hud = run.getHud();
  setBgm(run.ring >= 9 ? 'tense' : 'main');
  renderer.draw(run, accumulator / STEP);
  ui.setHud(hud);
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
  // boot 竞态守卫：异步 SDK 加载期间玩家已点 Start 则不再顶掉
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
    layout: () => ({ viewport: [canvas.clientWidth, canvas.clientHeight], core: [WORLD.CORE_X, WORLD.CORE_Y] }),
    jump: (r) => { if (run) run.jumpTo(r); },
    pin: (n, heavy) => { if (run) run.debugPin(n, heavy); },
  },
};
