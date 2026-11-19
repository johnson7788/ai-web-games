// 主入口：60Hz 固定步长 + 标题/游戏/暂停/结算 + 教程引导 + SDK 统一出口 + 调试契约
// 装配：sim / render / audio / ui / i18n / Sdk。
import { STEP, WORLD, SKILL } from '../config/game.config.js';
import { createRun } from './game/sim.js';
import { createRenderer } from './render/index.js';
import { createAudio } from './core/audio.js';
import { ui } from './ui/ui.js';
import { i18n, t, syncDocumentLang } from './core/i18n.js';
import Sdk from './core/sdk.js';

const $ = (id) => document.getElementById(id);
const canvas = $('canvas');
const renderer = createRenderer(canvas);
const audio = createAudio();

let run = null;             // 当前对局
let phase = 'title';        // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let tutorialStep = -1;      // -1 = 未激活
let novaQueued = false;     // 边沿触发：一次爆发

// 输入（键盘 + 摇杆共用）
const keys = { x: 0, y: 0 };
const joy = { active: false, id: null, ox: 0, oy: 0, dx: 0, dy: 0 };

// 视图状态（渲染/特效）
const view = {
  particles: [],
  trail: [],
  novaRing: null,
  banner: null,
  shake: 0,
};

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let best = Sdk.load('best', 0) | 0;
let tutorialDone = !!Sdk.load('tutorialDone', false);

Sdk.ready(); // 不 await，不阻塞首屏
Sdk.onAdStart(() => { if (phase === 'playing') pauseGame(true); });
Sdk.onAdEnd(() => { if (phase === 'paused') resumeGame(); });
audio.setMuted(muted);

function persist() {
  Sdk.save('muted', muted);
  Sdk.save('best', best);
  Sdk.save('tutorialDone', tutorialDone);
}

// ---------- 阶段状态机 ----------
function setPhase(p) { phase = p; }

function startRun() {
  run = createRun({ seed: (Date.now() % 2147483647) || 1 });
  view.particles = [];
  view.trail = [];
  view.novaRing = null;
  view.banner = null;
  view.shake = 0;
  setPhase('playing');
  ui.showGame();
  hideResult();
  updateHud();
  audio.startBgm();
  Sdk.newRun({ mode: 'arcade' });
  Sdk.track('start', {});
  if (!tutorialDone) startTutorial();
}

function pauseGame(silent) {
  if (phase !== 'playing') return;
  setPhase('paused');
  audio.stopBgm();
  if (!silent) ui.showPause();
}

function resumeGame() {
  if (phase !== 'paused') return;
  setPhase('playing');
  ui.hidePause();
  audio.startBgm();
}

function restartRun() {
  if (run) Sdk.track('restart', {});
  startRun();
}

function goHome() {
  run = null;
  setPhase('title');
  hideResult();
  ui.showTitle();
  updateTitleBest();
}

// ---------- 结算 ----------
function starsFor(score) {
  if (score >= 2500) return 3;
  if (score >= 1000) return 2;
  return 1;
}

function showResult() {
  const st = run.state;
  const score = Math.floor(st.score);
  const stars = starsFor(score);
  const newBest = score > best;
  if (newBest) best = score;
  persist();
  $('result-title').textContent = t('resultTitle');
  $('result-stars').innerHTML = `<span class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span><em>${t('starsLabel')}</em>`;
  $('result-meta').innerHTML =
    `<div class="rm-row"><span>${t('resultScore')}</span><b>${score}</b></div>` +
    `<div class="rm-row"><span>${t('resultWave')}</span><b>${st.wave}</b></div>` +
    `<div class="rm-row"><span>${t('resultGems')}</span><b>${st.gemCount}</b></div>` +
    `<div class="rm-row"><span>${t('resultBest')}</span><b>${best}</b>${newBest ? `<em class="newbest">${t('resultNewBest')}</em>` : ''}</div>`;
  $('screen-result').classList.remove('hidden');
}

function hideResult() {
  $('screen-result').classList.add('hidden');
}

function finishRun(ev) {
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  Sdk.gameOver({ score: ev.score, wave: ev.wave });
  audio.event('death', ev);
  showResult();
}

// ---------- HUD ----------
function updateHud() {
  if (!run) return;
  const h = run.getHud();
  $('hud-score').textContent = String(Math.floor(h.score));
  $('hud-wave').textContent = `W${h.wave}`;
  $('hud-combo').textContent = h.combo > 1 ? `×${h.combo}` : '';
  $('hud-best').textContent = `${t('best')} ${best}`;
  const pct = Math.min(100, Math.round((h.energy / h.energyMax) * 100));
  $('energy-fill').style.width = `${pct}%`;
  const ready = h.energy >= h.energyMax && (run.state.novaCd <= 0);
  $('btn-nova').classList.toggle('ready', ready);
  $('btn-nova').textContent = ready ? `◉ ${t('nova')}` : t('nova');
}

function updateTitleBest() {
  $('title-best').textContent = `${t('best')}: ${best}`;
}

// ---------- 特效 ----------
function spawnParticles(x, y, color, n, speed) {
  for (let i = 0; i < n; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.4 + Math.random() * 0.8);
    view.particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 0.5 + Math.random() * 0.4,
      maxLife: 0.9,
      color,
      size: 2 + Math.random() * 3,
    });
  }
}

// ---------- 事件消费 ----------
function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    switch (ev.type) {
      case 'gem':
        spawnParticles(ev.x, ev.y, '#ffd84e', 8, 140);
        if (ev.combo && ev.combo >= 2) {
          view.banner = { text: t('toastCombo', { n: ev.combo }), ttl: 0.9, maxTtl: 0.9 };
        }
        break;
      case 'combo':
        spawnParticles(ev.x || run.state.player.x, ev.y || run.state.player.y, '#ffd84e', 12, 180);
        break;
      case 'nearMiss':
        spawnParticles(run.state.player.x, run.state.player.y, '#7df9ff', 4, 120);
        view.shake = 1;
        break;
      case 'nova':
        view.novaRing = { x: ev.x, y: ev.y, r: SKILL.RADIUS, ttl: 0.5, maxTtl: 0.5 };
        spawnParticles(ev.x, ev.y, '#7df9ff', 26, 320);
        view.shake = 4;
        break;
      case 'rockHit':
        spawnParticles(ev.x, ev.y, '#8a9dc0', 6, 110);
        view.shake = 2;
        break;
      case 'wave':
        view.banner = { text: t('toastWave', { n: ev.wave }), ttl: 1.4, maxTtl: 1.4 };
        spawnParticles(run.state.player.x, run.state.player.y, '#2be8ff', 10, 160);
        break;
      case 'death':
        spawnParticles(ev.x, ev.y, '#ff2d78', 34, 360);
        view.shake = 8;
        finishRun(ev);
        return;
      default:
        break;
    }
  }
}

// ---------- 教程（首次自动弹，可跳过，完成/跳过后持久化） ----------
const TUT_STEPS = () => ['tutStep1', 'tutStep2', 'tutStep3'];

function startTutorial() {
  tutorialStep = 0;
  renderTutorialStep();
}

function renderTutorialStep() {
  const el = $('tutorial');
  if (tutorialStep < 0) { el.classList.add('hidden'); return; }
  const steps = TUT_STEPS();
  el.classList.remove('hidden');
  $('tut-title').textContent = t('tutTitle');
  $('tut-text').textContent = t(steps[tutorialStep] || steps[0]);
  $('tut-skip').textContent = t('tutSkip');
  $('tut-next').textContent = t('tutNext');
  $('tut-spotlight').style.display = 'none';
}

function tutorialNext() {
  tutorialStep += 1;
  if (tutorialStep >= TUT_STEPS().length) endTutorial();
  else renderTutorialStep();
}

function endTutorial() {
  tutorialStep = -1;
  tutorialDone = true;
  persist();
  renderTutorialStep();
}

// ---------- 输入 ----------
function currentAxis() {
  if (joy.active) {
    const m = Math.hypot(joy.dx, joy.dy);
    if (m < 3) return { x: 0, y: 0 };
    const k = Math.min(1, m / 60);
    return { x: (joy.dx / m) * k, y: (joy.dy / m) * k };
  }
  return { x: keys.x, y: keys.y };
}

function canvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  return { x: e.clientX, y: e.clientY };
}

function onPointerDown(e) {
  audio.unlock();
  if (phase !== 'playing') return;
  joy.active = true;
  joy.id = e.pointerId;
  joy.ox = e.clientX;
  joy.oy = e.clientY;
  joy.dx = 0;
  joy.dy = 0;
  placeJoystick(e.clientX, e.clientY);
  showJoystick(true);
}

function onPointerMove(e) {
  if (!joy.active || e.pointerId !== joy.id) return;
  joy.dx = e.clientX - joy.ox;
  joy.dy = e.clientY - joy.oy;
  const m = Math.hypot(joy.dx, joy.dy);
  const max = 60;
  const ddx = m > max ? (joy.dx / m) * max : joy.dx;
  const ddy = m > max ? (joy.dy / m) * max : joy.dy;
  $('joy-dot').style.transform = `translate(${ddx}px, ${ddy}px)`;
}

function onPointerUp(e) {
  if (e.pointerId !== joy.id) return;
  joy.active = false;
  joy.id = null;
  joy.dx = 0;
  joy.dy = 0;
  showJoystick(false);
}

function placeJoystick(cx, cy) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = WORLD.WIDTH / rect.width;
  const scaleY = WORLD.HEIGHT / rect.height;
  const j = $('joystick');
  j.style.left = `${cx}px`;
  j.style.top = `${cy}px`;
  void scaleX; void scaleY;
}

function showJoystick(on) {
  $('joystick').classList.toggle('hidden', !on);
  if (on) $('joy-dot').style.transform = 'translate(0px, 0px)';
}

canvas.addEventListener('pointerdown', onPointerDown);
canvas.addEventListener('pointermove', onPointerMove);
canvas.addEventListener('pointerup', onPointerUp);
canvas.addEventListener('pointercancel', onPointerUp);
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'w' || k === 'arrowup') keys.y = -1;
  else if (k === 's' || k === 'arrowdown') keys.y = 1;
  else if (k === 'a' || k === 'arrowleft') keys.x = -1;
  else if (k === 'd' || k === 'arrowright') keys.x = 1;
  else if (k === ' ' || k === 'j') { e.preventDefault(); novaQueued = true; }
  else if (k === 'escape' || k === 'p') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  } else if (k === 'r' && (phase === 'playing' || phase === 'paused' || phase === 'result')) {
    restartRun();
  } else if (k === 'm') toggleMute();
});

window.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'w' || k === 'arrowup') keys.y = 0;
  else if (k === 's' || k === 'arrowdown') keys.y = 0;
  else if (k === 'a' || k === 'arrowleft') keys.x = 0;
  else if (k === 'd' || k === 'arrowright') keys.x = 0;
});

function tryNova() {
  if (phase === 'playing') novaQueued = true;
}

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  $('btn-mute').classList.toggle('is-muted', muted);
  persist();
}

// ---------- UI 绑定 ----------
function bind() {
  const on = (id, fn) => {
    const el = $(id);
    if (el) el.addEventListener('click', () => { audio.unlock(); fn(); });
  };
  on('btn-start', startRun);
  on('btn-resume', resumeGame);
  on('btn-restart', restartRun);
  on('btn-restart2', restartRun);
  on('btn-retry', restartRun);
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-nova', tryNova);
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result') startTutorial(); });
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);

  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = $(id);
    if (!sel) continue;
    sel.addEventListener('change', () => {
      ui.setLang(sel.value);
      renderTutorialStep();
      if (run) updateHud();
      updateTitleBest();
      $('rotate-text').textContent = t('rotateHint');
      $('btn-rotate-skip').textContent = t('rotateSkip');
    });
  }
}

// ---------- 主循环 ----------
function frame(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;

  if (phase === 'playing' && run) {
    accumulator += dt;
    while (accumulator >= STEP) {
      const axis = currentAxis();
      run.step({ x: axis.x, y: axis.y, nova: novaQueued });
      novaQueued = false;
      accumulator -= STEP;
    }
    handleEvents(run.drainEvents());
    if (run && phase === 'playing') updateHud();

    // 尾迹
    view.trail.push({ x: run.state.player.x, y: run.state.player.y });
    if (view.trail.length > 14) view.trail.shift();
  } else {
    view.trail = [];
  }

  // 特效衰减
  if (view.shake > 0) view.shake = Math.max(0, view.shake - dt * 22);
  if (view.novaRing) {
    view.novaRing.ttl -= dt;
    if (view.novaRing.ttl <= 0) view.novaRing = null;
  }
  if (view.banner) {
    view.banner.ttl -= dt;
    if (view.banner.ttl <= 0) view.banner = null;
  }
  for (const p of view.particles) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.96;
    p.vy *= 0.96;
  }
  view.particles = view.particles.filter((p) => p.life > 0);

  // 震屏：平移 canvas 内容
  if (view.shake > 0) {
    const s = view.shake;
    canvas.style.transform = `translate(${(Math.random() - 0.5) * s}px, ${(Math.random() - 0.5) * s}px)`;
  } else {
    canvas.style.transform = '';
  }

  renderer.draw(run ? run.state : null, view);

  requestAnimationFrame(frame);
}

// ---------- 调试契约 ----------
window.__ll = {
  state: {
    get phase() { return phase; },
    get lang() { return i18n.lang; },
    get dir() { return i18n.dir; },
  },
  get run() { return run; },
  hud: () => (run ? run.getHud() : null),
  start: () => startRun(),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => restartRun(),
  home: () => goHome(),
  save: Sdk,
  ui: () => ui,
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return TUT_STEPS(); },
    get current() { return tutorialStep >= 0 ? t(TUT_STEPS()[tutorialStep]) : null; },
    skip: () => endTutorial(),
    startTutorial: () => startTutorial(),
  },
  startTutorial: () => startTutorial(),
  debug: {
    state: () => (run ? run.state : null),
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    forceDeath: () => { if (run) { run.state.phase = 'result'; run.state.player.dead = true; finishRun({ score: run.state.score, wave: run.state.wave }); } },
  },
};

// ---------- 启动 ----------
bind();
syncDocumentLang();
ui.applyLang();
$('rotate-text').textContent = t('rotateHint');
$('btn-rotate-skip').textContent = t('rotateSkip');
$('btn-mute').classList.toggle('is-muted', muted);
updateTitleBest();
Sdk.track('load', {});
requestAnimationFrame(frame);
