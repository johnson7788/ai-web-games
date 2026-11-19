// UI 模块：标题/暂停/结算/HUD 显隐 + 语言（默认英文，zh 可切）
import { i18n, t, syncDocumentLang } from '../core/i18n.js';

const $ = (id) => document.getElementById(id);

export const ui = {
  titleScreen: $('screen-title'),
  pauseScreen: $('screen-pause'),
  resultScreen: $('screen-result'),
  hud: $('hud'),
  canvas: $('canvas'),
  titleText: $('title-text'),
  subtitleText: $('subtitle-text'),
  pauseTitle: $('pause-title'),
  resultTitle: $('result-title'),
  resultStars: $('result-stars'),
  resultScore: $('result-score'),
  resultMeta: $('result-meta'),
  btnStart: $('btn-start'),
  btnResume: $('btn-resume'),
  btnRestart2: $('btn-restart2'),
  btnTutReplay: $('btn-tut-replay'),
  btnHome3: $('btn-home3'),
  btnRetry: $('btn-retry'),
  btnNext: $('btn-next'),
  btnHome2: $('btn-home2'),
  btnHowto: $('btn-howto'),
  btnMute: $('btn-mute'),
  btnRestart: $('btn-restart'),
  btnHome: $('btn-home'),
  btnPower: $('btn-power'),
  btnBank: $('btn-bank'),
  hudLevel: $('hud-level'),
  hudTime: $('hud-time'),
  hudTarget: $('hud-target'),
  hudBest: $('hud-best'),
  hudScore: $('hud-score'),
  hudCombo: $('hud-combo'),
  rotateScreen: $('rotate-screen'),
  rotateText: $('rotate-text'),
  rotateSkip: $('btn-rotate-skip'),
  tutTitle: $('tut-title'),
  tutText: $('tut-text'),
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
    this.btnResume.textContent = t('resume');
    this.pauseTitle.textContent = t('paused');
    this.btnRestart2.textContent = t('restart');
    this.btnTutReplay.textContent = t('howto');
    this.btnHome3.textContent = t('home');
    this.btnRetry.textContent = t('retry');
    this.btnNext.textContent = t('next');
    this.btnHome2.textContent = t('home');
    this.btnHowto.setAttribute('aria-label', t('howto'));
    this.btnMute.setAttribute('aria-label', t('mute'));
    this.rotateText.textContent = t('rotateHint');
    this.rotateSkip.textContent = t('rotateSkip');
    this.tutTitle.textContent = t('tutTitle');
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
    i18n.setLang(lang);
    this.applyLang();
    return i18n.lang;
  },

  setMuted(m) {
    this.btnMute.classList.toggle('is-muted', m);
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
    this.hud.classList.add('hidden');
    this.applyLang();
  },

  hideResult() {
    this.resultScreen.classList.add('hidden');
  },
};
