// UI 模块：标题/暂停/通关 + HUD + 多语言下拉（默认英文）
import { i18n, t, syncDocumentLang } from '../core/i18n.js';

function el(id) {
  return document.getElementById(id);
}

export const ui = {
  titleScreen: el('screen-title'),
  pauseScreen: el('screen-pause'),
  winScreen: el('screen-win'),
  hud: el('hud'),
  hudRemaining: el('hud-remaining'),
  hudPairs: el('hud-pairs'),
  hudTime: el('hud-time'),
  hudBest: el('title-best'),
  titleText: el('title-text'),
  subtitleText: el('subtitle-text'),
  pauseTitle: el('pause-title'),
  winTitle: el('win-title'),
  winTime: el('win-time'),
  winStars: el('win-stars'),
  btnStart: el('btn-start'),
  btnResume: el('btn-resume'),
  btnRestart: el('btn-restart'),
  btnAgain: el('btn-again'),
  btnTitle: el('btn-title'),
  btnHint: el('btn-hint'),
  btnUndo: el('btn-undo'),
  btnShuffle: el('btn-shuffle'),
  btnMute: el('btn-mute'),
  langSelects: [el('lang-select'), el('lang-select-pause')],

  get lang() { return i18n.lang; },
  get dir() { return i18n.dir; },

  applyLang() {
    syncDocumentLang();
    this.titleText.textContent = t('title');
    this.subtitleText.textContent = t('subtitle');
    this.pauseTitle.textContent = t('paused');
    this.winTitle.textContent = t('win');
    this.btnStart.textContent = t('start');
    this.btnResume.textContent = t('resume');
    this.btnRestart.textContent = t('restartRun');
    this.btnAgain.textContent = t('playAgain');
    this.btnTitle.textContent = t('backTitle');
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
    this.pauseScreen.classList.add('hidden');
    this.winScreen.classList.add('hidden');
    this.hud.classList.add('hidden');
    this.applyLang();
  },

  showGame() {
    this.titleScreen.classList.add('hidden');
    this.pauseScreen.classList.add('hidden');
    this.winScreen.classList.add('hidden');
    this.hud.classList.remove('hidden');
  },

  showPause() {
    this.pauseScreen.classList.remove('hidden');
    this.applyLang();
  },

  hidePause() {
    this.pauseScreen.classList.add('hidden');
  },

  showWin(timeSec, stars) {
    this.winScreen.classList.remove('hidden');
    this.hud.classList.add('hidden');
    this.winTime.textContent = `${t('winTime')}: ${formatTime(timeSec)}`;
    let s = '';
    for (let i = 0; i < 3; i += 1) s += i < stars ? '★' : '☆';
    this.winStars.textContent = `${t('stars')}: ${s}`;
    this.applyLang();
    this.winTime.textContent = `${t('winTime')}: ${formatTime(timeSec)}`;
  },

  hideWin() {
    this.winScreen.classList.add('hidden');
  },

  updateHUD(state) {
    this.hudRemaining.textContent = `${t('remaining')}: ${state.remaining}`;
    this.hudPairs.textContent = `${t('pairs')}: ${state.pairs}`;
    this.hudTime.textContent = `${t('time')}: ${formatTime(state.timeSec)}`;
  },

  updateButtons(limits) {
    const bind = (btn, label, left) => {
      btn.textContent = `${label} ${left}`;
      btn.disabled = left <= 0;
    };
    bind(this.btnHint, t('hint'), limits.hint);
    bind(this.btnUndo, t('undo'), limits.undo);
    bind(this.btnShuffle, t('shuffle'), limits.shuffle);
  },

  updateMute(muted) {
    this.btnMute.textContent = `${t('sound')}: ${muted ? t('off') : t('on')}`;
  },

  updateBest(bestSec) {
    if (bestSec == null || bestSec <= 0) {
      this.hudBest.textContent = `${t('best')}: --`;
    } else {
      this.hudBest.textContent = `${t('best')}: ${formatTime(bestSec)}`;
    }
  },
};

function formatTime(sec) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}
