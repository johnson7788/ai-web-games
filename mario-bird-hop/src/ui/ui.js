// UI 模块：语言切换 + 屏幕显隐 + HUD DOM 直写。结算/教程 DOM 由 main.js 组装。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';
import { CONFIG } from '../../config/game.config.js';

const $ = (id) => document.getElementById(id);

export const ui = {
  titleScreen: $('screen-title'),
  pauseScreen: $('screen-pause'),
  resultScreen: $('screen-result'),
  hud: $('hud'),
  touchControls: $('touch-controls'),
  titleText: $('title-text'),
  subtitleText: $('subtitle-text'),
  pauseTitle: $('pause-title'),
  btnStart: $('btn-start'),
  btnResume: $('btn-resume'),
  langSelects: [$('lang-select'), $('lang-select-pause')].filter(Boolean),
  lastHud: null,

  get lang() { return i18n.lang; },
  get dir() { return i18n.dir; },

  applyLang() {
    syncDocumentLang();
    this.titleText.textContent = t('title');
    this.subtitleText.textContent = t('subtitle');
    this.btnStart.textContent = t('start');
    this.btnResume.textContent = t('resume');
    this.pauseTitle.textContent = t('paused');
    for (const sel of this.langSelects) sel.setAttribute('aria-label', t('language'));
    for (const el of document.querySelectorAll('[data-i18n]')) {
      el.textContent = t(el.dataset.i18n);
    }
    this.fillLangOptions();
    if (this.lastHud) this.updateHUD(this.lastHud);
  },

  fillLangOptions() {
    for (const sel of this.langSelects) {
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
    this.hud.classList.add('hidden');
    this.touchControls.classList.add('hidden');
    this.applyLang();
  },

  showGame() {
    this.titleScreen.classList.add('hidden');
    this.titleScreen.classList.remove('is-active');
    this.pauseScreen.classList.add('hidden');
    this.resultScreen.classList.add('hidden');
    this.hud.classList.remove('hidden');
    this.touchControls.classList.remove('hidden');
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
    this.applyLang();
  },

  hideResult() {
    this.resultScreen.classList.add('hidden');
  },

  setMuted(muted) {
    const b = $('btn-mute');
    if (b) b.textContent = muted ? '×' : '♪';
  },

  // hud: { level, score, coins, combo, starsCollected, starsTotal, levelName }
  updateHUD(hud) {
    this.lastHud = hud;
    const lvl = $('hud-level');
    const score = $('hud-score');
    const coins = $('hud-coins');
    const combo = $('hud-combo');
    const stars = $('hud-stars');
    const best = $('hud-best');
    if (lvl) lvl.textContent = `${t('level')} ${hud.level} · ${hud.levelName}`;
    if (score) score.textContent = `${t('score')} ${hud.score}`;
    if (coins) coins.textContent = `◉ ${hud.coins}`;
    if (combo) {
      combo.style.display = hud.combo >= 2 ? '' : 'none';
      combo.textContent = `×${hud.combo}`;
    }
    if (stars) stars.textContent = `${'★'.repeat(hud.starsCollected)}${'☆'.repeat(hud.starsTotal - hud.starsCollected)}`;
    if (best) best.textContent = `${t('best')} ${hud.best}`;
  },

  updateGoal(progress) {
    const bar = $('goal-fill');
    if (bar) bar.style.width = `${Math.max(0, Math.min(100, progress))}%`;
  },
};
