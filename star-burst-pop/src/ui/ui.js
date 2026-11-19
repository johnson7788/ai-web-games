// UI 模块：标题/暂停/结算/HUD/教程 + 多语言（en/zh）。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';

const $ = (id) => document.getElementById(id);

export const ui = {
  canvas: $('canvas'),
  hud: $('hud'),
  hudLevel: $('hud-level'),
  hudScore: $('hud-score'),
  hudTarget: $('hud-target'),
  hudCombo: $('hud-combo'),
  hudMoves: $('hud-moves'),
  hudBest: $('hud-best'),
  btnPause: $('btn-pause'),
  btnMute: $('btn-mute'),
  btnHowtoHud: $('btn-howto-hud'),

  titleScreen: $('screen-title'),
  pauseScreen: $('screen-pause'),
  resultScreen: $('screen-result'),
  titleText: $('title-text'),
  subtitleText: $('subtitle-text'),
  bestLabel: $('best-label'),
  bestValue: $('best-value'),
  btnStart: $('btn-start'),
  btnMute2: $('btn-mute2'),
  btnHowto: $('btn-howto'),

  pauseTitle: $('pause-title'),
  btnResume: $('btn-resume'),
  btnRestart: $('btn-restart'),
  btnHowtoPause: $('btn-howto-pause'),
  btnHome: $('btn-home'),

  resultTitle: $('result-title'),
  resultStars: $('result-stars'),
  resultScore: $('result-score'),
  resultMeta: $('result-meta'),
  btnRetry: $('btn-retry'),
  btnHome2: $('btn-home2'),

  rotateScreen: $('rotate-screen'),
  rotateText: $('rotate-text'),

  tutorialRoot: $('tutorial'),
  tutTitle: $('tut-title'),
  tutText: $('tut-text'),
  tutSkip: $('tut-skip'),
  tutNext: $('tut-next'),

  langSelects: [$('lang-select'), $('lang-select-pause')].filter(Boolean),

  muted: false,

  get lang() { return i18n.lang; },
  get dir() { return i18n.dir; },

  applyLang() {
    syncDocumentLang();
    const set = (el, key) => { if (el) el.textContent = t(key); };
    set(this.titleText, 'title');
    set(this.subtitleText, 'subtitle');
    set(this.btnStart, 'start');
    set(this.btnResume, 'resume');
    set(this.pauseTitle, 'paused');
    set(this.btnRestart, 'retry');
    set(this.btnHome, 'menu');
    set(this.btnHome2, 'menu');
    set(this.btnRetry, 'retry');
    set(this.btnHowto, 'howto');
    set(this.btnHowtoHud, 'howto');
    set(this.btnHowtoPause, 'howto');
    set(this.btnPause, 'pause');
    set(this.bestLabel, 'best');
    set(this.rotateText, 'rotateText');
    set(this.tutSkip, 'skip');
    set(this.tutNext, 'tutNext');
    for (const sel of this.langSelects) {
      if (sel) sel.setAttribute('aria-label', t('language'));
    }
    this.setMuted(this.muted);
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

  setMuted(muted) {
    this.muted = !!muted;
    const label = this.muted ? t('unmute') : t('mute');
    if (this.btnMute) this.btnMute.textContent = label;
    if (this.btnMute2) this.btnMute2.textContent = label;
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

  showResult() {
    this.hud.classList.add('hidden');
    this.resultScreen.classList.remove('hidden');
  },

  hideResult() {
    this.resultScreen.classList.add('hidden');
  },

  updateHUD(hud, best) {
    const set = (el, s) => { if (el) el.textContent = s; };
    set(this.hudLevel, `${t('level')} ${hud.level}`);
    set(this.hudScore, `${t('score')} ${hud.score}`);
    set(this.hudTarget, `${t('target')} ${hud.target}`);
    set(this.hudCombo, hud.combo > 1 ? `×${hud.combo}` : '');
    set(this.hudMoves, `${t('moves')} ${hud.moves}`);
    set(this.hudBest, `${t('best')} ${best}`);
  },

  renderTutorial(stepInfo) {
    if (this.tutTitle) this.tutTitle.textContent = stepInfo.title;
    if (this.tutText) this.tutText.textContent = stepInfo.text;
  },

  setTutorialVisible(visible) {
    if (this.tutorialRoot) this.tutorialRoot.classList.toggle('hidden', !visible);
  },

  renderResult(totalStars, score, best, newBest) {
    const set = (el, s) => { if (el) el.textContent = s; };
    set(this.resultTitle, t('resultWin'));
    set(this.resultScore, `${t('finalScore')}: ${score}`);
    set(this.resultStars, `${totalStars} / 9`);
    set(this.resultMeta, newBest ? `${t('newBest')} ${t('best')}: ${best}` : `${t('best')}: ${best}`);
  },
};
