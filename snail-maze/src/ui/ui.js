// UI 模块：屏幕显隐 + 多语言（en 默认，zh 完整）。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';

const $ = (id) => document.getElementById(id);

export const ui = {
  applyLang() {
    syncDocumentLang();
    $('title-text').textContent = t('title');
    $('subtitle-text').textContent = t('subtitle');
    $('btn-start').textContent = t('start');
    $('btn-resume').textContent = t('resume');
    $('btn-restart').setAttribute('aria-label', t('restart'));
    $('btn-home').setAttribute('aria-label', t('menu'));
    $('btn-home2').textContent = t('menu');
    $('btn-home3').textContent = t('menu');
    $('btn-restart2').textContent = t('restart');
    $('btn-howto2').textContent = t('howto');
    $('btn-mute').setAttribute('aria-label', t('mute'));
    $('pause-title').textContent = t('paused');
    $('btn-retry').textContent = t('retry');
    $('btn-next').textContent = t('next');
    $('rotate-text').textContent = t('rotateHint');
    $('btn-rotate-skip').textContent = t('rotateSkip');
    $('tut-skip').textContent = t('tutSkip');
    $('tut-next').textContent = t('tutNext');
    for (const sel of [$('lang-select'), $('lang-select-pause')]) {
      if (sel) sel.setAttribute('aria-label', t('language'));
    }
    this.fillLangOptions();
  },

  fillLangOptions() {
    for (const sel of [$('lang-select'), $('lang-select-pause')]) {
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
    $('screen-title').classList.remove('hidden');
    $('screen-title').classList.add('is-active');
    $('screen-pause').classList.add('hidden');
    $('screen-result').classList.add('hidden');
    $('hud').classList.add('hidden');
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
  },

  hideResult() {
    $('screen-result').classList.add('hidden');
  },

  setMuted(m) {
    $('btn-mute').classList.toggle('is-muted', m);
  },
};
