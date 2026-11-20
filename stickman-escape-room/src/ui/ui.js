// UI 模块：标题/暂停/结算/HUD + 多语言下拉（默认英文，可切中文）
import { i18n, t, syncDocumentLang } from '../core/i18n.js';

const $ = (id) => document.getElementById(id);

export const ui = {
  titleScreen: $('screen-title'),
  pauseScreen: $('screen-pause'),
  resultScreen: $('screen-result'),
  hud: $('hud'),
  moveBtns: $('move-btns'),
  titleText: $('title-text'),
  subtitleText: $('subtitle-text'),
  btnStart: $('btn-start'),
  btnHowtoTitle: $('btn-howto-title'),
  pauseTitle: $('pause-title'),
  btnResume: $('btn-resume'),
  btnRestart2: $('btn-restart2'),
  btnTutReplay: $('btn-tut-replay'),
  btnHome3: $('btn-home3'),
  btnRetry: $('btn-retry'),
  btnHome2: $('btn-home2'),
  resultTitle: $('result-title'),
  resultStars: $('result-stars'),
  resultMeta: $('result-meta'),
  btnLeft: $('btn-left'),
  btnRight: $('btn-right'),
  btnMute: $('btn-mute'),
  btnHowto: $('btn-howto'),
  btnRestart: $('btn-restart'),
  btnHome: $('btn-home'),
  langSelects: [$('lang-select'), $('lang-select-pause')],
  rotateText: $('rotate-text'),
  rotateSkip: $('btn-rotate-skip'),
  badgeShield: $('badge-shield'),
  badgeSlow: $('badge-slow'),
  badgeBoost: $('badge-boost'),

  get lang() { return i18n.lang; },
  get dir() { return i18n.dir; },

  applyLang() {
    syncDocumentLang();
    this.titleText.textContent = t('title');
    this.subtitleText.textContent = t('subtitle');
    this.btnStart.textContent = t('start');
    this.btnHowtoTitle.textContent = t('howto');
    this.pauseTitle.textContent = t('paused');
    this.btnResume.textContent = t('resume');
    this.btnRestart2.textContent = t('restart');
    this.btnTutReplay.textContent = t('howto');
    this.btnHome3.textContent = t('home');
    this.btnRetry.textContent = t('retry');
    this.btnHome2.textContent = t('home');
    this.btnLeft.setAttribute('aria-label', t('moveLeft'));
    this.btnRight.setAttribute('aria-label', t('moveRight'));
    this.btnHowto.setAttribute('aria-label', t('howto'));
    this.btnRestart.setAttribute('aria-label', t('restart'));
    this.btnHome.setAttribute('aria-label', t('home'));
    this.badgeShield.setAttribute('title', t('shield'));
    this.badgeSlow.setAttribute('title', t('slow'));
    this.badgeBoost.setAttribute('title', t('boost'));
    this.rotateText.textContent = t('rotateHint');
    this.rotateSkip.textContent = t('rotateSkip');
    for (const sel of this.langSelects) {
      if (sel) sel.setAttribute('aria-label', t('language'));
    }
    this.fillLangOptions();
    this.updateMuteLabel();
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

  updateMuteLabel() {
    const muted = this.btnMute.classList.contains('is-muted');
    this.btnMute.setAttribute('aria-label', muted ? t('unmute') : t('mute'));
    this.btnMute.textContent = muted ? '🔇' : '🔊';
  },

  showTitle() {
    this.titleScreen.classList.remove('hidden');
    this.titleScreen.classList.add('is-active');
    this.pauseScreen.classList.add('hidden');
    this.resultScreen.classList.add('hidden');
    this.hud.classList.add('hidden');
    this.moveBtns.classList.add('hidden');
    this.applyLang();
  },

  showGame() {
    this.titleScreen.classList.add('hidden');
    this.titleScreen.classList.remove('is-active');
    this.pauseScreen.classList.add('hidden');
    this.resultScreen.classList.add('hidden');
    this.hud.classList.remove('hidden');
    this.moveBtns.classList.remove('hidden');
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
    this.moveBtns.classList.add('hidden');
  },

  hideResult() {
    this.resultScreen.classList.add('hidden');
  },

  updateHud(h) {
    if (!h) return;
    $('hud-level').textContent = `${t('level')} ${h.level}`;
    $('hud-combo').textContent = `${t('combo')} ×${h.combo}`;
    $('hud-score').textContent = `${t('score')} ${h.score}`;
    $('hud-stars').textContent = `★ ${h.totalStars}`;
    this.badgeShield.textContent = `🛡${h.shield}`;
    this.badgeSlow.textContent = `⏳${h.slow}`;
    this.badgeBoost.textContent = `⚡${h.boost}`;
    const hint = $('hud-hint');
    if (hint) {
      hint.textContent = h.phase === 'descending' ? t('hintDescend') : (h.phase === 'countdown' ? t('hintGap') : '');
    }
  },
};
