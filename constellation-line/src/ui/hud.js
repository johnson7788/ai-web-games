// src/ui/hud.js — HUD：关卡/星座名、计时条、步数、剩余线段、失误、北极星提示。
// 只负责搭 DOM 与填数；文案走 data-i18n，由 index.js 统一 applyLang。
import { i18n, t } from '../core/i18n.js';
import { getLevel } from '../../config/levels.js';

export function createHud(root) {
  let node = root.querySelector('#hud');
  if (!node) {
    node = document.createElement('div');
    node.id = 'hud';
    node.className = 'hud hidden';
    root.appendChild(node);
  }
  node.innerHTML =
    '<div class="hud-left">' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.level"></span><b id="hud-level">1</b></div>' +
      '<div class="hud-name" id="hud-name"></div>' +
    '</div>' +
    '<div class="hud-center">' +
      '<div class="hud-goal" data-i18n="hud.goal"></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.time"></span><b id="hud-time">0s</b></div>' +
      '<div class="hud-track"><i class="hud-track-fill" id="hud-track-fill"></i></div>' +
    '</div>' +
    '<div class="hud-right">' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.steps"></span><b id="hud-steps">0</b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.left"></span><b id="hud-left">0</b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.mistakes"></span><b id="hud-mistakes">0</b></div>' +
      '<div class="hud-waypoint hidden" id="hud-waypoint" data-i18n="hud.waypoint"></div>' +
    '</div>';

  const els = {
    level: node.querySelector('#hud-level'),
    name: node.querySelector('#hud-name'),
    time: node.querySelector('#hud-time'),
    steps: node.querySelector('#hud-steps'),
    left: node.querySelector('#hud-left'),
    mistakes: node.querySelector('#hud-mistakes'),
    waypoint: node.querySelector('#hud-waypoint'),
    trackFill: node.querySelector('#hud-track-fill'),
  };

  function localizedName(levelIndex, enName) {
    if (i18n.lang === 'zh') {
      const lv = getLevel(levelIndex - 1);
      if (lv && lv.zhName) return lv.zhName;
    }
    return enName;
  }

  function setHud(h) {
    h = h || {};
    els.level.textContent = String(h.level ?? 1);
    els.name.textContent = localizedName(h.level, h.levelName || '');
    els.time.textContent = Math.ceil(Math.max(0, h.timeLimit - h.time)) + 's';
    els.steps.textContent = String(h.steps ?? 0);
    els.left.textContent = String(h.remaining ?? 0);
    els.mistakes.textContent = String(h.mistakes ?? 0);
    els.waypoint.classList.toggle('hidden', !h.waypointReached);
    els.waypoint.classList.toggle('done', !!h.waypointReached);
    const frac = h.timeLimit ? Math.max(0, Math.min(1, h.time / h.timeLimit)) : 0;
    els.trackFill.style.width = (frac * 100).toFixed(1) + '%';
    node.classList.toggle('meteor', !!h.meteorBlocked);
  }

  function show() { node.classList.remove('hidden'); }
  function hide() { node.classList.add('hidden'); }

  return { els, setHud, show, hide, root: node };
}
