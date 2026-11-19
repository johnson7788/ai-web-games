// UI 模块：DOM 引用 + 语言 + 屏幕显隐 + 静音图标。HUD/结算/教程的文案由 main.js 直写。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';

const $ = (id) => document.getElementById(id);

export const ui = {
  canvas: $('canvas'),

  // HUD
  hud: $('hud'),
  hudScore: $('hud-score'),
  hudBest: $('hud-best'),
  hudShield: $('hud-shield'),
  hudSector: $('hud-sector'),
  hudCombo: $('hud-combo'),
  btnMute: $('btn-mute'),
  btnRestart: $('btn-restart'),
  btnHome: $('btn-home'),

  // 标题
  screenTitle: $('screen-title'),
  langSelect: $('lang-select'),
  titleText: $('title-text'),
  subtitleText: $('subtitle-text'),
  titleBest: $('title-best'),
  btnStart: $('btn-start'),
  btnHowto: $('btn-howto'),

  // 暂停
  screenPause: $('screen-pause'),
  pauseTitle: $('pause-title'),
  btnResume: $('btn-resume'),
  btnRestart2: $('btn-restart2'),
  btnHome3: $('btn-home3'),
  langSelectPause: $('lang-select-pause'),

  // 结算
  screenResult: $('screen-result'),
  resultTitle: $('result-title'),
  resultStars: $('result-stars'),
  resultScore: $('result-score'),
  resultBest: $('result-best'),
  resultNewbest: $('result-newbest'),
  resultReason: $('result-reason'),
  btnRetry: $('btn-retry'),
  btnHome2: $('btn-home2'),

  // 旋转提示 / 教程
  rotateScreen: $('rotate-screen'),
  rotateText: $('rotate-text'),
  btnRotateSkip: $('btn-rotate-skip'),
  tutorial: $('tutorial'),
  tutCard: $('tut-card'),
  tutTitle: $('tut-title'),
  tutText: $('tut-text'),
  tutSkip: $('tut-skip'),
  tutNext: $('tut-next'),

  langSelects: [],

  get lang() { return i18n.lang; },
  get dir() { return i18n.dir; },

  applyLang() {
    syncDocumentLang();
    this.titleText.textContent = t('title');
    this.subtitleText.textContent = t('subtitle');
    this.btnStart.textContent = t('start');
    this.btnHowto.textContent = t('howto');
    this.pauseTitle.textContent = t('paused');
    this.btnResume.textContent = t('resume');
    this.btnRestart2.textContent = t('restart');
    this.btnHome3.textContent = t('menu');
    this.btnRetry.textContent = t('retry');
    this.btnHome2.textContent = t('menu');
    this.btnRestart.textContent = '↻';
    this.btnHome.textContent = '⌂';
    this.btnRotateSkip.textContent = t('rotateSkip');
    this.rotateText.textContent = t('rotateHint');
    this.tutSkip.textContent = t('tutSkip');
    this.tutNext.textContent = t('tutNext');
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
    const ok = i18n.setLang(lang);
    this.applyLang();
    return i18n.lang;
  },

  showTitle() {
    this.screenTitle.classList.remove('hidden');
    this.screenPause.classList.add('hidden');
    this.screenResult.classList.add('hidden');
    this.hud.classList.add('hidden');
    this.applyLang();
  },

  showGame() {
    this.screenTitle.classList.add('hidden');
    this.screenPause.classList.add('hidden');
    this.screenResult.classList.add('hidden');
    this.hud.classList.remove('hidden');
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
    this.applyLang();
  },

  hideResult() {
    this.screenResult.classList.add('hidden');
  },

  setMuted(muted) {
    if (this.btnMute) {
      this.btnMute.textContent = muted ? '🔇' : '🔊';
      this.btnMute.classList.toggle('is-muted', muted);
    }
  },
};

ui.langSelects = [ui.langSelect, ui.langSelectPause];
