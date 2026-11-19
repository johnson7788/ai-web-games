// UI 模块：屏幕显隐 / 语言下拉 / 静态文案。HUD/战斗/商店/教程的动态内容由 main.js 直写。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';

const $ = (id) => document.getElementById(id);

export const ui = {
  titleScreen: $('screen-title'),
  pauseScreen: $('screen-pause'),
  resultScreen: $('screen-result'),
  hud: $('hud'),
  titleText: $('title-text'),
  subtitleText: $('subtitle-text'),
  starsTotal: $('stars-total'),
  pauseTitle: $('pause-title'),
  resultTitle: $('result-title'),
  btnStart: $('btn-start'),
  btnResume: $('btn-resume'),
  btnRetry: $('btn-retry'),
  btnRestart2: $('btn-restart2'),
  btnTutReplay: $('btn-tut-replay'),
  btnHome2: $('btn-home2'),
  btnHome3: $('btn-home3'),
  langSelects: [$('lang-select'), $('lang-select-pause')],
  btnMute: $('btn-mute'),
  btnHowto: $('btn-howto'),
  btnBag: $('btn-bag'),
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
    this.btnResume.textContent = t('resume');
    this.pauseTitle.textContent = t('paused');
    this.btnRetry.textContent = t('retry');
    this.btnRestart2.textContent = t('restart');
    this.btnTutReplay.textContent = t('howto');
    this.btnHome2.textContent = t('menu');
    this.btnHome3.textContent = t('menu');
    this.btnHowto.title = t('howto');
    for (const sel of this.langSelects) {
      if (sel) sel.setAttribute('aria-label', t('language'));
    }
    this.fillLangOptions();
    const rt = $('rotate-text');
    const rb = $('btn-rotate-skip');
    if (rt) rt.textContent = t('rotateHint');
    if (rb) rb.textContent = t('rotateSkip');
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

  showResult(title, meta, starsHtml) {
    this.resultTitle.textContent = title;
    $('result-meta').textContent = meta;
    $('result-stars').innerHTML = starsHtml;
    this.resultScreen.classList.remove('hidden');
  },

  hideResult() {
    this.resultScreen.classList.add('hidden');
  },

  setMuted(m) {
    if (this.btnMute) this.btnMute.classList.toggle('is-muted', m);
  },
};
