// src/ui/hud.js — HUD：高度 / 岛宽 / 完美连击 / 层界 / 场景 / 风切与神龛提示。
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
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.height"></span><b id="hud-height">0</b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.width"></span><b id="hud-width">0</b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.combo"></span><b id="hud-combo">0</b></div>' +
    '</div>' +
    '<div class="hud-center">' +
      '<div class="hud-zone" id="hud-zone"></div>' +
      '<div class="hud-alert hidden" id="hud-alert"></div>' +
    '</div>' +
    '<div class="hud-right">' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.segment"></span><b id="hud-segment">1</b></div>' +
    '</div>';

  const heightEl = el.querySelector('#hud-height');
  const widthEl = el.querySelector('#hud-width');
  const comboEl = el.querySelector('#hud-combo');
  const zoneEl = el.querySelector('#hud-zone');
  const segEl = el.querySelector('#hud-segment');
  const alertEl = el.querySelector('#hud-alert');

  function sceneName(scene) {
    const key = ['scene.dawn', 'scene.storm', 'scene.night'][scene] || 'scene.dawn';
    const text = t(key);
    return text !== key ? text : '';
  }

  function segLabel(segment) {
    const key = 'seg.' + segment;
    const text = t(key);
    return text !== key ? text : String(segment);
  }

  return {
    el,
    setHud(h) {
      h = h || {};
      heightEl.textContent = String(Math.max(0, Math.floor(h.height ?? 0)));
      widthEl.textContent = String(Math.max(0, Math.floor(h.width ?? 0)));
      comboEl.textContent = String(Math.max(0, Math.floor(h.combo ?? 0)));
      zoneEl.textContent = sceneName(h.scene);
      segEl.textContent = segLabel(Number(h.segment) || 1);

      if (h.windActive) {
        alertEl.textContent = t('hud.wind');
        alertEl.classList.remove('hidden');
      } else if (h.shrineDue) {
        alertEl.textContent = t('hud.shrine');
        alertEl.classList.remove('hidden');
      } else {
        alertEl.classList.add('hidden');
      }
    },
    show() { el.classList.remove('hidden'); el.setAttribute('aria-hidden', 'false'); },
    hide() { el.classList.add('hidden'); el.setAttribute('aria-hidden', 'true'); },
  };
}
