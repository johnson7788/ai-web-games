// UI 模块：屏幕显隐 + 多语言下拉 + 语言刷新。HUD/结算/关卡格/教程的 DOM 由 main.js 直写。
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
  langSelects: [$('lang-select'), $('lang-select-pause')],
  btnMute: $('btn-mute'),
  btnHowto: $('btn-howto'),
  btnTutReplay: $('btn-tut-replay'),
  rotateText: $('rotate-text'),
  rotateSkip: $('btn-rotate-skip'),
  tutTitle: $('tut-title'),
  tutText: $('tut-text'),
  tutSkip: $('tut-skip'),
  tutNext: $('tut-next'),

  get lang() {
    return i18n.lang;
  },

  applyLang() {
    syncDocumentLang();
    this.titleText.textContent = t('title');
    this.subtitleText.textContent = t('subtitle');
    this.btnStart.textContent = t('start');
    this.btnResume.textContent = t('resume');
    this.pauseTitle.textContent = t('paused');
    for (const sel of this.langSelects) {
      if (sel) sel.setAttribute('aria-label', t('language'));
    }
    this.fillLangOptions();
    if (this.rotateText) this.rotateText.textContent = t('rotateHint');
    if (this.rotateSkip) this.rotateSkip.textContent = t('rotateSkip');
    if (this.tutTitle) this.tutTitle.textContent = t('tutTitle');
    if (this.tutSkip) this.tutSkip.textContent = t('tutSkip');
    if (this.tutNext) this.tutNext.textContent = t('tutNext');
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
    if (this.btnMute) this.btnMute.textContent = '♪';
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
  },

  hideResult() {
    this.resultScreen.classList.add('hidden');
  },
};
