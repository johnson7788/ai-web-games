// UI 模块：语言下拉 + 屏幕显隐 + HUD 文本。结算/关卡格/教程由 main.js 直写。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';

const $ = (id) => document.getElementById(id);

export const ui = {
  titleScreen: $('screen-title'),
  pauseScreen: $('screen-pause'),
  resultScreen: $('screen-result'),
  hud: $('hud'),
  rotateScreen: $('rotate-screen'),

  hudLevel: $('hud-level'),
  hudTime: $('hud-time'),
  hudStars: $('hud-stars'),
  hudShots: $('hud-shots'),
  hudCombo: $('hud-combo'),
  hudMega: $('hud-mega'),
  btnMute: $('btn-mute'),

  titleText: $('title-text'),
  subtitleText: $('subtitle-text'),
  pauseTitle: $('pause-title'),
  resultTitle: $('result-title'),
  btnStart: $('btn-start'),
  btnResume: $('btn-resume'),
  btnRetry: $('btn-retry'),
  btnNext: $('btn-next'),
  btnHowtoTitle: $('btn-howto-title'),
  btnTutReplay: $('btn-tut-replay'),
  rotateText: $('rotate-text'),
  rotateSkip: $('btn-rotate-skip'),
  howtoHud: $('btn-howto'),
  tutTitle: $('tut-title'),
  tutNext: $('tut-next'),
  tutSkip: $('tut-skip'),

  langSelects: [$('lang-select'), $('lang-select-pause')],

  get lang() { return i18n.lang; },
  get dir() { return i18n.dir; },

  applyLang() {
    syncDocumentLang();
    this.titleText.textContent = t('title');
    this.subtitleText.textContent = t('subtitle');
    this.btnStart.textContent = t('start');
    this.btnResume.textContent = t('resume');
    this.pauseTitle.textContent = t('paused');
    this.btnRetry.textContent = t('retry');
    this.btnNext.textContent = t('next');
    this.btnHowtoTitle.textContent = t('howto');
    this.btnTutReplay.textContent = t('howto');
    this.rotateText.textContent = t('rotateHint');
    this.rotateSkip.textContent = t('rotateSkip');
    this.tutTitle.textContent = t('tutTitle');
    this.tutNext.textContent = t('tutNext');
    this.tutSkip.textContent = t('tutSkip');
    if (this.howtoHud) this.howtoHud.setAttribute('aria-label', t('howto'));
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
    if (i18n.setLang(lang)) this.applyLang();
    return i18n.lang;
  },

  showTitle() {
    this.hideAll();
    this.titleScreen.classList.remove('hidden');
    this.titleScreen.classList.add('is-active');
  },

  showGame() {
    this.hideAll();
    this.hud.classList.remove('hidden');
  },

  showPause() {
    this.pauseScreen.classList.remove('hidden');
  },

  hidePause() {
    this.pauseScreen.classList.add('hidden');
  },

  showResult() {
    this.resultScreen.classList.remove('hidden');
  },

  hideResult() {
    this.resultScreen.classList.add('hidden');
  },

  hideAll() {
    for (const s of [this.titleScreen, this.pauseScreen, this.resultScreen]) {
      if (s) s.classList.add('hidden');
    }
    this.titleScreen.classList.remove('is-active');
    this.hud.classList.add('hidden');
  },

  setMuted(m) {
    if (this.btnMute) this.btnMute.classList.toggle('is-muted', !!m);
  },

  updateHud(h) {
    if (!h) return;
    this.hudLevel.textContent = `${t('level')} ${h.level}`;
    this.hudTime.textContent = `${t('time')} ${Math.floor(h.time)}s`;
    this.hudStars.textContent = `★ ${h.stars}/${h.starTotal}`;
    this.hudShots.textContent = `${t('shots')} ${h.shotsLeft}`;
    this.hudCombo.classList.toggle('hidden', !(h.combo >= 2));
    this.hudCombo.textContent = `${t('combo')} ×${h.combo}`;
    this.hudMega.classList.toggle('hidden', !h.mega);
    this.hudMega.textContent = t('mega');
  },
};
