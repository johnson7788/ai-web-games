// src/ui/screens.js — 标题 / 暂停 / 结算 / 设置 / 升级商店。
// 只负责搭 DOM 与填数；所有可见文案走 data-i18n，由 index.js 统一 applyLang。
import { t } from '../core/i18n.js';
import { TEA } from '../../config/tea.js';

function el(tag, className, html) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (html != null) n.innerHTML = html;
  return n;
}

function getOrCreate(root, id, className) {
  let n = root.querySelector('#' + id);
  if (!n) {
    n = document.createElement('div');
    n.id = id;
    root.appendChild(n);
  }
  n.className = className;
  return n;
}

const LANG_SELECT_HTML = '<select id="lang-select" class="lang-select" aria-label=""></select>';
const LANG_SELECT_PAUSE_HTML = '<select id="lang-select-pause" class="lang-select" aria-label=""></select>';
const LANG_SELECT_SETTINGS_HTML = '<select id="lang-select-settings" class="lang-select" aria-label=""></select>';

export function createScreens(root) {
  // ---- 标题屏 ----
  const title = getOrCreate(root, 'screen-title', 'screen');
  title.innerHTML =
    '<div class="title-inner">' +
      '<div class="title-logo" data-i18n="title.logo"></div>' +
      '<div class="title-tagline" data-i18n="title.tagline"></div>' +
      '<div class="title-best" id="title-best"></div>' +
      '<div class="title-actions">' +
        '<button id="btn-start" class="btn btn-primary" type="button" data-i18n="btn.start"></button>' +
        '<button id="btn-how" class="btn btn-ghost" type="button" data-tutorial-replay data-i18n="btn.how"></button>' +
        '<button id="btn-settings" class="btn btn-ghost" type="button" data-i18n="btn.settings"></button>' +
      '</div>' +
    '</div>' + LANG_SELECT_HTML;

  // ---- 暂停屏 ----
  const pause = getOrCreate(root, 'screen-pause', 'screen hidden');
  pause.innerHTML =
    '<div class="pause-inner">' +
      '<h2 class="pause-title" data-i18n="pause.title"></h2>' +
      '<div class="pause-hint" data-i18n="pause.hint"></div>' +
      '<div class="pause-actions">' +
        '<button id="btn-resume" class="btn btn-primary" type="button" data-i18n="btn.resume"></button>' +
        '<button id="btn-restart" class="btn btn-ghost" type="button" data-i18n="btn.restart"></button>' +
        '<button id="btn-how-pause" class="btn btn-ghost" type="button" data-tutorial-replay data-i18n="btn.how"></button>' +
      '</div>' +
    '</div>' + LANG_SELECT_PAUSE_HTML;

  // ---- 结算卡 ----
  const result = getOrCreate(root, 'screen-result', 'screen hidden');
  result.innerHTML =
    '<div class="result-inner">' +
      '<div class="result-title" data-i18n="result.title"></div>' +
      '<div class="result-badge hidden" id="result-new-record" data-i18n="result.newRecord"></div>' +
      '<ul class="result-rows">' +
        '<li><span data-i18n="result.days"></span><b id="res-days">0</b></li>' +
        '<li><span data-i18n="result.perfects"></span><b id="res-perfects">0</b></li>' +
        '<li><span data-i18n="result.fullhouse"></span><b id="res-fullhouse">0</b></li>' +
        '<li><span data-i18n="result.coins"></span><b id="res-coins">0</b></li>' +
        '<li><span data-i18n="result.rating"></span><b id="res-rating">—</b></li>' +
        '<li><span data-i18n="result.best"></span><b id="res-best">—</b></li>' +
      '</ul>' +
      '<div class="result-actions">' +
        '<button id="btn-again" class="btn btn-primary" type="button" data-i18n="btn.again"></button>' +
        '<button id="btn-share" class="btn btn-ghost" type="button" data-i18n="btn.share"></button>' +
      '</div>' +
      '<div class="result-hint" data-i18n="result.hint"></div>' +
    '</div>';

  // ---- 设置 ----
  const settings = getOrCreate(root, 'screen-settings', 'screen hidden');
  settings.innerHTML =
    '<div class="settings-inner">' +
      '<h2 class="settings-title" data-i18n="set.title"></h2>' +
      '<label class="settings-row"><span data-i18n="set.language"></span>' +
        '<select id="lang-select-settings" class="lang-select" aria-label=""></select>' +
      '</label>' +
      '<button id="btn-settings-back" class="btn btn-ghost" type="button" data-i18n="set.back"></button>' +
    '</div>';

  // ---- 升级商店 ----
  const shop = getOrCreate(root, 'screen-shop', 'screen hidden');
  shop.innerHTML =
    '<div class="shop-inner">' +
      '<h2 class="shop-title" data-i18n="shop.title"></h2>' +
      '<div class="shop-coins" id="shop-coins"></div>' +
      '<div class="shop-list" id="shop-list"></div>' +
      '<button id="btn-next-day" class="btn btn-primary" type="button" data-i18n="shop.next"></button>' +
    '</div>';

  const els = {
    title, pause, result, settings, shop,
    langSelects: [
      title.querySelector('.lang-select'),
      pause.querySelector('.lang-select'),
      settings.querySelector('.lang-select'),
    ],
    btnStart: title.querySelector('#btn-start'),
    btnHow: title.querySelector('#btn-how'),
    btnSettings: title.querySelector('#btn-settings'),
    btnResume: pause.querySelector('#btn-resume'),
    btnRestart: pause.querySelector('#btn-restart'),
    btnHowPause: pause.querySelector('#btn-how-pause'),
    btnAgain: result.querySelector('#btn-again'),
    btnShare: result.querySelector('#btn-share'),
    btnSettingsBack: settings.querySelector('#btn-settings-back'),
    btnNextDay: shop.querySelector('#btn-next-day'),
    titleBest: title.querySelector('#title-best'),
    newRecordBadge: result.querySelector('#result-new-record'),
    resDays: result.querySelector('#res-days'),
    resPerfects: result.querySelector('#res-perfects'),
    resFullhouse: result.querySelector('#res-fullhouse'),
    resCoins: result.querySelector('#res-coins'),
    resRating: result.querySelector('#res-rating'),
    resBest: result.querySelector('#res-best'),
    shopCoins: shop.querySelector('#shop-coins'),
    shopList: shop.querySelector('#shop-list'),
  };

  function setBest(best) {
    const b = best || {};
    els.titleBest.textContent = t('title.best', { days: b.days || 0, coins: b.coins || 0 });
  }

  function renderResult(data) {
    data = data || {};
    els.resDays.textContent = String(data.days ?? 0);
    els.resPerfects.textContent = String(data.perfects ?? 0);
    els.resFullhouse.textContent = String(data.fullHouses ?? 0);
    els.resCoins.textContent = String(data.coins ?? 0);
    els.resRating.textContent = t('rating.' + (data.rating || 'ok'));
    els.resBest.textContent = String(data.bestDays ?? 0);
    els.newRecordBadge.classList.toggle('hidden', !data.newRecord);
  }

  function renderShop(hud) {
    hud = hud || {};
    const coins = hud.coins ?? 0;
    const owned = new Set(hud.upgrades || []);
    els.shopCoins.textContent = t('shop.coins') + ': ' + coins;
    els.shopList.innerHTML = '';
    for (const u of TEA.upgrades) {
      const row = el('div', 'shop-item' + (owned.has(u.id) ? ' owned' : ''), '');
      const name = el('div', 'shop-item-name', '');
      name.textContent = t('up.' + u.id);
      const desc = el('div', 'shop-item-desc', '');
      desc.textContent = t('upDesc.' + u.id);
      const btn = el('button', 'btn btn-ghost shop-buy', '');
      btn.type = 'button';
      btn.dataset.upgrade = u.id;
      btn.textContent = owned.has(u.id) ? '✓' : t('shop.buy') + ' · ' + u.cost;
      btn.disabled = owned.has(u.id) || coins < u.cost;
      row.appendChild(name); row.appendChild(desc); row.appendChild(btn);
      els.shopList.appendChild(row);
    }
  }

  return {
    els,
    setBest,
    renderResult,
    renderShop,
  };
}
