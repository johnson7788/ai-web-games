// UI 模块：标题/暂停/结算/HUD 的多语言刷新与屏幕显隐。
// 具体 HUD 数值由 main.js 直写；这里只负责语言与可见文案。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';

const $ = (id) => document.getElementById(id);

export const ui = {
  titleScreen: $('screen-title'),
  pauseScreen: $('screen-pause'),
  resultScreen: $('screen-result'),
  hud: $('hud'),
  titleText: $('title-text'),
  subtitleText: $('subtitle-text'),
  taglineText: $('tagline-text'),
  pauseTitle: $('pause-title'),
  resultTitle: $('result-title'),
  retryBtn: $('btn-retry'),
  bestLine: $('best-line'),
  langSelects: [$('lang-select'), $('lang-select-pause')],

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
    this.taglineText.textContent = t('tagline');
    this.pauseTitle.textContent = t('paused');
    this.resultTitle.textContent = t('resultTitle');
    this.retryBtn.textContent = t('retry');
    $('btn-start').textContent = t('start');
    $('btn-resume').textContent = t('resume');
    $('btn-howto2').textContent = t('howto');
    $('btn-restart').textContent = t('restart');
    $('btn-restart2').textContent = t('restart');
    $('btn-home').textContent = t('menu');
    $('btn-home2').textContent = t('menu');
    $('btn-home3').textContent = t('menu');
    $('btn-rotate-skip').textContent = t('rotateSkip');
    $('rotate-text').textContent = t('rotateHint');
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
    this.hud.classList.add('hidden');
    this.applyLang();
  },

  hideResult() {
    this.resultScreen.classList.add('hidden');
  },

  updateBestLine(best) {
    if (best > 0) {
      this.bestLine.textContent = `${t('best')}: ${best}`;
    } else {
      this.bestLine.textContent = '';
    }
  },
};
