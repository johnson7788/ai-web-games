// UI 模块：标题/暂停/结算 + HUD + 多语言下拉（默认英文）。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';

function el(id) {
  return document.getElementById(id);
}

export const ui = {
  titleScreen: el('screen-title'),
  pauseScreen: el('screen-pause'),
  overScreen: el('screen-over'),
  hud: el('hud'),
  hudScore: el('hud-score'),
  hudBest: el('hud-best'),
  hudCombo: el('hud-combo'),
  hudLines: el('hud-lines'),
  titleText: el('title-text'),
  subtitleText: el('subtitle-text'),
  titleBest: el('title-best'),
  howTo: el('how-to'),
  pauseTitle: el('pause-title'),
  overTitle: el('over-title'),
  overScore: el('over-score'),
  overBest: el('over-best'),
  newBest: el('new-best'),
  btnStart: el('btn-start'),
  btnResume: el('btn-resume'),
  btnRestart: el('btn-restart'),
  btnAgain: el('btn-again'),
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
    this.overTitle.textContent = t('gameOver');
    this.btnStart.textContent = t('start');
    this.btnResume.textContent = t('resume');
    this.btnRestart.textContent = t('restartRun');
    this.btnAgain.textContent = t('playAgain');
    this.btnTitle.textContent = t('backTitle');
    for (const sel of this.langSelects) {
      if (sel) sel.setAttribute('aria-label', t('language'));
    }
    this.fillLangOptions();
    this.updateMute(this._muted);
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
    this.pauseScreen.classList.add('hidden');
    this.overScreen.classList.add('hidden');
    this.hud.classList.add('hidden');
    this.applyLang();
  },

  showGame() {
    this.titleScreen.classList.add('hidden');
    this.pauseScreen.classList.add('hidden');
    this.overScreen.classList.add('hidden');
    this.hud.classList.remove('hidden');
  },

  showPause() {
    this.pauseScreen.classList.remove('hidden');
    this.applyLang();
  },

  hidePause() {
    this.pauseScreen.classList.add('hidden');
  },

  showOver(score, best, isNewBest) {
    this.overScreen.classList.remove('hidden');
    this.hud.classList.add('hidden');
    this.overScore.textContent = `${t('finalScore')}: ${score}`;
    this.overBest.textContent = `${t('best')}: ${best}`;
    this.newBest.classList.toggle('hidden', !isNewBest);
    this.newBest.textContent = t('newBest');
    this.applyLang();
    this.overScore.textContent = `${t('finalScore')}: ${score}`;
    this.overBest.textContent = `${t('best')}: ${best}`;
  },

  hideOver() {
    this.overScreen.classList.add('hidden');
  },

  updateHUD(state) {
    this.hudScore.textContent = `${t('score')} ${state.score}`;
    this.hudBest.textContent = `${t('best')} ${state.best}`;
    this.hudLines.textContent = `${t('lines')} ${state.lines}`;
    if (state.combo > 1) {
      this.hudCombo.textContent = `${t('combo')} ×${state.combo}`;
      this.hudCombo.classList.add('hot');
    } else {
      this.hudCombo.textContent = '';
      this.hudCombo.classList.remove('hot');
    }
  },

  updateMute(muted) {
    this._muted = muted;
    this.btnMute.textContent = muted ? '🔇' : '🔊';
    this.btnMute.setAttribute('aria-label', `${t('sound')}: ${muted ? t('off') : t('on')}`);
  },

  updateBest(best) {
    this.titleBest.textContent = best > 0 ? `${t('best')}: ${best}` : '';
  },
};