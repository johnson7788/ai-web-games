// 福州麻将 13 · 主入口：60Hz 固定步长 + 标题/游戏/暂停/结算 + 教程 + SDK 统一出口
import { STEP, WORLD, ITEMS } from '../config/game.config.js';
import { createRun } from './game/sim.js';
import { bestDiscard } from './game/ai.js';
import { tileName } from './game/tiles.js';
import { createRenderer } from './render/index.js';
import { createAudio } from './core/audio.js';
import { ui } from './ui/ui.js';
import { i18n, t, syncDocumentLang } from './core/i18n.js';
import Sdk from './core/sdk.js';

const $ = (id) => document.getElementById(id);

const renderer = createRenderer(ui.canvas);
const audio = createAudio();

let run = null;
let phase = 'title'; // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let fpsSamples = [];
let tutorialStep = -1;
let muted = !!Sdk.load('muted', false);
let tutorialDone = !!Sdk.load('tutorialDone', false);
let coins = Sdk.load('coins', 50) | 0;
let bestStars = Sdk.load('bestStars', 0) | 0;
let totalStars = Sdk.load('totalStars', 0) | 0;
let bestStreak = Sdk.load('bestStreak', 0) | 0;

Sdk.ready(); // 不 await，不阻塞首屏
audio.setMuted(muted);
ui.setMuted(muted);

function persist() {
  Sdk.save('muted', muted);
  Sdk.save('tutorialDone', tutorialDone);
  Sdk.save('coins', coins);
  Sdk.save('bestStars', bestStars);
  Sdk.save('totalStars', totalStars);
  Sdk.save('bestStreak', bestStreak);
}

function totalStarsShown() {
  return totalStars;
}

// ---------- 阶段状态机 ----------
function setPhase(p) { phase = p; }

function startLevel(seed) {
  run = createRun(seed == null ? ((Date.now() % 2147483647) || 1) : seed);
  run.coins = coins;
  setPhase('playing');
  ui.showGame();
  ui.hideResult();
  ui.hideActionMenu();
  audio.startBgm();
  updateHud();
  Sdk.track('start', { round: run.roundNum });
  if (!tutorialDone) startTutorial();
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
  if (run) Sdk.track('restart', { round: run.roundNum });
  startLevel(run ? run.seed : undefined);
}

function goHome() {
  run = null;
  setPhase('title');
  ui.hideResult();
  ui.showTitle();
  updateTitleStars();
}

function updateTitleStars() {
  ui.starsTotal.textContent = `★ ${bestStars} · ${totalStarsShown()}`;
}

// ---------- HUD ----------
function updateHud() {
  if (!run) return;
  const h = run.getHud();
  ui.hudJoker.textContent = `${t('joker')} · ${tileName(h.joker, i18n.lang)}`;
  ui.hudRound.textContent = `${t('round')} ${h.round}`;
  ui.hudStreak.textContent = `${t('streak')} ×${h.streak}`;
  ui.hudCoins.textContent = `◈ ${h.coins}`;
  ui.hudWall.textContent = `${t('wall')} ${h.wall}`;
  const listen = h.listen || [];
  ui.hudListen.classList.toggle('hidden', listen.length === 0);
  ui.hudListen.textContent = listen.length ? `${t('listen')}: ${listen.map((x) => tileName(x, i18n.lang)).join(' ')}` : '';
  updateActionMenu();
}

function updateActionMenu() {
  const s = run ? run.state : null;
  const show = !!(run && phase === 'playing' && s.actor === 0 && (s.stage === 'awaitSelf' || s.stage === 'awaitClaim'));
  const claim = s && s.stage === 'awaitClaim' ? s.claims : null;
  const self = s && s.stage === 'awaitSelf' ? s.selfActions : null;
  ui.btnChi.classList.toggle('hidden', !(show && claim && claim.canEat));
  ui.btnPeng.classList.toggle('hidden', !(show && claim && claim.canPong));
  ui.btnGang.classList.toggle('hidden', !(show && ((claim && claim.canKong) || (self && self.kongOptions && self.kongOptions.length))));
  ui.btnHu.classList.toggle('hidden', !(show && ((claim && claim.canHu) || (self && self.canHu))));
  ui.btnPass.classList.toggle('hidden', !show);
  ui.actionMenu.classList.toggle('hidden', !show);
}

function drainAndHandle() {
  if (run) handleEvents(run.drainEvents());
}

// ---------- 结算 ----------
function finishRun(ev) {
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  const st = run.state;
  const won = ev.type === 'win';
  const res = st.result || {};
  coins = run.coins;
  if (won) {
    totalStars += res.stars || 0;
    bestStars = Math.max(bestStars, res.stars || 0);
    bestStreak = Math.max(bestStreak, run.streak);
  }
  persist();
  Sdk.track(won ? 'win' : (ev.type === 'drawRound' ? 'draw' : 'fail'), {
    round: st.round, winType: res.winType, stars: res.stars, streak: run.streak,
  });
  showResult(res);
  audio.event(ev.type);
}

function showResult(res) {
  const won = res && res.won;
  ui.resultTitle.textContent = won ? t('winTitle') : (res && res.reason === 'noWin' ? t('drawTitle') : t('loseTitle'));
  ui.resultTitle.classList.toggle('lose', !won && res && res.reason !== 'noWin');
  const stars = res && res.stars ? res.stars : 0;
  ui.resultStars.innerHTML = won
    ? `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}`
    : (res && res.reason === 'noWin' ? t('noWin') : `${t('aiWin')}`);
  const winTypeLabel = res && res.winType ? ({ 1: t('pinghu'), 2: t('jinque'), 3: t('threejin') })[res.winType] : '';
  const lines = [];
  if (won) {
    lines.push(`${t('winType')}: ${winTypeLabel} · ${t('score')}: ${res.score}`);
    lines.push(`${t('flowers')}: ${res.flowers} · ${t('streak')}: ×${res.streak}`);
  } else if (res && res.reason === 'noWin') {
    lines.push(`${t('flowers')}: ${res.flowers}`);
  } else {
    lines.push(`${t('flowers')}: ${res.flowers}`);
  }
  ui.resultMeta.textContent = lines.join(' · ');
  ui.showResult();
}

// ---------- 教程 ----------
const TUT_IDS = ['deal', 'claim', 'joker', 'items'];
const TUT_STEPS = () => [t('tutStep1'), t('tutStep2'), t('tutStep3'), t('tutStep4')];

function startTutorial() {
  tutorialStep = 0;
  renderTutorial();
}

function renderTutorial() {
  const el = ui.tut;
  if (tutorialStep < 0) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  ui.tutText.textContent = TUT_STEPS()[tutorialStep] || '';
  ui.tutSpot.style.display = 'none';
}

function tutorialNext() {
  tutorialStep += 1;
  if (tutorialStep >= TUT_STEPS().length) endTutorial();
  else renderTutorial();
}

function endTutorial() {
  tutorialStep = -1;
  tutorialDone = true;
  persist();
  renderTutorial();
}

function tutorialAdvance(evType) {
  if (tutorialStep < 0) return;
  // 真实动作推进：出牌/吃碰杠/胡
  if (evType === 'discard' && tutorialStep === 0) tutorialNext();
  else if ((evType === 'chow' || evType === 'pong' || evType === 'kong') && tutorialStep === 1) tutorialNext();
  else if (evType === 'joker' && tutorialStep === 2) tutorialNext();
  else if (evType === 'item' && tutorialStep === 3) tutorialNext();
}

// ---------- 事件消费 ----------
function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    tutorialAdvance(ev.type);
    if (ev.type === 'win' || ev.type === 'lose' || ev.type === 'drawRound') {
      finishRun(ev);
      return;
    }
  }
}

// ---------- 输入 ----------
function canvasPos(e) {
  const rect = ui.canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (WORLD.WIDTH / rect.width),
    y: (e.clientY - rect.top) * (WORLD.HEIGHT / rect.height),
  };
}

function pickHandTile(p) {
  const s = run.state;
  const hand = s.seats[0].hand;
  const tw = 46;
  const th = 62;
  const gap = 4;
  const y = WORLD.HEIGHT - th - 26;
  const totalW = hand.length * tw + (hand.length - 1) * gap;
  let x = (WORLD.WIDTH - totalW) / 2;
  for (const t of hand) {
    if (p.x >= x && p.x <= x + tw && p.y >= y && p.y <= y + th) return t;
    x += tw + gap;
  }
  return null;
}

ui.canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (!run || phase !== 'playing') return;
  const s = run.state;
  if (s.stage === 'awaitDiscard' && s.actor === 0) {
    const t = pickHandTile(canvasPos(e));
    if (t != null) {
      const r = run.discard(t);
      if (r.ok) { audio.event('discard'); drainAndHandle(); updateHud(); }
    }
  }
});

// 键盘
window.addEventListener('keydown', (e) => {
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
  persist();
}

// ---------- UI 绑定 ----------
function bind() {
  const on = (id, fn) => {
    const el = $(id);
    if (el) el.addEventListener('click', () => { audio.unlock(); fn(); });
  };
  on('btn-start', () => startLevel());
  on('btn-resume', resumeGame);
  on('btn-restart', restartLevel);
  on('btn-restart2', restartLevel);
  on('btn-retry', restartLevel);
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result') startTutorial(); });
  on('btn-howto-title', () => startTutorial());
  on('btn-tut-replay', () => { if (phase === 'paused') resumeGame(); if (phase === 'playing') startTutorial(); });
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);

  on('btn-hu', () => { if (run) { run.act('hu'); drainAndHandle(); updateHud(); } });
  on('btn-gang', () => { if (run) { run.act('kong'); drainAndHandle(); updateHud(); } });
  on('btn-peng', () => { if (run) { run.act('pong'); drainAndHandle(); updateHud(); } });
  on('btn-chi', () => { if (run) { run.act('eat', 0); drainAndHandle(); updateHud(); } });
  on('btn-pass', () => { if (run) { run.act('pass'); drainAndHandle(); updateHud(); } });

  on('btn-hint', () => useItem('hint'));
  on('btn-rejoker', () => useItem('reJoker'));
  on('btn-backdraw', () => useItem('backDraw'));

  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = $(id);
    if (!sel) continue;
    sel.addEventListener('change', () => {
      ui.setLang(sel.value);
      renderTutorial();
      if (run) updateHud();
      updateTitleStars();
    });
  }
}

function useItem(id) {
  if (!run || phase !== 'playing') return;
  const r = run.useItem(id);
  if (r.ok) {
    audio.event('item', { id });
    drainAndHandle();
    updateHud();
    if (id === 'backDraw') toast(t('backDraw') + ' ✓');
  } else {
    toast(t(r.reason || 'noCoins'));
  }
}

// ---------- toast ----------
let toastEl = null;
function toast(msg) {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.style.cssText = 'position:absolute;left:50%;bottom:96px;transform:translateX(-50%);background:rgba(20,12,45,0.95);border:1px solid rgba(201,166,255,0.6);color:#eef0ff;border-radius:8px;padding:8px 18px;z-index:40;font-size:0.95rem;pointer-events:none;transition:opacity 0.4s;';
    document.getElementById('game-container').appendChild(toastEl);
  }
  toastEl.textContent = msg;
  toastEl.style.opacity = '1';
  clearTimeout(toastEl._t);
  toastEl._t = setTimeout(() => { toastEl.style.opacity = '0'; }, 1400);
}

// ---------- 主循环 ----------
function frame(now) {
  requestAnimationFrame(frame);
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
    renderer.draw(run ? run.state : null);
  } catch (err) {
    console.warn('render error', err);
  }

  if (fpsSamples.length < 600 && dt > 0) fpsSamples.push(1 / dt);
}

// ---------- 自动打牌（验收/快进用） ----------
function autoAct() {
  const s = run.state;
  const hand = s.seats[0].hand;
  if (s.stage === 'awaitSelf') {
    if (s.selfActions.canHu) { run.act('hu'); return; }
    const k = s.selfActions.kongOptions[0];
    if (s.selfActions.kongOptions.length && k.options[0] !== s.joker) { run.act('kong'); return; }
    run.act('pass');
    return;
  }
  if (s.stage === 'awaitClaim') {
    if (s.claims.canHu) { run.act('hu'); return; }
    if (s.claims.canPong) { run.act('pong'); return; }
    if (s.claims.canEat) { run.act('eat', 0); return; }
    run.act('pass');
    return;
  }
  if (s.stage === 'awaitDiscard') {
    run.discard(bestDiscard(hand, s.joker));
  }
}

function fastForward() {
  if (!run || phase !== 'playing') return false;
  let guard = 0;
  while (guard++ < 400000 && run.state.phase === 'playing') {
    run.step(STEP);
    handleEvents(run.drainEvents());
    if (run.state.actor === 0 && run.state.phase === 'playing') autoAct();
  }
  handleEvents(run.drainEvents());
  if (run) updateHud();
  return true;
}

// ---------- 调试契约 ----------
window.__ll = {
  state: {
    get phase() { return phase; },
    get lang() { return i18n.lang; },
  },
  run: () => run,
  start: (seed) => startLevel(seed),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => restartLevel(),
  home: () => goHome(),
  save: () => persist(),
  ui: () => ui,
  sim: () => (run ? run.state : null),
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return TUT_IDS.slice(); },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: () => (run ? run.state : null),
    hand: () => (run ? run.state.seats[0].hand.slice() : []),
    hint: () => {
      if (!run) return null;
      const r = run.useItem('hint');
      if (r.ok) { updateHud(); return r.info; }
      return null;
    },
    fastForward: () => fastForward(),
    autoAct: () => autoAct(),
  },
};

// ---------- 启动 ----------
bind();
syncDocumentLang();
ui.applyLang();
updateTitleStars();
ui.showTitle();
renderer.draw(null);
Sdk.track('load', {});
requestAnimationFrame(frame);
