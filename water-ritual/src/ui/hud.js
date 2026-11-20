// src/ui/hud.js — HUD：天 / 剩余单 / 心 / 金币 / 连击 + 订单票（茶型·客型·水温窗口·耐心）。
// 数据由 main 每帧喂入 setHud(run.getHud())；本文件不碰 sim、不读存档。
import { t } from '../core/i18n.js';

export function createHud(root) {
  let el = root.querySelector('#hud');
  if (!el) {
    el = document.createElement('div');
    el.id = 'hud';
    root.appendChild(el);
  }
  el.className = 'hud hidden';
  el.innerHTML =
    '<div class="hud-left">' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.day"></span><b id="hud-day">1</b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.target"></span><b id="hud-left">0</b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.hearts"></span><b id="hud-hearts">♥♥♥</b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.coins"></span><b id="hud-coins">0</b></div>' +
    '</div>' +
    '<div class="hud-center">' +
      '<div class="hud-zone" id="hud-zone"></div>' +
      '<div class="hud-rush hidden" id="hud-rush" data-i18n="hud.rush"></div>' +
    '</div>' +
    '<div class="hud-right" id="order-ticket">' +
      '<div class="ticket-title" data-i18n="order.title"></div>' +
      '<div class="ticket-row"><span id="ticket-guest">—</span><b id="ticket-tea">—</b></div>' +
      '<div class="ticket-row"><span data-i18n="order.temp"></span><b id="ticket-temp">—</b></div>' +
      '<div class="ticket-row"><span data-i18n="order.reward"></span><b id="ticket-reward">—</b></div>' +
      '<div class="ticket-patience"><i id="ticket-patience-fill"></i></div>' +
    '</div>';

  const dayEl = el.querySelector('#hud-day');
  const leftEl = el.querySelector('#hud-left');
  const heartsEl = el.querySelector('#hud-hearts');
  const coinsEl = el.querySelector('#hud-coins');
  const zoneEl = el.querySelector('#hud-zone');
  const rushEl = el.querySelector('#hud-rush');
  const ticket = el.querySelector('#order-ticket');
  const guestEl = el.querySelector('#ticket-guest');
  const teaEl = el.querySelector('#ticket-tea');
  const tempEl = el.querySelector('#ticket-temp');
  const rewardEl = el.querySelector('#ticket-reward');
  const patienceFill = el.querySelector('#ticket-patience-fill');

  return {
    el,
    setHud(h) {
      h = h || {};
      dayEl.textContent = String(h.day ?? 1);
      leftEl.textContent = String(Math.max(0, (h.dayTarget ?? 0) - (h.dayOrdersFilled ?? 0)));
      heartsEl.textContent = '♥'.repeat(Math.max(0, h.hearts ?? 0)) + '♡'.repeat(Math.max(0, (h.heartsMax ?? 3) - (h.hearts ?? 0)));
      coinsEl.textContent = String(h.coins ?? 0);
      zoneEl.textContent = t(h.sceneKey || 'scene.morning');
      rushEl.classList.toggle('hidden', !h.rushActive);

      const o = h.currentOrder;
      ticket.classList.toggle('hidden', !o);
      if (o) {
        guestEl.textContent = t(o.guestNameKey || 'guest.regular');
        teaEl.textContent = t(o.teaKey || 'tea.green');
        teaEl.style.color = o.teaColor || '#9adf9a';
        tempEl.textContent = Math.round(o.tempWindow[0]) + '–' + Math.round(o.tempWindow[1]) + '°C';
        rewardEl.textContent = '+' + (o.reward ?? 0);
        const ratio = Math.max(0, Math.min(1, (o.patience ?? 0) / (o.patienceMax || 1)));
        patienceFill.style.width = (ratio * 100).toFixed(1) + '%';
      }
    },
    show() { el.classList.remove('hidden'); },
    hide() { el.classList.add('hidden'); },
  };
}
