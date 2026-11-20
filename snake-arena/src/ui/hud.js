// src/ui/hud.js — HUD：场次 / 长度 / 名次 / 时间 / 击杀 / 超频与脉冲状态。
// 数据由 main 每帧喂入 setHud(run.getHud())；本文件不碰 sim、不读存档。
import { t } from '../core/i18n.js';

function mmss(s) {
  const a = Math.max(0, Math.floor(s));
  const m = Math.floor(a / 60);
  const ss = a % 60;
  return m + ':' + (ss > 9 ? ss : '0' + ss);
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
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.round"></span><b id="hud-round">1</b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.length"></span><b id="hud-length">8</b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.rank"></span><b id="hud-rank">1</b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.kills"></span><b id="hud-kills">0</b></div>' +
    '</div>' +
    '<div class="hud-center"><div class="hud-zone" id="hud-zone"></div></div>' +
    '<div class="hud-right">' +
      '<div class="hud-time" id="hud-time">1:30</div>' +
      '<div class="pulse-wrap">' +
        '<div class="pulse-track"><i class="pulse-fill" id="pulse-fill"></i></div>' +
        '<span class="pulse-label" data-i18n="hud.pulse"></span>' +
      '</div>' +
    '</div>';

  const roundEl = el.querySelector('#hud-round');
  const lengthEl = el.querySelector('#hud-length');
  const rankEl = el.querySelector('#hud-rank');
  const killsEl = el.querySelector('#hud-kills');
  const zoneEl = el.querySelector('#hud-zone');
  const timeEl = el.querySelector('#hud-time');
  const pulseFill = el.querySelector('#pulse-fill');

  function roundName(key) {
    const text = t(key);
    return text !== key ? text : '';
  }

  function themeName(key) {
    const text = t(key);
    return text !== key ? text : '';
  }

  return {
    el,
    setHud(h) {
      h = h || {};
      roundEl.textContent = String(h.round ?? 1);
      lengthEl.textContent = String(h.length ?? 0);
      rankEl.textContent = '#' + String(h.rank ?? 1);
      killsEl.textContent = String(h.kills ?? 0);
      timeEl.textContent = mmss(h.roundTime ?? 0);
      zoneEl.textContent = roundName(h.roundName) + ' · ' + t('hud.goal');
      pulseFill.style.width = ((h.pulseCharge ?? 0) * 100).toFixed(1) + '%';
      pulseFill.parentElement.classList.toggle('ready', !!h.pulseReady);
    },
    show() { el.classList.remove('hidden'); el.setAttribute('aria-hidden', 'false'); },
    hide() { el.classList.add('hidden'); el.setAttribute('aria-hidden', 'true'); },
  };
}
