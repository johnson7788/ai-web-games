// src/ui/hud.js — HUD：生命 / 能量伞 / 波次进度 / 风骚值 / 风向 / 目标提示。
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
      '<div class="hud-goal" data-i18n="hud.goal"></div>' +
      '<div class="hud-row">' +
        '<span class="hud-item"><label data-i18n="hud.hp"></label><b id="hud-hp"></b></span>' +
        '<span class="hud-item"><label data-i18n="hud.shield"></label><b id="hud-shield"></b></span>' +
        '<span class="hud-item"><label data-i18n="hud.style"></label><b id="hud-style">0</b></span>' +
      '</div>' +
    '</div>' +
    '<div class="hud-center">' +
      '<div class="hud-wave-name" id="hud-wave-name"></div>' +
      '<div class="hud-wave-track"><i class="hud-wave-fill" id="hud-wave-fill"></i></div>' +
    '</div>' +
    '<div class="hud-right">' +
      '<span class="hud-item"><label data-i18n="hud.wind"></label><b id="hud-wind"></b></span>' +
      '<span class="hud-item"><label data-i18n="hud.wave"></label><b id="hud-wave-num">1</b><i class="hud-unit" id="hud-wave-total"></i></span>' +
    '</div>';

  const hpEl = el.querySelector('#hud-hp');
  const shieldEl = el.querySelector('#hud-shield');
  const styleEl = el.querySelector('#hud-style');
  const waveNameEl = el.querySelector('#hud-wave-name');
  const waveFillEl = el.querySelector('#hud-wave-fill');
  const waveNumEl = el.querySelector('#hud-wave-num');
  const waveTotalEl = el.querySelector('#hud-wave-total');
  const windEl = el.querySelector('#hud-wind');

  function waveName(wave, key) {
    const text = t(key);
    return text !== key ? text : '';
  }

  return {
    el,
    setHud(h) {
      h = h || {};
      hpEl.textContent = '♥'.repeat(Math.max(0, h.hp || 0)) + '♡'.repeat(Math.max(0, 3 - (h.hp || 0)));
      shieldEl.textContent = '●'.repeat(Math.max(0, h.shield || 0)) + '○'.repeat(Math.max(0, 3 - (h.shield || 0)));
      styleEl.textContent = String(Math.floor(h.style || 0));
      waveNameEl.textContent = waveName(Number(h.wave) || 1, h.waveName);
      waveFillEl.style.width = ((h.waveProgress || 0) * 100).toFixed(1) + '%';
      waveNumEl.textContent = String(Math.max(1, h.wave || 1));
      waveTotalEl.textContent = '/' + (h.totalWaves || 12);
      const windKey = h.wind === 'tail' ? 'hud.wind.tail' : h.wind === 'head' ? 'hud.wind.head' : 'hud.wind.calm';
      windEl.textContent = t(windKey);
    },
    show() { el.classList.remove('hidden'); el.setAttribute('aria-hidden', 'false'); },
    hide() { el.classList.add('hidden'); el.setAttribute('aria-hidden', 'true'); },
  };
}
