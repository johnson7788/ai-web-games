// src/ui/hud.js — HUD：区段 / 得分 / 连击 / 弹量 / 目标 / 熔毁倒计时 / 炮塔血量。
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
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.sector"></span><b id="hud-sector">1</b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.score"></span><b id="hud-score">0</b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.combo"></span><b id="hud-combo">0</b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.targets"></span><b id="hud-targets">0</b></div>' +
    '</div>' +
    '<div class="hud-center">' +
      '<div class="hud-hp"><div class="hud-hp-track"><i class="hud-hp-fill" id="hud-hp-fill"></i></div><b id="hud-hp-num">100</b></div>' +
    '</div>' +
    '<div class="hud-right">' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.ammo"></span><b id="hud-ammo">0</b></div>' +
      '<div class="hud-meltdown" id="hud-meltdown"><span class="hud-label" data-i18n="hud.meltdown"></span><b id="hud-meltdown-num">0</b></div>' +
    '</div>';

  const sectorEl = el.querySelector('#hud-sector');
  const scoreEl = el.querySelector('#hud-score');
  const comboEl = el.querySelector('#hud-combo');
  const targetsEl = el.querySelector('#hud-targets');
  const ammoEl = el.querySelector('#hud-ammo');
  const hpFillEl = el.querySelector('#hud-hp-fill');
  const hpNumEl = el.querySelector('#hud-hp-num');
  const meltdownEl = el.querySelector('#hud-meltdown');
  const meltdownNumEl = el.querySelector('#hud-meltdown-num');

  return {
    el,
    setHud(h) {
      h = h || {};
      sectorEl.textContent = String(Math.max(1, Math.floor(h.level ?? 1)));
      scoreEl.textContent = String(Math.max(0, Math.floor(h.score ?? 0)));
      comboEl.textContent = String(Math.max(0, Math.floor(h.combo ?? 0)));
      targetsEl.textContent = String(Math.max(0, Math.floor(h.enemies ?? 0)));
      ammoEl.textContent = String(Math.max(0, Math.floor(h.ammo ?? 0)));

      const hpFrac = clamp01((h.hp ?? 0) / Math.max(1, h.maxHp || 100));
      hpFillEl.style.width = (hpFrac * 100).toFixed(1) + '%';
      hpFillEl.style.background = hpFrac > 0.35 ? 'linear-gradient(90deg,#2fd08a,#54ff9f)' : 'linear-gradient(90deg,#ff5d5d,#ff9a6a)';
      hpNumEl.textContent = String(Math.max(0, Math.floor(h.hp ?? 0)));

      const sec = Math.ceil(h.meltdown ?? 0);
      meltdownNumEl.textContent = String(sec);
      const danger = (h.meltdown ?? 0) <= 8;
      meltdownEl.classList.toggle('danger', danger);
    },
    show() { el.classList.remove('hidden'); el.setAttribute('aria-hidden', 'false'); },
    hide() { el.classList.add('hidden'); el.setAttribute('aria-hidden', 'true'); },
  };
}
