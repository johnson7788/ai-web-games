// 主入口：60Hz 固定步长装配 + 标题→游戏→暂停→结算 + i18n + 音频 + 标准调试契约。
import { STEP, GAME } from '../config/game.config.js';
import { createRun } from './game/sim.js';
import { createRenderer } from './render/index.js';
import { ui, tutorial } from './ui/ui.js';
import { i18n } from './core/i18n.js';
import { Sdk } from './core/sdk.js';
import { createAudio } from './core/audio.js';

const canvas = document.getElementById('canvas');
const renderer = createRenderer(canvas);
const audio = createAudio();

let sim = createRun(0, { seed: (Math.random() * 1e9) | 0 });
let phase = 'title';            // title | playing | paused | won
let accumulator = 0;
let lastTime = performance.now();
let resultShown = false;

// SDK 就绪（注入 vendored pipysdk，超时自动降级；sdk-check 依赖这一步）
Sdk.ready().then(() => { Sdk.track('load', { app: 'snakes-ladders-classic' }); });

function createRunSeeded(levelIndex) {
  return createRun(levelIndex, { seed: (Math.random() * 1e9) | 0 });
}

function startGame() {
  sim = createRunSeeded(0);
  renderer.resetTokens();
  resultShown = false;
  phase = 'playing';
  ui.showGame();
  audio.unlock();
  audio.startBgm();
  Sdk.newRun({ level: 1 });
  if (!tutorial.isDone()) {
    tutorial.startTutorial();
  }
  renderer.render(sim, 1 / 60, ui.renderLabels());
}

function startLevel(levelIndex) {
  sim = createRunSeeded(levelIndex);
  renderer.resetTokens();
  resultShown = false;
  phase = 'playing';
  ui.showGame();
  audio.unlock();
  audio.startBgm();
  Sdk.newRun({ level: levelIndex + 1 });
  renderer.render(sim, 1 / 60, ui.renderLabels());
}

function pauseGame() {
  if (phase === 'playing') {
    phase = 'paused';
    ui.showPause();
  }
}

function resumeGame() {
  if (phase === 'paused') {
    phase = 'playing';
    ui.hidePause();
    lastTime = performance.now();
  }
}

function restartGame() {
  phase = 'title';
  if (tutorial.active) tutorial.skip();
  ui.showTitle();
  audio.stopBgm();
  renderer.render(sim, 1 / 60, ui.renderLabels());
}

function goHome() {
  phase = 'title';
  if (tutorial.active) tutorial.skip();
  ui.showTitle();
  audio.stopBgm();
}

function roll() {
  if (phase !== 'playing' || tutorial.active) return { ok: false };
  audio.unlock();
  return sim.roll();
}

function onWin() {
  const hud = sim.getHud();
  const human = hud.players[0];
  Sdk.levelCleared({ level: sim.state.level, stars: human.stars, gems: human.gems });
  const best = Sdk.load('bestStars', 0) || 0;
  if (human.stars > best) Sdk.save('bestStars', human.stars);
  ui.updateStarsTotal();
  ui.showResult(sim);
}

// UI 事件
ui.btnStart.addEventListener('click', () => { startGame(); });
ui.btnResume.addEventListener('click', resumeGame);
ui.btnRoll.addEventListener('click', roll);
ui.btnHelp.addEventListener('click', () => tutorial.startTutorial());
ui.btnHowto2.addEventListener('click', () => { ui.hidePause(); tutorial.startTutorial(); });
ui.btnMute.addEventListener('click', () => {
  ui.muted = audio.setMuted(!ui.muted);
  ui.applyLang();
});
ui.btnHome.addEventListener('click', goHome);
ui.btnHome2.addEventListener('click', goHome);
ui.btnHome3.addEventListener('click', goHome);
ui.btnRestart2.addEventListener('click', () => { startLevel(sim.state.levelIndex); });
ui.btnRetry.addEventListener('click', () => { startLevel(sim.state.levelIndex); });
ui.btnNext.addEventListener('click', () => { startLevel(Math.min(2, sim.state.levelIndex + 1)); });
tutorial.onSkip = () => { lastTime = performance.now(); };

for (const el of document.querySelectorAll('[data-tutorial-replay]')) {
  el.addEventListener('click', () => {
    if (phase === 'paused') ui.hidePause();
    tutorial.startTutorial();
  });
}
ui.tutSkip.addEventListener('click', () => tutorial.skip());
ui.tutNext.addEventListener('click', () => tutorial.next());
for (const sel of ui.langSelects) {
  if (sel) sel.addEventListener('change', (e) => ui.setLang(e.target.value));
}

// 键盘
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    if (phase === 'playing' && !tutorial.active) roll();
  } else if (e.code === 'Escape') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  } else if (e.code === 'KeyR') {
    if (phase === 'playing' || phase === 'paused' || phase === 'won') startLevel(sim.state.levelIndex);
  }
});

// 主循环
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  if (phase === 'playing' && !tutorial.active) {
    accumulator += dt;
    let steps = 0;
    while (accumulator >= STEP && steps < 8) {
      sim.step(STEP);
      for (const e of sim.drainEvents()) audio.event(e.type, e);
      accumulator -= STEP;
      steps += 1;
    }
    if (sim.state.phase === 'won' && !resultShown) {
      resultShown = true;
      phase = 'won';
      onWin();
    }
  }

  ui.updateHUD(sim);
  ui.updateRollButton(sim);
  renderer.render(sim, dt, ui.renderLabels());
}

// 初始化（默认英文，可 ?lang= 覆盖）
ui.applyLang();
ui.showTitle();
renderer.render(sim, 1 / 60, ui.renderLabels());
requestAnimationFrame(loop);

// 标准调试契约
window.G = {
  get sim() { return sim; },
  state: () => phase,
  ui,
  Sdk,
  createRun: (n = 0, seed = 1) => createRun(n, { seed }),
};

window.__ll = {
  get state() { return { phase, lang: ui.lang, dir: ui.dir }; },
  lang: () => ui.lang,
  setLang: (lang) => ui.setLang(lang),
  get run() { return sim; },
  start: startGame,
  startAct: (n = 0) => startLevel(n),
  pause: pauseGame,
  resume: resumeGame,
  restart: restartGame,
  roll,
  startTutorial: () => tutorial.startTutorial(),
  tutorial,
  save: () => Sdk,
  ui: () => ui,
};
