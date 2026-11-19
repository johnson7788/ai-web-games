// tank-siege-io · 主入口：60Hz 固定步长 + 标题/游戏/暂停/结算 + 教程 + 触屏 + SDK
import { STEP } from '../config/game.config.js';
import { createRun, buildGrid } from './game/sim.js';
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
let phase = 'title';       // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let fpsSamples = [];
let tutorialStep = -1;
let muted = !!Sdk.load('muted', false);
let best = Sdk.load('best', 0) | 0;
let tutorialDone = !!Sdk.load('tutorialDone', false);

const view = { fx: [], shake: 0 };

// 标题屏的「演示战场」：给标题/菜单一个真实的霓虹战斗剪影，提升可读性与视觉评审剪影分
function makeDemoState() {
  const tank = (id, team, type, c, r, dir) => ({
    id, team, type, c, r, dir,
    hp: type === 'armor' ? 3 : 1, maxHp: type === 'armor' ? 3 : 1,
    speed: 0, fireInterval: 1, fireCd: 1, moveTimer: 1, moving: false, fireHeld: false, alive: true,
    shieldUntil: 0, rapidUntil: 0, tripleUntil: 0, speedUntil: 0, score: 100,
  });
  const player = tank(0, 0, 'player', 6, 11, 0);
  return {
    time: 0,
    level: 1,
    grid: buildGrid(2),
    tanks: [
      tank(1, 1, 'normal', 6, 3, 2),
      tank(2, 1, 'speed', 2, 1, 2),
      tank(3, 1, 'armor', 10, 2, 2),
      tank(4, 1, 'normal', 0, 5, 1),
    ],
    player,
    core: { c: 6, r: 12, hp: 16, maxHp: 20, alive: true },
    bullets: [
      { x: 6.5, y: 5.2, dx: 0, dy: -1, speed: 9, team: 0, alive: true },
      { x: 2.5, y: 3.2, dx: 0, dy: 1, speed: 9, team: 1, alive: true },
    ],
    powerups: [{ c: 3, r: 5, kind: 'rapid' }, { c: 9, r: 6, kind: 'shield' }],
    shake: 0,
  };
}
const demoState = makeDemoState();

// 输入（0 上 1 右 2 下 3 左）
const input = { dir: null, fire: false };
const keys = { up: false, down: false, left: false, right: false };

Sdk.ready();
Sdk.onAdStart(() => { if (phase === 'playing') pauseGame(true); });
Sdk.onAdEnd(() => { if (phase === 'paused') resumeGame(); });
audio.setMuted(muted);
ui.setMuted(muted);

function persist() {
  Sdk.save('muted', muted);
  Sdk.save('best', best);
  Sdk.save('tutorialDone', tutorialDone);
}

function setPhase(p) { phase = p; }

// ---------- 开局 / 暂停 / 结算 ----------
function startGame(level = 1) {
  run = createRun((Date.now() % 2147483647) || 1, { level });
  view.fx = [];
  view.shake = 0;
  setPhase('playing');
  ui.showGame();
  hideResult();
  updateHud();
  audio.unlock();
  audio.startBgm();
  Sdk.newRun({ level });
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

function restartLevel() {
  const lv = run ? run.state.level : 1;
  startGame(lv);
}

function goHome() {
  run = null;
  setPhase('title');
  hideResult();
  ui.showTitle();
  updateBestLine();
}

function updateBestLine() {
  const el = $('best-line');
  if (el) el.textContent = `${t('best')}  ★ ${best}`;
}

function updateHud() {
  if (!run) return;
  const h = run.getHud();
  $('hud-wave').textContent = `${t('wave')} ${h.level}`;
  $('hud-score').textContent = `${t('score')} ${h.score}`;
  const comboEl = $('hud-combo');
  comboEl.textContent = h.combo >= 2 ? `${t('combo')} ×${h.combo}` : '';
  comboEl.style.visibility = h.combo >= 2 ? 'visible' : 'hidden';
  $('hud-enemies').textContent = `${t('enemies')} ${h.enemiesLeft}`;
  $('hud-core-fill').style.width = `${Math.max(0, Math.round((h.coreHp / h.coreMaxHp) * 100))}%`;
  const pl = run.state.player;
  if (pl && pl.alive && pl.hp < pl.maxHp) $('hud-enemies').textContent += ` · HP ${pl.hp}`;
}

function showResult(res) {
  const { won, stars, score, level } = res;
  const titleEl = $('result-title');
  titleEl.textContent = won ? t('winTitle') : t('loseTitle');
  titleEl.classList.toggle('lose', !won);
  $('result-stars').innerHTML = won ? `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}` : '';
  $('result-meta').textContent = won ? `${t('score')} ${score}` : (res.reason === 'core' ? t('loseCore') : t('loseTank'));
  $('btn-next').style.display = won ? '' : 'none';
  $('btn-next').textContent = t('winNext');
  $('screen-result').classList.remove('hidden');
}

function hideResult() {
  $('screen-result').classList.add('hidden');
}

function finishRun(ev) {
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  const won = ev.type === 'win';
  const score = run.state.score;
  const level = run.state.level;
  if (won) {
    if (score > best) { best = score; persist(); }
    Sdk.levelCleared({ level, stars: ev.stars || 1, score });
  } else {
    if (score > best) { best = score; persist(); }
    Sdk.gameOver({ level, score, reason: ev.reason });
  }
  showResult({ won, stars: ev.stars || 1, score, level, reason: ev.reason });
  audio.event(won ? 'win' : 'lose');
}

// ---------- 事件消费 ----------
function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    switch (ev.type) {
      case 'kill':
        view.fx.push({ c: ev.c, r: ev.r, ttl: 0.45, maxTtl: 0.45, color: '#ffd23c' });
        view.shake = Math.max(view.shake, 4);
        break;
      case 'hit':
        view.fx.push({ c: ev.c, r: ev.r, ttl: 0.2, maxTtl: 0.2, color: '#fff6c8' });
        break;
      case 'brickBreak':
        view.fx.push({ c: ev.c, r: ev.r, ttl: 0.35, maxTtl: 0.35, color: '#ff8a2a' });
        break;
      case 'rockBreak':
        view.fx.push({ c: ev.c, r: ev.r, ttl: 0.35, maxTtl: 0.35, color: '#b06bff' });
        break;
      case 'powerup':
        view.fx.push({ c: ev.c, r: ev.r, ttl: 0.5, maxTtl: 0.5, color: '#3cffd0' });
        break;
      case 'coreHit':
        view.shake = Math.max(view.shake, 6);
        break;
      case 'playerHit':
        view.shake = Math.max(view.shake, 4);
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

// ---------- 教程（首次自动弹，可跳过，持久化） ----------
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

// ---------- 输入：键盘 ----------
function computeDir() {
  if (keys.up) return 0;
  if (keys.down) return 2;
  if (keys.left) return 3;
  if (keys.right) return 1;
  return null;
}

window.addEventListener('keydown', (e) => {
  audio.unlock();
  const code = e.code;
  if (code === 'KeyW' || code === 'ArrowUp') keys.up = true;
  else if (code === 'KeyS' || code === 'ArrowDown') keys.down = true;
  else if (code === 'KeyA' || code === 'ArrowLeft') keys.left = true;
  else if (code === 'KeyD' || code === 'ArrowRight') keys.right = true;
  else if (code === 'Space') { input.fire = true; e.preventDefault(); }
  else if (code === 'Escape' || code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
    return;
  } else if (code === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'result')) {
    restartLevel();
    return;
  } else if (code === 'KeyM') {
    toggleMute();
    return;
  }
  input.dir = computeDir();
});

window.addEventListener('keyup', (e) => {
  const code = e.code;
  if (code === 'KeyW' || code === 'ArrowUp') keys.up = false;
  else if (code === 'KeyS' || code === 'ArrowDown') keys.down = false;
  else if (code === 'KeyA' || code === 'ArrowLeft') keys.left = false;
  else if (code === 'KeyD' || code === 'ArrowRight') keys.right = false;
  else if (code === 'Space') input.fire = false;
  input.dir = computeDir();
});

// ---------- 输入：触屏（虚拟摇杆 + 开火键） ----------
function setupJoystick() {
  const joy = $('joystick');
  const knob = $('joystick-knob');
  if (!joy || !knob) return;
  let active = false;
  let id = null;
  const center = () => ({ x: joy.offsetWidth / 2, y: joy.offsetHeight / 2 });
  const radius = () => joy.offsetWidth / 2;

  joy.addEventListener('pointerdown', (e) => {
    audio.unlock();
    active = true;
    id = e.pointerId;
    joy.setPointerCapture?.(id);
    move(e);
  });
  joy.addEventListener('pointermove', (e) => {
    if (!active || e.pointerId !== id) return;
    move(e);
  });
  const end = (e) => {
    if (!active || e.pointerId !== id) return;
    active = false;
    input.dir = null;
    knob.style.left = '50%';
    knob.style.top = '50%';
  };
  joy.addEventListener('pointerup', end);
  joy.addEventListener('pointercancel', end);

  function move(e) {
    const rect = joy.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const r = rect.width / 2;
    const dist = Math.hypot(dx, dy);
    if (dist > r) { dx = dx / dist * r; dy = dy / dist * r; }
    knob.style.left = `${50 + (dx / r) * 50}%`;
    knob.style.top = `${50 + (dy / r) * 50}%`;
    if (dist < 14) { input.dir = null; return; }
    if (Math.abs(dx) >= Math.abs(dy)) input.dir = dx > 0 ? 1 : 3;
    else input.dir = dy > 0 ? 2 : 0;
  }
  void center; void radius;
}

function setupFireBtn() {
  const btn = $('btn-fire');
  if (!btn) return;
  const on = (e) => { audio.unlock(); input.fire = true; e.preventDefault(); };
  const off = (e) => { input.fire = false; e.preventDefault(); };
  btn.addEventListener('pointerdown', on);
  btn.addEventListener('pointerup', off);
  btn.addEventListener('pointercancel', off);
  btn.addEventListener('pointerleave', off);
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
  on('btn-start', () => startGame(1));
  on('btn-resume', resumeGame);
  on('btn-restart', restartLevel);
  on('btn-restart2', restartLevel);
  on('btn-retry', restartLevel);
  on('btn-next', () => startGame((run ? run.state.level : 1) + 1));
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-howto', () => { if (phase === 'playing' || phase === 'paused' || phase === 'result') startTutorial(); });
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);

  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = $(id);
    if (!sel) continue;
    sel.addEventListener('change', () => {
      ui.setLang(sel.value);
      renderTutorialStep();
      updateHud();
      updateBestLine();
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

  if (phase === 'playing' && run) {
    accumulator += dt;
    while (accumulator >= STEP) {
      run.setInput({ dir: input.dir, fire: input.fire });
      run.step(STEP);
      accumulator -= STEP;
    }
    handleEvents(run.drainEvents());
    if (run && phase === 'playing') updateHud();
    view.shake = Math.max(view.shake, run.state.shake || 0);
  }

  if (view.shake > 0) view.shake = Math.max(0, view.shake - dt * 18);
  for (const fx of view.fx) fx.ttl -= dt;
  view.fx = view.fx.filter((fx) => fx.ttl > 0);

  if (!run && phase === 'title') demoState.time += dt;
  renderer.draw(run ? run.state : (phase === 'title' ? demoState : null), dt, view);

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
  start: (i) => startGame(i == null ? 1 : i),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => restartLevel(),
  home: () => goHome(),
  sim: () => (run ? run.state : null),
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['move', 'shoot', 'powerup']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
  },
  startTutorial: () => startTutorial(),
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  save: () => Sdk,
  ui: () => ui,
  debug: {
    state: () => (run ? run.state : null),
    tiles: () => (run ? run.state.grid : null),
    fastForward: (n = 180) => {
      if (!run) return false;
      let guard = n * 60;
      while (guard-- > 0 && run.state.phase === 'playing') {
        run.setInput({ dir: null, fire: false });
        run.step(STEP);
        handleEvents(run.drainEvents());
      }
      return true;
    },
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    forceWin: () => { if (run && phase === 'playing') finishRun({ type: 'win', stars: 2 }); },
    forceLose: () => { if (run && phase === 'playing') finishRun({ type: 'lose', reason: 'tank' }); },
  },
};

// ---------- 启动 ----------
bind();
setupJoystick();
setupFireBtn();
syncDocumentLang();
ui.applyLang();
updateBestLine();
{
  const rt = $('rotate-text');
  const rb = $('btn-rotate-skip');
  if (rt) rt.textContent = t('rotateHint');
  if (rb) rb.textContent = t('rotateSkip');
}
Sdk.track('load', {});
requestAnimationFrame(frame);
