// src/ui/hud.js — HUD：阶段 / 体型 / 分数 / 深度带 / 护体毒刺进度。
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
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.stage"></span><b id="hud-stage">0</b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.mass"></span><b id="hud-mass">0</b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.score"></span><b id="hud-score">0</b></div>' +
    '</div>' +
    '<div class="hud-center"><div class="hud-zone" id="hud-zone"></div></div>' +
    '<div class="hud-right">' +
      '<div class="sting-bar" id="sting-bar">' +
        '<div class="sting-track"><i class="sting-fill" id="sting-fill"></i></div>' +
        '<span class="sting-label" data-i18n="hud.sting"></span>' +
      '</div>' +
      '<div class="grow-hint" id="grow-hint"></div>' +
    '</div>';

  const stageEl = el.querySelector('#hud-stage');
  const massEl = el.querySelector('#hud-mass');
  const scoreEl = el.querySelector('#hud-score');
  const zoneEl = el.querySelector('#hud-zone');
  const stingBar = el.querySelector('#sting-bar');
  const stingFill = el.querySelector('#sting-fill');
  const growHint = el.querySelector('#grow-hint');

  function zoneName(zone) {
    const key = 'zone.' + zone;
    const text = t(key);
    return text !== key ? text : String(zone);
  }

  return {
    el,
    setHud(h) {
      h = h || {};
      stageEl.textContent = String(Math.max(0, Math.floor(h.stage ?? 0)));
      massEl.textContent = String(Math.max(0, Math.round(h.mass ?? 0)));
      scoreEl.textContent = String(Math.max(0, Math.round(h.score ?? 0)));
      zoneEl.textContent = zoneName(Number(h.zone) || 0);

      const active = h.stingActive === true;
      stingBar.classList.toggle('active', active);
      const frac = active ? Math.max(0, Math.min(1, (h.stingLeft ?? 0) / (h.stingMax || 1))) : 0;
      stingFill.style.width = (frac * 100).toFixed(1) + '%';

      if (h.final) {
        growHint.textContent = t('win.title');
        growHint.classList.add('done');
      } else {
        growHint.textContent = t('hud.growTo', { mass: Math.max(0, Math.round(h.growLeft ?? 0)) });
        growHint.classList.remove('done');
      }
    },
    show() { el.classList.remove('hidden'); el.setAttribute('aria-hidden', 'false'); },
    hide() { el.classList.add('hidden'); el.setAttribute('aria-hidden', 'true'); },
  };
}
