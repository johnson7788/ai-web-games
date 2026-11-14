// UI 模块：标题/暂停/完成 + HUD + 国家名 + 调色板 + 检查/清空/下一面 + 多语言。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';
import { PALETTE, COLOR_KEYS } from '../../config/game.config.js';

function el(id) { return document.getElementById(id); }

export const ui = {
  titleScreen: el('screen-title'),
  pauseScreen: el('screen-pause'),
  doneScreen: el('screen-done'),
  hud: el('hud'),
  playArea: el('play-area'),
  hudScore: el('hud-score'),
  hudFlags: el('hud-flags'),
  countryName: el('country-name'),
  palette: el('palette'),
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
  btnCheck: el('btn-check'),
  btnClear: el('btn-clear'),
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
    this.doneTitle.textContent = t('allDone');
    this.btnStart.textContent = t('start');
    this.btnResume.textContent = t('resume');
    this.btnRestart.textContent = t('restartRun');
    this.btnAgain.textContent = t('playAgain');
    this.btnTitle.textContent = t('backTitle');
    this.btnCheck.textContent = t('check');
    this.btnClear.textContent = t('clear');
    this.btnNext.textContent = t('nextFlag');
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
    this.playArea.classList.add('hidden');
    this.applyLang();
  },
  showGame() {
    this.titleScreen.classList.add('hidden');
    this.pauseScreen.classList.add('hidden');
    this.doneScreen.classList.add('hidden');
    this.hud.classList.remove('hidden');
    this.playArea.classList.remove('hidden');
  },
  showPause() { this.pauseScreen.classList.remove('hidden'); this.applyLang(); },
  hidePause() { this.pauseScreen.classList.add('hidden'); },
  showDone(score) {
    this.doneScreen.classList.remove('hidden');
    this.doneScore.textContent = `${t('score')}: ${score}`;
    this.applyLang();
    this.doneScore.textContent = `${t('score')}: ${score}`;
  },
  hideDone() { this.doneScreen.classList.add('hidden'); },

  setCountry(label, name) {
    this.countryName.textContent = `${label}: ${name}`;
  },
  renderPalette(selectedColor) {
    this.palette.innerHTML = '';
    for (const color of COLOR_KEYS) {
      const btn = document.createElement('button');
      btn.className = 'swatch' + (color === selectedColor ? ' selected' : '');
      btn.dataset.color = color;
      btn.style.background = PALETTE[color];
      btn.setAttribute('aria-label', color);
      this.palette.appendChild(btn);
    }
  },
  setFeedback(text, kind) {
    this.feedback.textContent = text;
    this.feedback.className = `feedback ${kind || ''}`;
  },
  setControls(phase) {
    const playing = phase === 'playing';
    this.btnCheck.classList.toggle('hidden', !playing);
    this.btnClear.classList.toggle('hidden', !playing);
    this.btnNext.classList.toggle('hidden', phase !== 'correct');
  },
  updateHUD(state) {
    this.hudScore.textContent = `${t('score')}: ${state.score}`;
    this.hudFlags.textContent = `${t('flags')}: ${state.solved}/${state.total}`;
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