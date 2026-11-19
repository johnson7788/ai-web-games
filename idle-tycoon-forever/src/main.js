// 主入口：60Hz 固定步长 + 标题/街区/自动战斗/结算 + 教程引导 + SDK 统一出口。
// 装配：sim（纯逻辑）/ render（canvas 霓虹）/ ui（语言与屏幕）/ audio（WebAudio）。
import { STEP, CONFIG, GAME } from '../config/game.config.js';
import { DISTRICTS, SLOTS, GRADES, HQ_INFO, HQ_MAX, levelUpCost, MONOPOLY_COST, IPO_COST, monopolyCutRate, makeDeptItem } from './game/data.js';
import { createRun, createPlayer, recomputeStats } from './game/sim.js';
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
let fpsSamples = [];
let tutorialStep = -1;      // -1 = 未激活
let muted = !!Sdk.load('muted', false);
let tutorialDone = !!Sdk.load('tutorialDone', false);
let lastDistrict = Math.max(0, Sdk.load('lastDistrict', 0) | 0);

const view = {
  cursor: { x: 0, y: 0 },
  shake: 0,
  flash: 0,
  floaters: [],
};

// ---------- 存档 ----------
function persist() {
  if (!run) return;
  Sdk.save('player', run.state.player);
  Sdk.save('tutorialDone', tutorialDone);
  Sdk.save('muted', muted);
  Sdk.save('lastDistrict', run.state.district);
  Sdk.save('districtStars', run.state.districtStars);
  Sdk.save('districtCleared', run.state.districtCleared);
}

// ---------- 阶段状态机 ----------
function setPhase(p) { phase = p; }

function enterDistrict(idx) {
  idx = Math.max(0, Math.min(DISTRICTS.length - 1, idx | 0));
  const res = run.enterDistrict(idx);
  if (!res.ok) return false;
  lastDistrict = idx;
  setPhase('playing');
  ui.showGame();
  hideResult();
  updateHud();
  renderDistrictPanel();
  persist();
  if (!tutorialDone && idx === 0) startTutorial();
  return true;
}

function startGame() {
  audio.unlock();
  audio.startBgm();
  enterDistrict(lastDistrict);
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
  if (!run) return;
  const idx = run.state.district;
  run.enterDistrict(idx);
  setPhase('playing');
  ui.showGame();
  hideResult();
  updateHud();
  persist();
}

function goHome() {
  setPhase('title');
  hideResult();
  ui.showTitle();
  audio.stopBgm();
  persist();
}

// ---------- HUD ----------
function fmt(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(Math.floor(n));
}

function updateHud() {
  if (!run) return;
  const h = run.getHud();
  const p = run.state.player;
  $('hud-level').textContent = `Lv ${h.lv}`;
  $('hud-cash').textContent = `$ ${fmt(h.cash)}`;
  $('hud-gems').textContent = `◆ ${fmt(h.gems)}`;
  $('hud-power').textContent = `⚡ ${fmt(h.power)}`;
  $('hud-targets').textContent = `🎯 ${h.rivalsLeft}`;
  $('hud-combo').textContent = h.combo > 0 ? `×${h.combo} Combo` : '';
  $('hud-combo').style.display = h.combo > 0 ? '' : 'none';
  $('hud-idle').textContent = `+${fmt(h.idleRate)}/s`;
  $('hud-idle').title = t('idleCash');
  $('btn-mute').textContent = muted ? '🔇' : '🔊';
  $('btn-mute').classList.toggle('is-muted', muted);
}

// ---------- 飘字 / 震屏 ----------
function spawnFloater(text, color, x, y) {
  view.floaters.push({ text, color, x, y, ttl: 1.2 });
}

function floatersFor(ev) {
  if (ev.type === 'win') {
    spawnFloater(`VICTORY  +$${fmt(ev.cash)}`, '#4ade80', 640, 260);
    spawnFloater(`+${ev.chips} chips`, '#22d3ee', 640, 290);
    view.flash = 0.25;
  } else if (ev.type === 'lose') {
    spawnFloater(t('defeated'), '#f87171', 640, 260);
    view.shake = 6;
  } else if (ev.type === 'hitEnemy') {
    spawnFloater(`-${ev.value}`, '#22d3ee', 980, 300);
  } else if (ev.type === 'hitPlayer') {
    spawnFloater(`-${ev.value}`, '#f87171', 300, 300);
    view.shake = 3;
  } else if (ev.type === 'cut') {
    spawnFloater(`CUT -${ev.value}`, '#fbbf24', 980, 270);
    view.flash = 0.3;
  } else if (ev.type === 'idleCash') {
    spawnFloater(`+$${ev.amount}`, '#fbbf24', 150, 560);
  } else if (ev.type === 'levelUp') {
    spawnFloater(`${t('levelUp')} Lv${ev.lv}`, '#22d3ee', 135, 200);
  } else if (ev.type === 'districtClear') {
    spawnFloater(`${t('districtCleared')} ★${ev.stars}`, '#fbbf24', 640, 300);
    view.flash = 0.5;
  }
}

// ---------- 结算（街区清空） ----------
function showResult(stars, districtIdx) {
  setPhase('result');
  audio.stopBgm();
  const hasNext = districtIdx + 1 < DISTRICTS.length && run.state.player.lv >= DISTRICTS[districtIdx + 1].unlockLv;
  $('result-title').textContent = t('districtCleared');
  $('result-stars').innerHTML = `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)} <small>${t('starsEarned')}</small>`;
  $('result-meta').textContent = `District ${districtIdx + 1} · ${DISTRICTS[districtIdx].en}`;
  const btns = $('screen-result').querySelector('.win-btns');
  btns.innerHTML = '';
  const retry = document.createElement('button');
  retry.textContent = t('retry');
  retry.addEventListener('click', () => restartLevel());
  btns.appendChild(retry);
  if (hasNext) {
    const next = document.createElement('button');
    next.textContent = t('nextDistrict');
    next.addEventListener('click', () => enterDistrict(districtIdx + 1));
    btns.appendChild(next);
  }
  const home = document.createElement('button');
  home.textContent = t('home');
  home.className = 'btn-ghost';
  home.addEventListener('click', goHome);
  btns.appendChild(home);
  $('screen-result').classList.remove('hidden');
  audio.event('districtClear', { stars });
}

function hideResult() {
  $('screen-result').classList.add('hidden');
}

// ---------- 事件消费 ----------
function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    floatersFor(ev);
    if (ev.type === 'districtClear') {
      showResult(ev.stars, ev.district);
    }
    if (ev.type === 'win' || ev.type === 'lose' || ev.type === 'districtClear' || ev.type === 'levelUp') {
      updateHud();
      renderInvestPanel();
    }
  }
}

// ---------- 教程引导 ----------
const TUT_STEPS = () => [
  { spot: 'rivals', text: t('tutStep1') },
  { spot: 'combo', text: t('tutStep2') },
  { spot: 'invest', text: t('tutStep3') },
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
  const rect = spotRect(s ? s.spot : '');
  const spot = $('tut-spotlight');
  if (rect) {
    spot.style.display = 'block';
    spot.style.left = `${rect.x}px`;
    spot.style.top = `${rect.y}px`;
    spot.style.width = `${rect.w}px`;
    spot.style.height = `${rect.h}px`;
  } else {
    spot.style.display = 'none';
  }
}

function spotRect(spot) {
  if (spot === 'rivals') {
    const rects = renderer.debugLayout(run ? run.state : null).rivalRects;
    if (rects && rects.length) {
      const r = rects[0];
      return scaleRect(r);
    }
  } else if (spot === 'combo') {
    return domRect($('hud-combo'));
  } else if (spot === 'invest') {
    return domRect($('ab-invest'));
  }
  return null;
}

function scaleRect(r) {
  const cr = canvas.getBoundingClientRect();
  const k = cr.width / 1280;
  return { x: r.x * k, y: r.y * k, w: r.w * k, h: r.h * k };
}

function domRect(el) {
  if (!el) return null;
  const cr = canvas.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  return { x: r.left - cr.left, y: r.top - cr.top, w: r.width, h: r.height };
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
    x: (e.clientX - rect.left) * (1280 / rect.width),
    y: (e.clientY - rect.top) * (720 / rect.height),
  };
}

function pickRivalAt(p) {
  if (!run || phase !== 'playing' || run.state.phase !== 'idle') return false;
  const rects = renderer.debugLayout(run.state).rivalRects;
  for (const r of rects) {
    if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) {
      const res = run.pickRival(r.idx);
      if (res.ok) { updateHud(); return true; }
    }
  }
  return false;
}

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  pickRivalAt(canvasPos(e));
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
  if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused')) restartLevel();
  if (e.code === 'KeyM') toggleMute();
});

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  ui.setMuted(muted);
  updateHud();
  persist();
}

// ---------- 面板 ----------
function openPanel(id) {
  for (const p of document.querySelectorAll('.panel')) p.classList.add('hidden');
  const panel = $(id);
  if (panel) panel.classList.remove('hidden');
  if (id === 'panel-district') renderDistrictPanel();
  if (id === 'panel-invest') renderInvestPanel();
  if (id === 'panel-market') renderMarketPanel();
  if (id === 'panel-hq') renderHqPanel();
  if (id === 'panel-monopoly') renderMonopolyPanel();
  if (id === 'panel-ipo') renderIpoPanel();
}

function closePanel() {
  for (const p of document.querySelectorAll('.panel')) p.classList.add('hidden');
}

function renderDistrictPanel() {
  const grid = $('district-grid');
  if (!grid) return;
  const unlocked = run.unlockedDistrictCount();
  grid.innerHTML = '';
  DISTRICTS.forEach((d, idx) => {
    const cell = document.createElement('button');
    cell.className = 'district-cell' + (idx + 1 > unlocked ? ' locked' : '') + (idx === run.state.district ? ' current' : '');
    const stars = run.state.districtStars[idx] | 0;
    cell.innerHTML = `<span>${d.en}</span><small>${d.key} · Lv${d.unlockLv}</small><span class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>`;
    cell.addEventListener('click', () => {
      if (idx + 1 > unlocked) return;
      enterDistrict(idx);
      closePanel();
    });
    grid.appendChild(cell);
  });
}

function deptName(d) {
  return `${t(SLOTS[d.slot].key)}${d.grade > 0 ? ' ' + t(GRADES[d.grade].key) : ''}`;
}

function renderInvestPanel() {
  const p = run.state.player;
  const stats = $('inv-stats');
  stats.innerHTML =
    `<div>Lv ${p.lv} · $ ${fmt(p.cash)} · ◆ ${fmt(p.gems)}</div>` +
    `<div>${t('attack')} ${p.att} · ${t('defense')} ${p.def} · ${t('valuation')} ${p.maxHp} · ${t('power')} ${fmt(p.power)}</div>`;
  const cost = levelUpCost(p.lv);
  const lvBtn = $('inv-levelup');
  lvBtn.textContent = p.lv >= 60 ? 'MAX' : `${t('levelUp')} ($${fmt(cost)})`;
  lvBtn.disabled = p.lv >= 60 || p.cash < cost;
  const chipBtn = $('inv-usecchip');
  const chipCount = p.backpack.filter((b) => b.id === 'chip').reduce((s, b) => s + b.count, 0);
  chipBtn.textContent = `${t('use')} ${t('chipEarned')} ×${chipCount}`;
  chipBtn.disabled = chipCount <= 0 || p.lv >= 60;

  const slots = $('inv-slots');
  slots.innerHTML = '<h4>' + t('panelEquip') + '</h4><div class="slot-row"></div>';
  const row = slots.querySelector('.slot-row');
  SLOTS.forEach((s) => {
    const card = document.createElement('button');
    const d = p.equip[s.id];
    card.className = 'slot-card';
    card.textContent = d ? `${deptName(d)} ⚡${(d.att || 0) + (d.def || 0) + Math.round((d.hp || 0) / 10)}` : `${t(s.key)} · —`;
    if (d) card.style.borderColor = GRADES[d.grade].color;
    card.title = d ? `${t(s.key)} · ${t(GRADES[d.grade].key)}` : t(s.key);
    row.appendChild(card);
  });

  const bag = $('inv-backpack');
  bag.innerHTML = '<h4>' + t('panelShop') + ` <small>${t('synthesize')}</small></h4><div class="slot-row"></div>`;
  const brow = bag.querySelector('.slot-row');
  const depts = p.backpack.map((b, i) => ({ b, i })).filter(({ b }) => b.type === 'dept');
  depts.forEach(({ b, i }) => {
    const card = document.createElement('button');
    card.className = 'item-card g' + b.grade;
    card.textContent = `${deptName(b)} ⚡${(b.att || 0) + (b.def || 0) + Math.round((b.hp || 0) / 10)}`;
    card.title = t('equip');
    card.addEventListener('click', () => { run.equipDept(i); persist(); renderInvestPanel(); updateHud(); });
    brow.appendChild(card);
  });
}

function renderMarketPanel() {
  const body = $('market-body');
  const p = run.state.player;
  body.innerHTML = '';
  const buyChip = document.createElement('button');
  buyChip.className = 'big-btn';
  buyChip.textContent = `${t('buy')} ${t('chipEarned')} ($${fmt(levelUpCost(p.lv))})`;
  buyChip.disabled = p.cash < levelUpCost(p.lv);
  buyChip.addEventListener('click', () => { run.levelUpViaCash(); persist(); renderMarketPanel(); updateHud(); });
  body.appendChild(buyChip);
  const buyDept = document.createElement('button');
  buyDept.className = 'big-btn magenta';
  buyDept.textContent = `${t('buy')} ${t('panelEquip')} (◆50)`;
  buyDept.disabled = p.gems < 50;
  buyDept.addEventListener('click', () => {
    if (run.state.player.gems < 50) return;
    run.state.player.gems -= 50;
    run.state.player.backpack.push({ ...makeDeptItem(Math.floor(Math.random() * 6), 0, Math.max(1, run.state.player.lv)), count: 1 });
    recomputeStats(run.state.player);
    persist(); renderMarketPanel(); updateHud();
  });
  body.appendChild(buyDept);
}

function renderHqPanel() {
  const p = run.state.player;
  const body = $('hq-body');
  const info = HQ_INFO[p.hq.lv - 1];
  const bps = p.backpack.filter((b) => b.id === 'blueprint').reduce((s, b) => s + b.count, 0);
  body.innerHTML =
    `<div class="inv-stats"><div>HQ Lv${p.hq.lv} · ${info ? info.en : ''}</div>` +
    `<div>${t('blueprint')} ×${bps}</div></div>`;
  const btn = document.createElement('button');
  btn.className = 'big-btn';
  if (p.hq.lv >= HQ_MAX) {
    btn.textContent = 'MAX';
    btn.disabled = true;
  } else {
    btn.textContent = `${t('hqUp')} (${info.consume} ${t('blueprint')})`;
    btn.disabled = bps < info.consume;
  }
  btn.addEventListener('click', () => { run.hqUpgrade(); persist(); renderHqPanel(); updateHud(); });
  body.appendChild(btn);
}

function renderMonopolyPanel() {
  const p = run.state.player;
  const body = $('monopoly-body');
  const lv = p.monopoly.lv;
  const cost = MONOPOLY_COST[Math.min(lv - 1, MONOPOLY_COST.length - 1)];
  body.innerHTML =
    `<div class="inv-stats"><div>${t('panelMonopoly')} Lv${lv} · ★${p.monopoly.stars}/10</div>` +
    `<div>${t('cut')} ${monopolyCutRate(lv)}%</div></div>`;
  const btn = document.createElement('button');
  btn.className = 'big-btn gold';
  if (cost <= 0) { btn.textContent = 'MAX'; btn.disabled = true; }
  else { btn.textContent = `${t('monopolyUp')} ($${fmt(cost)})`; btn.disabled = p.cash < cost; }
  btn.addEventListener('click', () => { run.monopolyUpgrade(); persist(); renderMonopolyPanel(); updateHud(); });
  body.appendChild(btn);
}

function renderIpoPanel() {
  const p = run.state.player;
  const body = $('ipo-body');
  body.innerHTML = `<div class="inv-stats"><div>◆ ${fmt(p.gems)}</div></div>`;
  const one = document.createElement('button');
  one.className = 'big-btn magenta';
  one.textContent = `${t('ipoSpin')} (◆${IPO_COST.one})`;
  one.disabled = p.gems < IPO_COST.one;
  one.addEventListener('click', () => { run.ipoSpin(1); persist(); renderIpoPanel(); updateHud(); });
  const ten = document.createElement('button');
  ten.className = 'big-btn magenta';
  ten.textContent = `${t('ipo10')} (◆${IPO_COST.ten})`;
  ten.disabled = p.gems < IPO_COST.ten;
  ten.addEventListener('click', () => { run.ipoSpin(10); persist(); renderIpoPanel(); updateHud(); });
  body.appendChild(one);
  body.appendChild(ten);
}

// ---------- UI 绑定 ----------
function bind() {
  const on = (id, fn) => {
    const el = $(id);
    if (el) el.addEventListener('click', () => { audio.unlock(); fn(); });
  };
  on('btn-start', startGame);
  on('btn-resume', resumeGame);
  on('btn-restart', restartLevel);
  on('btn-restart2', restartLevel);
  on('btn-retry', restartLevel);
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result') startTutorial(); });
  on('btn-tut-replay', () => { if (phase === 'paused') resumeGame(); if (phase === 'playing') startTutorial(); });
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);
  on('inv-levelup', () => { run.levelUpViaCash(); persist(); renderInvestPanel(); updateHud(); });
  on('inv-usecchip', () => { run.useChip(1); persist(); renderInvestPanel(); updateHud(); });

  for (const btn of document.querySelectorAll('#action-bar .ab-btn')) {
    btn.addEventListener('click', () => { audio.unlock(); openPanel(btn.dataset.panel); });
  }
  for (const btn of document.querySelectorAll('.panel-close')) {
    btn.addEventListener('click', closePanel);
  }

  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = $(id);
    if (!sel) continue;
    sel.addEventListener('change', () => {
      ui.setLang(sel.value);
      renderTutorialStep();
      renderDistrictPanel();
      renderInvestPanel();
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
  if (view.flash > 0) view.flash = Math.max(0, view.flash - dt * 1.6);
  for (const f of view.floaters) {
    f.ttl -= dt;
    f.y -= dt * 26;
  }
  view.floaters = view.floaters.filter((f) => f.ttl > 0);

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
  start: (i) => { startGame(); if (i != null) enterDistrict(i); },
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => { if (phase === 'title') startGame(); else restartLevel(); },
  home: () => goHome(),
  sim: () => (run ? run.state : null),
  save: (k, v) => Sdk.save(k, v),
  ui,
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['rivals', 'combo', 'invest']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
  },
  startTutorial: () => startTutorial(),
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: () => (run ? run.state : null),
    enterDistrict: (i) => enterDistrict(i),
    pickRival: (i) => (run && run.state.phase === 'idle' ? run.pickRival(i) : { ok: false }),
    fastForward: () => {
      if (!run) return false;
      let guard = 6000;
      while (guard-- > 0 && run.state.phase === 'battle') run.step(1 / 60);
      return true;
    },
    clearDistrict: () => {
      const r = run.debugClearDistrict();
      handleEvents(run.drainEvents());
      updateHud();
      return r;
    },
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    giveCash: (n) => { if (run) { run.state.player.cash += n; persist(); updateHud(); } },
    setLv: (n) => { if (run) { run.state.player.lv = Math.max(1, n | 0); recomputeStats(run.state.player); persist(); updateHud(); } },
  },
};

// ---------- 启动 ----------
// 恢复或新建玩家
const savedPlayer = Sdk.load('player', null);
run = createRun({ seed: (Date.now() % 2147483647) || 1, player: savedPlayer || createPlayer() });
// 恢复街区星级（若存档有）
if (savedPlayer) {
  run.state.districtStars = Sdk.load('districtStars', {}) || {};
  run.state.districtCleared = Sdk.load('districtCleared', {}) || {};
}

Sdk.ready();
Sdk.onAdStart(() => { if (phase === 'playing') pauseGame(true); });
Sdk.onAdEnd(() => { if (phase === 'paused') resumeGame(); });
audio.setMuted(muted);
ui.setMuted(muted);

bind();
syncDocumentLang();
ui.applyLang();
{
  const rt = $('rotate-text');
  const rb = $('btn-rotate-skip');
  if (rt) rt.textContent = t('rotateHint');
  if (rb) rb.textContent = t('rotateSkip');
}
renderDistrictPanel();
renderInvestPanel();
$('btn-mute').classList.toggle('is-muted', muted);
Sdk.track('load', {});
requestAnimationFrame(frame);
