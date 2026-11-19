// PIXEL SQUADRON · 主入口：60Hz 固定步长 + 标题/游戏/暂停/结算 + 教程 + SDK 统一出口
// 装配：sim(M1) / render+ui(M2) / audio(M4)。HUD/结算/教程的 DOM 由这里直写。
import { STEP, WORLD } from '../config/game.config.js';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';
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
let phase = 'title';          // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let fpsSamples = [];
let tutorialStep = -1;        // -1 = 未激活

const view = {
  shake: 0,
  particles: [],              // {x,y,ttl,maxTtl,color,size}
};

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let best = Sdk.load('best', 0) | 0;
let tutorialDone = !!Sdk.load('tutorialDone', false);
let lastLevel = Sdk.load('lastLevel', 0) | 0;

Sdk.ready();
audio.setMuted(muted);
ui.setMuted(muted);

function persist() {
  Sdk.save('muted', muted);
  Sdk.save('best', best);
  Sdk.save('tutorialDone', tutorialDone);
  Sdk.save('lastLevel', lastLevel);
}

// ---------- 阶段状态机 ----------
function setPhase(p) { phase = p; }

function startLevel(idx) {
  idx = Math.max(0, Math.min(LEVEL_COUNT - 1, idx | 0));
  lastLevel = idx;
  run = createRun(idx, { seed: (Date.now() % 2147483647) || 1 });
  view.particles = [];
  view.shake = 0;
  setPhase('playing');
  ui.showGame();
  hideResult();
  updateHud();
  audio.startBgm();
  Sdk.track('start', { level: idx + 1 });
  if (!tutorialDone && idx === 0) startTutorial();
}

function pauseGame() {
  if (phase !== 'playing') return;
  setPhase('paused');
  audio.stopBgm();
  ui.showPause();
}

function resumeGame() {
  if (phase !== 'paused') return;
  setPhase('playing');
  ui.hidePause();
  audio.startBgm();
}

function restartLevel() {
  if (run) Sdk.track('restart', { level: run.state.level });
  startLevel(run ? run.state.level - 1 : lastLevel);
}

function goHome() {
  run = null;
  setPhase('title');
  hideResult();
  ui.showTitle();
  updateTitleBest();
  audio.stopBgm();
}

// ---------- HUD / 结算 ----------
function updateHud() {
  if (!run) return;
  const h = run.getHud();
  const lv = LEVELS[h.level - 1] || {};
  $('hud-level').textContent = `${t('level')} ${h.level}`;
  $('hud-kills').textContent = `${t('target')} ${h.kills}/${h.killGoal}`;
  $('hud-score').textContent = `${t('score')} ${h.score}`;
  $('hud-combo').textContent = `×${h.combo}`;
  $('hud-combo').classList.toggle('dim', h.combo <= 1);
  const hpEl = $('hud-hp');
  hpEl.textContent = `${t('hp')} ${Math.max(0, h.hp)}/${h.maxHp}`;
}

function updateTitleBest() {
  const line = $('best-line');
  if (line) line.textContent = best > 0 ? `${t('best')}: ${best}` : '';
}

function showResult(res) {
  $('result-title').textContent = res.won ? t('winTitle') : t('loseTitle');
  $('result-title').classList.toggle('lose', !res.won);
  $('result-stars').innerHTML = res.won
    ? `<span class="stars">${'★'.repeat(res.stars)}${'☆'.repeat(3 - res.stars)}</span>${res.stars >= 3 ? `<em style="font-size:15px;color:#4ff0ff"> ${t('perfect')}</em>` : ''}`
    : '';
  $('result-score').textContent = `${t('score')}: ${res.score}`;
  $('result-combo').textContent = res.won || res.comboPeak > 1 ? `${t('comboPeak')}: ×${res.comboPeak}` : '';
  $('result-meta').textContent = res.won
    ? (res.newBest ? `${t('newBest')} · ` : '') + `${t('kills')}: ${res.kills}/${res.killGoal}`
    : (res.reason === 'escape' ? t('reasonEscape') : t('reasonDestroyed'));
  const hasNext = res.won && res.level + 1 <= LEVEL_COUNT;
  $('btn-next').style.display = hasNext ? '' : 'none';
  $('screen-result').classList.remove('hidden');
}

function hideResult() {
  $('screen-result').classList.add('hidden');
}

function finishRun(ev) {
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  const st = run.state;
  const won = ev.type === 'win';
  const stars = won ? (st.stars || 1) : 0;
  const score = st.score;
  const newBest = won && score > best;
  if (newBest) best = score;
  persist();
  Sdk.track(won ? 'win' : 'fail', {
    level: st.level, stars, score, kills: st.kills, comboPeak: st.comboPeak, reason: ev.reason || null,
  });
  showResult({
    won, stars, score, comboPeak: st.comboPeak, kills: st.kills, killGoal: st.killGoal,
    reason: ev.reason || null, level: st.level, newBest,
  });
  audio.event(won ? 'win' : 'lose');
}

// ---------- 教程（首次自动弹，可跳过，完成/跳过后持久化不再自动弹） ----------
const TUT_STEPS = ['steer', 'shoot', 'combo'];
const TUT_TEXT = () => [t('tutStep1'), t('tutStep2'), t('tutStep3')];

function startTutorial() {
  tutorialStep = 0;
  renderTutorialStep();
}

function renderTutorialStep() {
  const el = $('tutorial');
  if (tutorialStep < 0) { el.classList.add('hidden'); return; }
  const texts = TUT_TEXT();
  el.classList.remove('hidden');
  $('tut-title').textContent = t('tutTitle');
  $('tut-text').textContent = texts[tutorialStep] || '';
  $('tut-skip').textContent = t('tutSkip');
  $('tut-next').textContent = t('tutNext');
}

function tutorialNext() {
  tutorialStep += 1;
  if (tutorialStep >= TUT_STEPS.length) endTutorial();
  else renderTutorialStep();
}

function endTutorial() {
  tutorialStep = -1;
  tutorialDone = true;
  persist();
  renderTutorialStep();
}

// ---------- 事件消费 ----------
function spawnParticles(x, y, color, n, size) {
  for (let i = 0; i < n; i += 1) {
    const ang = Math.random() * Math.PI * 2;
    const spd = 40 + Math.random() * 120;
    view.particles.push({
      x, y,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      ttl: 0.3 + Math.random() * 0.4,
      maxTtl: 0.7,
      color,
      size: size || (2 + Math.random() * 3),
    });
  }
}

function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    switch (ev.type) {
      case 'kill':
        spawnParticles(ev.x, ev.y ?? 300, '#ffd166', 10, 3);
        view.shake = Math.max(view.shake, 3);
        break;
      case 'playerHit':
        spawnParticles(run.state.player.x, run.state.player.y, '#ff4fd8', 8, 2.5);
        view.shake = Math.max(view.shake, 6);
        break;
      case 'asteroidHit':
        spawnParticles(ev.x, ev.y ?? 300, '#9a8fc0', 5, 2);
        break;
      case 'asteroidSplit':
        spawnParticles(ev.x, ev.y ?? 300, '#7b6b9e', 10, 3);
        break;
      case 'bossSpawn':
        view.shake = Math.max(view.shake, 8);
        break;
      case 'win':
      case 'lose':
        finishRun(ev);
        return;
      default:
        break;
    }
  }
}

// ---------- 输入 ----------
const keys = { left: false, right: false };
let pointerX = null; // 指针拖动的目标逻辑 x（null=无）

function canvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (WORLD.WIDTH / rect.width),
    y: (e.clientY - rect.top) * (WORLD.HEIGHT / rect.height),
  };
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
  if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'result')) restartLevel();
  if (e.code === 'KeyM') toggleMute();
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
});

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  pointerX = canvasPos(e).x;
  e.preventDefault();
});
canvas.addEventListener('pointermove', (e) => {
  if (pointerX != null) pointerX = canvasPos(e).x;
});
window.addEventListener('pointerup', () => { pointerX = null; });
window.addEventListener('pointercancel', () => { pointerX = null; });

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  ui.setMuted(muted);
  $('btn-mute').classList.toggle('is-muted', muted);
  persist();
}

// ---------- UI 绑定 ----------
function bind() {
  const on = (id, fn) => {
    const el = $(id);
    if (el) el.addEventListener('click', () => { audio.unlock(); fn(); });
  };
  on('btn-start', () => startLevel(0));
  on('btn-resume', resumeGame);
  on('btn-restart', restartLevel);
  on('btn-restart2', restartLevel);
  on('btn-retry', restartLevel);
  on('btn-next', () => startLevel((run ? run.state.level - 1 : lastLevel) + 1));
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-tut-replay', () => {
    if (phase === 'paused') resumeGame();
    startTutorial();
  });
  on('btn-howto', () => { startTutorial(); });
  on('btn-howto-title', () => { startTutorial(); });
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
      const rt = $('rotate-text');
      const rb = $('btn-rotate-skip');
      if (rt) rt.textContent = t('rotateHint');
      if (rb) rb.textContent = t('rotateSkip');
    });
  }
}

// ---------- 主循环 ----------
function frame(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;

  if (phase === 'playing' && run && tutorialStep < 0) {
    accumulator += dt;
    while (accumulator >= STEP) {
      // 输入 → 移动方向
      let dir = keys.left ? -1 : keys.right ? 1 : 0;
      if (dir === 0 && pointerX != null) {
        const dx = pointerX - run.state.player.x;
        dir = Math.abs(dx) < 8 ? 0 : (dx > 0 ? 1 : -1);
      }
      run.setMove(dir);
      run.step(STEP);
      accumulator -= STEP;
    }
    handleEvents(run.drainEvents());
    if (run && phase === 'playing') updateHud();
  }

  if (view.shake > 0) view.shake = Math.max(0, view.shake - dt * 18);
  for (const p of view.particles) {
    p.ttl -= dt;
    p.x += (p.vx || 0) * dt;
    p.y += (p.vy || 0) * dt;
  }
  view.particles = view.particles.filter((p) => p.ttl > 0);

  try {
    renderer.draw(run ? run.state : null, dt, view);
  } catch (err) {
    console.warn('render error', err);
  }

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
  start: (i) => startLevel(i == null ? 0 : i),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => restartLevel(),
  home: () => goHome(),
  save: () => Sdk.save.bind(Sdk),
  ui: () => ui,
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return TUT_STEPS; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  debug: {
    state: () => (run ? run.state : null),
    startSeeded: (i, seed) => {
      const idx = Math.max(0, Math.min(LEVEL_COUNT - 1, i | 0));
      lastLevel = idx;
      run = createRun(idx, { seed: seed | 0 || 1 });
      view.particles = [];
      view.shake = 0;
      setPhase('playing');
      ui.showGame();
      hideResult();
      updateHud();
      return true;
    },
    loadLevel: (i) => startLevel(i == null ? 0 : i),
    forceWin: () => { if (run) { run.forceWin(); finishRun({ type: 'win' }); } },
    forceLose: () => { if (run) { run.forceLose('destroyed'); finishRun({ type: 'lose', reason: 'destroyed' }); } },
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    startTutorial: () => startTutorial(),
    tutorialStep: () => tutorialStep,
  },
};

// ---------- 启动 ----------
bind();
syncDocumentLang();
ui.applyLang();
{
  const rt = $('rotate-text');
  const rb = $('btn-rotate-skip');
  if (rt) rt.textContent = t('rotateHint');
  if (rb) rb.textContent = t('rotateSkip');
}
updateTitleBest();
$('btn-mute').classList.toggle('is-muted', muted);
Sdk.track('load', {});
requestAnimationFrame(frame);
