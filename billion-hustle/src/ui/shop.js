// src/ui/shop.js — 底部成长条（技能升级 + 伙伴雇佣）+ 右侧风口押注面板。
// 交互回调由 index.js 注入；setHud(h) 每帧刷新文案/禁用态。不碰 sim、不读存档。
import { t } from '../core/i18n.js';
import { formatMoney } from '../game/sim.js';
import { UPGRADES, PARTNERS, SECTORS } from '../../config/gameplay.js';

function upgradeCost(id, level) {
  const u = UPGRADES.find((x) => x.id === id);
  return Math.floor(u.baseCost * Math.pow(u.costMult, level));
}

export function createShop(root) {
  // ---- 底部成长条 ----
  let shop = root.querySelector('#shop');
  if (!shop) {
    shop = document.createElement('div');
    shop.id = 'shop';
    root.appendChild(shop);
  }
  shop.className = 'shop hidden';

  const upBtns = UPGRADES.map((u) =>
    `<button id="up-${u.id}" class="up-btn" type="button" data-up="${u.id}"></button>`).join('');
  const partnerBtns = PARTNERS.map((p) =>
    `<button id="partner-${p.id}" class="partner-btn" type="button" data-partner="${p.id}"></button>`).join('');

  shop.innerHTML =
    '<div class="shop-inner">' +
      '<div class="shop-section">' +
        '<div class="shop-head" data-i18n="shop.upgrades"></div>' +
        upBtns +
      '</div>' +
      '<div class="shop-section partners">' +
        '<div class="shop-head" data-i18n="shop.partners"></div>' +
        partnerBtns +
      '</div>' +
    '</div>';

  // ---- 右侧风口押注面板 ----
  let wind = root.querySelector('#wind-panel');
  if (!wind) {
    wind = document.createElement('div');
    wind.id = 'wind-panel';
    root.appendChild(wind);
  }
  wind.className = 'wind-panel hidden';
  const sectorBtns = SECTORS.map((s, i) =>
    `<button id="sector-${i}" class="sector-btn" type="button" data-sector="${i}">` +
      '<i class="sector-dot"></i><span class="sector-name"></span>' +
      '<span class="sector-heat"><i class="sector-heat-fill"></i></span>' +
      '<span class="sector-bet-label"></span>' +
    '</button>').join('');
  wind.innerHTML =
    '<div class="mini-wheel-wrap"><div class="mini-wheel"></div><span class="mini-wheel-pointer"></span></div>' +
    '<div class="wind-head" data-i18n="windfall.bet"></div>' +
    '<div class="sector-list">' + sectorBtns + '</div>';

  const els = {
    shop,
    wind,
    upBtns: UPGRADES.map((u) => shop.querySelector(`#up-${u.id}`)),
    partnerBtns: PARTNERS.map((p) => shop.querySelector(`#partner-${p.id}`)),
    sectorBtns: SECTORS.map((s, i) => wind.querySelector(`#sector-${i}`)),
  };

  function setHud(h) {
    h = h || {};

    // 升级按钮
    for (const u of UPGRADES) {
      const btn = shop.querySelector(`#up-${u.id}`);
      const level = u.id === 'tap' ? (h.tapLevel ?? 0) : (h.autoLevel ?? 0);
      const cost = upgradeCost(u.id, level);
      btn.innerHTML =
        '<span class="btn-name">' + t(u.labelKey) + '</span>' +
        '<span class="btn-sub">' + t('up.level', { n: level }) + ' → ' + (u.id === 'tap' ? '¥' + formatMoney(u.base * Math.pow(u.mult, level + 1)) + '/tap' : '¥' + formatMoney(u.base * Math.pow(u.mult, level + 1)) + '/s') + '</span>' +
        '<span class="btn-cost">¥' + formatMoney(cost) + '</span>';
      btn.disabled = (h.cash ?? 0) < cost;
    }

    // 伙伴按钮
    for (const p of PARTNERS) {
      const btn = shop.querySelector(`#partner-${p.id}`);
      const owned = !!(h.partners && h.partners[p.id]);
      btn.innerHTML =
        '<span class="btn-name">' + t(p.labelKey) + '</span>' +
        '<span class="btn-sub">' + (owned ? '✓' : '+' + '¥' + formatMoney(p.income) + '/s') + '</span>' +
        '<span class="btn-cost">' + (owned ? '—' : '¥' + formatMoney(p.cost)) + '</span>';
      btn.disabled = owned || (h.cash ?? 0) < p.cost;
      btn.classList.toggle('owned', owned);
    }

    // 风口赛道按钮
    for (let i = 0; i < SECTORS.length; i += 1) {
      const s = SECTORS[i];
      const btn = wind.querySelector(`#sector-${i}`);
      if (!btn) continue;
      const si = h.sectors?.find((x) => x.id === s.id);
      const heat = Math.round(si?.heat ?? 0);
      const isBet = !!(si?.bet);
      const isHot = h.hotSector != null && si && h.hotSector === si.index;
      btn.querySelector('.sector-name').textContent = t(s.labelKey);
      btn.querySelector('.sector-heat-fill').style.width = heat + '%';
      btn.querySelector('.sector-bet-label').textContent = isBet ? '✓' : t('windfall.bet');
      btn.classList.toggle('bet', isBet);
      btn.classList.toggle('hot', isHot);
      btn.disabled = isBet || (h.bet != null && h.bet >= 0);
    }
  }

  function show() {
    shop.classList.remove('hidden');
    wind.classList.remove('hidden');
  }
  function hide() {
    shop.classList.add('hidden');
    wind.classList.add('hidden');
  }

  return { els, setHud, show, hide };
}
