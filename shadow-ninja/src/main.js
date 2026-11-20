// Shadow Ninja Cat · 主入口：60Hz 固定步长 + 标题/游戏/暂停/结算 + 商店/成就/教程 + SDK 统一出口。
// 装配：sim(纯逻辑) / render(Canvas) / ui(语言与显隐) / audio(WebAudio)。HUD/结算/商店 DOM 由这里直写。
import { STEP, GAME } from '../config/game.config.js';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';
import { SHOP_ITEMS, ACHIEVEMENTS, shopItemById } from '../config/shop.js';
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
let tutorialStep = -1;
let tutorialDone = false;
let lastLevel = 0;

const view = {
  shake: 0,
  fxQueue: [],
};

// ---------- 存档（统一走 Sdk） ----------
const DEFAULT_SAVE = () => ({
  chimes: 0, unlocked: 1, stars: {}, owned: {},
  props: { fly: 0, magnet: 0, double: 0, revive: 0 },
  ach: {}, achTier: {},
  best: 0, totalDist: 0, playCount: 0, surpass: 0, flyCount: 0, propCount: 0,
  muted: false, tutorialDone: false, lastLevel: 0,
});

let save = { ...DEFAULT_SAVE(), ...(Sdk.load('save', DEFAULT_SAVE()) || {}) };
save.props = { fly: 0, magnet: 0, double: 0, revive: 0, ...(save.props || {}) };
save.owned = save.owned || {};
save.stars = save.stars || {};
save.ach = save.ach || {};
save.achTier = save.achTier || {};

function persist() {
  Sdk.save('save', save);
}

Sdk.ready(); // 不 await，不阻塞首屏
Sdk.onAdStart(() => { if (phase === 'playing') pauseGame(true); });
Sdk.onAdEnd(() => { if (phase === 'paused') resumeGame(); });
audio.setMuted(!!save.muted);
ui.setMuted(!!save.muted);

function ownedAbilities() {
  return { cloak: !!save.owned.cloak, hook: !!save.owned.hook, bell: !!save.owned.bell };
}

// ---------- 阶段状态机 ----------
function setPhase(p) { phase = p; }

function startLevel(idx) {
  idx = Math.max(0, Math.min(LEVEL_COUNT - 1, idx | 0));
  lastLevel = idx;
  run = createRun(idx, {
    seed: (Date.now() % 2147483647) || 1,
    abilities: ownedAbilities(),
    props: { fly: save.props.fly, magnet: save.props.magnet, double: save.props.double },
  });
  view.shake = 0;
  setPhase('playing');
  ui.showGame();
  hideResult();
  updateHud();
  audio.startBgm();
  Sdk.track('start', { level: idx + 1 });
  if (!save.tutorialDone && idx === 0) startTutorial();
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
  if (run) Sdk.track('restart', { level: run.state.level + 1 });
  startLevel(run ? run.state.level - 1 : lastLevel);
}

function goHome() {
  run = null;
  setPhase('title');
  hideResult();
  ui.showTitle();
  buildLevelGrid();
  updateStarsTotal();
  audio.stopBgm();
}

// ---------- HUD ----------
function updateHud() {
  if (!run) return;
  const h = run.getHud();
  const lv = LEVELS[run.state.level - 1] || {};
  const nm = lv.name ? (lv.name[i18n.lang] || lv.name.en || '') : '';
  $('hud-level').textContent = `${t('level')} ${run.state.level}${nm ? ' · ' + nm : ''}`;
  $('hud-dist').textContent = `${t('distance')} ${h.dist}`;
  $('hud-chimes').textContent = `🛎 ${h.chimes}/${h.chimeGoal}`;
  const progress = Math.max(0, Math.min(1, h.x / h.goalDist));
  $('hud-progress-fill').style.width = `${Math.round(progress * 100)}%`;
  const shieldEl = $('hud-shield');
  shieldEl.style.display = h.shield > 0 || run.state.invincibleT > 0 ? '' : 'none';
  if (h.phase === 'countdown') {
    $('hud-count').style.display = '';
    $('hud-count').textContent = h.countdown > 0 ? String(h.countdown) : t('go');
  } else {
    $('hud-count').style.display = 'none';
  }
  // 道具按钮计数
  $('prop-fly-count').textContent = run.state.props.fly;
  $('prop-magnet-count').textContent = run.state.props.magnet;
  $('prop-double-count').textContent = run.state.props.double;
  $('btn-prop-fly').classList.toggle('active', run.state.flyT > 0);
  $('btn-prop-magnet').classList.toggle('active', run.state.magnetT > 0);
  $('btn-prop-double').classList.toggle('active', run.state.doubleT > 0);
}

function buildLevelGrid() {
  const grid = $('level-grid');
  if (!grid) return;
  grid.innerHTML = '';
  for (let i = 0; i < LEVEL_COUNT; i += 1) {
    const cell = document.createElement('button');
    cell.className = 'level-cell' + (i + 1 > save.unlocked ? ' locked' : '');
    cell.dataset.level = i;
    const stars = save.stars[i + 1] | 0;
    cell.innerHTML =
      `<span class="lv-num">${i + 1}</span>` +
      `<span class="lv-stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>`;
    cell.setAttribute('aria-label', `${t('level')} ${i + 1}${i + 1 > save.unlocked ? ' ' + t('locked') : ''}`);
    grid.appendChild(cell);
  }
}

function updateStarsTotal() {
  const total = Object.values(save.stars).reduce((a, b) => a + (b | 0), 0);
  $('stars-total').textContent = `★ ${total} / ${LEVEL_COUNT * 3}`;
}

function showResult(res) {
  const { won, stars, chimes, chimeGoal, dist, reason } = res;
  const titleEl = $('result-title');
  titleEl.textContent = won ? t('winTitle') : t('loseTitle');
  titleEl.classList.toggle('lose', !won);
  $('result-stars').innerHTML = won ? `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}` : '';
  $('result-meta').textContent = won
    ? `${t('chimeBonus')} 🛎 ${chimes} · ${t('goal')} ${chimeGoal} · ${t('distanceM')} ${Math.floor(dist / 10)}${stars >= 3 ? ' · ' + t('perfect') : ''}`
    : (reason === 'fell' ? t('fell') : t('hitObstacle'));
  $('btn-next').style.display = won && run.state.level < LEVEL_COUNT ? '' : 'none';
  const canRevive = !won && (save.props.revive > 0 || Sdk.canShowAd('revive'));
  $('btn-revive').style.display = canRevive ? '' : 'none';
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
  save.playCount += 1;
  const distM = Math.floor(st.x / 10);
  save.totalDist += distM;
  if (distM > save.best) {
    save.best = distM;
    save.surpass += 1;
  }
  if (won) {
    save.chimes += st.chimes;
    const idx = st.level;
    save.stars[idx] = Math.max(save.stars[idx] | 0, stars);
    if (idx < LEVEL_COUNT) save.unlocked = Math.max(save.unlocked, idx + 1);
  } else {
    save.chimes += st.chimes; // 失败也保留已收风铃
  }
  updateAchievements(st, won);
  persist();
  Sdk.track(won ? 'win' : 'fail', {
    level: st.level, stars, chimes: st.chimes, distM,
    durationMs: Math.round(st.clock * 1000), hits: st.hits,
  });
  if (won && st.level >= LEVEL_COUNT) Sdk.track('complete', {});
  showResult({ won, stars, chimes: st.chimes, chimeGoal: st.chimeGoal, dist: st.x, reason: ev.reason || null });
  audio.event(won ? 'win' : 'lose');
  buildLevelGrid();
  updateStarsTotal();
}

function updateAchievements(st, won) {
  const val = {
    totalChimes: save.chimes,
    maxDistance: save.best,
    totalDistance: save.totalDist,
    playCount: save.playCount,
    surpassCount: save.surpass,
    flyCount: save.flyCount,
    usePropCount: save.propCount,
  };
  for (const a of ACHIEVEMENTS) {
    save.ach[a.key] = val[a.key] || 0;
  }
}

// ---------- 教程引导（首次自动弹，可跳过，可重看，持久化） ----------
const TUT_STEPS = () => [
  { text: t('tutStep1'), spot: 'player' },
  { text: t('tutStep2'), spot: 'play' },
  { text: t('tutStep3'), spot: 'play' },
];
const TUT_TRIGGER = ['jump', 'dive', 'collect'];

function layoutRect(which) {
  const lay = renderer.debugLayout();
  return lay && lay[which] ? lay[which] : null;
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
  save.tutorialDone = true;
  persist();
  Sdk.track('tutorial_done', {});
  renderTutorialStep();
}

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
      case 'dive':
        view.shake = Math.max(view.shake, ev.type === 'dive' ? 2 : 1);
        break;
      case 'collect':
        view.fxQueue.push({ type: 'spark', x: ev.x, ttl: 0.4 });
        break;
      case 'hit':
      case 'shieldBreak':
        view.shake = 6;
        break;
      case 'speedup':
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

// ---------- 输入 ----------
canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (!run || phase !== 'playing') return;
  run.jump();
});
canvas.addEventListener('pointermove', (e) => {
  // 触屏下滑俯冲
  if (!run || phase !== 'playing') return;
  if (e.pointerType === 'touch' && e.movementY > 18 && !run.state.onGround) run.dive();
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
    e.preventDefault();
    if (phase === 'playing' && run) { audio.unlock(); run.jump(); }
    else if (phase === 'title') startLevel(lastLevel || 0);
  }
  if (e.code === 'ArrowDown' || e.code === 'KeyS') {
    e.preventDefault();
    if (phase === 'playing' && run) run.dive();
  }
  if (e.code === 'Digit1' && run && phase === 'playing') useProp('fly');
  if (e.code === 'Digit2' && run && phase === 'playing') useProp('magnet');
  if (e.code === 'Digit3' && run && phase === 'playing') useProp('double');
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
  if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'result')) restartLevel();
  if (e.code === 'KeyM') toggleMute();
});

function useProp(type) {
  if (!run || phase !== 'playing') return;
  const res = run.useProp(type);
  if (res.ok) {
    save.props[type] = Math.max(0, (save.props[type] | 0) - 1);
    save.propCount += 1;
    if (type === 'fly') save.flyCount += 1;
    persist();
    updateHud();
  }
}

function toggleMute() {
  save.muted = !save.muted;
  audio.setMuted(save.muted);
  ui.setMuted(save.muted);
  $('btn-mute').classList.toggle('is-muted', save.muted);
  persist();
}

// ---------- 商店 / 成就 ----------
function buildShop() {
  const list = $('shop-list');
  if (!list) return;
  list.innerHTML = '';
  for (const item of SHOP_ITEMS) {
    const owned = item.kind === 'ability' ? !!save.owned[item.id] : false;
    const row = document.createElement('div');
    row.className = 'shop-item';
    const name = item.name[i18n.lang] || item.name.en;
    const desc = item.desc[i18n.lang] || item.desc.en;
    row.innerHTML =
      `<div class="shop-info"><b>${name}</b><span>${desc}</span></div>` +
      `<div class="shop-buy"><span class="price">🛎 ${item.price}</span>` +
      `<button data-shop="${item.id}">${owned ? t('owned') : t('buy')}</button></div>`;
    list.appendChild(row);
  }
  $('shop-chimes').textContent = `🛎 ${save.chimes}`;
}

function buyItem(id) {
  const item = shopItemById(id);
  if (!item) return;
  if (item.kind === 'ability' && save.owned[item.id]) return;
  if (save.chimes < item.price) {
    $('shop-chimes').textContent = t('notEnough') + ` 🛎 ${save.chimes}`;
    return;
  }
  save.chimes -= item.price;
  if (item.kind === 'ability') {
    save.owned[item.id] = true;
  } else {
    save.props[item.type === 'fly' ? 'fly' : item.type === 'magnet' ? 'magnet' : item.type === 'double' ? 'double' : 'revive'] += 1;
  }
  persist();
  Sdk.track('shop_buy', { id });
  buildShop();
  $('shop-chimes').textContent = `🛎 ${save.chimes}`;
}

function buildMissions() {
  const list = $('missions-list');
  if (!list) return;
  list.innerHTML = '';
  for (const a of ACHIEVEMENTS) {
    const val = save.ach[a.key] | 0;
    const tier = save.achTier[a.id] | 0;
    const next = a.thresholds.find((x) => val < x) ?? null;
    const name = a[i18n.lang] || a.en;
    const row = document.createElement('div');
    row.className = 'mission-item';
    row.innerHTML =
      `<div class="mission-info"><b>${name}</b><span>${val}${next != null ? ' / ' + next : ''}</span></div>` +
      `<div class="mission-bar"><i style="width:${Math.min(100, (val / a.thresholds[3]) * 100)}%"></i></div>`;
    list.appendChild(row);
  }
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
  on('btn-next', () => startLevel((run ? run.state.level - 1 : lastLevel) + 1));
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-howto', () => { if (phase === 'playing' || phase === 'paused' || phase === 'result') startTutorial(); });
  on('btn-tut-replay', () => { if (phase === 'paused') resumeGame(); if (phase === 'playing') startTutorial(); });
  on('btn-shop', () => { ui.show('screen-shop'); buildShop(); });
  on('btn-missions', () => { ui.show('screen-missions'); buildMissions(); });
  on('btn-back-shop', () => ui.showTitle());
  on('btn-back-missions', () => ui.showTitle());
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);
  on('btn-prop-fly', () => useProp('fly'));
  on('btn-prop-magnet', () => useProp('magnet'));
  on('btn-prop-double', () => useProp('double'));
  on('btn-revive', () => {
    if (!run || phase !== 'result') return;
    if (save.props.revive > 0) {
      save.props.revive -= 1;
      persist();
      Sdk.track('revive', { source: 'prop' });
      run.revive();
      setPhase('playing');
      hideResult();
      ui.showGame();
      audio.startBgm();
    } else {
      Sdk.showRewarded('revive').then((ok) => {
        if (ok && run && phase === 'result') {
          Sdk.track('revive', { source: 'ad' });
          run.revive();
          setPhase('playing');
          hideResult();
          ui.showGame();
          audio.startBgm();
        }
      });
    }
  });
  on('btn-share', () => Sdk.share({ title: 'SHADOW NINJA CAT', text: 'I dashed across the moonlit rooftops!' }));

  $('level-grid')?.addEventListener('click', (e) => {
    const idx = e.target.closest('[data-level]')?.dataset.level;
    if (idx == null) return;
    const i = +idx;
    if (i + 1 > save.unlocked) return;
    startLevel(i);
  });

  $('shop-list')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-shop]');
    if (b) buyItem(b.dataset.shop);
  });

  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = $(id);
    if (!sel) continue;
    sel.addEventListener('change', () => {
      ui.setLang(sel.value);
      renderTutorialStep();
      buildLevelGrid();
      if (run) updateHud();
      buildShop();
      buildMissions();
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

  if (view.shake > 0) view.shake = Math.max(0, view.shake - dt * 16);
  for (const fx of view.fxQueue) if (fx.ttl > 0) fx.ttl -= dt;

  try {
    renderer.draw(run ? run.state : null, dt, view);
  } catch (err) {
    console.warn('render error', err);
  }
  view.fxQueue = view.fxQueue.filter((fx) => fx.ttl > 0);

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
  save: () => Sdk.save('save', save),
  ui: () => ui,
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return TUT_TRIGGER.slice(); },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip() { endTutorial(); },
  },
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: () => {
      if (!run) return null;
      const s = run.state;
      return { ...s, courseLen: s.course.length, chimeGoal: s.chimeGoal, chimeTotal: s.chimeTotal };
    },
    layout: () => { try { return renderer.debugLayout(); } catch { return null; } },
    loadLevel: (i) => startLevel(i),
    startSeeded: (i, seed) => {
      const idx = Math.max(0, Math.min(LEVEL_COUNT - 1, i | 0));
      lastLevel = idx;
      run = createRun(idx, { seed: seed | 0 || 1, abilities: ownedAbilities(), props: { fly: save.props.fly, magnet: save.props.magnet, double: save.props.double } });
      view.shake = 0;
      setPhase('playing');
      ui.showGame();
      hideResult();
      updateHud();
      audio.startBgm();
      return true;
    },
    setTutorialDone: (b) => { save.tutorialDone = !!b; persist(); },
    startTutorial: () => startTutorial(),
    tutorialStep: () => tutorialStep,
    // 快进：把当前 run 直接推到终局（营销/验收用）
    fastForward: () => {
      if (!run) return false;
      let guard = 6000;
      while (guard-- > 0 && run.state.phase !== 'won' && run.state.phase !== 'lost') {
        run.step(1 / 60);
        handleEvents(run.drainEvents());
      }
      return true;
    },
    // 浏览器内自动玩（greedy），供 record-gif / verify 使用
    autoRun: (steps = 6000) => {
      if (!run) return false;
      for (let i = 0; i < steps && run.state.phase !== 'won' && run.state.phase !== 'lost'; i += 1) {
        const s = run.state;
        const front = Math.floor(s.x / GAME.CELL_W);
        const gh = (c) => c && (c.t === 'gap' || c.t === 'spike' || c.t === 'enemy');
        if ((gh(s.course[front]) || gh(s.course[front + 1]) || gh(s.course[front + 2])) && s.onGround) run.jump();
        else if (!s.onGround && s.y > 60 && !gh(s.course[front]) && !gh(s.course[front + 1])) run.dive();
        run.step(1 / 60);
        handleEvents(run.drainEvents());
      }
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
buildLevelGrid();
updateStarsTotal();
$('btn-mute').classList.toggle('is-muted', !!save.muted);
Sdk.track('load', {});
requestAnimationFrame(frame);
