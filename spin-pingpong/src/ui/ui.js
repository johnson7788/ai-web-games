// UI 薄层：语言下拉 / 屏幕显隐 / 静音态。HUD/结算/教程/关卡格的 DOM 由 main.js 直写。
import { i18n } from '../core/i18n.js';

const $ = (id) => document.getElementById(id);

function populateSelect(sel) {
  if (!sel) return;
  sel.innerHTML = '';
  for (const opt of i18n.options()) {
    const o = document.createElement('option');
    o.value = opt.code;
    o.textContent = opt.name;
    sel.appendChild(o);
  }
  sel.value = i18n.lang;
}

export const ui = {
  applyLang() {
    populateSelect($('lang-select'));
    populateSelect($('lang-select-pause'));
  },
  setLang(lang) {
    for (const id of ['lang-select', 'lang-select-pause']) {
      const sel = $(id);
      if (sel) sel.value = lang;
    }
  },
  setMuted(m) {
    const b = $('btn-mute');
    if (b) b.classList.toggle('is-muted', !!m);
  },
  show(el) {
    if (typeof el === 'string') el = $(el);
    if (el) el.classList.remove('hidden');
  },
  hide(el) {
    if (typeof el === 'string') el = $(el);
    if (el) el.classList.add('hidden');
  },
  showTitle() {
    this.hide('screen-pause');
    this.hide('screen-result');
    this.hide('hud');
    this.show('screen-title');
  },
  showGame() {
    this.hide('screen-title');
    this.hide('screen-pause');
    this.hide('screen-result');
    this.show('hud');
  },
  showPause() {
    this.hide('hud');
    this.show('screen-pause');
  },
  hidePause() {
    this.hide('screen-pause');
    this.show('hud');
  },
  showResult() {
    this.show('screen-result');
  },
  hideResult() {
    this.hide('screen-result');
  },
};
