// UI 模块：标题/暂停/过关 + HUD + 多语言下拉（默认英文）。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';

function el(id) { return document.getElementById(id); }

export const ui = {
  titleScreen: el('screen-title'),
  pauseScreen: el('screen-pause'),
  clearScreen: el('screen-clear'),
  hud: el('hud'),
  hudLevel: el('hud-level'),
  hudScore: el('hud-score'),
  hudWords: el('hud-words'),
  titleText: el('title-text'),
  subtitleText: el('subtitle-text'),
  titleBest: el('title-best'),
  howTo: el('how-to'),
  pauseTitle: el('pause-title'),
  clearTitle: el('clear-title'),
  clearStars: el('clear-stars'),
  clearScore: el('clear-score'),
  btnStart: el('btn-start'),
  btnResume: el('btn-resume'),
  btnRestart: el('btn-restart'),
  btnNext: el('btn-next'),
  btnTitle: el('btn-title'),
  btnHint: el('btn-hint'),
  btnShuffle: el('btn-shuffle'),
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
    this.btnResume.textContent = t('resume');
    this.btnRestart.textContent = t('restartRun');
    this.btnNext.textContent = t('nextLevel');
    this.btnTitle.textContent = t('backTitle');
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
    this.applyLang();
  },
  showGame() {
    this.titleScreen.classList.add('hidden');
    this.pauseScreen.classList.add('hidden');
    this.clearScreen.classList.add('hidden');
    this.hud.classList.remove('hidden');
  },
  showPause() { this.pauseScreen.classList.remove('hidden'); this.applyLang(); },
  hidePause() { this.pauseScreen.classList.add('hidden'); },
  showClear(stars, score, isLast) {
    this.clearScreen.classList.remove('hidden');
    this.hud.classList.add('hidden');
    this.clearTitle.textContent = isLast ? t('allClear') : t('levelClear');
    let s = '';
    for (let i = 0; i < 3; i += 1) s += i < stars ? '★' : '☆';
    this.clearStars.textContent = s;
    this.clearScore.textContent = `${t('score')}: ${score}`;
    this.btnNext.textContent = isLast ? t('playAgain') : t('nextLevel');
    this.applyLang();
    this.clearScore.textContent = `${t('score')}: ${score}`;
  },
  hideClear() { this.clearScreen.classList.add('hidden'); },

  updateHUD(state) {
    this.hudLevel.textContent = `${t('level')} ${state.levelIndex + 1}`;
    this.hudScore.textContent = `${t('score')} ${state.score}`;
    this.hudWords.textContent = `${t('words')} ${state.found}/${state.total}`;
  },
  updateHint(left) {
    this._hintsLeft = left;
    this.btnHint.textContent = `${t('hint')} ${left}`;
    this.btnHint.disabled = left <= 0;
    this.btnShuffle.textContent = t('shuffle');
  },
  updateMute(muted) {
    this._muted = muted;
    this.btnMute.textContent = muted ? '🔇' : '🔊';
    this.btnMute.setAttribute('aria-label', `${t('sound')}: ${muted ? t('off') : t('on')}`);
  },
  updateBest(best, level) {
    this.titleBest.textContent = best > 0 ? `${t('best')}: ${best} · ${t('level')} ${level}` : '';
    this.btnStart.textContent = level > 1 ? t('continue') : t('start');
  },
};