// 主入口：60Hz 固定步长 + 标题/游戏/暂停/结算 + 教程引导 + SDK 统一出口。
// 装配：sim（纯逻辑）/ render（canvas 霓虹）/ ui（DOM 显隐）/ audio（WebAudio 程序化）。
import { STEP, WORLD, GAME } from '../config/game.config.js';
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
let phase = 'title';   // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let tutorialStep = -1;
let pendingStart = false;

const view = {
  fx: [],
  shake: 0,
  time: 0,
  demo: null,
};

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let tutorialDone = !!Sdk.load('tutorialDone', false);
let best = Sdk.load('best', 0) | 0;
let starsByLevel = Sdk.load('stars', {}) || {};
let unlocked = Math.max(1, Sdk.load('unlocked', 1) | 0);
let lastLevel = Sdk.load('lastLevel', 0) | 0;

Sdk.ready();
audio.setMuted(muted);

function persist() {
  Sdk.save('muted', muted);
  Sdk.save('tutorialDone', tutorialDone);
  Sdk.save('best', best);
  Sdk.save('stars', starsByLevel);
  Sdk.save('unlocked', unlocked);
  Sdk.save('lastLevel', lastLevel);
}

function totalStars() {
  return Object.values(starsByLevel).reduce((a, b) => a + (b | 0), 0);
}

// ---------- 阶段 ----------
function setPhase(p) { phase = p; }

function showKeypad(on) {
  $('keypad').classList.toggle('hidden', !on);
}

function startLevel(idx) {
  idx = Math.max(0, Math.min(LEVEL_COUNT - 1, idx | 0));
  lastLevel = idx;
  run = createRun(idx, { seed: (Date.now() % 2147483647) || 1 });
  setPhase('playing');
  ui.showGame();
  hideResult();
  showKeypad(true);
  view.demo = null;
  updateHud();
  audio.startBgm();
  Sdk.newRun();
  Sdk.track('start', { level: idx + 1 });
}

function pauseGame() {
  if (phase !== 'playing') return;
  setPhase('paused');
  audio.stopBgm();
  ui.showPause();
  showKeypad(false);
}

function resumeGame() {
  if (phase !== 'paused') return;
  setPhase('playing');
  ui.hidePause();
  showKeypad(true);
  audio.startBgm();
}

function restartLevel() {
  if (run) Sdk.track('restart', { level: run.state.level });
  startLevel(run ? run.state.level - 1 : lastLevel);
}

function goHome() {
  run = null;
  tutorialStep = -1;
  pendingStart = false;
  setPhase('title');
  hideResult();
  ui.showTitle();
  showKeypad(false);
  view.demo = null;
  audio.stopBgm();
  renderTutorialStep();
  updateTitleStats();
}

function nextLevel() {
  const idx = (run ? run.state.level - 1 : lastLevel) + 1;
  if (idx >= LEVEL_COUNT) { goHome(); return; }
  startLevel(idx);
}

// ---------- HUD / 标题统计 / 结算 ----------
function updateHud() {
  if (!run) return;
  const h = run.getHud();
  $('hud-level').textContent = `${t('level')} ${h.level}`;
  const secs = Math.max(0, Math.ceil(h.timeLeft));
  const timeEl = $('hud-time');
  timeEl.textContent = secs + 's';
  timeEl.classList.toggle('time-low', secs <= 10);
  $('hud-score').textContent = `${t('score')} ${h.score}`;
  $('hud-combo').textContent = h.combo >= 2 ? `×${h.combo}` : '';
  $('keypad-input').textContent = h.input || '';
}

function updateTitleStats() {
  const el = $('title-stats');
  if (el) el.textContent = `★ ${totalStars()} / ${LEVEL_COUNT * 3} · ${t('best')} ${best}`;
}

function showResult(res) {
  const { won, stars, score, rightCount, maxCombo, reason, hasNext } = res;
  $('result-title').textContent = won ? t('winTitle') : t('loseTitle');
  $('result-title').classList.toggle('lose', !won);
  $('result-stars').innerHTML = won
    ? `<span class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>`
    : '';
  $('result-meta').textContent = won
    ? `${t('score')} ${score} · ${t('combo')} ×${maxCombo} · ✓ ${rightCount}`
    : (reason === 'missLimit' ? t('loseByMiss') : t('loseByTime'));
  $('btn-next').style.display = won && hasNext ? '' : 'none';
  $('screen-result').classList.remove('hidden');
}

function hideResult() {
  $('screen-result').classList.add('hidden');
}

function finishRun(ev) {
  setPhase('result');
  audio.stopBgm();
  showKeypad(false);
  if (tutorialStep >= 0) endTutorial();
  const st = run.state;
  const won = ev.type === 'win';
  const stars = won ? (ev.stars || 1) : 0;
  if (won) {
    const idx = st.level;
    starsByLevel[idx] = Math.max(starsByLevel[idx] | 0, stars);
    if (idx < LEVEL_COUNT) unlocked = Math.max(unlocked, idx + 1);
    if (st.score > best) best = st.score;
    Sdk.levelCleared({ level: idx, stars, score: st.score });
  } else {
    Sdk.gameOver({ level: st.level, score: st.score });
  }
  persist();
  showResult({
    won,
    stars,
    score: st.score,
    rightCount: st.rightCount,
    maxCombo: st.maxCombo,
    reason: ev.reason || null,
    hasNext: st.level < LEVEL_COUNT,
  });
  audio.event(won ? 'win' : 'lose');
}

// ---------- 教程引导（首次自动弹，可跳过，完成/跳过后持久化不再自动弹） ----------
const TUT_IDS = ['field', 'keypad', 'dispel', 'veil'];

function tutSteps() {
  return [
    { text: t('tutStep1'), spot: 'field' },
    { text: t('tutStep2'), spot: 'keypad' },
    { text: t('tutStep3'), spot: 'dispel' },
    { text: t('tutStep4'), spot: 'veil' },
  ];
}

function rectOf(el) {
  if (!el) return { x: 0, y: 0, w: 0, h: 0 };
  return { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight };
}

function spotRect(spot) {
  if (spot === 'keypad') return rectOf($('keypad'));
  if (spot === 'dispel') return rectOf($('btn-dispel'));
  if (spot === 'veil') return { x: 0, y: GAME.VEIL_Y - 6, w: WORLD.WIDTH, h: 18 };
  return { x: 40, y: 70, w: WORLD.WIDTH - 80, h: GAME.VEIL_Y - 100 };
}

function renderTutorialStep() {
  const el = $('tutorial');
  if (tutorialStep < 0) {
    el.classList.add('hidden');
    view.demo = null;
    return;
  }
  const steps = tutSteps();
  const s = steps[tutorialStep];
  el.classList.remove('hidden');
  $('tut-title').textContent = t('tutTitle');
  $('tut-text').textContent = s ? s.text : '';
  $('tut-skip').textContent = t('tutSkip');
  $('tut-next').textContent = t('tutNext');
  const r = s ? spotRect(s.spot) : null;
  const spot = $('tut-spotlight');
  if (r && r.w > 0) {
    spot.style.display = 'block';
    spot.style.left = `${r.x - 8}px`;
    spot.style.top = `${r.y - 8}px`;
    spot.style.width = `${r.w + 16}px`;
    spot.style.height = `${r.h + 16}px`;
  } else {
    spot.style.display = 'none';
  }
  view.demo = { subject: '3+2', result: 5, x: WORLD.WIDTH / 2, y: 300, golden: false };
}

function startTutorial() {
  tutorialStep = 0;
  renderTutorialStep();
}

function tutorialNext() {
  tutorialStep += 1;
  if (tutorialStep >= tutSteps().length) endTutorial();
  else renderTutorialStep();
}

function endTutorial() {
  tutorialStep = -1;
  if (!tutorialDone) { tutorialDone = true; persist(); }
  renderTutorialStep();
  if (pendingStart) { pendingStart = false; startLevel(0); }
}

// ---------- 事件消费 ----------
function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    switch (ev.type) {
      case 'correct':
        view.fx.push({ kind: 'burst', x: ev.x, y: ev.y, color: '#57f6ff', ttl: 0.4 });
        break;
      case 'bonus':
        view.fx.push({ kind: 'burst', x: ev.x, y: ev.y, color: '#ffd84e', ttl: 0.5 });
        break;
      case 'miss':
        view.fx.push({ kind: 'veilFlash', ttl: 0.35 });
        view.shake = 3;
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

// ---------- 键盘 / 数字键盘输入 ----------
function keypadPress(key) {
  audio.unlock();
  if (!run || phase !== 'playing') return;
  if (key === 'back') {
    run.backspace();
    audio.event('backspace');
  } else if (key === 'dispel') {
    run.submit(); // correct/error 事件由 handleEvents 消费
  } else {
    run.typeDigit(key);
    audio.event('key');
  }
  updateHud();
}

function bind() {
  const on = (id, fn) => {
    const el = $(id);
    if (el) el.addEventListener('click', () => { audio.unlock(); fn(); });
  };
  on('btn-start', () => {
    if (!tutorialDone) { pendingStart = true; startTutorial(); }
    else startLevel(lastLevel || 0);
  });
  on('btn-resume', resumeGame);
  on('btn-restart', restartLevel);
  on('btn-restart2', restartLevel);
  on('btn-retry', restartLevel);
  on('btn-next', nextLevel);
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);
  on('btn-tut-replay', () => { startTutorial(); });
  on('btn-howto', () => { startTutorial(); });

  $('keypad-grid')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-key]');
    if (btn) keypadPress(btn.dataset.key);
  });

  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = $(id);
    if (!sel) continue;
    sel.addEventListener('change', () => {
      ui.setLang(sel.value);
      renderTutorialStep();
      if (run) updateHud();
      updateTitleStats();
    });
  }
}

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  ui.setMuted(muted);
  $('btn-mute').classList.toggle('is-muted', muted);
  persist();
}

// 物理键盘：数字 / 退格 / 回车 = 化解
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
  if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'result')) restartLevel();
  if (e.code === 'KeyM') toggleMute();
  if (phase !== 'playing' || !run) return;
  if (/^Digit[0-9]$/.test(e.code)) { keypadPress(e.code.slice(5)); }
  else if (/^Numpad[0-9]$/.test(e.code)) { keypadPress(e.code.slice(6)); }
  else if (e.code === 'Backspace') { e.preventDefault(); keypadPress('back'); }
  else if (e.code === 'Enter' || e.code === 'NumpadEnter') { keypadPress('dispel'); }
});

// ---------- 主循环 ----------
function frame(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;
  view.time += dt;

  if (phase === 'playing' && run) {
    accumulator += dt;
    while (accumulator >= STEP) {
      run.step(STEP);
      accumulator -= STEP;
    }
    handleEvents(run.drainEvents());
    if (run && phase === 'playing') updateHud();
  }

  for (const fx of view.fx) if (fx.ttl > 0) fx.ttl -= dt;
  view.fx = view.fx.filter((fx) => fx.ttl > 0);

  try {
    renderer.draw(run ? run.state : null, dt, view);
  } catch (err) {
    console.warn('render error', err);
  }

  requestAnimationFrame(frame);
}

// ---------- 调试契约 ----------
window.__ll = {
  state: {
    get phase() { return phase; },
    get lang() { return i18n.lang; },
  },
  run: () => run,
  start: (i) => { if (tutorialStep >= 0) endTutorial(); startLevel(i == null ? (lastLevel || 0) : i); },
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => goHome(),
  home: () => goHome(),
  sim: () => (run ? run.state : null),
  save: (k, v) => Sdk.save(k, v),
  ui: () => ui,
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return TUT_IDS.slice(); },
    get current() { return tutorialStep >= 0 ? tutSteps()[tutorialStep] : null; },
    skip() { endTutorial(); },
  },
  startTutorial: () => startTutorial(),
  debug: {
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    // 验收辅助：贪心自动解到终局（用于截图/快速验证），返回是否过关
    autoWin: () => {
      if (!run || (phase !== 'playing' && phase !== 'countdown')) startLevel(0);
      let guard = 200000;
      while (guard-- > 0 && run && (run.state.phase === 'playing' || run.state.phase === 'countdown')) {
        if (run.state.phase === 'playing' && run.state.subjects.length) {
          let low = run.state.subjects[0];
          for (const s of run.state.subjects) if (s.y > low.y) low = s;
          run.answer(low.result);
        }
        run.step(1 / 60);
        handleEvents(run.drainEvents());
        if (run && (run.state.phase === 'won' || run.state.phase === 'lost')) break;
      }
      return run ? run.state.phase === 'won' : false;
    },
    state: () => (run ? run.state : null),
  },
};

// ---------- 启动 ----------
bind();
syncDocumentLang();
ui.applyLang();
updateTitleStats();
$('btn-mute').classList.toggle('is-muted', muted);
Sdk.track('load', {});
requestAnimationFrame(frame);
