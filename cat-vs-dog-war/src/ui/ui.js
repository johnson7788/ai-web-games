// UI 模块：屏幕显隐 + HUD 文案刷新 + 多语言下拉（默认英文，ar 自动 RTL）
import { i18n, t, syncDocumentLang } from '../core/i18n.js';

const $ = (id) => document.getElementById(id);

export const ui = {
  // 屏幕
  titleScreen: $('screen-title'),
  pauseScreen: $('screen-pause'),
  resultScreen: $('screen-result'),
  hud: $('hud'),
  tutorial: $('tutorial'),
  rotate: $('rotate-screen'),

  // HUD
  hudTime: $('hud-time'),
  hudScore: $('hud-score'),
  hudTarget: $('hud-target'),
  hudStage: $('hud-stage'),
  hudCombo: $('hud-combo'),
  hudHearts: $('hud-hearts'),
  hudBest: $('hud-best'),
  hudMute: $('hud-mute'),

  // 标题
  titleText: $('title-text'),
  subtitleText: $('subtitle-text'),
  btnStart: $('btn-start'),
  titleHowto: $('title-howto'),
  titleMute: $('title-mute'),
  langSelects: [$('lang-select'), $('lang-select-pause')],

  // 暂停
  pauseTitle: $('pause-title'),
  btnResume: $('btn-resume'),
  btnRestart: $('pause-restart'),
  btnHome: $('pause-home'),
  pauseHowto: $('pause-howto'),

  // 结算
  resultTitle: $('result-title'),
  resultStars: $('result-stars'),
  resultScore: $('result-score'),
  resultBest: $('result-best'),
  resultReason: $('result-reason'),
  resultNewbest: $('result-newbest'),
  btnRetry: $('btn-retry'),
  btnHome2: $('btn-home2'),

  // 教程
  tutTitle: $('tut-title'),
  tutText: $('tut-text'),
  tutSkip: $('tut-skip'),
  tutNext: $('tut-next'),

  // 旋转提示
  rotateText: $('rotate-text'),
  btnRotateSkip: $('btn-rotate-skip'),

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
    this.titleHowto.textContent = t('howTo');
    this.pauseHowto.textContent = t('howTo');
    this.btnResume.textContent = t('resume');
    this.pauseTitle.textContent = t('paused');
    this.btnRestart.textContent = t('restart');
    this.btnHome.textContent = t('menu');
    this.btnHome2.textContent = t('menu');
    this.btnRetry.textContent = t('retry');
    this.rotateText.textContent = t('rotateHint');
    this.btnRotateSkip.textContent = t('rotateSkip');
    this.tutSkip.textContent = t('tutSkip');
    this.tutNext.textContent = t('tutNext');
    this.tutTitle.textContent = t('tutTitle');
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
    this.titleScreen.classList.add('is-active');
    this.titleScreen.classList.remove('hidden');
    this.pauseScreen.classList.add('hidden');
    this.resultScreen.classList.add('hidden');
    this.hud.classList.add('hidden');
    this.applyLang();
  },

  showGame() {
    this.titleScreen.classList.remove('is-active');
    this.titleScreen.classList.add('hidden');
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

  setMuted(m) {
    this.hudMute.textContent = m ? '🔇' : '🔊';
    this.titleMute.textContent = m ? '🔇' : '🔊';
  },
};
