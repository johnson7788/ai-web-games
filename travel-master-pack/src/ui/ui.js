// 语言与静态文本应用（DOM）。屏幕显隐/HUD/结算/教程动态文本由 main.js 直写。
import { i18n } from '../core/i18n.js';

export const ui = {
  onLang: null,

  applyLang() {
    for (const id of ['lang-select', 'lang-select-pause']) {
      const sel = document.getElementById(id);
      if (!sel) continue;
      sel.innerHTML = i18n.options().map((o) => `<option value="${o.code}">${o.name}</option>`).join('');
      sel.value = i18n.lang;
    }
    if (this.onLang) this.onLang();
  },

  setLang(lang) {
    if (i18n.setLang(lang)) this.applyLang();
    return i18n.lang;
  },

  setMuted(m) {
    const b = document.getElementById('btn-mute');
    if (b) b.classList.toggle('is-muted', !!m);
  },
};
