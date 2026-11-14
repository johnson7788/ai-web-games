// UI 模块：标题/暂停/完成 + HUD + 调色板（DOM）+ 多语言。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';
import { PALETTE } from '../../config/game.config.js';

function el(id) { return document.getElementById(id); }

export const ui = {
  titleScreen: el('screen-title'),
  pauseScreen: el('screen-pause'),
  completeScreen: el('screen-complete'),
  hud: el('hud'),
  palette: el('palette'),
  pictureName: el('picture-name'),
  progress: el('progress'),
  titleText: el('title-text'),
  subtitleText: el('subtitle-text'),
  titleBest: el('title-best'),
  howTo: el('how-to'),
  pauseTitle: el('pause-title'),
  completeTitle: el('complete-title'),
  completeName: el('complete-name'),
  btnStart: el('btn-start'),
  btnResume: el('btn-resume'),
  btnRestart: el('btn-restart'),
  btnNext: el('btn-next'),
  btnTitle: el('btn-title'),
  btnHint: el('btn-hint'),
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
    this.completeTitle.textContent = t('complete');
    this.btnStart.textContent = t('start');
    this.btnResume.textContent = t('resume');
    this.btnRestart.textContent = t('restartRun');
    this.btnNext.textContent = t('nextPicture');
    this.btnTitle.textContent = t('backTitle');
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
    this.completeScreen.classList.add('hidden');
    this.hud.classList.add('hidden');
    this.palette.classList.add('hidden');
    this.applyLang();
  },
  showGame() {
    this.titleScreen.classList.add('hidden');
    this.pauseScreen.classList.add('hidden');
    this.completeScreen.classList.add('hidden');
    this.hud.classList.remove('hidden');
    this.palette.classList.remove('hidden');
  },
  showPause() { this.pauseScreen.classList.remove('hidden'); this.applyLang(); },
  hidePause() { this.pauseScreen.classList.add('hidden'); },
  showComplete(name) {
    this.completeScreen.classList.remove('hidden');
    this.completeName.textContent = name;
    this.applyLang();
    this.completeName.textContent = name;
  },
  hideComplete() { this.completeScreen.classList.add('hidden'); },

  renderPalette(run) {
    this.palette.innerHTML = '';
    for (const color of run.colors) {
      const btn = document.createElement('button');
      btn.className = 'swatch' + (color === run.selectedColor ? ' selected' : '');
      btn.dataset.color = String(color);
      btn.style.background = PALETTE[color];
      btn.disabled = run.remaining[color] === 0;
      const num = document.createElement('span');
      num.className = 'swatch-num';
      num.textContent = String(color);
      const count = document.createElement('span');
      count.className = 'swatch-count';
      count.textContent = String(run.remaining[color]);
      btn.append(num, count);
      this.palette.appendChild(btn);
    }
  },

  updateHUD(state, name) {
    this.pictureName.textContent = name;
    const pct = Math.round((state.filledCount / state.totalCells) * 100);
    this.progress.textContent = `${t('progress')}: ${pct}%`;
    this.btnHint.textContent = `${t('hint')} ${state.hintsLeft}`;
    this.btnHint.disabled = state.hintsLeft <= 0;
  },
  updateMute(muted) {
    this._muted = muted;
    this.btnMute.textContent = muted ? '🔇' : '🔊';
    this.btnMute.setAttribute('aria-label', `${t('sound')}: ${muted ? t('off') : t('on')}`);
  },
  updateBest(done) {
    this.titleBest.textContent = done > 0 ? `${t('pictures')}: ${done}` : '';
  },
};