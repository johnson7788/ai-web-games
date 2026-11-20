// src/ui/hud.js — HUD 顶栏（不透明背板，避免遮挡星阵）+ 引力透镜按钮
import { t } from '../core/i18n.js';

export function createHud(root) {
  const el = document.createElement('div');
  el.id = 'hud';
  el.className = 'hud hidden';
  el.innerHTML =
    '<div class="hud-left">' +
    '<div class="hud-stat"><span class="hud-label" data-i18n="hud.level"></span><b id="hud-level">1</b></div>' +
    '<div class="hud-stat"><span class="hud-label" data-i18n="hud.target"></span><b id="hud-target">0</b></div>' +
    '</div>' +
    '<div class="hud-center">' +
    '<div class="hud-stat hud-score"><span class="hud-label" data-i18n="hud.score"></span><b id="hud-score">0</b></div>' +
    '</div>' +
    '<div class="hud-right">' +
    '<div class="hud-stat"><span class="hud-label" data-i18n="hud.moves"></span><b id="hud-moves">0</b></div>' +
    '<div class="hud-stat hud-lens-stat"><span class="hud-label" data-i18n="hud.lens"></span><b id="hud-lens">3</b></div>' +
    '</div>';
  root.appendChild(el);

  const lensBtn = document.createElement('button');
  lensBtn.id = 'btn-lens';
  lensBtn.className = 'lens-btn hidden';
  lensBtn.type = 'button';
  lensBtn.setAttribute('aria-label', t('hud.lens'));
  lensBtn.innerHTML = '<span class="lens-icon">◎</span><span class="lens-num" id="lens-num">3</span>';
  root.appendChild(lensBtn);

  const els = {
    root: el,
    level: el.querySelector('#hud-level'),
    target: el.querySelector('#hud-target'),
    score: el.querySelector('#hud-score'),
    moves: el.querySelector('#hud-moves'),
    lens: el.querySelector('#hud-lens'),
    lensNum: lensBtn.querySelector('#lens-num'),
    lensBtn,
  };

  function setHud(h) {
    if (!h) return;
    els.level.textContent = String(h.level ?? 1);
    els.target.textContent = String(h.target ?? 0);
    els.score.textContent = String(h.score ?? 0);
    els.moves.textContent = String(h.moves ?? 0);
    els.lens.textContent = String(h.lensLeft ?? 0);
    els.lensNum.textContent = String(h.lensLeft ?? 0);
  }

  function show() { el.classList.remove('hidden'); lensBtn.classList.remove('hidden'); }
  function hide() { el.classList.add('hidden'); lensBtn.classList.add('hidden'); }
  function setLensMode(on) { lensBtn.classList.toggle('active', !!on); }

  return { els, setHud, show, hide, setLensMode };
}
