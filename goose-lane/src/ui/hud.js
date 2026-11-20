// src/ui/hud.js — HUD：里程 / 宝石 / 气球 / 站名 / 最佳（不透明条，避免遮挡误读）。
// 数据由 main 每帧喂入 setHud(run.getHud())；不碰 sim、不读存档。
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
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.distance"></span><b id="hud-distance">0</b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.gems"></span><b id="hud-gems">0</b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.balloons"></span><b id="hud-balloons">0</b></div>' +
    '</div>' +
    '<div class="hud-center"><div class="hud-station" id="hud-station"></div></div>' +
    '<div class="hud-right">' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.best"></span><b id="hud-best">0m</b></div>' +
    '</div>';

  const distanceEl = el.querySelector('#hud-distance');
  const gemsEl = el.querySelector('#hud-gems');
  const balloonsEl = el.querySelector('#hud-balloons');
  const stationEl = el.querySelector('#hud-station');
  const bestEl = el.querySelector('#hud-best');

  let best = 0;

  function stationLabel(station, stationName) {
    const key = 'station.' + stationName;
    const text = t(key);
    return (text !== key ? text : stationName || '');
  }

  return {
    el,
    setBest(b) { best = Math.max(0, Math.floor(b ?? 0)); },
    setHud(h) {
      h = h || {};
      const m = Math.max(0, Math.floor(h.distance ?? 0));
      distanceEl.textContent = String(m);
      const mile = Math.floor(m / 10);
      if (mile > (this._lastMile ?? 0)) {
        this._lastMile = mile;
        distanceEl.parentElement.classList.remove('milestone-flash');
        void distanceEl.parentElement.offsetWidth;
        distanceEl.parentElement.classList.add('milestone-flash');
      }
      gemsEl.textContent = String(Math.max(0, Math.floor(h.gems ?? 0)));
      balloonsEl.textContent = String(Math.max(0, Math.floor(h.balloons ?? 0)));
      const station = Math.max(1, Math.floor(h.station ?? 1));
      stationEl.textContent = `${station}/12 · ${stationLabel(station, h.stationName)}`;
      bestEl.textContent = best + 'm';
    },
    show() { el.classList.remove('hidden'); el.setAttribute('aria-hidden', 'false'); },
    hide() { el.classList.add('hidden'); el.setAttribute('aria-hidden', 'true'); },
  };
}
