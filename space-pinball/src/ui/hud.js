// src/ui/hud.js — HUD：分数 / 球数 / 波次 / 连击 / 反应堆灯 / 超新星进度
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
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.combo"></span><b id="hud-combo">0</b></div>' +
    '</div>' +
    '<div class="hud-center">' +
      '<div class="hud-wave" id="hud-wave"></div>' +
      '<div class="hud-reactor" id="hud-reactor" aria-label=""></div>' +
    '</div>' +
    '<div class="hud-right">' +
      '<div class="super-meter" id="super-meter">' +
        '<div class="super-track"><i class="super-fill" id="super-fill"></i></div>' +
        '<span class="super-label" data-i18n="hud.supernova"></span>' +
      '</div>' +
      '<div class="hud-launch-hint" id="hud-launch-hint" data-i18n="hud.launch"></div>' +
    '</div>';

  const scoreEl = el.querySelector('#hud-score');
  const ballsEl = el.querySelector('#hud-balls');
  const comboEl = el.querySelector('#hud-combo');
  const waveEl = el.querySelector('#hud-wave');
  const reactorEl = el.querySelector('#hud-reactor');
  const superFill = el.querySelector('#super-fill');
  const superMeter = el.querySelector('#super-meter');
  const launchHint = el.querySelector('#hud-launch-hint');

  function reactorLabel(n, mx) {
    return '◉'.repeat(Math.max(0, n)) + '◎'.repeat(Math.max(0, mx - n));
  }

  return {
    el,
    setHud(h) {
      h = h || {};
      scoreEl.textContent = String(Math.max(0, Math.floor(h.score ?? 0)));
      ballsEl.textContent = String(Math.max(0, Math.floor(h.ballsLeft ?? 0)));
      comboEl.textContent = String(Math.max(0, Math.floor(h.combo ?? 0)));
      waveEl.textContent = t('title.wave', { n: h.wave ?? 1 });
      reactorEl.textContent = reactorLabel(h.reactorLights ?? 0, h.reactorMax ?? 0);
      const superOn = (h.supernovaT ?? 0) > 0;
      superMeter.classList.toggle('on', superOn);
      superFill.style.width = Math.min(100, ((h.supernovaT ?? 0) / 10) * 100).toFixed(1) + '%';
      launchHint.classList.toggle('hidden', !((h.ballsInPlay ?? 0) === 0 && (h.phase ?? '') === 'playing'));
    },
    show() { el.classList.remove('hidden'); el.setAttribute('aria-hidden', 'false'); },
    hide() { el.classList.add('hidden'); el.setAttribute('aria-hidden', 'true'); },
  };
}
