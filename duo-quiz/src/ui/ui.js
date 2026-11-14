// UI 模块：标题/暂停/结束 + 题干/计时 + 双人选项按钮 + 揭示 + 多语言。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';
import { mascotSrc } from '../render/art.js';

function el(id) { return document.getElementById(id); }

export const ui = {
  titleScreen: el('screen-title'),
  pauseScreen: el('screen-pause'),
  doneScreen: el('screen-done'),
  playArea: el('play-area'),
  hud: el('hud'),
  questionText: el('question-text'),
  roundLabel: el('round-label'),
  timerFill: el('timer-fill'),
  p1Score: el('p1-score'),
  p2Score: el('p2-score'),
  p1Mascot: el('p1-mascot'),
  p2Mascot: el('p2-mascot'),
  p1Options: el('p1-options'),
  p2Options: el('p2-options'),
  revealBar: el('reveal-bar'),
  revealInfo: el('reveal-info'),
  doneTitle: el('done-title'),
  doneScores: el('done-scores'),
  titleText: el('title-text'),
  subtitleText: el('subtitle-text'),
  howTo: el('how-to'),
  pauseTitle: el('pause-title'),
  btnStart: el('btn-start'),
  btnResume: el('btn-resume'),
  btnRestart: el('btn-restart'),
  btnAgain: el('btn-again'),
  btnTitle: el('btn-title'),
  btnNext: el('btn-next'),
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
    this.btnNext.textContent = t('next');
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
    this.playArea.classList.add('hidden');
    this.hud.classList.add('hidden');
    this.applyLang();
  },
  showGame() {
    this.titleScreen.classList.add('hidden');
    this.pauseScreen.classList.add('hidden');
    this.doneScreen.classList.add('hidden');
    this.playArea.classList.remove('hidden');
    this.hud.classList.remove('hidden');
  },
  showPause() { this.pauseScreen.classList.remove('hidden'); this.applyLang(); },
  hidePause() { this.pauseScreen.classList.add('hidden'); },
  showDone(winner, scores) {
    this.doneScreen.classList.remove('hidden');
    this.doneTitle.textContent = winner === -1 ? t('draw') : `${t('winner')}: ${winner === 0 ? t('p1') : t('p2')}`;
    this.doneScores.textContent = `${t('p1')} ${scores[0]} : ${scores[1]} ${t('p2')}`;
    this.applyLang();
    this.doneScores.textContent = `${t('p1')} ${scores[0]} : ${scores[1]} ${t('p2')}`;
  },
  hideDone() { this.doneScreen.classList.add('hidden'); },

  setQuestion(text) { this.questionText.textContent = text; },
  setRound(round, rounds) { this.roundLabel.textContent = `${t('round')} ${round}/${rounds}`; },
  setTimer(frac) { this.timerFill.style.width = `${Math.max(0, frac * 100)}%`; },
  setScores(scores) {
    this.p1Score.textContent = `${t('p1')}: ${scores[0]}`;
    this.p2Score.textContent = `${t('p2')}: ${scores[1]}`;
  },

  renderOptions(q, lang, answers, phase, lastResult) {
    const build = (container, player) => {
      container.innerHTML = '';
      q.options.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = 'opt-btn';
        btn.dataset.player = String(player);
        btn.dataset.idx = String(idx);
        btn.textContent = `${idx + 1}. ${opt[lang] || opt.en}`;
        if (phase === 'question') {
          if (answers[player] === idx) btn.classList.add('locked');
          btn.disabled = answers[player] !== null;
        } else if (phase === 'reveal' && lastResult) {
          btn.disabled = true;
          if (idx === lastResult.correctIndex) btn.classList.add('correct');
          else if (answers[player] === idx) btn.classList.add('wrong');
        }
        container.appendChild(btn);
      });
    };
    build(this.p1Options, 0);
    build(this.p2Options, 1);
  },

  setReveal(visible, text) {
    this.revealBar.classList.toggle('hidden', !visible);
    this.revealInfo.textContent = text || '';
  },
  setMascot(player, expr) {
    const img = player === 0 ? this.p1Mascot : this.p2Mascot;
    if (!img) return;
    const src = mascotSrc(player, expr) || mascotSrc(player, 'neutral');
    if (img.getAttribute('src') !== src) img.src = src;
  },
  updateMute(muted) {
    this._muted = muted;
    this.btnMute.textContent = muted ? '🔇' : '🔊';
    this.btnMute.setAttribute('aria-label', `${t('sound')}: ${muted ? t('off') : t('on')}`);
  },
};