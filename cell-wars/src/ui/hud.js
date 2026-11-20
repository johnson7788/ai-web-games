// src/ui/hud.js — HUD：皿数 / 回合 / 蓝红领土 / 噬菌体充能 / 底部操作提示。
// 数据由 main 每帧喂入 setHud(run.getHud())；本文件不碰 sim、不读存档。
import { t } from '../core/i18n.js';
import { PHAGE } from '../../config/gameplay.js';

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
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.dish"></span><b id="hud-dish">1/12</b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.rounds"></span><b id="hud-rounds">0</b></div>' +
      '<div class="hud-stat hud-terr">' +
        '<span class="hud-dot hud-dot-blue"></span><b id="hud-blue">0</b>' +
        '<span class="hud-dot hud-dot-red"></span><b id="hud-red">0</b>' +
      '</div>' +
    '</div>' +
    '<div class="hud-center"><div class="hud-turn" id="hud-turn"></div></div>' +
    '<div class="hud-right">' +
      '<button id="btn-phage" class="hud-phage" type="button"><span class="phage-icon">🧬</span><span id="hud-phage-label"></span></button>' +
    '</div>' +
    '<div class="hud-hint" id="hud-hint"></div>';

  const dishEl = el.querySelector('#hud-dish');
  const roundsEl = el.querySelector('#hud-rounds');
  const blueEl = el.querySelector('#hud-blue');
  const redEl = el.querySelector('#hud-red');
  const turnEl = el.querySelector('#hud-turn');
  const phageBtn = el.querySelector('#btn-phage');
  const phageLabel = el.querySelector('#hud-phage-label');
  const hintEl = el.querySelector('#hud-hint');

  let phageMode = false;

  function setPhageMode(on) {
    phageMode = !!on;
    phageBtn.classList.toggle('active', phageMode);
  }

  return {
    el,
    els: { phageBtn },
    setPhageMode,
    get phageMode() { return phageMode; },
    setHud(h) {
      h = h || {};
      dishEl.textContent = `${h.dish}/${h.totalDishes}`;
      roundsEl.textContent = `${h.rounds}/${h.maxRounds}`;
      blueEl.textContent = String(h.playerCells ?? 0);
      redEl.textContent = String(h.enemyCells ?? 0);
      turnEl.textContent = h.turn === 'player' ? t('hud.yourTurn') : t('hud.enemyTurn');
      turnEl.classList.toggle('enemy', h.turn !== 'player');
      if (h.playerPhageReady) {
        phageLabel.textContent = t('hud.phageReady');
        phageBtn.classList.add('ready');
      } else {
        phageLabel.textContent = t('hud.phageCharging', { n: Math.max(0, PHAGE.CHARGE_TURNS - (h.playerPhageCooldown ?? 0)), total: PHAGE.CHARGE_TURNS });
        phageBtn.classList.remove('ready');
      }
      if (h.turn === 'player') {
        hintEl.textContent = phageMode ? t('hint.selectPhage') : t('hint.tapEnemy');
      } else {
        hintEl.textContent = '';
      }
    },
    show() { el.classList.remove('hidden'); el.setAttribute('aria-hidden', 'false'); },
    hide() { el.classList.add('hidden'); el.setAttribute('aria-hidden', 'true'); },
  };
}
