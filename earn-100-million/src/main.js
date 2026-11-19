// 主入口：标题 → 游戏（回合制经营）→ 结算 + 教程引导 + SDK + 调试契约。
// sim(纯逻辑) / render(canvas 氛围) / ui(DOM) / audio(WebAudio) 装配。
import { ECONOMY } from '../config/game.config.js';
import { GOODS, COMPANIES, HOUSES, CARS, MATES, SKILLS } from '../config/data.js';
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
let phase = 'title';
let lastTime = performance.now();
let tutorialStep = -1;

const view = { flash: 0, toastTimer: null };

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let tutorialDone = !!Sdk.load('tutorialDone', false);
let bestStars = Sdk.load('bestStars', 0) | 0;
let skillPoints = Sdk.load('skillPoints', 0) | 0;
let skillLevels = Sdk.load('skillLevels', {}) || {};

Sdk.ready(); // 不 await，不阻塞首屏
audio.setMuted(muted);
ui.setMuted(muted);

function persist() {
  Sdk.save('muted', muted);
  Sdk.save('tutorialDone', tutorialDone);
  Sdk.save('bestStars', bestStars);
  Sdk.save('skillPoints', skillPoints);
  Sdk.save('skillLevels', skillLevels);
}

// ---------- 工具 ----------
const fmt = (n) => {
  n = Math.floor(n || 0);
  const s = String(n);
  let out = '';
  for (let i = s.length - 1, j = 1; i >= 0; i -= 1, j += 1) {
    out = s[i] + (j % 3 === 0 && i !== 0 ? ',' : '') + out;
  }
  return out;
};
const compact = (n) => {
  n = n || 0;
  if (n >= 100000000) return (n / 1000000).toFixed(0) + 'M';
  if (n >= 10000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 10000) return (n / 1000).toFixed(0) + 'K';
  return fmt(n);
};

function toast(msg, ms = 2200) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  if (view.toastTimer) clearTimeout(view.toastTimer);
  view.toastTimer = setTimeout(() => el.classList.add('hidden'), ms);
}

function goodById(id) { return run.state.goods.find((g) => g.id === id); }
function tierClass(tier) { return tier === 0 ? 'low' : tier === 1 ? 'mid' : 'high'; }
function tierName(tier) { return tier === 0 ? t('tierLow') : tier === 1 ? t('tierMid') : t('tierHigh'); }

// ---------- 阶段状态机 ----------
function setPhase(p) { phase = p; }

function startGame() {
  run = createRun({ seed: (Date.now() % 2147483647) || 1, skillLevels, skillPoints });
  setPhase('playing');
  ui.showGame();
  ui.hideResult();
  $('board').classList.remove('hidden');
  $('event-modal').classList.add('hidden');
  renderPanels();
  updateHud();
  audio.startBgm();
  Sdk.newRun({});
  Sdk.track('start', {});
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
  startGame();
}
function goHome() {
  run = null;
  setPhase('title');
  ui.showTitle();
  $('board').classList.add('hidden');
  $('event-modal').classList.add('hidden');
  audio.stopBgm();
  renderTitleBest();
}

// ---------- HUD ----------
function updateHud() {
  if (!run) return;
  const h = run.getHud();
  $('hud-cash').textContent = '$' + compact(h.cash);
  $('hud-assets').textContent = '$' + compact(h.assets);
  $('hud-age').textContent = h.age + '/' + h.retireAge;
  $('hud-hp').textContent = h.hp;
  $('hud-rep').textContent = h.reputation;
  $('hud-wh').textContent = h.warehouseUsed + '/' + h.warehouseCap;
  const pct = Math.min(100, (h.assets / ECONOMY.GOAL) * 100);
  $('goal-fill').style.width = pct.toFixed(1) + '%';
  const mood = $('hud-mood');
  mood.textContent = h.marketMood === 1 ? t('marketBull') : h.marketMood === -1 ? t('marketBear') : t('marketNeutral');
  mood.className = 'mood-pill' + (h.marketMood === 1 ? ' bull' : h.marketMood === -1 ? ' bear' : '');
  const combo = $('hud-combo');
  if (h.combo > 0) { combo.textContent = t('flowCombo') + h.combo; combo.classList.remove('hidden'); }
  else combo.classList.add('hidden');
}

// ---------- 面板渲染 ----------
function renderPanels() {
  renderMarket();
  renderInventory();
  renderCompanies();
  renderHouses();
  renderCars();
  renderMates();
  renderSkills();
}

function card(name, price, opts = {}) {
  const el = document.createElement('div');
  el.className = 'card';
  const nm = document.createElement('div');
  nm.className = 'name';
  nm.textContent = name;
  el.appendChild(nm);
  const pr = document.createElement('div');
  pr.className = 'price' + (opts.tierClass ? ' ' + opts.tierClass : '');
  pr.textContent = price;
  el.appendChild(pr);
  if (opts.sub) {
    const s = document.createElement('div');
    s.className = 'sub';
    s.textContent = opts.sub;
    el.appendChild(s);
  }
  return el;
}

function btn(label, cls, fn) {
  const b = document.createElement('button');
  b.textContent = label;
  if (cls) b.className = cls;
  b.addEventListener('click', () => { audio.unlock(); audio.sfx('click'); fn(); });
  return b;
}

function renderMarket() {
  const list = $('market-list');
  list.innerHTML = '';
  for (const id of run.state.shownIds) {
    const g = goodById(id);
    const data = GOODS.find((x) => x.id === id);
    const el = card(t('good_' + data.key), '$' + compact(g.marketPrice), { tierClass: tierClass(g.tier) });
    const tag = document.createElement('span');
    tag.className = 'tier-tag ' + tierClass(g.tier);
    tag.textContent = tierName(g.tier);
    el.insertBefore(tag, el.firstChild);
    const row = document.createElement('div');
    row.className = 'row';
    row.appendChild(btn(t('buy') + ' 1', 'primary', () => act('buy', run.buyGoods(id, 1))));
    row.appendChild(btn(t('buy') + ' 10', '', () => act('buy', run.buyGoods(id, 10))));
    el.appendChild(row);
    list.appendChild(el);
  }
}

function renderInventory() {
  const list = $('inventory-list');
  list.innerHTML = '';
  let any = false;
  for (const g of run.state.goods) {
    if (g.ownNum <= 0) continue;
    any = true;
    const data = GOODS.find((x) => x.id === g.id);
    const shown = run.state.shownIds.includes(g.id);
    const cur = shown ? g.marketPrice : g.buyPrice;
    const el = card(t('good_' + data.key), '$' + compact(cur), { sub: t('cash') + ' x' + g.ownNum + ' · avg $' + compact(g.buyPrice) });
    const qty = document.createElement('div');
    qty.className = 'owned-qty';
    qty.textContent = 'x' + g.ownNum;
    el.insertBefore(qty, el.firstChild);
    const row = document.createElement('div');
    row.className = 'row';
    row.appendChild(btn(t('sell') + ' 1', 'warn', () => act('sell', run.sellGoods(g.id, 1))));
    row.appendChild(btn(t('sellAll'), '', () => act('sell', run.sellGoods(g.id, g.ownNum))));
    el.appendChild(row);
    list.appendChild(el);
  }
  if (!any) {
    const empty = document.createElement('div');
    empty.className = 'sub';
    empty.textContent = '—';
    list.appendChild(empty);
  }
}

function renderCompanies() {
  const list = $('company-list');
  list.innerHTML = '';
  for (const c of run.state.companies) {
    const data = COMPANIES.find((x) => x.id === c.id);
    const owned = c.shares > 0;
    const locked = owned && c.lockYears > 0;
    const sub = t('dividend') + ' ' + (data.dividend * 100).toFixed(0) + '% · ' + (owned ? (locked ? t('lockedYears') + ' ' + c.lockYears : 'x' + (c.shares / 100)) : '');
    const el = card(t('co_' + data.key), '$' + c.sharePrice.toFixed(2), { sub });
    const row = document.createElement('div');
    row.className = 'row';
    if (!owned) {
      row.appendChild(btn(t('createCompany') + ' ($' + compact(100 * data.sharePrice) + ')', 'primary', () => act('company', run.createCompany(c.id))));
    } else if (locked) {
      const lockEl = document.createElement('span');
      lockEl.className = 'sub';
      lockEl.textContent = t('lockedYears') + ' ' + c.lockYears;
      row.appendChild(lockEl);
    } else {
      row.appendChild(btn(t('buyStock') + ' ($' + compact(100 * c.sharePrice) + ')', 'primary', () => act('stockBuy', run.buyStock(c.id, 1))));
      row.appendChild(btn(t('sellStock'), 'warn', () => act('stockSell', run.sellStock(c.id, 1))));
    }
    el.appendChild(row);
    list.appendChild(el);
  }
}

function renderHouses() {
  const list = $('house-list');
  list.innerHTML = '';
  for (const h of run.state.houses) {
    const data = HOUSES.find((x) => x.id === h.id);
    const el = card(t('house_' + data.key), '$' + compact(data.price), { sub: t('rep') + ' +' + data.rep + ' · ' + t('health') + ' +' + data.hp });
    if (h.ownNum > 0) {
      const qty = document.createElement('div');
      qty.className = 'owned-qty';
      qty.textContent = 'x' + h.ownNum;
      el.insertBefore(qty, el.firstChild);
    }
    const row = document.createElement('div');
    row.className = 'row';
    row.appendChild(btn(t('buyHouse'), 'primary', () => act('house', run.buyHouse(h.id))));
    if (h.ownNum > 0) row.appendChild(btn(t('sellAsset'), 'warn', () => act('houseSell', run.sellHouse(h.id))));
    el.appendChild(row);
    list.appendChild(el);
  }
}

function renderCars() {
  const list = $('car-list');
  list.innerHTML = '';
  for (const c of run.state.cars) {
    const data = CARS.find((x) => x.id === c.id);
    const el = card(t('car_' + data.key), '$' + compact(data.price), { sub: t('rep') + ' +' + data.rep });
    if (c.ownNum > 0) {
      const qty = document.createElement('div');
      qty.className = 'owned-qty';
      qty.textContent = 'x' + c.ownNum;
      el.insertBefore(qty, el.firstChild);
    }
    const row = document.createElement('div');
    row.className = 'row';
    row.appendChild(btn(t('buyCar'), 'primary', () => act('car', run.buyCar(c.id))));
    if (c.ownNum > 0) row.appendChild(btn(t('sellAsset'), 'warn', () => act('carSell', run.sellCar(c.id))));
    el.appendChild(row);
    list.appendChild(el);
  }
}

function renderMates() {
  const list = $('mate-list');
  list.innerHTML = '';
  for (const m of run.state.mates) {
    const data = MATES.find((x) => x.id === m.id);
    const ladder = data.love;
    const cur = ladder[m.level] || ladder[ladder.length - 1];
    const cost = Math.max(0, Math.floor(cur[2]));
    let sub = t('lovePoint') + ': ' + m.love + '/100';
    if (m.married) sub = t('married');
    else if (m.level === 5) sub += ' · ' + t('marry') + '?';
    else sub += ' · ' + t('date') + ' $' + fmt(cost);
    const el = card(t('mate_' + data.key), m.married ? '♥' : '♡', { sub });
    const row = document.createElement('div');
    row.className = 'row';
    if (m.married) {
      row.appendChild(btn(t('divorce'), 'warn', () => act('divorce', run.divorce(m.id))));
    } else {
      row.appendChild(btn(t('date'), 'primary', () => act('date', run.date(m.id))));
    }
    el.appendChild(row);
    list.appendChild(el);
  }
}

function renderSkills() {
  $('skill-points').textContent = fmt(skillPoints) + ' ' + t('skillPoints');
  const list = $('skill-list');
  list.innerHTML = '';
  const groups = {};
  for (const s of SKILLS) (groups[s.group] = groups[s.group] || []).push(s);
  for (const gid of [1, 2, 3, 4]) {
    const g = document.createElement('div');
    g.className = 'skill-group';
    const h = document.createElement('h4');
    h.textContent = t('market') + ' · ' + gid;
    g.appendChild(h);
    for (const s of groups[gid] || []) {
      const lv = skillLevels[`${s.id}:${s.subId}`] || 0;
      const row = document.createElement('div');
      row.className = 'skill-row';
      const name = document.createElement('span');
      name.textContent = t('sk_' + s.key) + ' ';
      const lvspan = document.createElement('span');
      lvspan.className = 'lv';
      lvspan.textContent = 'Lv' + lv;
      row.appendChild(name);
      row.appendChild(lvspan);
      if (lv < 5) {
        const cost = s.cost[lv][2];
        const b = btn(t('upgrade') + ' ' + cost, '', () => act('skill', doUpgradeSkill(s.id, s.subId)));
        row.appendChild(b);
      }
      g.appendChild(row);
    }
    list.appendChild(g);
  }
}

function doUpgradeSkill(id, subId) {
  if (run) run.state.skillPoints = skillPoints;
  const res = run ? run.upgradeSkill(id, subId) : { ok: false };
  if (res.ok) skillPoints = run.state.skillPoints;
  return res;
}

// ---------- 动作 ----------
function act(kind, res) {
  if (!run || phase !== 'playing') return;
  if (res.ok) {
    if (kind === 'buy' || kind === 'sell') updateHud();
    handleEvents(run.drainEvents());
    if (kind === 'skill') { skillPoints = run.state.skillPoints; persist(); }
    renderPanels();
    updateHud();
  } else {
    const reason = res.reason || '';
    if (reason === 'money') toast(t('noMoney'));
    else if (reason === 'space') toast(t('noSpace'));
    else if (reason === 'locked') toast(t('lockedYears'));
    else if (reason === 'hasCompany') toast(t('createCompany'));
    else if (reason === 'cond') toast(t('noMoney'));
    else if (reason === 'healthy') toast(t('inHospital'));
    else if (reason === 'event') toast('');
    else if (reason === 'notShown') toast('');
  }
}

// ---------- 事件消费 ----------
function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type);
    switch (ev.type) {
      case 'year':
        view.flash = 1;
        toast(t('year') + ' ' + ev.age);
        break;
      case 'event':
        showEventModal();
        break;
      case 'eventResult':
        break;
      case 'hospital':
        toast(t('hospitalEvent'), 3000);
        break;
      case 'bankrupt':
        toast(t('bankruptEvent'), 3000);
        break;
      case 'profit':
        toast(t('flowCombo') + run.state.combo, 1200);
        break;
      case 'milestone':
        toast(ev.tier === 1 ? t('million') : ev.tier === 2 ? t('tenMillion') : t('hundredMillion'), 2400);
        break;
      case 'win':
        finishRun('won');
        break;
      case 'retire':
        finishRun('retired');
        break;
      case 'marry':
        toast(t('married'), 2000);
        break;
      case 'dividend':
        toast(t('dividend') + ' +$' + fmt(ev.amount), 1800);
        break;
      default:
        break;
    }
  }
}

function showEventModal() {
  if (!run || !run.state.pendingEvent) return;
  const ev = run.state.pendingEvent;
  $('event-text').textContent = t('evt' + ev);
  $('event-modal').classList.remove('hidden');
}

function answerEvent(choice) {
  if (!run) return;
  run.answerEvent(choice);
  $('event-modal').classList.add('hidden');
  handleEvents(run.drainEvents());
  renderPanels();
  updateHud();
}

// ---------- 结算 ----------
function finishRun(kind) {
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  const s = run.state.summary || {};
  const won = kind === 'won';
  if (won || s.stars > bestStars) { bestStars = Math.max(bestStars, s.stars); }
  // 结算技能点（基于资产与名声）
  const asset = Math.floor(run.state.assets / 10000);
  let sp = 0;
  if (asset > 100 && asset <= 999) sp = Math.floor(asset / 100) * 10;
  else if (asset >= 1000 && asset <= 9999) sp = 90 + Math.floor(asset / 500) * 10;
  else if (asset >= 10000 && asset <= 99999) sp = 300 + Math.floor(asset / 5000) * 10;
  else if (asset >= 100000) sp = 500;
  const repSp = asset >= 100 ? Math.min(500, Math.floor(run.state.reputation / 2)) : 0;
  skillPoints += sp + repSp;
  persist();
  Sdk.track(won ? 'win' : 'fail', { stars: s.stars, assets: run.state.assets });
  if (won) Sdk.levelCleared({ stars: s.stars }); else Sdk.gameOver({ stars: s.stars });

  $('board').classList.add('hidden');
  $('result-title').textContent = won ? t('winTitle') : t('retireTitle');
  $('result-stars').textContent = '★'.repeat(s.stars) + '☆'.repeat(5 - s.stars);
  const lines = [];
  lines.push(t('finalAssets') + ': $' + compact(s.assets));
  lines.push(t('peakAssets') + ': $' + compact(s.highAssets));
  lines.push(t('stars') + ': ' + '★'.repeat(s.stars));
  lines.push(t('skillPoints') + ': +' + (sp + repSp));
  if (s.marriedAge) lines.push(t('marriedAt') + ' ' + s.marriedAge);
  if (s.foundedAge) lines.push(t('foundedAt') + ' ' + s.foundedAge);
  $('result-meta').textContent = lines.join('\n');
  ui.showResult();
}

// ---------- 教程 ----------
const TUT_STEPS = () => [
  { text: t('tutStep1'), spot: 'market' },
  { text: t('tutStep2'), spot: 'inventory' },
  { text: t('tutStep3'), spot: 'nextYear' },
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
  const spot = $('tut-spotlight');
  spot.style.display = 'none';
  const cardEl = $('tut-card');
  cardEl.style.left = '';
  cardEl.style.top = '';
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

// ---------- 输入绑定 ----------
function bind() {
  ui.init();
  const on = (id, fn) => { const el = $(id); if (el) el.addEventListener('click', () => { audio.unlock(); fn(); }); };
  on('btn-start', startGame);
  on('btn-resume', resumeGame);
  on('btn-restart', restartGame);
  on('btn-retry', restartGame);
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-next-year', () => { if (run && phase === 'playing') { const res = run.nextYear(); handleEvents(run.drainEvents()); renderPanels(); updateHud(); } });
  on('btn-retire-now', () => { if (run && phase === 'playing') { run.retireNow(); handleEvents(run.drainEvents()); } });
  on('btn-event-y', () => answerEvent('Y'));
  on('btn-event-n', () => answerEvent('N'));
  on('btn-treat', () => act('treat', run.treat()));
  on('btn-bet', () => act('bet', run.bet()));
  on('btn-mute', toggleMute);
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result') startTutorial(); });
  on('btn-howto-title', () => { if (phase === 'title') startTutorial(); });
  on('btn-rotate-skip', () => { const rs = $('rotate-screen'); if (rs) rs.style.display = 'none'; });

  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = $(id);
    if (!sel) continue;
    sel.addEventListener('change', () => {
      ui.setLang(sel.value);
      renderTutorialStep();
      if (run) { renderPanels(); updateHud(); }
      renderTitleBest();
      $('rotate-text').textContent = t('rotateHint');
    });
  }

  document.querySelectorAll('#tabs .tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#tabs .tab').forEach((x) => x.classList.remove('is-active'));
      document.querySelectorAll('.panel').forEach((x) => x.classList.remove('is-active'));
      tab.classList.add('is-active');
      $('panel-' + tab.dataset.tab).classList.add('is-active');
    });
  });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (phase === 'playing') pauseGame();
      else if (phase === 'paused') resumeGame();
    }
    if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'result')) restartGame();
    if (e.code === 'KeyM') toggleMute();
    if (e.code === 'Space' && phase === 'playing') { e.preventDefault(); run.nextYear(); handleEvents(run.drainEvents()); renderPanels(); updateHud(); }
  });
}

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  ui.setMuted(muted);
  $('btn-mute').textContent = muted ? '🔇' : '🔊';
  persist();
}

function renderTitleBest() {
  $('title-text').textContent = t('title');
  $('subtitle-text').textContent = t('subtitle');
  $('title-best').textContent = bestStars > 0 ? '★'.repeat(bestStars) + '☆'.repeat(5 - bestStars) : '';
}

// ---------- 主循环 ----------
function frame(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;
  if (phase === 'playing' && run) {
    if (view.flash > 0) view.flash = Math.max(0, view.flash - dt * 2.2);
  } else if (view.flash > 0) {
    view.flash = Math.max(0, view.flash - dt * 2.2);
  }
  renderer.draw(run ? run.state : null, dt, view);
  requestAnimationFrame(frame);
}

// ---------- 调试契约 ----------
window.__ll = {
  state: {
    get phase() { return phase; },
    get lang() { return i18n.lang; },
  },
  get run() { return run; },
  start: () => startGame(),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => restartGame(),
  home: () => goHome(),
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['buy', 'sell', 'year']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
  },
  startTutorial: () => startTutorial(),
  save: (k, v) => Sdk.save(k, v),
  load: (k, d) => Sdk.load(k, d),
  share: (p) => Sdk.share(p),
  ui: () => ui,
  debug: {
    state: () => (run ? { ...run.state } : null),
    hud: () => (run ? run.getHud() : null),
    setAssets: (n) => { if (run) { run.state.cash = n; run.state.goods.forEach((g) => { g.ownNum = 0; }); run.nextYear(); run.state._events = []; return true; } },
    retireNow: () => { if (run) { run.retireNow(); handleEvents(run.drainEvents()); return true; } return false; },
    winNow: () => { if (run) { run.state.cash = ECONOMY.GOAL + 1; run.nextYear(); handleEvents(run.drainEvents()); return true; } return false; },
    setAge: (n) => { if (run) run.state.age = n; return true; },
  },
};

// ---------- 启动 ----------
bind();
syncDocumentLang();
ui.applyLang();
renderTitleBest();
$('rotate-text').textContent = t('rotateHint');
$('btn-mute').textContent = muted ? '🔇' : '🔊';
Sdk.track('load', {});
requestAnimationFrame(frame);
