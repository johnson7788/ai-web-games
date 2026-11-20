// src/ui/hud.js — HUD：金币 / 场次 / 营收目标 / 鱼汛预报 / 电击网充能 / Boss 警告 / 炮档控制。
// 数据由 main 每帧喂入 setHud(run.getHud())；本文件不碰 sim、不读存档。
import { t } from '../core/i18n.js';

function clamp01(v) {
  const n = Number(v) || 0;
  return Math.min(1, Math.max(0, n > 1 ? n / 100 : n));
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
    '<div class="hud-top">' +
      '<div class="hud-left">' +
        '<div class="hud-stat"><span class="hud-label" data-i18n="hud.coins"></span><b id="hud-coins">0</b></div>' +
        '<div class="hud-stat"><span class="hud-label" data-i18n="hud.stage"></span><b id="hud-stage">1</b></div>' +
        '<div class="hud-stat"><span class="hud-label" data-i18n="hud.target"></span><b id="hud-target">0</b></div>' +
      '</div>' +
      '<div class="hud-center">' +
        '<div id="hud-forecast" class="hud-forecast hidden"><span data-i18n="hud.forecast"></span><b id="hud-forecast-sec">5</b></div>' +
        '<div id="hud-boss" class="hud-boss hidden" data-i18n="hud.boss"></div>' +
      '</div>' +
      '<div class="hud-right">' +
        '<div class="electric-bar" id="electric-bar">' +
          '<span class="hud-label" data-i18n="hud.electric"></span>' +
          '<div class="electric-track"><i class="electric-fill" id="electric-fill"></i></div>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="tier-control" data-tier-control>' +
      '<button id="btn-tier-down" class="btn-tier" type="button" aria-label="tier down">−</button>' +
      '<div class="tier-box"><span class="hud-label" data-i18n="hud.tier"></span><b id="hud-tier">1</b></div>' +
      '<button id="btn-tier-up" class="btn-tier" type="button" aria-label="tier up">+</button>' +
    '</div>';

  const coinsEl = el.querySelector('#hud-coins');
  const stageEl = el.querySelector('#hud-stage');
  const targetEl = el.querySelector('#hud-target');
  const forecastEl = el.querySelector('#hud-forecast');
  const forecastSecEl = el.querySelector('#hud-forecast-sec');
  const bossEl = el.querySelector('#hud-boss');
  const electricFill = el.querySelector('#electric-fill');
  const tierEl = el.querySelector('#hud-tier');

  return {
    el,
    tierDownBtn: el.querySelector('#btn-tier-down'),
    tierUpBtn: el.querySelector('#btn-tier-up'),
    setHud(h) {
      h = h || {};
      coinsEl.textContent = String(Math.max(0, Math.floor(h.coins ?? 0)));
      stageEl.textContent = String(h.stage ?? 1);
      targetEl.textContent = String(Math.floor(h.revenueTarget ?? 0));
      tierEl.textContent = String(h.tier ?? 1);

      const hasForecast = h.forecastPath != null;
      forecastEl.classList.toggle('hidden', !hasForecast);
      if (hasForecast) forecastSecEl.textContent = String(Math.max(0, Math.ceil(h.forecastSec ?? 0)));

      bossEl.classList.toggle('hidden', !h.bossActive);

      electricFill.style.width = (clamp01(h.electric) * 100).toFixed(1) + '%';
      electricFill.classList.toggle('full', clamp01(h.electric) >= 1);
    },
    show() { el.classList.remove('hidden'); el.setAttribute('aria-hidden', 'false'); },
    hide() { el.classList.add('hidden'); el.setAttribute('aria-hidden', 'true'); },
  };
}
