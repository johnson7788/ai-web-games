// CAT TACTICS · 主入口：60Hz 固定步长 + 标题/游戏/暂停/结算 + 教程 + SDK 统一出口
// 装配：sim / render / audio / ui / i18n / Sdk。
import { STEP, GAME, WORLD } from '../config/game.config.js';
import { createRun, SLOT_COUNT, MAX_RUNNING } from './game/sim.js';
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
let drag = null; // { slotIdx }
let tutorialStep = -1;
let toastTimer = null;

const view = { cursor: { x: 0, y: 0 }, drag: null, shake: 0 };

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let tutorialDone = !!Sdk.load('tutorialDone', false);
let starsBest = Sdk.load('starsBest', 0) | 0;
let bestEarned = Sdk.load('bestEarned', 0) | 0;

Sdk.ready(); // 不 await，不阻塞首屏
audio.setMuted(muted);
ui.setMuted(muted);

function persist() {
  Sdk.save('muted', muted);
  Sdk.save('tutorialDone', tutorialDone);
  Sdk.save('starsBest', starsBest);
  Sdk.save('bestEarned', bestEarned);
}

// ---------- 阶段状态机 ----------
function setPhase(p) { phase = p; }

function startGame() {
  drag = null;
  run = createRun({ seed: (Date.now() % 2147483647) || 1 });
  setPhase('playing');
  ui.showGame();
  $('screen-result').classList.add('hidden');
  updateHud();
  updatePanel();
  audio.startBgm();
  Sdk.newRun({});
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

function restartGame() {
  if (run) Sdk.track('restart', {});
  startGame();
}

function goHome() {
  run = null;
  drag = null;
  endTutorial();
  setPhase('title');
  $('screen-result').classList.add('hidden');
  ui.showTitle();
  $('stars-total').textContent = `★ ${starsBest}`;
}

// ---------- HUD / 面板 / 结算 ----------
function updateHud() {
  if (!run) return;
  const h = run.getHud();
  $('hud-coins').textContent = `⛁ ${h.coins}`;
  $('hud-gems').textContent = `◇ ${h.gems}`;
  $('hud-mission').textContent = `${t('mission')} ${h.mission} · ${t('target', { n: h.target })}`;
  const left = Math.max(0, Math.ceil(h.timeLimit - h.missionTime));
  const timeEl = $('hud-time');
  timeEl.textContent = `${left}s`;
  timeEl.classList.toggle('time-low', left <= 10);
  $('hud-income').textContent = t('income', { n: Math.round(h.income) });
  $('hud-running').textContent = t('running', { n: h.runningCount });
  $('hud-highest').textContent = t('highest', { n: h.maxLevel });
  $('hud-combo').classList.toggle('hidden', !(h.combo >= 2));
  if (h.combo >= 2) $('hud-combo').textContent = t('combo', { n: h.combo });
  $('hud-boost').classList.toggle('hidden', !(h.boostLeft > 0));
  if (h.boostLeft > 0) $('hud-boost').textContent = `${t('boostActive')} ${Math.ceil(h.boostLeft)}s`;
}

function updatePanel() {
  if (!run) return;
  const h = run.getHud();
  const full = run.state.slots.every((c) => c);
  const rec = $('btn-recruit');
  rec.disabled = h.coins < run.state.recruitCost || full || phase !== 'playing';
  $('recruit-cost').textContent = `⛁ ${run.state.recruitCost}`;
  const bst = $('btn-boost');
  bst.disabled = h.coins < GAME.BOOST_COST || h.boostLeft > 0 || phase !== 'playing';
  $('boost-cost').textContent = `⛁ ${GAME.BOOST_COST}`;
}

function showToast(text) {
  let el = $('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.style.cssText = 'position:absolute;left:50%;top:120px;transform:translateX(-50%);z-index:15;padding:10px 22px;border-radius:12px;background:rgba(10,14,26,0.94);border:1px solid #ffe95c;color:#ffe95c;font-weight:900;font-size:1.15rem;pointer-events:none;letter-spacing:1px;box-shadow:0 6px 20px rgba(0,0,0,0.4);';
    $('game-container').appendChild(el);
  }
  el.textContent = text;
  el.style.display = 'block';
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.style.display = 'none'; }, 1800);
}

function showResult(ev) {
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  const won = ev.type === 'win';
  const st = run.state;
  const stars = won ? (ev.stars || st.stars || 1) : 0;
  if (won) {
    starsBest = Math.max(starsBest, stars);
    bestEarned = Math.max(bestEarned, Math.floor(st.totalEarned));
    Sdk.levelCleared({ stars, earned: Math.floor(st.totalEarned) });
  } else {
    Sdk.gameOver({ mission: st.mission, earned: Math.floor(st.totalEarned) });
  }
  persist();
  const titleEl = $('result-title');
  titleEl.textContent = won ? t('winTitle') : t('loseTitle');
  titleEl.classList.toggle('lose', !won);
  const starsEl = $('result-stars');
  starsEl.innerHTML = won
    ? `<span class="stars">${'★'.repeat(stars)}${'☆'.repeat(Math.max(0, 3 - stars))}</span>${stars >= 3 ? `<em>${t('perfect')}</em>` : ''}`
    : '';
  $('result-meta').textContent = won
    ? `${t('totalEarned')} ⛁ ${Math.floor(st.totalEarned)} · ${t('stars')} ★ ${stars}`
    : t('timeOut');
  $('btn-next').classList.add('hidden');
  $('screen-result').classList.remove('hidden');
  updatePanel();
}

// ---------- 教程 ----------
const TUT_STEPS = () => [
  { text: t('tutStep1'), spot: 'recruit' },
  { text: t('tutStep2'), spot: 'merge' },
  { text: t('tutStep3'), spot: 'deploy' },
  { text: t('tutStep4'), spot: 'boost' },
];

function domRect(el) {
  const c = $('game-container').getBoundingClientRect();
  const r = el.getBoundingClientRect();
  return { x: r.left - c.left, y: r.top - c.top, w: r.width, h: r.height };
}

function layoutRect(which) {
  const lay = renderer.debugLayout();
  if (which === 'recruit') return domRect($('btn-recruit'));
  if (which === 'boost') return domRect($('btn-boost'));
  if (which === 'merge') {
    const r = lay.slots[0];
    return { x: r.x, y: r.y, w: r.w, h: r.h };
  }
  if (which === 'deploy') return { x: lay.track.x, y: lay.track.y, w: lay.track.w, h: lay.track.h };
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
  const rect = s && s.spot ? layoutRect(s.spot) : null;
  const spot = $('tut-spotlight');
  if (rect) {
    spot.style.display = 'block';
    spot.style.left = `${Math.max(0, rect.x - 8)}px`;
    spot.style.top = `${Math.max(0, rect.y - 8)}px`;
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

const TUT_TRIGGER = ['buy', 'merge', 'deploy', 'boost'];
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
      case 'merge': {
        if (ev.slot != null) {
          const r = renderer.slotRect(ev.slot);
          renderer.burst(r.x + r.w / 2, r.y + r.h / 2, '#ffe95c', 14);
        }
        view.shake = 3;
        break;
      }
      case 'combo':
        showToast(t('combo', { n: ev.combo }) + ' +' + ev.bonus);
        break;
      case 'levelup':
        showToast(t('highest', { n: ev.level }));
        break;
      case 'mission':
        showToast(t('missionClear', { n: ev.mission }) + ` ★${ev.stars}`);
        view.shake = 4;
        break;
      case 'coin':
        break;
      case 'boost':
        showToast(t('boostActive'));
        break;
      case 'win':
      case 'lose':
        showResult(ev);
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

canvas.addEventListener('pointermove', (e) => {
  view.cursor = canvasPos(e);
  if (drag) view.cursor = canvasPos(e);
});

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (!run || phase !== 'playing') return;
  const p = canvasPos(e);
  view.cursor = p;
  const hit = renderer.hitTest(p);
  if (hit && hit.kind === 'slot') {
    const cat = run.state.slots[hit.index];
    if (cat && !cat.running) drag = { slotIdx: hit.index };
  }
});

canvas.addEventListener('pointerup', (e) => {
  if (!drag || !run || phase !== 'playing') return;
  const p = canvasPos(e);
  const hit = renderer.hitTest(p);
  if (hit) {
    if (hit.kind === 'slot') run.dropSlot(drag.slotIdx, hit.index);
    else if (hit.kind === 'track') run.deploy(drag.slotIdx);
    else if (hit.kind === 'recycle') run.recycle(drag.slotIdx);
  }
  drag = null;
  view.drag = null;
  handleEvents(run.drainEvents());
  updateHud();
  updatePanel();
});

canvas.addEventListener('pointercancel', () => { drag = null; });

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
  if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'result')) restartGame();
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
  on('btn-start', () => startGame());
  on('btn-resume', resumeGame);
  on('btn-restart', restartGame);
  on('btn-restart2', restartGame);
  on('btn-retry', restartGame);
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-recruit', () => {
    if (!run || phase !== 'playing') return;
    const res = run.buy();
    handleEvents(run.drainEvents());
    if (res.ok) { renderer.burst(renderer.slotRect(res.slot).x + 83, renderer.slotRect(res.slot).y + 58, '#ff5c8a', 10); }
    updateHud();
    updatePanel();
  });
  on('btn-boost', () => {
    if (!run || phase !== 'playing') return;
    run.boost();
    handleEvents(run.drainEvents());
    updateHud();
    updatePanel();
  });
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result' || phase === 'paused') startTutorial(); });
  on('btn-tut-replay', () => {
    if (phase === 'paused') resumeGame();
    if (phase === 'playing') startTutorial();
  });
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);

  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = $(id);
    if (!sel) continue;
    sel.addEventListener('change', () => {
      ui.setLang(sel.value);
      renderTutorialStep();
      if (run) { updateHud(); updatePanel(); }
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
    if (run && phase === 'playing') {
      updateHud();
      updatePanel();
    }
  }

  if (view.shake > 0) view.shake = Math.max(0, view.shake - dt * 18);
  try {
    renderer.draw(run ? run.state : (phase === 'title' ? null : (run ? run.state : null)), dt, view);
  } catch (err) {
    console.warn('render error', err);
  }
  if (fpsSamples.length < 600 && dt > 0) fpsSamples.push(1 / dt);

  requestAnimationFrame(frame);
}

// ---------- 调试契约 ----------
function autoPlayGreedy() {
  if (!run) return false;
  let guard = 0;
  const findPair = () => {
    let best = null;
    for (let a = 0; a < SLOT_COUNT; a += 1) {
      for (let b = a + 1; b < SLOT_COUNT; b += 1) {
        const ca = run.state.slots[a];
        const cb = run.state.slots[b];
        if (!ca || !cb || ca.level !== cb.level || ca.level >= 29) continue;
        const score = ca.level * 10 + (ca.running ? 0 : 1) + (cb.running ? 0 : 1);
        if (!best || score > best.score) best = { a, b };
      }
    }
    return best;
  };
  const emptyIdx = () => run.state.slots.findIndex((c) => !c);
  const deployIdx = () => {
    let idx = -1; let lvl = -1;
    run.state.slots.forEach((c, i) => { if (c && !c.running && c.level > lvl) { idx = i; lvl = c.level; } });
    return idx;
  };
  const parkedLowest = () => {
    let idx = -1; let lvl = Infinity;
    run.state.slots.forEach((c, i) => { if (c && !c.running && c.level < lvl) { idx = i; lvl = c.level; } });
    return idx;
  };
  while (run.state.phase === 'playing' && guard < 600000) {
    guard += 1;
    const pair = findPair();
    if (pair) {
      if (run.state.slots[pair.a].running) run.stop(pair.a);
      if (run.state.slots[pair.b].running) run.stop(pair.b);
      run.merge(pair.a, pair.b);
      handleEvents(run.drainEvents());
      continue;
    }
    const e = emptyIdx();
    if (e >= 0 && run.state.coins >= run.state.recruitCost) { run.buy(); handleEvents(run.drainEvents()); continue; }
    if (run.state.runningCount < MAX_RUNNING) {
      const d = deployIdx();
      if (d >= 0) { run.deploy(d); handleEvents(run.drainEvents()); continue; }
    }
    if (run.state.coins >= GAME.BOOST_COST && run.state.boostLeft <= 0 && run.state.incomePerSec > 0) { run.boost(); handleEvents(run.drainEvents()); continue; }
    if (run.state.incomePerSec > 0) { run.step(1 / 60); handleEvents(run.drainEvents()); continue; }
    const l0 = parkedLowest();
    if (l0 >= 0) { run.recycle(l0); handleEvents(run.drainEvents()); continue; }
    run.step(1 / 60);
    handleEvents(run.drainEvents());
  }
  updateHud();
  updatePanel();
  return run.state.phase === 'won';
}

window.__ll = {
  state: {
    get phase() { return phase; },
    get lang() { return i18n.lang; },
  },
  run: () => run,
  start: () => startGame(),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => restartGame(),
  home: () => goHome(),
  sim: () => (run ? run.state : null),
  save: () => Sdk.save('probe', { t: Date.now() }),
  ui: () => ui,
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['buy', 'merge', 'deploy', 'boost']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
    skip: () => endTutorial(),
  },
  startTutorial: () => startTutorial(),
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: () => {
      if (!run) return null;
      const st = run.state;
      const cats = st.slots.map((c) => (c ? { level: c.level, running: c.running } : null));
      return { ...st, cats, runningCount: st.runningCount, income: run.getHud().income };
    },
    layout: () => renderer.debugLayout(),
    refresh: () => { updateHud(); updatePanel(); },
    buy: () => {
      const r = run ? run.buy() : { ok: false };
      if (run) { handleEvents(run.drainEvents()); updateHud(); updatePanel(); }
      return r;
    },
    mergeBest: () => {
      if (!run) return { ok: false };
      let res = { ok: false };
      for (let a = 0; a < SLOT_COUNT; a += 1) {
        for (let b = a + 1; b < SLOT_COUNT; b += 1) {
          const ca = run.state.slots[a]; const cb = run.state.slots[b];
          if (ca && cb && ca.level === cb.level && !ca.running && !cb.running) { res = run.merge(a, b); break; }
        }
        if (res.ok) break;
      }
      if (run) { handleEvents(run.drainEvents()); updateHud(); updatePanel(); }
      return res;
    },
    deployBest: () => {
      if (!run) return { ok: false };
      let idx = -1; let lvl = -1;
      run.state.slots.forEach((c, i) => { if (c && !c.running && c.level > lvl) { idx = i; lvl = c.level; } });
      const res = idx >= 0 ? run.deploy(idx) : { ok: false };
      if (run) { handleEvents(run.drainEvents()); updateHud(); updatePanel(); }
      return res;
    },
    autoPlay: () => autoPlayGreedy(),
    winNow: () => {
      if (!run) return false;
      let guard = 0;
      while (run.state.phase === 'playing' && guard < 10) {
        run.state.totalEarned = run.state.target;
        run.step(0);
        guard += 1;
      }
      handleEvents(run.drainEvents());
      updateHud();
      updatePanel();
      return run.state.phase === 'won';
    },
    forceLose: () => {
      if (!run) return false;
      run.state.missionTime = run.state.timeLimit;
      run.step(0);
      handleEvents(run.drainEvents());
      return run.state.phase === 'lost';
    },
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    startTutorial: () => startTutorial(),
    tutorialStep: () => tutorialStep,
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
$('stars-total').textContent = `★ ${starsBest}`;
$('btn-mute').classList.toggle('is-muted', muted);
Sdk.track('load', {});
requestAnimationFrame(frame);
