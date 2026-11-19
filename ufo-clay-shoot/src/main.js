// UFO CLAY SHOOT · 主入口：60Hz 固定步长 + 标题/游戏/暂停/结算 + 教程引导 + SDK 统一出口
import { STEP, WORLD, PLAYER, ENEMIES } from '../config/game.config.js';
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

let run = null;
let phase = 'title';           // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let fpsSamples = [];
let tutorialStep = -1;         // -1 = 未激活
let dragTarget = null;         // 移动端拖拽目标（世界坐标）

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let best = Sdk.load('best', 0) || 0;
let tutorialDone = !!Sdk.load('tutorialDone', false);

Sdk.ready();
audio.setMuted(muted);
ui.setMuted(muted);

function persist() {
  Sdk.save('muted', muted);
  Sdk.save('best', best);
  Sdk.save('tutorialDone', tutorialDone);
}

// ---------- 阶段状态机 ----------
function setPhase(p) { phase = p; }

function startRun() {
  run = createRun({ seed: (Date.now() % 2147483647) || 1 });
  dragTarget = null;
  setPhase('playing');
  ui.showGame();
  ui.hideResult();
  updateHud();
  audio.unlock();
  audio.startBgm();
  Sdk.newRun({});
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
  Sdk.track('restart', {});
  startRun();
}

function goHome() {
  run = null;
  setPhase('title');
  ui.hideResult();
  ui.showTitle();
  renderTitleBest();
}

// ---------- HUD / 标题 / 结算 ----------
function updateHud() {
  if (!run) return;
  const st = run.state;
  const score = Math.floor(st.score);
  const el = (id) => $(id);
  if (el('hud-score')) el('hud-score').textContent = `${t('score')} ${score}`;
  if (el('hud-combo')) {
    const c = el('hud-combo');
    c.textContent = `${t('combo')} ×${st.combo}`;
    c.classList.toggle('combo-hot', st.combo >= 5);
  }
  if (el('hud-time')) el('hud-time').textContent = `${t('time')} ${st.time.toFixed(1)}s`;
  if (el('hud-wave')) el('hud-wave').textContent = `${t('wave')} ${st.wave}`;
  if (el('hud-hp')) el('hud-hp').textContent = `${'♥'.repeat(Math.max(0, st.hp))}${'♡'.repeat(Math.max(0, 3 - st.hp))}`;
  if (el('hud-ammo')) {
    const a = el('hud-ammo');
    a.textContent = `${t('ammo')} ${st.ammo}`;
    a.classList.toggle('ammo-low', st.ammo <= 3);
  }
  if (el('hud-best')) el('hud-best').textContent = `${t('best')} ${Math.max(best, st.time).toFixed(1)}s`;
}

function renderTitleBest() {
  if ($('title-best')) $('title-best').textContent = `${t('bestLabel')} ${best.toFixed(1)}s`;
}

function showResult(ev) {
  const st = run.state;
  const stars = run.stars();
  const isBest = ev.time > best;
  $('result-title').textContent = t('resultWin');
  $('result-stars').innerHTML = `<span class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>`;
  $('result-time').textContent = `${t('surviveTime')} ${ev.time.toFixed(1)}s`;
  $('result-score').textContent = `${t('score')} ${Math.floor(ev.score)} · ${t('combo')} ×${st.bestCombo}`;
  $('result-best').textContent = isBest ? t('newBest') : `${t('bestLabel')} ${best.toFixed(1)}s`;
  ui.showResult();
}

function finishRun(ev) {
  setPhase('result');
  audio.stopBgm();
  audio.event('lose', ev);
  if (tutorialStep >= 0) endTutorial();
  const st = run.state;
  if (ev.time > best) {
    best = ev.time;
    persist();
  }
  Sdk.gameOver({ time: ev.time, score: Math.floor(ev.score), wave: ev.wave, kills: ev.kills });
  showResult(ev);
}

// ---------- 教程引导（首次自动弹，可跳过，完成/跳过后持久化不再自动弹） ----------
const TUT_STEPS = () => [
  { key: 'move', text: t('tutStep1') },
  { key: 'shoot', text: t('tutStep2') },
  { key: 'collect', text: t('tutStep3') },
];

function startTutorial() {
  tutorialStep = 0;
  renderTutorialStep();
}

function renderTutorialStep() {
  const el = $('tutorial');
  if (tutorialStep < 0) { el.classList.add('hidden'); return; }
  const steps = TUT_STEPS();
  const s = steps[tutorialStep];
  el.classList.remove('hidden');
  $('tut-title').textContent = t('tutTitle');
  $('tut-text').textContent = s ? s.text : '';
  $('tut-skip').textContent = t('tutSkip');
  $('tut-next').textContent = t('tutNext');
  const spot = $('tut-spotlight');
  const rect = spotlightRect(s && s.key);
  if (rect) {
    spot.style.display = 'block';
    spot.style.left = `${rect.x - 8}px`;
    spot.style.top = `${rect.y - 8}px`;
    spot.style.width = `${rect.w + 16}px`;
    spot.style.height = `${rect.h + 16}px`;
  } else {
    spot.style.display = 'none';
  }
}

function spotlightRect(key) {
  if (key === 'move') return { x: WORLD.WIDTH / 2 - 60, y: PLAYER.Y_BASE - 70, w: 120, h: 130 };
  if (key === 'shoot') return { x: WORLD.WIDTH / 2 - 100, y: 96, w: 200, h: 130 };
  return { x: WORLD.WIDTH / 2 - 90, y: 150, w: 180, h: 120 };
}

function tutorialNext() {
  tutorialStep += 1;
  if (tutorialStep >= TUT_STEPS().length) endTutorial();
  else renderTutorialStep();
}

function tutorialSkip() { endTutorial(); }

function endTutorial() {
  tutorialStep = -1;
  tutorialDone = true;
  persist();
  renderTutorialStep();
}

// ---------- 事件消费 ----------
function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    switch (ev.type) {
      case 'shot': renderer.fx('shot', run.state.player.x, run.state.player.y - PLAYER.HEIGHT * 0.5); break;
      case 'hit':
        if (ev.kind === 'enemy') { /* 命中音效已播 */ }
        break;
      case 'kill':
        renderer.fx('kill', ev.x || run.state.player.x, ev.y || 200, ev.enemy === 'big' ? '#ffa24d' : ev.enemy === 'medium' ? '#ff6bd6' : '#5ee6ff');
        renderer.addShake(2);
        break;
      case 'pickupCoin':
        break;
      case 'pickupAmmo':
        break;
      case 'pickupPower':
        renderer.fx('pickupPower', run.state.player.x, run.state.player.y);
        break;
      case 'invincible':
        renderer.fx('invincible', run.state.player.x, run.state.player.y);
        break;
      case 'hurt':
        renderer.fx('kill', run.state.player.x, run.state.player.y, '#ff5d7a');
        renderer.addShake(4);
        break;
      case 'lose':
        renderer.fx('lose', run.state.player.x, run.state.player.y);
        renderer.addShake(8);
        finishRun(ev);
        return;
      default:
        break;
    }
  }
}

// ---------- 输入 ----------
function canvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (WORLD.WIDTH / rect.width),
    y: (e.clientY - rect.top) * (WORLD.HEIGHT / rect.height),
  };
}

window.addEventListener('keydown', (e) => {
  const k = e.code;
  if (k === 'ArrowLeft' || k === 'KeyA') run && (run.input.left = true);
  if (k === 'ArrowRight' || k === 'KeyD') run && (run.input.right = true);
  if (k === 'ArrowUp' || k === 'KeyW') run && (run.input.up = true);
  if (k === 'ArrowDown' || k === 'KeyS') run && (run.input.down = true);
  if (k === 'Space') {
    e.preventDefault();
    if (phase === 'playing' && run) { audio.unlock(); run.fire(); }
  }
  if (k === 'Escape' || k === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
  if (k === 'KeyR') {
    if (phase === 'playing' || phase === 'paused' || phase === 'result') restartRun();
  }
  if (k === 'KeyM') toggleMute();
});

window.addEventListener('keyup', (e) => {
  const k = e.code;
  if (k === 'ArrowLeft' || k === 'KeyA') run && (run.input.left = false);
  if (k === 'ArrowRight' || k === 'KeyD') run && (run.input.right = false);
  if (k === 'ArrowUp' || k === 'KeyW') run && (run.input.up = false);
  if (k === 'ArrowDown' || k === 'KeyS') run && (run.input.down = false);
});

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (!run || phase !== 'playing') return;
  const p = canvasPos(e);
  dragTarget = p;
  run.fire();
});
canvas.addEventListener('pointermove', (e) => {
  if (dragTarget && run && phase === 'playing') dragTarget = canvasPos(e);
});
canvas.addEventListener('pointerup', () => { dragTarget = null; });
canvas.addEventListener('pointercancel', () => { dragTarget = null; });

function updateGoalHint() {
  const el = $('goal-hint');
  if (!el) return;
  if (phase === 'playing' && run && run.state.time < 4.5) {
    el.textContent = t('goalHint');
    el.classList.remove('hidden');
    el.style.opacity = run.state.time < 3.5 ? '1' : String(Math.max(0, 1 - (run.state.time - 3.5)));
  } else {
    el.classList.add('hidden');
  }
}

function applyDrag() {
  if (!run || !dragTarget || phase !== 'playing') return;
  const p = run.state.player;
  const dx = dragTarget.x - p.x;
  const dy = dragTarget.y - p.y;
  run.input.left = dx < -14;
  run.input.right = dx > 14;
  run.input.up = dy < -14;
  run.input.down = dy > 14;
}

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  ui.setMuted(muted);
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
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result') startTutorial(); });
  on('btn-tut-replay', () => {
    if (phase === 'paused') resumeGame();
    startTutorial();
  });
  on('tut-next', tutorialNext);
  on('tut-skip', tutorialSkip);

  // 竖屏跳过：内联 onclick 兜底（站点慢时模块未加载也能关遮罩）
  on('btn-rotate-skip', () => {
    const rs = $('rotate-screen');
    if (rs) rs.style.display = 'none';
  });

  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = $(id);
    if (!sel) continue;
    sel.addEventListener('change', () => {
      ui.setLang(sel.value);
      renderTitleBest();
      if (run) updateHud();
      renderTutorialStep();
    });
  }
}

// ---------- 主循环 ----------
function frame(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;

  if (phase === 'playing' && run) {
    applyDrag();
    accumulator += dt;
    while (accumulator >= STEP) {
      run.step(STEP);
      accumulator -= STEP;
    }
    handleEvents(run.drainEvents());
    if (run && phase === 'playing') updateHud();
  }

  renderer.draw(run ? run.state : null, dt, {});
  updateGoalHint();
  if (fpsSamples.length < 600 && dt > 0) fpsSamples.push(1 / dt);
  requestAnimationFrame(frame);
}

// ---------- 调试契约（截图/验收脚本通用） ----------
window.__ll = {
  state: {
    get phase() { return phase; },
    get lang() { return i18n.lang; },
  },
  run: () => run,
  sim: () => (run ? run.state : null),
  start: () => startRun(),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => restartRun(),
  home: () => goHome(),
  startAct: () => startRun(),
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['move', 'shoot', 'collect']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => tutorialSkip(),
  },
  startTutorial: () => startTutorial(),
  save: (k, v) => Sdk.save(k, v),
  ui: () => ui,
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: () => (run ? run.state : null),
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    startSeeded: (seed) => {
      run = createRun({ seed: seed | 0 || 1 });
      dragTarget = null;
      setPhase('playing');
      ui.showGame();
      ui.hideResult();
      updateHud();
      audio.unlock();
      return true;
    },
    fire: () => (run ? run.fire() : { ok: false }),
    giveUp: () => {
      if (run) { run.state.alive = false; run.state.phase = 'over'; handleEvents([{ type: 'lose', time: run.state.time, score: Math.floor(run.state.score), wave: run.state.wave, kills: run.state.kills }]); }
      return true;
    },
    spawnShowcase: () => {
      if (!run) return false;
      const st = run.state;
      const mk = (type, x, y) => ({
        x, y, xSpeed: 0, dir: 1, type, hp: ENEMIES[type].hp,
        fireTimer: 999, burst: false, burstCount: 0, burstTimer: 0, canFire: false,
      });
      st.enemies.length = 0;
      st.enemies.push(mk('small', 420, 160), mk('medium', 780, 130), mk('big', 600, 250));
      st.asteroids.push({ x: 300, y: 430, vx: 30, vy: 60, rot: 0.5, dir: 1 });
      st.coins.push({ x: 960, y: 400 });
      st.powerups.push({ x: 660, y: 480 });
      // 演示射击：几道激光向上，让「打飞碟」的目标一眼可见
      st.lasers.push(
        { x: 420, y: 380, vx: 0, vy: -1400 },
        { x: 600, y: 440, vx: 0, vy: -1400 },
        { x: 780, y: 360, vx: 0, vy: -1400 },
      );
      return true;
    },
  },
};

window.G = {
  state: () => phase,
  run: () => run,
  createRun,
};

// ---------- 启动 ----------
bind();
syncDocumentLang();
ui.applyLang();
renderTitleBest();
Sdk.track('load', {});
requestAnimationFrame(frame);
