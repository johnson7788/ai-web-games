// UI 模块：DOM 引用 + 语言切换 + 屏幕显隐。动态内容（HUD/答题区/结算）由 main.js 直写。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';

const $ = (id) => document.getElementById(id);

export const ui = {
  canvas: $('canvas'),
  hud: $('hud'),
  hudLevel: $('hud-level'),
  hudTime: $('hud-time'),
  hudScore: $('hud-score'),
  hudCombo: $('hud-combo'),
  btnHint: $('btn-hint'),
  hintBadge: $('hint-badge'),
  btnHowto: $('btn-howto'),
  btnMute: $('btn-mute'),
  btnRestart: $('btn-restart'),
  btnHome: $('btn-home'),

  screenTitle: $('screen-title'),
  langSelect: $('lang-select'),
  titleText: $('title-text'),
  subtitleText: $('subtitle-text'),
  starsTotal: $('stars-total'),
  btnStart: $('btn-start'),
  levelGrid: $('level-grid'),

  screenPause: $('screen-pause'),
  pauseTitle: $('pause-title'),
  btnResume: $('btn-resume'),
  btnRestart2: $('btn-restart2'),
  btnTutReplay: $('btn-tut-replay'),
  btnHome3: $('btn-home3'),
  langSelectPause: $('lang-select-pause'),

  screenResult: $('screen-result'),
  resultTitle: $('result-title'),
  resultStars: $('result-stars'),
  resultTime: $('result-time'),
  resultMeta: $('result-meta'),
  btnRetry: $('btn-retry'),
  btnNext: $('btn-next'),
  btnHome2: $('btn-home2'),

  playArea: $('play-area'),
  prompt: $('prompt'),
  options: $('options'),
  btnReadyOk: $('btn-ready-ok'),

  rotateText: $('rotate-text'),
  btnRotateSkip: $('btn-rotate-skip'),

  tutorial: $('tutorial'),
  tutTitle: $('tut-title'),
  tutText: $('tut-text'),
  tutSkip: $('tut-skip'),
  tutNext: $('tut-next'),

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
    this.btnRestart2.textContent = t('restartBtn');
    this.btnTutReplay.textContent = t('replay');
    this.btnHome3.textContent = t('menu');
    this.btnRetry.textContent = t('retry');
    this.btnNext.textContent = t('next');
    this.btnHome2.textContent = t('menu');
    this.rotateText.textContent = t('rotateHint');
    this.btnRotateSkip.textContent = t('rotateSkip');
    this.tutTitle.textContent = t('tutTitle');
    this.tutSkip.textContent = t('tutSkip');
    this.tutNext.textContent = t('tutNext');
    for (const sel of [this.langSelect, this.langSelectPause]) {
      if (sel) sel.setAttribute('aria-label', t('language'));
    }
    if (this.btnHint) this.btnHint.setAttribute('aria-label', t('hintBtn'));
    if (this.btnHowto) this.btnHowto.setAttribute('aria-label', t('howto'));
    if (this.btnMute) this.btnMute.setAttribute('aria-label', t('mute'));
    if (this.btnRestart) this.btnRestart.setAttribute('aria-label', t('restartBtn'));
    if (this.btnHome) this.btnHome.setAttribute('aria-label', t('homeBtn'));
    this.fillLangOptions();
  },

  fillLangOptions() {
    for (const sel of [this.langSelect, this.langSelectPause]) {
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
    this.playArea.classList.add('hidden');
    this.applyLang();
  },

  showGame() {
    this.screenTitle.classList.add('hidden');
    this.screenTitle.classList.remove('is-active');
    this.screenPause.classList.add('hidden');
    this.screenResult.classList.add('hidden');
    this.hud.classList.remove('hidden');
    this.playArea.classList.remove('hidden');
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
  },

  hideResult() {
    this.screenResult.classList.add('hidden');
  },
};
