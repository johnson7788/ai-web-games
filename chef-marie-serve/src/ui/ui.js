// UI 模块：语言下拉填充与切换（屏幕显隐由 main.js 直接控制）。
import { i18n, syncDocumentLang } from '../core/i18n.js';

const $ = (id) => document.getElementById(id);

export const ui = {
  fillLangOptions() {
    for (const id of ['lang-select', 'lang-select-pause']) {
      const sel = $(id);
      if (!sel) continue;
      sel.innerHTML = '';
      for (const item of i18n.options()) {
        const opt = document.createElement('option');
        opt.value = item.code;
        opt.textContent = item.name;
        if (item.code === i18n.lang) opt.selected = true;
        sel.appendChild(opt);
      }
    }
  },

  setLang(lang) {
    if (!i18n.setLang(lang)) return i18n.lang;
    syncDocumentLang();
    this.fillLangOptions();
    return i18n.lang;
  },
};
