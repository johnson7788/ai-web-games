// COLOR FLUX · HUD：得分 / 段位 / 连穿 / 双色倒计时 / 最高分
import { t } from '../core/i18n.js';

function sceneLabel(scene) {
  return t('scene.' + ['polar', 'day', 'neon'][Math.min(2, Math.max(0, scene ?? 0))]);
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
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.score"></span><b id="hud-score">0</b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.best"></span><b id="hud-best">0</b></div>' +
    '</div>' +
    '<div class="hud-center"><div class="hud-zone" id="hud-zone"></div></div>' +
    '<div class="hud-right">' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.streak"></span><b id="hud-streak">0</b></div>' +
      '<div class="hud-stat dual hidden" id="hud-dual"><span class="hud-label" data-i18n="hud.dual"></span><b id="hud-dual-val"></b></div>' +
    '</div>';

  const scoreEl = el.querySelector('#hud-score');
  const bestEl = el.querySelector('#hud-best');
  const zoneEl = el.querySelector('#hud-zone');
  const streakEl = el.querySelector('#hud-streak');
  const dualEl = el.querySelector('#hud-dual');
  const dualVal = el.querySelector('#hud-dual-val');

  let best = 0;

  return {
    el,
    setBest(v) { best = Math.max(0, Math.floor(v ?? 0)); },
    setHud(h) {
      h = h || {};
      scoreEl.textContent = String(Math.max(0, Math.floor(h.score ?? 0)));
      bestEl.textContent = String(Math.max(0, Math.floor(best)));
      zoneEl.textContent = sceneLabel(h.scene);
      streakEl.textContent = String(Math.max(0, Math.floor(h.streak ?? 0)));
      const dual = !!h.dualActive;
      dualEl.classList.toggle('hidden', !dual);
      if (dual) dualVal.textContent = `${Math.ceil(h.dualRemain ?? 0)}s`;
    },
    show() { el.classList.remove('hidden'); el.setAttribute('aria-hidden', 'false'); },
    hide() { el.classList.add('hidden'); el.setAttribute('aria-hidden', 'true'); },
  };
}
