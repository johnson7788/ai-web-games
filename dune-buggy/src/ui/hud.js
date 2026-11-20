// src/ui/hud.js — HUD：赛段 / 计时 / 目标 / 速度 / 胎压 / 进度条 / 最佳
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
    '<div class="hud-top">' +
      '<div class="hud-left">' +
        '<div class="hud-stat"><span class="hud-label" data-i18n="hud.stage"></span><b id="hud-stage">1</b><span class="hud-name" id="hud-stage-name"></span></div>' +
        '<div class="hud-stat"><span class="hud-label" data-i18n="hud.time"></span><b id="hud-time">0.0</b><i class="hud-unit">s</i></div>' +
        '<div class="hud-stat"><span class="hud-label" data-i18n="hud.target"></span><b id="hud-target">0</b><i class="hud-unit">s</i></div>' +
      '</div>' +
      '<div class="hud-right">' +
        '<div class="hud-stat"><span class="hud-label" data-i18n="hud.speed"></span><b id="hud-speed">0</b><i class="hud-unit">km/h</i></div>' +
        '<div class="hud-stat" id="hud-pressure-box"><span class="hud-label" data-i18n="hud.pressure"></span><b id="hud-pressure">H</b></div>' +
        '<div class="hud-stat"><span class="hud-label" data-i18n="hud.best"></span><b id="hud-best">—</b><i class="hud-unit">s</i></div>' +
      '</div>' +
    '</div>' +
    '<div class="hud-progress"><i class="hud-progress-fill" id="hud-progress-fill"></i></div>' +
    '<div class="hud-flag hidden" id="hud-ridge" data-i18n="hud.ridge"></div>' +
    '<div class="hud-flag danger hidden" id="hud-offtrack" data-i18n="hud.offtrack"></div>';

  const stageEl = el.querySelector('#hud-stage');
  const stageNameEl = el.querySelector('#hud-stage-name');
  const timeEl = el.querySelector('#hud-time');
  const targetEl = el.querySelector('#hud-target');
  const speedEl = el.querySelector('#hud-speed');
  const pressureEl = el.querySelector('#hud-pressure');
  const pressureBoxEl = el.querySelector('#hud-pressure-box');
  const bestEl = el.querySelector('#hud-best');
  const fillEl = el.querySelector('#hud-progress-fill');
  const ridgeEl = el.querySelector('#hud-ridge');
  const offtrackEl = el.querySelector('#hud-offtrack');

  function stageLabel(stage, stageName) {
    const key = stageName;
    const text = t(key);
    return text !== key ? text : (stageName || '');
  }

  function fmtTime(v) {
    return (Number(v) || 0).toFixed(1);
  }

  return {
    el,
    setHud(h) {
      h = h || {};
      stageEl.textContent = String(Math.max(1, Math.floor(h.stage ?? 1)));
      stageNameEl.textContent = stageLabel(h.stage, h.stageName);
      timeEl.textContent = fmtTime(h.time);
      targetEl.textContent = String(Math.max(0, Math.floor(h.parSec ?? 0)));
      speedEl.textContent = String(Math.max(0, Math.floor(h.speedKmh ?? 0)));
      pressureEl.textContent = h.pressure === 'low' ? t('pressure.low') : t('pressure.high');
      pressureBoxEl.classList.toggle('low', h.pressure === 'low');
      pressureBoxEl.classList.toggle('high', h.pressure !== 'low');
      bestEl.textContent = h.fastestStage > 0 ? fmtTime(h.fastestStage) : '—';
      fillEl.style.width = `${Math.max(0, Math.min(1, h.progress ?? 0)) * 100}%`;
      ridgeEl.classList.toggle('hidden', !h.onRidge);
      offtrackEl.classList.toggle('hidden', !h.offTrack);
    },
    show() { el.classList.remove('hidden'); el.setAttribute('aria-hidden', 'false'); },
    hide() { el.classList.add('hidden'); el.setAttribute('aria-hidden', 'true'); },
  };
}
