// src/ui/hud.js — HUD：关卡/场景、得分/目标、连消/步数、矿镐蓄力条 + 淘洗/矿镐按钮。
import { t } from '../core/i18n.js';
import { PICKAXE } from '../../config/gameplay.js';

export function createHud(root) {
  let el = root.querySelector('#hud');
  if (!el) {
    el = document.createElement('div');
    el.id = 'hud';
    root.appendChild(el);
  }
  el.className = 'hud hidden';
  el.innerHTML =
    '<div class="hud-top">' +
      '<div class="hud-left">' +
        '<div class="hud-stat"><span class="hud-label" data-i18n="hud.level"></span><b id="hud-level">1</b></div>' +
        '<div class="hud-scene" id="hud-scene"></div>' +
        '<div class="hud-feat" id="hud-feat"></div>' +
      '</div>' +
      '<div class="hud-mid">' +
        '<div class="hud-stat"><span class="hud-label" data-i18n="hud.score"></span><b id="hud-score">0</b></div>' +
        '<div class="hud-stat"><span class="hud-label" data-i18n="hud.target"></span><b id="hud-target">0</b></div>' +
      '</div>' +
      '<div class="hud-right">' +
        '<div class="hud-stat" id="hud-streak-stat"><span class="hud-label" data-i18n="hud.streak"></span><b id="hud-streak">0</b></div>' +
        '<div class="hud-stat" id="hud-moves-stat"><span class="hud-label" data-i18n="hud.moves"></span><b id="hud-moves">—</b></div>' +
      '</div>' +
    '</div>' +
    '<div class="hud-actions">' +
      '<button id="btn-pick" class="btn btn-action" type="button" data-i18n="btn.pick" aria-label="Pickaxe">' +
        '<span id="hud-pick-label" data-i18n="btn.pick"></span><i class="charge-dots" id="hud-pick-charge"></i>' +
      '</button>' +
      '<button id="btn-wash" class="btn btn-action" type="button" data-i18n="btn.wash" aria-label="Wash">' +
        '<span id="hud-wash-label" data-i18n="btn.wash"></span><i class="wash-left" id="hud-wash-left"></i>' +
      '</button>' +
    '</div>';

  const levelEl = el.querySelector('#hud-level');
  const sceneEl = el.querySelector('#hud-scene');
  const featEl = el.querySelector('#hud-feat');
  const scoreEl = el.querySelector('#hud-score');
  const targetEl = el.querySelector('#hud-target');
  const streakEl = el.querySelector('#hud-streak');
  const streakStat = el.querySelector('#hud-streak-stat');
  const movesEl = el.querySelector('#hud-moves');
  const movesStat = el.querySelector('#hud-moves-stat');
  const pickCharge = el.querySelector('#hud-pick-charge');
  const pickBtn = el.querySelector('#btn-pick');
  const washBtn = el.querySelector('#btn-wash');
  const washLeft = el.querySelector('#hud-wash-left');

  function dots(n, max) {
    let s = '';
    for (let i = 0; i < max; i += 1) s += i < n ? '●' : '○';
    return s;
  }

  return {
    el,
    els: { pick: pickBtn, wash: washBtn },
    setHud(h) {
      h = h || {};
      levelEl.textContent = String(h.level ?? 1);
      sceneEl.textContent = t(h.scene || 'scene.1');
      featEl.textContent = t(h.feat || 'feat.1');
      scoreEl.textContent = String(Math.max(0, Math.floor(h.score ?? 0)));
      targetEl.textContent = String(Math.max(0, Math.floor(h.target ?? 0)));
      streakEl.textContent = String(Math.max(0, Math.floor(h.streak ?? 0)));
      movesEl.textContent = h.movesLeft == null ? '∞' : String(Math.max(0, h.movesLeft));
      movesStat.classList.toggle('warn', h.movesLeft != null && h.movesLeft <= 5);

      const charge = Math.max(0, Math.floor(h.charge ?? 0));
      pickCharge.textContent = dots(charge, PICKAXE.MAX_CHARGE);
      pickBtn.classList.toggle('ready', charge >= PICKAXE.MAX_CHARGE);
      pickBtn.classList.toggle('disabled', charge < PICKAXE.MAX_CHARGE);

      washLeft.textContent = `×${Math.max(0, h.washLeft ?? 0)}`;
      washBtn.classList.toggle('disabled', (h.washLeft ?? 0) <= 0);
    },
    show() { el.classList.remove('hidden'); },
    hide() { el.classList.add('hidden'); },
  };
}
