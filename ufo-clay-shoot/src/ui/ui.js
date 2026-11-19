// UI 模块：屏幕显隐 + 静态文案 + 语言下拉（动态 HUD/结算/教程文案由 main.js 直写）
import { i18n, t, syncDocumentLang } from '../core/i18n.js';

const $ = (id) => document.getElementById(id);

export const ui = {
  titleScreen: $('screen-title'),
  pauseScreen: $('screen-pause'),
  resultScreen: $('screen-result'),
  hud: $('hud'),
  titleText: $('title-text'),
  subtitleText: $('subtitle-text'),
  titleBest: $('title-best'),
  btnStart: $('btn-start'),
  pauseTitle: $('pause-title'),
  btnResume: $('btn-resume'),
  btnRestart2: $('btn-restart2'),
  btnHome3: $('btn-home3'),
  resultTitle: $('result-title'),
  resultStars: $('result-stars'),
  resultTime: $('result-time'),
  resultScore: $('result-score'),
  resultBest: $('result-best'),
  btnRetry: $('btn-retry'),
  btnHome2: $('btn-home2'),
  btnHowto: $('btn-howto'),
  btnMute: $('btn-mute'),
  rotateText: $('rotate-text'),
  btnRotateSkip: $('btn-rotate-skip'),
  tutTitle: $('tut-title'),
  tutSkip: $('tut-skip'),
  tutNext: $('tut-next'),
  langSelects: [$('lang-select'), $('lang-select-pause')],

  get lang() { return i18n.lang; },
  get dir() { return i18n.dir; },

  applyLang() {
    syncDocumentLang();
    this.titleText.textContent = t('title');
    this.subtitleText.textContent = t('subtitle');
    this.btnStart.textContent = t('start');
    this.pauseTitle.textContent = t('paused');
    this.btnResume.textContent = t('resume');
    this.btnRestart2.textContent = t('restart');
    this.btnHome3.textContent = t('menu');
    this.btnRetry.textContent = t('retry');
    this.btnHome2.textContent = t('menu');
    if (this.rotateText) this.rotateText.textContent = t('rotateHint');
    if (this.btnRotateSkip) this.btnRotateSkip.textContent = t('rotateSkip');
    if (this.btnHowto) { this.btnHowto.textContent = '?'; this.btnHowto.setAttribute('aria-label', t('howto')); }
    if (this.btnMute) this.btnMute.setAttribute('aria-label', t('mute'));
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

  setMuted(muted) {
    if (this.btnMute) this.btnMute.classList.toggle('is-muted', muted);
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
