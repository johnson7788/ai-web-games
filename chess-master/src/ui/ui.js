// UI 模块：标题/暂停/结算 + 侧栏（状态/吃子/按钮）+ 升变选择 + 多语言。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';

function el(id) { return document.getElementById(id); }
const GLYPH = { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' };

export const ui = {
  titleScreen: el('screen-title'),
  pauseScreen: el('screen-pause'),
  endScreen: el('screen-end'),
  panel: el('panel'),
  promotion: el('promotion'),
  statusText: el('status-text'),
  capturedWhite: el('captured-white'),
  capturedBlack: el('captured-black'),
  moveCount: el('move-count'),
  titleText: el('title-text'),
  subtitleText: el('subtitle-text'),
  howTo: el('how-to'),
  pauseTitle: el('pause-title'),
  endTitle: el('end-title'),
  endSub: el('end-sub'),
  btnStart: el('btn-start'),
  btnResume: el('btn-resume'),
  btnRestart: el('btn-restart'),
  btnAgain: el('btn-again'),
  btnTitle: el('btn-title'),
  btnNew: el('btn-new'),
  btnUndo: el('btn-undo'),
  btnMute: el('btn-mute'),
  btnPause: el('btn-pause'),
  promoBtns: { q: el('promo-q'), r: el('promo-r'), b: el('promo-b'), n: el('promo-n') },
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
    this.btnNew.textContent = t('newGame');
    this.btnUndo.textContent = t('undo');
    document.querySelectorAll('[data-i18n]').forEach((e) => { e.textContent = t(e.dataset.i18n); });
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
    this.panel.classList.add('hidden');
    this.promotion.classList.add('hidden');
    this.applyLang();
  },
  showGame() {
    this.titleScreen.classList.add('hidden');
    this.pauseScreen.classList.add('hidden');
    this.endScreen.classList.add('hidden');
    this.panel.classList.remove('hidden');
  },
  showPause() { this.pauseScreen.classList.remove('hidden'); this.applyLang(); },
  hidePause() { this.pauseScreen.classList.add('hidden'); },
  showEnd(title, sub, win) {
    this.endScreen.classList.remove('hidden');
    this.promotion.classList.add('hidden');
    this.endTitle.textContent = title;
    this.endTitle.className = win ? 'win' : (win === false ? 'lose' : '');
    this.endSub.textContent = sub;
    this.applyLang();
    this.endSub.textContent = sub;
  },
  hideEnd() { this.endScreen.classList.add('hidden'); },

  setStatus(text) { this.statusText.textContent = text; },
  setCaptured(captured) {
    this.capturedWhite.textContent = captured.w.map((x) => GLYPH[x]).join(' ');
    this.capturedBlack.textContent = captured.b.map((x) => GLYPH[x]).join(' ');
  },
  setMoveCount(n) { this.moveCount.textContent = `${t('moves')}: ${n}`; },
  setUndoEnabled(on) { this.btnUndo.disabled = !on; },
  showPromotion() { this.promotion.classList.remove('hidden'); },
  hidePromotion() { this.promotion.classList.add('hidden'); },

  updateMute(muted) {
    this._muted = muted;
    this.btnMute.textContent = muted ? '🔇' : '🔊';
    this.btnMute.setAttribute('aria-label', `${t('sound')}: ${muted ? t('off') : t('on')}`);
  },
};