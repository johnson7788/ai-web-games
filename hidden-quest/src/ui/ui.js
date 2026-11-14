// UI 模块：标题/暂停/过关 + HUD + 目标列表（DOM + 缩略图标）+ 多语言。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';
import { TYPE_BY_ID } from '../../config/objects.js';
import { drawIcon } from '../render/index.js';
import { ART, getImage, drawSprite } from '../render/art.js';

function el(id) { return document.getElementById(id); }

export const ui = {
  titleScreen: el('screen-title'),
  pauseScreen: el('screen-pause'),
  clearScreen: el('screen-clear'),
  hud: el('hud'),
  targetPanel: el('target-panel'),
  hudLevel: el('hud-level'),
  hudScore: el('hud-score'),
  hudFound: el('hud-found'),
  targetList: el('target-list'),
  findLabel: el('find-label'),
  titleText: el('title-text'),
  subtitleText: el('subtitle-text'),
  titleBest: el('title-best'),
  howTo: el('how-to'),
  pauseTitle: el('pause-title'),
  clearTitle: el('clear-title'),
  clearScore: el('clear-score'),
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
    this.clearTitle.textContent = t('levelClear');
    this.btnStart.textContent = t('start');
    this.btnResume.textContent = t('resume');
    this.btnRestart.textContent = t('restartRun');
    this.btnNext.textContent = t('nextLevel');
    this.btnTitle.textContent = t('backTitle');
    this.findLabel.textContent = t('findThese');
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
    this.clearScreen.classList.add('hidden');
    this.hud.classList.add('hidden');
    this.targetPanel.classList.add('hidden');
    this.applyLang();
  },
  showGame() {
    this.titleScreen.classList.add('hidden');
    this.pauseScreen.classList.add('hidden');
    this.clearScreen.classList.add('hidden');
    this.hud.classList.remove('hidden');
    this.targetPanel.classList.remove('hidden');
  },
  showPause() { this.pauseScreen.classList.remove('hidden'); this.applyLang(); },
  hidePause() { this.pauseScreen.classList.add('hidden'); },
  showClear(score) {
    this.clearScreen.classList.remove('hidden');
    this.clearScore.textContent = `${t('score')}: ${score}`;
    this.applyLang();
    this.clearScore.textContent = `${t('score')}: ${score}`;
  },
  hideClear() { this.clearScreen.classList.add('hidden'); },

  renderTargets(targets, found, lang) {
    this.targetList.innerHTML = '';
    for (const type of targets) {
      const info = TYPE_BY_ID[type];
      const row = document.createElement('div');
      row.className = 'target-row' + (found.has(type) ? ' found' : '');
      const cv = document.createElement('canvas');
      cv.width = 44;
      cv.height = 44;
      const c = cv.getContext('2d');
      const img = getImage('items', type);
      const meta = ART.items[type];
      if (img && meta) {
        const scale = Math.min(36 / meta.w, 36 / meta.h);
        drawSprite(c, img, 22, 22, meta, scale);
      } else {
        drawIcon(c, type, 22, 22, 16, info.color);
      }
      const name = document.createElement('span');
      name.className = 'target-name';
      name.textContent = info.name[lang] || info.name.en;
      const check = document.createElement('span');
      check.className = 'target-check';
      check.textContent = found.has(type) ? '✓' : '';
      row.append(cv, name, check);
      this.targetList.appendChild(row);
    }
  },

  updateHUD(state) {
    this.hudLevel.textContent = `${t('level')} ${state.level}`;
    this.hudScore.textContent = `${t('score')} ${state.score}`;
    this.hudFound.textContent = `${t('found')} ${state.found}/${state.total}`;
    this.btnHint.textContent = `${t('hint')} ${state.hintsLeft}`;
    this.btnHint.disabled = state.hintsLeft <= 0;
  },
  updateMute(muted) {
    this._muted = muted;
    this.btnMute.textContent = muted ? '🔇' : '🔊';
    this.btnMute.setAttribute('aria-label', `${t('sound')}: ${muted ? t('off') : t('on')}`);
  },
  updateBest(best) {
    this.titleBest.textContent = best > 0 ? `${t('best')}: ${best}` : '';
  },
};