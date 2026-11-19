// UI 模块：屏幕显隐 + 静态文案多语言刷新（HUD/商店/结算动态文案由 main.js 直写）
import { i18n, t, syncDocumentLang } from '../core/i18n.js';

const $ = (id) => document.getElementById(id);

export const ui = {
  titleScreen: $('screen-title'),
  pauseScreen: $('screen-pause'),
  resultScreen: $('screen-result'),
  shopScreen: $('screen-shop'),
  hud: $('hud'),
  langSelects: [$('lang-select'), $('lang-select-pause')],

  applyLang() {
    syncDocumentLang();
    $('title-text').textContent = t('title');
    $('subtitle-text').textContent = t('subtitle');
    $('title-hint').textContent = t('hint1');
    $('btn-start').textContent = t('start');
    $('pause-title').textContent = t('paused');
    $('btn-resume').textContent = t('resume');
    $('btn-restart2').textContent = t('restart');
    $('btn-home2').textContent = t('home');
    $('btn-home3').textContent = t('home');
    $('btn-retry').textContent = t('retry');
    $('btn-shop-leave').textContent = t('shopLeave');
    $('rotate-text').textContent = t('rotateHint');
    $('btn-rotate-skip').textContent = t('rotateSkip');
    $('btn-howto').setAttribute('aria-label', t('howto'));
    $('btn-mute').setAttribute('aria-label', t('mute'));
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
    this.pauseScreen.classList.add('hidden');
    this.resultScreen.classList.add('hidden');
    this.shopScreen.classList.add('hidden');
    this.hud.classList.add('hidden');
    this.applyLang();
  },

  showGame() {
    this.titleScreen.classList.add('hidden');
    this.pauseScreen.classList.add('hidden');
    this.resultScreen.classList.add('hidden');
    this.shopScreen.classList.add('hidden');
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

  showShop() {
    this.shopScreen.classList.remove('hidden');
  },

  hideShop() {
    this.shopScreen.classList.add('hidden');
  },
};
