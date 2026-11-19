// GET ON BUS 3D · 主入口：60Hz 固定步长 + 标题→游戏→结算 + i18n + SDK + 标准调试契约
import { STEP, CONFIG } from '../config/game.config.js';
import { createRun } from './game/sim.js';
import { createRenderer } from './render/index.js';
import { ui } from './ui/ui.js';
import { i18n, t } from './core/i18n.js';
import { save } from './core/save.js';
import { Sdk } from './core/sdk.js';
import { createAudio } from './core/audio.js';
import { LEVEL_COUNT } from '../config/levels.js';

const canvas = document.getElementById('canvas');
const renderer = createRenderer(canvas);
const audio = createAudio();

let run = null;
let phase = 'title';          // title | playing | paused | result
let currentLevel = 0;
let lastTime = 0;
let accumulator = 0;
let resultShown = false;
let countdownEl = document.getElementById('countdown');
let goTimer = null;

// 输入：唯一动词 = 油门/刹车
const input = { gas: false };

// 教程状态
const TUTORIAL_STEP_IDS = ['tut1', 'tut2', 'tut3', 'tut4'];
const tutorial = {
  active: false,
  step: 0,
  holdMs: 0,
};

function tutorialDone() {
  try { return localStorage.getItem(CONFIG.tutorialKey) === '1'; } catch { return false; }
}
function markTutorialDone() {
  try { localStorage.setItem(CONFIG.tutorialKey, '1'); } catch { /* noop */ }
}

// 静音
let muted = save.isMuted();
audio.setMuted(muted);
ui.setMuteIcon(muted);

// ---- 教程 ----
function startTutorial() {
  tutorial.active = true;
  tutorial.step = 0;
  tutorial.holdMs = 0;
  ui.showTutorial(0);
}

function finishTutorial() {
  tutorial.active = false;
  ui.hideTutorial();
  markTutorialDone();
}

function tutNext() {
  tutorial.step += 1;
  if (tutorial.step >= TUTORIAL_STEP_IDS.length) {
    finishTutorial();
  } else {
    ui.showTutorial(tutorial.step);
  }
}

// ---- 流程 ----
function startGame(levelIndex = 0) {
  currentLevel = Math.max(0, Math.min(LEVEL_COUNT - 1, levelIndex | 0));
  run = createRun(currentLevel, { seed: Math.floor(Math.random() * 1e9) });
  resultShown = false;
  phase = 'playing';
  ui.showGame();
  audio.unlock();
  audio.startBgm();
  Sdk.newRun({ level: currentLevel + 1 });
  if (!tutorialDone()) startTutorial();
}

function pauseGame() {
  if (phase === 'playing' && !tutorial.active) {
    phase = 'paused';
    ui.showPause();
    audio.stopBgm();
  }
}

function resumeGame() {
  if (phase === 'paused') {
    phase = 'playing';
    ui.hidePause();
    lastTime = performance.now();
    audio.startBgm();
  }
}

function restartGame() {
  run = null;
  phase = 'title';
  resultShown = false;
  ui.showTitle();
  ui.updateLevelGrid(save.getProgress());
  audio.stopBgm();
  renderer.render(null);
}

function handleWin() {
  if (resultShown) return;
  resultShown = true;
  const st = run.state;
  const isNew = save.recordLevel(currentLevel, st.stars, st.coins);
  Sdk.levelCleared({ level: currentLevel + 1, stars: st.stars, coins: st.coins });
  phase = 'result';
  ui.showResult({
    won: true,
    stars: st.stars,
    coins: st.coins,
    delivered: st.delivered,
    total: st.totalPassengers,
    nearMisses: st.nearMisses,
    isLast: currentLevel >= LEVEL_COUNT - 1,
  });
  ui.updateLevelGrid(save.getProgress());
  audio.stopBgm();
  if (isNew) { /* 新星级可在这里做额外庆祝 */ }
}

function handleCrash() {
  if (resultShown) return;
  resultShown = true;
  Sdk.gameOver({ level: currentLevel + 1 });
  phase = 'result';
  ui.showResult({
    won: false,
    stars: 0,
    coins: run.state.coins,
    delivered: run.state.delivered,
    total: run.state.totalPassengers,
    nearMisses: run.state.nearMisses,
    isLast: false,
  });
  audio.stopBgm();
}

function processEvents(events) {
  for (const e of events) {
    audio.event(e.type, e);
    if (e.type === 'go') flashGo();
  }
  if (run && run.state.phase === 'won') handleWin();
  else if (run && run.state.phase === 'crashed') handleCrash();
}

function flashGo() {
  countdownEl.textContent = t('go');
  countdownEl.classList.remove('hidden');
  if (goTimer) clearTimeout(goTimer);
  goTimer = setTimeout(() => countdownEl.classList.add('hidden'), 650);
}

// ---- 输入 ----
function setGas(v) {
  input.gas = !!v;
  if (run && (phase === 'playing') && run.state.phase === 'running') run.gas(input.gas);
  // 教程第 0 步：需要真实「按住」来推进
  if (tutorial.active && tutorial.step === 0 && input.gas) {
    tutorial.holdMs += 1 / 60;
    if (tutorial.holdMs > 0.35) tutNext();
  } else if (tutorial.active && tutorial.step === 0 && !input.gas) {
    tutorial.holdMs = Math.max(0, tutorial.holdMs - 1 / 30);
  }
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
    setGas(true);
    if (e.code === 'Space') e.preventDefault();
  }
  if (e.code === 'Escape') {
    if (phase === 'playing' && tutorial.active) finishTutorial();
    else if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') setGas(false);
});

canvas.addEventListener('pointerdown', (e) => { e.preventDefault(); setGas(true); });
window.addEventListener('pointerup', () => setGas(false));
window.addEventListener('pointercancel', () => setGas(false));
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// ---- UI 事件 ----
ui.btnStart.addEventListener('click', () => startGame(0));
ui.btnResume.addEventListener('click', resumeGame);
ui.btnRetry.addEventListener('click', () => startGame(currentLevel));
ui.btnNext.addEventListener('click', () => startGame(currentLevel + 1));
ui.tutNext.addEventListener('click', tutNext);
ui.tutSkip.addEventListener('click', finishTutorial);
document.getElementById('btn-restart').addEventListener('click', () => startGame(currentLevel));
document.getElementById('btn-restart2').addEventListener('click', () => startGame(currentLevel));
document.getElementById('btn-home').addEventListener('click', restartGame);
document.getElementById('btn-home2').addEventListener('click', restartGame);
document.getElementById('btn-home3').addEventListener('click', restartGame);
ui.btnMute.addEventListener('click', () => {
  muted = !muted;
  audio.setMuted(muted);
  save.setMuted(muted);
  ui.setMuteIcon(muted);
});

for (const sel of ui.langSelects) {
  if (sel) sel.addEventListener('change', (e) => ui.setLang(e.target.value));
}
// 标题/暂停里的「玩法说明」
document.querySelectorAll('[data-tutorial-replay]').forEach((btn) => {
  btn.addEventListener('click', () => startTutorial());
});
document.getElementById('btn-help')?.addEventListener('click', () => startTutorial());
// 关卡选择格
ui.levelGrid.addEventListener('click', (e) => {
  const cell = e.target.closest('.level-cell');
  if (cell && !cell.disabled) startGame(Number(cell.dataset.level));
});

// ---- 主循环 ----
function loop(now) {
  requestAnimationFrame(loop);

  if (phase !== 'playing') {
    renderer.render(phase === 'paused' ? run : null);
    return;
  }

  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  accumulator += dt;

  const frozen = tutorial.active;
  if (!frozen) {
    while (accumulator >= STEP) {
      if (run) run.step(STEP);
      accumulator -= STEP;
      if (run && (run.state.phase === 'won' || run.state.phase === 'crashed')) break;
    }
    if (run) processEvents(run.drainEvents());
  } else {
    accumulator = 0;
  }

  // 倒计时文案
  if (run && run.state.phase === 'countdown' && !tutorial.active) {
    countdownEl.textContent = t('ready');
    countdownEl.classList.remove('hidden');
  }

  renderer.render(run);
  if (run) ui.updateHUD(run.state);
}

// ---- 初始化 ----
function applyStaticText() {
  const howtoTitle = document.getElementById('btn-howto-title');
  if (howtoTitle) howtoTitle.textContent = t('howto');
  const hint = document.getElementById('hold-hint');
  if (hint) hint.textContent = t('tapOrHold');
  const howto = document.getElementById('btn-help');
  if (howto) howto.setAttribute('aria-label', t('howto'));
}

function init() {
  ui.applyLang();
  applyStaticText();
  ui.showTitle();
  ui.updateLevelGrid(save.getProgress());
  renderer.render(null);
  // 拉 SDK（异步，失败自动降级），供 sdk-check 发现 window.PipyGames
  Sdk.ready();
  Sdk.track('load', { app: 'get-on-bus-3d' });
  requestAnimationFrame(loop);
}

// 把切语言后的静态文案也刷新
const origApply = ui.applyLang.bind(ui);
ui.applyLang = function applyLangWrapped() {
  origApply();
  applyStaticText();
};

init();

// ---- 标准调试契约 ----
window.G = {
  run: () => run,
  state: () => phase,
  ui,
  save,
};

window.__ll = {
  get state() {
    return { phase, lang: i18n.lang, dir: i18n.dir };
  },
  lang: () => i18n.lang,
  setLang: (l) => ui.setLang(l),
  get run() {
    return run;
  },
  start: (levelIndex = 0) => startGame(levelIndex),
  startAct: (n) => startGame(n == null ? 0 : n),
  pause: pauseGame,
  resume: resumeGame,
  restart: restartGame,
  tutorial: {
    get active() { return tutorial.active; },
    get step() { return tutorial.step; },
    get steps() { return TUTORIAL_STEP_IDS.slice(); },
    get current() { return TUTORIAL_STEP_IDS[tutorial.step]; },
    skip: () => finishTutorial(),
  },
  startTutorial: () => startTutorial(),
  save: () => save,
  ui: () => ui,
  debug: {
    state: () => (run ? run.state : null),
    forceWin: () => { if (run) { run.state.phase = 'won'; run.state.stars = Math.max(1, run.state.stars); handleWin(); } },
    forceCrash: () => { if (run) { run.state.phase = 'crashed'; run.state.deaths = 1; handleCrash(); } },
    fastForward: (sec) => { for (let i = 0; i < Math.floor(sec * 60); i += 1) { if (run) run.step(STEP); } if (run) processEvents(run.drainEvents()); },
  },
};
