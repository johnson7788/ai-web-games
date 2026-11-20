// src/ui/hud.js — HUD：得分 / 波次 / 生命 / 热量 / 曳光 / 战区名 / 连击。
// 数据由 main 每帧喂入 setHud(run.getHud())；本文件不碰 sim、不读存档。
import { t } from '../core/i18n.js';

function clamp01(v) {
  const n = Number(v) || 0;
  return Math.min(1, Math.max(0, n > 1 ? n / 100 : n));
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
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.score"></span><b id="hud-score">0</b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.wave"></span><b id="hud-wave">1</b><i class="hud-unit">/12</i></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.lives"></span><b id="hud-lives">3</b></div>' +
    '</div>' +
    '<div class="hud-center"><div class="hud-chapter" id="hud-chapter"></div></div>' +
    '<div class="hud-right">' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.combo"></span><b id="hud-combo">0</b><i class="hud-unit">×<span id="hud-mult">1.0</span></i></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.tracer"></span><b id="hud-tracer">1</b></div>' +
      '<div class="heat-bar" id="heat-bar">' +
        '<div class="heat-track"><i class="heat-fill" id="heat-fill"></i></div>' +
        '<span class="heat-label" data-i18n="hud.heat"></span>' +
      '</div>' +
    '</div>';

  const scoreEl = el.querySelector('#hud-score');
  const waveEl = el.querySelector('#hud-wave');
  const livesEl = el.querySelector('#hud-lives');
  const chapterEl = el.querySelector('#hud-chapter');
  const comboEl = el.querySelector('#hud-combo');
  const multEl = el.querySelector('#hud-mult');
  const tracerEl = el.querySelector('#hud-tracer');
  const heatEl = el.querySelector('#heat-bar');
  const fillEl = el.querySelector('#heat-fill');

  function chapterName(ch, chapterName) {
    const key = 'chapter.' + ch;
    const text = t(key);
    return text !== key ? text : (chapterName || '');
  }

  function setHud(h) {
    h = h || {};
    scoreEl.textContent = String(Math.max(0, Math.floor(h.score ?? 0)));
    waveEl.textContent = String(Math.max(1, Math.floor(h.wave ?? 1)));
    livesEl.textContent = String(Math.max(0, Math.floor(h.lives ?? 0)));
    chapterEl.textContent = chapterName(Number(h.chapter) || 1, h.chapterName);
    comboEl.textContent = String(Math.max(0, Math.floor(h.combo ?? 0)));
    multEl.textContent = (Number(h.mult) || 1).toFixed(1);
    tracerEl.textContent = String(Math.max(0, Math.floor(h.tracersLeft ?? 0)));

    const overheated = !!h.overheated;
    heatEl.classList.toggle('overheated', overheated);
    const fill = overheated ? 1 : clamp01(h.heat ?? 0);
    fillEl.style.width = (fill * 100).toFixed(1) + '%';
  }

  return {
    el,
    setHud,
    show() { el.classList.remove('hidden'); el.setAttribute('aria-hidden', 'false'); },
    hide() { el.classList.add('hidden'); el.setAttribute('aria-hidden', 'true'); },
  };
}
