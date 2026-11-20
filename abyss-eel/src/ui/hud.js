// src/ui/hud.js — HUD：深度 / 光珠 / 连击 / 深度带名 / 冲刺热量条。
// 数据由 main 每帧喂入 setHud(run.getHud())；本文件不碰 sim、不读存档。
import { t } from '../core/i18n.js';

const DASH_ORB_MIN = 5; // 至少 5 珠才能启动冲刺（与 config/gameplay 数值一致）

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
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.depth"></span><b id="hud-depth">0</b><i class="hud-unit">m</i></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.orbs"></span><b id="hud-orbs">0</b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.combo"></span><b id="hud-combo">0</b></div>' +
    '</div>' +
    '<div class="hud-center"><div class="hud-zone" id="hud-zone"></div></div>' +
    '<div class="hud-right">' +
      '<div class="dash-heat" id="dash-heat">' +
        '<div class="dash-heat-track"><i class="dash-heat-fill" id="dash-heat-fill"></i></div>' +
        '<span class="dash-heat-label" data-i18n="hud.dash"></span>' +
      '</div>' +
      '<div class="dash-heat-hint hidden" id="dash-heat-hint" data-i18n="hud.dashNeed"></div>' +
    '</div>';

  const depthEl = el.querySelector('#hud-depth');
  const orbsEl = el.querySelector('#hud-orbs');
  const comboEl = el.querySelector('#hud-combo');
  const zoneEl = el.querySelector('#hud-zone');
  const heatEl = el.querySelector('#dash-heat');
  const fillEl = el.querySelector('#dash-heat-fill');
  const hintEl = el.querySelector('#dash-heat-hint');

  function zoneName(zone, zoneName) {
    const key = 'zone.' + zone;
    const text = t(key);
    if (text !== key) return text;
    return zoneName || '';
  }

  return {
    el,
    setHud(h) {
      h = h || {};
      depthEl.textContent = String(Math.max(0, Math.floor(h.depth ?? 0)));
      // 每 25m 里程碑脉冲（可感知反馈，与 sim 的 depthMilestone 事件对齐）
      const mile = Math.floor(Math.max(0, h.depth ?? 0) / 25);
      if (mile > (this._lastMile ?? 0)) {
        this._lastMile = mile;
        depthEl.parentElement.classList.remove('milestone-flash');
        void depthEl.parentElement.offsetWidth; // 重启动画
        depthEl.parentElement.classList.add('milestone-flash');
      }
      orbsEl.textContent = String(Math.max(0, Math.floor(h.orbs ?? 0)));
      comboEl.textContent = String(Math.max(0, Math.floor(h.combo ?? 0)));
      zoneEl.textContent = zoneName(Number(h.zone) || 1, h.zoneName);

      const orbs = Math.max(0, Math.floor(h.orbs ?? 0));
      const disabled = orbs < DASH_ORB_MIN;
      heatEl.classList.toggle('disabled', disabled);
      fillEl.style.width = (clamp01(h.dashHeat) * 100).toFixed(1) + '%';
      hintEl.classList.toggle('hidden', !disabled);
    },
    show() { el.classList.remove('hidden'); el.setAttribute('aria-hidden', 'false'); },
    hide() { el.classList.add('hidden'); el.setAttribute('aria-hidden', 'true'); },
  };
}
