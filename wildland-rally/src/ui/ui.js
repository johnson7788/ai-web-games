// UI 模块：标题/暂停/结算/HUD + 多语言（默认英文，?lang 覆盖，localStorage 持久）
import { i18n, t, syncDocumentLang } from '../core/i18n.js';

const $ = (id) => document.getElementById(id);

export const ui = {
  titleScreen: $('screen-title'),
  pauseScreen: $('screen-pause'),
  resultScreen: $('screen-result'),
  howtoScreen: $('screen-howto'),
  hud: $('hud'),
  controls: $('controls'),

  titleText: $('title-text'),
  subtitleText: $('subtitle-text'),
  pauseTitle: $('pause-title'),
  bestText: $('best-text'),
  moveHint: $('move-hint'),
  dashHint: $('dash-hint'),
  novaHint: $('nova-hint'),
  dashLabel: $('dash-label'),
  novaLable: $('nova-label'),
  howtoTitle: $('howto-title'),
  howtoBody: $('howto-body'),
  btnStart: $('btn-start'),
  btnResume: $('btn-resume'),
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
    this.moveHint.textContent = t('moveHint');
    this.dashHint.textContent = t('dashHint');
    this.novaHint.textContent = t('novaHint');
    if (this.dashLabel) this.dashLabel.textContent = t('dash');
    if (this.novaLable) this.novaLable.textContent = t('nova');
    this.howtoTitle.textContent = t('howtoTitle');
    this.howtoBody.textContent = t('howtoBody');
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
    this.titleScreen.classList.add('is-active');
    this.pauseScreen.classList.add('hidden');
    this.resultScreen.classList.add('hidden');
    this.howtoScreen.classList.add('hidden');
    this.hud.classList.add('hidden');
    this.controls.classList.remove('visible');
    this.applyLang();
  },

  showGame() {
    this.titleScreen.classList.add('hidden');
    this.titleScreen.classList.remove('is-active');
    this.pauseScreen.classList.add('hidden');
    this.resultScreen.classList.add('hidden');
    this.howtoScreen.classList.add('hidden');
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
    this.applyLang();
  },

  hideResult() {
    this.resultScreen.classList.add('hidden');
  },

  showHowto() {
    this.howtoScreen.classList.remove('hidden');
    this.applyLang();
  },

  hideHowto() {
    this.howtoScreen.classList.add('hidden');
  },

  setControlsVisible(v) {
    this.controls.classList.toggle('visible', v);
  },

  setMuted(m) {
    const b = $('btn-mute');
    if (b) b.classList.toggle('is-muted', m);
  },
};
