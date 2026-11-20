// src/ui/hud.js — HUD：分数 / 档位 / 目标 / 最佳 / 连消 / 场景名。
// 数据由 main 每帧喂入 setHud(run.getHud())；本文件不碰 sim、不读存档。
import { t } from '../core/i18n.js';

function sceneLabel(key, fallback) {
  const text = t(key);
  return text !== key ? text : (fallback || '');
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
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.tier"></span><b id="hud-tier">1</b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.target"></span><b id="hud-target">0</b></div>' +
    '</div>' +
    '<div class="hud-center"><div class="hud-zone" id="hud-scene"></div></div>' +
    '<div class="hud-right">' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.best"></span><b id="hud-best">0</b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.combo"></span><b id="hud-combo">0</b></div>' +
    '</div>';

  const scoreEl = el.querySelector('#hud-score');
  const tierEl = el.querySelector('#hud-tier');
  const targetEl = el.querySelector('#hud-target');
  const bestEl = el.querySelector('#hud-best');
  const comboEl = el.querySelector('#hud-combo');
  const sceneEl = el.querySelector('#hud-scene');

  const sceneKey = { spring: 'scene.spring', honey: 'scene.honey', winter: 'scene.winter' };

  return {
    el,
    setHud(h) {
      h = h || {};
      scoreEl.textContent = String(Math.floor(h.score ?? 0));
      tierEl.textContent = String(Math.floor(h.tier ?? 1));
      targetEl.textContent = h.target == null ? '—' : String(Math.floor(h.target));
      bestEl.textContent = String(Math.floor(h.best ?? 0));
      comboEl.textContent = String(Math.floor(h.combo ?? 0));
      sceneEl.textContent = sceneLabel(sceneKey[h.scene] || 'scene.spring', h.scene);
    },
    show() { el.classList.remove('hidden'); el.setAttribute('aria-hidden', 'false'); },
    hide() { el.classList.add('hidden'); el.setAttribute('aria-hidden', 'true'); },
  };
}
