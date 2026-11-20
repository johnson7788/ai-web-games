// src/ui/hud.js — HUD：距离 / 陶罐（血量）/ 连击 / 路段名 / 最佳。
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
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.distance"></span><b id="hud-distance">0</b><i class="hud-unit">m</i></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.jars"></span><b id="hud-jars">3</b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.combo"></span><b id="hud-combo">0</b></div>' +
    '</div>' +
    '<div class="hud-center"><div class="hud-zone" id="hud-zone"></div></div>' +
    '<div class="hud-right">' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.best"></span><b id="hud-best">0</b><i class="hud-unit">m</i></div>' +
    '</div>';

  const distanceEl = el.querySelector('#hud-distance');
  const jarsEl = el.querySelector('#hud-jars');
  const comboEl = el.querySelector('#hud-combo');
  const zoneEl = el.querySelector('#hud-zone');
  const bestEl = el.querySelector('#hud-best');

  let lastBest = 0;

  function zoneName(seg, segName) {
    const key = 'seg.' + seg;
    const text = t(key);
    if (text !== key) return text;
    return segName || '';
  }

  return {
    el,
    setBest(best) { lastBest = Math.max(0, Math.floor(best ?? 0)); },
    setHud(h) {
      h = h || {};
      distanceEl.textContent = String(Math.max(0, Math.floor(h.distance ?? 0)));
      jarsEl.textContent = `${Math.max(0, Math.floor(h.jars ?? 0))}/${h.jarMax ?? 6}`;
      comboEl.textContent = String(Math.max(0, Math.floor(h.combo ?? 0)));
      zoneEl.textContent = zoneName(Number(h.segment) || 1, h.segmentName);
      bestEl.textContent = String(lastBest);
      if (h.fullLoad) {
        zoneEl.textContent += ' · ' + t('hud.full');
      }
    },
    show() { el.classList.remove('hidden'); el.setAttribute('aria-hidden', 'false'); },
    hide() { el.classList.add('hidden'); el.setAttribute('aria-hidden', 'true'); },
  };
}
