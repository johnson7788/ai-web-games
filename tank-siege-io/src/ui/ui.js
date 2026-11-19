// UI 模块：屏幕显隐 + 多语言下拉 + 静音按钮态
import { i18n, t, syncDocumentLang } from '../core/i18n.js';

export const ui = {
  hud: document.getElementById('hud'),
  titleScreen: document.getElementById('screen-title'),
  pauseScreen: document.getElementById('screen-pause'),
  resultScreen: document.getElementById('screen-result'),
  titleText: document.getElementById('title-text'),
  subtitleText: document.getElementById('subtitle-text'),
  pauseTitle: document.getElementById('pause-title'),
  controlsHint: document.getElementById('controls-hint'),
  btnStart: document.getElementById('btn-start'),
  btnResume: document.getElementById('btn-resume'),
  btnMute: document.getElementById('btn-mute'),
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
    this.titleText.textContent = t('title');
    this.subtitleText.textContent = t('subtitle');
    this.btnStart.textContent = t('start');
    this.btnResume.textContent = t('resume');
    this.pauseTitle.textContent = t('paused');
    if (this.controlsHint) {
      const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
      this.controlsHint.textContent = coarse ? t('controlsTouch') : t('controls');
    }
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

  setMuted(m) {
    if (this.btnMute) {
      this.btnMute.textContent = m ? '🔇' : '🔊';
      this.btnMute.setAttribute('aria-label', m ? t('soundOff') : t('soundOn'));
      this.btnMute.classList.toggle('is-muted', m);
    }
  },
};
