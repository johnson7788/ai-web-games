// BLADE GARDEN · 主入口：60Hz 固定步长 + 标题/游戏/暂停/结算/升级 + 教程引导 + SDK 统一出口。
// 装配：sim（M1）/ render+ui（M2）/ audio（M4）/ Lead 集成。HUD/结算/升级卡/教程的 DOM 由这里直写。
import { STEP, WORLD, GAME } from '../config/game.config.js';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';
import { UPGRADE_MAP } from '../config/upgrades.js';
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
const TAU = Math.PI * 2;

let run = null;
let phase = 'title';        // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let fpsSamples = [];
let tutorialStep = -1;

// 输入
const keys = new Set();
const joy = { active: false, base: { x: 102, y: WORLD.HEIGHT - 44 - 58 }, dx: 0, dy: 0, pointerId: null };

// 视图状态传给 renderer
const view = {
  fxQueue: [],
  shake: 0,
  joystick: joy,
  signatureLeaves: false,
};

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let unlocked = Math.max(1, Sdk.load('unlocked', 1) | 0);
let best = Sdk.load('best', 0) | 0;
let coins = Sdk.load('coins', 0) | 0;
let tutorialDone = !!Sdk.load('tutorialDone', false);
let lastLevel = Sdk.load('lastLevel', 0) | 0;

Sdk.ready();
Sdk.onAdStart(() => { if (phase === 'playing') pauseGame(true); });
Sdk.onAdEnd(() => { if (phase === 'paused') resumeGame(); });
audio.setMuted(muted);
ui.setMuted(muted);

function persist() {
  Sdk.save('muted', muted);
  Sdk.save('unlocked', unlocked);
  Sdk.save('best', best);
  Sdk.save('coins', coins);
  Sdk.save('tutorialDone', tutorialDone);
  Sdk.save('lastLevel', lastLevel);
}

// ---------- 阶段状态机 ----------
function setPhase(p) { phase = p; }

function startLevel(idx) {
  idx = Math.max(0, Math.min(LEVEL_COUNT - 1, idx | 0));
  lastLevel = idx;
  run = createRun(idx, { seed: (Date.now() % 2147483647) || 1 });
  joy.active = false; joy.dx = 0; joy.dy = 0;
  setPhase('playing');
  ui.showGame();
  ui.hideResult();
  ui.hideUpgrade();
  updateHud();
  audio.startBgm();
  Sdk.track('start', { level: idx + 1 });
  if (!tutorialDone && idx === 0) startTutorial();
}

function pauseGame(silent) {
  if (phase !== 'playing') return;
  if (run && run.state.phase === 'upgrade') return; // 升级卡打开时不暂停
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
  ui.hideUpgrade();
  ui.showTitle();
  buildLevelGrid();
  audio.stopBgm();
}

// ---------- HUD ----------
function updateHud() {
  if (!run) return;
  const h = run.getHud();
  $('hud-level').textContent = `${t('level')} ${run.state.level}`;
  $('hud-wave').textContent = `${t('wave')} ${h.wave}`;
  const secs = Math.max(0, Math.ceil(h.timeLeft));
  const timeEl = $('hud-time');
  timeEl.textContent = `${t('survive')} ${secs}s`;
  timeEl.classList.toggle('time-low', secs <= 10);
  $('hud-kills').textContent = `${t('slay')} ${h.kills}/${h.killTarget}`;
  const hpRatio = Math.max(0, Math.min(1, h.hp / h.maxHp));
  $('hud-hpfill').style.width = `${(hpRatio * 100).toFixed(1)}%`;
  $('hud-hp').textContent = `${t('hp')} ${Math.ceil(h.hp)}/${h.maxHp}`;
  const xpRatio = Math.max(0, Math.min(1, h.xp / h.xpToNext));
  $('hud-xpfill').style.width = `${(xpRatio * 100).toFixed(1)}%`;
  $('hud-xp').textContent = `${t('xp')} ${h.playerLevel} · ${Math.floor(h.xp)}/${h.xpToNext}`;
}

// ---------- 关卡格 ----------
function buildLevelGrid() {
  const grid = $('level-grid');
  if (!grid) return;
  grid.innerHTML = '';
  for (let i = 0; i < LEVEL_COUNT; i += 1) {
    const cell = document.createElement('button');
    cell.className = 'level-cell' + (i + 1 > unlocked ? ' locked' : '');
    cell.dataset.level = i;
    const lv = LEVELS[i];
    cell.innerHTML =
      `<span class="lv-num">${i + 1}</span>` +
      `<span class="lv-name">${(lv.name && (lv.name[i18n.lang] || lv.name.en)) || ''}</span>`;
    cell.setAttribute('aria-label', `${t('level')} ${i + 1}${i + 1 > unlocked ? ' ' + t('locked') : ''}`);
    grid.appendChild(cell);
  }
  $('best-label').textContent = `${t('best')}: ${Math.floor(best)}s · 🪙 ${coins}`;
}

// ---------- 结算 ----------
function showResult() {
  const s = run.state;
  const won = s.phase === 'won';
  $('result-title').textContent = won ? t('winTitle') : t('loseTitle');
  $('result-title').classList.toggle('lose', !won);
  const lines = [
    `${t('survived')}: ${Math.floor(s.time)}s`,
    `${t('killsLabel')}: ${s.kills}/${s.killTarget}`,
    `${t('bestTime')}: ${Math.floor(Math.max(best, s.time))}s`,
  ];
  if (!won && s.result && s.result.reason) {
    lines.push(s.result.reason === 'timeOut' ? t('loseTimeOut') : t('loseSlain'));
  }
  $('result-stats').textContent = lines.join('\n');
  $('btn-next').style.display = won && s.level < LEVEL_COUNT ? '' : 'none';
  ui.showResult();
}

function finishRun(ev) {
  if (!run) return;
  const s = run.state;
  const won = ev.type === 'win';
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  if (won) {
    const idx = s.level;
    if (idx < LEVEL_COUNT) unlocked = Math.max(unlocked, idx + 1);
    best = Math.max(best, Math.floor(s.time));
    coins += s.gold || 0;
    buildLevelGrid();
    Sdk.levelCleared({ level: idx, time: Math.floor(s.time), kills: s.kills });
  } else {
    Sdk.gameOver({ level: s.level, time: Math.floor(s.time), kills: s.kills });
  }
  persist();
  showResult();
  audio.event(won ? 'win' : 'lose');
}

// ---------- 升级三选一 ----------
function showUpgrade() {
  if (!run || !run.state.choices.length) return;
  const box = $('upgrade-choices');
  box.innerHTML = '';
  for (const id of run.state.choices) {
    const upg = UPGRADE_MAP[id];
    if (!upg) continue;
    const card = document.createElement('button');
    card.className = 'upgrade-card';
    card.dataset.id = id;
    const lvl = run.state.player.abilities[id] ?? run.state.player[`stat_${id}`] ?? 0;
    card.innerHTML =
      `<span class="up-icon">${upg.icon}</span>` +
      `<span class="up-name">${upg.name[i18n.lang] || upg.name.en}</span>` +
      `<span class="up-kind">${upg.kind === 'rule' ? '⚔ Sword Intent' : '＋ Mastery'}</span>` +
      `<span class="up-desc">${upg.desc[i18n.lang] || upg.desc.en}</span>` +
      `<span class="up-level">Lv ${lvl + 1}</span>`;
    card.addEventListener('click', () => {
      audio.unlock();
      run.chooseUpgrade(id);
      ui.hideUpgrade();
      updateHud();
    });
    box.appendChild(card);
  }
  ui.showUpgrade();
  ui.applyLang();
}

// ---------- 教程引导 ----------
const TUT_STEPS = () => [
  { text: t('tutStep1'), spot: 'joystick' },
  { text: t('tutStep2'), spot: 'xpBar' },
  { text: t('tutStep3'), spot: 'upgrade' },
];

function layoutRect(which) {
  if (which === 'xpBar') {
    const el = document.querySelector('.xp-bar');
    if (el) {
      const r = el.getBoundingClientRect();
      const c = canvas.getBoundingClientRect();
      return {
        x: (r.left - c.left) * (WORLD.WIDTH / c.width),
        y: (r.top - c.top) * (WORLD.HEIGHT / c.height),
        w: r.width * (WORLD.WIDTH / c.width),
        h: r.height * (WORLD.HEIGHT / c.height),
      };
    }
  }
  const lay = renderer.debugLayout();
  return lay && lay[which] ? lay[which] : null;
}

function startTutorial() {
  tutorialStep = 0;
  renderTutorialStep();
}

function renderTutorialStep() {
  const el = $('tutorial');
  if (tutorialStep < 0) { el.classList.add('hidden'); $('tut-spotlight').style.display = 'none'; return; }
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

const TUT_TRIGGER = ['move', 'pickupXp', 'levelUp'];
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
      case 'hit':
        view.fxQueue.push({ type: 'hit', x: ev.x, y: ev.y, ttl: 0.22, max: 0.22, seed: Math.random() * TAU });
        break;
      case 'kill':
        view.fxQueue.push({ type: 'burst', x: ev.x, y: ev.y, ttl: 0.35, max: 0.35, seed: Math.random() * TAU });
        view.shake = Math.max(view.shake, 2);
        break;
      case 'damage':
        view.shake = Math.max(view.shake, 6);
        break;
      case 'thunder':
        view.fxQueue.push({ type: 'bolt', x: ev.x, y: ev.y, ttl: 0.3, max: 0.3 });
        break;
      case 'whirl':
        view.fxQueue.push({ type: 'ring', x: ev.x, y: ev.y, r: ev.radius || 90, ttl: 0.4, max: 0.4 });
        break;
      case 'levelUp':
        showUpgrade();
        break;
      case 'signature':
        view.signatureLeaves = true;
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
function canvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (WORLD.WIDTH / rect.width),
    y: (e.clientY - rect.top) * (WORLD.HEIGHT / rect.height),
  };
}

function axisFromKeys() {
  let dx = 0, dy = 0;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) dx -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) dx += 1;
  if (keys.has('KeyW') || keys.has('ArrowUp')) dy -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) dy += 1;
  const len = Math.hypot(dx, dy);
  if (len > 1) { dx /= len; dy /= len; }
  return { dx, dy };
}

function currentAxis() {
  if (joy.active) return { dx: joy.dx, dy: joy.dy };
  return axisFromKeys();
}

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  const p = canvasPos(e);
  const nearBase = Math.hypot(p.x - joy.base.x, p.y - joy.base.y) < 70;
  if (e.pointerType === 'touch' || nearBase) {
    joy.active = true;
    joy.pointerId = e.pointerId;
    joy.base = { x: p.x, y: p.y };
    joy.dx = 0; joy.dy = 0;
    canvas.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (!joy.active || e.pointerId !== joy.pointerId) return;
  const p = canvasPos(e);
  const dx = p.x - joy.base.x, dy = p.y - joy.base.y;
  const len = Math.hypot(dx, dy);
  const max = 48;
  if (len > max) { joy.dx = dx / len; joy.dy = dy / len; }
  else { joy.dx = dx / max; joy.dy = dy / max; }
});

function endJoy(e) {
  if (joy.active && e.pointerId === joy.pointerId) {
    joy.active = false;
    joy.dx = 0; joy.dy = 0;
  }
}
canvas.addEventListener('pointerup', endJoy);
canvas.addEventListener('pointercancel', endJoy);

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
  if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'result')) restartLevel();
  if (e.code === 'KeyM') toggleMute();
  keys.add(e.code);
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));

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
  on('btn-tut-replay', () => {
    if (phase === 'paused') resumeGame();
    if (phase === 'playing') startTutorial();
  });
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result') startTutorial(); });
  on('btn-rotate-skip', () => { const rs = $('rotate-screen'); if (rs) rs.style.display = 'none'; });
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
      const ax = currentAxis();
      run.setInput(ax.dx, ax.dy);
      run.step(STEP);
      accumulator -= STEP;
      if (run.state.phase !== 'playing') break;
    }
    handleEvents(run.drainEvents());
    if (run && phase === 'playing') updateHud();
  }

  if (view.shake > 0) view.shake = Math.max(0, view.shake - dt * 22);
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
const botTarget = () => {
  const s = run.state, p = s.player;
  let gx = null, gy = null, gd = Infinity;
  for (const g of s.gems) {
    const d = Math.hypot(g.x - p.x, g.y - p.y);
    if (d < gd) { gd = d; gx = g.x; gy = g.y; }
  }
  if (gx != null && gd < 230) return { x: gx, y: gy };
  let ex = null, ey = null, ed = Infinity;
  for (const e of s.enemies) {
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < ed) { ed = d; ex = e.x; ey = e.y; }
  }
  return ex != null ? { x: ex, y: ey } : { x: p.x, y: p.y };
};

function botTick() {
  if (!run) return;
  if (run.state.phase === 'upgrade') {
    run.chooseUpgrade(run.state.choices[0]);
    handleEvents(run.drainEvents());
    updateHud();
    return;
  }
  if (run.state.phase !== 'playing') return;
  const t = botTarget();
  const dx = t.x - run.state.player.x, dy = t.y - run.state.player.y;
  const len = Math.hypot(dx, dy);
  if (len > 2) run.setInput(dx / len, dy / len);
  else run.setInput(0, 0);
}

function autoAdvance(seconds, untilFn) {
  if (!run) return false;
  let guard = Math.ceil(seconds / 0.05);
  while (guard-- > 0 && run.state.phase === 'playing' && !(untilFn && untilFn(run.state))) {
    botTick();
    run.step(0.05);
    handleEvents(run.drainEvents());
  }
  return true;
}

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
    get steps() { return TUT_STEPS().map((s) => s.spot); },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  save: (key, value) => Sdk.save(key, value),
  ui: () => ui,
  debug: {
    state: () => (run ? run.state : null),
    layout: () => { try { return renderer.debugLayout(); } catch { return null; } },
    loadLevel: (i) => startLevel(i),
    startSeeded: (i, seed) => {
      const idx = Math.max(0, Math.min(LEVEL_COUNT - 1, i | 0));
      lastLevel = idx;
      run = createRun(idx, { seed: seed | 0 || 1 });
      joy.active = false; joy.dx = 0; joy.dy = 0;
      setPhase('playing');
      ui.showGame();
      ui.hideResult();
      ui.hideUpgrade();
      updateHud();
      return true;
    },
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    startTutorial: () => startTutorial(),
    tutorialStep: () => tutorialStep,
    forceLevelUp: () => {
      if (!run) return false;
      const p = run.state.player;
      p.xp = p.xpToNext;
      run._collectGem({ x: p.x, y: p.y, value: 0 });
      handleEvents(run.drainEvents());
      updateHud();
      return run.state.phase === 'upgrade';
    },
    botTick: () => botTick(),
    autoPlay: () => {
      if (!run) return false;
      botTick();
      run.step(1 / 60);
      handleEvents(run.drainEvents());
      updateHud();
      return true;
    },
    fastForward: (seconds) => {
      if (!run) return false;
      try { autoAdvance(seconds ?? 10, null); return true; } catch { return false; }
    },
    // 直接快进到精英/Boss 现身（不依赖 bot 存活，供截图）
    reveal: (what) => {
      if (!run) return false;
      const lv = run._level;
      const p = run.state.player;
      const scatter = () => {
        // 把场上敌人散开到玩家周围（截图更清晰、目标更明确）
        const list = run.state.enemies.slice(0, 7);
        list.forEach((e, i) => {
          const ang = (i / Math.max(1, list.length)) * Math.PI * 2 + 0.6;
          e.x = p.x + Math.cos(ang) * (180 + (i % 3) * 30);
          e.y = p.y + Math.sin(ang) * (120 + (i % 2) * 40);
        });
      };
      if (what === 'boss') {
        if (!lv.boss) return false;
        run.state.time = lv.duration * 0.61;
        run._spawnTick(1);
        for (const e of run.state.enemies) if (e.boss) { e.x = p.x + 230; e.y = p.y + 10; }
        scatter();
        handleEvents(run.drainEvents());
        return run.state.bossSpawned;
      }
      if (what === 'elite') {
        if (!lv.elite) return false;
        run.state.time = lv.elite.at + 1;
        run._spawnTick(1);
        for (const e of run.state.enemies) if (e.elite) { e.x = p.x + 220; e.y = p.y - 50; }
        scatter();
        handleEvents(run.drainEvents());
        return run.state.eliteSpawned;
      }
      return false;
    },
    bossReveal: () => {
      if (!run) return false;
      const lv = run._level;
      if (lv.boss) autoAdvance(lv.duration * 0.65, (s) => s.bossSpawned);
      return true;
    },
    giveUp: () => {
      if (!run) return false;
      run.state.timeLeft = 0;
      run.state.kills = run.state.killTarget;
      run.step(1 / 60);
      handleEvents(run.drainEvents());
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
$('btn-mute').classList.toggle('is-muted', muted);
Sdk.track('load', {});
requestAnimationFrame(frame);
