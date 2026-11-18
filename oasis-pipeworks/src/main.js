// 主入口：60Hz 固定步长 + 标题/选关/游戏/暂停/结算 + 教程引导 + SDK 统一出口
// 契约见 docs/README.md。装配：sim(M1) / render+ui(M2) / audio(M4) / Lead 集成。
// 职责划分：ui.js 只做语言与屏幕显隐；HUD/结算/关卡格/教程的 DOM 由这里直写。
import { STEP, GAME, LAYOUT } from '../config/game.config.js';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';
import { createRun } from './game/sim.js';
import { findPath, pathRequirements } from './game/level.js';
import { createRenderer } from './render/index.js';
import { createAudio } from './core/audio.js';
import { ui } from './ui/ui.js';
import { i18n, t, syncDocumentLang } from './core/i18n.js';
import Sdk from './core/sdk.js';

const $ = (id) => document.getElementById(id);
const canvas = $('canvas');
const renderer = createRenderer(canvas);
const audio = createAudio();

let run = null;            // 当前对局
let phase = 'title';       // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let fpsSamples = [];
let armDig = false;         // 铲除模式
let doubled = false;        // 本局金币已翻倍
let tutorialStep = -1;      // -1 = 未激活

// 视图状态传给 renderer
const view = {
  hoverCell: null,
  selectedPiece: null,
  cursor: { x: 0, y: 0 },
  fxQueue: [],             // {type:'waterFlash', r, c, ttl}
  shake: 0,                // 剩余震屏幅度
  sceneKey: 'dawn-desert',
};

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let unlocked = Math.max(1, Sdk.load('unlocked', 1) | 0);
let starsByLevel = Sdk.load('stars', {}) || {};
let tutorialDone = !!Sdk.load('tutorialDone', false);
let coins = Sdk.load('coins', 0) | 0;
let lastLevel = Sdk.load('lastLevel', 0) | 0;

Sdk.ready(); // 不 await，不阻塞首屏
Sdk.onAdStart(() => { if (phase === 'playing') pauseGame(true); });
Sdk.onAdEnd(() => { if (phase === 'paused') resumeGame(); });
audio.setMuted(muted);
ui.setMuted(muted);

function persist() {
  Sdk.save('unlocked', unlocked);
  Sdk.save('stars', starsByLevel);
  Sdk.save('muted', muted);
  Sdk.save('tutorialDone', tutorialDone);
  Sdk.save('coins', coins);
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
  armDig = false;
  doubled = false;
  run = createRun(idx, { seed: (Date.now() % 2147483647) || 1 });
  view.sceneKey = (LEVELS[idx] && LEVELS[idx].scene) || 'dawn-desert';
  view.selectedPiece = null;
  view.hoverCell = null;
  setPhase('playing');
  ui.showGame();
  hideResult();
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
  if (run) Sdk.track('restart', { level: run.state.level + 1 });
  startLevel(run ? run.state.level : lastLevel);
}

function goHome() {
  run = null;
  setPhase('title');
  hideResult();
  ui.showTitle();
  buildLevelGrid();
}

// ---------- HUD / 关卡格 / 结算 ----------
function updateHud() {
  if (!run) return;
  const h = run.getHud();
  const lv = LEVELS[run.state.level - 1] || {};
  $('hud-level').textContent = `${t('level')} ${run.state.level}${lv.name ? ' · ' + (lv.name[i18n.lang] || lv.name.en || '') : ''}`;
  const secs = Math.max(0, Math.ceil(h.timeLeft));
  const timeEl = $('hud-time');
  timeEl.textContent = secs + 's';
  timeEl.classList.toggle('time-low', secs <= 10);
  const bloomEl = $('hud-blooms');
  bloomEl.style.display = h.bloomTotal > 0 ? '' : 'none';
  bloomEl.textContent = `✿ ${h.blooms}/${h.bloomTotal}`;
  $('dig-badge').textContent = h.digLeft;
  $('btn-dig').classList.toggle('dig-armed', armDig);
  $('btn-valve').classList.toggle('open', run.state.phase !== 'countdown');
  $('btn-valve').title = t('valve');
}

function buildLevelGrid() {
  const grid = $('level-grid');
  if (!grid) return;
  grid.innerHTML = '';
  for (let i = 0; i < LEVEL_COUNT; i += 1) {
    const cell = document.createElement('button');
    cell.className = 'level-cell' + (i + 1 > unlocked ? ' locked' : '');
    cell.dataset.level = i;
    const stars = starsByLevel[i + 1] | 0;
    cell.innerHTML =
      `<span class="lv-num">${i + 1}</span>` +
      `<span class="lv-stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>`;
    cell.setAttribute('aria-label', `${t('level')} ${i + 1}${i + 1 > unlocked ? ' ' + t('locked') : ''}`);
    grid.appendChild(cell);
  }
  const total = totalStars();
  $('stars-total').textContent = `★ ${total} / ${LEVEL_COUNT * 3}`;
}

function showResult(res) {
  const { won, stars, blooms, bloomTotal, timeLeft, reason, hasNext } = res;
  $('result-title').textContent = won ? t('winTitle') : t('loseTitle');
  $('result-title').classList.toggle('lose', !won);
  const starsEl = $('result-stars');
  starsEl.innerHTML = won
    ? `<span class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>${stars >= 3 ? `<em>${t('perfect')}</em>` : ''}`
    : '';
  $('result-time').textContent = won ? t('timeLeft', { s: Math.ceil(timeLeft) }) : '';
  $('result-meta').textContent = won
    ? `${bloomTotal > 0 ? `✿ ${blooms}/${bloomTotal} · ` : ''}+${(blooms * 5 + stars * 10) * (doubled ? 2 : 1)}`
    : (reason === 'timeOut' ? t('timeOut') : t('deadEnd'));
  $('btn-next').style.display = won && hasNext ? '' : 'none';
  $('btn-double').classList.toggle('hidden', !(won && SdcAdsEnabled() && !doubled));
  $('screen-result').classList.remove('hidden');
}

function hideResult() {
  $('screen-result').classList.add('hidden');
}

function SdcAdsEnabled() {
  try { return !!(Sdk.canShowAd && Sdk.canShowAd('doubleCoins')); } catch { return false; }
}

function finishRun(ev) {
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial(); // 结算屏出现时引导必须退场
  const st = run.state;
  const won = ev.type === 'win';
  const stars = won ? (ev.stars || st.stars || 1) : 0;
  if (won) {
    const idx = st.level; // 1 基
    starsByLevel[idx] = Math.max(starsByLevel[idx] | 0, stars);
    if (idx < LEVEL_COUNT) unlocked = Math.max(unlocked, idx + 1);
    coins += st.blooms * 5 + stars * 10;
    buildLevelGrid();
  }
  persist();
  Sdk.track(won ? 'win' : 'fail', {
    level: st.level + 1, stars, blooms: st.blooms,
    durationMs: Math.round((st.initialTime - st.timeLeft) * 1000), progress: st.placements, revived: false,
  });
  showResult({
    won, stars, blooms: st.blooms, bloomTotal: st.bloomTotal, timeLeft: st.timeLeft,
    reason: ev.reason || null, hasNext: st.level + 1 < LEVEL_COUNT,
  });
  audio.event(won ? 'win' : 'lose');
}

// ---------- 教程引导（首次自动弹，可跳过，完成/跳过后持久化不再自动弹） ----------
const TUT_STEPS = () => [
  { text: t('tutStep1'), spot: 'queue' },
  { text: t('tutStep2'), spot: 'grid' },
  { text: t('tutStep3'), spot: 'grid' },
];

function layoutRect(which) {
  try {
    const lay = renderer.debugLayout();
    return lay && lay[which] ? lay[which] : null;
  } catch { return null; }
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
  const card = $('tut-card');
  if (rect) {
    spot.style.display = 'block';
    spot.style.left = `${rect.x - 8}px`;
    spot.style.top = `${rect.y - 8}px`;
    spot.style.width = `${rect.w + 16}px`;
    spot.style.height = `${rect.h + 16}px`;
  } else {
    spot.style.display = 'none';
  }
  // 卡片固定在网格下方居中，不遮棋盘
  card.style.left = '';
  card.style.top = '';
  card.classList.remove('side');
}

function tutorialNext() {
  // "Got it"=单步跳过；真实动作（grab/place/flowStart）才是主推进路径
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

// ---------- 事件消费 ----------
// 教学步骤推进（真实动作驱动）：0=grab 1=place 2=flowStart
const TUT_TRIGGER = ['grab', 'place', 'flowStart'];

function tutorialAdvance(evType) {
  if (tutorialStep < 0 || tutorialStep >= TUT_TRIGGER.length) return;
  if (TUT_TRIGGER[tutorialStep] !== evType) return;
  tutorialStep += 1;
  if (tutorialStep >= TUT_TRIGGER.length) endTutorial();
  else renderTutorialStep();
}

function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    tutorialAdvance(ev.type);
    switch (ev.type) {
      case 'place':
        view.shake = 3;
        break;
      case 'dig':
        view.shake = 5;
        break;
      case 'grab':
        view.selectedPiece = ev.piece;
        break;
      case 'cellWatered':
        view.fxQueue.push({ type: 'waterFlash', r: ev.r, c: ev.c, ttl: 0.4 });
        break;
      case 'bloom':
        view.fxQueue.push({ type: 'waterFlash', r: ev.r, c: ev.c, ttl: 0.5 });
        view.shake = 2;
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
    x: (e.clientX - rect.left) * (1280 / rect.width),
    y: (e.clientY - rect.top) * (720 / rect.height),
  };
}

function pickCell(p) {
  const lay = renderer.debugLayout();
  if (!lay || !run) return null;
  const { grid, cell } = lay;
  const c = Math.floor((p.x - grid.x) / cell);
  const r = Math.floor((p.y - grid.y) / cell);
  if (r < 0 || r >= run.state.rows || c < 0 || c >= run.state.cols) return null;
  return { r, c };
}

function pickQueue(p) {
  const lay = renderer.debugLayout();
  if (!lay || !lay.queue) return false;
  const q = lay.queue;
  return p.x >= q.x && p.x <= q.x + q.w && p.y >= q.y && p.y <= q.y + q.h;
}

canvas.addEventListener('pointermove', (e) => {
  view.cursor = canvasPos(e);
  view.hoverCell = (run && phase === 'playing') ? pickCell(view.cursor) : null;
});

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (!run || phase !== 'playing') return;
  const p = canvasPos(e);
  view.cursor = p;

  // 铲除模式：点管格触发
  if (armDig) {
    const cell = pickCell(p);
    if (cell) {
      const res = run.dig(cell.r, cell.c);
      if (res.ok) { armDig = false; updateHud(); }
    }
    return;
  }

  if (run.state.selected != null) {
    const cell = pickCell(p);
    if (cell) {
      const res = run.place(cell.r, cell.c);
      if (!res.ok) audio.event('place', { fail: true });
      updateHud();
    }
    return;
  }
  if (pickQueue(p)) {
    run.grab();
  }
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
  if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'result')) restartLevel();
  if (e.code === 'KeyM') toggleMute();
  if (e.code === 'Space') { e.preventDefault(); openValve(); }
});

// ---------- 开闸（手动放水：提前开闸冻结剩余时间，时间星按此刻结算） ----------
function openValve() {
  if (!run || phase !== 'playing') return;
  if (run.state.phase !== 'countdown') return;
  run.startFlow();
}

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
  on('btn-next', () => startLevel((run ? run.state.level : lastLevel) + 1));
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-valve', openValve);
  on('btn-tut-replay', () => {
    if (phase === 'paused') resumeGame();
    if (phase === 'playing') startTutorial();
  });
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result') startTutorial(); });
  on('btn-dig', () => { if (run && phase === 'playing') { armDig = !armDig; updateHud(); } });
  on('btn-rotate-skip', () => {
    const rs = $('rotate-screen');
    if (rs) rs.style.display = 'none';
  });
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);

  $('btn-double')?.addEventListener('click', async () => {
    const ok = await Sdk.showRewarded('doubleCoins');
    if (!ok) return;
    doubled = true;
    coins += run.state.blooms * 5 + run.state.stars * 10; // 再加一份 = ×2
    persist();
    Sdk.track('coins_doubled', { coins });
    showResult({
      won: true, stars: run.state.stars, blooms: run.state.blooms, bloomTotal: run.state.bloomTotal,
      timeLeft: run.state.timeLeft, reason: null, hasNext: run.state.level + 1 < LEVEL_COUNT,
    });
  });

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
      run.step(STEP);
      accumulator -= STEP;
    }
    handleEvents(run.drainEvents());
    if (run && phase === 'playing') updateHud();
    if (run) view.selectedPiece = run.state.selected;
  }

  if (view.shake > 0) view.shake = Math.max(0, view.shake - dt * 18);
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

// ---------- 调试契约（截图/验收脚本通用） ----------
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
    get steps() { return ['grab', 'place', 'flow']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
  },
  startTutorial: () => startTutorial(),
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: () => {
      if (!run) return null;
      const st = run.state;
      let rockCount = 0;
      for (const row of st.grid) for (const cell of row) if (cell.kind === 'rock') rockCount++;
      return { ...st, queueLen: st.queue.length, rockCount };
    },
    layout: () => { try { return renderer.debugLayout(); } catch { return null; } },
    loadLevel: (i) => startLevel(i),
    startSeeded: (i, seed) => {
      const idx = Math.max(0, Math.min(LEVEL_COUNT - 1, i | 0));
      lastLevel = idx;
      armDig = false;
      doubled = false;
      run = createRun(idx, { seed: seed | 0 || 1 });
      view.sceneKey = (LEVELS[idx] && LEVELS[idx].scene) || 'dawn-desert';
      setPhase('playing');
      ui.showGame();
      hideResult();
      updateHud();
      return true;
    },
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    startTutorial: () => startTutorial(),
    tutorialStep: () => tutorialStep,
    // 验收辅助：greedy 自动玩（与 tools/selfplay.mjs 同策略），返回是否通关
    autoPlaceSolution: () => {
      if (!run) return false;
      const level = run._level;
      const req = pathRequirements(level);
      const reqSet = new Set(req.keys());
      const todo = new Map(req);
      const junk = [];
      const key = (r, c) => `${r},${c}`;
      const kind = (r, c) => run.state.grid[r][c].kind;
      const rockSet = new Set(level.rocks.map(([r, c]) => key(r, c)));
      const se = new Set([key(level.start.r, level.start.c), key(level.end.r, level.end.c)]);
      const empties = [];
      for (let r = 0; r < level.rows; r += 1) {
        for (let c = 0; c < level.cols; c += 1) {
          const k = key(r, c);
          if (!rockSet.has(k) && !se.has(k) && !reqSet.has(k)) empties.push({ r, c });
        }
      }
      for (let step = 0; step < 400 && run.state.phase === 'countdown'; step += 1) {
        if (todo.size === 0) { run.startFlow(); break; }
        if (!run.state.selected) {
          if (!run.grab().ok) break;
          continue;
        }
        const piece = run.state.selected;
        let target = null;
        for (const [k, need] of todo) {
          const [r, c] = k.split(',').map(Number);
          if (need === piece && (kind(r, c) === 'empty' || kind(r, c) === 'bloom')) { target = { r, c, k }; break; }
        }
        if (!target) {
          target = empties.find(({ r, c }) => kind(r, c) === 'empty' || kind(r, c) === 'bloom');
          if (target) target.k = key(target.r, target.c);
        }
        if (!target && junk.length) {
          const jk = junk.shift();
          if (kind(jk.r, jk.c) === 'pipe' && run.state.digLeft > 0) {
            run.dig(jk.r, jk.c);
            target = { r: jk.r, c: jk.c, k: jk.k };
          }
        }
        if (!target) break;
        if (!run.place(target.r, target.c).ok) break;
        if (todo.has(target.k)) todo.delete(target.k);
        else if (!reqSet.has(target.k)) junk.push(target);
      }
      if (run.state.phase === 'countdown') run.startFlow();
      return true;
    },
    // 快进：开闸并把水流推到终局
    fastForward: () => {
      if (!run) return false;
      try {
        if (run.state.phase === 'countdown') run.startFlow();
        let guard = 4000;
        while (guard-- > 0 && (run.state.phase === 'countdown' || run.state.phase === 'flowing')) {
          run.step(0.5);
          handleEvents(run.drainEvents());
        }
        return true;
      } catch { return false; }
    },
    giveUp: () => window.__ll.debug.fastForward(),
    armDig: () => armDig,
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
