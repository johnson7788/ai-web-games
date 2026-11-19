// 主入口：60Hz 固定步长 + 标题/游戏/暂停/结算 + 首次交互教程 + SDK 统一出口。
// 装配：sim(M1 纯逻辑) / render(M2 canvas) / ui(M2 DOM) / audio(M4 WebAudio)。
import {
  STEP, WORLD, PLAYER, TOWER, LEVELS, STAR_THRESHOLDS, ROCK, TOKEN, TUTORIAL_STEPS,
} from '../config/game.config.js';
import { createRun, starsForScore } from './game/sim.js';
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
let phase = 'title';      // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let tutorialStep = -1;    // -1 = 未激活
let pendingDeath = null;

// ---------- 存档（统一走 Sdk） ----------
let savedBest = Sdk.load('best', 0) | 0;
let muted = !!Sdk.load('muted', false);
let tutorialDone = !!Sdk.load('tutorialDone', false);

Sdk.ready(); // 不 await，不阻塞首屏
audio.setMuted(muted);
ui.setMuted(muted);

function persist() {
  Sdk.save('best', savedBest);
  Sdk.save('muted', muted);
  Sdk.save('tutorialDone', tutorialDone);
}

function zoneName(level) {
  const lv = LEVELS[level - 1] || LEVELS[0];
  return (lv.name[i18n.lang] || lv.name.en || '');
}

// ---------- 阶段状态机 ----------
function setPhase(p) { phase = p; }

function newRun() {
  run = createRun({ seed: (Date.now() % 2147483647) || 1, best: savedBest });
  pendingDeath = null;
  setPhase('playing');
  ui.show('game');
  hideResult();
  updateHud();
  audio.startBgm();
  Sdk.newRun({});
  if (!tutorialDone) startTutorial();
}

function startGame() {
  newRun();
}

function pauseGame() {
  if (phase !== 'playing') return;
  setPhase('paused');
  audio.stopBgm();
  ui.show('pause');
}

function resumeGame() {
  if (phase !== 'paused') return;
  setPhase('playing');
  ui.hidePause();
  audio.startBgm();
}

function restart() {
  newRun();
}

function goHome() {
  if (pendingDeath) { clearTimeout(pendingDeath); pendingDeath = null; }
  run = null;
  setPhase('title');
  audio.stopBgm();
  hideResult();
  ui.show('title');
  renderTitleBest();
}

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  ui.setMuted(muted);
  $('btn-mute').classList.toggle('is-muted', muted);
  refreshMuteLabel();
  persist();
}

// ---------- HUD / 结算 ----------
function updateHud() {
  if (!run) return;
  const h = run.getHud();
  $('hud-score').textContent = h.score;
  $('hud-best').textContent = `${t('best')}: ${h.best}`;
  $('hud-level').textContent = `${t('level')} ${h.level} · ${zoneName(h.level)}`;
  const mail = $('hud-mail');
  mail.textContent = `✉ ${h.mail}`;
  mail.classList.toggle('hidden', h.mail === 0);
  const combo = $('hud-combo');
  combo.textContent = `×${h.combo}`;
  combo.classList.toggle('hidden', h.combo < 2);
}

function renderTitleBest() {
  const el = $('title-best');
  if (el) el.textContent = savedBest > 0 ? `${t('best')}: ${savedBest}` : '';
}

function showResult() {
  if (!run) return;
  setPhase('result');
  audio.stopBgm();
  $('hud').classList.add('hidden');
  if (tutorialStep >= 0) endTutorial();
  const st = run.state;
  const stars = starsForScore(st.score);
  const newBest = st.score > savedBest;
  if (newBest) savedBest = st.score;
  Sdk.save('best', savedBest);
  Sdk.gameOver({ score: st.score, level: st.level, stars });
  $('result-title').textContent = newBest ? t('newBest') : t('gameOver');
  $('result-stars').innerHTML = '★'.repeat(stars) + '☆'.repeat(Math.max(0, 3 - stars));
  $('result-score').textContent = st.score;
  $('result-meta').innerHTML =
    `${t('best')}: ${savedBest} · ${t('mail')}: ${st.mail} · ${t('combo')}: ${st.maxCombo}<br>` +
    `${t('distance')}: ${Math.round(st.distance / 40)} m`;
  ui.show('result');
}

function hideResult() {
  $('screen-result').classList.add('hidden');
}

function onDeath() {
  if (pendingDeath) return;
  renderer.burst('death', PLAYER.X, run ? run.bird.y : 300);
  renderer.addShake(7);
  pendingDeath = setTimeout(() => {
    pendingDeath = null;
    if (phase === 'playing' && run && run.state.phase === 'dead') showResult();
  }, 560);
}

// ---------- 教程（首次自动弹，可跳过，完成/跳过后持久化） ----------
const TUT_STEPS = () => [
  { text: t('tutStep1'), trigger: 'flap' },
  { text: t('tutStep2'), trigger: 'score' },
  { text: t('tutStep3'), trigger: 'collect' },
];

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

function startTutorial() {
  tutorialStep = 0;
  renderTutorialStep();
}

function endTutorial() {
  tutorialStep = -1;
  tutorialDone = true;
  persist();
  renderTutorialStep();
}

function tutorialNext() {
  if (tutorialStep < 0) return;
  tutorialStep += 1;
  if (tutorialStep >= TUT_STEPS().length) endTutorial();
  else renderTutorialStep();
}

function tutorialAdvance(evType) {
  if (tutorialStep < 0) return;
  const steps = TUT_STEPS();
  if (tutorialStep < steps.length && steps[tutorialStep].trigger === evType) {
    tutorialStep += 1;
    if (tutorialStep >= steps.length) endTutorial();
    else renderTutorialStep();
  }
}

// ---------- 漂浮提示 ----------
let toastTimer = null;
function showToast(msg) {
  const el = $('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 1600);
}

// ---------- 事件消费 ----------
function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    tutorialAdvance(ev.type);
    switch (ev.type) {
      case 'flap':
        renderer.burst('flap', PLAYER.X, run.bird.y - 10);
        break;
      case 'collect':
        renderer.burst('collect', PLAYER.X + 14, run.bird.y);
        break;
      case 'delivery':
        renderer.burst('delivery', PLAYER.X, run.bird.y);
        renderer.addShake(2);
        showToast(t('mailFull'));
        break;
      case 'combo':
        showToast(t('comboHit', { n: ev.combo }));
        renderer.burst('delivery', PLAYER.X, run.bird.y - 12);
        break;
      case 'levelup':
        showToast(t('zoneUp', { zone: zoneName(ev.level) }));
        renderer.addShake(3);
        break;
      case 'death':
        onDeath();
        return;
      default:
        break;
    }
  }
}

// ---------- 输入 ----------
function tap() {
  if (phase === 'title') { startGame(); return; }
  if (phase === 'paused' || phase === 'result') return;
  if (phase === 'playing' && run) run.flap();
}

function refreshMuteLabel() {
  const b = $('btn-mute');
  if (b) b.setAttribute('aria-label', muted ? t('unmute') : t('mute'));
  if (b) b.textContent = muted ? '🔇' : '🔊';
}

// 静态文案（切语言 / 初始化时调用）
function refreshStaticText() {
  ui.applyLang();
  $('btn-retry').textContent = t('retry');
  $('btn-home2').textContent = t('home');
  $('btn-share').textContent = t('share');
  $('btn-howto').textContent = '?';
  $('btn-howto').setAttribute('aria-label', t('howto'));
  $('title-hint').textContent = t('flap');
  $('rotate-text').textContent = t('rotateHint');
  $('btn-rotate-skip').textContent = t('rotateSkip');
  renderTutorialStep();
  renderTitleBest();
  refreshMuteLabel();
  if (run) updateHud();
}

// ---------- UI 绑定 ----------
function bind() {
  const on = (id, fn) => {
    const el = $(id);
    if (el) el.addEventListener('click', () => { audio.unlock(); fn(); });
  };
  on('btn-start', startGame);
  on('btn-resume', resumeGame);
  on('btn-restart2', restart);
  on('btn-retry', restart);
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result' || phase === 'title') startTutorial(); });
  on('btn-tut-replay', () => { if (phase === 'paused') resumeGame(); if (phase === 'playing') startTutorial(); });
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);
  on('btn-share', async () => { await Sdk.share({ text: `CARRIER PIGEON DASH — ${savedBest}` }); });

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    audio.unlock();
    tap();
  });

  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = $(id);
    if (!sel) continue;
    sel.addEventListener('change', () => { ui.setLang(sel.value); refreshStaticText(); });
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
      e.preventDefault();
      audio.unlock();
      tap();
    } else if (e.code === 'Escape' || e.code === 'KeyP') {
      if (phase === 'playing') pauseGame();
      else if (phase === 'paused') resumeGame();
    } else if (e.code === 'KeyR') {
      if (phase === 'playing' || phase === 'paused' || phase === 'result') restart();
    } else if (e.code === 'KeyM') {
      toggleMute();
    }
  });
}

// ---------- 主循环 ----------
function frame(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;

  if (phase === 'playing' && run) {
    accumulator += dt;
    while (accumulator >= STEP) {
      run.step(STEP);
      accumulator -= STEP;
    }
    handleEvents(run.drainEvents());
    if (run && phase === 'playing') updateHud();
  }

  try {
    renderer.draw(run, dt);
  } catch (err) {
    // 渲染异常不打断主循环
  }

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
  start: () => startGame(),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => restart(),
  home: () => goHome(),
  save: () => Sdk,
  ui: () => ui,
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['flap', 'score', 'collect']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip() { endTutorial(); },
  },
  startTutorial: () => startTutorial(),
  debug: {
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    state: () => (run ? run.state : null),
    pose: () => {
      if (!run || phase !== 'playing') newRun();
      if (tutorialStep >= 0) endTutorial();
      run.state.phase = 'playing';
      run.bird.y = 320;
      run.bird.vy = 0;
      run.towers = [{ x: 640, gapY: 320, gap: 360, passed: false, token: { y: 320, collected: false } }];
      run.rocks = [];
      run._lastGapY = 320;
      run._nextDist = run.state.distance + TOWER.SPACING;
      run._events = [];
    },
    poseRock: () => {
      window.__ll.debug.pose();
      run.towers = [{ x: 820, gapY: 300, gap: 340, passed: false, token: null }];
      run.rocks = [{ x: 580, baseY: 470, y: 470, phase: 0, r: ROCK.R }];
      run._nextDist = run.state.distance + TOWER.SPACING;
    },
    die: () => { if (run) run.die('force'); },
  },
};

window.G = {
  run: () => run,
  state: () => phase,
  ui,
  Sdk,
  renderer,
};

// ---------- 启动 ----------
bind();
syncDocumentLang();
refreshStaticText();
$('btn-mute').classList.toggle('is-muted', muted);
Sdk.track('load', {});
requestAnimationFrame(frame);
