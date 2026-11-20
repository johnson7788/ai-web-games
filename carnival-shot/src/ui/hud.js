// src/ui/hud.js — HUD：分数 / 关卡 / 时间 / 弹药 / 连击 / 换弹进度 / 速装匣 / 双倍。
// 数据由 main 每帧喂入 setHud(run.getHud())；本文件不碰 sim、不读存档。
import { t } from '../core/i18n.js';
import { MAGAZINE } from '../../config/gameplay.js';

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
      '<div class="hud-stat hud-score"><span class="hud-label" data-i18n="hud.score"></span><b id="hud-score">0</b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.level"></span><b id="hud-level">1</b><i id="hud-level-name"></i></div>' +
      '<div class="hud-target">' +
        '<span class="hud-label" data-i18n="hud.target"></span>' +
        '<div class="hud-target-track"><i class="hud-target-fill" id="hud-target-fill"></i></div>' +
        '<b id="hud-target-text">0/0</b>' +
      '</div>' +
    '</div>' +
    '<div class="hud-center">' +
      '<div class="hud-time" id="hud-time">0</div>' +
      '<div class="hud-combo" id="hud-combo-wrap"><span data-i18n="hud.combo"></span><b id="hud-combo">×0</b></div>' +
      '<div class="hud-badge hidden" id="hud-double">×2</div>' +
    '</div>' +
    '<div class="hud-right">' +
      '<div class="hud-ammo">' +
        '<span class="hud-label" data-i18n="hud.ammo"></span>' +
        '<div class="hud-ammo-icons" id="hud-ammo-icons"></div>' +
      '</div>' +
      '<div class="hud-reload hidden" id="hud-reload">' +
        '<span class="hud-label" data-i18n="hud.reload"></span>' +
        '<div class="hud-reload-track"><i class="hud-reload-fill" id="hud-reload-fill"></i></div>' +
      '</div>' +
      '<div class="hud-badge hud-quick hidden" id="hud-quick" data-i18n="hud.quick"></div>' +
    '</div>';

  const scoreEl = el.querySelector('#hud-score');
  const levelEl = el.querySelector('#hud-level');
  const levelNameEl = el.querySelector('#hud-level-name');
  const targetFill = el.querySelector('#hud-target-fill');
  const targetText = el.querySelector('#hud-target-text');
  const timeEl = el.querySelector('#hud-time');
  const comboEl = el.querySelector('#hud-combo');
  const comboWrap = el.querySelector('#hud-combo-wrap');
  const doubleEl = el.querySelector('#hud-double');
  const ammoIcons = el.querySelector('#hud-ammo-icons');
  const reloadWrap = el.querySelector('#hud-reload');
  const reloadFill = el.querySelector('#hud-reload-fill');
  const quickEl = el.querySelector('#hud-quick');

  // 预生成弹药图标
  for (let i = 0; i < MAGAZINE.SIZE; i += 1) {
    const b = document.createElement('i');
    b.className = 'ammo-icon';
    ammoIcons.appendChild(b);
  }

  return {
    el,
    setHud(h) {
      h = h || {};
      scoreEl.textContent = String(Math.max(0, Math.floor(h.score ?? 0)));
      levelEl.textContent = String(h.level ?? 1);
      levelNameEl.textContent = h.levelName ? t(h.levelName) : '';
      timeEl.textContent = String(Math.max(0, Math.ceil(h.timeLeft ?? 0)));

      // 目标分进度
      const target = Math.max(1, h.targetScore ?? 0);
      const lv = h.levelScore ?? 0;
      const ratio = Math.max(0, Math.min(1, lv / target));
      targetFill.style.width = (ratio * 100).toFixed(1) + '%';
      targetText.textContent = `${Math.floor(lv)}/${target}`;

      // 连击
      const combo = Math.max(0, Math.floor(h.combo ?? 0));
      comboEl.textContent = '×' + combo;
      comboWrap.classList.toggle('hidden', combo < 2);
      doubleEl.classList.toggle('hidden', !h.doubleActive);

      // 弹药图标
      const icons = ammoIcons.children;
      for (let i = 0; i < icons.length; i += 1) {
        icons[i].classList.toggle('on', i < (h.ammo ?? 0));
      }

      // 换弹进度
      const reloading = !!h.reloading;
      reloadWrap.classList.toggle('hidden', !reloading);
      if (reloading) reloadFill.style.width = ((h.reloadProgress ?? 0) * 100).toFixed(1) + '%';

      // 速装匣
      quickEl.classList.toggle('hidden', !h.quickLoad);
    },
    show() { el.classList.remove('hidden'); el.setAttribute('aria-hidden', 'false'); },
    hide() { el.classList.add('hidden'); el.setAttribute('aria-hidden', 'true'); },
  };
}
