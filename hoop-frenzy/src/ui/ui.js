// UI 模块：标题/暂停/结算/HUD 的屏幕显隐 + 语言下拉。文案具体值由 main.js 直写。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';

export const ui = {
  titleScreen: document.getElementById('screen-title'),
  pauseScreen: document.getElementById('screen-pause'),
  resultScreen: document.getElementById('screen-result'),
  hud: document.getElementById('hud'),
  langSelects: [
    document.getElementById('lang-select'),
    document.getElementById('lang-select-pause'),
  ],

  get lang() {
    return i18n.lang;
  },
  get dir() {
    return i18n.dir;
  },

  applyLang() {
    syncDocumentLang();
    for (const sel of this.langSelects) {
      if (sel) sel.setAttribute('aria-label', t('language'));
    }
    this.fillLangOptions();
  },

  fillLangOptions() {
    for (const sel of this.langSelects) {
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
    i18n.setLang(lang);
    this.applyLang();
    return i18n.lang;
  },

  showTitle() {
    this.titleScreen.classList.remove('hidden');
    this.pauseScreen.classList.add('hidden');
    this.resultScreen.classList.add('hidden');
    this.hud.classList.add('hidden');
  },
  showGame() {
    this.titleScreen.classList.add('hidden');
    this.pauseScreen.classList.add('hidden');
    this.resultScreen.classList.add('hidden');
    this.hud.classList.remove('hidden');
  },
  showPause() {
    this.pauseScreen.classList.remove('hidden');
  },
  hidePause() {
    this.pauseScreen.classList.add('hidden');
  },
  showResult() {
    this.resultScreen.classList.remove('hidden');
  },
  hideResult() {
    this.resultScreen.classList.add('hidden');
  },
};
