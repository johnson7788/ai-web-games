// 主入口：60Hz 固定步长 + 标题→游戏→暂停 + i18n + 调试契约 + 教程。
import { STEP, WORLD } from '../config/game.config.js';
import { createSim } from './game/sim.js';
import { stageGoal, dollByLevel } from '../config/levels.js';
import { createRenderer, slotAtPoint } from './render/index.js';
import { ui } from './ui/ui.js';
import { i18n } from './core/i18n.js';
import { save } from './core/save.js';
import { createAudio } from './core/audio.js';
import { Sdk } from './core/sdk.js';

const canvas = document.getElementById('canvas');
const renderer = createRenderer(canvas);
const audio = createAudio();

let sim = createSim({ seed: 1 });
const titleDemo = makeTitleDemo();

let phase = 'title'; // title | playing | paused
let lastTime = 0;
let accumulator = 0;
let drag = null;
let tutorialSeen = false;

// ---------- 存档 ----------
function serialize() {
  return {
    tutorialSeen,
    gold: sim.state.gold,
    totalGoldEarned: sim.state.totalGoldEarned,
    stage: sim.state.stage,
    tab: sim.state.tab,
    unlockTabs: sim.state.unlockTabs,
    tabs: sim.state.tabs.map((t) => ({
      maxLevel: t.maxLevel,
      slots: t.slots.map((s) => ({ doll: s.doll, rock: s.rock })),
    })),
  };
}

function deserialize(d) {
  const run = createSim({ seed: 1 });
  if (!d || typeof d !== 'object') return run;
  if (typeof d.gold === 'number') run.state.gold = d.gold;
  if (typeof d.totalGoldEarned === 'number') run.state.totalGoldEarned = d.totalGoldEarned;
  if (typeof d.stage === 'number') run.state.stage = d.stage;
  if (typeof d.tab === 'number') run.state.tab = d.tab;
  if (Array.isArray(d.unlockTabs)) run.state.unlockTabs = d.unlockTabs.slice(0, 3);
  if (Array.isArray(d.tabs)) {
    for (let i = 0; i < 3; i += 1) {
      const t = d.tabs[i];
      if (!t) continue;
      if (typeof t.maxLevel === 'number') run.state.tabs[i].maxLevel = t.maxLevel;
      if (Array.isArray(t.slots)) {
        t.slots.forEach((s, idx) => {
          if (idx >= 12 || !s) return;
          run.state.tabs[i].slots[idx].doll = s.doll || 0;
          run.state.tabs[i].slots[idx].rock = !!s.rock;
        });
      }
    }
  }
  return run;
}

function persist() {
  try { save.saveState(serialize()); } catch { /* 隐私模式降级 */ }
}

function makeTitleDemo() {
  const run = createSim({ seed: 11 });
  const slots = run.state.tabs[0].slots;
  const arr = [1, 1, 2, 2, 3, 4, 5, 6, 7, 8];
  arr.forEach((lv, i) => { slots[i].doll = lv; });
  slots[10].rock = true;
  run.state.tabs[0].maxLevel = 8;
  return run;
}

// ---------- 教程 ----------
const TUTORIAL_STEPS = [
  { id: 'summon', titleKey: 'tut1Title', textKey: 'tut1Text', target: () => ui.buyBtn },
  { id: 'merge', titleKey: 'tut2Title', textKey: 'tut2Text', target: () => canvas },
  { id: 'stage', titleKey: 'tut3Title', textKey: 'tut3Text', target: () => ui.stageBar.parentElement },
];

const tutorialState = {
  active: false,
  step: 0,
  steps: TUTORIAL_STEPS.map((s) => s.id),
};

function renderTutorialStep() {
  const s = TUTORIAL_STEPS[tutorialState.step];
  if (s) ui.renderTutorial({ titleKey: s.titleKey, textKey: s.textKey, target: s.target() });
}

function showTutorialOverlay() {
  document.getElementById('tutorial').classList.remove('hidden');
}

function hideTutorialOverlay() {
  document.getElementById('tutorial').classList.add('hidden');
  ui.clearTutorialHighlight();
}

function startTutorial() {
  tutorialState.active = true;
  tutorialState.step = 0;
  showTutorialOverlay();
  renderTutorialStep();
}

function skipTutorial() {
  tutorialState.active = false;
  tutorialSeen = true;
  hideTutorialOverlay();
  persist();
}

function advanceTutorial() {
  if (tutorialState.step >= TUTORIAL_STEPS.length - 1) {
    skipTutorial();
    return;
  }
  tutorialState.step += 1;
  renderTutorialStep();
}

function handleTutorialEvent(evt) {
  if (!tutorialState.active) return;
  const stepId = TUTORIAL_STEPS[tutorialState.step].id;
  if (stepId === 'summon' && evt.type === 'buy') advanceTutorial();
  else if (stepId === 'merge' && evt.type === 'merge') advanceTutorial();
  else if (stepId === 'stage' && (evt.type === 'stage' || (evt.type === 'merge' && sim.maxLevel() >= stageGoal(0)))) {
    advanceTutorial();
  }
}

// ---------- HUD ----------
function buyLevelOf() {
  const st = sim.state;
  const maxLevel = Math.max(1, st.tabs[st.tab].maxLevel);
  for (let L = maxLevel; L >= 1; L -= 1) {
    if (st.gold >= dollByLevel(L).cost) return L;
  }
  return 1;
}

function hudInfo() {
  const st = sim.state;
  const goal = stageGoal(st.stage - 1);
  const mx = sim.maxLevel();
  const buyLevel = buyLevelOf();
  return {
    gold: st.gold,
    gps: sim.prodPerSec(),
    combo: st.combo,
    comboActive: st.time < st.comboBoostUntil,
    stage: st.stage,
    stageLabel: `Lv ${mx}/${goal}`,
    stagePct: Math.min(100, (mx / goal) * 100),
    buyLevel,
    buyCost: dollByLevel(buyLevel).cost,
    tab: st.tab,
    unlockTabs: st.unlockTabs,
  };
}

// ---------- 事件消费 ----------
function consumeEvents() {
  for (const evt of sim.drainEvents()) {
    renderer.applyEvent(evt);
    if (evt.type !== 'produce') audio.event(evt.type, evt);
    handleTutorialEvent(evt);
    handleToast(evt);
    if (evt.type === 'stage') Sdk.levelCleared({ stage: evt.stage, level: sim.maxLevel() });
  }
}

function handleToast(evt) {
  if (evt.type === 'error') {
    if (evt.reason === 'gold') ui.showToast(i18n.get('notEnough'));
    else if (evt.reason === 'space') ui.showToast(i18n.get('noSpace'));
    else if (evt.reason === 'max') ui.showToast(i18n.get('maxLevel'));
    else if (evt.reason === 'locked') ui.showToast(i18n.get('tabLocked', { n: 2 }));
  } else if (evt.type === 'stage') {
    ui.showToast(i18n.get('stageClear', { n: evt.stage - 1, reward: evt.reward }));
  } else if (evt.type === 'unlock') {
    ui.showToast(i18n.get('unlock'));
  } else if (evt.type === 'rock') {
    ui.showToast(i18n.get('rockBroken', { n: evt.reward }));
  }
}

// ---------- 游戏流程 ----------
function start() {
  audio.unlock();
  audio.startBgm();
  phase = 'playing';
  ui.showGame();
  Sdk.newRun({ genre: 'sim' });
  if (!tutorialSeen) startTutorial();
  lastTime = performance.now();
}

function pause() {
  if (phase !== 'playing') return;
  phase = 'paused';
  ui.showPause();
  persist();
}

function resume() {
  if (phase !== 'paused') return;
  phase = 'playing';
  ui.hidePause();
  lastTime = performance.now();
}

function restart() {
  phase = 'title';
  sim = createSim({ seed: 1 });
  drag = null;
  hideTutorialOverlay();
  tutorialState.active = false;
  ui.showTitle();
  persist();
}

// ---------- 输入 ----------
function clientToBoard(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (WORLD.WIDTH / Math.max(1, rect.width)),
    y: (e.clientY - rect.top) * (WORLD.HEIGHT / Math.max(1, rect.height)),
  };
}

canvas.addEventListener('pointerdown', (e) => {
  if (phase !== 'playing') return;
  audio.unlock();
  const p = clientToBoard(e);
  const slot = slotAtPoint(p.x, p.y);
  if (slot < 0) return;
  const s = sim.state.tabs[sim.state.tab].slots[slot];
  if (s.rock) { sim.tapRock(slot); return; }
  if (s.doll > 0) {
    drag = { from: slot, x: p.x, y: p.y, level: s.doll };
  }
});

window.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const p = clientToBoard(e);
  drag.x = p.x;
  drag.y = p.y;
});

window.addEventListener('pointerup', (e) => {
  if (!drag) return;
  const p = clientToBoard(e);
  const el = document.elementFromPoint(e.clientX, e.clientY);
  if (el && el.closest('#recycle-bin')) {
    sim.sell(drag.from);
  } else {
    const slot = slotAtPoint(p.x, p.y);
    if (slot >= 0 && slot !== drag.from) sim.drag(drag.from, slot);
  }
  drag = null;
});

canvas.addEventListener('pointercancel', () => { drag = null; });

// ---------- UI 事件 ----------
ui.btnStart.addEventListener('click', start);
ui.btnResume.addEventListener('click', resume);
ui.btnRestart2.addEventListener('click', restart);
ui.btnMenu.addEventListener('click', restart);
document.getElementById('btn-restart').addEventListener('click', restart);
ui.btnMute.addEventListener('click', () => {
  const muted = audio.setMuted(!ui.btnMute.dataset.muted);
  ui.btnMute.dataset.muted = muted ? '1' : '';
  ui.btnMute.textContent = muted ? '✕' : '♪';
});
ui.buyBtn.addEventListener('click', () => {
  if (phase !== 'playing') return;
  audio.unlock();
  audio.event('click');
  sim.buy();
});
for (const btn of document.querySelectorAll('[data-tutorial-replay]')) {
  btn.addEventListener('click', () => { startTutorial(); });
}
ui.tutSkip.addEventListener('click', skipTutorial);
ui.tutNext.addEventListener('click', advanceTutorial);
for (const sel of ui.langSelects) {
  if (sel) sel.addEventListener('change', (e) => ui.setLang(e.target.value));
}
for (const tab of document.querySelectorAll('.tab')) {
  tab.addEventListener('click', () => {
    if (phase !== 'playing') return;
    const idx = Number(tab.dataset.tab);
    sim.switchTab(idx);
    if (!sim.state.unlockTabs[idx]) {
      ui.showToast(i18n.get('tabLocked', { n: idx === 1 ? 3 : 4 }));
    }
  });
}

// ---------- 主循环 ----------
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - lastTime) / 1000, 0.1) || 0;
  lastTime = now;

  if (phase === 'playing') {
    accumulator += dt;
    while (accumulator >= STEP) {
      sim.step(STEP);
      accumulator -= STEP;
    }
    consumeEvents();
    renderer.render(sim.state, dt, { drag });
    ui.updateHUD(hudInfo());
  } else if (phase === 'paused') {
    renderer.render(sim.state, dt, { drag });
  } else {
    renderer.render(titleDemo.state, dt);
  }
}

// ---------- 视口适配（letterbox 缩放）----------
function fit() {
  const s = Math.min(window.innerWidth / WORLD.WIDTH, window.innerHeight / WORLD.HEIGHT);
  document.documentElement.style.setProperty('--scale', String(Math.max(0.25, s)));
}
window.addEventListener('resize', fit);
fit();

// ---------- 存档定时 + 页面隐藏 ----------
setInterval(persist, 5000);
window.addEventListener('pagehide', persist);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') persist();
});

// ---------- 初始化 ----------
tutorialSeen = !!save.get('tutorialSeen', false);
const loaded = save.loadState(null);
if (loaded && typeof loaded.gold === 'number') sim = deserialize(loaded);

Sdk.ready();
ui.applyLang();
ui.showTitle();
lastTime = performance.now();
requestAnimationFrame(loop);

// ---------- 调试契约 ----------
window.G = { sim: () => sim, state: () => phase, ui, save };

window.__ll = {
  get state() { return { phase, lang: ui.lang, dir: ui.dir }; },
  get run() { return sim; },
  start,
  pause,
  resume,
  restart,
  startTutorial,
  tutorial: {
    get active() { return tutorialState.active; },
    get step() { return tutorialState.step; },
    get steps() { return tutorialState.steps; },
    get current() { return TUTORIAL_STEPS[tutorialState.step]?.id ?? null; },
    skip: skipTutorial,
  },
  save: () => save,
  ui: () => ui,
  debug: {
    state: () => sim.state,
    buy: () => sim.buy(),
    merge: (a, b) => sim.drag(a, b),
    sell: (a) => sim.sell(a),
    tapRock: (a) => sim.tapRock(a),
    maxLevel: () => sim.maxLevel(),
    seedPair: () => {
      const st = sim.state.tabs[sim.state.tab];
      st.slots[0].doll = 1;
      st.slots[1].doll = 1;
      return true;
    },
    skipTutorial: () => { tutorialSeen = true; tutorialState.active = false; hideTutorialOverlay(); },
  },
};
