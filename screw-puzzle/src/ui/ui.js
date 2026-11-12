// UI 模块：标题/关卡选择/HUD/暂停/过关 + 多语言下拉
import { i18n, t, syncDocumentLang } from '../core/i18n.js';

const $ = (id) => document.getElementById(id);

export const ui = {
  titleScreen: $('screen-title'),
  pauseScreen: $('screen-pause'),
  winScreen: $('screen-win'),
  hud: $('hud'),
  hudLevel: $('hud-level'),
  hudPlates: $('hud-plates'),
  hudTime: $('hud-time'),
  progressFill: $('progress-fill'),
  titleText: $('title-text'),
  subtitleText: $('subtitle-text'),
  starsTotal: $('stars-total'),
  pauseTitle: $('pause-title'),
  winTitle: $('win-title'),
  winStars: $('win-stars'),
  winTime: $('win-time'),
  winMeta: $('win-meta'),
  btnStart: $('btn-start'),
  btnResume: $('btn-resume'),
  btnNext: $('btn-next'),
  btnPrev: $('btn-prev'),
  btnHome: $('btn-home'),
  btnHome2: $('btn-home2'),
  btnRestart: $('btn-restart'),
  btnMute: $('btn-mute'),
  langSelects: [$('lang-select'), $('lang-select-pause')],
  levelGrid: $('level-grid'),
  lastHud: { level: 0, platesLeft: 0, screwsLeft: 0, time: 0 },
  totalStars: 0,
  unlocked: 0,
  selectedLevel: 0,
  muted: false,
  _onSelect: null,

  get lang() { return i18n.lang; },
  get dir() { return i18n.dir; },

  applyLang() {
    syncDocumentLang();
    this.titleText.textContent = t('title');
    this.subtitleText.textContent = t('subtitle');
    this.btnStart.textContent = t('start');
    this.btnResume.textContent = t('resume');
    this.btnNext.textContent = t('next');
    this.btnPrev.textContent = t('prev');
    this.btnHome.textContent = t('back');
    this.btnHome2.textContent = t('back');
    this.btnRestart.textContent = t('restart');
    this.btnMute.textContent = this.muted ? t('unmute') : t('mute');
    this.pauseTitle.textContent = t('paused');
    this.winTitle.textContent = t('clear');
    this.starsTotal.textContent = `${t('stars')}: ${this.totalStars}`;
    for (const sel of this.langSelects) {
      if (sel) sel.setAttribute('aria-label', t('language'));
    }
    this.fillLangOptions();
    this.updateHUD(this.lastHud);
    this.buildLevelGrid();
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

  setProgress(unlocked, totalStars, selectedLevel) {
    this.unlocked = unlocked;
    this.totalStars = totalStars;
    this.selectedLevel = selectedLevel;
    this.starsTotal.textContent = `${t('stars')}: ${totalStars}`;
    this.buildLevelGrid();
  },

  buildLevelGrid(onSelect) {
    if (onSelect) this._onSelect = onSelect;
    const grid = this.levelGrid;
    if (!grid) return;
    grid.innerHTML = '';
    const count = 30;
    for (let i = 0; i < count; i += 1) {
      const cell = document.createElement('button');
      cell.className = 'level-cell';
      const locked = i >= this.unlocked;
      if (locked) {
        cell.classList.add('locked');
        cell.disabled = true;
        const lock = document.createElement('span');
        lock.className = 'lock';
        cell.appendChild(lock);
      } else {
        cell.textContent = String(i + 1);
        if (i === this.selectedLevel) cell.classList.add('selected');
        const idx = i;
        cell.addEventListener('click', () => { if (this._onSelect) this._onSelect(idx); });
      }
      grid.appendChild(cell);
    }
  },

  showTitle() {
    this.titleScreen.classList.remove('hidden');
    this.titleScreen.classList.add('is-active');
    this.pauseScreen.classList.add('hidden');
    this.winScreen.classList.add('hidden');
    this.hud.classList.add('hidden');
    this.applyLang();
  },

  showGame() {
    this.titleScreen.classList.add('hidden');
    this.titleScreen.classList.remove('is-active');
    this.pauseScreen.classList.add('hidden');
    this.winScreen.classList.add('hidden');
    this.hud.classList.remove('hidden');
  },

  showPause() {
    this.pauseScreen.classList.remove('hidden');
    this.applyLang();
  },

  hidePause() {
    this.pauseScreen.classList.add('hidden');
  },

  showWin(stars, time, screws, hasPrev, hasNext) {
    this.winTitle.textContent = t('clear');
    this.winStars.innerHTML = '';
    for (let i = 0; i < 3; i += 1) {
      const s = document.createElement('span');
      s.className = i < stars ? 'star on' : 'star';
      s.textContent = '★';
      this.winStars.appendChild(s);
    }
    this.winTime.textContent = `${t('time')}: ${Math.floor(time)}s`;
    this.winMeta.textContent = `${t('screws')}: ${screws}`;
    this.btnPrev.classList.toggle('hidden', !hasPrev);
    this.btnNext.classList.toggle('hidden', !hasNext);
    this.winScreen.classList.remove('hidden');
  },

  hideWin() {
    this.winScreen.classList.add('hidden');
  },

  updateHUD(hud) {
    if (!hud) return;
    this.lastHud = hud;
    this.hudLevel.textContent = `${t('level')} ${hud.level}`;
    this.hudPlates.textContent = `${t('plates')}: ${hud.platesLeft} · ${t('screws')}: ${hud.screwsLeft}`;
    this.hudTime.textContent = `${t('time')}: ${Math.floor(hud.time)}s`;
    // 进度条：剩余板比例（本关初始板数由 main 传入 hud.totalPlates）
    const total = hud.totalPlates || 1;
    const left = Math.max(0, Math.min(total, hud.platesLeft));
    this.progressFill.style.width = `${((total - left) / total) * 100}%`;
  },

  setMuted(muted) {
    this.muted = muted;
    this.btnMute.textContent = muted ? t('unmute') : t('mute');
    this.btnMute.classList.toggle('muted', muted);
  },
};
