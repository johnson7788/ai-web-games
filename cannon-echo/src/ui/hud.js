// src/ui/hud.js — HUD：得分 / 波次 / 要塞耐久 / 过热条 / 炮台等级 / 场景名。
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
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.score"></span><b id="hud-score">0</b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.wave"></span><b id="hud-wave">1</b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.level"></span><b id="hud-level">1</b></div>' +
    '</div>' +
    '<div class="hud-center"><div class="hud-zone" id="hud-zone"></div></div>' +
    '<div class="hud-right">' +
      '<div class="hud-bar" id="hud-hp"><span class="hud-label" data-i18n="hud.hp"></span><div class="bar-track"><i class="bar-fill hp-fill" id="hp-fill"></i></div><b id="hp-num">100</b></div>' +
      '<div class="hud-bar" id="hud-heat"><span class="hud-label" data-i18n="hud.heat"></span><div class="bar-track"><i class="bar-fill heat-fill" id="heat-fill"></i></div><span class="heat-warn hidden" id="heat-warn" data-i18n="hud.overheat"></span></div>' +
    '</div>';

  const scoreEl = el.querySelector('#hud-score');
  const waveEl = el.querySelector('#hud-wave');
  const levelEl = el.querySelector('#hud-level');
  const zoneEl = el.querySelector('#hud-zone');
  const hpFill = el.querySelector('#hp-fill');
  const hpNum = el.querySelector('#hp-num');
  const heatFill = el.querySelector('#heat-fill');
  const heatWarn = el.querySelector('#heat-warn');

  function sceneName(scene, sceneName) {
    const key = sceneName || `scene.${scene}`;
    const text = t(key);
    return text !== key ? text : '';
  }

  function clamp01(v) {
    const n = Number(v) || 0;
    return Math.min(1, Math.max(0, n > 1 ? n / 100 : n));
  }

  return {
    el,
    setHud(h) {
      h = h || {};
      scoreEl.textContent = String(Math.max(0, Math.floor(h.score ?? 0)));
      waveEl.textContent = String(Math.max(1, Math.floor(h.wave ?? 1)));
      levelEl.textContent = String(Math.max(1, Math.floor(h.level ?? 1)));
      zoneEl.textContent = sceneName(Number(h.scene) || 0, h.sceneName);

      const hpRatio = clamp01((h.hp ?? 0) / Math.max(1, h.hpMax ?? 100));
      hpFill.style.width = (hpRatio * 100).toFixed(1) + '%';
      hpNum.textContent = String(Math.max(0, Math.floor(h.hp ?? 0)));

      const heatRatio = clamp01(h.heat ?? 0);
      heatFill.style.width = (heatRatio * 100).toFixed(1) + '%';
      heatFill.classList.toggle('hot', heatRatio > 0.7);
      heatWarn.classList.toggle('hidden', !h.overheated);
    },
    show() { el.classList.remove('hidden'); el.setAttribute('aria-hidden', 'false'); },
    hide() { el.classList.add('hidden'); el.setAttribute('aria-hidden', 'true'); },
  };
}
