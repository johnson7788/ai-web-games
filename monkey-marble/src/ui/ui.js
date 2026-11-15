// src/ui/ui.js — 屏幕/HUD/语言下拉 + 首次交互引导（data-tutorial 真实动作推进）。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';
import { save } from '../core/save.js';

const $ = (id) => document.getElementById(id);

export const ui = {
  titleScreen: $('screen-title'),
  pauseScreen: $('screen-pause'),
  levelClearScreen: $('screen-levelclear'),
  resultsScreen: $('screen-results'),
  hud: $('hud'),
  hudTime: $('hud-time'),
  hudLevel: $('hud-level'),
  hudBananas: $('hud-bananas'),
  hudBest: $('hud-best'),
  titleText: $('title-text'),
  subtitleText: $('subtitle-text'),
  titleBest: $('title-best'),
  pauseTitle: $('pause-title'),
  btnStart: $('btn-start'),
  btnHowto: $('btn-howto'),
  btnResume: $('btn-resume'),
  btnRestartPause: $('btn-restart-pause'),
  btnMenuPause: $('btn-menu-pause'),
  btnNext: $('btn-next'),
  btnRestart: $('btn-restart'),
  btnMenu: $('btn-menu'),
  btnShare: $('btn-share'),
  btnMute: $('btn-mute'),
  langSelects: [$('lang-select'), $('lang-select-pause')],
  lcRating: $('lc-rating'),
  lcStats: $('lc-stats'),
  resRating: $('res-rating'),
  resRecord: $('res-record'),
  resStats: $('res-stats'),
  touch: $('touch'),
  joy: $('joy'),
  joyKnob: $('joy-knob'),
  btnJump: $('btn-jump'),
  btnBrake: $('btn-brake'),
  lastTime: 0,

  get lang() { return i18n.lang; },
  get dir() { return i18n.dir; },

  applyLang() {
    syncDocumentLang();
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    this.titleText.textContent = t('title');
    this.subtitleText.textContent = t('subtitle');
    this.btnStart.textContent = t('start');
    this.btnHowto.textContent = t('howto');
    this.btnResume.textContent = t('resume');
    this.btnRestartPause.textContent = t('restart');
    this.btnMenuPause.textContent = t('menu');
    this.btnNext.textContent = t('next');
    this.btnRestart.textContent = t('restart');
    this.btnMenu.textContent = t('menu');
    this.btnShare.textContent = t('share');
    this.btnMute.textContent = t('mute');
    this.btnJump.textContent = t('jumpBtn');
    this.btnBrake.textContent = t('brakeBtn');
    for (const sel of this.langSelects) if (sel) sel.setAttribute('aria-label', t('language'));
    this.fillLangOptions();
    this.updateHUD(this.lastTime);
    this.tutorial.apply();
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

  toggleLang() {
    i18n.setLang(i18n.next());
    this.applyLang();
    return i18n.lang;
  },

  showTitle() {
    this._show('title');
    this.titleBest.textContent = fmtTime(save.get('best', 0));
  },

  showGame() {
    this._show('game');
    this.tutorial.hideOverlay();
  },

  showPause() {
    this.pauseScreen.classList.remove('hidden');
    this.applyLang();
  },

  hidePause() {
    this.pauseScreen.classList.add('hidden');
  },

  showLevelClear(info) {
    this._show('levelclear');
    this.lcRating.textContent = info.rating;
    this.lcRating.className = 'rating rating-' + (info.rating || 'C');
    this.lcStats.innerHTML =
      `${t('time')}: ${fmtTime(info.time)} · ${t('bananas')}: ${info.bananas}`;
    this.applyLang();
  },

  showResults(info) {
    this._show('results');
    this.resRating.textContent = info.rating;
    this.resRating.className = 'rating rating-' + (info.rating || 'C');
    this.resRecord.classList.toggle('hidden', !info.isRecord);
    this.resRecord.textContent = t('newRecord');
    this.resStats.innerHTML =
      `${t('totalTime')}: ${fmtTime(info.time)} · ${t('totalBananas')}: ${info.bananas} · ${t('deaths')}: ${info.deaths}`;
    this.applyLang();
  },

  _show(which) {
    const screens = [this.titleScreen, this.pauseScreen, this.levelClearScreen, this.resultsScreen];
    screens.forEach((s) => s.classList.add('hidden'));
    this.hud.classList.add('hidden');
    if (which === 'title') { this.titleScreen.classList.remove('hidden'); }
    else if (which === 'pause') { this.pauseScreen.classList.remove('hidden'); }
    else if (which === 'levelclear') { this.levelClearScreen.classList.remove('hidden'); }
    else if (which === 'results') { this.resultsScreen.classList.remove('hidden'); }
    else if (which === 'game') { this.hud.classList.remove('hidden'); }
  },

  updateHUD(time) {
    this.lastTime = time;
    this.hudTime.textContent = fmtTime(time);
    this.hudBest.textContent = fmtTime(save.get('best', 0));
  },

  updateHudLive(hud) {
    this.hudTime.textContent = fmtTime(hud.time);
    this.hudLevel.textContent = String(hud.level);
    this.hudBananas.textContent = String(hud.bananas);
  },

  updateBest(time) {
    this.titleBest.textContent = fmtTime(time);
  },

  // ---------------------------------------------------------------- 引导
  tutorial: {
    active: false,
    step: 0,
    steps: ['tutStep1', 'tutStep2', 'tutStep3', 'tutStep4'],
    overlay: $('tutorial'),
    text: $('tut-text'),
    dots: $('tut-dots'),
    nextBtn: $('tut-next'),
    skipBtn: $('tut-skip'),

    get current() {
      return t(this.steps[this.step] || '');
    },

    start(mode) {
      this.active = true;
      this.step = 0;
      this.mode = mode || 'game';
      this.overlay.classList.toggle('modal', this.mode === 'title');
      this.overlay.classList.remove('hidden');
      this.apply();
    },

    apply() {
      if (!this.active) return;
      this.text.textContent = t(this.steps[this.step] || '');
      this.nextBtn.textContent = this.step >= this.steps.length - 1 ? t('start') : t('next');
      this.dots.innerHTML = this.steps.map((_, i) => `<span class="dot${i === this.step ? ' on' : ''}"></span>`).join('');
    },

    next() {
      if (this.step >= this.steps.length - 1) { this.finish(); return; }
      this.step++;
      this.apply();
    },

    // 真实动作推进
    onEvent(type) {
      if (!this.active) return;
      const want = [['roll'], ['jump'], ['pickup'], ['brake']][this.step];
      if (want && want.includes(type)) this.next();
    },

    finish() {
      this.active = false;
      this.overlay.classList.add('hidden');
      this.overlay.classList.remove('modal');
      save.set('tutDone', true);
    },

    skip() {
      this.finish();
    },

    hideOverlay() {
      this.overlay.classList.add('hidden');
    },
  },
};

export function fmtTime(s) {
  const sec = Math.max(0, Math.floor(s || 0));
  const m = Math.floor(sec / 60);
  return `${m}:${String(sec % 60).padStart(2, '0')}`;
}

export default ui;
