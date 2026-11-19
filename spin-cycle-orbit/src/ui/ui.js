// UI 模块：标题/暂停/结算/HUD + 多语言（en 默认，zh 可切）
import { i18n, t, syncDocumentLang } from '../core/i18n.js';

const $ = (id) => document.getElementById(id);

export const ui = {
  // 屏幕
  titleScreen: $('screen-title'),
  pauseScreen: $('screen-pause'),
  resultScreen: $('screen-result'),
  hud: $('hud'),

  // 标题
  titleText: $('title-text'),
  subtitleText: $('subtitle-text'),
  bestLabel: $('best-label'),
  btnStart: $('btn-start'),

  // 暂停
  pauseTitle: $('pause-title'),
  btnResume: $('btn-resume'),

  // HUD
  hudScore: $('hud-score'),
  hudBest: $('hud-best'),
  hudCombo: $('hud-combo'),
  hudLevel: $('hud-level'),
  hudFrenzy: $('hud-frenzy'),
  btnMute: $('btn-mute'),

  // 结算
  resultTitle: $('result-title'),
  resultNew: $('result-new'),
  resultScore: $('result-score'),
  resultBest: $('result-best'),
  resultCombo: $('result-combo'),
  resultLevel: $('result-level'),

  // 语言下拉
  langSelects: [$('lang-select'), $('lang-select-pause')].filter(Boolean),

  get lang() {
    return i18n.lang;
  },
  get dir() {
    return i18n.dir;
  },

  applyLang() {
    syncDocumentLang();
    if (this.titleText) this.titleText.textContent = t('title');
    if (this.subtitleText) this.subtitleText.textContent = t('subtitle');
    if (this.btnStart) this.btnStart.textContent = t('start');
    if (this.pauseTitle) this.pauseTitle.textContent = t('paused');
    if (this.btnResume) this.btnResume.textContent = t('resume');
    if (this.resultTitle) this.resultTitle.textContent = t('resultTitle');
    if (this.bestLabel) this.bestLabel.textContent = t('best') + ': 0';
    for (const sel of this.langSelects) {
      sel.setAttribute('aria-label', t('language'));
    }
    // 按钮文案
    const map = {
      'btn-retry': t('retry'),
      'btn-restart': t('restart'),
      'btn-restart2': t('restart'),
      'btn-home': t('menu'),
      'btn-home2': t('menu'),
      'btn-home3': t('menu'),
      'btn-howto': t('howto'),
      'btn-howto2': t('howto'),
      'btn-mute': '🔇',
      'btn-rotate-skip': t('rotateSkip'),
    };
    for (const [id, txt] of Object.entries(map)) {
      const el = $(id);
      if (el) el.textContent = txt;
    }
    const rt = $('rotate-text');
    if (rt) rt.textContent = t('rotateHint');
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
    this.pauseScreen.classList.add('hidden');
    this.resultScreen.classList.add('hidden');
    this.hud.classList.add('hidden');
    this.applyLang();
  },

  showGame() {
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
    this.hud.classList.add('hidden');
  },

  hideResult() {
    this.resultScreen.classList.add('hidden');
  },

  updateHud(h) {
    if (this.hudScore) this.hudScore.textContent = t('score') + ' ' + (h.score | 0);
    if (this.hudLevel) this.hudLevel.textContent = t('level') + ' ' + h.level;
    if (this.hudCombo) {
      this.hudCombo.textContent = h.combo >= 2 ? t('combo') + ' ×' + Math.min(h.combo, 8) : '';
      this.hudCombo.style.display = h.combo >= 2 ? '' : 'none';
    }
    if (this.hudFrenzy) {
      this.hudFrenzy.textContent = h.frenzy ? t('frenzy') + '!' : '';
      this.hudFrenzy.style.display = h.frenzy ? '' : 'none';
    }
  },

  updateBest(best) {
    if (this.hudBest) this.hudBest.textContent = t('best') + ' ' + (best | 0);
    if (this.bestLabel) this.bestLabel.textContent = t('best') + ': ' + (best | 0);
  },

  setMuted(m) {
    if (this.btnMute) this.btnMute.textContent = m ? '🔈' : '🔇';
  },
};
