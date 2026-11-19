// HARDCORE MATCHPOP · UI 模块：语言 + 屏幕显隐（HUD/结算/关卡格/教程由 main.js 直写）
import { i18n, t, syncDocumentLang } from '../core/i18n.js';

export const ui = {
  titleScreen: document.getElementById('screen-title'),
  pauseScreen: document.getElementById('screen-pause'),
  resultScreen: document.getElementById('screen-result'),
  hud: document.getElementById('hud'),
  titleText: document.getElementById('title-text'),
  subtitleText: document.getElementById('subtitle-text'),
  pauseTitle: document.getElementById('pause-title'),
  btnStart: document.getElementById('btn-start'),
  btnRush: document.getElementById('btn-rush'),
  btnResume: document.getElementById('btn-resume'),
  btnRestart2: document.getElementById('btn-restart2'),
  btnTutReplay: document.getElementById('btn-tut-replay'),
  btnHome3: document.getElementById('btn-home3'),
  btnRetry: document.getElementById('btn-retry'),
  btnNext: document.getElementById('btn-next'),
  btnHome2: document.getElementById('btn-home2'),
  btnMute: document.getElementById('btn-mute'),
  langSelects: [
    document.getElementById('lang-select'),
    document.getElementById('lang-select-pause'),
  ],
  muted: false,

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
    this.btnRush.textContent = t('rush');
    this.btnResume.textContent = t('resume');
    this.btnRestart2.textContent = t('restart');
    this.btnTutReplay.textContent = t('replayGuide');
    this.btnHome3.textContent = t('home');
    this.btnRetry.textContent = t('retry');
    this.btnNext.textContent = t('nextLevel');
    this.btnHome2.textContent = t('home');
    this.pauseTitle.textContent = t('paused');
    this.updateMuteLabel();
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
    this.updateMuteLabel();
  },

  updateMuteLabel() {
    if (this.btnMute) this.btnMute.textContent = this.muted ? '🔇' : '🔊';
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
