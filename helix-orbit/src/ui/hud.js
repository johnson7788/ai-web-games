// src/ui/hud.js — HUD：深度 / 分数 / 最佳（左）+ 冰晶 / 陨石态 / 冻结（右）。
// 全部放在角落，不遮挡中央塔层；数据由 main 每帧喂入 setHud(run.getHud())。
import { t } from '../core/i18n.js';

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
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.depth"></span><b id="hud-depth">0</b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.score"></span><b id="hud-score">0</b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.best"></span><b id="hud-best">0</b></div>' +
    '</div>' +
    '<div class="hud-right">' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.crystal"></span><b id="hud-crystal">0</b></div>' +
      '<div class="hud-stat meteor" id="hud-meteor"><b data-i18n="hud.meteor"></b></div>' +
      '<div class="hud-stat freeze hidden" id="hud-freeze"><b data-i18n="hud.freeze"></b></div>' +
    '</div>';

  const depthEl = el.querySelector('#hud-depth');
  const scoreEl = el.querySelector('#hud-score');
  const bestEl = el.querySelector('#hud-best');
  const crystalEl = el.querySelector('#hud-crystal');
  const meteorEl = el.querySelector('#hud-meteor');
  const freezeEl = el.querySelector('#hud-freeze');

  return {
    el,
    setHud(h) {
      h = h || {};
      depthEl.textContent = String(Math.max(0, Math.floor(h.depth ?? 0)));
      scoreEl.textContent = String(Math.max(0, Math.floor(h.score ?? 0)));
      bestEl.textContent = String(Math.max(0, Math.floor(h.best ?? 0)));
      crystalEl.textContent = String(Math.max(0, Math.floor(h.crystals ?? 0)));
      meteorEl.classList.toggle('hidden', !h.meteorActive);
      freezeEl.classList.toggle('hidden', !h.freezeActive);
    },
    show() { el.classList.remove('hidden'); el.setAttribute('aria-hidden', 'false'); },
    hide() { el.classList.add('hidden'); el.setAttribute('aria-hidden', 'true'); },
  };
}
