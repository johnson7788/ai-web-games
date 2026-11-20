// src/ui/hud.js — HUD：生命条 / 弹药 / 护盾 / 武器名 / 波次 / 场景 / 分数。
// 数据由 main 每帧喂入 setHud(run.getHud())；本文件不碰 sim、不读存档。
import { t } from '../core/i18n.js';

function clamp01(v, max) {
  const n = Number(v) || 0;
  return Math.min(1, Math.max(0, n / (max || 1)));
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
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.hp"></span><div class="hud-bar"><i class="hud-fill" id="hud-hp-fill"></i></div><b id="hud-hp">0</b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.shield"></span><div class="hud-bar"><i class="hud-fill shield" id="hud-shield-fill"></i></div><b id="hud-shield">0</b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.ammo"></span><b id="hud-ammo">0</b></div>' +
    '</div>' +
    '<div class="hud-center">' +
      '<div class="hud-wave" id="hud-wave"></div>' +
      '<div class="hud-zone" id="hud-zone"></div>' +
    '</div>' +
    '<div class="hud-right">' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.weapon"></span><b id="hud-weapon"></b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.score"></span><b id="hud-score">0</b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.wave"></span><b id="hud-enemies">0</b></div>' +
    '</div>';

  const hpFill = el.querySelector('#hud-hp-fill');
  const shieldFill = el.querySelector('#hud-shield-fill');
  const hpEl = el.querySelector('#hud-hp');
  const shieldEl = el.querySelector('#hud-shield');
  const ammoEl = el.querySelector('#hud-ammo');
  const weaponEl = el.querySelector('#hud-weapon');
  const scoreEl = el.querySelector('#hud-score');
  const waveEl = el.querySelector('#hud-wave');
  const zoneEl = el.querySelector('#hud-zone');
  const enemiesEl = el.querySelector('#hud-enemies');

  function zoneName(scene, sceneName) {
    const key = 'scene.' + scene;
    const text = t(key);
    return text !== key ? text : (sceneName || '');
  }

  return {
    el,
    setHud(h) {
      h = h || {};
      const hpRatio = clamp01(h.hp, h.maxHp);
      hpFill.style.width = (hpRatio * 100).toFixed(1) + '%';
      hpFill.style.background = hpRatio < 0.3 ? 'linear-gradient(90deg,#b02418,#ff5d5d)' : 'linear-gradient(90deg,#2aa95c,#7dffa0)';
      hpEl.textContent = String(Math.max(0, Math.floor(h.hp ?? 0)));

      const shieldRatio = clamp01(h.shieldEnergy, h.shieldMax);
      shieldFill.style.width = (shieldRatio * 100).toFixed(1) + '%';
      shieldEl.textContent = String(Math.max(0, Math.floor(h.shieldEnergy ?? 0)));
      shieldEl.parentElement.classList.toggle('active', !!h.shieldActive);

      ammoEl.textContent = `${h.ammo ?? 0}/${h.magSize ?? 0}${h.reloading ? ' …' : ''}`;
      weaponEl.textContent = t(h.weaponName || 'weapon.pistol');
      scoreEl.textContent = String(Math.max(0, Math.floor(h.score ?? 0)));
      waveEl.textContent = t('hud.wave') + ' ' + (h.wave || 0) + '/12';
      zoneEl.textContent = zoneName(Number(h.scene) || 1, h.sceneName);
      enemiesEl.textContent = String(Math.max(0, h.enemiesLeft ?? 0));
    },
    show() { el.classList.remove('hidden'); el.setAttribute('aria-hidden', 'false'); },
    hide() { el.classList.add('hidden'); el.setAttribute('aria-hidden', 'true'); },
  };
}
