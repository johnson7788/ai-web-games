// 主入口：60Hz 固定步长 + 标题→战斗→暂停→结算 + i18n + SDK + 教程 + 标准调试契约。
import { STEP, CONFIG } from '../config/game.config.js';
import { createRun } from './game/sim.js';
import { createRenderer } from './render/index.js';
import { ui } from './ui/ui.js';
import { i18n } from './core/i18n.js';
import { save } from './core/save.js';
import { Sdk } from './core/sdk.js';
import { createAudio } from './core/audio.js';

const canvas = ui.els.canvas;
const renderer = createRenderer(canvas);
const audio = createAudio();
const reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

let run = null;
let phase = 'title';           // title | playing | paused | result
let lastTime = 0;
let accumulator = 0;
let selfActionTime = 0;
let otherActionTime = 0;
let lastFx = 0;

const tutorial = {
  active: false,
  step: 0,
  current: 'launch',
  steps: ['launch', 'skill', 'dodge', 'victory'],
};

let muted = false;

// ---------- 流程 ----------

function beginRun(tut) {
  run = createRun({ seed: (Math.random() * 0x7fffffff) | 0, tutorial: !!tut });
}

function startGame() {
  beginRun(false);
  phase = 'playing';
  accumulator = 0;
  lastTime = performance.now();
  audio.unlock();
  audio.startBgm();
  ui.showGame();
  ui.updateRound(1);
  Sdk.newRun();
}

function pauseGame() {
  if (phase === 'playing') {
    phase = 'paused';
    audio.stopBgm();
    ui.showPause();
  }
}

function resumeGame() {
  if (phase === 'paused') {
    phase = 'playing';
    lastTime = performance.now();
    ui.hidePause();
    audio.startBgm();
  }
}

function restartGame() {
  audio.stopBgm();
  beginRun(false);
  phase = 'title';
  ui.showTitle();
  Sdk.track('restart');
}

// ---------- 教程 ----------

function tutTargetEl() {
  const s = tutorial.steps[tutorial.step];
  if (s === 'launch' || s === 'victory') return ui.els.weaponRow;
  if (s === 'skill') return ui.els.skillCol;
  return ui.els.btnDodge;
}

function showTutorialStep() {
  ui.els.tutorial.classList.remove('hidden');
  ui.els.tutText.textContent = i18n.get(`tutStep${tutorial.step + 1}`);
  ui.els.tutNext.textContent = tutorial.step >= tutorial.steps.length - 1 ? i18n.get('gotIt') : i18n.get('gotIt');
  document.querySelectorAll('.tut-target').forEach((el) => el.classList.remove('tut-target'));
  const t = tutTargetEl();
  if (t) t.classList.add('tut-target');
}

function completeTutorial() {
  tutorial.active = false;
  ui.els.tutorial.classList.add('hidden');
  document.querySelectorAll('.tut-target').forEach((el) => el.classList.remove('tut-target'));
  save.set(CONFIG.tutorialKey, true);
  // 开始真正的第一战（干净重开）
  beginRun(false);
  accumulator = 0;
  lastTime = performance.now();
  ui.updateRound(1);
}

function skipTutorial() {
  completeTutorial();
}

function startTutorial() {
  if (phase !== 'playing') {
    beginRun(true);
    phase = 'playing';
    lastTime = performance.now();
    audio.unlock();
    audio.startBgm();
    ui.showGame();
    ui.updateRound(1);
    Sdk.newRun();
  }
  tutorial.active = true;
  tutorial.step = 0;
  tutorial.current = tutorial.steps[0];
  showTutorialStep();
}

function advanceTutorial() {
  if (!tutorial.active) return;
  tutorial.step += 1;
  if (tutorial.step >= tutorial.steps.length) {
    completeTutorial();
    return;
  }
  tutorial.current = tutorial.steps[tutorial.step];
  showTutorialStep();
}

// ---------- 玩家动作 ----------

function onWeapon(i) {
  if (phase !== 'playing' || !run) return;
  const res = run.playerLaunchWeapon(i);
  if (res.ok) {
    selfActionTime = performance.now();
    if (tutorial.active && tutorial.steps[tutorial.step] === 'launch') advanceTutorial();
    else if (tutorial.active && tutorial.steps[tutorial.step] === 'victory') completeTutorial();
  }
}

function onSkill(n) {
  if (phase !== 'playing' || !run) return;
  const res = run.playerUseSkill(n);
  if (res.ok) {
    selfActionTime = performance.now();
    if (tutorial.active && tutorial.steps[tutorial.step] === 'skill') advanceTutorial();
  }
}

function onDodge() {
  if (phase !== 'playing' || !run) return;
  const res = run.playerDodge();
  if (res.ok) {
    selfActionTime = performance.now();
    if (tutorial.active && tutorial.steps[tutorial.step] === 'dodge') advanceTutorial();
  }
}

// ---------- 结算 ----------

function handleEnd(e) {
  if (e.type === 'win') {
    phase = 'result';
    audio.stopBgm();
    const hud = run.getHud();
    const stars = hud.stars;
    const secs = Math.round(run.state.time);
    const meta = `${i18n.get('resultTime')} ${secs}s · ${i18n.get('stars')} ${stars}/3`;
    ui.showResult(true, stars, meta);
    const best = save.load('bestStars', 0);
    if (stars > best) save.set('bestStars', stars);
    Sdk.levelCleared({ stage: run.state.stage, stars });
  } else if (e.type === 'lose') {
    phase = 'result';
    audio.stopBgm();
    const secs = Math.round(run.state.time);
    ui.showResult(false, 0, `${i18n.get('resultTime')} ${secs}s`);
    Sdk.gameOver({ stage: run.state.stage });
  }
}

// ---------- 主循环 ----------

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  const t = now / 1000;

  if (phase === 'playing' && run) {
    accumulator += dt;
    const events = [];
    while (accumulator >= STEP) {
      run.step(STEP);
      for (const e of run.drainEvents()) events.push(e);
      accumulator -= STEP;
    }
    for (const e of events) {
      audio.event(e.type, e);
      renderer.fx(e);
      if (e.type === 'roundStart') ui.updateRound(run.state.stage);
      if (e.type === 'enemyLaunch' || e.type === 'enemySkill') otherActionTime = now;
      if (e.type === 'win' || e.type === 'lose') handleEnd(e);
    }
    renderer.stepFx(dt);
  } else if (phase !== 'paused' && phase !== 'result') {
    // 标题：渲染静态擂台（斗士待机）
    accumulator = 0;
  }

  if (run) {
    renderer.render(run, {
      time: t,
      selfAttackT: Math.min(0.4, Math.max(0, (now - selfActionTime) / 1000)),
      otherAttackT: Math.min(0.4, Math.max(0, (now - otherActionTime) / 1000)),
      reducedMotion,
    });
  }
  if (phase === 'playing') {
    ui.updateHud(run);
    ui.updateActionBar(run);
  }
}

// ---------- 事件绑定 ----------

ui.els.btnStart.addEventListener('click', () => {
  const done = save.load(CONFIG.tutorialKey, false);
  if (!done) startTutorial();
  else startGame();
});
ui.els.btnHowto.addEventListener('click', () => {
  if (phase !== 'playing') startTutorial();
});
ui.els.btnResume.addEventListener('click', resumeGame);
ui.els.btnRestart.addEventListener('click', () => { restartGame(); });
ui.els.btnHome.addEventListener('click', () => { restartGame(); });
ui.els.btnHome2.addEventListener('click', () => { restartGame(); });
ui.els.btnRetry.addEventListener('click', () => { restartGame(); startGame(); });
ui.els.btnPause.addEventListener('click', pauseGame);
ui.els.tutSkip.addEventListener('click', skipTutorial);
ui.els.tutNext.addEventListener('click', () => {
  if (!tutorial.active) return;
  // 「知道了」按钮：跳到下一步或完成
  if (tutorial.step >= tutorial.steps.length - 1) completeTutorial();
  else advanceTutorial();
});

for (let i = 0; i < 3; i += 1) {
  document.getElementById(`wbtn-${i}`).addEventListener('click', () => onWeapon(i));
}
for (let i = 0; i < 2; i += 1) {
  document.getElementById(`skill-${i}`).addEventListener('click', () => onSkill(i));
}
ui.els.btnDodge.addEventListener('click', onDodge);
ui.els.btnMute.addEventListener('click', () => {
  muted = !muted;
  audio.setMuted(muted);
  ui.setMuted(muted);
});

for (const sel of ui.els.langSelects) {
  if (sel) sel.addEventListener('change', (e) => ui.setLang(e.target.value));
}

// 键盘
window.addEventListener('keydown', (e) => {
  if (e.code === 'Digit1') onWeapon(0);
  else if (e.code === 'Digit2') onWeapon(1);
  else if (e.code === 'Digit3') onWeapon(2);
  else if (e.code === 'KeyQ' || e.code === 'KeyA') onSkill(0);
  else if (e.code === 'KeyW' || e.code === 'KeyS') onSkill(1);
  else if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') { e.preventDefault(); onDodge(); }
  else if (e.code === 'KeyM') { muted = !muted; audio.setMuted(muted); ui.setMuted(muted); }
  else if (e.code === 'Escape') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
});

// ---------- 启动 ----------

async function boot() {
  ui.applyLang();
  ui.setMuted(muted);
  beginRun(true);   // 标题背景擂台（tutorial run 不结算、AI 不动）
  phase = 'title';
  ui.showTitle();
  ui.updateRound(1);
  renderer.resize();
  window.addEventListener('resize', () => renderer.resize());
  // SDK 就绪（后台，不阻塞；失败自动降级）
  Sdk.ready().catch(() => {});
  Sdk.track('load');
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

// ---------- 调试契约 ----------

window.G = {
  get run() { return run; },
  get state() { return phase; },
  ui,
  save,
  createRun: () => { beginRun(false); return run; },
};

window.__ll = {
  get state() { return { phase, lang: ui.lang, dir: ui.dir }; },
  lang: () => ui.lang,
  setLang: (l) => ui.setLang(l),
  get run() { return run; },
  start: () => startGame(),
  startTutorial: () => startTutorial(),
  pause: pauseGame,
  resume: resumeGame,
  restart: restartGame,
  tutorial: {
    get active() { return tutorial.active; },
    get step() { return tutorial.step; },
    get steps() { return tutorial.steps; },
    get current() { return tutorial.current; },
    skip: skipTutorial,
    startTutorial,
  },
  save: (k, v) => save.set(k, v),
  ui: () => ui,
};

boot();
