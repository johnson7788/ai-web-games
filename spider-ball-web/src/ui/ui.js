// UI 模块：语言切换 + 屏幕显隐。HUD/结算/教程的 DOM 文案由 main.js 直写。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';

const $ = (id) => document.getElementById(id);

export const ui = {
  titleScreen: $('screen-title'),
  pauseScreen: $('screen-pause'),
  resultScreen: $('screen-result'),
  hud: $('hud'),
  langSelects: [$('lang-select'), $('lang-select-pause')],
  titleText: $('title-text'),
  subtitleText: $('subtitle-text'),
  btnStart: $('btn-start'),
  btnResume: $('btn-resume'),
  btnRestart2: $('btn-restart2'),
  btnRetry: $('btn-retry'),
  btnHome2: $('btn-home2'),
  btnHome3: $('btn-home3'),
  pauseTitle: $('pause-title'),
  resultTitle: $('result-title'),
  rotateText: $('rotate-text'),
  rotateSkip: $('btn-rotate-skip'),
  starsTotal: $('stars-total'),

  get lang() {
    return i18n.lang;
  },
  get dir() {
    return i18n.dir;
  },

  applyLang() {
    syncDocumentLang();
    this.titleText.textContent = t('title');
    this.subtitleText.textContent = t('subtitle');
    this.btnStart.textContent = t('start');
    this.btnResume.textContent = t('resume');
    this.pauseTitle.textContent = t('paused');
    this.btnRestart2.textContent = t('restart');
    this.btnRetry.textContent = t('retry');
    this.btnHome2.textContent = t('home');
    this.btnHome3.textContent = t('home');
    if (this.rotateText) this.rotateText.textContent = t('rotateHint');
    if (this.rotateSkip) this.rotateSkip.textContent = t('rotateSkip');
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
    this.titleScreen.classList.add('is-active');
    this.pauseScreen.classList.add('hidden');
    this.resultScreen.classList.add('hidden');
    this.hud.classList.add('hidden');
    this.applyLang();
  },

  showGame() {
    this.titleScreen.classList.add('hidden');
    this.titleScreen.classList.remove('is-active');
    this.pauseScreen.classList.add('hidden');
    this.resultScreen.classList.add('hidden');
    this.hud.classList.remove('hidden');
  },

  showPause() {
    this.pauseScreen.classList.remove('hidden');
    this.applyLang();
  },

  hidePause() {
    this.pauseScreen.classList.add('hidden');
  },

  showResult() {
    this.resultScreen.classList.remove('hidden');
    this.applyLang();
  },

  hideResult() {
    this.resultScreen.classList.add('hidden');
  },
};
