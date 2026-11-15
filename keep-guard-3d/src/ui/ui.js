// src/ui/ui.js — 屏幕/HUD/建塔栏/交互引导。所有文案经 t() 刷新，切语言即时重渲染。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';
import { save } from '../core/save.js';
import { TOWERS, WALL, ECON } from '../../config/game.config.js';

const $ = (id) => document.getElementById(id);

export const ui = {
  lang: () => i18n.lang,
  dir: () => i18n.dir,

  // 元素
  hud: $('hud'), hudGold: $('hud-gold'), hudWave: $('hud-wave'), hudCore: $('hud-core'),
  hudTime: $('hud-time'), hudBuildTimer: $('hud-build-timer'),
  btnStartWave: $('btn-start-wave'), btnMute: $('btn-mute'), btnMuteTitle: $('btn-mute-title'),
  buildBar: $('build-bar'), selPanel: $('sel-panel'), selInfo: $('sel-info'),
  btnUpgrade: $('btn-upgrade'), btnSell: $('btn-sell'),
  towerBtns: Array.from(document.querySelectorAll('.tower-btn')),
  titleScreen: $('screen-title'), pauseScreen: $('screen-pause'), resultsScreen: $('screen-results'),
  titleText: $('title-text'), subtitleText: $('subtitle-text'), titleBest: $('title-best'),
  pauseTitle: $('pause-title'),
  resTitle: $('res-title'), resSub: $('res-sub'), resRating: $('res-rating'), resStats: $('res-stats'),
  btnStart: $('btn-start'), btnHowto: $('btn-howto'),
  btnResume: $('btn-resume'), btnRestartPause: $('btn-restart-pause'), btnMenuPause: $('btn-menu-pause'),
  btnRestart: $('btn-restart'), btnShare: $('btn-share'), btnMenu: $('btn-menu'),
  langSelects: [$('lang-select'), $('lang-select-pause')],

  _selected: null, _selCell: null,

  get selected() { return this._selected; },
  setSelected(type) {
    this._selected = type === this._selected ? null : type;
    for (const b of this.towerBtns) b.classList.toggle('selected', b.dataset.tower === this._selected);
    if (!this._selected) this.hideSelPanel();
    return this._selected;
  },

  getSelCell() { return this._selCell; },
  showSelPanel(info) {
    this.selPanel.classList.remove('hidden');
    this.selInfo.textContent = info;
  },
  hideSelPanel() {
    this.selPanel.classList.add('hidden');
    this._selCell = null;
  },
  setSelCell(cell, info) { this._selCell = cell; this.showSelPanel(info); },

  applyLang() {
    syncDocumentLang();
    this.titleText.textContent = t('title');
    this.subtitleText.textContent = t('subtitle');
    this.pauseTitle.textContent = t('paused');
    this.btnStart.textContent = t('start');
    this.btnHowto.textContent = t('howto');
    this.btnResume.textContent = t('resume');
    this.btnRestartPause.textContent = t('restart');
    this.btnMenuPause.textContent = t('menu');
    this.btnRestart.textContent = t('restart');
    this.btnShare.textContent = t('share');
    this.btnMenu.textContent = t('menu');
    this.btnStartWave.textContent = t('startWave');
    this.btnUpgrade.textContent = t('upgrade');
    this.btnSell.textContent = t('sell');
    this.btnMute.textContent = save.get('muted', false) ? t('unmute') : t('mute');
    this.btnMuteTitle.textContent = save.get('muted', false) ? t('unmute') : t('mute');
    for (const el of document.querySelectorAll('[data-i18n]')) {
      el.textContent = t(el.getAttribute('data-i18n'));
    }
    for (const sel of this.langSelects) if (sel) sel.setAttribute('aria-label', t('language'));
    this.fillLangOptions();
    this.tutorial.refresh();
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

  showTitle() {
    this.titleScreen.classList.remove('hidden');
    this.pauseScreen.classList.add('hidden');
    this.resultsScreen.classList.add('hidden');
    this.hud.classList.add('hidden');
    this.buildBar.classList.add('hidden');
    this.titleBest.textContent = String(save.get('best', 0));
    this.applyLang();
  },
  showGame() {
    this.titleScreen.classList.add('hidden');
    this.pauseScreen.classList.add('hidden');
    this.resultsScreen.classList.add('hidden');
    this.hud.classList.remove('hidden');
    this.buildBar.classList.remove('hidden');
    this.hideSelPanel();
    this.setSelected(null);
  },
  showPause() { this.pauseScreen.classList.remove('hidden'); this.applyLang(); },
  hidePause() { this.pauseScreen.classList.add('hidden'); },

  showResults(payload) {
    this.titleScreen.classList.add('hidden');
    this.pauseScreen.classList.add('hidden');
    this.resultsScreen.classList.remove('hidden');
    this.hud.classList.add('hidden');
    this.buildBar.classList.add('hidden');
    this.resTitle.textContent = payload.won ? t('won') : t('lost');
    this.resSub.textContent = payload.won ? t('resultsWin') : t('resultsLose');
    this.resRating.textContent = payload.rating;
    this.resStats.innerHTML = '';
    const stats = [
      [t('hpLeft'), payload.hpLeft],
      [t('wavesCleared'), `${payload.wavesCleared}/${payload.totalWaves}`],
      [t('timeTaken'), payload.timeStr],
      [t('kills'), payload.kills],
    ];
    for (const [k, v] of stats) {
      const d = document.createElement('div');
      d.className = 'stat';
      d.innerHTML = `<span class="lbl">${k}</span><b>${v}</b>`;
      this.resStats.appendChild(d);
    }
    if (payload.isRecord) { this.resSub.textContent += '  ' + t('newRecord'); }
  },

  updateHUD(run) {
    this.hudGold.textContent = String(run.gold);
    this.hudWave.textContent = `${run.wave}/${run.totalWaves}`;
    this.hudCore.textContent = String(run.coreHp);
    const m = Math.floor(run.time / 60), s = Math.floor(run.time % 60);
    this.hudTime.textContent = `${m}:${String(s).padStart(2, '0')}`;
    if (run.phase === 'build') {
      this.hudBuildTimer.classList.remove('hidden');
      this.hudBuildTimer.textContent = String(Math.max(0, Math.ceil(run.buildTimeLeft)));
      this.btnStartWave.classList.remove('hidden');
    } else {
      this.hudBuildTimer.classList.add('hidden');
      this.btnStartWave.classList.add('hidden');
    }
  },

  // ---------------------------------------------------------------- 引导
  tutorial: {
    active: false,
    step: 0,
    steps: ['pick', 'place', 'start', 'defend'],
    current: 'pick',
    _focus: { pick: 'btn-tower-arrow', place: null, start: 'btn-start-wave', defend: null },

    start() {
      this.active = true; this.step = 0; this.current = 'pick';
      $('tutorial').classList.remove('hidden');
      this.refresh(); this._position();
    },
    skip() { this._end(); },
    complete() { this._end(); },
    _end() {
      this.active = false;
      $('tutorial').classList.add('hidden');
      save.set('tutDone', true);
    },
    next() {
      if (this.step < this.steps.length - 1) { this.step += 1; this.current = this.steps[this.step]; this.refresh(); this._position(); }
      else this.complete();
    },
    onAction(kind) {
      if (!this.active) return;
      const done =
        (this.current === 'pick' && kind === 'select') ||
        (this.current === 'place' && kind === 'build') ||
        (this.current === 'start' && kind === 'wave') ||
        (this.current === 'defend' && kind === 'kill');
      if (done) this.next();
    },
    refresh() {
      const keys = ['tut1', 'tut2', 'tut3', 'tut4'];
      $('tut-text').textContent = t(keys[this.step] || 'tut1');
      $('tut-next').textContent = t('tutNext');
      $('tut-skip').textContent = t('tutSkip');
    },
    _stageScale() {
      const s = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
      const left = (window.innerWidth - 1280 * s) / 2;
      const top = (window.innerHeight - 720 * s) / 2;
      return { s, left, top };
    },
    _position() {
      const el = $('tut-highlight');
      const focusId = this._focus[this.current];
      const { s, left, top } = this._stageScale();
      let r = { left: 640 - 90, top: 300, width: 180, height: 180 };
      const f = focusId ? $(focusId) : null;
      if (f && f.offsetParent !== null) {
        const b = f.getBoundingClientRect();
        r = { left: (b.left - left) / s, top: (b.top - top) / s, width: b.width / s, height: b.height / s };
      }
      el.style.left = `${r.left}px`;
      el.style.top = `${r.top}px`;
      el.style.width = `${r.width}px`;
      el.style.height = `${r.height}px`;
    },
  },
};
