// UI 模块：标题/暂停/过关 + HUD + 词表 + 操作按钮 + 多语言。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';

function el(id) { return document.getElementById(id); }

export const ui = {
  titleScreen: el('screen-title'),
  pauseScreen: el('screen-pause'),
  clearScreen: el('screen-clear'),
  hud: el('hud'),
  wordPanel: el('word-panel'),
  actions: el('actions'),
  hudLevel: el('hud-level'),
  hudScore: el('hud-score'),
  hudFound: el('hud-found'),
  wordList: el('word-list'),
  wordsLabel: el('words-label'),
  feedback: el('feedback'),
  titleText: el('title-text'),
  subtitleText: el('subtitle-text'),
  titleBest: el('title-best'),
  howTo: el('how-to'),
  pauseTitle: el('pause-title'),
  clearTitle: el('clear-title'),
  btnStart: el('btn-start'),
  btnResume: el('btn-resume'),
  btnRestart: el('btn-restart'),
  btnNext: el('btn-next'),
  btnTitle: el('btn-title'),
  btnSubmit: el('btn-submit'),
  btnShuffle: el('btn-shuffle'),
  btnHint: el('btn-hint'),
  btnClear: el('btn-clear'),
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
    this.clearTitle.textContent = t('levelClear');
    this.btnStart.textContent = t('start');
    this.btnResume.textContent = t('resume');
    this.btnRestart.textContent = t('restartRun');
    this.btnNext.textContent = t('nextLevel');
    this.btnTitle.textContent = t('backTitle');
    this.btnSubmit.textContent = t('submit');
    this.btnShuffle.textContent = t('shuffle');
    this.btnClear.textContent = t('clear');
    this.wordsLabel.textContent = t('words');
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
    this.clearScreen.classList.add('hidden');
    this.hud.classList.add('hidden');
    this.wordPanel.classList.add('hidden');
    this.actions.classList.add('hidden');
    this.feedback.classList.add('hidden');
    this.applyLang();
  },
  showGame() {
    this.titleScreen.classList.add('hidden');
    this.pauseScreen.classList.add('hidden');
    this.clearScreen.classList.add('hidden');
    this.hud.classList.remove('hidden');
    this.wordPanel.classList.remove('hidden');
    this.actions.classList.remove('hidden');
    this.feedback.classList.remove('hidden');
  },
  showPause() { this.pauseScreen.classList.remove('hidden'); this.applyLang(); },
  hidePause() { this.pauseScreen.classList.add('hidden'); },
  showClear() {
    this.clearScreen.classList.remove('hidden');
    this.applyLang();
  },
  hideClear() { this.clearScreen.classList.add('hidden'); },

  renderWords(words, found, revealed) {
    this.wordList.innerHTML = '';
    words.forEach((w, wi) => {
      const row = document.createElement('div');
      row.className = 'word-row' + (found.has(w) ? ' found' : '');
      if (found.has(w)) {
        row.textContent = w;
      } else {
        const hinted = revealed.has(`${wi}:0`);
        row.textContent = w.split('').map((ch, i) => (i === 0 && hinted ? ch : '_')).join(' ');
      }
      this.wordList.appendChild(row);
    });
  },
  setFeedback(text, kind) {
    this.feedback.textContent = text;
    this.feedback.className = `feedback ${kind || ''}`;
  },
  updateHUD(state) {
    this.hudLevel.textContent = `${t('level')} ${state.level + 1}`;
    this.hudScore.textContent = `${t('score')} ${state.score}`;
    this.hudFound.textContent = `${t('found')} ${state.found}/${state.total}`;
    this.btnHint.textContent = `${t('hint')} ${state.hintsLeft}`;
    this.btnHint.disabled = state.hintsLeft <= 0;
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