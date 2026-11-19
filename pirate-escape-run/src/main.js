// 主入口：60Hz 固定步长 + 标题/游戏/暂停/复活/结算 + 教程 + SDK 统一出口。
// 装配：sim(纯逻辑) / render(neon canvas) / ui(DOM) / audio(WebAudio) / Sdk(存档埋点)。
import { STEP, WORLD, RULES } from '../config/game.config.js';
import { createRun } from './game/sim.js';
import { createRenderer } from './render/index.js';
import { createAudio } from './core/audio.js';
import { ui } from './ui/ui.js';
import { i18n, t } from './core/i18n.js';
import Sdk from './core/sdk.js';

const $ = (id) => document.getElementById(id);
const canvas = $('canvas');
const renderer = createRenderer(canvas);
const audio = createAudio();

const LANE_X = (lane) => WORLD.WIDTH / 2 + WORLD.LANE_OFFSET[lane];
const ITEM_X = (lane) => WORLD.WIDTH / 2 + WORLD.ITEM_OFFSET[lane];

// ---------- 存档 ----------
let muted = !!Sdk.load('muted', false);
let best = Sdk.load('best', 0) | 0;
let totalCoins = Sdk.load('coins', 0) | 0;
let totalStars = Sdk.load('stars', 0) | 0;
let tutDone = !!Sdk.load('tutDone', false);

function persist() {
  Sdk.save('muted', muted);
  Sdk.save('best', best);
  Sdk.save('coins', totalCoins);
  Sdk.save('stars', totalStars);
  Sdk.save('tutDone', tutDone);
}

// ---------- 运行状态 ----------
let phase = 'title';   // title | playing | paused | revive | result
let run = null;
let demoRun = createRun(12345); // 标题背景用
let displayHeight = RULES.START_HEIGHT;
let lastTime = performance.now();
let accumulator = 0;
let lastNewBest = false;

// 教程状态
const tutorial = { active: false, step: 0, steps: [], current: null };

// ---------- 教程 ----------
function showTutorial() {
  tutorial.active = true;
  tutorial.step = 0;
  tutorial.steps = ui.tutorialSteps().map((s) => s.title);
  tutorial.current = tutorial.steps[0];
  ui.setTutorialStep(0);
  ui.showTutorial();
}
function hideTutorial() { tutorial.active = false; ui.hideTutorial(); }
function completeTutorial() { tutDone = true; persist(); hideTutorial(); }
function tutorialSkip() { completeTutorial(); }
function tutorialNext() {
  if (tutorial.step >= tutorial.steps.length - 1) completeTutorial();
  else {
    tutorial.step += 1;
    tutorial.current = tutorial.steps[tutorial.step];
    ui.setTutorialStep(tutorial.step);
  }
}
function startTutorial() { showTutorial(); }

// ---------- 评分 ----------
function ratingFor(score) {
  const [a, b, c] = RULES.RATING;
  if (score >= c) return 3;
  if (score >= b) return 2;
  if (score >= a) return 1;
  return 0;
}

// ---------- 事件路由 ----------
function drainAndRoute() {
  if (!run) return;
  const events = run.drainEvents();
  for (const e of events) routeEvent(e);
}

function routeEvent(e) {
  audio.event(e.type, e);
  switch (e.type) {
    case 'coin': renderer.burst('spark', ITEM_X(run.state.lane), WORLD.HERO_Y - 20); break;
    case 'star': renderer.burst('starlet', ITEM_X(run.state.lane), WORLD.HERO_Y - 24); break;
    case 'box': renderer.screenFlash('#3dff9a', 0.22); break;
    case 'powerup':
      renderer.screenFlash(e.kind === 'shield' ? '#3fe0ff' : e.kind === 'magnet' ? '#c07bff' : '#7dffd6', 0.25);
      break;
    case 'combo': renderer.burst('spark', LANE_X(run.state.lane), WORLD.HERO_Y, 6); break;
    case 'tierUp': renderer.screenFlash('#ffe066', 0.2); break;
    case 'shieldBreak': renderer.screenShake(8); renderer.screenFlash('#3fe0ff', 0.25); break;
    case 'hit': renderer.screenShake(10); renderer.screenFlash('#ff2e63', 0.4); break;
    case 'death': renderer.screenShake(12); renderer.screenFlash('#ff2e63', 0.5); break;
    case 'revive': renderer.screenFlash('#3fe0ff', 0.35); renderer.burst('splash', LANE_X(run.state.lane), WORLD.HERO_Y, 12); break;
    default: break;
  }
}

// ---------- 阶段状态机 ----------
function startGame() {
  run = createRun((Date.now() % 2147483647) || 1);
  displayHeight = run.state.height;
  lastNewBest = false;
  phase = 'playing';
  ui.showGame();
  audio.unlock();
  audio.startBgm();
  Sdk.newRun();
  Sdk.track('start');
  updateHud();
  if (!tutDone) showTutorial();
}

function pauseGame() {
  if (phase !== 'playing') return;
  phase = 'paused';
  audio.stopBgm();
  ui.showPause();
}

function resumeGame() {
  if (phase !== 'paused') return;
  phase = 'playing';
  ui.hidePause();
  audio.startBgm();
}

function goHome() {
  run = null;
  phase = 'title';
  audio.stopBgm();
  ui.showTitle();
  ui.updateStarsTotal(totalStars, totalCoins);
}

function handleDeath() {
  if (!run) return;
  audio.stopBgm();
  totalCoins += run.state.coins;
  totalStars += run.state.starGems;
  lastNewBest = run.state.score > best;
  if (lastNewBest) best = run.state.score;
  persist();
  Sdk.gameOver({ score: run.state.score });
  if (!run.state.reviveUsed) {
    phase = 'revive';
    ui.showRevive();
  } else {
    showResult();
  }
}

function showResult() {
  phase = 'result';
  ui.renderResult({
    score: run.state.score,
    best,
    coins: run.state.coins,
    starGems: run.state.starGems,
    rating: ratingFor(run.state.score),
    newBest: lastNewBest,
  });
}

function doRevive() {
  if (!run) return;
  run.revive();
  phase = 'playing';
  ui.showGame();
  audio.startBgm();
  drainAndRoute();
  updateHud();
}

function doReviveNo() { showResult(); }

function doMove(lane) {
  if (phase !== 'playing' || tutorial.active || !run || !run.state.alive) return;
  run.move(lane);
  drainAndRoute();
  updateHud();
  if (run.state.phase === 'dead') handleDeath();
}

function updateHud() {
  if (!run) return;
  ui.updateHUD(run.getHud(), best);
}

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  ui.setMuted(muted);
  Sdk.save('muted', muted);
}

// ---------- 输入 ----------
canvas.addEventListener('pointerdown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  doMove(x < rect.width / 2 ? 0 : 1);
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') { doMove(0); e.preventDefault(); }
  else if (e.code === 'ArrowRight' || e.code === 'KeyD') { doMove(1); e.preventDefault(); }
  else if (e.code === 'Escape') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  } else if (e.code === 'KeyM') { toggleMute(); }
  else if (e.code === 'KeyR') { if (phase === 'result') startGame(); }
  else if (e.code === 'Space' || e.code === 'Enter') {
    if (phase === 'title') startGame();
    else if (phase === 'result') startGame();
    e.preventDefault();
  }
});

// ---------- UI 事件 ----------
ui.btnStart.addEventListener('click', startGame);
ui.btnResume.addEventListener('click', resumeGame);
ui.btnRetry.addEventListener('click', startGame);
ui.btnHome.addEventListener('click', goHome);
ui.btnHomePause.addEventListener('click', goHome);
ui.btnHowto.addEventListener('click', startTutorial);
ui.btnHowtoPause.addEventListener('click', startTutorial);
ui.btnRevive.addEventListener('click', doRevive);
ui.btnReviveNo.addEventListener('click', doReviveNo);
ui.btnMute.addEventListener('click', toggleMute);
ui.btnPause.addEventListener('click', pauseGame);
ui.tutNext.addEventListener('click', tutorialNext);
ui.tutSkip.addEventListener('click', tutorialSkip);
for (const sel of ui.langSelects) {
  if (sel) sel.addEventListener('change', (e) => ui.setLang(e.target.value));
}

// ---------- 主循环 ----------
function loopTick(dt) {
  if (phase !== 'playing' || tutorial.active || !run) return;
  run.tick(dt);
  displayHeight += (run.state.height - displayHeight) * Math.min(1, dt * 14);
  drainAndRoute();
  updateHud();
  if (run.state.phase === 'dead') handleDeath();
}

function view() {
  const active = run || demoRun;
  return {
    phase,
    sim: active.state,
    displayHeight,
    peek: (r) => active.peek(r),
    goalLabel: t('goal'),
  };
}

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;
  accumulator += dt;
  while (accumulator >= STEP) {
    loopTick(STEP);
    accumulator -= STEP;
  }
  renderer.render(view(), dt);
}

// ---------- 初始化 ----------
ui.applyLang();
ui.showTitle();
ui.updateStarsTotal(totalStars, totalCoins);
ui.setMuted(muted);
audio.setMuted(muted);
Sdk.ready(); // 不 await，不阻塞首屏
Sdk.track('load');
requestAnimationFrame(loop);

// ---------- 调试契约 ----------
window.G = { get run() { return run; }, state: () => phase, ui, Sdk };

window.__ll = {
  get state() { return { phase, lang: i18n.lang, dir: i18n.dir }; },
  lang: () => i18n.lang,
  setLang: (lang) => ui.setLang(lang),
  get run() { return run; },
  start: startGame,
  pause: pauseGame,
  resume: resumeGame,
  restart: goHome,
  startTutorial,
  tutorial: {
    get active() { return tutorial.active; },
    get step() { return tutorial.step; },
    get steps() { return tutorial.steps; },
    get current() { return tutorial.current; },
    skip: tutorialSkip,
    next: tutorialNext,
  },
  debug: {
    state: () => (run ? run.state : null),
    setTutDone: () => { tutDone = true; persist(); },
    kill: (cause = 'water') => {
      if (!run || !run.state.alive) return;
      run.state.reviveUsed = true; // 验收直接结算，不走复活
      run.state.height = 0;
      run.tick(0);
      drainAndRoute();
      if (run.state.phase === 'dead') handleDeath();
    },
  },
  save: Sdk,
  ui,
};
