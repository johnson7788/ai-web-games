// src/ui/hud.js — HUD：关卡 / 剩余刀数 / 分数 / 斩铁按钮。
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
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.level"></span><b id="hud-level">1</b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.knives"></span><b id="hud-knives">0</b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.score"></span><b id="hud-score">0</b></div>' +
    '</div>' +
    '<div class="hud-center"><div class="hud-pack" id="hud-pack"></div></div>' +
    '<div class="hud-right">' +
      '<button id="btn-zantie" class="zantie-btn" type="button" aria-label="">' +
        '<span class="zantie-label" data-i18n="hud.zantie"></span><b id="hud-zantie">0</b>' +
      '</button>' +
    '</div>';

  const levelEl = el.querySelector('#hud-level');
  const knivesEl = el.querySelector('#hud-knives');
  const scoreEl = el.querySelector('#hud-score');
  const packEl = el.querySelector('#hud-pack');
  const zantieEl = el.querySelector('#btn-zantie');
  const zantieCountEl = el.querySelector('#hud-zantie');

  function packName(pack) {
    const key = 'pack.' + pack;
    const text = t(key);
    return text !== key ? text : pack;
  }

  return {
    el,
    setHud(h) {
      h = h || {};
      levelEl.textContent = String(h.level ?? 1);
      knivesEl.textContent = String(Math.max(0, Math.floor(h.knivesRemaining ?? 0)));
      scoreEl.textContent = String(h.score ?? 0);
      packEl.textContent = packName(h.pack || 'bamboo');
      zantieCountEl.textContent = String(h.zantieCharges ?? 0);
      zantieEl.classList.toggle('on', !!(h.zantieActive));
      zantieEl.classList.toggle('disabled', !(h.zantieCharges > 0));
      zantieEl.setAttribute('aria-label', t('hud.zantieHint'));
    },
    show() { el.classList.remove('hidden'); el.setAttribute('aria-hidden', 'false'); },
    hide() { el.classList.add('hidden'); el.setAttribute('aria-hidden', 'true'); },
  };
}
