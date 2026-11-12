// 主入口：60Hz 固定步长 + 标题/游戏/暂停/过关 + 拆螺丝手感（棘轮音 + 旋转 + 掉板震屏）
import { STEP, WORLD, GAME } from '../config/game.config.js';
import { LEVEL_COUNT } from '../config/levels.js';
import { createRun } from './game/sim.js';
import { screwWorld } from './game/level.js';
import { createRenderer } from './render/index.js';
import { createAudio } from './core/audio.js';
import { ui } from './ui/ui.js';
import Sdk from './core/sdk.js';

const canvas = document.getElementById('canvas');
const renderer = createRenderer(canvas);
const audio = createAudio();
const run = createRun();

let phase = 'title'; // title | playing | paused | win
const llState = { phase: 'title', lang: ui.lang };
let lastTime = performance.now();
let accumulator = 0;

let effects = [];
let shake = { t: 0, amp: GAME.SHAKE_AMP };
let lockFlash = null;
let hoverScrewId = null;
let selectedLevel = 0;
let unlocked = 0;
let totalStars = 0;

const reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// 持久化（统一走 Sdk，禁止直接 localStorage）
const muted = !!Sdk.load('muted', false);
unlocked = Math.max(1, Sdk.load('unlocked', 1) | 0);
totalStars = Sdk.load('stars', 0) | 0;
selectedLevel = Sdk.load('lastLevel', 0) | 0;

Sdk.ready(); // 不 await，不阻塞首屏
Sdk.onAdStart(() => pauseGame());
Sdk.onAdEnd(() => resumeGame());

audio.setMuted(muted);
ui.setMuted(muted);
run.unlocked = unlocked;
run.totalStars = totalStars;

function setPhase(p) {
  phase = p;
  llState.phase = p;
  llState.lang = ui.lang;
}

// —— 输入：命中判定（世界坐标，考虑 letterbox 缩放）——
function screenToWorld(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (canvas.width / rect.width),
    y: (e.clientY - rect.top) * (canvas.height / rect.height),
  };
}

function hitScrew(wx, wy) {
  if (!run.level) return null;
  const st = run.level.getState();
  for (let i = st.plates.length - 1; i >= 0; i -= 1) {
    const p = st.plates[i];
    if (p.removed) continue;
    for (const s of p.screws) {
      if (s.removed) continue;
      const w = screwWorld(p, s);
      const dx = wx - w.x;
      const dy = wy - w.y;
      if (dx * dx + dy * dy <= GAME.SCREW_HIT_RADIUS * GAME.SCREW_HIT_RADIUS) return s.id;
    }
  }
  return null;
}

// —— 效果/事件 ——
function spawnFlyScrew(ev) {
  effects.push({
    kind: 'flyScrew',
    x0: ev.x,
    y0: ev.y,
    x: ev.x,
    y: ev.y,
    tx: 210,          // 飞向 HUD 计数（左上）
    ty: 44,
    vx: 0,
    vy: 0,
    rot: 0,
    vr: GAME.FLY_ROT / GAME.FLY_TIME, // 540° 旋出
    t: 0,
    ttl: GAME.FLY_TIME,
    cross: ev.cross,
  });
}

function spawnDust(ev) {
  for (let i = 0; i < 16; i += 1) {
    effects.push({
      kind: 'dust',
      x: ev.x + (Math.random() - 0.5) * 170,
      y: ev.y + (Math.random() - 0.5) * 16,
      vx: (Math.random() - 0.5) * 130,
      vy: -55 - Math.random() * 95,
      t: 0,
      ttl: 0.5 + Math.random() * 0.4,
      size: 6 + Math.random() * 9,
    });
  }
}

function onClear() {
  const stars = run.completeLevel();
  unlocked = run.unlocked;
  totalStars = run.totalStars;
  Sdk.save('stars', totalStars);
  Sdk.save('unlocked', unlocked);
  Sdk.levelCleared({ level: run.levelIndex + 1, stars });
  const hasNext = run.levelIndex + 1 < LEVEL_COUNT;
  const hasPrev = run.levelIndex > 0;
  setPhase('win');
  audio.win();
  ui.showWin(stars, run.level ? run.level.time : 0, run.level ? run.level.totalScrews : 0, hasPrev, hasNext);
}

function flushEvents(events) {
  for (const ev of events) {
    switch (ev.type) {
      case 'unscrew':
        spawnFlyScrew(ev);
        audio.ratchet();
        Sdk.track('screw_unscrewed', { plate: ev.plateId });
        break;
      case 'locked':
        audio.dong();
        lockFlash = { id: ev.screwId, t: 0.4 };
        break;
      case 'release':
        audio.clank();
        break;
      case 'impact':
        shake.t = reducedMotion ? 0 : GAME.SHAKE_TIME;
        shake.amp = GAME.SHAKE_AMP;
        spawnDust(ev);
        audio.thud();
        break;
      case 'clear':
        onClear();
        break;
    }
  }
}

function updateEffects(dt) {
  for (const e of effects) {
    e.t += dt;
    if (e.kind === 'flyScrew') {
      const px = e.x;
      const py = e.y;
      const k = Math.min(1, e.t / e.ttl);
      const ease = 1 - Math.pow(1 - k, 3); // easeOutCubic
      const arc = Math.sin(k * Math.PI) * 60;
      e.x = e.x0 + (e.tx - e.x0) * ease;
      e.y = e.y0 + (e.ty - e.y0) * ease - arc;
      e.vx = e.x - px;
      e.vy = e.y - py;
      e.rot += e.vr * dt;
    } else if (e.kind === 'dust') {
      e.x += e.vx * dt;
      e.y += e.vy * dt;
    }
  }
  effects = effects.filter((e) => e.t < e.ttl);
  if (lockFlash && lockFlash.t > 0) lockFlash.t -= dt;
  if (shake.t > 0) shake.t -= dt;
}

function shakeOffset() {
  if (shake.t <= 0) return { x: 0, y: 0 };
  const k = shake.t / GAME.SHAKE_TIME;
  const a = shake.amp * k;
  return { x: (Math.random() * 2 - 1) * a, y: (Math.random() * 2 - 1) * a };
}

// —— 状态机 ——
function startLevel(i) {
  selectedLevel = ((i % LEVEL_COUNT) + LEVEL_COUNT) % LEVEL_COUNT;
  run.loadLevel(selectedLevel);
  run.unlocked = unlocked;
  run.totalStars = totalStars;
  ui.selectedLevel = selectedLevel;
  ui.showGame();
  ui.updateHUD({ ...run.getHud(), totalPlates: run.level.plates.length });
  effects.length = 0;
  shake.t = 0;
  lockFlash = null;
  hoverScrewId = null;
  setPhase('playing');
  Sdk.newRun({ mode: `level_${selectedLevel + 1}` });
  Sdk.save('lastLevel', selectedLevel);
  lastTime = performance.now();
  accumulator = 0;
}

function startGame() {
  audio.unlock();
  startLevel(selectedLevel);
}

function backToTitle() {
  setPhase('title');
  ui.setProgress(unlocked, totalStars, selectedLevel);
  ui.showTitle();
}

function pauseGame() {
  if (phase === 'playing') {
    setPhase('paused');
    ui.showPause();
  }
}

function resumeGame() {
  if (phase === 'paused') {
    setPhase('playing');
    ui.hidePause();
    lastTime = performance.now();
  }
}

function retryLevel() {
  if (phase === 'playing' || phase === 'paused' || phase === 'win') {
    ui.hideWin();
    startLevel(run.levelIndex);
  }
}

function nextLevel() {
  if (run.levelIndex + 1 < LEVEL_COUNT) {
    ui.hideWin();
    startLevel(run.levelIndex + 1);
  } else {
    backToTitle();
  }
}

function prevLevel() {
  if (run.levelIndex > 0) {
    ui.hideWin();
    startLevel(run.levelIndex - 1);
  }
}

// —— 事件绑定 ——
ui._onSelect = (i) => startLevel(i);
ui.btnStart.addEventListener('click', startGame);
ui.btnResume.addEventListener('click', resumeGame);
ui.btnNext.addEventListener('click', nextLevel);
ui.btnPrev.addEventListener('click', prevLevel);
ui.btnHome.addEventListener('click', backToTitle);
ui.btnHome2.addEventListener('click', backToTitle);
ui.btnRestart.addEventListener('click', retryLevel);
ui.btnMute.addEventListener('click', () => {
  audio.unlock();
  const m = audio.setMuted(!audio.isMuted());
  Sdk.save('muted', m);
  ui.setMuted(m);
});
for (const sel of ui.langSelects) {
  if (sel) sel.addEventListener('change', (e) => {
    ui.setLang(e.target.value);
    llState.lang = ui.lang;
  });
}

canvas.addEventListener('pointerdown', (e) => {
  if (phase !== 'playing') return;
  e.preventDefault();
  audio.unlock();
  const w = screenToWorld(e);
  const id = hitScrew(w.x, w.y);
  if (id) {
    run.unscrew(id);
    flushEvents(run.drainEvents());
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (phase !== 'playing') return;
  const w = screenToWorld(e);
  hoverScrewId = hitScrew(w.x, w.y);
});

canvas.addEventListener('pointerleave', () => { hoverScrewId = null; });

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
});

window.addEventListener('blur', () => { if (phase === 'playing') pauseGame(); });

// —— 主循环 ——
function loop(now) {
  requestAnimationFrame(loop);
  const rawDt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  if (phase === 'playing') {
    accumulator += rawDt;
    while (accumulator >= STEP) {
      run.step(STEP);
      accumulator -= STEP;
      flushEvents(run.drainEvents());
    }
  }
  updateEffects(rawDt);

  const so = shakeOffset();
  renderer.render({
    level: phase === 'title' ? null : run.level,
    hoverScrewId,
    effects,
    shakeX: so.x,
    shakeY: so.y,
    lockFlash,
  });

  if (phase === 'playing') {
    ui.updateHUD({ ...run.getHud(), totalPlates: run.level.plates.length });
  }
}

// —— 初始化 ——
ui.setProgress(unlocked, totalStars, selectedLevel);
ui.applyLang();
ui.showTitle();
renderer.render({ level: null, hoverScrewId: null, effects: [], shakeX: 0, shakeY: 0, lockFlash: null });
requestAnimationFrame(loop);

// —— 标准调试契约 ——
window.G = {
  run,
  state: () => phase,
  ui,
};

window.__ll = {
  state: llState,
  start: startGame,
  pause: pauseGame,
  resume: resumeGame,
  restart: backToTitle,
  sim: run,
  save: (k, v) => Sdk.save(k, v),
  ui: () => ui,
  debug: {
    loadLevel: (i) => { startLevel(i); },
    unscrew: (id) => run.unscrew(id, true),
    state: () => run.state(),
  },
};
