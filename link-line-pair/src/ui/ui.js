// LINK LINE PAIR · UI 模块：语言与屏幕显隐；HUD/结算/关卡格/教程由 main.js 直写。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';

const $ = (id) => document.getElementById(id);

export const ui = {
  titleScreen: $('screen-title'),
  pauseScreen: $('screen-pause'),
  resultScreen: $('screen-result'),
  hud: $('hud'),
  titleText: $('title-text'),
  subtitleText: $('subtitle-text'),
  pauseTitle: $('pause-title'),
  btnStart: $('btn-start'),
  btnResume: $('btn-resume'),
  btnRetry: $('btn-retry'),
  btnNext: $('btn-next'),
  langSelects: [$('lang-select'), $('lang-select-pause')].filter(Boolean),
  btnMute: $('btn-mute'),
  btnHint: $('btn-hint'),
  btnUndo: $('btn-undo'),
  btnHowto: $('btn-howto'),
  btnRestart: $('btn-restart'),
  btnHome: $('btn-home'),
  muted: false,

  get lang() { return i18n.lang; },
  get dir() { return i18n.dir; },

  applyLang() {
    syncDocumentLang();
    this.titleText.textContent = t('title');
    this.subtitleText.textContent = t('subtitle');
    this.btnStart.textContent = t('start');
    this.btnResume.textContent = t('resume');
    this.pauseTitle.textContent = t('paused');
    this.btnRetry.textContent = t('retry');
    this.btnNext.textContent = t('next');
    for (const sel of this.langSelects) sel.setAttribute('aria-label', t('language'));
    this.fillLangOptions();
    this.setButtonTitles();
  },

  fillLangOptions() {
    for (const sel of this.langSelects) {
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

  setButtonTitles() {
    if (this.btnMute) this.btnMute.title = t('mute');
    if (this.btnHint) this.btnHint.title = t('hint');
    if (this.btnUndo) this.btnUndo.title = t('undo');
    if (this.btnHowto) this.btnHowto.title = t('howto');
    if (this.btnRestart) this.btnRestart.title = t('restart');
    if (this.btnHome) this.btnHome.title = t('home');
  },

  setLang(lang) {
    if (i18n.setLang(lang)) this.applyLang();
    return i18n.lang;
  },

  setMuted(m) {
    this.muted = !!m;
    if (this.btnMute) {
      this.btnMute.classList.toggle('is-muted', this.muted);
      this.btnMute.textContent = this.muted ? '🔇' : '🔊';
    }
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
    this.hud.classList.add('hidden');
    this.resultScreen.classList.remove('hidden');
  },

  hideResult() {
    this.resultScreen.classList.add('hidden');
  },
};
