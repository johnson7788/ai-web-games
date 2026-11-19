// SKY STRIKE 1942 · UI 模块：语言 + 屏幕显隐 + 静态文案刷新
import { i18n, t, syncDocumentLang } from '../core/i18n.js';

const $ = (id) => document.getElementById(id);

export const ui = {
  el: {
    hud: $('hud'),
    hudScore: $('hud-score'),
    hudBest: $('hud-best'),
    hudLevel: $('hud-level'),
    hudKills: $('hud-kills'),
    hudCombo: $('hud-combo'),
    hudLives: $('hud-lives'),
    btnHowto: $('btn-howto'),
    btnMute: $('btn-mute'),
    screenTitle: $('screen-title'),
    screenPause: $('screen-pause'),
    screenResult: $('screen-result'),
    titleText: $('title-text'),
    subtitleText: $('subtitle-text'),
    btnStart: $('btn-start'),
    btnHowtoTitle: $('btn-howto-title'),
    bestScore: $('best-score'),
    pauseTitle: $('pause-title'),
    btnResume: $('btn-resume'),
    btnRestart2: $('btn-restart2'),
    btnTutReplay: $('btn-tut-replay'),
    btnHome3: $('btn-home3'),
    resultTitle: $('result-title'),
    resultStars: $('result-stars'),
    resultScore: $('result-score'),
    resultBest: $('result-best'),
    resultNewBest: $('result-newbest'),
    btnRetry: $('btn-retry'),
    btnNext: $('btn-next'),
    btnHome2: $('btn-home2'),
    rotateText: $('rotate-text'),
    rotateSkip: $('btn-rotate-skip'),
    tutorial: $('tutorial'),
    tutTitle: $('tut-title'),
    tutText: $('tut-text'),
    tutSkip: $('tut-skip'),
    tutNext: $('tut-next'),
  },
  langSelects: [],

  init() {
    this.langSelects = [document.getElementById('lang-select'), document.getElementById('lang-select-pause')].filter(Boolean);
  },

  get lang() {
    return i18n.lang;
  },

  applyLang() {
    syncDocumentLang();
    const e = this.el;
    e.titleText.textContent = t('title');
    e.subtitleText.textContent = t('subtitle');
    e.btnStart.textContent = t('start');
    e.btnHowtoTitle.textContent = t('howto');
    e.pauseTitle.textContent = t('paused');
    e.btnResume.textContent = t('resume');
    e.btnRestart2.textContent = t('restart');
    e.btnTutReplay.textContent = t('howto');
    e.btnHome3.textContent = t('menu');
    e.btnRetry.textContent = t('retry');
    e.btnNext.textContent = t('nextLevel');
    e.btnHome2.textContent = t('menu');
    e.tutTitle.textContent = t('tutTitle');
    e.tutSkip.textContent = t('tutSkip');
    e.tutNext.textContent = t('tutNext');
    e.rotateText.textContent = t('rotateHint');
    e.rotateSkip.textContent = t('rotateSkip');
    for (const sel of this.langSelects) sel.setAttribute('aria-label', t('language'));
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
    const changed = i18n.setLang(lang);
    this.applyLang();
    return changed ? i18n.lang : i18n.lang;
  },

  showTitle() {
    this.el.screenTitle.classList.remove('hidden');
    this.el.screenTitle.classList.add('is-active');
    this.el.screenPause.classList.add('hidden');
    this.el.screenResult.classList.add('hidden');
    this.el.hud.classList.add('hidden');
  },

  showGame() {
    this.el.screenTitle.classList.add('hidden');
    this.el.screenTitle.classList.remove('is-active');
    this.el.screenPause.classList.add('hidden');
    this.el.screenResult.classList.add('hidden');
    this.el.hud.classList.remove('hidden');
  },

  showPause() {
    this.el.screenPause.classList.remove('hidden');
    this.applyLang();
  },

  hidePause() {
    this.el.screenPause.classList.add('hidden');
  },

  showResult() {
    this.el.screenResult.classList.remove('hidden');
  },

  hideResult() {
    this.el.screenResult.classList.add('hidden');
  },

  setMuted(m) {
    const btn = this.el.btnMute;
    if (!btn) return;
    btn.setAttribute('aria-label', m ? t('unmute') : t('mute'));
    btn.classList.toggle('is-muted', m);
  },
};
