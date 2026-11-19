// FROG HOP LEAF · UI 模块：标题/暂停/结算/HUD + 多语言下拉（默认英文）
// 只做语言与屏幕显隐；HUD/结算/教程的 DOM 内容由 main.js 直写。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';

const $ = (id) => document.getElementById(id);

export const ui = {
  titleScreen: $('screen-title'),
  pauseScreen: $('screen-pause'),
  resultScreen: $('screen-result'),
  hud: $('hud'),
  titleText: $('title-text'),
  subtitleText: $('subtitle-text'),
  btnStart: $('btn-start'),
  btnResume: $('btn-resume'),
  btnRetry: $('btn-retry'),
  btnNext: $('btn-next'),
  btnHome: $('btn-home'),
  btnHome2: $('btn-home2'),
  btnHome3: $('btn-home3'),
  btnRestart: $('btn-restart'),
  btnRestart2: $('btn-restart2'),
  btnHowto: $('btn-howto'),
  btnMute: $('btn-mute'),
  pauseTitle: $('pause-title'),
  resultTitle: $('result-title'),
  resultStars: $('result-stars'),
  resultMeta: $('result-meta'),
  resultTime: $('result-time'),
  langSelects: [$('lang-select'), $('lang-select-pause')],
  muted: false,

  get lang() {
    return i18n.lang;
  },

  applyLang() {
    syncDocumentLang();
    this.titleText.textContent = t('title');
    this.subtitleText.textContent = t('subtitle');
    this.btnStart.textContent = t('start');
    this.btnResume.textContent = t('resume');
    this.btnRetry.textContent = t('retry');
    this.btnNext.textContent = t('nextLevel');
    this.btnHome.textContent = t('home');
    this.btnHome2.textContent = t('home');
    this.btnHome3.textContent = t('home');
    this.btnRestart.textContent = t('restart');
    this.btnRestart2.textContent = t('restart');
    this.pauseTitle.textContent = t('paused');
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

  setMuted(m) {
    this.muted = !!m;
    if (this.btnMute) this.btnMute.textContent = m ? 'Muted' : 'Sound';
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
