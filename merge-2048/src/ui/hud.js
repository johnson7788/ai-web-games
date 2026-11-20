// src/ui/hud.js — HUD：得分 / 最大舰 / 星区 / 目标 / 步数 / 跃迁按钮。
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
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.best"></span><b id="hud-best">0</b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.moves"></span><b id="hud-moves">0</b></div>' +
    '</div>' +
    '<div class="hud-center">' +
      '<div class="hud-zone" id="hud-level"></div>' +
      '<div class="hud-goal" id="hud-goal"></div>' +
    '</div>' +
    '<div class="hud-right">' +
      '<button id="btn-warp" class="btn btn-warp" type="button"></button>' +
      '<div class="hud-warp-hint hidden" id="hud-warp-hint" data-i18n="hud.warpReady"></div>' +
    '</div>';

  const scoreEl = el.querySelector('#hud-score');
  const bestEl = el.querySelector('#hud-best');
  const movesEl = el.querySelector('#hud-moves');
  const levelEl = el.querySelector('#hud-level');
  const goalEl = el.querySelector('#hud-goal');
  const warpBtn = el.querySelector('#btn-warp');
  const warpHint = el.querySelector('#hud-warp-hint');

  return {
    el,
    warpBtn,
    setHud(h) {
      h = h || {};
      scoreEl.textContent = String(Math.max(0, Math.floor(h.score ?? 0)));
      bestEl.textContent = String(Math.max(0, Math.floor(h.runBest ?? 0)));
      movesEl.textContent = String(Math.max(0, Math.floor(h.moves ?? 0)));
      levelEl.textContent = `${t('hud.level')} ${h.level ?? 1}`;
      goalEl.textContent = `${t('hud.target')} ${h.target ?? 0}t`;

      const left = Math.max(0, h.warpLeft ?? 0);
      warpBtn.textContent = `${t('btn.warp')} ×${left}`;
      warpBtn.classList.toggle('disabled', left <= 0);
      warpBtn.disabled = left <= 0;
      warpHint.classList.toggle('hidden', true);
    },
    setSelecting(on) {
      warpHint.classList.toggle('hidden', !on);
      warpBtn.classList.toggle('active', !!on);
    },
    show() { el.classList.remove('hidden'); el.setAttribute('aria-hidden', 'false'); },
    hide() { el.classList.add('hidden'); el.setAttribute('aria-hidden', 'true'); },
  };
}
