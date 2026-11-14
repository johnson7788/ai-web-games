// UI 模块：标题/暂停/结束/过关 + HUD + 放行/拒绝按钮 + 多语言。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';

function el(id) { return document.getElementById(id); }

export const ui = {
  titleScreen: el('screen-title'),
  pauseScreen: el('screen-pause'),
  overScreen: el('screen-over'),
  clearScreen: el('screen-clear'),
  hud: el('hud'),
  actions: el('actions'),
  hudShift: el('hud-shift'),
  hudScore: el('hud-score'),
  hudStrikes: el('hud-strikes'),
  feedback: el('feedback'),
  titleText: el('title-text'),
  subtitleText: el('subtitle-text'),
  titleBest: el('title-best'),
  howTo: el('how-to'),
  pauseTitle: el('pause-title'),
  overTitle: el('over-title'),
  overScore: el('over-score'),
  clearTitle: el('clear-title'),
  clearScore: el('clear-score'),
  btnStart: el('btn-start'),
  btnResume: el('btn-resume'),
  btnRestart: el('btn-restart'),
  btnAgain: el('btn-again'),
  btnTitle: el('btn-title'),
  btnNext: el('btn-next'),
  btnTitle2: el('btn-title2'),
  btnApprove: el('btn-approve'),
  btnDeny: el('btn-deny'),
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
    this.clearTitle.textContent = t('cleared');
    this.btnStart.textContent = t('start');
    this.btnResume.textContent = t('resume');
    this.btnRestart.textContent = t('restartRun');
    this.btnAgain.textContent = t('playAgain');
    this.btnTitle.textContent = t('backTitle');
    this.btnNext.textContent = t('nextShift');
    this.btnTitle2.textContent = t('backTitle');
    this.btnApprove.textContent = `✓ ${t('approve')}`;
    this.btnDeny.textContent = `✗ ${t('deny')}`;
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
    this.overScreen.classList.add('hidden');
    this.clearScreen.classList.add('hidden');
    this.hud.classList.add('hidden');
    this.actions.classList.add('hidden');
    this.applyLang();
  },
  showGame() {
    this.titleScreen.classList.add('hidden');
    this.pauseScreen.classList.add('hidden');
    this.overScreen.classList.add('hidden');
    this.clearScreen.classList.add('hidden');
    this.hud.classList.remove('hidden');
    this.actions.classList.remove('hidden');
    this.setFeedback('', '');
  },
  showPause() { this.pauseScreen.classList.remove('hidden'); this.applyLang(); },
  hidePause() { this.pauseScreen.classList.add('hidden'); },
  showOver(score) {
    this.overScreen.classList.remove('hidden');
    this.actions.classList.add('hidden');
    this.overScore.textContent = `${t('finalScore')}: ${score}`;
    this.applyLang();
    this.overScore.textContent = `${t('finalScore')}: ${score}`;
  },
  showClear(score) {
    this.clearScreen.classList.remove('hidden');
    this.actions.classList.add('hidden');
    this.clearScore.textContent = `${t('score')}: ${score}`;
    this.applyLang();
    this.clearScore.textContent = `${t('score')}: ${score}`;
  },

  setFeedback(text, kind) {
    this.feedback.textContent = text;
    this.feedback.className = `feedback ${kind || ''}`;
  },
  setButtonsEnabled(on) {
    this.btnApprove.disabled = !on;
    this.btnDeny.disabled = !on;
  },
  updateHUD(state) {
    this.hudShift.textContent = `${t('shift')} ${state.shift}`;
    this.hudScore.textContent = `${t('score')} ${state.score}`;
    let hearts = '';
    for (let i = 0; i < 3; i += 1) hearts += i < (3 - state.strikes) ? '❤' : '🖤';
    this.hudStrikes.textContent = hearts;
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