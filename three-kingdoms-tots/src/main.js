// 主入口：60Hz 固定步长 + 标题/战役/战斗/暂停/结算 + 教程引导 + SDK 统一出口。
// 装配：sim（纯逻辑）/ render（canvas 程序化）/ audio（WebAudio 程序化）/ ui（语言与显隐）。
import { STEP, GAME, WORLD, LAYOUT, CONFIG } from '../config/game.config.js';
import { CARDS, CARD_MAP, LEVELS, LEVEL_COUNT, levelAt } from '../config/levels.js';
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
let phase = 'title'; // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let fpsSamples = [];
let selectedCard = null;

const view = {
  fxQueue: [],
  shake: 0,
  hoverLane: null,
  cursor: { x: 0, y: 0 },
};

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let unlocked = Math.max(1, Sdk.load('unlocked', 1) | 0);
let starsByLevel = Sdk.load('stars', {}) || {};
let tutorialDone = !!Sdk.load('tutorialDone', false);
let lastLevel = Sdk.load('lastLevel', 0) | 0;

Sdk.ready();
Sdk.onAdStart(() => { if (phase === 'playing') pauseGame(true); });
Sdk.onAdEnd(() => { if (phase === 'paused') resumeGame(); });
audio.setMuted(muted);
ui.setMuted(muted);

function persist() {
  Sdk.save('unlocked', unlocked);
  Sdk.save('stars', starsByLevel);
  Sdk.save('muted', muted);
  Sdk.save('tutorialDone', tutorialDone);
  Sdk.save('lastLevel', lastLevel);
}

function totalStars() {
  return Object.values(starsByLevel).reduce((a, b) => a + (b | 0), 0);
}

// ---------- 阶段状态机 ----------
function setPhase(p) { phase = p; }

function levelName(idx) {
  const lv = levelAt(idx);
  return lv.nameKey ? (i18n.lang === 'zh' ? (t(lv.nameKey)) : t(lv.nameKey)) : '';
}

function startLevel(idx) {
  idx = Math.max(0, Math.min(LEVEL_COUNT - 1, idx | 0));
  lastLevel = idx;
  selectedCard = null;
  run = createRun(idx, { seed: (Date.now() % 2147483647) || 1 });
  setPhase('playing');
  ui.showGame();
  $('hand').classList.remove('hidden');
  hideResult();
  buildCards();
  updateHud();
  audio.startBgm();
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

function restartLevel() {
  if (run) Sdk.track('restart', { level: run.state.level });
  startLevel(run ? run.state.level - 1 : lastLevel);
}

function goHome() {
  run = null;
  selectedCard = null;
  setPhase('title');
  hideResult();
  ui.showTitle();
  $('hand').classList.add('hidden');
  buildLevelGrid();
}

// ---------- 手牌 / 关卡格 ----------
function buildCards() {
  const box = $('cards');
  box.innerHTML = '';
  for (const card of CARDS) {
    const el = document.createElement('button');
    el.className = 'card';
    el.id = `card-${card.id}`;
    el.dataset.card = card.id;
    el.setAttribute('aria-label', t(`card_${card.id}`));
    el.innerHTML =
      `<span class="card-cost">${card.cost}</span>` +
      `<span class="card-icon" style="background:${card.color}">${card.label}</span>` +
      `<span class="card-name">${t('card_' + card.id)}</span>` +
      `<span class="card-cd" style="height:0%"></span>`;
    el.addEventListener('click', () => {
      audio.unlock();
      selectCard(card.id);
    });
    box.appendChild(el);
  }
}

function selectCard(cardId) {
  if (!run || phase !== 'playing') return;
  const slot = run.state.cards.find((c) => c.id === cardId);
  if (!slot) return;
  if (slot.cd > 0 || run.state.energy < slot.cost) return;
  selectedCard = selectedCard === cardId ? null : cardId;
  updateHud();
  audio.event('spawn', { cardId });
}

function buildLevelGrid() {
  const grid = $('level-grid');
  if (!grid) return;
  grid.innerHTML = '';
  for (let i = 0; i < LEVEL_COUNT; i += 1) {
    const lv = LEVELS[i];
    const cell = document.createElement('button');
    cell.className = 'level-cell' + (i + 1 > unlocked ? ' locked' : '');
    cell.dataset.level = i;
    const stars = starsByLevel[i + 1] | 0;
    cell.innerHTML =
      `<span class="lv-num">${i + 1}</span>` +
      `<span class="level-name">${t(lv.nameKey)}</span>` +
      `<span class="level-stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>`;
    cell.setAttribute('aria-label', `${t('level')} ${i + 1}`);
    grid.appendChild(cell);
  }
}

function updateHud() {
  if (!run) return;
  const h = run.getHud();
  const lv = levelAt(run.state.level - 1);
  $('hud-level').textContent = `${t('level')} ${run.state.level} · ${t(lv.nameKey)}`;
  const secs = Math.max(0, Math.ceil(h.time));
  const timeEl = $('hud-time');
  timeEl.textContent = secs + 's';
  timeEl.classList.toggle('time-low', secs <= 10);

  const energyEl = $('hud-energy');
  energyEl.style.width = `${(h.energy / h.maxEnergy) * 100}%`;
  $('hud-energy-num').textContent = `${Math.floor(h.energy)}/${h.maxEnergy}`;

  const comboEl = $('hud-combo');
  comboEl.classList.toggle('on', h.combo > 0);
  if (h.combo > 0) comboEl.textContent = `${t('combo')} ×${h.combo}`;

  $('hud-pkeep').style.width = `${(h.playerKeepHp / h.playerKeepMax) * 100}%`;
  $('hud-pkeep-tag').textContent = `${t('keep')} ${Math.max(0, Math.ceil(h.playerKeepHp / h.playerKeepMax * 100))}%`;
  $('hud-ekeep').style.width = `${(h.enemyKeepHp / h.enemyKeepMax) * 100}%`;
  $('hud-ekeep-tag').textContent = `${t('enemy')} ${Math.max(0, Math.ceil(h.enemyKeepHp / h.enemyKeepMax * 100))}%`;

  for (const card of run.state.cards) {
    const el = $('card-' + card.id);
    if (!el) continue;
    el.classList.toggle('selected', selectedCard === card.id);
    el.classList.toggle('no-energy', card.cd > 0 || run.state.energy < card.cost);
    const cdEl = el.querySelector('.card-cd');
    if (cdEl) cdEl.style.height = card.cdMax > 0 ? `${(card.cd / card.cdMax) * 100}%` : '0%';
  }
}

// ---------- 结算 ----------
function showResult(res) {
  const { won, stars, time, keepHp, keepMax, reason, hasNext } = res;
  const titleEl = $('result-title');
  titleEl.textContent = won ? t('winTitle') : t('loseTitle');
  titleEl.classList.toggle('lose', !won);
  const starsEl = $('result-stars');
  starsEl.innerHTML = won
    ? `<span class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>${stars >= 3 ? `<em>${t('perfect')}</em>` : ''}`
    : '';
  $('result-time').textContent = won ? t('timeLeft', { s: Math.ceil(time) }) : '';
  $('result-meta').textContent = won
    ? t('keepLeft', { p: Math.ceil(keepHp / keepMax * 100) })
    : (reason === 'timeUp' ? t('timeUp') : t('destroyed'));
  $('btn-next').style.display = won && hasNext ? '' : 'none';
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
  const stars = won ? (ev.stars || st.stars || 1) : 0;
  if (won) {
    const idx = st.level; // 1 基
    starsByLevel[idx] = Math.max(starsByLevel[idx] | 0, stars);
    if (idx < LEVEL_COUNT) unlocked = Math.max(unlocked, idx + 1);
    buildLevelGrid();
  }
  persist();
  Sdk.track(won ? 'win' : 'fail', { level: st.level, stars, durationMs: Math.round((st.initialTime - st.time) * 1000) });
  showResult({
    won, stars, time: st.initialTime - st.time, keepHp: st.player.keep.hp, keepMax: st.player.keep.maxHp,
    reason: ev.reason || null, hasNext: st.level + 1 <= LEVEL_COUNT,
  });
  audio.event(won ? 'win' : 'lose');
}

// ---------- 事件消费 ----------
function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    switch (ev.type) {
      case 'spawn':
        view.fxQueue.push({ type: 'spawn', x: ev.x, lane: ev.lane, ttl: 0.5 });
        if (ev.side === 'player') { view.shake = 2; if (tutorialStep === 0) tutorialNext(); }
        break;
      case 'spell':
        view.fxQueue.push({ type: ev.cardId, x: ev.x, lane: 0, ttl: 0.5 });
        view.shake = ev.cardId === 'fire' ? 5 : 3;
        break;
      case 'hit':
        if (tutorialStep === 1) tutorialNext();
        break;
      case 'combo':
        if (tutorialStep === 2) tutorialNext();
        break;
      case 'towerDown':
        view.shake = 6;
        break;
      case 'keepHit':
        view.shake = Math.max(view.shake, 3);
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

// ---------- 教程 ----------
const TUT_STEPS = () => [
  { text: t('tutStep1'), spot: 'hand' },
  { text: t('tutStep2'), spot: 'field' },
  { text: t('tutStep3'), spot: 'enemyKeep' },
];
let tutorialStep = -1;

function layoutRect(which) {
  const lay = renderer.debugLayout();
  if (!lay) return null;
  if (which === 'hand') return lay.hand;
  if (which === 'field') return lay.field;
  if (which === 'enemyKeep') return lay.enemyKeep;
  return null;
}

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
  const rect = s && s.spot && layoutRect(s.spot);
  const spot = $('tut-spotlight');
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
function canvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (WORLD.WIDTH / rect.width),
    y: (e.clientY - rect.top) * (WORLD.HEIGHT / rect.height),
  };
}

function laneOf(y) {
  return y < (LAYOUT.LANE_Y[0] + LAYOUT.LANE_Y[1]) / 2 ? 0 : 1;
}

canvas.addEventListener('pointermove', (e) => {
  const p = canvasPos(e);
  view.cursor = p;
  view.hoverLane = (run && phase === 'playing') ? laneOf(p.y) : null;
});

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (!run || phase !== 'playing') return;
  const p = canvasPos(e);
  view.cursor = p;
  if (p.y < LAYOUT.FIELD_TOP || p.y > LAYOUT.FIELD_BOT) return;
  if (!selectedCard) return;
  const lane = laneOf(p.y);
  const res = run.deploy(selectedCard, lane, p.x);
  if (res.ok) {
    selectedCard = null;
    updateHud();
  } else {
    audio.event('hit', {});
  }
});

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
  on('btn-tut-replay', () => { if (phase === 'paused') resumeGame(); startTutorial(); });
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result') startTutorial(); });
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);

  $('level-grid')?.addEventListener('click', (e) => {
    const idx = e.target.closest('[data-level]')?.dataset.level;
    if (idx == null) return;
    const i = +idx;
    if (i + 1 > unlocked) return;
    startLevel(i);
  });

  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = $(id);
    if (!sel) continue;
    sel.addEventListener('change', () => {
      ui.setLang(sel.value);
      renderTutorialStep();
      buildLevelGrid();
      buildCards();
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

  if (phase === 'playing' && run) {
    accumulator += dt;
    while (accumulator >= STEP) {
      run.step(STEP);
      accumulator -= STEP;
    }
    handleEvents(run.drainEvents());
    if (run && phase === 'playing') updateHud();
  }

  if (view.shake > 0) view.shake = Math.max(0, view.shake - dt * 18);
  for (const fx of view.fxQueue) if (fx.ttl > 0) fx.ttl -= dt;
  view.fxQueue = view.fxQueue.filter((fx) => fx.ttl > 0);

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
  save: (k, v) => Sdk.save(k, v),
  ui,
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['deploy', 'fight', 'combo']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: () => (run ? run.state : null),
    loadLevel: (i) => startLevel(i),
    startSeeded: (i, seed) => {
      const idx = Math.max(0, Math.min(LEVEL_COUNT - 1, i | 0));
      lastLevel = idx;
      selectedCard = null;
      run = createRun(idx, { seed: seed | 0 || 1 });
      endTutorial();
      setPhase('playing');
      ui.showGame();
      $('hand').classList.remove('hidden');
      hideResult();
      buildCards();
      updateHud();
      return true;
    },
    autoPlay: () => {
      if (!run) return false;
      // 快速铺一批兵（验收辅助：充能 + 清冷却，铺满两条兵线）
      const seq = ['general', 'cavalry', 'archer', 'militia', 'catapult', 'militia', 'archer', 'cavalry', 'militia', 'archer'];
      let n = 0;
      for (const id of seq) {
        run.state.energy = run.state.maxEnergy;
        const slot = run.state.cards.find((c) => c.id === id);
        if (slot) slot.cd = 0;
        if (run.deploy(id, n % 2, 400).ok) n += 1;
      }
      updateHud();
      return true;
    },
    fastForward: () => {
      if (!run) return false;
      try {
        // 贪婪机器人一路打到终局（验证胜利路径）
        const order = ['general', 'cavalry', 'militia', 'archer', 'catapult', 'rock', 'fire', 'frost', 'heal'];
        let guard = 60000;
        let lane = 0;
        while (guard-- > 0 && run.state.phase === 'playing') {
          let did = false;
          for (const id of order) {
            const slot = run.state.cards.find((c) => c.id === id);
            if (!slot || slot.cd > 0) continue;
            if (run.state.energy < slot.cost) continue;
            lane = lane === 0 ? 1 : 0;
            if (run.deploy(id, lane, 400).ok) { did = true; break; }
          }
          run.step(1 / 30);
          handleEvents(run.drainEvents());
        }
        updateHud();
        return true;
      } catch { return false; }
    },
    winNow: () => {
      if (!run) return false;
      run.state.enemy.keep.hp = 0;
      run._win();
      handleEvents(run.drainEvents());
      updateHud();
      return true;
    },
    tutorialStep: () => tutorialStep,
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
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
buildLevelGrid();
$('btn-mute').classList.toggle('is-muted', muted);
Sdk.track('load', {});
requestAnimationFrame(frame);
