// src/ui/hud.js — HUD：分数 / 带 / 连击 / 你的颜色 / 同色链进度。
// 数据由 main 每帧喂入 setHud(run.getHud())；本文件不碰 sim、不读存档。
import { t } from '../core/i18n.js';
import { dyeHex } from '../render/theme.js';

const RAINBOW_STREAK = 5;

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
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.band"></span><b id="hud-band">1</b><i class="hud-unit" id="hud-band-total"></i></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.combo"></span><b id="hud-combo">0</b></div>' +
    '</div>' +
    '<div class="hud-center">' +
      '<div class="hud-dye">' +
        '<i class="hud-dye-swatch" id="hud-dye-swatch"></i>' +
        '<span class="hud-label" data-i18n="hud.dye"></span>' +
      '</div>' +
      '<div class="hud-streak" id="hud-streak"></div>' +
    '</div>' +
    '<div class="hud-right">' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.best"></span><b id="hud-best">0</b></div>' +
      '<div class="hud-next" id="hud-next"></div>' +
    '</div>';

  const scoreEl = el.querySelector('#hud-score');
  const bandEl = el.querySelector('#hud-band');
  const bandTotalEl = el.querySelector('#hud-band-total');
  const comboEl = el.querySelector('#hud-combo');
  const bestEl = el.querySelector('#hud-best');
  const swatchEl = el.querySelector('#hud-dye-swatch');
  const streakEl = el.querySelector('#hud-streak');
  const nextEl = el.querySelector('#hud-next');

  let best = 0;

  function renderStreak(n) {
    streakEl.innerHTML = '';
    for (let i = 0; i < RAINBOW_STREAK; i += 1) {
      const d = document.createElement('i');
      d.className = 'hud-streak-dot' + (i < n ? ' on' : '');
      streakEl.appendChild(d);
    }
  }

  return {
    el,
    setBest(v) {
      best = Math.max(0, Math.floor(v ?? 0));
      bestEl.textContent = String(best);
    },
    setHud(h) {
      h = h || {};
      scoreEl.textContent = String(Math.max(0, Math.floor(h.score ?? 0)));
      bandEl.textContent = String(Math.max(1, Math.floor(h.band ?? 1)));
      bandTotalEl.textContent = '/' + String(Math.max(1, h.bandTotal ?? 12));
      comboEl.textContent = String(Math.max(0, Math.floor(h.combo ?? 0)));
      swatchEl.style.background = dyeHex(Number(h.dye) || 0);
      renderStreak(Math.max(0, Math.floor(h.sameStreak ?? 0)));
      nextEl.textContent = t('hud.next', { n: Math.max(1, Math.floor(h.nextBandRings ?? 1)) });
    },
    show() { el.classList.remove('hidden'); el.setAttribute('aria-hidden', 'false'); },
    hide() { el.classList.add('hidden'); el.setAttribute('aria-hidden', 'true'); },
  };
}
