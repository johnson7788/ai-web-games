// UI 模块：标题/暂停 + HUD（静音/暂停）+ 多语言。游戏内 HUD 为 Canvas。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';
function el(id) { return document.getElementById(id); }

export const ui = {
  titleScreen: el('screen-title'),
  pauseScreen: el('screen-pause'),
  hud: el('hud'),
  titleText: el('title-text'),
  subtitleText: el('subtitle-text'),
  howTo: el('how-to'),
  pauseTitle: el('pause-title'),
  btnStart: el('btn-start'),
  btnResume: el('btn-resume'),
  btnRestart: el('btn-restart'),
  btnTitle: el('btn-title'),
  btnMute: el('btn-mute'),
  btnPause: el('btn-pause'),
  langSelects: [el('lang-select'), el('lang-select-pause')],

  get lang() { return i18n.lang; },
  get dir() { return i18n.dir; },

  applyLang() {
    syncDocumentLang();
    this.titleText.textContent = t('title');
    this.subtitleText.textContent = t('subtitle');
    this.howTo.textContent = t('howTo');
    this.pauseTitle.textContent = t('paused');
    this.btnStart.textContent = t('start');
    this.btnResume.textContent = t('resume');
    this.btnRestart.textContent = t('restartRun');
    this.btnTitle.textContent = t('backTitle');
    for (const sel of this.langSelects) if (sel) sel.setAttribute('aria-label', t('language'));
    this.fillLangOptions();
    this.updateMute(this._muted);
  },
  fillLangOptions() {
    for (const sel of this.langSelects) {
      if (!sel) continue;
      sel.innerHTML = '';
      for (const item of i18n.options()) {
        const opt = document.createElement('option');
        opt.value = item.code; opt.textContent = item.name;
        if (item.code === i18n.lang) opt.selected = true;
        sel.appendChild(opt);
      }
    }
  },
  setLang(lang) { i18n.setLang(lang); this.applyLang(); return i18n.lang; },

  showTitle() {
    this.titleScreen.classList.remove('hidden');
    this.pauseScreen.classList.add('hidden');
    this.hud.classList.add('hidden');
    this.applyLang();
  },
  showGame() {
    this.titleScreen.classList.add('hidden');
    this.pauseScreen.classList.add('hidden');
    this.hud.classList.remove('hidden');
  },
  showPause() { this.pauseScreen.classList.remove('hidden'); this.applyLang(); },
  hidePause() { this.pauseScreen.classList.add('hidden'); },
  updateMute(muted) {
    this._muted = muted;
    this.btnMute.textContent = muted ? '🔇' : '🔊';
    this.btnMute.setAttribute('aria-label', `${t('sound')}: ${muted ? t('off') : t('on')}`);
  },
};