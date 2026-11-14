// UI 模块：标题/暂停/完成 + HUD + 题干/选项 + 多语言。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';

function el(id) { return document.getElementById(id); }

export const ui = {
  titleScreen: el('screen-title'),
  pauseScreen: el('screen-pause'),
  doneScreen: el('screen-done'),
  hud: el('hud'),
  quiz: el('quiz'),
  hudRound: el('hud-round'),
  hudScore: el('hud-score'),
  questionLabel: el('question-label'),
  options: el('options'),
  feedback: el('feedback'),
  titleText: el('title-text'),
  subtitleText: el('subtitle-text'),
  titleBest: el('title-best'),
  howTo: el('how-to'),
  pauseTitle: el('pause-title'),
  doneTitle: el('done-title'),
  doneScore: el('done-score'),
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
    this.doneTitle.textContent = t('quizDone');
    this.btnStart.textContent = t('start');
    this.btnResume.textContent = t('resume');
    this.btnRestart.textContent = t('restartRun');
    this.btnAgain.textContent = t('playAgain');
    this.btnTitle.textContent = t('backTitle');
    this.questionLabel.textContent = t('whichBrand');
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
    this.doneScreen.classList.add('hidden');
    this.hud.classList.add('hidden');
    this.quiz.classList.add('hidden');
    this.applyLang();
  },
  showGame() {
    this.titleScreen.classList.add('hidden');
    this.pauseScreen.classList.add('hidden');
    this.doneScreen.classList.add('hidden');
    this.hud.classList.remove('hidden');
    this.quiz.classList.remove('hidden');
  },
  showPause() { this.pauseScreen.classList.remove('hidden'); this.applyLang(); },
  hidePause() { this.pauseScreen.classList.add('hidden'); },
  showDone(score) {
    this.doneScreen.classList.remove('hidden');
    this.quiz.classList.add('hidden');
    this.doneScore.textContent = `${t('finalScore')}: ${score}`;
    this.applyLang();
    this.doneScore.textContent = `${t('finalScore')}: ${score}`;
  },
  hideDone() { this.doneScreen.classList.add('hidden'); },

  renderOptions(options, phase, lastResult) {
    this.options.innerHTML = '';
    options.forEach((name, idx) => {
      const btn = document.createElement('button');
      btn.className = 'opt-btn';
      btn.dataset.idx = String(idx);
      btn.textContent = name;
      if (phase === 'reveal' && lastResult) {
        btn.disabled = true;
        if (idx === lastResult.correct) btn.classList.add('correct');
        else if (idx === lastResult.chosen) btn.classList.add('wrong');
      }
      this.options.appendChild(btn);
    });
  },
  setFeedback(text, kind) {
    this.feedback.textContent = text;
    this.feedback.className = `feedback ${kind || ''}`;
  },
  updateHUD(state) {
    this.hudRound.textContent = `${t('round')} ${state.round}/${state.rounds}`;
    this.hudScore.textContent = `${t('score')} ${state.score}`;
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