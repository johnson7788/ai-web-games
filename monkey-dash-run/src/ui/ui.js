// UI 模块：标题/暂停/结算/HUD + 多语言下拉（默认英文，?lang= 覆盖）
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
  btnHowto: $('btn-howto'),
  langSelects: [$('lang-select'), $('lang-select-pause')],
  muted: false,

  get lang() { return i18n.lang; },
  get dir() { return i18n.dir; },

  applyLang() {
    syncDocumentLang();
    this.titleText.textContent = t('title');
    this.subtitleText.textContent = t('subtitle');
    this.btnStart.textContent = t('start');
    this.btnResume.textContent = t('resume');
    this.pauseTitle.textContent = t('paused');
    this.btnHowto.textContent = t('howto');
    $('btn-restart2').textContent = t('restart');
    $('btn-tut-replay').textContent = t('howto');
    $('btn-home2').textContent = t('menu');
    $('btn-home3').textContent = t('menu');
    $('btn-retry').textContent = t('retry');
    $('result-title').textContent = t('resultTitle');
    $('result-newbest').textContent = t('resultNewBest');
    $('result-score-label').textContent = t('resultScore');
    $('result-best-label').textContent = t('resultBest');
    $('result-tier-label').textContent = t('resultTier');
    $('result-combo-label').textContent = t('resultCombo');
    $('result-hint').textContent = t('gameOverHint');
    $('rotate-text').textContent = t('rotateHint');
    $('btn-rotate-skip').textContent = t('rotateSkip');
    for (const sel of this.langSelects) {
      if (sel) sel.setAttribute('aria-label', t('language'));
    }
    this.fillLangOptions();
    this.setMuted(this.muted);
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
    if (i18n.setLang(lang)) this.applyLang();
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

  showResult() {
    this.hud.classList.add('hidden');
    this.resultScreen.classList.remove('hidden');
  },

  hideResult() {
    this.resultScreen.classList.add('hidden');
  },

  setMuted(muted) {
    this.muted = !!muted;
    const b = $('btn-mute');
    if (b) b.textContent = muted ? '🔇' : '🔊';
  },
};
