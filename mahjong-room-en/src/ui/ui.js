// UI 模块：标题/暂停/结算显隐 + 语言切换（默认英文，zh 完整）
import { i18n, t, syncDocumentLang } from '../core/i18n.js';

const $ = (id) => document.getElementById(id);

export const ui = {
  get lang() { return i18n.lang; },
  get dir() { return i18n.dir; },

  applyLang() {
    syncDocumentLang();
    $('title-text').textContent = t('title');
    $('subtitle-text').textContent = t('subtitle');
    $('btn-start').textContent = t('start');
    $('pause-title').textContent = t('paused');
    $('btn-resume').textContent = t('resume');
    $('btn-restart2').textContent = t('restart');
    $('btn-tut-replay').textContent = t('howto');
    $('btn-home2').textContent = t('menu');
    $('btn-retry').textContent = t('retry');
    $('btn-home3').textContent = t('menu');
    $('btn-discard').textContent = t('discard');
    $('btn-hu').textContent = t('hu');
    $('btn-peng').textContent = t('peng');
    $('btn-gang').textContent = t('gang');
    $('btn-pass').textContent = t('pass');
    $('btn-lucky').textContent = t('lucky');
    $('rotate-text').textContent = t('rotateHint');
    $('btn-rotate-skip').textContent = t('rotateSkip');
    for (const id of ['lang-select', 'lang-select-pause']) {
      const el = $(id);
      if (el) el.setAttribute('aria-label', t('language'));
    }
    this.fillLangOptions();
  },

  fillLangOptions() {
    for (const id of ['lang-select', 'lang-select-pause']) {
      const el = $(id);
      if (!el) continue;
      el.innerHTML = '';
      for (const item of i18n.options()) {
        const opt = document.createElement('option');
        opt.value = item.code;
        opt.textContent = item.name;
        if (item.code === i18n.lang) opt.selected = true;
        el.appendChild(opt);
      }
    }
  },

  setLang(lang) {
    i18n.setLang(lang);
    this.applyLang();
    return i18n.lang;
  },

  showTitle() {
    $('screen-title').classList.remove('hidden');
    $('screen-title').classList.add('is-active');
    $('screen-pause').classList.add('hidden');
    $('screen-result').classList.add('hidden');
    $('hud').classList.add('hidden');
    $('actionbar').classList.add('hidden');
    this.applyLang();
  },

  showGame() {
    $('screen-title').classList.add('hidden');
    $('screen-title').classList.remove('is-active');
    $('screen-pause').classList.add('hidden');
    $('screen-result').classList.add('hidden');
    $('hud').classList.remove('hidden');
  },

  showPause() {
    $('screen-pause').classList.remove('hidden');
    this.applyLang();
  },

  hidePause() {
    $('screen-pause').classList.add('hidden');
  },

  showResult() {
    $('screen-result').classList.remove('hidden');
    $('actionbar').classList.add('hidden');
  },

  hideResult() {
    $('screen-result').classList.add('hidden');
  },
};
