// UI 模块：语言切换 + 屏幕显隐 + HUD 元素引用。
// 文案刷新统一走 applyLang()；切语言时调用一次即可。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';

export const ui = {
  titleScreen: document.getElementById('screen-title'),
  pauseScreen: document.getElementById('screen-pause'),
  resultScreen: document.getElementById('screen-result'),
  hud: document.getElementById('hud'),
  btnStart: document.getElementById('btn-start'),
  btnResume: document.getElementById('btn-resume'),
  langSelects: [
    document.getElementById('lang-select'),
    document.getElementById('lang-select-pause'),
  ],

  get lang() {
    return i18n.lang;
  },
  get dir() {
    return i18n.dir;
  },

  applyLang() {
    syncDocumentLang();
    const map = {
      'title-text': 'title',
      'subtitle-text': 'subtitle',
      'btn-start': 'start',
      'btn-resume': 'resume',
      'pause-title': 'paused',
      'result-title-lose': 'loseTitle',
      'result-meta': 'loseMeta',
      'btn-retry': 'retry',
      'btn-home2': 'menu',
    };
    for (const [id, key] of Object.entries(map)) {
      const el = document.getElementById(id);
      if (el) el.textContent = t(key);
    }
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

  showResult(won) {
    this.resultScreen.classList.remove('hidden');
    document.getElementById('result-title-win').classList.toggle('hidden', !won);
    document.getElementById('result-title-lose').classList.toggle('hidden', won);
    document.getElementById('result-meta').textContent = t(won ? 'winMeta' : 'loseMeta');
    document.getElementById('btn-retry').textContent = t(won ? 'next' : 'retry');
  },

  hideResult() {
    this.resultScreen.classList.add('hidden');
  },
};
