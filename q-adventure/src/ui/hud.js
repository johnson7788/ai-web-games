// src/ui/hud.js — HUD：关卡名 / 血量 / 星星 / 金币 / 目标方向 / 鼓点指示。
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
        '<div class="hud-chip"><span class="hud-label" data-i18n="hud.level"></span><b id="hud-level"></b></div>' +
        '<div class="hud-chip"><span class="hud-label" data-i18n="hud.hp"></span><b id="hud-hp"></b></div>' +
      '</div>' +
      '<div class="hud-center" id="hud-goal"><span class="hud-goal-arrow">→</span><b id="hud-goal-label" data-i18n="hud.goal"></b></div>' +
      '<div class="hud-right">' +
        '<div class="hud-chip"><span class="hud-label" data-i18n="hud.stars"></span><b id="hud-stars"></b></div>' +
        '<div class="hud-chip"><span class="hud-label" data-i18n="hud.coins"></span><b id="hud-coins"></b></div>' +
      '</div>' +
    '</div>';

  const levelEl = el.querySelector('#hud-level');
  const hpEl = el.querySelector('#hud-hp');
  const starsEl = el.querySelector('#hud-stars');
  const coinsEl = el.querySelector('#hud-coins');
  const goalEl = el.querySelector('#hud-goal');
  const goalLabel = el.querySelector('#hud-goal-label');
  const beatFlash = el.querySelector('#hud-goal');

  return {
    el,
    setHud(h) {
      h = h || {};
      levelEl.textContent = t(h.levelName || 'level.1');
      const hp = Math.max(0, Math.floor(h.hp ?? 0));
      hpEl.textContent = '♥'.repeat(hp) + ' ' + hp + '/' + (h.maxHp ?? 3);
      starsEl.textContent = `${h.stars ?? 0}/3`;
      coinsEl.textContent = String(Math.floor(h.coins ?? 0));
      // 目标方向：玩家在目标左侧→右箭头，右侧→左箭头
      const ahead = (h.goalX ?? 0) - (h.playerX ?? 0);
      goalEl.querySelector('.hud-goal-arrow').textContent = ahead >= 0 ? '→' : '←';
      goalLabel.textContent = t('hud.goal');
      // 鼓点指示：HUD 目标 chip 上轻微脉冲
      goalEl.classList.toggle('beat-on', !!h.beat);
    },
    show() { el.classList.remove('hidden'); el.setAttribute('aria-hidden', 'false'); },
    hide() { el.classList.add('hidden'); el.setAttribute('aria-hidden', 'true'); },
  };
}
