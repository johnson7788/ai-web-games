// BEAR DASH RUN · UI（DOM + CSS）：标题/暂停/结算/HUD/触控/教程/竖屏提示 + 多语言
import { i18n, t, syncDocumentLang } from '../core/i18n.js';

const $ = (id) => document.getElementById(id);

export const ui = {
  canvas: $('canvas'),
  hud: $('hud'),
  hudLevel: $('hud-level'),
  hudScore: $('hud-score'),
  hudStars: $('hud-stars'),
  titleScreen: $('screen-title'),
  pauseScreen: $('screen-pause'),
  resultScreen: $('screen-result'),
  touchControls: $('touch-controls'),
  titleText: $('title-text'),
  subtitleText: $('subtitle-text'),
  btnStart: $('btn-start'),
  btnResume: $('btn-resume'),
  btnRestart: $('btn-restart'),
  btnHome: $('btn-home'),
  btnHome2: $('btn-home2'),
  btnRetry: $('btn-retry'),
  btnNext: $('btn-next'),
  btnMute: $('btn-mute'),
  pauseTitle: $('pause-title'),
  resultTitle: $('result-title'),
  resultStars: $('result-stars'),
  resultScore: $('result-score'),
  resultBest: $('result-best'),
  hintRun: $('hint-run'),
  hintJump: $('hint-jump'),
  hintStomp: $('hint-stomp'),
  langSelects: [$('lang-select'), $('lang-select-pause')],
  lastScore: 0,
  lastStars: 0,

  get lang() { return i18n.lang; },
  get dir() { return i18n.dir; },

  applyLang() {
    syncDocumentLang();
    this.titleText.textContent = t('title');
    this.subtitleText.textContent = t('subtitle');
    this.btnStart.textContent = t('start');
    this.btnResume.textContent = t('resume');
    this.btnRestart.textContent = t('restart');
    this.btnHome.textContent = t('menu');
    this.btnHome2.textContent = t('menu');
    this.btnRetry.textContent = t('retry');
    this.btnNext.textContent = t('next');
    this.btnMute.setAttribute('aria-label', t('sound'));
    this.pauseTitle.textContent = t('paused');
    this.hintRun.textContent = t('hintRun');
    this.hintJump.textContent = t('hintJump');
    this.hintStomp.textContent = t('hintStomp');
    for (const sel of this.langSelects) if (sel) sel.setAttribute('aria-label', t('language'));
    this.fillLangOptions();
    this.updateResultStars(this.lastStars);
    this.updateResultTexts();
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
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const touch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    if (coarse || touch) {
      this.touchControls.classList.remove('hidden');
    }
  },

  showPause() {
    this.pauseScreen.classList.remove('hidden');
    this.applyLang();
  },

  hidePause() {
    this.pauseScreen.classList.add('hidden');
  },

  showResult(win, stars, score) {
    this.lastStars = stars;
    this.lastScore = score;
    this.resultTitle.textContent = win ? t('resultWin') : t('resultLose');
    this.updateResultStars(stars);
    this.updateResultTexts();
    this.btnNext.classList.toggle('hidden', !win);
    this.pauseScreen.classList.add('hidden');
    this.resultScreen.classList.remove('hidden');
    this.hud.classList.add('hidden');
    this.touchControls.classList.add('hidden');
  },

  updateResultStars(stars) {
    const n = Math.max(0, Math.min(3, stars || 0));
    let html = '<span class="stars">';
    for (let i = 0; i < 3; i += 1) html += i < n ? '★' : '☆';
    html += '</span>';
    if (this.resultStars) this.resultStars.innerHTML = html;
  },

  updateResultTexts() {
    if (!this.resultScore) return;
    this.resultScore.textContent = `${t('resultScore')}: ${this.lastScore}`;
  },

  updateBest(best) {
    const el = this.resultBest;
    if (el) el.textContent = `${t('resultBest')}: ${best}`;
  },

  updateHUD(level, score, stars, combo) {
    this.hudLevel.textContent = `${t('level')} ${level}`;
    this.hudScore.textContent = `${t('score')} ${score}`;
    this.hudStars.textContent = `★ ${stars}`;
    const comboEl = $('hud-combo');
    if (comboEl) {
      comboEl.textContent = combo >= 2 ? `${t('combo')} ×${combo}` : '';
      comboEl.style.display = combo >= 2 ? '' : 'none';
    }
  },
};

// 竖屏提示的跳过按钮内联 onclick 已在 index.html 上，这里仅补 i18n 文案刷新。
export function applyRotateText() {
  const rt = $('rotate-text');
  const rb = $('btn-rotate-skip');
  if (rt) rt.textContent = t('rotateHint');
  if (rb) rb.textContent = t('rotateSkip');
}

export const TUT_STEPS = () => [
  { text: t('tutStep1'), spot: 'run' },
  { text: t('tutStep2'), spot: 'jump' },
  { text: t('tutStep3'), spot: 'stomp' },
];

export { t, i18n, $ };
