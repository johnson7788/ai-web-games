// src/ui/hud.js — HUD：环数 / 得分 / 最佳 / 光子进度 / 重光子预警 / 场景名。
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
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML =
    '<div class="hud-left">' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.ring"></span><b id="hud-ring">1/12</b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.score"></span><b id="hud-score">0</b></div>' +
    '</div>' +
    '<div class="hud-center"><div class="hud-scene" id="hud-scene"></div></div>' +
    '<div class="hud-right">' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.best"></span><b id="hud-best">0</b></div>' +
      '<div class="hud-pins"><span class="hud-label" data-i18n="hud.pins"></span><div class="pins-track"><i class="pins-fill" id="pins-fill"></i></div><b id="hud-pins">0/8</b></div>' +
      '<div class="hud-overload hidden" id="hud-overload" data-i18n="hud.overload"></div>' +
    '</div>';

  const ringEl = el.querySelector('#hud-ring');
  const scoreEl = el.querySelector('#hud-score');
  const bestEl = el.querySelector('#hud-best');
  const sceneEl = el.querySelector('#hud-scene');
  const pinsEl = el.querySelector('#hud-pins');
  const fillEl = el.querySelector('#pins-fill');
  const overloadEl = el.querySelector('#hud-overload');

  return {
    el,
    setBest(best) {
      bestEl.textContent = String(Math.max(0, Math.floor(best ?? 0)));
    },
    setHud(h) {
      h = h || {};
      ringEl.textContent = `${Math.max(1, h.ring ?? 1)}/12`;
      scoreEl.textContent = String(Math.max(0, Math.floor(h.score ?? 0)));
      pinsEl.textContent = `${Math.max(0, h.ringPinned ?? 0)}/${Math.max(1, h.ringTarget ?? 1)}`;
      const pct = Math.min(1, (h.ringPinned ?? 0) / Math.max(1, h.ringTarget ?? 1));
      fillEl.style.width = (pct * 100).toFixed(1) + '%';
      sceneEl.textContent = t(h.sceneKey || 'scene.blue');
      overloadEl.classList.toggle('hidden', !h.nextHeavy);
    },
    show() { el.classList.remove('hidden'); el.setAttribute('aria-hidden', 'false'); },
    hide() { el.classList.add('hidden'); el.setAttribute('aria-hidden', 'true'); },
  };
}
