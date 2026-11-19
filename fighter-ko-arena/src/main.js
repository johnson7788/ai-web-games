// 主入口：60Hz 固定步长 + 标题/格斗/暂停/结算 + 教程引导 + SDK 统一出口。
// 装配：sim(M1) / render+ui(M2) / audio(M4)。
import { STEP, WORLD, FIGHT, LEVEL_COUNT } from '../config/game.config.js';
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
let phase = 'title';        // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let tutorialStep = -1;      // -1 = 未激活

const view = {
  shake: 0,
  flash: 0,
  playerPose: 'idle',
  enemyPose: 'idle',
  playerPoseTtl: 0,
  enemyPoseTtl: 0,
  sparks: [],
  t: 0,
};

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let tutorialDone = !!Sdk.load('tutorialDone', false);
let bestStreak = Sdk.load('bestStreak', 0) | 0;
let koCount = Sdk.load('koCount', 0) | 0;

Sdk.ready(); // 不 await，不阻塞首屏
audio.setMuted(muted);

function persist() {
  Sdk.save('muted', muted);
  Sdk.save('tutorialDone', tutorialDone);
  Sdk.save('bestStreak', bestStreak);
  Sdk.save('koCount', koCount);
}

// ---------- 阶段状态机 ----------
function setPhase(p) { phase = p; }

function startMatch(idx) {
  idx = Math.max(0, Math.min(LEVEL_COUNT - 1, idx | 0));
  run = createRun(idx, { seed: (Date.now() % 2147483647) || 1 });
  view.sparks = [];
  view.flash = 0;
  setPhase('playing');
  ui.showGame();
  ui.hideResult();
  $('controls').classList.remove('hidden');
  updateHud();
  updateSuperBtn();
  audio.startBgm();
  Sdk.newRun({ level: idx + 1 });
  Sdk.track('start', { level: idx + 1 });
  if (!tutorialDone && idx === 0) startTutorial();
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

function restartMatch() {
  if (run) Sdk.track('restart', { level: run.state.level });
  startMatch(0);
}

function goHome() {
  run = null;
  setPhase('title');
  ui.showTitle();
  $('controls').classList.add('hidden');
}

// ---------- HUD ----------
function updateHud() {
  if (!run) return;
  const f = run.state.fight;
  const lv = run.state.level;
  $('hp-player').style.width = `${(f.playerHp / FIGHT.PLAYER_HP) * 100}%`;
  $('hp-enemy').style.width = `${(f.enemyHp / f.enemyMaxHp) * 100}%`;
  $('meter-player').style.width = `${(f.playerMeter / FIGHT.SUPER_METER_MAX) * 100}%`;
  $('meter-player').classList.toggle('full', f.playerMeter >= FIGHT.SUPER_METER_MAX);
  $('hud-round').textContent = `${t('round')} ${lv} / ${LEVEL_COUNT}`;
  $('hud-combo').textContent = f.combo >= 2 ? `${t('combo')} ×${f.combo}` : '';
}

function updateSuperBtn() {
  const f = run?.state?.fight;
  const ready = !!f && f.playerMeter >= FIGHT.SUPER_METER_MAX && phase === 'playing';
  $('btn-super').disabled = !ready;
}

// ---------- 结算 ----------
function finishRun(won) {
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  $('controls').classList.add('hidden');
  if (won) {
    koCount += 1;
    bestStreak = Math.max(bestStreak, run.state.level);
  }
  persist();
  Sdk.track(won ? 'win' : 'fail', { level: run.state.level, comboPeak: run.state.fight.comboPeak });
  if (won) Sdk.levelCleared({ level: run.state.level });
  else Sdk.gameOver({ level: run.state.level });
  ui.showResult(won);
  audio.event(won ? 'matchWin' : 'lose');
}

// ---------- 事件消费 ----------
function fighterPositions() {
  const f = run?.state?.fight;
  if (!f) return { px: WORLD.WIDTH * 0.3, ex: WORLD.WIDTH * 0.7 };
  const cx = WORLD.WIDTH / 2;
  return { px: cx - f.distance / 2, ex: cx + f.distance / 2 };
}

function spark(x, y, color, n = 6) {
  for (let i = 0; i < n; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const sp = 120 + Math.random() * 220;
    view.sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, ttl: 0.3, max: 0.3, color });
  }
}

function handleEvents(events) {
  const { px, ex } = fighterPositions();
  for (const ev of events) {
    audio.event(ev.type, ev);
    tutorialAdvance(ev.type);
    switch (ev.type) {
      case 'punch':
        view.playerPose = 'punch'; view.playerPoseTtl = 0.18;
        break;
      case 'kick':
        view.playerPose = 'kick'; view.playerPoseTtl = 0.3;
        break;
      case 'super':
        view.playerPose = 'super'; view.playerPoseTtl = 0.5; view.flash = 0.7; view.shake = 8;
        break;
      case 'hitEnemy':
        view.enemyPose = 'hit'; view.enemyPoseTtl = 0.28; view.shake = 5;
        spark(ex, WORLD.GROUND_Y - 130, '#ff3fd6');
        break;
      case 'enemyWindup':
        view.enemyPose = 'windup'; view.enemyPoseTtl = 0.28;
        break;
      case 'enemyHit':
        view.playerPose = 'hit'; view.playerPoseTtl = 0.3; view.shake = 6;
        spark(px, WORLD.GROUND_Y - 130, '#33e6ff');
        break;
      case 'levelWin':
        view.flash = 0.5;
        break;
      case 'matchWin':
        finishRun(true);
        return;
      case 'lose':
        finishRun(false);
        return;
      default:
        break;
    }
  }
}

// ---------- 输入 ----------
function doStrike() {
  audio.unlock();
  if (!run || phase !== 'playing') return;
  run.strike();
}

function doBlockStart() {
  audio.unlock();
  if (!run || phase !== 'playing') return;
  run.blockStart();
}

function doBlockEnd() {
  if (!run || phase !== 'playing') return;
  run.blockEnd();
}

function doSuper() {
  audio.unlock();
  if (!run || phase !== 'playing') return;
  run.superMove();
}

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  $('btn-mute').classList.toggle('is-muted', muted);
  persist();
}

// ---------- 教程 ----------
const TUT_STEPS = () => [
  { text: t('tutStep1'), spot: 'strike' },
  { text: t('tutStep2'), spot: 'block' },
  { text: t('tutStep3'), spot: 'super' },
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
  // 高亮对应控制按钮
  const spotEl = $('tut-spotlight');
  const target = $('btn-' + (s ? s.spot : 'strike'));
  if (target && s) {
    const r = target.getBoundingClientRect();
    const cr = $('game-container').getBoundingClientRect();
    spotEl.style.display = 'block';
    spotEl.style.left = `${r.left - cr.left - 6}px`;
    spotEl.style.top = `${r.top - cr.top - 6}px`;
    spotEl.style.width = `${r.width + 12}px`;
    spotEl.style.height = `${r.height + 12}px`;
  } else {
    spotEl.style.display = 'none';
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

// 真实动作驱动教学推进：0=strike 1=block 2=super
const TUT_TRIGGER = ['punch', 'block', 'super'];
function tutorialAdvance(evType) {
  if (tutorialStep < 0 || tutorialStep >= TUT_TRIGGER.length) return;
  if (TUT_TRIGGER[tutorialStep] !== evType) return;
  tutorialStep += 1;
  if (tutorialStep >= TUT_TRIGGER.length) endTutorial();
  else renderTutorialStep();
}

// ---------- 绑定 ----------
function bind() {
  const on = (id, fn) => {
    const el = $(id);
    if (el) el.addEventListener('click', () => { audio.unlock(); fn(); });
  };
  on('btn-start', () => startMatch(0));
  on('btn-resume', resumeGame);
  on('btn-restart', restartMatch);
  on('btn-restart2', restartMatch);
  on('btn-retry', () => {
    const won = run?.state?.phase === 'won';
    startMatch(won ? Math.min(run.state.levelIndex + 1, LEVEL_COUNT - 1) : 0);
  });
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-howto', () => { if (phase === 'playing' || phase === 'paused') startTutorial(); });
  on('btn-howto-title', () => startTutorial());
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);
  on('btn-strike', doStrike);
  on('btn-super', doSuper);

  const blockBtn = $('btn-block');
  if (blockBtn) {
    blockBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); doBlockStart(); });
    blockBtn.addEventListener('pointerup', doBlockEnd);
    blockBtn.addEventListener('pointerleave', doBlockEnd);
    blockBtn.addEventListener('pointercancel', doBlockEnd);
  }

  canvas.addEventListener('pointerdown', () => { audio.unlock(); doStrike(); });

  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = $(id);
    if (!sel) continue;
    sel.addEventListener('change', () => {
      ui.setLang(sel.value);
      renderTutorialStep();
      if (run) updateHud();
      $('rotate-text').textContent = t('rotateHint');
      $('btn-rotate-skip').textContent = t('rotateSkip');
    });
  }
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'KeyJ' || e.code === 'Enter') { e.preventDefault(); doStrike(); }
  if (e.code === 'KeyB') doBlockStart();
  if (e.code === 'KeyS') doSuper();
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
  if (e.code === 'KeyR') restartMatch();
  if (e.code === 'KeyM') toggleMute();
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'KeyB') doBlockEnd();
});

// ---------- 主循环 ----------
function frame(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;
  view.t += dt;

  if (phase === 'playing' && run && run.state.phase === 'fight') {
    accumulator += dt;
    while (accumulator >= STEP) {
      run.step(STEP);
      accumulator -= STEP;
    }
    handleEvents(run.drainEvents());
    if (run.state.phase !== 'fight') {
      // 终局已由 handleEvents 触发 finishRun
    } else if (phase === 'playing') {
      updateHud();
      updateSuperBtn();
    }
  }

  if (view.shake > 0) view.shake = Math.max(0, view.shake - dt * 26);
  if (view.flash > 0) view.flash = Math.max(0, view.flash - dt * 1.4);
  if (view.playerPoseTtl > 0) { view.playerPoseTtl -= dt; if (view.playerPoseTtl <= 0) view.playerPose = 'idle'; }
  if (view.enemyPoseTtl > 0) { view.enemyPoseTtl -= dt; if (view.enemyPoseTtl <= 0) view.enemyPose = 'idle'; }
  for (const s of view.sparks) { s.ttl -= dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 400 * dt; }
  view.sparks = view.sparks.filter((s) => s.ttl > 0);

  renderer.draw(run ? run.state : null, view, phase);
  requestAnimationFrame(frame);
}

// ---------- 调试契约 ----------
window.__ll = {
  state: {
    get phase() { return phase; },
    get lang() { return i18n.lang; },
    get dir() { return i18n.dir; },
  },
  run: () => run,
  sim: () => (run ? run.state : null),
  start: (i) => startMatch(i == null ? 0 : i),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => restartMatch(),
  home: () => goHome(),
  save: (key, value) => Sdk.save(key, value),
  ui: () => ui,
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['strike', 'block', 'super']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  debug: {
    state: () => (run ? run.state : null),
    win: () => { if (run) { run.state.phase = 'won'; finishRun(true); } },
    lose: () => { if (run) { run.state.phase = 'lost'; finishRun(false); } },
    setFight: (ms) => {
      if (!run) return false;
      for (let i = 0; i < ms; i += 1) {
        run.step(STEP);
        const evs = run.drainEvents();
        for (const ev of evs) if (ev.type === 'matchWin' || ev.type === 'lose') return true;
      }
      return true;
    },
  },
};

// ---------- 启动 ----------
bind();
syncDocumentLang();
ui.applyLang();
$('rotate-text').textContent = t('rotateHint');
$('btn-rotate-skip').textContent = t('rotateSkip');
$('btn-mute').classList.toggle('is-muted', muted);
Sdk.track('load', {});
requestAnimationFrame(frame);
