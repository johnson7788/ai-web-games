// UI 模块：标题/暂停/结算/HUD + 多语言下拉（默认英文，可切中文）
import { i18n, t, syncDocumentLang } from '../core/i18n.js';

const $ = (id) => document.getElementById(id);

export const ui = {
  titleScreen: $('screen-title'),
  pauseScreen: $('screen-pause'),
  resultScreen: $('screen-result'),
  hud: $('hud'),
  touch: $('touch-controls'),

  titleText: $('title-text'),
  subtitleText: $('subtitle-text'),
  bestText: $('best-text'),
  btnStart: $('btn-start'),
  btnTitleHowto: $('btn-title-howto'),

  pauseTitle: $('pause-title'),
  btnResume: $('btn-resume'),
  btnRestart2: $('btn-restart2'),
  btnTutReplay: $('btn-tut-replay'),
  btnHome3: $('btn-home3'),

  resultTitle: $('result-title'),
  resultStars: $('result-stars'),
  resultMeta: $('result-meta'),
  btnRetry: $('btn-retry'),
  btnNext: $('btn-next'),
  btnHome2: $('btn-home2'),

  hudLevel: $('hud-level'),
  hudLives: $('hud-lives'),
  hudEnemies: $('hud-enemies'),
  hudCombo: $('hud-combo'),
  hudScore: $('hud-score'),
  btnMute: $('btn-mute'),
  btnHowto: $('btn-howto'),

  rotateText: $('rotate-text'),
  btnRotateSkip: $('btn-rotate-skip'),

  tutTitle: $('tut-title'),
  tutText: $('tut-text'),
  tutSkip: $('tut-skip'),
  tutNext: $('tut-next'),

  langSelects: [$('lang-select'), $('lang-select-pause')].filter(Boolean),

  get lang() { return i18n.lang; },
  get dir() { return i18n.dir; },

  applyLang() {
    syncDocumentLang();
    this.titleText.textContent = t('title');
    this.subtitleText.textContent = t('subtitle');
    this.btnStart.textContent = t('start');
    this.btnTitleHowto.textContent = t('howto');
    this.pauseTitle.textContent = t('paused');
    this.btnResume.textContent = t('resume');
    this.btnRestart2.textContent = t('restart');
    this.btnTutReplay.textContent = t('howto');
    this.btnHome3.textContent = t('home');
    this.btnRetry.textContent = t('retry');
    this.btnNext.textContent = t('nextLevel');
    this.btnHome2.textContent = t('home');
    this.btnHowto.setAttribute('aria-label', t('howto'));
    this.btnMute.setAttribute('aria-label', t('mute'));
    this.rotateText.textContent = t('rotateHint');
    this.btnRotateSkip.textContent = t('rotateSkip');
    this.tutTitle.textContent = t('tutTitle');
    this.tutSkip.textContent = t('tutSkip');
    this.tutNext.textContent = t('tutNext');
    for (const sel of this.langSelects) sel.setAttribute('aria-label', 'Language');
    this.fillLangOptions();
  },

  fillLangOptions() {
    for (const sel of this.langSelects) {
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
    this.touch.classList.remove('active');
  },

  showGame() {
    this.titleScreen.classList.add('hidden');
    this.titleScreen.classList.remove('is-active');
    this.pauseScreen.classList.add('hidden');
    this.resultScreen.classList.add('hidden');
    this.hud.classList.remove('hidden');
    this.touch.classList.add('active');
  },

  showPause() {
    this.pauseScreen.classList.remove('hidden');
    this.touch.classList.remove('active');
  },

  hidePause() {
    this.pauseScreen.classList.add('hidden');
    this.touch.classList.add('active');
  },

  showResult() {
    this.resultScreen.classList.remove('hidden');
    this.touch.classList.remove('active');
  },

  hideResult() {
    this.resultScreen.classList.add('hidden');
  },

  updateHud(h) {
    if (!h) return;
    this.hudLevel.textContent = `${t('level')} ${h.level}`;
    this.hudLives.textContent = `${t('lives')} ${h.lives}`;
    this.hudEnemies.textContent = `${t('enemies')} ${h.enemiesLeft}`;
    this.hudScore.textContent = `${t('score')} ${h.score}`;
    if (h.combo >= 2) {
      this.hudCombo.textContent = `${t('combo')} ×${h.combo}`;
      this.hudCombo.classList.remove('hidden');
    } else {
      this.hudCombo.classList.add('hidden');
    }
  },

  setMuted(m) {
    this.btnMute.classList.toggle('is-muted', m);
  },
};
