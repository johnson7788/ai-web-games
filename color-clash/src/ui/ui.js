// UI 模块：标题/暂停/结算 + HUD + 选色器 + 过牌按钮 + 多语言。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';

function el(id) { return document.getElementById(id); }

export const ui = {
  titleScreen: el('screen-title'),
  pauseScreen: el('screen-pause'),
  endScreen: el('screen-end'),
  hud: el('hud'),
  colorpicker: el('colorpicker'),
  cpTitle: el('cp-title'),
  hudWins: el('hud-wins'),
  hudLosses: el('hud-losses'),
  titleText: el('title-text'),
  subtitleText: el('subtitle-text'),
  titleBest: el('title-best'),
  howTo: el('how-to'),
  pauseTitle: el('pause-title'),
  endTitle: el('end-title'),
  endSub: el('end-sub'),
  btnStart: el('btn-start'),
  btnResume: el('btn-resume'),
  btnRestart: el('btn-restart'),
  btnAgain: el('btn-again'),
  btnTitle: el('btn-title'),
  btnPass: el('btn-pass'),
  btnMute: el('btn-mute'),
  btnPause: el('btn-pause'),
  cpBtns: { red: el('cp-red'), yellow: el('cp-yellow'), green: el('cp-green'), blue: el('cp-blue') },
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
    this.btnPass.textContent = t('draw') + ' ✓';
    this.cpTitle.textContent = t('pickColor');
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
    this.endScreen.classList.add('hidden');
    this.hud.classList.add('hidden');
    this.colorpicker.classList.add('hidden');
    this.btnPass.classList.add('hidden');
    this.applyLang();
  },
  showGame() {
    this.titleScreen.classList.add('hidden');
    this.pauseScreen.classList.add('hidden');
    this.endScreen.classList.add('hidden');
    this.hud.classList.remove('hidden');
  },
  showPause() { this.pauseScreen.classList.remove('hidden'); this.applyLang(); },
  hidePause() { this.pauseScreen.classList.add('hidden'); },
  showEnd(win, winnerLabel) {
    this.endScreen.classList.remove('hidden');
    this.colorpicker.classList.add('hidden');
    this.btnPass.classList.add('hidden');
    this.endTitle.textContent = win ? t('youWin') : t('youLose');
    this.endTitle.className = win ? 'win' : 'lose';
    this.endSub.textContent = `${t('winner')}: ${winnerLabel}`;
    this.applyLang();
    this.endSub.textContent = `${t('winner')}: ${winnerLabel}`;
  },
  hideEnd() { this.endScreen.classList.add('hidden'); },

  showColorPicker() { this.colorpicker.classList.remove('hidden'); },
  hideColorPicker() { this.colorpicker.classList.add('hidden'); },
  showPass() { this.btnPass.classList.remove('hidden'); },
  hidePass() { this.btnPass.classList.add('hidden'); },

  updateHUD(state) {
    this.hudWins.textContent = `${t('wins')}: ${state.wins}`;
    this.hudLosses.textContent = `${t('losses')}: ${state.losses}`;
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