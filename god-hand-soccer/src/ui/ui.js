// UI 模块：语言切换 + 屏幕显隐 + HUD 文案刷新。
// 结算/教程/关卡格的动态构建由 main.js 负责（保持与 oasis 结构一致）。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';

const $ = (id) => document.getElementById(id);

export const ui = {
  titleScreen: $('screen-title'),
  readyScreen: $('screen-ready'),
  pauseScreen: $('screen-pause'),
  resultScreen: $('screen-result'),
  hud: $('hud'),
  hudDist: $('hud-dist'),
  hudTarget: $('hud-target'),
  hudScore: $('hud-score'),
  hudCombo: $('hud-combo'),
  hudOrbs: $('hud-orbs'),
  titleText: $('title-text'),
  subtitleText: $('subtitle-text'),
  taglineText: $('tagline-text'),
  bestLine: $('best-line'),
  readyTitle: $('ready-title'),
  readySub: $('ready-sub'),
  readyTap: $('ready-tap'),
  pauseTitle: $('pause-title'),
  btnStart: $('btn-start'),
  btnLevels: $('btn-levels'),
  btnLevelsBack: $('btn-levels-back'),
  btnHowto: $('btn-howto'),
  btnResume: $('btn-resume'),
  btnRestart: $('btn-restart'),
  btnHome: $('btn-home'),
  btnHome2: $('btn-home2'),
  btnRetry: $('btn-retry'),
  btnNext: $('btn-next'),
  btnPause: $('btn-pause'),
  btnMute: $('btn-mute'),
  resultTitle: $('result-title'),
  resultStars: $('result-stars'),
  resultMeta: $('result-meta'),
  levelPanel: $('level-panel'),
  levelGrid: $('level-grid'),
  levelTitle: $('level-title'),
  starsTotal: $('stars-total'),
  langSelects: [$('lang-select'), $('lang-select-pause')],
  tutTitle: $('tut-title'),
  tutText: $('tut-text'),
  tutSkip: $('tut-skip'),
  tutNext: $('tut-next'),
  rotateText: $('rotate-text'),
  rotateSkip: $('btn-rotate-skip'),

  get lang() { return i18n.lang; },
  get dir() { return i18n.dir; },

  applyLang() {
    syncDocumentLang();
    this.titleText.textContent = t('title');
    this.subtitleText.textContent = t('subtitle');
    this.taglineText.textContent = t('tagline');
    this.btnStart.textContent = t('start');
    this.btnLevels.textContent = t('levels');
    if (this.levelTitle) this.levelTitle.textContent = t('levels');
    this.btnLevelsBack.textContent = t('home');
    this.btnHowto.textContent = t('howto');
    this.btnResume.textContent = t('resume');
    this.btnRestart.textContent = t('restart');
    this.btnHome.textContent = t('home');
    this.btnHome2.textContent = t('home');
    this.btnRetry.textContent = t('retry');
    this.btnNext.textContent = t('next');
    this.pauseTitle.textContent = t('pause');
    this.readyTap.textContent = t('ready');
    this.tutTitle.textContent = t('tutTitle');
    this.tutSkip.textContent = t('tutSkip');
    this.tutNext.textContent = t('tutNext');
    this.rotateText.textContent = t('rotateHint');
    this.rotateSkip.textContent = t('rotateSkip');
    this.btnMute.textContent = this.muted ? '✕' : '♪';
    for (const sel of this.langSelects) if (sel) sel.setAttribute('aria-label', t('language'));
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

  hideAll() {
    for (const s of [this.titleScreen, this.readyScreen, this.pauseScreen, this.resultScreen]) s.classList.add('hidden');
    this.titleScreen.classList.remove('is-active');
  },

  showTitle() {
    this.hideAll();
    this.titleScreen.classList.remove('hidden');
    this.titleScreen.classList.add('is-active');
    this.levelPanel.classList.add('hidden');
    this.hud.classList.add('hidden');
    this.applyLang();
  },

  showReady() {
    this.hideAll();
    this.readyScreen.classList.remove('hidden');
    this.applyLang();
  },

  showGame() {
    this.hideAll();
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
    this.hideAll();
    this.hud.classList.remove('hidden');
    this.resultScreen.classList.remove('hidden');
  },

  setMuted(m) {
    this.muted = !!m;
    if (this.btnMute) this.btnMute.textContent = this.muted ? '✕' : '♪';
  },

  updateHUD(hud, best, endless) {
    if (!hud) return;
    const dist = Math.floor(hud.distance);
    this.hudDist.textContent = `${t('dist')}: ${dist}m`;
    if (endless) {
      this.hudTarget.textContent = `${t('best')}: ${best}m`;
    } else {
      this.hudTarget.textContent = `${t('target')}: ${hud.targetM ?? '—'}m`;
    }
    this.hudScore.textContent = `${t('score')}: ${hud.score}`;
    this.hudOrbs.textContent = `${t('orbs')}: ${hud.orbs}`;
    if (hud.combo > 1) {
      this.hudCombo.textContent = `${t('combo')} ×${hud.combo}`;
      this.hudCombo.classList.remove('hidden');
    } else {
      this.hudCombo.classList.add('hidden');
    }
  },
};
