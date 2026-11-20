// src/ui/hud.js — HUD：波次 / 硬度 / 流星数 / 场景名 / 彗星蓄力条（单行不透明条，不遮挡陨石带）。
// 数据由 main 每帧喂入 setHud(run.getHud())；本文件不碰 sim、不读存档。
import { t } from '../core/i18n.js';

export function createHud(root) {
  let elRoot = root.querySelector('#hud');
  if (!elRoot) {
    elRoot = document.createElement('div');
    elRoot.id = 'hud';
    root.appendChild(elRoot);
  }
  elRoot.className = 'hud hidden';
  elRoot.setAttribute('aria-hidden', 'true');
  elRoot.innerHTML =
    '<div class="hud-stat"><span class="hud-label" data-i18n="hud.wave"></span><b id="hud-wave">1</b></div>' +
    '<div class="hud-stat"><span class="hud-label" data-i18n="hud.score"></span><b id="hud-score">0</b></div>' +
    '<div class="hud-stat"><span class="hud-label" data-i18n="hud.balls"></span><b id="hud-balls">1</b></div>' +
    '<div class="hud-zone" id="hud-scene"></div>' +
    '<div class="comet-bar" id="comet-bar">' +
      '<div class="comet-track"><i class="comet-fill" id="comet-fill"></i></div>' +
      '<span class="comet-label" data-i18n="hud.comet"></span>' +
    '</div>';

  const waveEl = elRoot.querySelector('#hud-wave');
  const scoreEl = elRoot.querySelector('#hud-score');
  const ballsEl = elRoot.querySelector('#hud-balls');
  const sceneEl = elRoot.querySelector('#hud-scene');
  const fillEl = elRoot.querySelector('#comet-fill');

  return {
    el: elRoot,
    setHud(h) {
      h = h || {};
      waveEl.textContent = String(Number(h.wave) || 1);
      scoreEl.textContent = String(Math.max(0, Math.floor(h.score ?? 0)));
      ballsEl.textContent = String(Math.max(0, Math.floor(h.ballsPerShot ?? 0)));
      sceneEl.textContent = t('scene.' + (h.scene || 'dust'));
      const p = Math.min(1, Math.max(0, Number(h.cometProgress) || 0));
      fillEl.style.width = (p * 100).toFixed(1) + '%';
      const ready = (Number(h.comets) || 0) > 0;
      this.el.classList.toggle('comet-ready', ready);
    },
    show() { elRoot.classList.remove('hidden'); elRoot.setAttribute('aria-hidden', 'false'); },
    hide() { elRoot.classList.add('hidden'); elRoot.setAttribute('aria-hidden', 'true'); },
  };
}
