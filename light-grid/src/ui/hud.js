// src/ui/hud.js — HUD：关卡 / 步数 vs par / 保险丝（剩余步数）/ 目标与点亮进度 / 星级。
// 数据由 main 每帧喂入 setHud(run.getHud())；本文件不碰 sim、不读存档。
import { t } from '../core/i18n.js';

function clamp01(v) {
  const n = Number(v) || 0;
  return Math.min(1, Math.max(0, n));
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
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.level"></span><b id="hud-level">1</b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.steps"></span><b id="hud-steps">0</b><i class="hud-unit">/</i><b id="hud-par">0</b></div>' +
    '</div>' +
    '<div class="hud-center">' +
      '<div class="hud-goal" data-i18n="hud.goal"></div>' +
      '<div class="hud-progress"><b id="hud-lit">0</b><span class="hud-unit" id="hud-total">/0</span><span class="hud-chapter" id="hud-chapter"></span></div>' +
    '</div>' +
    '<div class="hud-right">' +
      '<div class="fuse" id="fuse">' +
        '<div class="fuse-track"><i class="fuse-fill" id="fuse-fill"></i></div>' +
        '<span class="fuse-label"><span data-i18n="hud.remaining"></span> <b id="fuse-remaining">0</b></span>' +
      '</div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.stars"></span><b id="hud-stars">0</b></div>' +
    '</div>';

  const levelEl = el.querySelector('#hud-level');
  const stepsEl = el.querySelector('#hud-steps');
  const parEl = el.querySelector('#hud-par');
  const chapterEl = el.querySelector('#hud-chapter');
  const starsEl = el.querySelector('#hud-stars');
  const fillEl = el.querySelector('#fuse-fill');
  const fuseEl = el.querySelector('#fuse');
  const litEl = el.querySelector('#hud-lit');
  const totalEl = el.querySelector('#hud-total');
  const remainingEl = el.querySelector('#fuse-remaining');

  function chapterLabel(chapter) {
    const key = 'chapter.' + chapter;
    const text = t(key);
    return text !== key ? text : chapter;
  }

  return {
    el,
    setHud(h) {
      h = h || {};
      levelEl.textContent = String(h.level ?? 1);
      stepsEl.textContent = String(h.steps ?? 0);
      parEl.textContent = String(h.par ?? 0);
      chapterEl.textContent = chapterLabel(h.chapter || 'motherboard');
      starsEl.textContent = '★'.repeat(Math.max(0, Math.min(3, h.stars || 0)));
      litEl.textContent = String(h.lit ?? 0);
      totalEl.textContent = `/${h.total ?? 0}`;

      const remain = Math.max(0, h.remaining ?? 0);
      const total = Math.max(1, h.maxSteps ?? 1);
      fillEl.style.width = (clamp01(remain / total) * 100).toFixed(1) + '%';
      remainingEl.textContent = String(remain);
      fuseEl.classList.toggle('low', remain <= 3);
    },
    show() { el.classList.remove('hidden'); el.setAttribute('aria-hidden', 'false'); },
    hide() { el.classList.add('hidden'); el.setAttribute('aria-hidden', 'true'); },
  };
}
