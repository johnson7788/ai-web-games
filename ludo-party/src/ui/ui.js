// UI 模块：标题/暂停/胜利 + 骰子/掷骰按钮/回合状态/进度 + 多语言。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';

function el(id) { return document.getElementById(id); }

export const ui = {
  titleScreen: el('screen-title'),
  pauseScreen: el('screen-pause'),
  winScreen: el('screen-win'),
  panel: el('panel'),
  hud: el('hud'),
  diceFace: el('dice-face'),
  turnStatus: el('turn-status'),
  p0Progress: el('p0-progress'),
  p1Progress: el('p1-progress'),
  feedback: el('feedback'),
  titleText: el('title-text'),
  subtitleText: el('subtitle-text'),
  titleBest: el('title-best'),
  howTo: el('how-to'),
  pauseTitle: el('pause-title'),
  winTitle: el('win-title'),
  btnStart: el('btn-start'),
  btnResume: el('btn-resume'),
  btnRestart: el('btn-restart'),
  btnAgain: el('btn-again'),
  btnTitle: el('btn-title'),
  btnRoll: el('btn-roll'),
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
    this.btnAgain.textContent = t('playAgain');
    this.btnTitle.textContent = t('backTitle');
    this.btnRoll.textContent = t('roll');
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
    this.winScreen.classList.add('hidden');
    this.panel.classList.add('hidden');
    this.hud.classList.add('hidden');
    this.applyLang();
  },
  showGame() {
    this.titleScreen.classList.add('hidden');
    this.pauseScreen.classList.add('hidden');
    this.winScreen.classList.add('hidden');
    this.panel.classList.remove('hidden');
    this.hud.classList.remove('hidden');
  },
  showPause() { this.pauseScreen.classList.remove('hidden'); this.applyLang(); },
  hidePause() { this.pauseScreen.classList.add('hidden'); },
  showWin(playerWon) {
    this.winScreen.classList.remove('hidden');
    this.winTitle.textContent = playerWon ? t('youWin') : t('botWin');
    this.applyLang();
  },
  hideWin() { this.winScreen.classList.add('hidden'); },

  setDice(d) { this.diceFace.textContent = d == null ? '?' : String(d); },
  setTurnStatus(text) { this.turnStatus.textContent = text; },
  setProgress(finished) {
    this.p0Progress.textContent = `${t('you')}: ${finished[0]}/4 ${t('finished')}`;
    this.p1Progress.textContent = `${t('bot')}: ${finished[1]}/4 ${t('finished')}`;
  },
  setRollEnabled(on) { this.btnRoll.disabled = !on; },
  setFeedback(text, kind) {
    this.feedback.textContent = text;
    this.feedback.className = `feedback ${kind || ''}`;
  },
  updateMute(muted) {
    this._muted = muted;
    this.btnMute.textContent = muted ? '🔇' : '🔊';
    this.btnMute.setAttribute('aria-label', `${t('sound')}: ${muted ? t('off') : t('on')}`);
  },
  updateBest(wins) {
    this.titleBest.textContent = wins > 0 ? `${t('wins')}: ${wins}` : '';
  },
};