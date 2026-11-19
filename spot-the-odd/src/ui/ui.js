// UI 模块：标题/暂停/结算/HUD + 多语言下拉（默认英文，?lang= 可覆盖）
// 只做 DOM 显隐与文案刷新；游戏状态由 main.js 直写。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';
import { CONFIG } from '../../config/game.config.js';

export const ui = {
  canvas: document.getElementById('canvas'),
  hud: document.getElementById('hud'),
  hudRound: document.getElementById('hud-round'),
  hudTime: document.getElementById('hud-time'),
  hudTask: document.getElementById('hud-task'),
  hudScore: document.getElementById('hud-score'),
  hudCombo: document.getElementById('hud-combo'),
  hudPlayerProgress: document.getElementById('hud-player-progress'),
  hudAiProgress: document.getElementById('hud-ai-progress'),
  hudVs: document.getElementById('hud-vs'),
  raceYou: document.getElementById('race-you'),
  raceBot: document.getElementById('race-bot'),
  btnHint: document.getElementById('btn-hint'),
  btnMute: document.getElementById('btn-mute'),

  titleScreen: document.getElementById('screen-title'),
  pauseScreen: document.getElementById('screen-pause'),
  resultScreen: document.getElementById('screen-result'),
  titleText: document.getElementById('title-text'),
  subtitleText: document.getElementById('subtitle-text'),
  bestEl: document.getElementById('best'),
  pauseTitle: document.getElementById('pause-title'),
  resultTitle: document.getElementById('result-title'),
  resultStars: document.getElementById('result-stars'),
  resultMeta: document.getElementById('result-meta'),
  btnStart: document.getElementById('btn-start'),
  btnResume: document.getElementById('btn-resume'),
  btnRetry: document.getElementById('btn-retry'),
  toast: document.getElementById('toast'),
  rotateScreen: document.getElementById('rotate-screen'),
  rotateText: document.getElementById('rotate-text'),

  langSelects: [
    document.getElementById('lang-select'),
    document.getElementById('lang-select-pause'),
  ],

  get lang() {
    return i18n.lang;
  },
  get dir() {
    return i18n.dir;
  },

  applyLang() {
    syncDocumentLang();
    this.titleText.textContent = t('title');
    this.subtitleText.textContent = t('subtitle');
    this.btnStart.textContent = t('start');
    this.btnResume.textContent = t('resume');
    this.btnRetry.textContent = t('retry');
    this.pauseTitle.textContent = t('paused');
    document.getElementById('btn-restart2').textContent = t('retry');
    document.getElementById('btn-home3').textContent = t('menu');
    document.getElementById('btn-home2').textContent = t('menu');
    document.getElementById('btn-howto').textContent = t('howto');
    document.getElementById('btn-howto-pause').textContent = t('howto');
    this.btnHint.textContent = t('hint');
    this.hudVs.textContent = t('vs');
    this.raceYou.textContent = t('find');
    this.rotateText.textContent = t('rotateText');
    document.getElementById('btn-rotate-skip').textContent = t('rotateSkip');
    this.btnMute.textContent = this._muted ? t('unmute') : t('mute');
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

  _muted: false,
  setMuted(m) {
    this._muted = !!m;
    this.btnMute.textContent = m ? t('unmute') : t('mute');
  },

  showTitle() {
    this.titleScreen.classList.remove('hidden');
    this.titleScreen.classList.add('is-active');
    this.pauseScreen.classList.add('hidden');
    this.resultScreen.classList.add('hidden');
    this.hud.classList.add('hidden');
    this.applyLang();
  },

  showGame() {
    this.titleScreen.classList.add('hidden');
    this.titleScreen.classList.remove('is-active');
    this.pauseScreen.classList.add('hidden');
    this.resultScreen.classList.add('hidden');
    this.hud.classList.remove('hidden');
    this.toast.classList.add('hidden');
  },

  showPause() {
    this.pauseScreen.classList.remove('hidden');
    this.applyLang();
  },

  hidePause() {
    this.pauseScreen.classList.add('hidden');
  },

  showResult() {
    this.resultScreen.classList.remove('hidden');
    this.hud.classList.add('hidden');
    this.applyLang();
  },

  hideResult() {
    this.resultScreen.classList.add('hidden');
  },

  updateBest(n) {
    if (n == null) this.bestEl.textContent = '';
    else this.bestEl.textContent = `${t('best')}: ${n}`;
  },

  updateHud(run) {
    if (!run) return;
    this.hudRound.textContent = `${t('round')} ${run.round}/${run.totalRounds}`;
    const sec = Math.max(0, Math.ceil(run.timeLeft));
    this.hudTime.textContent = `${t('time')} ${sec}`;
    const catName = t(`cat_${run.task.cat}`);
    const remain = Math.max(0, run.task.need - run.task.found);
    this.hudTask.textContent = `${t('find')} ${catName} ×${remain}`;
    this.hudScore.textContent = `${t('score')} ${run.score}`;
    this.hudCombo.textContent = `${t('combo')} ×${run.combo}`;
    this.hudCombo.classList.toggle('off', run.combo <= 1);
    const pp = run.task.need > 0 ? Math.round((run.task.found / run.task.need) * 100) : 100;
    this.hudPlayerProgress.style.width = `${pp}%`;
    this.hudAiProgress.style.width = `${Math.round(run.aiProgress * 100)}%`;
    this.btnHint.textContent = `${t('hint')} ${run.hintLeft}`;
  },

  updateResult(run) {
    this.resultTitle.textContent = run.won ? t('winTitle') : (run.roundsWon === run.roundsLost ? t('drawTitle') : t('loseTitle'));
    let stars = '';
    for (let i = 0; i < 3; i += 1) {
      stars += `<span class="${i < run.stars ? '' : 'off'}">★</span>`;
    }
    this.resultStars.innerHTML = stars;
    this.resultMeta.innerHTML =
      `${t('resultRounds', { won: run.roundsWon, lost: run.roundsLost })}<br>` +
      `${t('resultScore', { score: run.score })}<br>` +
      `${t('resultOdd', { n: run.oddFoundTotal })} · ${t('resultCombo', { n: run.comboPeak })}<br>` +
      `${t('resultHint')}`;
  },

  showToast(text) {
    this.toast.textContent = text;
    this.toast.classList.remove('hidden');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => this.toast.classList.add('hidden'), 1200);
  },
};

// 预填语言下拉（首帧即有 en/zh）
ui.applyLang();
