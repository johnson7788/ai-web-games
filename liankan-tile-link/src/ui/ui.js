// UI 模块：DOM 引用 + 语言 + 屏幕显隐 + 静音图标。
// 关卡格 / HUD / 结算 / 教程 的动态内容由 main.js 直写（保持逻辑集中）。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';

const $ = (id) => document.getElementById(id);

export const ui = {
  canvas: $('canvas'),
  hud: $('hud'),
  boardHint: $('board-hint'),
  screenTitle: $('screen-title'),
  screenPause: $('screen-pause'),
  screenResult: $('screen-result'),
  titleText: $('title-text'),
  subtitleText: $('subtitle-text'),
  btnStart: $('btn-start'),
  btnTitleHowto: $('btn-title-howto'),
  btnHowto: $('btn-howto'),
  btnHowto2: $('btn-howto2'),
  modeTimed: $('mode-timed'),
  modePractice: $('mode-practice'),
  pauseTitle: $('pause-title'),
  btnResume: $('btn-resume'),
  btnRestart2: $('btn-restart2'),
  btnHome3: $('btn-home3'),
  resultTitle: $('result-title'),
  resultStars: $('result-stars'),
  resultMeta: $('result-meta'),
  btnRetry: $('btn-retry'),
  btnNext: $('btn-next'),
  btnHome2: $('btn-home2'),
  btnMute: $('btn-mute'),
  btnRestart: $('btn-restart'),
  btnHome: $('btn-home'),
  btnPeek: $('btn-peek'),
  peekLabel: $('peek-label'),
  langSelects: [$('lang-select'), $('lang-select-pause')],
  rotateText: $('rotate-text'),
  rotateSkip: $('btn-rotate-skip'),
  tutTitle: $('tut-title'),
  tutSkip: $('tut-skip'),
  tutNext: $('tut-next'),
  muted: false,

  get lang() { return i18n.lang; },
  get dir() { return i18n.dir; },

  setMuted(m) {
    this.muted = !!m;
    this.updateMuteBtn();
  },

  updateMuteBtn() {
    if (this.btnMute) {
      this.btnMute.textContent = this.muted ? t('unmute') : t('mute');
      this.btnMute.classList.toggle('is-muted', this.muted);
    }
  },

  applyLang() {
    syncDocumentLang();
    this.titleText.textContent = t('title');
    this.subtitleText.textContent = t('subtitle');
    this.btnStart.textContent = t('start');
    this.btnTitleHowto.textContent = t('howTo');
    this.btnHowto.textContent = t('howTo');
    this.btnHowto.setAttribute('aria-label', t('howTo'));
    this.btnHowto2.textContent = t('howTo');
    this.modeTimed.textContent = t('modeTimed');
    this.modePractice.textContent = t('modePractice');
    this.pauseTitle.textContent = t('paused');
    this.btnResume.textContent = t('resume');
    this.btnRestart2.textContent = t('restart');
    this.btnHome3.textContent = t('home');
    this.btnRetry.textContent = t('retry');
    this.btnNext.textContent = t('next');
    this.btnHome2.textContent = t('home');
    this.btnRestart.textContent = t('restart');
    this.btnHome.textContent = t('home');
    if (this.peekLabel) this.peekLabel.textContent = t('peek');
    this.btnPeek.setAttribute('aria-label', t('peekHint'));
    this.btnMute.setAttribute('aria-label', this.muted ? t('unmute') : t('mute'));
    this.btnRestart.setAttribute('aria-label', t('restart'));
    this.btnHome.setAttribute('aria-label', t('home'));
    this.rotateText.textContent = t('rotateHint');
    this.rotateSkip.textContent = t('rotateSkip');
    this.tutSkip.textContent = t('tutSkip');
    this.tutNext.textContent = t('tutNext');
    this.tutTitle.textContent = t('tutTitle');
    this.fillLangOptions();
    this.updateMuteBtn();
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
    this.screenTitle.classList.remove('hidden');
    this.screenTitle.classList.add('is-active');
    this.screenPause.classList.add('hidden');
    this.screenResult.classList.add('hidden');
    this.hud.classList.add('hidden');
    if (this.boardHint) this.boardHint.classList.add('hidden');
    this.applyLang();
  },

  showGame() {
    this.screenTitle.classList.add('hidden');
    this.screenTitle.classList.remove('is-active');
    this.screenPause.classList.add('hidden');
    this.screenResult.classList.add('hidden');
    this.hud.classList.remove('hidden');
    if (this.boardHint) this.boardHint.classList.remove('hidden');
  },

  showPause() {
    this.screenPause.classList.remove('hidden');
    this.applyLang();
  },

  hidePause() {
    this.screenPause.classList.add('hidden');
  },

  showResult() {
    this.screenResult.classList.remove('hidden');
    this.hud.classList.add('hidden');
    if (this.boardHint) this.boardHint.classList.add('hidden');
  },

  hideResult() {
    this.screenResult.classList.add('hidden');
  },
};
