// src/ui/hud.js — HUD：关卡 / 得分 / 连击 / 计时条 / 道具 / 炉渣 / 神兵进度。
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
    '<div class="hud-bar">' +
      '<div class="hud-left">' +
        '<div class="hud-stat"><span class="hud-label" data-i18n="hud.level"></span><b id="hud-level">1</b></div>' +
        '<div class="hud-stat"><span class="hud-label" data-i18n="hud.score"></span><b id="hud-score">0</b></div>' +
        '<div class="hud-stat"><span class="hud-label" data-i18n="hud.combo"></span><b id="hud-combo">0</b></div>' +
      '</div>' +
      '<div class="hud-center">' +
        '<div class="hud-scene" id="hud-scene"></div>' +
        '<div class="hud-time-track"><i class="hud-time-fill" id="hud-time-fill"></i></div>' +
        '<div class="hud-time-num" id="hud-time">0</div>' +
      '</div>' +
      '<div class="hud-right">' +
        '<div class="hud-stat"><span class="hud-label" data-i18n="hud.hints"></span><b id="hud-hints">0</b></div>' +
        '<div class="hud-stat"><span class="hud-label" data-i18n="hud.resets"></span><b id="hud-resets">0</b></div>' +
        '<div class="hud-stat"><span class="hud-label" data-i18n="hud.slag"></span><b id="hud-slag">0</b></div>' +
        '<div class="hud-stat"><span class="hud-label" data-i18n="hud.weapons"></span><b id="hud-weapons">0/12</b></div>' +
      '</div>' +
    '</div>';

  const levelEl = el.querySelector('#hud-level');
  const scoreEl = el.querySelector('#hud-score');
  const comboEl = el.querySelector('#hud-combo');
  const sceneEl = el.querySelector('#hud-scene');
  const timeFill = el.querySelector('#hud-time-fill');
  const timeEl = el.querySelector('#hud-time');
  const hintsEl = el.querySelector('#hud-hints');
  const resetsEl = el.querySelector('#hud-resets');
  const slagEl = el.querySelector('#hud-slag');
  const weaponsEl = el.querySelector('#hud-weapons');

  function sceneName(scene, sceneKey) {
    const key = sceneKey || 'scene.' + (scene ?? 0);
    const text = t(key);
    return text !== key ? text : '';
  }

  return {
    el,
    setHud(h) {
      h = h || {};
      levelEl.textContent = String(h.level ?? 1);
      scoreEl.textContent = String(Math.floor(h.score ?? 0));
      comboEl.textContent = String(h.combo ?? 0);
      sceneEl.textContent = sceneName(h.scene, h.sceneName);
      const ratio = (h.timeMax ?? 1) > 0 ? Math.max(0, Math.min(1, (h.timeLeft ?? 0) / h.timeMax)) : 0;
      timeFill.style.width = (ratio * 100).toFixed(1) + '%';
      timeEl.textContent = String(Math.ceil(h.timeLeft ?? 0));
      hintsEl.textContent = String(h.hints ?? 0);
      resetsEl.textContent = String(h.resets ?? 0);
      slagEl.textContent = String(h.slag ?? 0);
      weaponsEl.textContent = `${h.weapons ?? 0}/${h.weaponTotal ?? 12}`;
    },
    show() { el.classList.remove('hidden'); el.setAttribute('aria-hidden', 'false'); },
    hide() { el.classList.add('hidden'); el.setAttribute('aria-hidden', 'true'); },
  };
}
