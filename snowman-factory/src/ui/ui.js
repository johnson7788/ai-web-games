// UI 模块：标题/暂停/结算/HUD 的 DOM 显隐与多语言（默认英文，zh 可切）。
// HUD 数值、结算内容、教程文案由 main.js 直写；这里只做静态文案与屏幕切换。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';

const $ = (id) => document.getElementById(id);

export const ui = {
  els: {
    canvas: $('canvas'),
    hud: $('hud'),
    hudLevel: $('hud-level'),
    hudScore: $('hud-score'),
    hudCombo: $('hud-combo'),
    hudTime: $('hud-time'),
    hudLives: $('hud-lives'),
    btnMute: $('btn-mute'),
    btnDrop: $('btn-drop'),
    screenTitle: $('screen-title'),
    screenPause: $('screen-pause'),
    screenResult: $('screen-result'),
    titleText: $('title-text'),
    subtitleText: $('subtitle-text'),
    taglineText: $('tagline-text'),
    btnStart: $('btn-start'),
    btnCrazy: $('btn-crazy'),
    btnHowto: $('btn-howto'),
    pauseTitle: $('pause-title'),
    btnResume: $('btn-resume'),
    btnRestart2: $('btn-restart2'),
    btnHome: $('btn-home'),
    resultTitle: $('result-title'),
    resultReason: $('result-reason'),
    resultScore: $('result-score'),
    resultBest: $('result-best'),
    btnRetry: $('btn-retry'),
    btnHome2: $('btn-home2'),
    langSelects: [$('lang-select'), $('lang-select-pause')],
    rotateText: $('rotate-text'),
    rotateSkip: $('btn-rotate-skip'),
  },

  get lang() { return i18n.lang; },
  get dir() { return i18n.dir; },

  applyLang() {
    syncDocumentLang();
    const e = this.els;
    e.titleText.textContent = t('title');
    e.subtitleText.textContent = t('subtitle');
    e.taglineText.textContent = t('tagline');
    e.btnStart.textContent = t('start');
    e.btnCrazy.textContent = t('crazy');
    e.btnHowto.textContent = t('howto');
    e.btnDrop.textContent = t('drop');
    e.pauseTitle.textContent = t('paused');
    e.btnResume.textContent = t('resume');
    e.btnRestart2.textContent = t('restart');
    e.btnHome.textContent = t('home');
    e.btnRetry.textContent = t('retry');
    e.btnHome2.textContent = t('menu');
    if (e.rotateText) e.rotateText.textContent = t('rotateHint');
    if (e.rotateSkip) e.rotateSkip.textContent = t('rotateSkip');
    for (const sel of e.langSelects) {
      if (sel) sel.setAttribute('aria-label', t('language'));
    }
    this.fillLangOptions();
  },

  fillLangOptions() {
    for (const sel of this.els.langSelects) {
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
    this.els.screenTitle.classList.remove('hidden');
    this.els.screenPause.classList.add('hidden');
    this.els.screenResult.classList.add('hidden');
    this.els.hud.classList.add('hidden');
    this.els.btnDrop.classList.add('hidden');
    this.applyLang();
  },

  showGame() {
    this.els.screenTitle.classList.add('hidden');
    this.els.screenPause.classList.add('hidden');
    this.els.screenResult.classList.add('hidden');
    this.els.hud.classList.remove('hidden');
    this.els.btnDrop.classList.remove('hidden');
  },

  showPause() {
    this.els.screenPause.classList.remove('hidden');
    this.applyLang();
  },

  hidePause() {
    this.els.screenPause.classList.add('hidden');
  },

  showResult() {
    this.els.screenPause.classList.add('hidden');
    this.els.hud.classList.add('hidden');
    this.els.btnDrop.classList.add('hidden');
    this.els.screenResult.classList.remove('hidden');
  },

  hideResult() {
    this.els.screenResult.classList.add('hidden');
  },

  setMuted(m) {
    this.els.btnMute.classList.toggle('is-muted', m);
  },
};
