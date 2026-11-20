// src/ui/index.js — createUI 装配：标题/暂停/设置 + HUD + 产业面板 + 操作栏 + 股市横幅 + 引导。
// 契约：createUI(root, hooks) → { show, setHud, applyLang, onTutorial, els, tutorial, lang, dir, ... }
import { i18n, t, syncDocumentLang } from '../core/i18n.js';
import Sdk from '../core/sdk.js';
import { INDUSTRIES, formatMoney, formatInt } from '../../config/gameplay.js';
import { TutorialMachine, createTutorialOverlay, TUTORIAL_KEY, TUT_STEP_IDS } from './tutorial.js';

function el(tag, className, html) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (html != null) n.innerHTML = html;
  return n;
}

export function createUI(root, hooks = {}) {
  const noop = () => {};

  // ---------- 标题屏 ----------
  const title = el('div', 'screen is-active', '');
  title.id = 'screen-title';
  title.innerHTML =
    '<div class="title-inner">' +
      '<div class="title-logo" data-i18n="title.logo"></div>' +
      '<div class="title-tagline" data-i18n="title.tagline"></div>' +
      '<div class="title-best" id="title-best"></div>' +
      '<div class="title-actions">' +
        '<button id="btn-start" class="btn btn-primary" type="button" data-i18n="btn.start" data-i18n-aria="btn.start"></button>' +
        '<button id="btn-how" class="btn btn-ghost" type="button" data-tutorial-replay data-i18n="btn.how"></button>' +
        '<button id="btn-settings" class="btn btn-ghost" type="button" data-i18n="btn.settings"></button>' +
      '</div>' +
    '</div>' +
    '<select id="lang-select" class="lang-select" aria-label=""></select>';

  // ---------- 暂停屏 ----------
  const pause = el('div', 'screen hidden', '');
  pause.id = 'screen-pause';
  pause.innerHTML =
    '<div class="pause-inner">' +
      '<h2 class="pause-title" data-i18n="pause.title"></h2>' +
      '<div class="pause-hint" data-i18n="pause.hint"></div>' +
      '<div class="pause-actions">' +
        '<button id="btn-resume" class="btn btn-primary" type="button" data-i18n="btn.resume"></button>' +
        '<button id="btn-restart" class="btn btn-ghost" type="button" data-i18n="btn.restart"></button>' +
        '<button id="btn-how-pause" class="btn btn-ghost" type="button" data-tutorial-replay data-i18n="btn.how"></button>' +
      '</div>' +
    '</div>' +
    '<select id="lang-select-pause" class="lang-select" aria-label=""></select>';

  // ---------- 设置屏 ----------
  const settings = el('div', 'screen hidden', '');
  settings.id = 'screen-settings';
  settings.innerHTML =
    '<div class="settings-inner">' +
      '<h2 class="settings-title" data-i18n="set.title"></h2>' +
      '<label class="settings-row"><span data-i18n="set.language"></span>' +
        '<select id="lang-select-settings" class="lang-select" aria-label=""></select>' +
      '</label>' +
      '<button id="btn-settings-back" class="btn btn-ghost" type="button" data-i18n="set.back"></button>' +
    '</div>';

  // ---------- HUD ----------
  const hud = el('div', 'hud hidden', '');
  hud.id = 'hud';
  hud.innerHTML =
    '<div class="hud-left">' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.cash"></span><b id="hud-cash">$0</b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.networth"></span><b id="hud-networth">$0</b></div>' +
    '</div>' +
    '<div class="hud-center"><span class="hud-zone" id="hud-chapter" data-i18n="scene.0"></span></div>' +
    '<div class="hud-right">' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.income"></span><b id="hud-income">$0/s</b></div>' +
      '<div class="hud-stat" id="hud-debt-box"><span class="hud-label" data-i18n="hud.debt"></span><b id="hud-debt">$0</b></div>' +
    '</div>';

  // ---------- 产业面板 ----------
  const panel = el('div', 'panel', '');
  panel.id = 'panel';
  const panelTitle = el('div', 'panel-title', '');
  panelTitle.id = 'panel-title';
  const panelList = el('div', 'panel-list', '');
  panelList.id = 'panel-list';
  panel.appendChild(panelTitle);
  panel.appendChild(panelList);

  // ---------- 操作栏 ----------
  const actionbar = el('div', 'actionbar', '');
  actionbar.id = 'actionbar';
  actionbar.innerHTML =
    '<span id="goal" class="goal"></span>' +
    '<button id="btn-collect" class="btn btn-gold" type="button" data-i18n="btn.collect"></button>' +
    '<div class="stock-bet" id="stock-bet">' +
      '<span class="stock-bet-label" id="stock-bet-label"></span>' +
      '<button id="btn-allin-up" class="btn btn-up" type="button">▲</button>' +
      '<button id="btn-allin-down" class="btn btn-down" type="button">▼</button>' +
    '</div>' +
    '<button id="btn-loan" class="btn btn-ghost" type="button" data-i18n="btn.loan"></button>' +
    '<button id="btn-repay" class="btn btn-ghost" type="button" data-i18n="btn.repay"></button>';

  // ---------- 股市横幅 ----------
  const stockbar = el('div', 'stockbar hidden', '');
  stockbar.id = 'stockbar';
  stockbar.innerHTML = '<span id="stockbar-text"></span>';

  // ---------- 离线收益 ----------
  const offline = el('div', 'toast hidden', '');
  offline.id = 'offline';
  offline.innerHTML = '<div class="toast-card"><div class="toast-title" data-i18n="offline.title"></div><div class="toast-text" id="offline-text"></div><button id="btn-offline-close" class="btn btn-primary" type="button" data-i18n="btn.close"></button></div>';

  // ---------- 破产提示 ----------
  const bankrupt = el('div', 'toast hidden', '');
  bankrupt.id = 'bankrupt';
  bankrupt.innerHTML = '<div class="toast-card"><div class="toast-title danger" data-i18n="bankrupt.title"></div><div class="toast-text" data-i18n="bankrupt.hint"></div><button id="btn-bankrupt-close" class="btn btn-primary" type="button" data-i18n="btn.close"></button></div>';

  // ---------- 装入 root ----------
  [title, pause, settings, hud, panel, actionbar, stockbar, offline, bankrupt].forEach((n) => root.appendChild(n));

  // ---------- 教程 ----------
  const machine = new TutorialMachine({
    save: (k, v) => Sdk.save(k, v),
    load: (k, d) => Sdk.load(k, d),
    key: TUTORIAL_KEY,
  });
  const overlay = createTutorialOverlay(root, machine, {
    targets: { tap: '#canvas', buy: '#btn-buy-1', collect: '#btn-collect' },
  });

  const els = {
    title, pause, settings, hud, panel, panelList, actionbar, stockbar, offline, bankrupt,
    langSelects: [title.querySelector('#lang-select'), pause.querySelector('#lang-select-pause'), settings.querySelector('#lang-select-settings')],
    btnStart: title.querySelector('#btn-start'),
    btnHow: title.querySelector('#btn-how'),
    btnSettings: title.querySelector('#btn-settings'),
    btnResume: pause.querySelector('#btn-resume'),
    btnRestart: pause.querySelector('#btn-restart'),
    btnHowPause: pause.querySelector('#btn-how-pause'),
    btnSettingsBack: settings.querySelector('#btn-settings-back'),
    titleBest: title.querySelector('#title-best'),
    hudCash: hud.querySelector('#hud-cash'),
    hudNetworth: hud.querySelector('#hud-networth'),
    hudIncome: hud.querySelector('#hud-income'),
    hudDebt: hud.querySelector('#hud-debt'),
    hudDebtBox: hud.querySelector('#hud-debt-box'),
    hudChapter: hud.querySelector('#hud-chapter'),
    goal: actionbar.querySelector('#goal'),
    stockBet: actionbar.querySelector('#stock-bet'),
    stockBetLabel: actionbar.querySelector('#stock-bet-label'),
    btnCollect: actionbar.querySelector('#btn-collect'),
    btnAllInUp: actionbar.querySelector('#btn-allin-up'),
    btnAllInDown: actionbar.querySelector('#btn-allin-down'),
    btnLoan: actionbar.querySelector('#btn-loan'),
    btnRepay: actionbar.querySelector('#btn-repay'),
    stockbarText: stockbar.querySelector('#stockbar-text'),
    offlineText: offline.querySelector('#offline-text'),
    btnOfflineClose: offline.querySelector('#btn-offline-close'),
    btnBankruptClose: bankrupt.querySelector('#btn-bankrupt-close'),
    buyBtn: [], upgradeBtn: [], hireBtn: [],
  };

  let lastHud = null;
  let bestNetWorth = 0;
  let structKey = '';
  let tutorialDoneCb = null;

  // ---------- 语言 ----------
  function fillLang() {
    for (const sel of els.langSelects) {
      if (!sel) continue;
      sel.innerHTML = '';
      for (const opt of i18n.options()) {
        const o = document.createElement('option');
        o.value = opt.code;
        o.textContent = opt.name;
        if (opt.code === i18n.lang) o.selected = true;
        sel.appendChild(o);
      }
      sel.setAttribute('aria-label', t('set.language'));
    }
  }

  function applyLang() {
    syncDocumentLang();
    root.querySelectorAll('[data-i18n]').forEach((n) => { n.textContent = t(n.dataset.i18n); });
    root.querySelectorAll('[data-i18n-aria]').forEach((n) => { n.setAttribute('aria-label', t(n.dataset.i18nAria)); });
    fillLang();
    setBest(bestNetWorth);
    if (lastHud) setHud(lastHud);
    overlay.render();
  }

  function setBest(best) {
    bestNetWorth = Math.max(0, best || 0);
    els.titleBest.textContent = t('title.best', { worth: formatMoney(bestNetWorth) });
  }

  // ---------- 目标提示 ----------
  function updateGoal(h) {
    const next = h.industries.find((i) => i.unlocked && !i.owned);
    let text;
    if (next) {
      if (h.cash >= next.buyCost) text = t('act.buy') + ': ' + t(next.nameKey) + ' (' + formatMoney(next.buyCost) + ')';
      else text = t('act.tap') + ' → ' + t(next.nameKey) + ' (' + formatMoney(next.buyCost) + ')';
    } else if (h.industries.some((i) => i.owned && !i.manager)) {
      text = t('act.hire');
    } else {
      text = t('act.upgrade');
    }
    els.goal.textContent = '🎯 ' + text;
  }

  // ---------- 产业面板（结构变化才重建） ----------
  function buildPanel(hud) {
    const key = hud.industries.map((ind) => `${ind.owned}|${ind.unlocked}|${ind.level}|${ind.manager}`).join(',');
    if (key === structKey) return;
    structKey = key;
    els.buyBtn = [];
    els.upgradeBtn = [];
    els.hireBtn = [];
    els.panelList.innerHTML = '';
    hud.industries.forEach((ind) => {
      const row = el('div', 'ind-row' + (ind.owned ? ' owned' : '') + (ind.unlocked ? '' : ' locked'), '');
      const info = el('div', 'ind-info', '');
      const name = el('div', 'ind-name', '');
      name.dataset.i18n = ind.nameKey;
      const meta = el('div', 'ind-meta', '');
      const lvl = el('span', 'ind-level', '');
      const rate = el('span', 'ind-rate', '');
      meta.appendChild(lvl);
      meta.appendChild(rate);
      info.appendChild(name);
      info.appendChild(meta);
      row.appendChild(info);

      const actions = el('div', 'ind-actions', '');
      if (!ind.owned && ind.unlocked) {
        const b = el('button', 'btn btn-mini btn-buy', '');
        b.id = `btn-buy-${ind.index}`;
        b.type = 'button';
        b.dataset.i18n = 'btn.buy';
        b.dataset.i18nAria = 'btn.buy';
        els.buyBtn[ind.index] = b;
        actions.appendChild(b);
      }
      if (ind.owned) {
        const u = el('button', 'btn btn-mini btn-upgrade', '');
        u.id = `btn-upgrade-${ind.index}`;
        u.type = 'button';
        u.dataset.i18n = 'btn.upgrade';
        els.upgradeBtn[ind.index] = u;
        actions.appendChild(u);
        if (!ind.manager) {
          const h = el('button', 'btn btn-mini btn-hire', '');
          h.id = `btn-hire-${ind.index}`;
          h.type = 'button';
          h.dataset.i18n = 'btn.hire';
          els.hireBtn[ind.index] = h;
          actions.appendChild(h);
        }
      }
      row.appendChild(actions);
      els.panelList.appendChild(row);
      row._lvl = lvl;
      row._rate = rate;
    });
    applyLang();
  }

  function updatePanel(hud) {
    hud.industries.forEach((ind) => {
      const row = els.panelList.children[ind.index];
      if (!row) return;
      if (row._lvl) row._lvl.textContent = ind.owned ? 'Lv ' + ind.level : (ind.unlocked ? formatMoney(ind.buyCost) : '');
      if (row._rate) row._rate.textContent = ind.owned ? (ind.manager ? 'auto ' : '') + formatMoney(ind.rate) + '/s' : (ind.unlocked ? '' : '🔒');
      const buy = els.buyBtn[ind.index];
      if (buy) { buy.disabled = hud.cash < ind.buyCost; buy.title = t('act.buy'); }
      const up = els.upgradeBtn[ind.index];
      if (up) { up.disabled = hud.cash < ind.upgradeCost; up.title = t('act.upgrade'); }
      const hire = els.hireBtn[ind.index];
      if (hire) { hire.disabled = hud.cash < ind.managerCost; hire.title = t('act.hire'); }
    });
  }

  // ---------- HUD ----------
  function setHud(h) {
    lastHud = h;
    if (!h) return;
    buildPanel(h);
    els.hudCash.textContent = formatMoney(h.cash);
    els.hudNetworth.textContent = formatMoney(h.netWorth);
    els.hudIncome.textContent = formatMoney(h.incomePerSec) + '/s';
    els.hudDebt.textContent = formatMoney(h.debt);
    els.hudDebtBox.classList.toggle('hidden', h.debt <= 0);
    els.hudChapter.textContent = t(h.sceneKey);
    updateGoal(h);
    updatePanel(h);

    // 股市横幅 + 操作栏
    if (h.stock.betting) {
      els.stockbar.classList.remove('hidden');
      els.stockbarText.textContent = t('stock.day', { name: t(h.stock.targetName) }) + ' — ' + t('stock.allinHint');
      els.stockBet.classList.add('on');
      els.stockBetLabel.textContent = t('stock.title');
      els.btnAllInUp.disabled = false;
      els.btnAllInDown.disabled = false;
    } else if (h.stock.active) {
      els.stockbar.classList.remove('hidden');
      els.stockbarText.textContent = t('stock.day', { name: t(h.stock.targetName) }) + ': ' + (h.stock.up ? t('stock.up') : t('stock.down'));
      els.stockBet.classList.remove('on');
      els.btnAllInUp.disabled = true;
      els.btnAllInDown.disabled = true;
    } else {
      els.stockbar.classList.add('hidden');
      els.stockBet.classList.remove('on');
      els.btnAllInUp.disabled = true;
      els.btnAllInDown.disabled = true;
    }
    els.btnRepay.disabled = h.debt <= 0;
    els.btnLoan.disabled = h.debt > 0;
  }

  function showOffline(amount) {
    els.offlineText.textContent = t('offline.hint', { amount: formatMoney(amount) });
    els.offline.classList.remove('hidden');
  }
  function hideOffline() { els.offline.classList.add('hidden'); }

  function showBankrupt() {
    els.bankrupt.classList.remove('hidden');
    setTimeout(() => els.bankrupt.classList.add('hidden'), 3200);
  }

  // ---------- 屏幕切换 ----------
  function hideAll() {
    for (const key of ['title', 'pause', 'settings']) {
      els[key].classList.add('hidden');
    }
    hud.classList.add('hidden');
    panel.classList.add('hidden');
    actionbar.classList.add('hidden');
    stockbar.classList.add('hidden');
    overlay.hide();
  }

  function show(screen, data) {
    const isTitle = screen === 'title';
    const isPlaying = screen === 'playing';
    const isPaused = screen === 'paused';
    const isSettings = screen === 'settings';

    els.title.classList.toggle('hidden', !isTitle);
    els.pause.classList.toggle('hidden', !isPaused);
    els.settings.classList.toggle('hidden', !isSettings);

    if (isPlaying) {
      hud.classList.remove('hidden');
      panel.classList.remove('hidden');
      actionbar.classList.remove('hidden');
      if (!machine.done && !machine.active) machine.begin();
      if (machine.active) overlay.show();
    } else {
      hud.classList.add('hidden');
      panel.classList.add('hidden');
      actionbar.classList.add('hidden');
      stockbar.classList.add('hidden');
      overlay.hide();
    }

    if (isTitle || isSettings) applyLang();
  }

  function finishTutorial(result) {
    overlay.hide();
    if (tutorialDoneCb) {
      try { tutorialDoneCb(result); } catch { /* noop */ }
    }
  }
  machine.onDone = finishTutorial;

  function onTutorial(cb) { tutorialDoneCb = cb || null; }

  // ---------- 事件 ----------
  for (const sel of els.langSelects) {
    if (!sel) continue;
    sel.addEventListener('change', (e) => { if (i18n.setLang(e.target.value)) applyLang(); });
  }
  els.btnSettings.addEventListener('click', () => show('settings'));
  els.btnSettingsBack.addEventListener('click', () => show('title'));

  const replay = () => {
    machine.replay();
    overlay.show();
    if (typeof hooks.onHow === 'function') hooks.onHow();
  };
  els.btnHow.addEventListener('click', replay);
  els.btnHowPause.addEventListener('click', replay);

  els.btnStart.addEventListener('click', () => (hooks.onStart || noop)());
  els.btnResume.addEventListener('click', () => (hooks.onResume || noop)());
  els.btnRestart.addEventListener('click', () => (hooks.onRestart || noop)());
  els.btnSettingsBack.addEventListener('click', () => show('title'));
  els.btnOfflineClose.addEventListener('click', hideOffline);
  els.btnBankruptClose.addEventListener('click', () => els.bankrupt.classList.add('hidden'));

  applyLang();

  return {
    show, setHud, applyLang, onTutorial, hideAll, setBest,
    showOffline, hideOffline, showBankrupt,
    els,
    tutorial: {
      machine,
      overlay,
      get active() { return machine.active; },
      get step() { return machine.step; },
      get steps() { return TUT_STEP_IDS; },
      get current() { return machine.currentId; },
      begin: () => machine.begin(),
      replay,
      skip: () => machine.skip(),
      onGameEvent: (ev, now) => {
        const s = machine.onGameEvent(ev, now);
        overlay.render();
        return s;
      },
      tick: (now) => machine.tick(now),
      state: () => machine.snapshot(),
    },
    get lang() { return i18n.lang; },
    get dir() { return i18n.dir; },
  };
}

export default createUI;
