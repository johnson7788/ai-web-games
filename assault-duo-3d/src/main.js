// ASSAULT DUO 3D · 主入口：60Hz 固定步长装配（sim + render + ui + audio + sdk）
import { STEP, LEVELS, ENEMY_TYPES, WORLD } from '../config/game.config.js';
import { createRun } from './game/sim.js';
import { createRenderer } from './render/index.js';
import { ui } from './ui/ui.js';
import { createAudio } from './core/audio.js';
import { i18n } from './core/i18n.js';
import { save } from './core/save.js';
import { Sdk } from './core/sdk.js';

const canvas = document.getElementById('canvas');
const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const renderer = createRenderer(canvas, { reducedMotion: reduced });
const audio = createAudio();

let run = createRun(0);
let phase = 'title'; // title | playing | paused | result
let levelIndex = 0;
let lastLevelCleared = false;
let lastTime = performance.now();
let accumulator = 0;

function curInput() {
  return run.input;
}

// 标题屏背景：放几个装饰性敌人，让画面有玩家 vs 敌人的剪影（提升视觉可读性）
function seedTitleScene() {
  const types = ['drone', 'striker', 'gunner', 'shield'];
  types.forEach((typeKey, i) => {
    const t = ENEMY_TYPES[typeKey];
    run.state.enemies.push({
      type: typeKey,
      x: 520 + i * 170,
      y: WORLD.GROUND_Y - 26,
      hp: t.hp,
      maxHp: t.hp,
      attack: t.attack,
      speed: t.speed,
      meleeRange: t.meleeRange,
      attackCd: t.attackCd,
      attackTimer: 0,
      ranged: t.ranged,
      range: t.range,
      bulletSpeed: t.bulletSpeed,
      radius: t.radius,
      score: t.score,
      shield: t.shield,
      boss: t.boss,
      hitFlash: 0,
    });
  });
}

// ---------- 键盘 ----------
window.addEventListener('keydown', (e) => {
  const inp = curInput();
  if (e.code === 'KeyA' || e.code === 'ArrowLeft') inp.left = true;
  if (e.code === 'KeyD' || e.code === 'ArrowRight') inp.right = true;
  if (e.code === 'KeyW' || e.code === 'ArrowUp' || e.code === 'Space') {
    if (!e.repeat) inp.jump = true;
    if (e.code === 'Space') e.preventDefault();
  }
  if (e.code === 'KeyJ' || e.code === 'KeyK') inp.fire = true;
  if (e.code === 'KeyE' || e.code === 'KeyQ') { if (!e.repeat) inp.switchWeapon = true; }
  if (e.code === 'KeyF') { if (!e.repeat) inp.blast = true; }
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pause();
    else if (phase === 'paused') resume();
  }
});
window.addEventListener('keyup', (e) => {
  const inp = curInput();
  if (e.code === 'KeyA' || e.code === 'ArrowLeft') inp.left = false;
  if (e.code === 'KeyD' || e.code === 'ArrowRight') inp.right = false;
  if (e.code === 'KeyJ' || e.code === 'KeyK') inp.fire = false;
});

// 鼠标按住开火
canvas.addEventListener('mousedown', (e) => { e.preventDefault(); curInput().fire = true; });
window.addEventListener('mouseup', () => { curInput().fire = false; });

// ---------- 触屏控制 ----------
function bindHold(id, on, off) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); on(); });
  el.addEventListener('pointerup', () => off());
  el.addEventListener('pointercancel', () => off());
  el.addEventListener('pointerleave', () => off());
}
bindHold('ctl-fire', () => { curInput().fire = true; }, () => { curInput().fire = false; });
bindHold('ctl-jump', () => { curInput().jump = true; }, () => {});
bindHold('ctl-switch', () => { curInput().switchWeapon = true; }, () => {});
bindHold('ctl-blast', () => { curInput().blast = true; }, () => {});

const joy = document.getElementById('joy');
const joyKnob = document.getElementById('joy-knob');
if (joy) {
  const R = 48;
  const setJoy = (dx, dy) => {
    const inp = curInput();
    const dead = 14;
    inp.left = dx < -dead;
    inp.right = dx > dead;
    const l = Math.hypot(dx, dy);
    const cl = Math.min(l, R);
    const kx = l > 0 ? (dx / l) * cl : 0;
    const ky = l > 0 ? (dy / l) * cl : 0;
    joyKnob.style.transform = `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`;
  };
  const joyMove = (e) => {
    const r = joy.getBoundingClientRect();
    setJoy(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
  };
  joy.addEventListener('pointerdown', (e) => { e.preventDefault(); joy.setPointerCapture(e.pointerId); joyMove(e); });
  joy.addEventListener('pointermove', (e) => { if (joy.hasPointerCapture(e.pointerId)) joyMove(e); });
  joy.addEventListener('pointerup', () => { setJoy(0, 0); });
  joy.addEventListener('pointercancel', () => { setJoy(0, 0); });
}

// ---------- 状态切换 ----------
function startGame(lv) {
  levelIndex = Math.max(0, Math.min(LEVELS.length - 1, lv ?? 0));
  run = createRun(levelIndex);
  lastLevelCleared = false;
  phase = 'playing';
  ui.showGame();
  audio.unlock();
  audio.startBgm();
  Sdk.newRun({ level: levelIndex + 1 });
  if (!save.get('tutSeen', false)) {
    ui.startTutorial();
  }
}

function pause() {
  if (phase !== 'playing') return;
  phase = 'paused';
  ui.showPause();
}

function resume() {
  if (phase !== 'paused') return;
  phase = 'playing';
  ui.hidePause();
  lastTime = performance.now();
}

function restartLevel() {
  run = createRun(levelIndex);
  lastLevelCleared = false;
  phase = 'playing';
  ui.hideResult();
  ui.hidePause();
  ui.showGame();
  Sdk.newRun({ level: levelIndex + 1 });
}

function goTitle() {
  phase = 'title';
  run = createRun(0);
  seedTitleScene();
  ui.showTitle();
  audio.stopBgm();
}

function computeStars() {
  const hpRatio = run.state.player.hp / run.state.player.maxHp;
  if (hpRatio >= 0.7) return 3;
  if (hpRatio >= 0.4) return 2;
  return 1;
}

function handleResult() {
  const hud = run.getHud();
  if (run.state.phase === 'won') {
    const stars = computeStars();
    const best = save.get('best', 0);
    if (hud.score > best) save.set('best', hud.score);
    lastLevelCleared = true;
    Sdk.levelCleared({ level: levelIndex + 1, score: hud.score, stars });
    phase = 'result';
    ui.showResult({ won: true, stars, score: hud.score, isLastLevel: levelIndex >= LEVELS.length - 1 });
  } else {
    Sdk.gameOver({ level: levelIndex + 1, score: hud.score });
    phase = 'result';
    ui.showResult({ won: false, stars: 0, score: hud.score, isLastLevel: false });
  }
}

// ---------- UI 按钮 ----------
ui.btnStart.addEventListener('click', () => startGame(0));
ui.btnResume.addEventListener('click', resume);
ui.btnRestart2.addEventListener('click', restartLevel);
ui.btnHome2.addEventListener('click', goTitle);
ui.btnHome3.addEventListener('click', goTitle);
ui.btnRetry.addEventListener('click', restartLevel);
ui.btnNext.addEventListener('click', () => startGame(levelIndex + 1));
ui.tutNextBtn.addEventListener('click', () => ui.tutNext());
ui.tutSkipBtn.addEventListener('click', () => ui.tutSkip());
for (const sel of ui.langSelects) {
  if (sel) sel.addEventListener('change', (e) => ui.setLang(e.target.value));
}
document.getElementById('btn-home').addEventListener('click', goTitle);
document.getElementById('btn-restart').addEventListener('click', restartLevel);
for (const btn of document.querySelectorAll('[data-tutorial-replay]')) {
  btn.addEventListener('click', () => ui.startTutorial());
}
ui.muteBtn.addEventListener('click', () => {
  const m = audio.setMuted(!save.get('muted', false));
  save.set('muted', m);
});

// ---------- 主循环 ----------
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  if (phase === 'playing' && !ui.tutorial.active) {
    accumulator += dt;
    while (accumulator >= STEP) {
      run.step(STEP);
      accumulator -= STEP;
      if (run.state.phase !== 'playing') break;
    }
  } else {
    accumulator = 0;
  }

  const events = run.drainEvents();
  renderer.feedEvents(events);
  for (const e of events) {
    audio.event(e.type, e);
  }

  if (phase === 'playing' && (run.state.phase === 'won' || run.state.phase === 'lost')) {
    handleResult();
  }

  renderer.render(run, dt);
  if (phase === 'playing' || phase === 'paused') {
    ui.updateHUD(run.getHud());
  }
}

// ---------- 调试契约 ----------
window.__ll = {
  get state() { return { phase, lang: i18n.lang, dir: i18n.dir }; },
  get run() { return run; },
  start: (lv) => startGame(lv ?? 0),
  startAct: (lv) => startGame(lv ?? 0),
  pause,
  resume,
  restart: () => goTitle(),
  restartLevel,
  tutorial: {
    get active() { return ui.tutorial.active; },
    get step() { return ui.tutorial.step; },
    get steps() { return ui.tutorial.steps.slice(); },
    get current() { return ui.tutorial.current; },
    skip: () => ui.tutSkip(),
  },
  startTutorial: () => ui.startTutorial(),
  save: () => save,
  ui: () => ui,
  debug: {
    state: () => run.getHud(),
    startSeeded: (lv) => { levelIndex = lv ?? 0; run = createRun(levelIndex); phase = 'playing'; ui.showGame(); return true; },
  },
};

window.G = { run: () => run, phase: () => phase, ui, save };

// ---------- 启动 ----------
seedTitleScene();
ui.applyLang();
ui.showTitle();
if (save.get('muted', false)) audio.setMuted(true);
Sdk.ready().catch(() => {});
renderer.render(run, 0);
requestAnimationFrame(loop);
