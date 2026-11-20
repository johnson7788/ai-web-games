// src/ui/hud.js — HUD：分数 / 等级 / 矿层 / 行数 / 热力条 / 白热态指示。
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
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.score"></span><b id="hud-score">0</b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.level"></span><b id="hud-level">1</b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.layer"></span><b id="hud-layer"></b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.lines"></span><b id="hud-lines">0</b></div>' +
    '</div>' +
    '<div class="hud-center"><div class="hud-scene" id="hud-scene"></div></div>' +
    '<div class="hud-right">' +
      '<div class="heat-bar" id="heat-bar">' +
        '<span class="heat-label" data-i18n="hud.heat"></span>' +
        '<div class="heat-track"><i class="heat-fill" id="heat-fill"></i></div>' +
      '</div>' +
      '<div class="heat-hint" id="heat-hint"></div>' +
    '</div>';

  const scoreEl = el.querySelector('#hud-score');
  const levelEl = el.querySelector('#hud-level');
  const layerEl = el.querySelector('#hud-layer');
  const linesEl = el.querySelector('#hud-lines');
  const sceneEl = el.querySelector('#hud-scene');
  const heatEl = el.querySelector('#heat-bar');
  const fillEl = el.querySelector('#heat-fill');
  const hintEl = el.querySelector('#heat-hint');

  function sceneLabel(scene) {
    const key = 'scene.' + scene;
    const text = t(key);
    return text !== key ? text : scene;
  }

  function layerLabel(layer) {
    const key = 'layer.' + layer;
    const text = t(key);
    return text !== key ? text : String(layer);
  }

  return {
    el,
    setHud(h) {
      h = h || {};
      scoreEl.textContent = String(Math.max(0, Math.floor(h.score ?? 0)));
      levelEl.textContent = String(Math.max(1, Math.floor(h.level ?? 1)));
      layerEl.textContent = layerLabel(Number(h.layer) || 1);
      linesEl.textContent = String(Math.max(0, Math.floor(h.lines ?? 0)));
      sceneEl.textContent = sceneLabel(h.scene || 'copper');

      const heat = Math.max(0, Math.min(1, (h.heat ?? 0) / Math.max(1, h.heatMax ?? 10)));
      fillEl.style.width = (heat * 100).toFixed(1) + '%';
      heatEl.classList.toggle('white-hot', !!h.whiteHot);
      if (h.whiteHot) {
        hintEl.textContent = t('hud.target', { n: 0 }) + ''; // placeholder replaced below
        hintEl.textContent = '★ ' + Math.max(0, Math.ceil(h.whiteHotLeft ?? 0)) + 's ×2';
        hintEl.classList.remove('hidden');
      } else {
        const left = Math.max(0, (h.layerTarget ?? 0) - (h.layerLines ?? 0));
        hintEl.textContent = t('hud.target', { n: left });
        hintEl.classList.toggle('hidden', left <= 0);
      }
    },
    show() { el.classList.remove('hidden'); el.setAttribute('aria-hidden', 'false'); },
    hide() { el.classList.add('hidden'); el.setAttribute('aria-hidden', 'true'); },
  };
}
