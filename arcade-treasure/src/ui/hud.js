// src/ui/hud.js — HUD：代币 / 段位 / 得分 / 目标 / 热度 / 时间 / 生命 / 连击。
// 数据由 main 每帧喂入 setHud(run.getHud())；本文件不碰 sim、不读存档。
import { t } from '../core/i18n.js';

function fmt(n) { return String(Math.max(0, Math.floor(n ?? 0))); }

export function createHud(root) {
  let el = root.querySelector('#hud');
  if (!el) { el = document.createElement('div'); el.id = 'hud'; root.appendChild(el); }
  el.className = 'hud hidden';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML =
    '<div class="hud-left">' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.tokens"></span><b id="hud-tokens">0</b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.rank"></span><b id="hud-rank">1</b></div>' +
      '<div class="hud-stat hud-machine-only hidden"><span class="hud-label" data-i18n="hud.heat"></span><b id="hud-heat">×1.0</b></div>' +
    '</div>' +
    '<div class="hud-center"><div class="hud-zone" id="hud-machine-name"></div></div>' +
    '<div class="hud-right">' +
      '<div class="hud-stat hud-machine-only hidden"><span class="hud-label" data-i18n="hud.score"></span><b id="hud-score">0</b></div>' +
      '<div class="hud-stat hud-machine-only hidden"><span class="hud-label" data-i18n="hud.target"></span><b id="hud-target">0</b></div>' +
      '<div class="hud-stat hud-machine-only hidden"><span class="hud-label" data-i18n="hud.time"></span><b id="hud-time">0</b></div>' +
      '<div class="hud-stat hud-lives hidden"><span class="hud-label" data-i18n="hud.lives"></span><b id="hud-lives">0</b></div>' +
      '<div class="hud-stat hud-combo hidden"><span class="hud-label" data-i18n="hud.combo"></span><b id="hud-combo">0</b></div>' +
    '</div>';

  const tokensEl = el.querySelector('#hud-tokens');
  const rankEl = el.querySelector('#hud-rank');
  const heatEl = el.querySelector('#hud-heat');
  const machineNameEl = el.querySelector('#hud-machine-name');
  const scoreEl = el.querySelector('#hud-score');
  const targetEl = el.querySelector('#hud-target');
  const timeEl = el.querySelector('#hud-time');
  const livesEl = el.querySelector('#hud-lives');
  const comboEl = el.querySelector('#hud-combo');

  function machineName(m) {
    if (m == null) return '';
    const key = 'machine.' + m;
    const text = t(key);
    return text !== key ? text : '';
  }

  return {
    el,
    setHud(h) {
      h = h || {};
      tokensEl.textContent = fmt(h.tokens);
      rankEl.textContent = fmt(h.rank);
      heatEl.textContent = '×' + (h.heatMult ?? 1).toFixed(1);
      const inMachine = h.machine != null;
      el.querySelectorAll('.hud-machine-only').forEach((n) => n.classList.toggle('hidden', !inMachine));
      machineNameEl.textContent = machineName(h.machine);
      machineNameEl.classList.toggle('hidden', !inMachine);
      if (inMachine) {
        scoreEl.textContent = fmt(h.score);
        targetEl.textContent = fmt(h.target);
        timeEl.textContent = String(Math.max(0, Math.ceil((h.timeLimit ?? 0) - (h.time ?? 0))));
        const hasLives = (h.livesMax ?? 0) > 0;
        el.querySelector('.hud-lives').classList.toggle('hidden', !hasLives);
        if (hasLives) livesEl.textContent = fmt(h.lives);
        const hasCombo = h.machine === 1;
        el.querySelector('.hud-combo').classList.toggle('hidden', !hasCombo);
        if (hasCombo) comboEl.textContent = fmt(h.combo);
      }
    },
    show() { el.classList.remove('hidden'); el.setAttribute('aria-hidden', 'false'); },
    hide() { el.classList.add('hidden'); el.setAttribute('aria-hidden', 'true'); },
  };
}
