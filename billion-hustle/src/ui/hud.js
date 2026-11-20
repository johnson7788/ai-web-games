// src/ui/hud.js — 顶部 HUD：现金 / 估值（翻牌脉冲）/ 收入 / 融资轮进度 / 烧钱按钮 / 风口倒计时。
// 数据由 main 每帧喂入 setHud(run.getHud())；本文件不碰 sim、不读存档。
import { t } from '../core/i18n.js';
import { formatMoney, formatMoneyFull } from '../game/sim.js';

export function createHud(root) {
  let el = root.querySelector('#hud');
  if (!el) {
    el = document.createElement('div');
    el.id = 'hud';
    root.appendChild(el);
  }
  el.className = 'hud hidden';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML =
    '<div class="hud-strip">' +
      '<div class="hud-group">' +
        '<div class="hud-stat"><span class="hud-label" data-i18n="hud.cash"></span><b id="hud-cash">¥0</b></div>' +
        '<div class="hud-stat valuation"><span class="hud-label" data-i18n="hud.valuation"></span><b id="hud-valuation">¥0</b></div>' +
        '<div class="hud-stat"><span class="hud-label" data-i18n="hud.income"></span><b id="hud-income">¥0</b><i class="hud-unit">/s</i><span id="hud-mult" class="hud-mult"></span></div>' +
      '</div>' +
      '<div class="hud-center">' +
        '<div class="hud-round" id="hud-round"></div>' +
        '<div class="round-track"><i class="round-fill" id="round-fill"></i></div>' +
      '</div>' +
      '<div class="hud-group right">' +
        '<div class="wind-badge" id="wind-badge"></div>' +
        '<button id="btn-burn" class="burn-btn" type="button"></button>' +
      '</div>' +
    '</div>';

  const cashEl = el.querySelector('#hud-cash');
  const valEl = el.querySelector('#hud-valuation');
  const incomeEl = el.querySelector('#hud-income');
  const multEl = el.querySelector('#hud-mult');
  const roundEl = el.querySelector('#hud-round');
  const fillEl = el.querySelector('#round-fill');
  const windEl = el.querySelector('#wind-badge');
  const burnEl = el.querySelector('#btn-burn');

  function roundName(key) {
    const text = t(key);
    return text !== key ? text : '';
  }

  return {
    el,
    btnBurn: burnEl,
    flashValuation() {
      valEl.classList.remove('flip-pulse');
      void valEl.offsetWidth;
      valEl.classList.add('flip-pulse');
    },
    setHud(h) {
      h = h || {};
      cashEl.textContent = '¥' + formatMoney(h.cash ?? 0);
      valEl.textContent = '¥' + formatMoneyFull(h.valuation ?? 0);
      incomeEl.textContent = '¥' + formatMoney(h.incomePerSec ?? 0);
      multEl.textContent = (h.mult ?? 1) > 1 ? t('hud.mult', { mult: h.mult }) : '';
      multEl.classList.toggle('on', (h.mult ?? 1) > 1);
      roundEl.textContent = roundName(h.roundName || 'round.seed');
      fillEl.style.width = Math.min(100, ((h.roundProgress ?? 0) * 100)).toFixed(1) + '%';

      // 风口徽章
      if (h.windfallActive) {
        windEl.textContent = t('windfall.active');
        windEl.classList.add('hot');
        windEl.classList.remove('cool');
      } else if (h.hotSector != null && h.hotSector >= 0) {
        windEl.textContent = t('windfall.hot', { sector: t('sector.' + (h.sectors?.[h.hotSector]?.id || 'ai')) });
        windEl.classList.add('hot');
        windEl.classList.remove('cool');
      } else {
        windEl.textContent = t('windfall.next', { n: Math.ceil(h.windfallCycleRemaining ?? 0) });
        windEl.classList.remove('hot');
        windEl.classList.add('cool');
      }

      // 烧钱按钮
      if (h.burnActive) {
        burnEl.textContent = '×2 ' + Math.ceil(h.burnActiveRemaining ?? 0) + 's';
        burnEl.classList.add('active');
        burnEl.classList.remove('cool');
      } else if (h.burnCooldownRemaining > 0) {
        burnEl.textContent = t('burn.cd') + ' ' + Math.ceil(h.burnCooldownRemaining ?? 0) + 's';
        burnEl.classList.remove('active');
        burnEl.classList.add('cool');
      } else {
        burnEl.textContent = t('burn.on');
        burnEl.classList.remove('active');
        burnEl.classList.remove('cool');
      }
    },
    show() { el.classList.remove('hidden'); el.setAttribute('aria-hidden', 'false'); },
    hide() { el.classList.add('hidden'); el.setAttribute('aria-hidden', 'true'); },
  };
}
