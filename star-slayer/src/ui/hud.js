// src/ui/hud.js — HUD：波次 / 血量 / 护甲 / 击杀 / 舰区 / 光核状态 / 技能就绪 / Boss 血条。
// 全部收进顶部一条不透明横栏，不浮在战斗画面上，避免遮挡目标。
import { t } from '../core/i18n.js';

function pct(v, max) {
  const m = Math.max(1, Number(max) || 0);
  return Math.min(100, Math.max(0, (Number(v) || 0) / m * 100)).toFixed(1) + '%';
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
    '<div class="hud-row">' +
      '<div class="hud-panel"><span class="hud-label" data-i18n="hud.wave"></span><b id="hud-wave">0</b></div>' +
      '<div class="hud-panel"><span class="hud-label" data-i18n="hud.hp"></span>' +
        '<div class="hud-track"><i class="hud-fill hp" id="hud-hp-fill"></i></div><b id="hud-hp">0</b></div>' +
      '<div class="hud-panel"><span class="hud-label" data-i18n="hud.armor"></span>' +
        '<div class="hud-track"><i class="hud-fill armor" id="hud-armor-fill"></i></div><b id="hud-armor">0</b></div>' +
      '<div class="hud-panel"><span class="hud-label" data-i18n="hud.kills"></span><b id="hud-kills">0</b></div>' +
      '<div class="hud-panel"><span class="hud-label" data-i18n="hud.hostiles"></span><b id="hud-hostiles">0</b></div>' +
      '<div class="hud-panel"><span class="hud-label" data-i18n="hud.scene"></span><b id="hud-scene"></b></div>' +
      '<div class="hud-panel" id="hud-core"><span class="hud-label" data-i18n="hud.core"></span><b id="hud-core-state"></b></div>' +
      '<div class="hud-spacer"></div>' +
      '<span class="hud-badge overload hidden" id="hud-overload" data-i18n="hud.overloadReady"></span>' +
    '</div>' +
    '<div class="hud-boss hidden" id="hud-boss">' +
      '<span class="boss-name" data-i18n="scene.boss"></span>' +
      '<div class="boss-track"><i class="boss-fill" id="boss-fill"></i></div>' +
    '</div>';

  const waveEl = el.querySelector('#hud-wave');
  const hpEl = el.querySelector('#hud-hp');
  const hpFill = el.querySelector('#hud-hp-fill');
  const armorEl = el.querySelector('#hud-armor');
  const armorFill = el.querySelector('#hud-armor-fill');
  const killsEl = el.querySelector('#hud-kills');
  const hostilesEl = el.querySelector('#hud-hostiles');
  const sceneEl = el.querySelector('#hud-scene');
  const coreState = el.querySelector('#hud-core-state');
  const corePanel = el.querySelector('#hud-core');
  const overloadBadge = el.querySelector('#hud-overload');
  const bossRow = el.querySelector('#hud-boss');
  const bossFill = el.querySelector('#boss-fill');

  return {
    el,
    setHud(h) {
      h = h || {};
      waveEl.textContent = String(Math.max(0, Math.floor(h.wave ?? 0)));
      hpEl.textContent = String(Math.max(0, Math.floor(h.hp ?? 0)));
      hpFill.style.width = pct(h.hp, h.maxHp);
      armorEl.textContent = String(Math.max(0, Math.floor(h.armor ?? 0)));
      armorFill.style.width = pct(h.armor, h.maxArmor);
      killsEl.textContent = String(Math.max(0, Math.floor(h.kills ?? 0)));
      hostilesEl.textContent = String(Math.max(0, Math.floor(h.hostiles ?? 0)));

      const sceneKey = 'scene.' + (h.scene === 1 ? 'hull' : h.scene === 2 ? 'reactor' : 'bridge');
      sceneEl.textContent = t(sceneKey);

      coreState.textContent = h.coreOnline ? t('hud.core.online') : t('hud.core.offline');
      corePanel.classList.toggle('offline', !h.coreOnline);

      overloadBadge.classList.toggle('hidden', !h.overloadReady);

      const max = Number(h.bossMax) || 0;
      const hp = Math.max(0, Number(h.bossHp) || 0);
      bossRow.classList.toggle('hidden', max <= 0);
      if (max > 0) bossFill.style.width = Math.min(100, (hp / max) * 100).toFixed(1) + '%';
    },
    show() { el.classList.remove('hidden'); el.setAttribute('aria-hidden', 'false'); },
    hide() { el.classList.add('hidden'); el.setAttribute('aria-hidden', 'true'); },
  };
}
