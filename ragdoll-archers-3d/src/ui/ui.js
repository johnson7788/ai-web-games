// src/ui/ui.js — 屏幕/HUD/升级/首次引导（纯 DOM；状态与存档由 main 与 save 驱动）。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';
import { save } from '../core/save.js';

const $ = (id) => document.getElementById(id);

export const ui = {
  lang: i18n.lang,
  dir: i18n.dir,

  // 屏幕元素
  screens: { title: $('screen-title'), pause: $('screen-pause'), results: $('screen-results'), upgrade: $('screen-upgrade') },
  hud: $('hud'),
  hudLevel: $('hud-level'), hudWind: $('hud-wind'), hudHearts: $('hud-hearts'),
  hudQuiver: $('hud-quiver'), hudHeadshots: $('hud-headshots'),
  btnStart: $('btn-start'), btnResume: $('btn-resume'), btnHowto: $('btn-howto'),
  btnMute: $('btn-mute'),
  resultsTitle: $('results-title'), resultsStars: $('results-stars'), resultsLine: $('results-line'), resultsStats: $('results-stats'),
  btnRetry: $('btn-retry'), btnShare: $('btn-share'),
  upgradeTitle: $('upgrade-title'), upgradeHint: $('upgrade-hint'), upgradeChoices: $('upgrade-choices'),
  toastEl: $('toast'),
  langSelects: [$('lang-select'), $('lang-select-pause')],
  tutorialEl: $('tutorial'), tutorialSpot: document.querySelector('.tutorial-spot'), tutorialCard: document.querySelector('.tutorial-card'),

  // 引导状态
  tutorial: {
    active: false, step: 0,
    steps: ['tut1', 'tut2', 'tut3', 'tut4'],
    doneEvents: ['draw', 'shot', 'hit', 'kill'],
    current: 'tut1',
    start() { this.active = true; this.step = 0; this.current = this.steps[0]; ui._renderTutorial(); ui.tutorialEl.classList.remove('hidden'); },
    skip() { this.active = false; ui.tutorialEl.classList.add('hidden'); save.set('tutDone', true); },
    _complete() { this.active = false; ui.tutorialEl.classList.add('hidden'); save.set('tutDone', true); },
    advance(type) {
      if (!this.active) return;
      if (type === this.doneEvents[this.step]) {
        this.step++;
        if (this.step >= this.steps.length) { this._complete(); return; }
        this.current = this.steps[this.step];
        ui._renderTutorial();
      }
    },
  },

  applyLang() {
    syncDocumentLang();
    for (const el of document.querySelectorAll('[data-i18n]')) {
      const k = el.dataset.i18n;
      if (k) el.textContent = t(k);
    }
    $('title-text').textContent = t('title');
    $('subtitle-text').textContent = t('subtitle');
    $('btn-start').textContent = t('start');
    $('btn-resume').textContent = t('resume');
    $('btn-restart-pause').textContent = t('restart');
    $('btn-menu').textContent = t('menu');
    $('btn-menu-results').textContent = t('menu');
    $('btn-howto').textContent = t('howto');
    $('btn-retry').textContent = t('retry');
    $('btn-share').textContent = t('share');
    $('pause-title').textContent = t('paused');
    $('upgrade-title').textContent = t('upgrade_title');
    $('upgrade-hint').textContent = t('upgrade_hint');
    $('btn-mute').textContent = save.get('muted', false) ? t('unmute') : t('mute');
    document.querySelector('[data-tutorial-skip]').textContent = t('skip');
    for (const sel of this.langSelects) if (sel) sel.setAttribute('aria-label', t('language'));
    this.fillLangOptions();
    this._renderTutorial();
  },

  fillLangOptions() {
    for (const sel of this.langSelects) {
      if (!sel) continue;
      sel.innerHTML = '';
      for (const item of i18n.options()) {
        const opt = document.createElement('option');
        opt.value = item.code; opt.textContent = item.name;
        if (item.code === i18n.lang) opt.selected = true;
        sel.appendChild(opt);
      }
    }
  },

  setLang(lang) { i18n.setLang(lang); this.applyLang(); return i18n.lang; },

  showScreen(name) {
    for (const [k, el] of Object.entries(this.screens)) el.classList.toggle('is-active', k === name);
    for (const [k, el] of Object.entries(this.screens)) el.classList.toggle('hidden', k !== name);
    this.hud.classList.toggle('hidden', name !== 'game');
    this.applyLang();
  },
  showTitle() { this.showScreen('title'); this._updateBest(); },
  showGame() { this.showScreen('game'); },
  showPause() { this.showScreen('pause'); },
  showResults(win, stats) {
    this.showScreen('results');
    this.resultsTitle.textContent = t(win ? 'results_win' : 'results_dead');
    this.resultsLine.textContent = t(win ? 'win_line' : 'dead_line');
    this.resultsStars.textContent = '★'.repeat(stats.stars) + '☆'.repeat(Math.max(0, 3 - stats.stars));
    this.resultsStats.textContent =
      `${t('time')}: ${Math.round(stats.time)}s   ${t('headshots')}: ${stats.headshots}   ${t('best')}: ${save.get('best', 0)}`;
  },
  showUpgrade(choices) {
    this.showScreen('upgrade');
    this.upgradeChoices.innerHTML = '';
    for (const id of choices) {
      const card = document.createElement('button');
      card.className = 'upgrade-card';
      card.innerHTML = `<h4>${t('up_' + id)}</h4><p>${t('up_' + id + '_d')}</p>`;
      card.dataset.id = id;
      card.addEventListener('click', () => this._onUpgrade && this._onUpgrade(id));
      this.upgradeChoices.appendChild(card);
    }
  },

  updateHUD(h) {
    this.hudLevel.textContent = t('level') + ' ' + h.level;
    this.hudHearts.textContent = '♥'.repeat(Math.max(0, h.hearts));
    this.hudQuiver.textContent = t('arrows') + ': ' + h.quiver;
    this.hudHeadshots.textContent = t('headshots') + ': ' + h.headshots;
    const w = h.wind;
    this.hudWind.textContent = t('wind') + ': ' + (w === 0 ? '—' : (w > 0 ? '→ ' : '← ') + Math.abs(w).toFixed(1));
    this.hudWind.style.display = Math.abs(w) < 0.05 ? 'none' : '';
  },

  toast(text, ms = 1600) {
    this.toastEl.textContent = text;
    this.toastEl.classList.remove('hidden');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => this.toastEl.classList.add('hidden'), ms);
  },

  _updateBest() {
    $('best-line').textContent = t('best') + ': ' + save.get('best', 0) + 's  ·  ' + t('headshots') + ': ' + save.get('bestHeadshots', 0);
  },

  _renderTutorial() {
    const st = this.tutorial.step;
    if (!this.tutorial.active) return;
    document.querySelector('[data-step]').textContent = `${st + 1} / ${this.tutorial.steps.length}`;
    document.querySelector('[data-title]').textContent = t('tut_' + (st + 1) + '_t');
    document.querySelector('[data-text]').textContent = t('tut_' + (st + 1));
    this._positionSpot();
  },

  _positionSpot() {
    // 高亮画布中心（拉弓/放箭都在画布上进行）
    const w = window.innerWidth, h = window.innerHeight;
    this.tutorialSpot.style.left = Math.round(w * 0.22) + 'px';
    this.tutorialSpot.style.top = Math.round(h * 0.18) + 'px';
    this.tutorialSpot.style.width = Math.round(w * 0.56) + 'px';
    this.tutorialSpot.style.height = Math.round(h * 0.5) + 'px';
  },
};
