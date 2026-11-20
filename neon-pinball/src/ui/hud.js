// src/ui/hud.js — HUD：分数 / 球数 / 台面目标 / 倍率 / 连击 / 超导态进度
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
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.score"></span><b id="hud-score">0</b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.balls"></span><b id="hud-balls">3</b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.mult"></span><b id="hud-mult">×1</b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.combo"></span><b id="hud-combo">0</b></div>' +
    '</div>' +
    '<div class="hud-center">' +
      '<div class="hud-machine" id="hud-machine"></div>' +
      '<div class="hud-target" id="hud-target"></div>' +
    '</div>' +
    '<div class="hud-right">' +
      '<div class="super-meter" id="super-meter">' +
        '<div class="super-track"><i class="super-fill" id="super-fill"></i></div>' +
        '<span class="super-label" data-i18n="hud.super"></span>' +
      '</div>' +
      '<div class="hud-launch-hint" id="hud-launch-hint" data-i18n="hud.launch"></div>' +
    '</div>';

  const scoreEl = el.querySelector('#hud-score');
  const ballsEl = el.querySelector('#hud-balls');
  const multEl = el.querySelector('#hud-mult');
  const comboEl = el.querySelector('#hud-combo');
  const machineEl = el.querySelector('#hud-machine');
  const targetEl = el.querySelector('#hud-target');
  const superFill = el.querySelector('#super-fill');
  const superMeter = el.querySelector('#super-meter');
  const launchHint = el.querySelector('#hud-launch-hint');

  return {
    el,
    setHud(h) {
      h = h || {};
      scoreEl.textContent = String(Math.max(0, Math.floor(h.score ?? 0)));
      ballsEl.textContent = String(Math.max(0, Math.floor(h.ballsLeft ?? 0)));
      multEl.textContent = '×' + (h.multiplier ?? 1);
      comboEl.textContent = String(Math.max(0, Math.floor(h.combo ?? 0)));
      machineEl.textContent = t('title.machine', { n: h.machine ?? 1 });
      targetEl.textContent = t('hud.target') + ': ' + Math.max(0, Math.floor(h.targetScore ?? 0));
      const superOn = (h.superconductT ?? 0) > 0;
      superMeter.classList.toggle('on', superOn);
      superFill.style.width = Math.min(100, ((h.superconductT ?? 0) / 20) * 100).toFixed(1) + '%';
      const readyBall = h.ballsInPlay === 0;
      launchHint.classList.toggle('hidden', !readyBall);
    },
    show() { el.classList.remove('hidden'); el.setAttribute('aria-hidden', 'false'); },
    hide() { el.classList.add('hidden'); el.setAttribute('aria-hidden', 'true'); },
  };
}
