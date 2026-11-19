// UI 壳：语言切换 + 屏幕显隐。HUD/结算/教程的 DOM 文本由 main.js 直写。
import { i18n, t, setLang, syncDocumentLang } from '../core/i18n.js';
import { CONFIG } from '../../config/game.config.js';
import { locales } from '../../config/locales.js';

const $ = (id) => document.getElementById(id);

function populateLangSelects() {
  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = $(id);
    if (!sel) continue;
    sel.innerHTML = '';
    for (const code of CONFIG.languages) {
      if (!locales[code]) continue;
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = CONFIG.langNames[code] || code;
      sel.appendChild(opt);
    }
    sel.value = i18n.lang;
  }
}

function applyStaticText() {
  for (const el of document.querySelectorAll('[data-i18n]')) {
    el.textContent = t(el.dataset.i18n);
  }
  for (const el of document.querySelectorAll('[data-i18n-placeholder]')) {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  }
  for (const el of document.querySelectorAll('[data-i18n-title]')) {
    el.setAttribute('title', t(el.dataset.i18nTitle));
    el.setAttribute('aria-label', t(el.dataset.i18nTitle));
  }
}

export const ui = {
  applyLang() {
    populateLangSelects();
    applyStaticText();
    syncDocumentLang();
  },
  setLang(code) {
    setLang(code);
    this.applyLang();
  },
  setMuted(muted) {
    const btn = $('btn-mute');
    if (btn) {
      btn.textContent = muted ? '🔇' : '🔊';
      btn.classList.toggle('is-muted', muted);
    }
  },
  show(el) { const e = $(el); if (e) e.classList.remove('hidden'); },
  hide(el) { const e = $(el); if (e) e.classList.add('hidden'); },
  showTitle() { this.hide('hud'); this.hide('screen-result'); this.hide('screen-pause'); this.show('screen-title'); },
  showGame() { this.hide('screen-title'); this.hide('screen-result'); this.hide('screen-pause'); this.show('hud'); },
  showPause() { this.show('screen-pause'); },
  hidePause() { this.hide('screen-pause'); },
  showResult() { this.show('screen-result'); },
  hideResult() { this.hide('screen-result'); },
};
