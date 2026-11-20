// src/ui/hud.js — HUD：分数 / 距离 / 羊群(带目标) / 路段 / 下一目标进度 / 口哨冷却条。
// 数据由 main 每帧喂入 setHud(run.getHud())；本文件不碰 sim、不读存档。
import { t } from '../core/i18n.js';
import { WHISTLE } from '../../config/gameplay.js';
import { segmentFor, SEGMENTS } from '../../config/segments.js';

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
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.distance"></span><b id="hud-distance">0</b><i class="hud-unit">m</i></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.flock"></span><b id="hud-flock">0</b><i class="hud-unit">/30</i></div>' +
    '</div>' +
    '<div class="hud-center">' +
      '<div class="hud-zone" id="hud-segment"></div>' +
      '<div class="hud-goal"><span class="goal-label" data-i18n="hud.next"></span><b id="hud-goal">400m</b>' +
        '<span class="goal-track"><i class="goal-fill" id="hud-goal-fill"></i></span></div>' +
    '</div>' +
    '<div class="hud-right">' +
      '<div class="whistle-box" id="whistle-box">' +
        '<div class="whistle-track"><i class="whistle-fill" id="whistle-fill"></i></div>' +
        '<span class="whistle-label" id="whistle-label" data-i18n="hud.whistle"></span>' +
      '</div>' +
    '</div>';

  const scoreEl = el.querySelector('#hud-score');
  const distEl = el.querySelector('#hud-distance');
  const flockEl = el.querySelector('#hud-flock');
  const segEl = el.querySelector('#hud-segment');
  const goalEl = el.querySelector('#hud-goal');
  const goalFillEl = el.querySelector('#hud-goal-fill');
  const boxEl = el.querySelector('#whistle-box');
  const fillEl = el.querySelector('#whistle-fill');
  const whistleLabel = el.querySelector('#whistle-label');

  function segName(seg, nameKey) {
    const text = t(nameKey);
    return text !== nameKey ? text : String(seg);
  }

  return {
    el,
    setHud(h) {
      h = h || {};
      scoreEl.textContent = String(Math.max(0, Math.floor(h.score ?? 0)));
      const mile = Math.floor(Math.max(0, h.distance ?? 0) / 25);
      if (mile > (this._lastMile ?? 0)) {
        this._lastMile = mile;
        distEl.parentElement.classList.remove('milestone-flash');
        void distEl.parentElement.offsetWidth;
        distEl.parentElement.classList.add('milestone-flash');
      }
      distEl.textContent = String(Math.max(0, Math.floor(h.distance ?? 0)));
      flockEl.textContent = String(Math.max(0, Math.floor(h.flock ?? 0)));
      segEl.textContent = segName(Number(h.segment) || 1, h.segmentName);

      // 下一目标：当前段的终点距离 + 段内进度条（可见目标）
      const dist = Math.max(0, Number(h.distance) || 0);
      const seg = segmentFor(dist);
      const prevEnd = seg.index === 1 ? 0 : SEGMENTS[seg.index - 2].endM; // 上一段终点
      const goalM = seg.endM;
      const progress = Math.max(0, Math.min(1, (dist - prevEnd) / Math.max(1, goalM - prevEnd)));
      goalEl.textContent = goalM + 'm';
      goalFillEl.style.width = (progress * 100).toFixed(1) + '%';

      // 口哨冷却
      const ready = h.whistleReady !== false;
      const cd = Number(h.whistleCd) || 0;
      const pct = ready ? 100 : Math.max(0, (1 - cd / WHISTLE.COOLDOWN) * 100);
      boxEl.classList.toggle('ready', ready);
      boxEl.classList.toggle('scattered', !!h.scattered);
      fillEl.style.width = pct.toFixed(1) + '%';
      whistleLabel.textContent = ready ? t('hud.whistle') + ' ✓' : t('hud.whistle') + ' ' + Math.ceil(cd) + 's';
    },
    show() { el.classList.remove('hidden'); el.setAttribute('aria-hidden', 'false'); },
    hide() { el.classList.add('hidden'); el.setAttribute('aria-hidden', 'true'); },
  };
}
