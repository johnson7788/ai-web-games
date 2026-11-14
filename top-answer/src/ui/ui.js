// UI 模块：标题/暂停/过关 + HUD + 题干/答案板（DOM）+ 输入 + 多语言。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';

function el(id) { return document.getElementById(id); }

export const ui = {
  titleScreen: el('screen-title'),
  pauseScreen: el('screen-pause'),
  clearScreen: el('screen-clear'),
  hud: el('hud'),
  playArea: el('play-area'),
  hudRound: el('hud-round'),
  hudScore: el('hud-score'),
  hudBest: el('hud-best'),
  questionText: el('question-text'),
  board: el('board'),
  answerInput: el('answer-input'),
  btnGuess: el('btn-guess'),
  feedback: el('feedback'),
  titleText: el('title-text'),
  subtitleText: el('subtitle-text'),
  titleBest: el('title-best'),
  howTo: el('how-to'),
  pauseTitle: el('pause-title'),
  clearTitle: el('clear-title'),
  clearScore: el('clear-score'),
  btnStart: el('btn-start'),
  btnResume: el('btn-resume'),
  btnRestart: el('btn-restart'),
  btnNext: el('btn-next'),
  btnTitle: el('btn-title'),
  btnHint: el('btn-hint'),
  btnReveal: el('btn-reveal'),
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
    this.btnGuess.textContent = t('guess');
    this.btnReveal.textContent = t('reveal');
    this.answerInput.placeholder = t('typeAnswer');
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
    this.playArea.classList.add('hidden');
    this.applyLang();
  },
  showGame() {
    this.titleScreen.classList.add('hidden');
    this.pauseScreen.classList.add('hidden');
    this.clearScreen.classList.add('hidden');
    this.hud.classList.remove('hidden');
    this.playArea.classList.remove('hidden');
  },
  showPause() { this.pauseScreen.classList.remove('hidden'); this.applyLang(); },
  hidePause() { this.pauseScreen.classList.add('hidden'); },
  showClear(score, isLast, giveup) {
    this.clearScreen.classList.remove('hidden');
    this.clearTitle.textContent = isLast ? t('allClear') : t('roundClear');
    this.clearScore.textContent = `${t('score')}: ${score}`;
    this.btnNext.textContent = isLast ? t('playAgain') : t('nextRound');
    this.applyLang();
    this.clearScore.textContent = `${t('score')}: ${score}`;
  },
  hideClear() { this.clearScreen.classList.add('hidden'); },

  setQuestion(prompt) { this.questionText.textContent = prompt; },

  renderBoard(answers, lang) {
    this.board.innerHTML = '';
    answers.forEach((a, i) => {
      const row = document.createElement('div');
      row.className = 'ans-row' + (a.revealed ? ' revealed' : '');
      const rank = document.createElement('span');
      rank.className = 'rank';
      rank.textContent = String(i + 1);
      const text = document.createElement('span');
      text.className = 'ans-text';
      if (a.revealed) {
        text.textContent = lang === 'zh' ? a.zh : a.en;
      } else if (a.hinted) {
        text.textContent = `${a.en[0]}${' _'.repeat(Math.max(1, a.en.length - 1))}`;
      } else {
        text.textContent = '• • • • •';
      }
      const pts = document.createElement('span');
      pts.className = 'ans-pts';
      pts.textContent = a.revealed ? `${a.points}` : '?';
      row.append(rank, text, pts);
      this.board.appendChild(row);
    });
  },

  setFeedback(text, kind) {
    this.feedback.textContent = text;
    this.feedback.className = `feedback ${kind || ''}`;
  },

  updateHUD(state) {
    this.hudRound.textContent = `${t('round')} ${state.round}`;
    this.hudScore.textContent = `${t('score')} ${state.score}`;
    this.hudBest.textContent = `${t('best')} ${state.best}`;
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

  getInput() { return this.answerInput.value; },
  clearInput() { this.answerInput.value = ''; },
  focusInput() { this.answerInput.focus(); },
};