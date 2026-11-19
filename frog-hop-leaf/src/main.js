// FROG HOP LEAF · 主入口：60Hz 固定步长 + 标题/关卡/暂停/结算 + 教程 + SDK 统一出口
// 装配：sim（纯逻辑）/ render（canvas 程序化）/ ui（语言与屏幕显隐）/ audio（WebAudio）。
import { STEP, GAME, WORLD, CAMERA } from '../config/game.config.js';
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
let phase = 'title';            // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let fpsSamples = [];
let tutorialStep = -1;

const view = {
  shake: 0,
  particles: [],
  frozen: false,
};

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let unlocked = Math.max(1, Sdk.load('unlocked', 1) | 0);
let starsByLevel = Sdk.load('stars', {}) || {};
let tutorialDone = !!Sdk.load('tutorialDone', false);
let best = Sdk.load('best', 0) | 0;
let lastLevel = Math.min(Math.max(0, Sdk.load('lastLevel', 0) | 0), LEVEL_COUNT - 1);

Sdk.ready();
Sdk.onAdStart(() => { if (phase === 'playing') pauseGame(true); });
Sdk.onAdEnd(() => { if (phase === 'paused') resumeGame(); });
audio.setMuted(muted);
ui.setMuted(muted);

function persist() {
  Sdk.save('muted', muted);
  Sdk.save('unlocked', unlocked);
  Sdk.save('stars', starsByLevel);
  Sdk.save('tutorialDone', tutorialDone);
  Sdk.save('best', best);
  Sdk.save('lastLevel', lastLevel);
}

function setPhase(p) { phase = p; }

function startLevel(idx) {
  idx = Math.max(0, Math.min(LEVEL_COUNT - 1, idx | 0));
  lastLevel = idx;
  run = createRun(idx, { seed: (Date.now() % 2147483647) || 1 });
  view.shake = 0;
  view.particles = [];
  setPhase('playing');
  ui.showGame();
  ui.hideResult();
  updateHud();
  audio.startBgm();
  Sdk.track('start', { level: idx + 1 });
  if (!tutorialDone && idx === 0) startTutorial();
}

function startSeeded(idx, seed) {
  idx = Math.max(0, Math.min(LEVEL_COUNT - 1, idx | 0));
  lastLevel = idx;
  run = createRun(idx, { seed: seed | 0 || 1 });
  view.shake = 0;
  view.particles = [];
  setPhase('playing');
  ui.showGame();
  ui.hideResult();
  updateHud();
  return true;
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

function restartLevel() {
  if (run) Sdk.track('restart', { level: run.state.level });
  startLevel(run ? run.state.level - 1 : lastLevel);
}

function goHome() {
  run = null;
  setPhase('title');
  ui.hideResult();
  ui.showTitle();
  renderResultBest();
}

// ---------- HUD / 结算 ----------
function updateHud() {
  if (!run) return;
  const h = run.getHud();
  const lv = LEVELS[h.level - 1] || {};
  $('hud-level').textContent = `${t('level')} ${h.level}${lv.name ? ' · ' + (lv.name[i18n.lang] || lv.name.en) : ''}`;
  $('hud-score').textContent = `${t('score')} ${h.score}`;
  $('hud-best').textContent = `${t('best')} ${Math.max(best, h.score)}`;
  const comboEl = $('hud-combo');
  comboEl.textContent = h.combo >= 2 ? `${t('combo')} x${h.combo}` : '';
  const flyEl = $('hud-fireflies');
  flyEl.textContent = `${t('fireflies')} ${h.fireflies}/${h.fireflyGoal}`;
  flyEl.classList.toggle('goal-hit', h.fireflies >= h.fireflyGoal);
  const goalEl = $('hud-goal');
  if (goalEl) {
    const remainM = Math.max(0, Math.round((h.goalY - h.alt) / 10));
    goalEl.textContent = `${t('goalTop')} ${remainM}m`;
  }
}

function renderResultBest() {
  $('hud-best').textContent = `${t('best')} ${best}`;
}

function showResult(ev) {
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  const st = run.state;
  const won = ev.type === 'win';
  const stars = won ? (ev.stars || st.stars || 1) : 0;
  if (won) {
    best = Math.max(best, st.score);
    starsByLevel[st.level] = Math.max(starsByLevel[st.level] | 0, stars);
    if (st.level < LEVEL_COUNT) unlocked = Math.max(unlocked, st.level + 1);
  }
  persist();
  Sdk.track(won ? 'win' : 'fail', { level: st.level, stars, score: st.score, fireflies: st.fireflies });

  const title = $('result-title');
  title.textContent = won ? t('winTitle') : t('loseTitle');
  title.classList.toggle('lose', !won);
  $('result-stars').innerHTML = won ? '<span class="stars">' + '★'.repeat(stars) + '☆'.repeat(3 - stars) + '</span>' : '';
  $('result-time').textContent = won ? `${t('firefliesGot', { got: st.fireflies, goal: run._level.fireflyGoal })} · ${t('maxCombo', { c: st.maxCombo })}` : '';
  $('result-meta').textContent = won
    ? `${t('score')} ${st.score}`
    : (ev.reason === 'fall' ? t('lostFall') : t('lostEnemy'));
  $('btn-next').style.display = won && st.level < LEVEL_COUNT ? '' : 'none';
  ui.showResult();
  audio.event(won ? 'win' : 'lose');
}

function finishRun(ev) {
  showResult(ev);
}

// ---------- 教程（首次自动弹，可跳过，完成/跳过后持久化不再自动弹） ----------
const TUT_STEPS = () => [
  { text: t('tutStep1') },
  { text: t('tutStep2') },
  { text: t('tutStep3') },
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

// 真实动作驱动的教程推进：第一步跳，第二步落，第三步抓萤火虫
const TUT_TRIGGER = ['jump', 'land', 'firefly'];
function tutorialAdvance(evType) {
  if (tutorialStep < 0 || tutorialStep >= TUT_TRIGGER.length) return;
  if (TUT_TRIGGER[tutorialStep] !== evType) return;
  tutorialStep += 1;
  if (tutorialStep >= TUT_TRIGGER.length) endTutorial();
  else renderTutorialStep();
}

// ---------- 事件消费 ----------
function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    tutorialAdvance(ev.type);
    switch (ev.type) {
      case 'jump':
        view.shake = Math.max(view.shake, 2);
        break;
      case 'land':
        renderer.spawn(view, 'ripple', run.state.frog.x, run.state.frog.y - 10);
        view.shake = Math.max(view.shake, 2);
        break;
      case 'firefly':
        renderer.spawn(view, 'spark', run.state.frog.x, run.state.frog.y);
        break;
      case 'golden':
        renderer.spawn(view, 'golden', run.state.frog.x, run.state.frog.y);
        view.shake = Math.max(view.shake, 4);
        break;
      case 'spring':
        renderer.spawn(view, 'puff', run.state.frog.x, run.state.frog.y);
        break;
      case 'death':
        renderer.spawn(view, 'splat', run.state.frog.x, run.state.frog.y);
        view.shake = 6;
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
function doJump() {
  audio.unlock();
  if (!run || phase !== 'playing') return;
  run.jump();
}

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  doJump();
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
    e.preventDefault();
    doJump();
  }
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
  if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'result')) restartLevel();
  if (e.code === 'KeyM') toggleMute();
});

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
  on('btn-start', () => startLevel(lastLevel || 0));
  on('btn-resume', resumeGame);
  on('btn-restart', restartLevel);
  on('btn-restart2', restartLevel);
  on('btn-retry', restartLevel);
  on('btn-next', () => startLevel((run ? run.state.level : lastLevel)));
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result') startTutorial(); });
  on('btn-rotate-skip', () => {
    const rs = $('rotate-screen');
    if (rs) rs.style.display = 'none';
  });
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);

  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = $(id);
    if (!sel) continue;
    sel.addEventListener('change', () => {
      ui.setLang(sel.value);
      renderTutorialStep();
      if (run) updateHud();
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

  if (phase === 'playing' && run && !view.frozen) {
    accumulator += dt;
    while (accumulator >= STEP) {
      run.step(STEP);
      accumulator -= STEP;
    }
    handleEvents(run.drainEvents());
    if (run && phase === 'playing') updateHud();
  }

  if (view.shake > 0) view.shake = Math.max(0, view.shake - dt * 18);

  try {
    renderer.draw(run ? run.state : null, dt, view);
  } catch (err) {
    console.warn('render error', err);
  }

  if (fpsSamples.length < 600 && dt > 0) fpsSamples.push(1 / dt);
  requestAnimationFrame(frame);
}

// ---------- 调试契约 ----------
window.__ll = {
  state: {
    get phase() { return phase; },
    get lang() { return i18n.lang; },
  },
  run: () => run,
  start: (i) => startLevel(i == null ? (lastLevel || 0) : i),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => restartLevel(),
  home: () => goHome(),
  sim: () => (run ? run.state : null),
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['jump', 'climb', 'collect']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
  },
  startTutorial: () => startTutorial(),
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  save: () => Sdk,
  ui: () => ui,
  debug: {
    state: () => (run ? run.state : null),
    loadLevel: (i) => startLevel(i),
    startSeeded: (i, seed) => startSeeded(i, seed),
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    startTutorial: () => startTutorial(),
    tutorialStep: () => tutorialStep,
    // 验收辅助：把青蛙直接放到莲花门高度再推进一格，触发过关
    forceWin: () => {
      if (!run) return false;
      run.state.frog.onLeaf = false;
      run.state.frog.leafId = -1;
      run.state.frog.vy = 0;
      run.state.frog.y = run.state.goalY + 40;
      run.step(STEP);
      handleEvents(run.drainEvents());
      return true;
    },
    forceLose: () => {
      if (!run) return false;
      run.state.frog.onLeaf = false;
      run.state.frog.leafId = -1;
      run.state.frog.vy = -200;
      run.state.frog.y = run.state.camAlt - 40;
      run.step(STEP);
      handleEvents(run.drainEvents());
      return true;
    },
    // 截图辅助：冻结模拟，让截图期间青蛙不会乱走/撞敌（供 shots/poster 用）
    freeze: (on) => { view.frozen = !!on; return view.frozen; },
    // 截图辅助：把青蛙摆到关卡高度 frac 处的荷叶上，相机跟随（供 shots/poster 用）
    pose: (frac) => {
      if (!run) return false;
      const st = run.state;
      const target = st.goalY * (frac ?? 0.55);
      let leaf = st.leaves[0];
      for (const lf of st.leaves) if (lf.y <= target) leaf = lf;
      st.frog.onLeaf = true;
      st.frog.leafId = leaf.id;
      st.frog.x = leaf.x + leaf.w / 2;
      st.frog.y = leaf.y + 21;
      st.frog.vy = 0;
      st.camAlt = Math.max(0, st.frog.y - CAMERA.FOLLOW_FRAC * WORLD.HEIGHT);
      updateHud();
      return true;
    },
    // 截图辅助：稳定构图——青蛙在倒数第二片叶，金门完整出现在屏幕上方（供截图评审用）
    shotPose: () => {
      if (!run) return false;
      const st = run.state;
      const leaf = st.leaves[Math.max(1, st.leaves.length - 2)];
      st.frog.onLeaf = true;
      st.frog.leafId = leaf.id;
      st.frog.x = leaf.x + leaf.w / 2;
      st.frog.y = leaf.y + 21;
      st.frog.vy = 0;
      st.camAlt = Math.max(0, st.goalY - WORLD.HEIGHT + 160);
      updateHud();
      return true;
    },
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
$('btn-mute').classList.toggle('is-muted', muted);
$('hud-best').textContent = `${t('best')} ${best}`;
Sdk.track('load', {});
requestAnimationFrame(frame);
