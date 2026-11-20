// src/ui/hud.js — HUD：赛段 / 名次 / 鱼群 / 进度条 / 收拢与滑翔状态。
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
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.segment"></span><b id="hud-segment">1</b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.rank"></span><b id="hud-rank">1</b><i class="hud-unit">/4</i></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.school"></span><b id="hud-fish">6</b></div>' +
    '</div>' +
    '<div class="hud-center"><div class="hud-progress"><i class="hud-progress-fill" id="hud-progress-fill"></i></div></div>' +
    '<div class="hud-right">' +
      '<div class="hud-chip" id="hud-gather"><span data-i18n="hud.gather"></span></div>' +
      '<div class="hud-chip" id="hud-glide"><span data-i18n="hud.glide"></span></div>' +
    '</div>';

  const segEl = el.querySelector('#hud-segment');
  const rankEl = el.querySelector('#hud-rank');
  const fishEl = el.querySelector('#hud-fish');
  const fillEl = el.querySelector('#hud-progress-fill');
  const gatherEl = el.querySelector('#hud-gather');
  const glideEl = el.querySelector('#hud-glide');

  return {
    el,
    setHud(h) {
      h = h || {};
      segEl.textContent = String(Math.max(1, Math.floor(h.segment ?? 1)));
      rankEl.textContent = String(Math.max(1, Math.floor(h.rank ?? 1)));
      fishEl.textContent = String(Math.max(0, Math.floor(h.fish ?? 0)));
      const pct = Math.min(100, Math.max(0, ((h.dist ?? 0) / (h.length || 1)) * 100));
      fillEl.style.width = pct.toFixed(1) + '%';
      gatherEl.classList.toggle('on', !!h.gathered);
      glideEl.classList.toggle('on', !!h.gliding);
    },
    show() { el.classList.remove('hidden'); el.setAttribute('aria-hidden', 'false'); },
    hide() { el.classList.add('hidden'); el.setAttribute('aria-hidden', 'true'); },
  };
}
