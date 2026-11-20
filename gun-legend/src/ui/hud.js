// src/ui/hud.js — HUD：场次 / 血量 / 得分 / 连杀 / 武器 / 双枪弹匣 / 翻滚冷却 / 换弹条。
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
    '<div class="hud-left">' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.round"></span><b id="hud-round">1</b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.score"></span><b id="hud-score">0</b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.combo"></span><b id="hud-combo">0</b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.weapon"></span><b id="hud-weapon"></b></div>' +
    '</div>' +
    '<div class="hud-center">' +
      '<div class="hud-hp"><div class="hud-hp-track"><i class="hud-hp-fill" id="hud-hp-fill"></i></div><b id="hud-hp-num">100</b></div>' +
      '<div class="hud-targets"><span data-i18n="hud.targets"></span><b id="hud-targets">0</b></div>' +
    '</div>' +
    '<div class="hud-right">' +
      '<div class="ammo-box">' +
        '<div class="ammo-gun"><span class="ammo-dot l"></span><b id="hud-ammo-l">6</b></div>' +
        '<div class="ammo-gun"><span class="ammo-dot r"></span><b id="hud-ammo-r">6</b></div>' +
      '</div>' +
      '<div class="roll-box" id="roll-box">' +
        '<div class="roll-track"><i class="roll-fill" id="roll-fill"></i></div>' +
        '<span class="roll-label" data-i18n="hud.roll"></span>' +
      '</div>' +
      '<div class="reload-box hidden" id="reload-box">' +
        '<div class="reload-track"><i class="reload-fill" id="reload-fill"></i></div>' +
        '<span class="reload-label" data-i18n="hud.reload"></span>' +
      '</div>' +
    '</div>';

  const roundEl = el.querySelector('#hud-round');
  const scoreEl = el.querySelector('#hud-score');
  const comboEl = el.querySelector('#hud-combo');
  const weaponEl = el.querySelector('#hud-weapon');
  const hpFillEl = el.querySelector('#hud-hp-fill');
  const hpNumEl = el.querySelector('#hud-hp-num');
  const targetsEl = el.querySelector('#hud-targets');
  const ammoLEl = el.querySelector('#hud-ammo-l');
  const ammoREl = el.querySelector('#hud-ammo-r');
  const rollFillEl = el.querySelector('#roll-fill');
  const rollBoxEl = el.querySelector('#roll-box');
  const reloadFillEl = el.querySelector('#reload-fill');
  const reloadBoxEl = el.querySelector('#reload-box');

  return {
    el,
    setHud(h) {
      h = h || {};
      roundEl.textContent = String(Math.max(1, Math.floor(h.round ?? 1)));
      scoreEl.textContent = String(Math.max(0, Math.floor(h.score ?? 0)));
      comboEl.textContent = String(Math.max(0, Math.floor(h.combo ?? 0)));
      const wn = t(h.weapon || 'weapon.revolver');
      weaponEl.textContent = wn === (h.weapon || '') ? '' : wn;

      const hpFrac = clamp01((h.hp ?? 0) / Math.max(1, h.maxHp || 100));
      hpFillEl.style.width = (hpFrac * 100).toFixed(1) + '%';
      hpFillEl.style.background = hpFrac > 0.35 ? 'linear-gradient(90deg,#3ad6a0,#54e7ff)' : 'linear-gradient(90deg,#ff5d5d,#ff9a6a)';
      hpNumEl.textContent = String(Math.max(0, Math.floor(h.hp ?? 0)));

      targetsEl.textContent = String(Math.max(0, Math.floor(h.enemies ?? 0)));

      ammoLEl.textContent = String(Math.max(0, Math.floor(h.ammoL ?? 0)));
      ammoREl.textContent = String(Math.max(0, Math.floor(h.ammoR ?? 0)));

      rollFillEl.style.width = (clamp01(1 - (h.rollCd ?? 0) / 3.0) * 100).toFixed(1) + '%';
      rollBoxEl.classList.toggle('disabled', !h.rollReady);

      reloadBoxEl.classList.toggle('hidden', !h.reloading);
      reloadFillEl.style.width = (clamp01(h.reloadProgress) * 100).toFixed(1) + '%';
    },
    show() { el.classList.remove('hidden'); el.setAttribute('aria-hidden', 'false'); },
    hide() { el.classList.add('hidden'); el.setAttribute('aria-hidden', 'true'); },
  };
}
