// src/ui/hud.js — MARRY RICH · HUD：三属性条（能力/人脉/存款）+ 隐藏好感度 + 章节 + 倒计时。
// 数据由 main 每帧喂入 setHud(run.getHud())；本文件不碰 sim、不读存档。
import { t } from '../core/i18n.js';
import { ATTRS, FLAGS } from '../../config/gameplay.js';

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
      '<div class="attr-bars" id="attr-bars"></div>' +
      '<div class="flag-chips" id="flag-chips"></div>' +
    '</div>' +
    '<div class="hud-center"><div class="hud-chapter" id="hud-chapter"></div></div>' +
    '<div class="hud-right"><div class="hud-timer hidden" id="hud-timer"></div></div>';

  const attrBars = el.querySelector('#attr-bars');
  const flagChips = el.querySelector('#flag-chips');
  const chapterEl = el.querySelector('#hud-chapter');
  const timerEl = el.querySelector('#hud-timer');

  // 构建属性条（静态结构，值每次刷新）
  attrBars.innerHTML = ATTRS.KEYS.map((k) =>
    '<div class="attr-bar" data-attr="' + k + '">' +
      '<span class="attr-label"></span>' +
      '<div class="attr-track"><i class="attr-fill"></i></div>' +
      '<b class="attr-value">0</b>' +
    '</div>'
  ).join('');

  flagChips.innerHTML = FLAGS.KEYS.map((k) =>
    '<span class="flag-chip" data-flag="' + k + '"><span class="flag-label"></span><b class="flag-value">0</b></span>'
  ).join('');

  function applyLang() {
    for (const k of ATTRS.KEYS) {
      const row = attrBars.querySelector('[data-attr="' + k + '"]');
      if (row) row.querySelector('.attr-label').textContent = t(ATTRS.LABELS[k]);
    }
    for (const k of FLAGS.KEYS) {
      const chip = flagChips.querySelector('[data-flag="' + k + '"]');
      if (chip) chip.querySelector('.flag-label').textContent = t('attr.' + k);
    }
  }

  return {
    el,
    applyLang,
    setHud(h) {
      h = h || {};
      for (const k of ATTRS.KEYS) {
        const row = attrBars.querySelector('[data-attr="' + k + '"]');
        if (!row) continue;
        const v = Math.max(0, Math.min(ATTRS.MAX, Number(h.attrs?.[k]) || 0));
        row.querySelector('.attr-value').textContent = String(v);
        row.querySelector('.attr-fill').style.width = ((v / ATTRS.MAX) * 100).toFixed(1) + '%';
      }
      for (const k of FLAGS.KEYS) {
        const chip = flagChips.querySelector('[data-flag="' + k + '"]');
        if (!chip) continue;
        chip.querySelector('.flag-value').textContent = String(Math.max(0, Number(h.flags?.[k]) || 0));
      }
      chapterEl.textContent = t('hud.chapter', { n: h.chapter ?? 0, total: h.totalChapters ?? 0 });

      const timed = !!h.timed && h.stage === 'choice' && h.phase === 'playing';
      timerEl.classList.toggle('hidden', !timed);
      if (timed) {
        const sec = Math.max(0, Math.ceil(h.timer ?? 0));
        timerEl.textContent = sec + 's';
        timerEl.classList.toggle('urgent', sec <= 2);
      }
    },
    show() { el.classList.remove('hidden'); el.setAttribute('aria-hidden', 'false'); },
    hide() { el.classList.add('hidden'); el.setAttribute('aria-hidden', 'true'); },
  };
}
