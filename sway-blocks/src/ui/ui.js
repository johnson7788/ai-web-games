// UI 模块：屏幕显隐 + 多语言 + 结算展示。HUD/关卡格/教程 DOM 由 main.js 直写。
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
  resultTitle: $('result-title'),
  resultStars: $('result-stars'),
  resultScore: $('result-score'),
  btnStart: $('btn-start'),
  btnResume: $('btn-resume'),
  langSelects: [$('lang-select'), $('lang-select-pause')].filter(Boolean),

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

  showResult(won, stars, score) {
    this.resultTitle.textContent = won ? t('winTitle') : t('loseTitle');
    this.resultTitle.classList.toggle('lose', !won);
    this.resultStars.innerHTML = won
      ? `<span class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>`
      : '';
    this.resultScore.textContent = won ? `${t('score')}: ${score}` : '';
    this.resultScreen.classList.remove('hidden');
  },

  hideResult() {
    this.resultScreen.classList.add('hidden');
  },

  setMuted(muted) {
    const btn = $('btn-mute');
    if (btn) btn.textContent = muted ? '🔇' : '🔊';
  },
};
