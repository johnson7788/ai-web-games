// 主入口：60Hz 固定步长 + 标题/选关/游戏/暂停/结算 + 建造菜单 + 教程引导 + SDK 统一出口。
import { STEP, GAME } from '../config/game.config.js';
import { LEVELS, LEVEL_COUNT, TOWER_DEFS, TOWER_ORDER } from '../config/levels.js';
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
let phase = 'title'; // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let fpsSamples = [];
let tutorialStep = -1;
let tutorialActive = false;

const view = {
  hoverSpot: null,
  selectedSpot: null,
  cursor: { x: 0, y: 0 },
  fxQueue: [],
  shake: 0,
  sceneKey: 'neon-violet',
};

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let unlocked = Math.max(1, Sdk.load('unlocked', 1) | 0);
let starsByLevel = Sdk.load('stars', {}) || {};
let tutorialDone = !!Sdk.load('tutorialDone', false);
let lastLevel = Sdk.load('lastLevel', 0) | 0;

Sdk.ready();
audio.setMuted(muted);

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

function startLevel(idx) {
  idx = Math.max(0, Math.min(LEVEL_COUNT - 1, idx | 0));
  lastLevel = idx;
  run = createRun(idx, { seed: (Date.now() % 2147483647) || 1 });
  view.sceneKey = LEVELS[idx].scene;
  view.selectedSpot = null;
  view.hoverSpot = null;
  view.fxQueue = [];
  tutorialStep = -1;
  tutorialActive = false;
  setPhase('playing');
  ui.showGame();
  ui.hideResult();
  hideBuildMenu();
  updateHud();
  audio.startBgm();
  Sdk.newRun({ level: idx + 1 });
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
  startLevel(run ? (run.state.level - 1) : lastLevel);
}

function goHome() {
  run = null;
  setPhase('title');
  ui.hideResult();
  hideBuildMenu();
  ui.showTitle();
  buildLevelGrid();
  tutorialActive = false;
  tutorialStep = -1;
  audio.stopBgm();
}

// ---------- HUD / 关卡格 / 结算 ----------
function updateHud() {
  if (!run) return;
  const h = run.getHud();
  $('hud-gold').textContent = '⛁ ' + h.gold;
  $('hud-hp').textContent = '♥ ' + h.baseHp + '/' + h.baseMaxHp;
  $('hud-wave').textContent = t('wave') + ' ' + Math.min(h.wave, h.waveTotal) + '/' + h.waveTotal;
  const comboEl = $('hud-combo');
  comboEl.textContent = t('combo') + ' ' + h.combo;
  comboEl.classList.toggle('overdrive', h.overdrive);
  const orb = $('btn-orbital');
  const ready = h.orbitalCharges >= h.orbitalNeeded;
  orb.textContent = `☄ ORBITAL ${h.orbitalCharges}/${h.orbitalNeeded}`;
  orb.classList.toggle('ready', ready);
}

function buildLevelGrid() {
  const grid = $('level-grid');
  grid.innerHTML = '';
  for (let i = 0; i < LEVEL_COUNT; i += 1) {
    const cell = document.createElement('button');
    const locked = i + 1 > unlocked;
    cell.className = 'level-cell' + (locked ? ' locked' : '');
    cell.dataset.level = i;
    const stars = starsByLevel[i + 1] | 0;
    const badge = locked ? '🔒' : (stars > 0 ? '★'.repeat(stars) : '—');
    cell.innerHTML =
      `<span class="lv-num">${i + 1}</span>` +
      `<span class="lv-stars">${badge}</span>`;
    cell.setAttribute('aria-label', `${t('level')} ${i + 1}${locked ? ' ' + t('locked') : ''}`);
    grid.appendChild(cell);
  }
  $('stars-total').textContent = `★ ${totalStars()}/${LEVEL_COUNT * 3}`;
}

function showResult(res) {
  const { won, stars, baseHp, baseMaxHp, reason, hasNext } = res;
  $('result-title').textContent = won ? t('winTitle') : t('loseTitle');
  const starsEl = $('result-stars');
  starsEl.innerHTML = won
    ? `<span>${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>${stars >= 3 ? `<em>${t('perfect')}</em>` : ''}`
    : '';
  $('result-meta').textContent = won
    ? `${t('starsLabel')}: ${stars}/3 · ${t('baseHpLeft', { n: baseHp })}`
    : t('loseTitle');
  $('btn-next').classList.toggle('hidden', !(won && hasNext));
  ui.showResult();
}

function hideResult() {
  $('screen-result').classList.add('hidden');
}

function finishRun(ev) {
  setPhase('result');
  audio.stopBgm();
  if (tutorialActive) endTutorial();
  const st = run.state;
  const won = ev.type === 'win';
  const stars = won ? (ev.stars || st.stars || 1) : 0;
  if (won) {
    const idx = st.level;
    starsByLevel[idx] = Math.max(starsByLevel[idx] | 0, stars);
    if (idx < LEVEL_COUNT) unlocked = Math.max(unlocked, idx + 1);
    buildLevelGrid();
    Sdk.levelCleared({ level: idx, stars });
  } else {
    Sdk.gameOver({ level: st.level, reason: st.reason });
  }
  persist();
  Sdk.track(won ? 'win' : 'fail', { level: st.level, stars });
  showResult({ won, stars, baseHp: st.baseHp, baseMaxHp: st.baseMaxHp, reason: st.reason, hasNext: st.level < LEVEL_COUNT });
  audio.event(won ? 'win' : 'lose', ev);
}

// ---------- 教程 ----------
const TUT_STEPS = () => [
  { text: t('tutStep1') },
  { text: t('tutStep2') },
  { text: t('tutStep3') },
];

function startTutorial() {
  tutorialStep = 0;
  tutorialActive = true;
  renderTutorialStep();
}

function renderTutorialStep() {
  const el = $('tutorial');
  if (tutorialStep < 0 || !tutorialActive) { el.classList.add('hidden'); return; }
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
  tutorialActive = false;
  tutorialDone = true;
  persist();
  renderTutorialStep();
}

const TUT_TRIGGER = ['build', 'upgrade', 'orbital'];
function tutorialAdvance(evType) {
  if (!tutorialActive || tutorialStep < 0 || tutorialStep >= TUT_TRIGGER.length) return;
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
      case 'shoot':
        view.fxQueue.push({ kind: 'muzzle', x: ev.x, y: ev.y, color: TOWER_COLOR(ev.towerType), ttl: 0.12, max: 0.12 });
        break;
      case 'kill':
        view.fxQueue.push({ kind: 'boom', x: ev.x, y: ev.y, ttl: 0.3, max: 0.3 });
        break;
      case 'orbital':
        view.fxQueue.push({ kind: 'orbital', ttl: 0.4, max: 0.4 });
        view.shake = 6;
        break;
      case 'leak':
        view.shake = 4;
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

function TOWER_COLOR(type) {
  return { laser: '#ff5470', tesla: '#b983ff', rail: '#ff9f1c', drone: '#2de2e6' }[type] || '#fff';
}

// ---------- 建造菜单 ----------
function hideBuildMenu() {
  $('build-menu').classList.add('hidden');
  view.selectedSpot = null;
}

function showBuildMenu(spot) {
  view.selectedSpot = spot.id;
  const menu = $('build-menu');
  const title = $('build-title');
  const actions = $('build-actions');
  title.textContent = t('build') + ' · ' + (spot.lane + 1);
  actions.innerHTML = '';
  for (const type of TOWER_ORDER) {
    const def = TOWER_DEFS[type];
    const b = document.createElement('button');
    b.className = 'build-btn';
    b.disabled = run.state.gold < def.cost;
    b.innerHTML =
      `<span class="bname">${t('tower' + def.label)}</span>` +
      `<span class="bcost">⛁${def.cost}</span>` +
      `<span class="bdesc">${t('towerDesc' + def.label)}</span>`;
    b.addEventListener('click', () => {
      const r = run.buildTower(spot.id, type);
      if (r.ok) { hideBuildMenu(); updateHud(); }
    });
    actions.appendChild(b);
  }
  positionMenu(menu, spot.x, spot.y);
  menu.classList.remove('hidden');
}

function showTowerMenu(spot, tower) {
  view.selectedSpot = spot.id;
  const menu = $('build-menu');
  const def = TOWER_DEFS[tower.type];
  const upCost = Math.round(def.cost * 0.7);
  $('build-title').textContent = `${t('tower' + def.label)} ${t('levelShort')}${tower.level}`;
  const actions = $('build-actions');
  actions.innerHTML = '';
  const up = document.createElement('button');
  up.className = 'build-btn';
  up.disabled = tower.level >= 4 || run.state.gold < upCost;
  up.innerHTML = `<span class="bname">${t('upgrade')}</span><span class="bcost">⛁${tower.level >= 4 ? '—' : upCost}</span>`;
  up.addEventListener('click', () => { const r = run.upgradeTower(spot.id); if (r.ok) { hideBuildMenu(); updateHud(); } });
  const sell = document.createElement('button');
  sell.className = 'build-btn';
  sell.innerHTML = `<span class="bname">${t('sell')}</span><span class="bcost">+⛁${Math.round(def.cost * 0.5)}</span>`;
  sell.addEventListener('click', () => { const r = run.sellTower(spot.id); if (r.ok) { hideBuildMenu(); updateHud(); } });
  actions.appendChild(up);
  actions.appendChild(sell);
  positionMenu(menu, spot.x, spot.y);
  menu.classList.remove('hidden');
}

function positionMenu(menu, wx, wy) {
  const cw = container.clientWidth || 1280;
  const scale = cw / 1280;
  let left = wx * scale + 26;
  let top = wy * scale - 20;
  const mw = menu.offsetWidth || 220;
  const mh = menu.offsetHeight || 160;
  const ch = container.clientHeight || 720;
  if (left + mw > cw - 8) left = cw - mw - 8;
  if (top + mh > ch - 8) top = ch - mh - 8;
  if (top < 60) top = 60;
  if (left < 8) left = 8;
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}

// ---------- 输入 ----------
function canvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (1280 / rect.width),
    y: (e.clientY - rect.top) * (720 / rect.height),
  };
}

function findSpot(p) {
  const level = run._level;
  for (const spot of level.buildSpots) {
    if (Math.hypot(spot.x - p.x, spot.y - p.y) <= 28) return spot;
  }
  return null;
}

function findTower(p) {
  for (const t of run.state.towers) {
    if (Math.hypot(t.x - p.x, t.y - p.y) <= 28) return t;
  }
  return null;
}

function findCore(p) {
  for (const c of run.state.cores) {
    if (Math.hypot(c.x - p.x, c.y - p.y) <= 30) return c;
  }
  return null;
}

canvas.addEventListener('pointermove', (e) => {
  view.cursor = canvasPos(e);
  if (!run || phase !== 'playing') return;
  const spot = findSpot(view.cursor);
  view.hoverSpot = spot ? spot.id : null;
  canvas.style.cursor = spot || findTower(view.cursor) || findCore(view.cursor) ? 'pointer' : 'default';
});

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (!run || phase !== 'playing') return;
  const p = canvasPos(e);
  view.cursor = p;

  const core = findCore(p);
  if (core) { run.collectCore(); updateHud(); return; }

  const tower = findTower(p);
  if (tower) {
    const spot = run._level.buildSpots.find((s) => s.id === tower.spotIdx);
    showTowerMenu(spot, tower);
    return;
  }

  const spot = findSpot(p);
  if (spot && !spot.blocked) {
    showBuildMenu(spot);
    return;
  }

  hideBuildMenu();
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
  if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'result')) restartLevel();
  if (e.code === 'KeyM') toggleMute();
  if (e.code === 'KeyO') orbital();
});

function orbital() {
  if (!run || phase !== 'playing') return;
  const r = run.useOrbital();
  if (r.ok) updateHud();
}

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  $('btn-mute').classList.toggle('is-muted', muted);
  persist();
}

// ---------- UI 绑定 ----------
function bind() {
  const on = (id, fn) => { const el = $(id); if (el) el.addEventListener('click', () => { audio.unlock(); fn(); }); };
  on('btn-start', () => startLevel(lastLevel));
  on('btn-resume', resumeGame);
  on('btn-restart', restartLevel);
  on('btn-restart2', restartLevel);
  on('btn-retry', restartLevel);
  on('btn-next', () => startLevel((run ? run.state.level - 1 : lastLevel) + 1));
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-orbital', orbital);
  on('btn-tut-replay', () => {
    if (phase === 'paused') resumeGame();
    startTutorial();
  });
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result') startTutorial(); });
  on('btn-rotate-skip', () => { const rs = $('rotate-screen'); if (rs) rs.style.display = 'none'; });
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);
  on('build-close', hideBuildMenu);

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
      if (run) updateHud();
      $('rotate-text').textContent = t('rotateHint');
      $('btn-rotate-skip').textContent = t('rotateSkip');
    });
  }
}

// ---------- 主循环 ----------
function frame(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;

  if (phase === 'playing' && run && !tutorialActive) {
    accumulator += dt;
    let guard = 0;
    while (accumulator >= STEP && guard < 8) {
      run.step(STEP);
      accumulator -= STEP;
      guard += 1;
    }
    handleEvents(run.drainEvents());
    if (run && phase === 'playing') updateHud();
  }

  if (view.shake > 0) view.shake = Math.max(0, view.shake - dt * 18);
  for (const fx of view.fxQueue) fx.ttl -= dt;

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
  tutorial: {
    get active() { return tutorialActive; },
    get step() { return tutorialStep; },
    get steps() { return ['build', 'upgrade', 'orbital']; },
    get current() { return tutorialActive && tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
  },
  startTutorial: () => startTutorial(),
  save: (k, v) => Sdk.save(k, v),
  ui: () => ui,
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: () => (run ? run.state : null),
    startSeeded: (i, seed) => {
      const idx = Math.max(0, Math.min(LEVEL_COUNT - 1, i | 0));
      lastLevel = idx;
      run = createRun(idx, { seed: seed | 0 || 1 });
      view.sceneKey = LEVELS[idx].scene;
      view.selectedSpot = null;
      tutorialActive = false;
      tutorialStep = -1;
      setPhase('playing');
      ui.showGame();
      hideBuildMenu();
      updateHud();
      return true;
    },
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    build: (spot, type) => run.buildTower(spot, type),
    upgrade: (spot) => run.upgradeTower(spot),
    sell: (spot) => run.sellTower(spot),
    orbital: () => run.useOrbital(),
    collectCore: () => run.collectCore(),
    // 快进到结算（greedy 在 verify 里用它）
    fastForward: () => {
      if (!run) return false;
      let guard = 60 * 180;
      while (guard-- > 0 && run.state.phase === 'playing') {
        run.step(0.1);
        handleEvents(run.drainEvents());
      }
      return true;
    },
    // 贪心自动赢（与 tools/selfplay.mjs 同策略，供验收断言星级）
    autoWin: () => {
      if (!run) return 0;
      const BUILD_PLAN = ['laser', 'laser', 'rail', 'laser', 'tesla', 'drone'];
      const UPGRADE_ORDER = ['rail', 'laser', 'tesla', 'drone'];
      const pickBuild = () => {
        const spots = run.buildSpots();
        for (let col = 0; col < 6; col += 1) {
          for (let lane = 0; lane < 3; lane += 1) {
            const spot = spots.find((s) => s.lane === lane && s.id === lane * 6 + col);
            if (!spot || spot.blocked) continue;
            if (run.state.towers.some((t) => t.spotIdx === spot.id)) continue;
            const type = BUILD_PLAN[col];
            if (run.state.gold >= TOWER_DEFS[type].cost) return { spotIdx: spot.id, type };
          }
        }
        return null;
      };
      const pickUpgrade = () => {
        for (const type of UPGRADE_ORDER) {
          for (const t of run.state.towers) {
            if (t.type !== type || t.level >= 4) continue;
            const cost = Math.round(TOWER_DEFS[type].cost * 0.7);
            if (run.state.gold >= cost) return t.spotIdx;
          }
        }
        return null;
      };
      let guard = 0;
      while (run.state.phase === 'playing' && guard < 300000) {
        guard += 1;
        if (run.state.cores.length) { run.collectCore(); }
        else if (run.state.orbitalCharges >= GAME.ORBITAL_CHARGES_NEEDED) { run.useOrbital(); }
        else { const b = pickBuild(); if (b) run.buildTower(b.spotIdx, b.type); else { const u = pickUpgrade(); if (u != null) run.upgradeTower(u); } }
        run.step(1 / 60);
        handleEvents(run.drainEvents());
      }
      return run.state.stars;
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
buildLevelGrid();
Sdk.track('load', {});
requestAnimationFrame(frame);
