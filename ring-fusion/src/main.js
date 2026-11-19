// Ring Fusion · 主入口：60Hz 固定步长 + 标题→关卡→结算闭环 + i18n + SDK + 调试契约
import { WORLD, STEP, COLORS, BURST_NEED } from '../config/game.config.js';
import { createRun, LEVELS, canPlace, POINTS, SLOTS, HAND } from './game/sim.js';
import { createRenderer, LAYOUT } from './render/index.js';
import { ui } from './ui/ui.js';
import { i18n, t, syncDocumentLang } from './core/i18n.js';
import { save } from './core/save.js';
import { createAudio } from './core/audio.js';
import Sdk from './core/sdk.js';

const canvas = document.getElementById('canvas');
const renderer = createRenderer(canvas);
const audio = createAudio();

let phase = 'title';       // title | playing | paused | result
let mode = 'classic';
let levelIndex = 0;
let run = null;
let result = null;
let drag = null;
let burstArmed = false;
let best = save.get('best', 0);
let tutorialStep = -1;
let tutorialDone = !!save.get('tutorialDone', false);
let lastTime = 0;
let accumulator = 0;
let demoRun = null;

// 减少动效
if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  renderer.setReduced(true);
}

function TUT_STEPS() {
  return [t('tutStep1'), t('tutStep2'), t('tutStep3'), t('tutStep4')];
}

function buildDemo() {
  demoRun = createRun({ mode: 'classic', levelIndex: 0, seed: 7 });
  const st = demoRun.state;
  const seq = [0, 1, 2, 3, 0, 1, 4, 2, 3];
  for (let p = 0; p < POINTS; p += 1) {
    const s = p % SLOTS;
    st.points[p][s] = seq[p % seq.length];
    const s2 = (p + 1) % SLOTS;
    if (p % 2 === 0) st.points[p][s2] = seq[(p * 3 + 1) % seq.length];
  }
}

// ---------- 教程 ----------
function spotlight(step) {
  const sp = ui.tutSpotlight;
  if (!sp) return;
  if (step === 0) {
    sp.style.left = '100px'; sp.style.top = `${LAYOUT.HAND_Y - 70}px`;
    sp.style.width = '440px'; sp.style.height = '150px';
  } else if (step === 3) {
    sp.style.left = '990px'; sp.style.top = '120px';
    sp.style.width = '250px'; sp.style.height = '180px';
  } else {
    sp.style.left = `${LAYOUT.BOARD.ox - 10}px`; sp.style.top = `${LAYOUT.BOARD.oy - 10}px`;
    sp.style.width = `${LAYOUT.BOARD.cell * 3 + LAYOUT.BOARD.gap * 2 + 20}px`;
    sp.style.height = `${LAYOUT.BOARD.cell * 3 + LAYOUT.BOARD.gap * 2 + 20}px`;
  }
}

function renderTutorial() {
  if (tutorialStep < 0) { ui.tutorialEl.classList.add('hidden'); return; }
  ui.tutorialEl.classList.remove('hidden');
  ui.tutText.textContent = TUT_STEPS()[tutorialStep];
  spotlight(tutorialStep);
}

function startTutorial() {
  tutorialStep = 0;
  tutorialDone = false;
  save.set('tutorialDone', false);
  renderTutorial();
}

function endTutorial() {
  tutorialStep = -1;
  tutorialDone = true;
  save.set('tutorialDone', true);
  ui.tutorialEl.classList.add('hidden');
}

function tutorialNext() {
  tutorialStep += 1;
  if (tutorialStep >= TUT_STEPS().length) endTutorial();
  else renderTutorial();
}

function tutorialAdvance(evType) {
  if (tutorialStep < 0) return;
  if (tutorialStep === 0 && evType === 'place') tutorialNext();
  else if (tutorialStep === 1 && evType === 'clear') tutorialNext();
}

// ---------- 游戏流 ----------
function seedNow() {
  return (Date.now() % 1000000) + Math.floor(Math.random() * 1000) + levelIndex * 7919;
}

function enterRun(m, lv, opts = {}) {
  mode = m;
  levelIndex = m === 'time' ? 0 : (lv ?? 0);
  run = createRun({ mode, levelIndex, seed: seedNow() });
  phase = 'playing';
  drag = null;
  burstArmed = false;
  result = null;
  ui.showGame();
  Sdk.newRun({ mode, level: levelIndex + 1 });
  audio.unlock();
  audio.startBgm();
  if (opts.showTut) startTutorial();
  else if (tutorialStep >= 0) endTutorial();
}

function start(arg) {
  const m = arg === 'time' || arg === 'timeAttack' ? 'time' : 'classic';
  showModeGoal(m);
  const lv = typeof arg === 'number' ? arg : 0;
  enterRun(m, lv, { showTut: m === 'classic' && lv === 0 && !tutorialDone });
}

function startTime() { enterRun('time', 0); }

function pause() {
  if (phase === 'playing') { phase = 'paused'; ui.showPause(); }
}

function resume() {
  if (phase === 'paused') { phase = 'playing'; ui.hidePause(); lastTime = performance.now(); }
}

function restart() {
  if (tutorialStep >= 0) endTutorial();
  if (phase === 'title') return;
  enterRun(mode, levelIndex);
}

function home() {
  phase = 'title';
  run = null;
  ui.showTitle();
  audio.stopBgm();
}

function retry() {
  enterRun(mode, levelIndex);
}

function nextLevel() {
  if (mode === 'time') { enterRun('time', 0); return; }
  enterRun('classic', (levelIndex + 1) % LEVELS.length);
}

function computeStars(s, won) {
  if (!won) return 0;
  if (s.maxCombo >= 5) return 3;
  if (s.maxCombo >= 3) return 2;
  return 1;
}

function onGameOver() {
  if (!run || phase !== 'playing') return;
  phase = 'result';
  const won = run.state.phase === 'won';
  const stars = computeStars(run.state, won);
  const isNewBest = run.state.score > best;
  if (isNewBest) { best = run.state.score; save.set('best', best); }
  result = { won, stars, score: run.state.score, combo: run.state.maxCombo, isNewBest, timeLeft: run.state.timeLeft };
  ui.showResult(result);
  audio.stopBgm();
  if (won) Sdk.levelCleared({ level: levelIndex + 1, score: run.state.score });
  else Sdk.gameOver({ score: run.state.score });
}

function drainRun() {
  if (!run) return;
  const evs = run.drainEvents();
  for (const e of evs) {
    audio.event(e.type, e);
  }
  if (run.state.phase !== 'playing' && phase === 'playing') onGameOver();
}

function hudSnapshot() {
  if (!run) return null;
  return {
    mode,
    levelIndex,
    timeLeft: run.state.timeLeft,
    score: run.state.score,
    best,
    combo: run.state.combo,
    cleared: run.state.cleared,
    target: run.state.target,
    burstMeter: run.state.burstMeter,
    burstNeed: BURST_NEED,
    burstReady: run.state.burstReady,
  };
}

// ---------- 输入 ----------
function canvasPos(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * (WORLD.WIDTH / r.width),
    y: (e.clientY - r.top) * (WORLD.HEIGHT / r.height),
  };
}

function handHit(x, y) {
  for (let h = 0; h < HAND; h += 1) {
    const px = LAYOUT.HAND_XS[h];
    const py = LAYOUT.HAND_Y;
    if (x >= px - 76 && x <= px + 76 && y >= py - 64 && y <= py + 64) return h;
  }
  return -1;
}

function pointHit(x, y) {
  for (let p = 0; p < POINTS; p += 1) {
    const c = LAYOUT.POINT_CENTER[p];
    const dx = x - c.x;
    const dy = y - c.y;
    if (dx * dx + dy * dy <= 88 * 88) return p;
  }
  return -1;
}

function dragTargets() {
  const set = new Set();
  if (!run || !drag || drag.h == null) return set;
  const tile = run.state.hand[drag.h];
  for (let p = 0; p < POINTS; p += 1) if (canPlace(tile, run.state.points[p])) set.add(p);
  return set;
}

function doPlace(h, p) {
  if (!run || phase !== 'playing') return;
  const res = run.place(h, p);
  if (res.ok) {
    renderer.spawnPlace(p);
    if (res.removed > 0) {
      const color = res.colorIndex != null ? COLORS[res.colorIndex % COLORS.length] : '#ffffff';
      renderer.spawnClear(res.affected, color);
    } else if (res.shattered > 0) {
      renderer.spawnClear(res.affected, '#b8c0d4');
    }
    tutorialAdvance('place');
    if (res.removed > 0) tutorialAdvance('clear');
  } else {
    audio.event('placeFail');
  }
  drainRun();
}

function doBurst(p) {
  if (!run || phase !== 'playing') return;
  const res = run.burst(p);
  if (res.ok) {
    renderer.spawnBurst(p);
    burstArmed = false;
    syncBurstUi();
    drainRun();
  }
}

function syncBurstUi() {
  ui.btnBurst.classList.toggle('armed', burstArmed);
  ui.btnBurst.textContent = burstArmed ? t('burstReady') : t('burst');
}

function onDown(e) {
  if (phase !== 'playing') return;
  const { x, y } = canvasPos(e);
  if (burstArmed) {
    const p = pointHit(x, y);
    if (p >= 0) doBurst(p);
    else { burstArmed = false; syncBurstUi(); }
    return;
  }
  const h = handHit(x, y);
  if (h >= 0) {
    drag = { h, x, y };
    audio.event('grab');
    try { canvas.setPointerCapture(e.pointerId); } catch { /* noop */ }
  }
}

function onMove(e) {
  if (drag) {
    const { x, y } = canvasPos(e);
    drag.x = x;
    drag.y = y;
  }
}

function onUp(e) {
  if (!drag) return;
  const { x, y } = canvasPos(e);
  const p = pointHit(x, y);
  if (p >= 0) doPlace(drag.h, p);
  drag = null;
}

canvas.addEventListener('pointerdown', onDown);
canvas.addEventListener('pointermove', onMove);
canvas.addEventListener('pointerup', onUp);
canvas.addEventListener('pointercancel', onUp);

// ---------- UI 事件 ----------
ui.btnStart.addEventListener('click', () => start(0));
ui.btnTime.addEventListener('click', () => startTime());
ui.btnHowto.addEventListener('click', () => startTutorial());
ui.btnHudHowto.addEventListener('click', () => startTutorial());
ui.btnResume.addEventListener('click', resume);
ui.btnRestart2.addEventListener('click', restart);
ui.btnHome3.addEventListener('click', home);
ui.btnRetry.addEventListener('click', retry);
ui.btnNext.addEventListener('click', nextLevel);
ui.btnHome2.addEventListener('click', home);
ui.btnPause.addEventListener('click', pause);
ui.btnMute.addEventListener('click', () => {
  const muted = save.get('muted', false) !== true;
  save.set('muted', muted);
  audio.setMuted(muted);
  ui.setMuted(muted);
});
ui.btnBurst.addEventListener('click', () => {
  if (phase !== 'playing' || !run || !run.state.burstReady) return;
  burstArmed = !burstArmed;
  syncBurstUi();
});
ui.tutSkip.addEventListener('click', endTutorial);
ui.tutNext.addEventListener('click', tutorialNext);
for (const sel of ui.langSelects) {
  if (sel) sel.addEventListener('change', (e) => ui.setLang(e.target.value));
}

// ---------- 主循环 ----------
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  if (phase === 'playing') {
    accumulator += dt;
    while (accumulator >= STEP && run) {
      run.step(STEP);
      drainRun();
      accumulator -= STEP;
    }
    renderer.update(dt);
    renderer.render(run ? run.state : null, { drag, targets: dragTargets() });
    ui.updateHUD(hudSnapshot());
  } else if (phase === 'paused' || phase === 'result') {
    renderer.update(dt);
    renderer.render(run ? run.state : null, {});
  } else {
    renderer.update(dt);
    renderer.render(demoRun ? demoRun.state : null, {});
  }
}

// ---------- 调试契约 ----------
window.__ll = {
  get state() { return { phase, lang: ui.lang, dir: ui.dir }; },
  get run() { return run; },
  start: (arg) => start(arg),
  startAct: (n) => start(typeof n === 'number' ? n : 0),
  startTime,
  pause,
  resume,
  restart,
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return TUT_STEPS(); },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  startTutorial,
  debug: {
    state: () => (run ? run.state : null),
    startLevel: (n) => start(typeof n === 'number' ? n : 0),
    startTime,
    place: (h, p) => doPlace(h, p),
    burstAt: (p) => doBurst(p),
    seedBoard: (n) => {
      if (!run) return;
      const st = run.state;
      let placed = 0;
      for (let p = 0; p < POINTS && placed < n; p += 1) {
        for (let s = 0; s < SLOTS && placed < n; s += 1) {
          if (st.points[p][s] === -1 && Math.random() < 0.62) {
            st.points[p][s] = Math.floor(Math.random() * Math.max(1, st.colors));
            placed += 1;
          }
        }
      }
    },
    autoWin: () => {
      if (!run) return;
      run.state.cleared = run.state.target;
      run.state.phase = 'won';
      drainRun();
    },
    forceLose: () => {
      if (!run) return;
      run.state.phase = 'lost';
      drainRun();
    },
  },
  save: () => save,
  ui: () => ui,
};

// ---------- 初始化 ----------
buildDemo();
audio.setMuted(save.get('muted', false) === true);
ui.setMuted(save.get('muted', false) === true);
ui.applyLang();
ui.showTitle();
Sdk.ready();
requestAnimationFrame((now) => { lastTime = now; requestAnimationFrame(loop); });


// Lead 补丁：开局显示模式目标横幅 4 秒（提升目标可见性）
function showModeGoal(mode) {
  const g = document.getElementById('mode-goal');
  if (!g) return;
  g.textContent = mode === 'time' ? t('timeGoal') : '';
  g.classList.toggle('hidden', mode !== 'time');
  clearTimeout(g._t);
  g._t = setTimeout(() => g.classList.add('hidden'), 4000);
}
