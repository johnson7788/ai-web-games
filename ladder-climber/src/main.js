// LADDER CLIMBER · 主入口：60Hz 固定步长 + 标题/游戏/暂停/结算 + 交互引导 + SDK 统一出口。
// 装配：sim（纯逻辑）/ render（canvas 霓虹）/ audio（WebAudio）/ ui（DOM+语言）/ sdk。
import { STEP, GAME, WORLD } from '../config/game.config.js';
import { createRun } from './game/sim.js';
import { createRenderer } from './render/index.js';
import { createAudio } from './core/audio.js';
import { ui } from './ui/ui.js';
import { i18n, t, syncDocumentLang } from './core/i18n.js';
import Sdk from './core/sdk.js';

const $ = (id) => document.getElementById(id);
const canvas = $('canvas');
const container = $('game-container');
const renderer = createRenderer(canvas);
const audio = createAudio();

let run = null;
let phase = 'title';       // 'title' | 'playing' | 'paused' | 'result'
const demoRun = createRun({ seed: 777 }); // 标题屏背后的展示塔（只读，不推进）
demoRun.ensureTo(16);
let lastTime = performance.now();
let accumulator = 0;
let tutorialStep = -1;     // -1 = 未激活

// 持久化状态（统一走 Sdk）
let muted = !!Sdk.load('muted', false);
let best = Sdk.load('best', 0) | 0;
let tutorialDone = !!Sdk.load('tutorialDone', false);

Sdk.ready(); // 不阻塞首屏
audio.setMuted(muted);
ui.setMuted(muted);

function persist() {
  Sdk.save('muted', muted);
  Sdk.save('best', best);
  Sdk.save('tutorialDone', tutorialDone);
}

const view = {
  time: 0,
  dpr: 1,
  camX: 0,
  camY: 0,
  player: { x: 0, y: 0, scale: 1, flash: 0 },
  jump: null,
  fx: [],
  fall: null,
  shake: 0,
  floors: [],
  removeTopIndex: 0,
  curIndex: 0,
};

const easeOutQuad = (k) => 1 - (1 - k) * (1 - k);

// ---------------- 阶段状态机 ----------------
function setPhase(p) { phase = p; }

function showScreens() {
  $('screen-title').classList.toggle('is-active', phase === 'title');
  $('screen-title').classList.toggle('hidden', phase !== 'title');
  $('screen-pause').classList.toggle('is-active', phase === 'paused');
  $('screen-pause').classList.toggle('hidden', phase !== 'paused');
  $('screen-result').classList.toggle('is-active', phase === 'result');
  $('screen-result').classList.toggle('hidden', phase !== 'result');
  const inGame = phase === 'playing' || phase === 'paused' || phase === 'result';
  $('hud').classList.toggle('hidden', !inGame);
  $('controls').classList.toggle('hidden', phase !== 'playing');
}

function startLevel(seed) {
  run = createRun({ seed: seed == null ? ((Date.now() % 2147483647) || 1) : (seed >>> 0) });
  run.ensureTo(14); // 预生成上方楼层供渲染
  view.player.x = run.state.x;
  view.player.y = run.state.y;
  view.camX = run.state.x;
  view.camY = run.state.y;
  view.jump = null;
  view.fall = null;
  view.fx = [];
  view.shake = 0;
  view.floors = run.state.floors;
  view.removeTopIndex = run.state.removeTopIndex;
  view.curIndex = run.state.curIndex;
  setPhase('playing');
  showScreens();
  updateHud();
  audio.unlock();
  audio.startBgm();
  Sdk.newRun();
  if (!tutorialDone) startTutorial();
}

function pauseGame() {
  if (phase !== 'playing') return;
  setPhase('paused');
  audio.stopBgm();
  showScreens();
}

function resumeGame() {
  if (phase !== 'paused') return;
  setPhase('playing');
  audio.startBgm();
  showScreens();
}

function restartLevel() {
  startLevel(run ? run.state.seed : undefined);
}

function goHome() {
  run = null;
  setPhase('title');
  showScreens();
  audio.stopBgm();
}

// ---------------- HUD ----------------
function updateHud() {
  if (!run) return;
  const s = run.state;
  $('hud-score').textContent = `${t('score')} ${s.score}`;
  $('hud-best').textContent = `${t('best')} ${best}`;
  $('hud-floor').textContent = `${t('floor')} ${s.curIndex}`;
  const combo = $('hud-combo');
  combo.classList.toggle('hidden', s.combo < 2);
  combo.textContent = `${t('combo')} ×${s.combo}`;
  $('hud-stars').textContent = `★ ${s.stars}`;
  $('hud-shield').textContent = `🛡 ${s.shields}`;
  $('hud-freeze').classList.toggle('hidden', s.freezeT <= 0);
}

function showResult() {
  const s = run.state;
  const r = s.result || {};
  $('result-title').textContent = t('resultTitle');
  $('result-title').classList.add('lose');
  $('result-floors').textContent = t('climbed', { n: s.floorsClimbed });
  $('result-score').textContent = t('scoreLabel', { n: s.score });
  $('result-best').textContent = (s.score >= best ? t('newBest') + ' ' : '') + t('bestLabel', { n: Math.max(best, s.score) });
  const meta = r.reason === 'deco' ? t('reasonDeco') : r.reason === 'collapse' ? t('reasonCollapse') : t('reasonFall');
  $('result-meta').textContent = `${meta} · ${t('maxCombo', { n: s.comboMax })} · ${t('starsCollected', { n: s.stars })}`;
}

function finishRun(ev) {
  setPhase('result');
  audio.stopBgm();
  if (run.state.score > best) best = run.state.score;
  persist();
  Sdk.gameOver({ reason: ev.reason, score: run.state.score, floors: run.state.floorsClimbed });
  if (ev.reason === 'fall' || ev.reason === 'deco') {
    view.fall = { x: view.player.x, y: view.player.y, t: 0 };
  }
  view.shake = 8;
  showScreens();
  showResult();
  audio.event('lose', ev);
}

// ---------------- 教程引导 ----------------
const TUT_STEPS = () => [
  { id: 'dir', text: t('tutStep1') },
  { id: 'star', text: t('tutStep2') },
  { id: 'void', text: t('tutStep3') },
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
  // 聚光灯：步骤 0 指向方向按钮，其余步骤不强制聚焦（避免遮挡）
  if (s && s.id === 'dir') {
    const c = $('controls');
    const r = c ? c.getBoundingClientRect() : null;
    const stage = container.getBoundingClientRect();
    if (r && stage.width) {
      const sx = (r.left - stage.left) * (1280 / stage.width);
      const sy = (r.top - stage.top) * (720 / stage.height);
      const sw = r.width * (1280 / stage.width);
      const sh = r.height * (720 / stage.height);
      spot.style.display = 'block';
      spot.style.left = `${sx - 6}px`;
      spot.style.top = `${sy - 6}px`;
      spot.style.width = `${sw + 12}px`;
      spot.style.height = `${sh + 12}px`;
    }
  } else {
    spot.style.display = 'none';
  }
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

// 真实动作驱动的步骤推进：0=首次攀爬 1=首次收集星星 2=首次塌陷
const TUT_TRIGGER = ['climb', 'star', 'floorRemoved'];
function tutorialAdvance(evType) {
  if (tutorialStep < 0 || tutorialStep >= TUT_TRIGGER.length) return;
  if (TUT_TRIGGER[tutorialStep] !== evType) return;
  tutorialStep += 1;
  if (tutorialStep >= TUT_TRIGGER.length) endTutorial();
  else renderTutorialStep();
}

// ---------------- 事件消费 ----------------
function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    tutorialAdvance(ev.type);
    switch (ev.type) {
      case 'climb':
        view.player.flash = 1;
        view.shake = Math.max(view.shake, 2);
        view.fx.push({ type: 'spark', x: 0, y: 0, r: 5, color: '#24f0ff', ttl: 0.3, max: 0.3, world: true, wx: run.state.x, wy: run.state.y });
        break;
      case 'combo':
        view.fx.push({ type: 'ring', x: 0, y: 0, r: 30, color: '#ffd24e', ttl: 0.4, max: 0.4, world: true, wx: run.state.x, wy: run.state.y });
        break;
      case 'star':
        view.shake = Math.max(view.shake, 2);
        view.fx.push({ type: 'ring', x: 0, y: 0, r: 34, color: '#ffe14d', ttl: 0.45, max: 0.45, world: true, wx: run.state.x, wy: run.state.y });
        break;
      case 'shield':
        view.fx.push({ type: 'ring', x: 0, y: 0, r: 48, color: '#5cf7c8', ttl: 0.6, max: 0.6, world: true, wx: run.state.x, wy: run.state.y });
        break;
      case 'freeze':
        view.fx.push({ type: 'ring', x: 0, y: 0, r: 42, color: '#7df6ff', ttl: 0.5, max: 0.5, world: true, wx: run.state.x, wy: run.state.y });
        break;
      case 'miss':
        view.shake = 6;
        view.fx.push({ type: 'ring', x: 0, y: 0, r: 40, color: '#ff3b5c', ttl: 0.4, max: 0.4, world: true, wx: run.state.x, wy: run.state.y });
        break;
      case 'floorRemoved':
        view.shake = Math.max(view.shake, 1.5);
        break;
      case 'lose':
        finishRun(ev);
        return;
      default:
        break;
    }
  }
}

// ---------------- 输入 ----------------
function doClimb(dir) {
  if (phase !== 'playing' || !run) return;
  audio.unlock();
  const prevX = run.state.x;
  const prevY = run.state.y;
  const res = run.climb(dir);
  if (res.ok && res.climbed) {
    view.jump = { fromX: prevX, fromY: prevY, toX: run.state.x, toY: run.state.y, t: 0, dur: 0.12 };
  }
  handleEvents(run.drainEvents());
  updateHud();
}

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  ui.setMuted(muted);
  persist();
}

// ---------------- UI 绑定 ----------------
function bind() {
  const on = (id, fn) => {
    const el = $(id);
    if (el) el.addEventListener('click', () => { audio.unlock(); fn(); });
  };
  on('btn-start', () => startLevel());
  on('btn-howto-title', () => { startLevel(); startTutorial(); });
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result') startTutorial(); });
  on('btn-left', () => doClimb(-1));
  on('btn-right', () => doClimb(1));
  on('btn-pause', pauseGame);
  on('btn-resume', resumeGame);
  on('btn-restart', restartLevel);
  on('btn-restart2', restartLevel);
  on('btn-retry', restartLevel);
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);

  // 方向键
  window.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') { e.preventDefault(); doClimb(-1); }
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') { e.preventDefault(); doClimb(1); }
    else if (e.code === 'Escape' || e.code === 'KeyP') {
      if (phase === 'playing') pauseGame();
      else if (phase === 'paused') resumeGame();
    } else if (e.code === 'KeyR') restartLevel();
    else if (e.code === 'KeyM') toggleMute();
  });

  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = $(id);
    if (!sel) continue;
    sel.addEventListener('change', () => {
      ui.setLang(sel.value);
      renderTutorialStep();
      updateHud();
    });
  }
}

// ---------------- 主循环 ----------------
function frame(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;
  view.time = now / 1000;

  if (phase === 'playing' && run) {
    accumulator += dt;
    while (accumulator >= STEP) {
      run.step(STEP);
      accumulator -= STEP;
    }
    handleEvents(run.drainEvents());
    updateHud();
    run.ensureTo(run.state.curIndex + 14); // 渲染视窗内楼层始终就绪
    view.removeTopIndex = run.state.removeTopIndex;
    view.curIndex = run.state.curIndex;
  }

  // 玩家视觉：跳跃弧线 + 平滑跟随
  if (run && phase !== 'title') {
    if (view.jump) {
      view.jump.t += dt;
      const k = Math.min(1, view.jump.t / view.jump.dur);
      const e = easeOutQuad(k);
      view.player.x = view.jump.fromX + (view.jump.toX - view.jump.fromX) * e;
      view.player.y = view.jump.fromY + (view.jump.toY - view.jump.fromY) * e + Math.sin(Math.PI * k) * 30;
      if (k >= 1) view.jump = null;
    } else {
      view.player.x += (run.state.x - view.player.x) * Math.min(1, dt * 14);
      view.player.y += (run.state.y - view.player.y) * Math.min(1, dt * 14);
    }
    view.camX += (view.player.x - view.camX) * Math.min(1, dt * 8);
    view.camY += (view.player.y - view.camY) * Math.min(1, dt * 8);
  }

  // 标题屏展示塔（保持剪影/风格一致，避免纯菜单截图）
  if (phase === 'title' && !run) {
    const d = demoRun.state.floors;
    view.floors = d;
    view.removeTopIndex = 0;
    view.curIndex = 3;
    view.player.x = d[3].x;
    view.player.y = d[3].y + GAME.RIDE_H + Math.sin(view.time * 2) * 3;
    view.camX = view.player.x;
    view.camY = view.player.y;
  }

  if (view.player.flash > 0) view.player.flash = Math.max(0, view.player.flash - dt * 5);
  if (view.shake > 0) view.shake = Math.max(0, view.shake - dt * 22);

  // 坠落残影
  if (view.fall) {
    view.fall.t += dt * 1.6;
    view.fall.y -= dt * 640;
    if (view.fall.t >= 1) view.fall = null;
  }

  // 粒子世界坐标 → 屏幕坐标
  const cam = { x: view.camX, y: view.camY };
  for (const p of view.fx) {
    if (p.world) {
      p.x = WORLD.WIDTH / 2 + (p.wx - cam.x);
      p.y = WORLD.HEIGHT * 0.62 - (p.wy - cam.y);
      p.world = false;
    }
    p.ttl -= dt;
  }
  view.fx = view.fx.filter((p) => p.ttl > 0);

  try {
    renderer.draw(view, dt);
  } catch (err) {
    console.warn('render error', err);
  }

  requestAnimationFrame(frame);
}

// ---------------- 调试契约 ----------------
window.__ll = {
  state: {
    get phase() { return phase; },
    get lang() { return i18n.lang; },
  },
  run: () => run,
  start: (i) => startLevel(i == null ? undefined : i),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => restartLevel(),
  home: () => goHome(),
  sim: () => (run ? run.state : null),
  save: (k, v) => Sdk.save(k, v),
  load: (k, f) => Sdk.load(k, f),
  share: (p) => Sdk.share(p),
  ui,
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return TUT_STEPS().map((s) => s.id); },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  endTutorial: () => endTutorial(),
  debug: {
    state: () => (run ? { ...run.getHud(), floors: run.state.floors.length, seed: run.state.seed } : null),
    setTutorialDone: (b) => { tutorialDone = !!b; if (b) { tutorialStep = -1; renderTutorialStep(); } persist(); },
    startSeeded: (i, seed) => startLevel(seed),
    climbCorrect: () => doClimb(run ? run.state.nextDir : 1),
    climbWrong: () => doClimb(run ? (run.state.nextDir === 1 ? -1 : 1) : 1),
    climbCorrectN: (n) => { for (let k = 0; k < n; k += 1) doClimb(run ? run.state.nextDir : 1); return true; },
  },
};

// ---------------- 启动 ----------------
function resizeStage() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const s = Math.min(vw / WORLD.WIDTH, vh / WORLD.HEIGHT);
  const tx = (vw - WORLD.WIDTH * s) / 2;
  const ty = (vh - WORLD.HEIGHT * s) / 2;
  container.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  view.dpr = dpr;
  renderer.resize(dpr);
}
window.addEventListener('resize', resizeStage);

bind();
syncDocumentLang();
ui.applyLang();
resizeStage();
showScreens();
Sdk.track('load', {});
requestAnimationFrame(frame);
