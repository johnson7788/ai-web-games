// UI 模块：语言下拉 / 屏幕显隐 / 静音。具体面板 DOM 由 main.js 直写。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';

export const ui = {
  titleScreen: null,
  pauseScreen: null,
  resultScreen: null,
  hud: null,
  btnStart: null,
  btnResume: null,
  btnMute: null,
  langSelects: [],

  init() {
    const $ = (id) => document.getElementById(id);
    this.titleScreen = $('screen-title');
    this.pauseScreen = $('screen-pause');
    this.resultScreen = $('screen-result');
    this.hud = $('hud');
    this.btnStart = $('btn-start');
    this.btnResume = $('btn-resume');
    this.btnMute = $('btn-mute');
    this.langSelects = [$('lang-select'), $('lang-select-pause')];
  },

  get lang() { return i18n.lang; },
  get dir() { return i18n.dir; },

  applyLang() {
    syncDocumentLang();
    this.fillLangOptions();
    if (this.btnStart) this.btnStart.textContent = t('start');
    if (this.btnResume) this.btnResume.textContent = t('resume');
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const k = el.getAttribute('data-i18n');
      if (k) el.textContent = t(k);
    });
    document.querySelectorAll('[data-i18n-html]').forEach((el) => {
      const k = el.getAttribute('data-i18n-html');
      if (k) el.textContent = t(k);
    });
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
    this.titleScreen.classList.add('is-active');
    this.pauseScreen.classList.add('hidden');
    this.resultScreen.classList.add('hidden');
    this.hud.classList.add('hidden');
  },

  showGame() {
    this.titleScreen.classList.add('hidden');
    this.titleScreen.classList.remove('is-active');
    this.pauseScreen.classList.add('hidden');
    this.resultScreen.classList.add('hidden');
    this.hud.classList.remove('hidden');
  },

  showPause() { this.pauseScreen.classList.remove('hidden'); },
  hidePause() { this.pauseScreen.classList.add('hidden'); },
  showResult() { this.resultScreen.classList.remove('hidden'); },
  hideResult() { this.resultScreen.classList.add('hidden'); },

  setMuted(m) {
    if (this.btnMute) this.btnMute.classList.toggle('is-muted', !!m);
  },
};
