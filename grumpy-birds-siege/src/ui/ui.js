// UI 模块：标题/暂停/结算/HUD + 多语言下拉（默认英文，zh 完整）。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';

const $ = (id) => document.getElementById(id);

export const ui = {
  canvas: $('canvas'),
  hud: $('hud'),
  hudLevel: $('hud-level'),
  hudScore: $('hud-score'),
  hudCombo: $('hud-combo'),
  hudWalls: $('hud-walls'),
  progressFill: $('progress-fill'),
  shieldBadge: $('shield-badge'),
  btnMute: $('btn-mute'),
  btnHowto: $('btn-howto'),
  screenTitle: $('screen-title'),
  screenPause: $('screen-pause'),
  screenResult: $('screen-result'),
  titleText: $('title-text'),
  subtitleText: $('subtitle-text'),
  taglineText: $('tagline-text'),
  btnStart: $('btn-start'),
  levelGrid: $('level-grid'),
  starsTotal: $('stars-total'),
  pauseTitle: $('pause-title'),
  btnResume: $('btn-resume'),
  btnRestart2: $('btn-restart2'),
  btnHome2: $('btn-home2'),
  resultTitle: $('result-title'),
  resultStars: $('result-stars'),
  resultMeta: $('result-meta'),
  btnRetry: $('btn-retry'),
  btnNext: $('btn-next'),
  btnHome3: $('btn-home3'),
  rotateText: $('rotate-text'),
  btnRotateSkip: $('btn-rotate-skip'),
  tutTitle: $('tut-title'),
  tutText: $('tut-text'),
  tutNext: $('tut-next'),
  tutSkip: $('tut-skip'),
  langSelects: [$('lang-select'), $('lang-select-pause')],
  muted: false,

  get lang() { return i18n.lang; },
  get dir() { return i18n.dir; },

  applyLang() {
    syncDocumentLang();
    this.titleText.textContent = t('title');
    this.subtitleText.textContent = t('subtitle');
    this.taglineText.textContent = t('tagline');
    this.btnStart.textContent = t('start');
    this.btnResume.textContent = t('resume');
    this.btnRestart2.textContent = t('restart');
    this.btnHome2.textContent = t('menu');
    this.btnHome3.textContent = t('menu');
    this.btnRetry.textContent = t('retry');
    this.btnNext.textContent = t('next');
    this.pauseTitle.textContent = t('paused');
    this.btnHowto.textContent = '?';
    this.rotateText.textContent = t('rotateHint');
    this.btnRotateSkip.textContent = t('rotateSkip');
    this.tutTitle.textContent = t('tutTitle');
    this.tutSkip.textContent = t('tutSkip');
    this.tutNext.textContent = t('tutNext');
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

  setMuted(m) {
    this.muted = !!m;
    this.btnMute.textContent = m ? '🔇' : '🔊';
    this.btnMute.classList.toggle('is-muted', m);
  },

  showTitle() {
    this.screenTitle.classList.remove('hidden');
    this.screenTitle.classList.add('is-active');
    this.screenPause.classList.add('hidden');
    this.screenResult.classList.add('hidden');
    this.hud.classList.add('hidden');
  },

  showGame() {
    this.screenTitle.classList.add('hidden');
    this.screenTitle.classList.remove('is-active');
    this.screenPause.classList.add('hidden');
    this.screenResult.classList.add('hidden');
    this.hud.classList.remove('hidden');
  },

  showPause() {
    this.screenPause.classList.remove('hidden');
    this.applyLang();
  },

  hidePause() {
    this.screenPause.classList.add('hidden');
  },

  showResult() {
    this.screenResult.classList.remove('hidden');
    this.hud.classList.add('hidden');
  },

  hideResult() {
    this.screenResult.classList.add('hidden');
  },

  updateHud(hud) {
    this.hudLevel.textContent = `${t('level')} ${hud.level}`;
    this.hudScore.textContent = `${t('score')} ${hud.score}`;
    this.hudWalls.textContent = `${t('resultWalls')} ${hud.passed}/${hud.winPass}`;
    const comboText = hud.combo > 1 ? ` · ${t('combo')} ×${hud.combo}` : '';
    this.hudCombo.textContent = hud.combo > 1 ? comboText.trim() : '';
    this.hudCombo.classList.toggle('hidden', hud.combo <= 1);
    const pct = Math.min(100, Math.round((hud.passed / hud.winPass) * 100));
    this.progressFill.style.width = `${pct}%`;
    this.shieldBadge.classList.toggle('hidden', !hud.shield);
    this.shieldBadge.textContent = hud.shield ? `🛡 ${t('shield')}` : '';
  },
};
