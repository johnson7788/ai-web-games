// src/ui/hud.js — HUD：圈数 / 名次 / 速度 / 糖霜漂移三档 / 道具槽。
// 数据由 main 每帧喂入 setHud(run.getHud())；本文件不碰 sim、不读存档。
import { t } from '../core/i18n.js';

function rankLabel(n) {
  const suffix = n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th';
  return `${n}${suffix}`;
}

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
    '<div class="hud-left">' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.lap"></span><b id="hud-lap">1/3</b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.pos"></span><b id="hud-pos">1st</b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.speed"></span><b id="hud-speed">0</b><i class="hud-unit">km/h</i></div>' +
      '<div class="lap-bar"><i class="lap-bar-fill" id="lap-bar-fill"></i></div>' +
    '</div>' +
    '<div class="hud-right">' +
      '<div class="drift-meter" id="drift-meter">' +
        '<div class="drift-track"><i class="drift-fill" id="drift-fill"></i><i class="drift-t1"></i><i class="drift-t2"></i></div>' +
        '<span class="drift-label" data-i18n="hud.drift"></span>' +
      '</div>' +
      '<div class="hud-item" id="hud-item"><span class="hud-label" data-i18n="hud.item"></span><b id="hud-item-name">—</b></div>' +
    '</div>';

  const lapEl = el.querySelector('#hud-lap');
  const posEl = el.querySelector('#hud-pos');
  const speedEl = el.querySelector('#hud-speed');
  const fillEl = el.querySelector('#drift-fill');
  const itemEl = el.querySelector('#hud-item');
  const itemNameEl = el.querySelector('#hud-item-name');
  const lapBarEl = el.querySelector('#lap-bar-fill');

  function itemName(item) {
    if (!item) return t('hud.itemNone');
    return t('hud.item.' + item);
  }

  return {
    el,
    setHud(h) {
      h = h || {};
      lapEl.textContent = `${Math.max(1, Math.min(h.totalLaps, (h.lap || 0) + 1))}/${h.totalLaps}`;
      posEl.textContent = rankLabel(h.pos || 1);
      speedEl.textContent = String(Math.round(h.speed || 0));
      fillEl.style.width = (Math.min(1, Math.max(0, h.driftCharge || 0)) * 100).toFixed(1) + '%';
      lapBarEl.style.width = (Math.min(1, Math.max(0, h.lapProgress || 0)) * 100).toFixed(1) + '%';
      itemEl.classList.toggle('has-item', !!h.item);
      itemNameEl.textContent = itemName(h.item);
    },
    show() { el.classList.remove('hidden'); el.setAttribute('aria-hidden', 'false'); },
    hide() { el.classList.add('hidden'); el.setAttribute('aria-hidden', 'true'); },
  };
}
