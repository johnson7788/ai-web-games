// UI 模块：标题/暂停/过关 + HUD + 多语言下拉（默认英文）。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';

function el(id) { return document.getElementById(id); }

export const ui = {
  titleScreen: el('screen-title'),
  pauseScreen: el('screen-pause'),
  clearScreen: el('screen-clear'),
  hud: el('hud'),
  hudPuzzle: el('hud-puzzle'),
  hudFound: el('hud-found'),
  hudTime: el('hud-time'),
  titleText: el('title-text'),
  subtitleText: el('subtitle-text'),
  titleBest: el('title-best'),
  howTo: el('how-to'),
  pauseTitle: el('pause-title'),
  clearTitle: el('clear-title'),
  clearScore: el('clear-score'),
  btnStart: el('btn-start'),
  btnNew: el('btn-new'),
  btnResume: el('btn-resume'),
  btnRestart: el('btn-restart'),
  btnAgain: el('btn-again'),
  btnTitle: el('btn-title'),
  btnHint: el('btn-hint'),
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
    this.btnNew.textContent = t('newPuzzle');
    this.btnResume.textContent = t('resume');
    this.btnRestart.textContent = t('restartRun');
    this.btnAgain.textContent = t('playAgain');
    this.btnTitle.textContent = t('backTitle');
    for (const sel of this.langSelects) if (sel) sel.setAttribute('aria-label', t('language'));
    this.fillLangOptions();
    this.updateMute(this._muted);
    this.updateHint(this._hintsLeft);
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

  setLang(lang) { i18n.setLang(lang); this.applyLang(); return i18n.lang; },

  showTitle() {
    this.titleScreen.classList.remove('hidden');
    this.pauseScreen.classList.add('hidden');
    this.clearScreen.classList.add('hidden');
    this.hud.classList.add('hidden');
    this.applyLang();
  },
  showGame() {
    this.titleScreen.classList.add('hidden');
    this.pauseScreen.classList.add('hidden');
    this.clearScreen.classList.add('hidden');
    this.hud.classList.remove('hidden');
  },
  showPause() { this.pauseScreen.classList.remove('hidden'); this.applyLang(); },
  hidePause() { this.pauseScreen.classList.add('hidden'); },
  showClear(score, timeSec) {
    this.clearScreen.classList.remove('hidden');
    this.hud.classList.add('hidden');
    this.clearTitle.textContent = t('clear');
    this.clearScore.textContent = `${t('found')}: ${score} · ${t('time')}: ${fmt(timeSec)}`;
    this.applyLang();
    this.clearScore.textContent = `${t('found')}: ${score} · ${t('time')}: ${fmt(timeSec)}`;
  },
  hideClear() { this.clearScreen.classList.add('hidden'); },

  updateHUD(state) {
    this.hudPuzzle.textContent = state.puzzleLabel;
    this.hudFound.textContent = `${t('found')} ${state.found}/${state.total}`;
    this.hudTime.textContent = `${t('time')} ${fmt(state.timeSec)}`;
  },
  updateHint(left) {
    this._hintsLeft = left;
    this.btnHint.textContent = `${t('hint')} ${left}`;
    this.btnHint.disabled = left <= 0;
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

function fmt(sec) {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}