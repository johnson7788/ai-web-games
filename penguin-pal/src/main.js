// 主入口：60Hz 固定步长装配 sim / render / ui / audio / sdk + 标准调试契约。
import { STEP } from '../config/game.config.js';
import { createRun } from './game/sim.js';
import { createRenderer } from './render/index.js';
import { ui } from './ui/ui.js';
import { i18n, t } from './core/i18n.js';
import { save } from './core/save.js';
import { Sdk } from './core/sdk.js';
import { createAudio } from './core/audio.js';

const canvas = document.getElementById('canvas');
const renderer = createRenderer(canvas);
const audio = createAudio({});

let run = createRun();
let phase = 'title';            // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let wonHandled = false;

let tutorialStep = -1;          // -1 = 未激活
let tutorialDone = !!save.load('tutorialDone', false);
let muted = !!save.load('muted', false);

const TUT_STEPS = () => [
  { id: 'feed', titleKey: 'tut1Title', textKey: 'tut1Text' },
  { id: 'wish', titleKey: 'tut2Title', textKey: 'tut2Text' },
  { id: 'work', titleKey: 'tut3Title', textKey: 'tut3Text' },
  { id: 'level', titleKey: 'tut4Title', textKey: 'tut4Text' },
];

// ---------- 事件 → 反馈 ----------
function handleEvent(e) {
  const cx = 640;
  const cy = 430;
  switch (e.type) {
    case 'feed': audio.event('feed'); renderer.burst(cx - 40, cy + 60, 'heart', 6, '#ff8fb3'); break;
    case 'wash': audio.event('wash'); renderer.burst(cx, cy + 40, 'star', 8, '#7fd8ff'); break;
    case 'rest': audio.event('rest'); renderer.burst(cx - 60, cy - 60, 'star', 4, '#c9a7ff'); break;
    case 'play': audio.event('play'); renderer.burst(cx, cy + 40, 'star', 8, '#ffd166'); break;
    case 'train': audio.event('train'); renderer.burst(cx, cy - 40, 'star', 6, '#6fe3c1'); break;
    case 'work': audio.event('work'); renderer.burst(cx, cy + 60, 'star', 6, '#ffd166'); break;
    case 'buy': audio.event('buy'); renderer.burst(cx + 40, cy, 'star', 8, '#ffd166'); break;
    case 'combo': audio.event('combo'); renderer.popup(cx, cy - 120, `${t('combo')} ×${e.combo}`, { color: '#ff5d8f', size: 26 }); break;
    case 'levelup': audio.event('levelup'); renderer.popup(cx, cy - 170, t('levelup'), { color: '#ff9f43', size: 36 }); renderer.flashScreen(0.4); break;
    case 'win': audio.event('win'); renderer.flashScreen(0.6); break;
    case 'need': renderer.popup(cx + 120, cy - 170, t(WISH_NEED_KEY(e.wish)), { color: '#4a6a86', size: 18 }); break;
    case 'denied': audio.event('denied'); break;
    default: break;
  }
}

function WISH_NEED_KEY(wish) {
  return { feed: 'wishFeed', wash: 'wishWash', rest: 'wishRest', play: 'wishPlay', train: 'wishTrain' }[wish] || 'wishTrain';
}

function processEvents() {
  for (const e of run.drainEvents()) handleEvent(e);
}

// ---------- 状态机 ----------
function newRun() {
  run = createRun();
  wonHandled = false;
  accumulator = 0;
  phase = 'playing';
  ui.showGame();
  Sdk.newRun({ level: 1 });
  audio.startBgm();
  lastTime = performance.now();
}

function startGame() {
  newRun();
  if (!tutorialDone) startTutorial();
}

function pauseGame() {
  if (phase === 'playing') { phase = 'paused'; ui.showPause(); }
}

function resumeGame() {
  if (phase === 'paused') { phase = 'playing'; ui.hidePause(); lastTime = performance.now(); }
}

function toTitle() {
  phase = 'title';
  run = createRun();
  wonHandled = false;
  audio.stopBgm();
  ui.showTitle();
}

function restart() {
  toTitle();
}

function onWin() {
  wonHandled = true;
  phase = 'result';
  ui.showResult(run.state.stars);
  audio.event('win');
  Sdk.levelCleared({ level: run.state.level, stars: run.state.stars });
}

function doAction(name) {
  if (phase !== 'playing') return { ok: false, reason: 'phase' };
  const r = run.act(name);
  processEvents();
  if (r.ok && run.state.won && !wonHandled) onWin();
  return r;
}

function doBuy(item) {
  if (phase !== 'playing') return { ok: false, reason: 'phase' };
  const r = run.buy(item);
  processEvents();
  if (r.ok && run.state.won && !wonHandled) onWin();
  return r;
}

// ---------- 教程 ----------
function startTutorial() {
  tutorialStep = 0;
  ui.tutorial.classList.remove('hidden');
  renderTutorial();
}

function renderTutorial() {
  const s = TUT_STEPS()[tutorialStep];
  if (s) ui.setTutorialStep(s);
}

function tutorialNext() {
  tutorialStep += 1;
  if (tutorialStep >= TUT_STEPS().length) endTutorial();
  else renderTutorial();
}

function endTutorial() {
  tutorialStep = -1;
  ui.tutorial.classList.add('hidden');
  if (!tutorialDone) {
    tutorialDone = true;
    save.set('tutorialDone', true);
  }
}

// ---------- UI 绑定 ----------
ui.btnStart.addEventListener('click', startGame);
ui.btnHowto.addEventListener('click', () => startTutorial());
ui.btnHowto2.addEventListener('click', () => startTutorial());
ui.btnResume.addEventListener('click', resumeGame);
ui.btnRestart2.addEventListener('click', newRun);
ui.btnHome.addEventListener('click', toTitle);
ui.btnHome3.addEventListener('click', toTitle);
ui.btnHome2.addEventListener('click', toTitle);
ui.btnNew.addEventListener('click', newRun);
ui.tutNext.addEventListener('click', tutorialNext);
ui.tutSkip.addEventListener('click', endTutorial);

ui.btnShop.addEventListener('click', () => {
  if (ui.shopPanel.classList.contains('hidden')) ui.showShop();
  else ui.hideShop();
});
ui.btnShopClose.addEventListener('click', () => ui.hideShop());
for (const item of ['fish', 'icecream', 'toy']) {
  const btn = document.querySelector(`.shop-item[data-item="${item}"]`);
  if (btn) btn.addEventListener('click', () => doBuy(item));
}

for (const b of document.querySelectorAll('.act-btn[data-action]')) {
  b.addEventListener('click', () => doAction(b.getAttribute('data-action')));
}

ui.btnMute.addEventListener('click', () => {
  muted = audio.toggleMuted();
  ui.setMuted(muted);
  save.set('muted', muted);
});

for (const sel of ui.langSelects) {
  if (sel) sel.addEventListener('change', (e) => ui.setLang(e.target.value));
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
});

// ---------- 主循环 ----------
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  if (phase === 'playing') {
    accumulator += dt;
    while (accumulator >= STEP) {
      run.step(STEP);
      processEvents();
      accumulator -= STEP;
    }
    ui.updateHUD(run.getHud());
    if (run.state.won && !wonHandled) onWin();
  }

  renderer.render(run, now);
}

// ---------- 启动 ----------
ui.applyLang();
ui.setMuted(muted);
ui.showTitle();
Sdk.ready();          // 不 await，不阻塞首屏（sdk-check 需要 window.PipyGames 注入）
Sdk.track('load', {});
renderer.render(run, performance.now());
requestAnimationFrame(loop);

// ---------- 标准调试契约 ----------
window.G = {
  run,
  state: () => phase,
  ui,
  save,
  createRun,
};

window.__ll = {
  get state() { return { phase, lang: ui.lang, dir: ui.dir }; },
  lang: () => ui.lang,
  setLang: (lang) => ui.setLang(lang),
  get run() { return run; },
  start: startGame,
  pause: pauseGame,
  resume: resumeGame,
  restart,
  startAct: startGame,
  startTutorial,
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return TUT_STEPS().map((s) => s.id); },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  save: () => save,
  ui: () => ui,
  debug: {
    state: () => run.state,
    hud: () => run.getHud(),
    act: doAction,
    buy: doBuy,
    setStat: (k, v) => run.setStat(k, v),
    grantXp: (n) => { run.grantXp(n); processEvents(); if (run.state.won && !wonHandled) onWin(); },
    win: () => { run.grantXp(1000); processEvents(); if (run.state.won) onWin(); },
    setTutorialDone: (b) => { tutorialDone = !!b; save.set('tutorialDone', b); if (b) ui.tutorial.classList.add('hidden'); },
    tutorialStep: () => tutorialStep,
  },
};
