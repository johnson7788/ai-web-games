// UI 模块：标题/暂停/结果/HUD/题目/反馈/教程 + 多语言（默认英文，zh 可切）。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';
import { QUESTIONS, ROUND_NAMES } from '../../config/questions.js';

const $ = (id) => document.getElementById(id);

export const ui = {
  canvas: $('canvas'),
  hud: $('hud'),
  hudRound: $('hud-round'),
  hudQ: $('hud-q'),
  hudTime: $('hud-time'),
  hudScore: $('hud-score'),
  hudCombo: $('hud-combo'),
  hudSignal: $('hud-signal'),
  btnMute: $('btn-mute'),
  btnPause: $('btn-pause'),
  btnHowto: $('btn-howto'),
  btnRestart: $('btn-restart'),
  btnHome: $('btn-home'),

  titleScreen: $('screen-title'),
  pauseScreen: $('screen-pause'),
  resultScreen: $('screen-result'),
  quizUI: $('quiz-ui'),
  questionText: $('question-text'),
  btnSafe: $('btn-safe'),
  btnUnsafe: $('btn-unsafe'),
  btnPrev: $('btn-prev'),
  btnNext: $('btn-next'),
  roundBadge: $('round-badge'),
  feedback: $('feedback'),

  titleText: $('title-text'),
  subtitleText: $('subtitle-text'),
  pauseTitle: $('pause-title'),
  btnStart: $('btn-start'),
  btnResume: $('btn-resume'),
  btnRestart2: $('btn-restart2'),
  btnHome2: $('btn-home2'),
  btnHome3: $('btn-home3'),
  btnHowto2: $('btn-howto2'),
  langSelects: [$('lang-select'), $('lang-select-pause')],

  resultTitle: $('result-title'),
  resultStars: $('result-stars'),
  resultScore: $('result-score'),
  resultMeta: $('result-meta'),
  resultReason: $('result-reason'),
  btnRetry: $('btn-retry'),

  rotateScreen: $('rotate-screen'),
  rotateText: $('rotate-text'),
  rotateSkip: $('btn-rotate-skip'),

  tutorial: $('tutorial'),
  tutTitle: $('tut-title'),
  tutText: $('tut-text'),
  tutSkip: $('tut-skip'),
  tutNext: $('tut-next'),

  _feedbackTimer: null,

  get lang() { return i18n.lang; },
  get dir() { return i18n.dir; },

  applyLang() {
    syncDocumentLang();
    this.titleText.textContent = t('title');
    this.subtitleText.textContent = t('subtitle');
    this.btnStart.textContent = t('start');
    this.btnResume.textContent = t('resume');
    this.pauseTitle.textContent = t('paused');
    this.btnSafe.textContent = t('safeLong');
    this.btnUnsafe.textContent = t('unsafeLong');
    this.rotateText.textContent = t('rotateHint');
    this.rotateSkip.textContent = t('rotateSkip');
    this.btnRetry.textContent = t('retry');
    this.btnHome2 && (this.btnHome2.textContent = t('home'));
    this.btnHome3 && (this.btnHome3.textContent = t('home'));
    this.btnRestart2 && (this.btnRestart2.textContent = t('restart'));
    this.btnHowto2 && (this.btnHowto2.textContent = t('replayGuide'));
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
    this.quizUI.classList.add('hidden');
    this.hud.classList.add('hidden');
    this.applyLang();
  },

  showGame() {
    this.titleScreen.classList.add('hidden');
    this.titleScreen.classList.remove('is-active');
    this.pauseScreen.classList.add('hidden');
    this.resultScreen.classList.add('hidden');
    this.quizUI.classList.remove('hidden');
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
    this.quizUI.classList.add('hidden');
    this.hud.classList.add('hidden');
    this.resultScreen.classList.remove('hidden');
    this.applyLang();
  },

  renderQuestion(run) {
    const q = QUESTIONS[run.state.order[run.state.index]];
    this.questionText.textContent = q.statement[i18n.lang] || q.statement.en;
    const round = run.state.round;
    const totalRounds = 3;
    const rn = ROUND_NAMES[i18n.lang] || ROUND_NAMES.en;
    this.roundBadge.textContent = `${t('round')} ${round}/${totalRounds} · ${rn[round - 1]}`;
    this.setAnswerLocked(false);
  },

  updateHUD(hud) {
    this.hudRound.textContent = `${t('round')} ${hud.round}/3`;
    this.hudQ.textContent = `${t('question')} ${hud.index + 1}/${hud.total}`;
    this.hudTime.textContent = t('timeLeft', { s: Math.ceil(hud.timeLeft) });
    this.hudScore.textContent = `${t('score')} ${hud.score}`;
    this.hudCombo.textContent = hud.combo >= 2 ? t('comboUp', { n: hud.combo }) : `${t('combo')} ×1`;
    this.hudCombo.style.display = hud.combo >= 2 ? '' : 'none';
    // 信号灯颜色随剩余时间
    const sigs = this.hudSignal.querySelectorAll('.sig');
    const state = hud.timeLeft <= 5 ? 'red' : hud.timeLeft <= 15 ? 'amber' : 'green';
    sigs[0].classList.toggle('on', state === 'red');
    sigs[1].classList.toggle('on', state === 'amber');
    sigs[2].classList.toggle('on', state === 'green');
  },

  setAnswerLocked(locked) {
    this.btnSafe.classList.toggle('locked', locked);
    this.btnUnsafe.classList.toggle('locked', locked);
  },

  showFeedback(text, wrong = false) {
    if (this._feedbackTimer) clearTimeout(this._feedbackTimer);
    this.feedback.textContent = text;
    this.feedback.classList.toggle('wrong', wrong);
    this.feedback.classList.remove('hidden');
    this._feedbackTimer = setTimeout(() => {
      this.feedback.classList.add('hidden');
    }, 700);
  },

  renderResult(run) {
    const s = run.state;
    const stars = '★'.repeat(s.stars) + '☆'.repeat(Math.max(0, 3 - s.stars));
    this.resultStars.textContent = stars;
    this.resultTitle.textContent = s.won ? t('winTitle') : t('loseTitle');
    this.resultScore.textContent = `${t('scoreLabel')}: ${s.score}`;
    this.resultMeta.textContent =
      `${t('correctLabel')}: ${s.correct}/${QUESTIONS.length} · ` +
      `${t('maxComboLabel')}: ×${s.maxCombo} · ` +
      `${t('timeLabel')}: ${Math.max(0, Math.round(s.totalTime - s.timeLeft))}s`;
    this.resultReason.textContent = s.won
      ? (s.wrong === 0 ? t('perfect') : s.stars >= 2 ? t('great') : t('keepGoing'))
      : t('reasonTimeout');
  },

  setTutorialContent(stepId) {
    this.tutTitle.textContent = t('tutTitle');
    this.tutText.textContent = t(stepId);
    this.tutSkip.textContent = t('tutSkip');
    this.tutNext.textContent = t('tutNext');
  },
};
