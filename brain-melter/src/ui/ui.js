// UI 模块：标题/暂停/结算/HUD 的显隐 + 多语言下拉（默认英文）
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
  pauseTitle: $('pause-title'),
  btnResume: $('btn-resume'),
  btnRestart2: $('btn-restart2'),
  btnTutReplay: $('btn-tut-replay'),
  btnHome3: $('btn-home3'),
  resultTitle: $('result-title'),
  btnRetry: $('btn-retry'),
  btnNext: $('btn-next'),
  btnHome2: $('btn-home2'),
  btnHint: $('btn-hint'),
  btnMute: $('btn-mute'),
  btnHowto: $('btn-howto'),
  btnRestart: $('btn-restart'),
  btnHome: $('btn-home'),
  langSelects: [$('lang-select'), $('lang-select-pause')].filter(Boolean),
  muted: false,

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
    this.btnTutReplay.textContent = t('replayGuide');
    this.btnHome3.textContent = t('menu');
    this.btnRetry.textContent = t('retry');
    this.btnNext.textContent = t('next');
    this.btnHome2.textContent = t('menu');
    this.btnHint.textContent = t('hint');
    this.btnHowto.setAttribute('aria-label', t('howto'));
    this.btnRestart.setAttribute('aria-label', t('restart'));
    this.btnHome.setAttribute('aria-label', t('menu'));
    this.btnMute.setAttribute('aria-label', this.muted ? t('unmute') : t('mute'));
    for (const sel of this.langSelects) sel.setAttribute('aria-label', t('language'));
    const rt = $('rotate-text');
    const rb = $('btn-rotate-skip');
    if (rt) rt.textContent = t('rotateHint');
    if (rb) rb.textContent = t('rotateSkip');
    this.fillLangOptions();
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

  setLang(lang) {
    i18n.setLang(lang);
    this.applyLang();
    return i18n.lang;
  },

  setMuted(m) {
    this.muted = !!m;
    if (this.btnMute) {
      this.btnMute.textContent = this.muted ? '🔇' : '🔊';
      this.btnMute.classList.toggle('is-muted', this.muted);
      this.btnMute.setAttribute('aria-label', this.muted ? t('unmute') : t('mute'));
    }
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

  showPause() {
    this.pauseScreen.classList.remove('hidden');
  },

  hidePause() {
    this.pauseScreen.classList.add('hidden');
  },

  showResult() {
    this.resultScreen.classList.remove('hidden');
    this.hud.classList.add('hidden');
  },

  hideResult() {
    this.resultScreen.classList.add('hidden');
  },
};
