// 主入口：MARKET CASHIER。
// 状态机：title → playing ⇄ paused；班次结算 day；最终 ending。
import { STEP } from '../config/game.config.js';
import {
  createRun, createTutorialRun, scanItem, addMoney, resetChange, giveChange, tick,
  getHud, drainEvents, chooseUpgrade, retryDay, getUpgradeChoices,
} from './game/sim.js';
import { createRenderer } from './render/index.js';
import { ui } from './ui/ui.js';
import { audio } from './audio.js';
import Sdk from './core/sdk.js';
import { t, i18n } from './core/i18n.js';

const canvas = document.getElementById('canvas');
const renderer = createRenderer(canvas);

let run = createRun({ seed: 1 });
let state = 'title';
let best = Number(Sdk.load('best', 0)) || 0;
let tutorialDone = !!Sdk.load('tutorialDone', false) || /(?:^|[#&])tutorialDone(?:$|[&])/.test(window.location.hash);
let lastTime = performance.now();
let accumulator = 0;
let pendingScreen = null;

// 输入/遥测
let runStartedAt = 0;
let firstInputAt = null;
let firstSuccessAt = null;
let lastInteractionAt = 0;
let lastEventAt = 0;
let maxEventGapSec = 0;
let idleSec = 0;
let actions = 0;
let deaths = 0;
let policy = 'human';
const latencies = [];
const eventTypes = new Set();
let pendingInputAt = 0;

const llState = { phase: 'title', lang: ui.lang, dir: ui.dir };

function syncLl() {
  llState.phase = state;
  llState.lang = ui.lang;
  llState.dir = ui.dir;
}

function nowSec() { return (performance.now() - runStartedAt) / 1000; }

function markInteraction() {
  if (state !== 'playing') return;
  const now = performance.now();
  lastInteractionAt = now;
  if (firstInputAt === null) firstInputAt = nowSec();
  pendingInputAt = now;
  requestAnimationFrame(() => {
    if (!pendingInputAt) return;
    latencies.push(performance.now() - pendingInputAt);
    pendingInputAt = 0;
  });
}

function noteEvent(ev) {
  const now = performance.now();
  if (lastEventAt) maxEventGapSec = Math.max(maxEventGapSec, (now - lastEventAt) / 1000);
  lastEventAt = now;
  eventTypes.add(ev.type);
}

function syncUi() {
  const hud = getHud(run);
  ui.sync(hud);
  return hud;
}

// ---- 事件 → 表现 ---------------------------------------------------------
function processEvents() {
  for (const ev of drainEvents(run)) {
    noteEvent(ev);
    if (ev.type === 'scan') {
      ui.scanPulse();
      audio.scan(run.customer ? run.customer.items.filter((x) => x.scanned).length : 0);
    } else if (ev.type === 'allScanned') {
      ui.setFeedback(t('allScanned'), 'gold');
    } else if (ev.type === 'money') {
      audio.money(ev.cents);
    } else if (ev.type === 'reset') {
      audio.reset();
    } else if (ev.type === 'sale') {
      if (ev.correct) {
        if (firstSuccessAt === null) firstSuccessAt = nowSec();
        audio.sale(ev.combo || 0);
        ui.setFeedback(`${t('correct')} +${ev.gained}`, 'good');
        ui.flash('');
        ui.toast(`+$${(ev.gained / 100).toFixed(2)}`, 'good', 62, 36);
        if (ev.tip > 0) ui.toast(`${t('tip')} +$${(ev.tip / 100).toFixed(2)}`, '', 70, 44);
        Sdk.track('sale', { gained: ev.gained, combo: ev.combo, exact: ev.exact });
      } else {
        audio.wrong();
        ui.setFeedback(t('wrong'), 'bad');
        ui.shake();
        ui.flash('bad');
        ui.toast(`-$${(30 / 100).toFixed(2)}`, 'bad', 50, 46);
      }
    } else if (ev.type === 'left') {
      deaths += 1;
      audio.left();
      ui.setFeedback(t('left'), 'bad');
      ui.shake();
      ui.flash('bad');
      Sdk.track('customer_left', { reason: ev.reason });
    } else if (ev.type === 'dayClear') {
      audio.dayClear();
      Sdk.levelCleared({ day: ev.day, score: ev.dayScore });
      pendingScreen = { kind: 'dayClear', ev };
    } else if (ev.type === 'dayFail') {
      deaths += 1;
      audio.wrong();
      pendingScreen = { kind: 'dayFail', ev };
    } else if (ev.type === 'gameOver') {
      audio.gameOver();
      Sdk.gameOver({ score: ev.score, rank: ev.rank });
      pendingScreen = { kind: 'ending', ev };
    } else if (ev.type === 'upgrade') {
      audio.upgrade();
      ui.setFeedback('', '');
    } else if (ev.type === 'tutorialDone') {
      ui.showTutorialComplete();
      Sdk.track('tutorial_complete', {});
    }
  }
}


// ---- 动作 ----------------------------------------------------------------
function doScan(idx) {
  markInteraction();
  const res = scanItem(run, idx);
  if (res.ok) actions += 1;
  processEvents();
  syncUi();
  handlePending();
}

function doAddMoney(cents) {
  markInteraction();
  const res = addMoney(run, cents);
  if (res.ok) actions += 1;
  processEvents();
  syncUi();
}

function doReset() {
  markInteraction();
  const res = resetChange(run);
  if (res.ok) actions += 1;
  processEvents();
  syncUi();
}

function doGive() {
  markInteraction();
  const res = giveChange(run);
  if (res.ok) actions += 1;
  processEvents();
  syncUi();
  handlePending();
}

function handlePending() {
  if (!pendingScreen) return;
  const p = pendingScreen;
  pendingScreen = null;
  if (p.kind === 'dayClear') {
    state = 'day';
    syncLl();
    const hud = getHud(run);
    const choices = getUpgradeChoices(run, 3);
    ui.showDayClear(hud, choices, (id) => {
      chooseUpgrade(run, id);
      processEvents();
      ui.hideDay();
      state = 'playing';
      syncLl();
      syncUi();
      ui.pulseDayChip();
    });
  } else if (p.kind === 'dayFail') {
    state = 'day';
    syncLl();
    const hud = getHud(run);
    ui.showDayFail(hud, () => {
      retryDay(run);
      processEvents();
      ui.hideDay();
      state = 'playing';
      syncLl();
      syncUi();
      ui.pulseDayChip();
    });
  } else if (p.kind === 'ending') {
    state = 'ending';
    syncLl();
    if (run.score > best) { best = run.score; Sdk.save('best', best); }
    const hud = getHud(run);
    ui.showEnding(hud, best, () => startGame());
  }
}

// ---- 状态机 --------------------------------------------------------------
function beginSession(mode) {
  accumulator = 0;
  runStartedAt = performance.now();
  firstInputAt = null;
  firstSuccessAt = null;
  lastInteractionAt = runStartedAt;
  lastEventAt = 0;
  maxEventGapSec = 0;
  idleSec = 0;
  actions = 0;
  deaths = 0;
  latencies.length = 0;
  eventTypes.clear();
  pendingScreen = null;
  state = 'playing';
  syncLl();
  Sdk.newRun({ mode });
  ui.hideDay();
  ui.hideEnding();
  ui.showGame();
  ui.setFeedback('', '');
}

function startGame() {
  run = createRun({ seed: Math.floor(Math.random() * 0x7fffffff) });
  ui.endTutorialUI();
  beginSession('cashier');
  syncUi();
  ui.pulseDayChip();
  lastTime = performance.now();
}

function startTutorial() {
  run = createTutorialRun();
  beginSession('tutorial');
  ui.startTutorialUI();
  syncUi();
  lastTime = performance.now();
}

function finishTutorial() {
  tutorialDone = true;
  Sdk.save('tutorialDone', true);
  // 站点 iframe 带 sandbox，localStorage 可能不可用；hash 在刷新后仍保留，作为兜底。
  try {
    if (!/[#&]tutorialDone(?:$|[&])/.test(window.location.hash)) {
      history.replaceState(null, '', `${window.location.pathname}${window.location.search}#tutorialDone`);
    }
  } catch { /* history 不可用时忽略 */ }
  audio.unlock();
  startGame();
}

function backToTitle() {
  if (run.score > best) { best = run.score; Sdk.save('best', best); }
  state = 'title';
  syncLl();
  ui.endTutorialUI();
  ui.showTitle();
  ui.updateBest(best);
}

function pauseGame() {
  if (state !== 'playing' || ui.tutorialActive) return;
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

function doMute() {
  audio.setMuted(!audio.muted);
  Sdk.save('muted', audio.muted);
  ui.updateMute(audio.muted);
}

// ---- 输入 ----------------------------------------------------------------
ui.itemsList.addEventListener('click', (e) => {
  const row = e.target.closest('.item-row');
  if (!row || row.disabled) return;
  audio.unlock();
  doScan(Number(row.dataset.idx));
});
ui.moneyGrid.addEventListener('click', (e) => {
  const btn = e.target.closest('.money-btn');
  if (!btn || btn.disabled) return;
  audio.unlock();
  doAddMoney(Number(btn.dataset.cents));
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (state === 'playing') pauseGame();
    else if (state === 'paused') resumeGame();
    return;
  }
  if (state !== 'playing') return;
  if (e.code === 'Enter' && run.phase === 'change') { e.preventDefault(); doGive(); return; }
  if (e.code === 'KeyR' && run.phase === 'change') { e.preventDefault(); doReset(); return; }
  if (/^Digit[1-9]$/.test(e.code) && run.phase === 'scan') {
    const idx = Number(e.code.slice(5)) - 1;
    if (run.customer.items[idx] && !run.customer.items[idx].scanned) {
      e.preventDefault();
      audio.unlock();
      doScan(idx);
    }
  }
});
window.addEventListener('blur', () => { if (state === 'playing') pauseGame(); });
window.addEventListener('resize', () => ui.repositionTutorial());

// ---- 按钮 ----------------------------------------------------------------
ui.btnStart.addEventListener('click', () => { audio.unlock(); if (tutorialDone) startGame(); else startTutorial(); });
ui.btnResume.addEventListener('click', resumeGame);
ui.btnRestart.addEventListener('click', () => { audio.unlock(); startGame(); });
ui.btnTitle.addEventListener('click', backToTitle);
ui.btnGive.addEventListener('click', doGive);
ui.btnReset.addEventListener('click', doReset);
ui.btnMute.addEventListener('click', doMute);
ui.btnPause.addEventListener('click', () => { if (state === 'playing') pauseGame(); });
ui.btnAgain.addEventListener('click', () => { audio.unlock(); startGame(); });
ui.btnHowto.addEventListener('click', () => { audio.unlock(); startTutorial(); });
ui.btnHowtoPause.addEventListener('click', () => { audio.unlock(); startTutorial(); });
ui.tutorialSkip.addEventListener('click', finishTutorial);
ui.tutorialNext.addEventListener('click', finishTutorial);
for (const sel of ui.langSelects) {
  if (sel) sel.addEventListener('change', (e) => {
    ui.setLang(e.target.value);
    syncLl();
    if (state === 'playing' || state === 'paused') syncUi();
  });
}

Sdk.onAdStart(() => pauseGame());
Sdk.onAdEnd(() => resumeGame());

// ---- 主循环 --------------------------------------------------------------
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  if (state === 'playing') {
    accumulator += dt;
    while (accumulator >= STEP) {
      tick(run, STEP);
      accumulator -= STEP;
    }
    if (now - lastInteractionAt > 1500) idleSec += dt;
    processEvents();
    handlePending();
    const hud = getHud(run);
    ui.updateHUD(hud);
    renderer.update(dt);
    renderer.render({ hud, lang: i18n.lang, compact: window.innerWidth < 1000 || window.innerHeight < 620 });
  } else {
    renderer.update(dt);
    renderer.render({ hud: getHud(run), lang: i18n.lang, compact: window.innerWidth < 1000 || window.innerHeight < 620 });
  }
}

// ---- 初始化 --------------------------------------------------------------
Sdk.ready();
audio.setMuted(Sdk.load('muted', false));
ui.applyLang();
ui.showTitle();
ui.updateBest(best);
ui.updateMute(audio.muted);
syncLl();
requestAnimationFrame(loop);

// ---- 调试 / 遥测契约 -----------------------------------------------------
function telemetry(nextPolicy) {
  if (nextPolicy) policy = nextPolicy;
  const sum = latencies.reduce((a, b) => a + b, 0);
  return {
    game: 'market-cashier',
    genre: 'sim',
    policy,
    durationSec: Math.max(0.1, nowSec()),
    firstInputSec: firstInputAt === null ? 0 : Math.round(firstInputAt * 10) / 10,
    inputLatencyMs: latencies.length ? Math.round(sum / latencies.length) : 0,
    firstSuccessSec: firstSuccessAt === null ? null : Math.round(firstSuccessAt * 10) / 10,
    deaths,
    actions,
    idleSec: Math.round(idleSec * 10) / 10,
    maxEventGapSec: Math.round(maxEventGapSec * 10) / 10,
    uniqueEvents: eventTypes.size,
    levelsReached: Math.min(3, run.dayIndex + 1),
    completed: run.phase === 'ending',
  };
}

window.G = { run: () => run, state: () => state, ui };

window.__ll = {
  state: llState,
  start: startGame,
  startTutorial,
  pause: pauseGame,
  resume: resumeGame,
  restart: backToTitle,
  startAct: startGame,
  get sim() { return run; },
  save: (k, v) => Sdk.save(k, v),
  load: (k, d) => Sdk.load(k, d),
  ui: () => ui,
  telemetry,
  setPolicy: (p) => { policy = p; },
  get tutorial() {
    return {
      active: ui.tutorialActive,
      step: ui.tutorialStepIndex,
      steps: ui.tutorialSteps.map((x) => x.id),
      current: ui.tutorialSteps[ui.tutorialStepIndex]?.id || null,
      skip: finishTutorial,
    };
  },
  debug: {
    state: () => getHud(run),
    scan: (i) => { doScan(i); return getHud(run); },
    scanAll: () => { run.customer.items.forEach((_, i) => scanItem(run, i)); processEvents(); syncUi(); return getHud(run); },
    addMoney: (c) => { doAddMoney(c); return getHud(run); },
    give: () => { doGive(); return getHud(run); },
    reset: () => { doReset(); return getHud(run); },
    serveCorrect: () => {
      run.customer.items.forEach((_, i) => scanItem(run, i));
      resetChange(run);
      addMoney(run, run.customer.change);
      giveChange(run);
      processEvents();
      syncUi();
      handlePending();
      return getHud(run);
    },
    chooseUpgrade: (id) => { chooseUpgrade(run, id); processEvents(); syncUi(); return getHud(run); },
    retry: () => { retryDay(run); processEvents(); syncUi(); return getHud(run); },
    advance: (seconds) => {
      const steps = Math.floor(Math.max(0, seconds) * 60);
      for (let i = 0; i < steps; i += 1) tick(run, STEP);
      processEvents();
      syncUi();
      handlePending();
      return getHud(run);
    },
    telemetry: () => telemetry(),
  },
};
