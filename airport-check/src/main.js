// 主入口：AIRPORT CHECK。状态机 title → playing ⇄ paused → over/clear。
// 核对证件 + X 光 → 放行/拒绝 → 印章反馈 → 下一位。
import { WORLD, COLORS, RULES, CONFIG } from '../config/game.config.js';
import { createRun, decide, advance, nextShift, getHud, drainEvents } from './game/sim.js';
import { createRenderer } from './render/index.js';
import { ui } from './ui/ui.js';
import { audio } from './audio.js';
import Sdk from './core/sdk.js';
import { t } from './core/i18n.js';

const canvas = document.getElementById('canvas');
const renderer = createRenderer(canvas);

let run = createRun({ seed: 1 });
let state = 'title';
let deciding = false;
let best = Sdk.load('best', 0);
let lastTime = performance.now();

const llState = { phase: 'title', lang: ui.lang, dir: ui.dir };

function syncLl() {
  llState.phase = state;
  llState.lang = ui.lang;
  llState.dir = ui.dir;
}
function syncUi() {
  ui.updateHUD(getHud(run));
}
function labels() {
  return {
    passport: t('passport'), boarding: t('boarding'), xray: t('xray'),
    name: t('name'), expiry: t('expiry'), flight: t('flight'),
    dest: t('dest'), country: t('country'), today: t('today'),
  };
}
function saveBest() {
  if (run.score > best) {
    best = run.score;
    Sdk.save('best', best);
  }
}

// ---- 判定 ----------------------------------------------------------------
function doDecide(approve) {
  if (state !== 'playing' || deciding) return;
  deciding = true;
  ui.setButtonsEnabled(false);
  const r = decide(run, approve);
  audio.stamp();
  if (r.correct) {
    audio.correct();
    renderer.stamp(t('approve'), COLORS.good);
    ui.setFeedback(`${t('correct')} +${RULES.scorePerCorrect}`, 'good');
  } else {
    audio.wrong();
    renderer.stamp(t('deny'), COLORS.danger);
    ui.setFeedback(r.clean ? t('wrongClean') : t('wrongBad'), 'bad');
  }
  Sdk.track('decision', { correct: r.correct, approve });
  drainEvents(run);
  syncUi();
  window.setTimeout(() => {
    deciding = false;
    if (run.phase === 'playing') {
      advance(run);
      ui.setButtonsEnabled(true);
      ui.setFeedback('', '');
      syncUi();
    } else if (run.phase === 'over') {
      onOver();
    } else if (run.phase === 'clear') {
      onClear();
    }
  }, 950);
}

// ---- 状态机 --------------------------------------------------------------
function startGame() {
  run = createRun({ seed: Math.floor(Math.random() * 0x7fffffff) });
  deciding = false;
  state = 'playing';
  syncLl();
  Sdk.newRun({ mode: 'shifts' });
  ui.showGame();
  ui.setButtonsEnabled(true);
  syncUi();
  lastTime = performance.now();
}
function doNextShift() {
  nextShift(run);
  deciding = false;
  state = 'playing';
  syncLl();
  ui.showGame();
  ui.setButtonsEnabled(true);
  syncUi();
  lastTime = performance.now();
}
function backToTitle() {
  state = 'title';
  syncLl();
  ui.showTitle();
  ui.updateBest(best);
}
function pauseGame() {
  if (state !== 'playing' || deciding) return;
  state = 'paused';
  syncLl();
  ui.showPause();
}
function resumeGame() {
  if (state !== 'paused') return;
  state = 'playing';
  syncLl();
  ui.hidePause();
  lastTime = performance.now();
}
function onOver() {
  state = 'over';
  syncLl();
  saveBest();
  Sdk.gameOver({ score: run.score, shift: run.shift });
  ui.showOver(run.score);
  audio.over();
}
function onClear() {
  state = 'clear';
  syncLl();
  saveBest();
  Sdk.levelCleared({ shift: run.shift, score: run.score });
  ui.showClear(run.score);
  audio.clear();
}
function doMute() {
  audio.setMuted(!audio.muted);
  Sdk.save('muted', audio.muted);
  ui.updateMute(audio.muted);
}

// ---- 输入 ----------------------------------------------------------------
ui.btnApprove.addEventListener('click', () => { audio.unlock(); doDecide(true); });
ui.btnDeny.addEventListener('click', () => { audio.unlock(); doDecide(false); });

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (state === 'playing') pauseGame();
    else if (state === 'paused') resumeGame();
  }
  if (state === 'playing' && !deciding) {
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') doDecide(true);
    if (e.code === 'KeyD' || e.code === 'ArrowRight') doDecide(false);
  }
});
window.addEventListener('blur', () => { if (state === 'playing' && !deciding) pauseGame(); });

// ---- 按钮 ----------------------------------------------------------------
ui.btnStart.addEventListener('click', () => { audio.unlock(); startGame(); });
ui.btnResume.addEventListener('click', resumeGame);
ui.btnRestart.addEventListener('click', startGame);
ui.btnAgain.addEventListener('click', startGame);
ui.btnTitle.addEventListener('click', backToTitle);
ui.btnNext.addEventListener('click', doNextShift);
ui.btnTitle2.addEventListener('click', backToTitle);
ui.btnMute.addEventListener('click', doMute);
ui.btnPause.addEventListener('click', () => { if (state === 'playing') pauseGame(); });
for (const sel of ui.langSelects) {
  if (sel) sel.addEventListener('change', (e) => { ui.setLang(e.target.value); syncLl(); });
}

Sdk.onAdStart(() => pauseGame());
Sdk.onAdEnd(() => resumeGame());

// ---- 主循环 --------------------------------------------------------------
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  renderer.update(dt);
  renderer.render({ run, labels: labels(), passengerLabel: t('passenger'), shiftSize: RULES.shiftSize });
}

// ---- 初始化 --------------------------------------------------------------
Sdk.ready();
audio.setMuted(Sdk.load('muted', false));
ui.applyLang();
ui.showTitle();
ui.updateBest(best);
ui.updateMute(audio.muted);
syncLl();
syncUi();
requestAnimationFrame(loop);

// ---- 调试契约 ------------------------------------------------------------
window.G = { run: () => run, state: () => state, ui };

window.__ll = {
  state: llState,
  start: startGame,
  pause: pauseGame,
  resume: resumeGame,
  restart: backToTitle,
  startAct: startGame,
  sim: run,
  save: (k, v) => Sdk.save(k, v),
  load: (k, d) => Sdk.load(k, d),
  ui: () => ui,
  debug: {
    state: () => ({ ...getHud(run), passenger: { name: run.passenger.name, clean: run.passenger.clean, violations: run.passenger.violations } }),
    decide: (approve) => {
      const r = decide(run, approve);
      drainEvents(run);
      syncUi();
      if (run.phase === 'playing') advance(run);
      else if (run.phase === 'over') onOver();
      else if (run.phase === 'clear') onClear();
      return r;
    },
    setClean: (clean) => {
      run.passenger.clean = clean;
      run.passenger.violations = clean ? [] : ['contraband'];
      return run.passenger.clean;
    },
    forceOver: () => {
      run.strikes = RULES.maxStrikes - 1;
      run.passenger.clean = false;
      run.passenger.violations = ['contraband'];
      const r = decide(run, true);
      drainEvents(run);
      syncUi();
      if (run.phase === 'over') onOver();
      return r;
    },
  },
};