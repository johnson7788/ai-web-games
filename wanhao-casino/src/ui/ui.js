// UI 模块：屏幕显隐 + 多语言下拉（默认英文，zh 可切）
// 动态 HUD / 结算内容 / 教程由 main.js 直写；这里只管语言与静态文案。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';

const $ = (id) => document.getElementById(id);

export const ui = {
  titleScreen: $('screen-title'),
  pauseScreen: $('screen-pause'),
  resultScreen: $('screen-result'),
  hud: $('hud'),
  actionBar: $('action-bar'),
  titleText: $('title-text'),
  subtitleText: $('subtitle-text'),
  pauseTitle: $('pause-title'),
  btnStart: $('btn-start'),
  btnResume: $('btn-resume'),
  btnRetry: $('btn-retry'),
  langSelects: [$('lang-select'), $('lang-select-pause')],
  howtoTitle: $('btn-howto-title'),

  get lang() {
    return i18n.lang;
  },

  applyLang() {
    syncDocumentLang();
    this.titleText.textContent = t('title');
    this.subtitleText.textContent = t('subtitle');
    this.btnStart.textContent = t('start');
    this.btnResume.textContent = t('resume');
    this.pauseTitle.textContent = t('paused');
    this.btnRetry.textContent = t('retry');
    for (const el of [$('btn-howto-title'), $('btn-howto2')]) {
      if (el) el.textContent = t('howto');
    }
    for (const el of [$('btn-restart2'), $('btn-home2'), $('btn-home3')]) {
      if (el) el.textContent = t(el.id === 'btn-restart2' ? 'restart' : 'home');
    }
    for (const sel of this.langSelects) {
      if (sel) sel.setAttribute('aria-label', t('language'));
    }
    const rt = $('rotate-text');
    const rb = $('btn-rotate-skip');
    if (rt) rt.textContent = t('rotateHint');
    if (rb) rb.textContent = t('rotateSkip');
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
    this.titleScreen.classList.remove('hidden');
    this.titleScreen.classList.add('is-active');
    this.pauseScreen.classList.add('hidden');
    this.resultScreen.classList.add('hidden');
    this.hud.classList.add('hidden');
    this.actionBar.classList.add('hidden');
    this.applyLang();
  },

  showGame() {
    this.titleScreen.classList.add('hidden');
    this.titleScreen.classList.remove('is-active');
    this.pauseScreen.classList.add('hidden');
    this.resultScreen.classList.add('hidden');
    this.hud.classList.remove('hidden');
    this.actionBar.classList.remove('hidden');
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
    this.actionBar.classList.add('hidden');
    this.pauseScreen.classList.add('hidden');
    this.resultScreen.classList.remove('hidden');
  },

  hideResult() {
    this.resultScreen.classList.add('hidden');
  },
};
