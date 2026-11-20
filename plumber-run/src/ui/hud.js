// src/ui/hud.js — HUD：关卡 / 金币 / 生命 / 蒸汽罐 / 得分。
// 数据由 main 每帧喂入 setHud(run.getHud())；本文件不碰 sim、不读存档。
import { t } from '../core/i18n.js';
import { FORM, STEAM } from '../../config/gameplay.js';

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
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.coins"></span><b id="hud-coins">0</b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.lives"></span><b id="hud-lives">3</b></div>' +
    '</div>' +
    '<div class="hud-center"><div class="hud-zone" id="hud-zone"></div></div>' +
    '<div class="hud-right">' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.score"></span><b id="hud-score">0</b></div>' +
      '<div class="steam-meter" id="steam-meter">' +
        '<div class="steam-track"><i class="steam-fill" id="steam-fill"></i></div>' +
        '<span class="steam-label" data-i18n="hud.steam"></span>' +
      '</div>' +
      '<div class="form-chip" id="form-chip"></div>' +
    '</div>';

  const levelEl = el.querySelector('#hud-level');
  const coinsEl = el.querySelector('#hud-coins');
  const livesEl = el.querySelector('#hud-lives');
  const scoreEl = el.querySelector('#hud-score');
  const zoneEl = el.querySelector('#hud-zone');
  const steamFill = el.querySelector('#steam-fill');
  const formChip = el.querySelector('#form-chip');

  function formLabel(form) {
    const key = form === FORM.SMALL ? 'hud.form.small' : form === FORM.BIG ? 'hud.form.big' : 'hud.form.fire';
    return t(key);
  }

  function zoneName(level, levelName) {
    const key = `level.${level}`;
    const text = t(key);
    return text !== key ? text : (levelName || '');
  }

  return {
    el,
    setHud(h) {
      h = h || {};
      levelEl.textContent = String(Math.max(1, Math.floor(h.level ?? 1)));
      coinsEl.textContent = String(Math.max(0, Math.floor(h.coins ?? 0)));
      livesEl.textContent = String(Math.max(0, Math.floor(h.lives ?? 0)));
      scoreEl.textContent = String(Math.max(0, Math.floor(h.score ?? 0)));
      zoneEl.textContent = zoneName(Number(h.level) || 1, h.levelName);
      const steam = Math.max(0, Math.min(STEAM.MAX, h.steam ?? 0));
      steamFill.style.width = (steam / STEAM.MAX * 100).toFixed(1) + '%';
      formChip.textContent = formLabel(Number(h.form) || FORM.SMALL);
      formChip.className = 'form-chip form-' + (Number(h.form) || FORM.SMALL);
    },
    show() { el.classList.remove('hidden'); el.setAttribute('aria-hidden', 'false'); },
    hide() { el.classList.add('hidden'); el.setAttribute('aria-hidden', 'true'); },
  };
}
