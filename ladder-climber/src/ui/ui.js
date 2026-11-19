// LADDER CLIMBER · UI 模块：语言应用 + 语言下拉 + 静音态 + 竖屏文案。
// 屏幕显隐/HUD/结果/教程的 DOM 直写由 main.js 负责。
import { i18n, t } from '../core/i18n.js';

function applyLang() {
  const title = document.getElementById('title-text');
  const subtitle = document.getElementById('subtitle-text');
  if (title) title.textContent = t('title');
  if (subtitle) subtitle.textContent = t('subtitle');

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    const text = t(key);
    if (text) el.textContent = text;
  });

  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = document.getElementById(id);
    if (!sel) continue;
    const cur = i18n.lang;
    sel.innerHTML = '';
    for (const opt of i18n.options()) {
      const o = document.createElement('option');
      o.value = opt.code;
      o.textContent = opt.name;
      if (opt.code === cur) o.selected = true;
      sel.appendChild(o);
    }
  }

  const rt = document.getElementById('rotate-text');
  const rb = document.getElementById('btn-rotate-skip');
  if (rt) rt.textContent = t('rotateHint');
  if (rb && !rb.getAttribute('data-i18n')) rb.textContent = t('rotateSkip');
}

export const ui = {
  applyLang,
  setLang(lang) {
    i18n.setLang(lang);
    applyLang();
  },
  setMuted(m) {
    const b = document.getElementById('btn-mute');
    if (b) b.classList.toggle('is-muted', !!m);
  },
};
