// src/ui/ui.js — DOM UI：标题/暂停/结算/HUD/关卡格 + 多语言（默认英文，可切中文）。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';
import Sdk from '../core/sdk.js';
import { LEVELS } from '../../config/levels.js';

function loadNum(key, fallback) {
  const v = Sdk.load(key, fallback);
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

export const ui = {
  el: {},

  init() {
    const ids = [
      'canvas', 'hud', 'hud-level', 'hud-time', 'hud-gems', 'hud-score',
      'btn-howto', 'btn-mute', 'btn-restart', 'btn-home',
      'screen-title', 'title-text', 'subtitle-text', 'stars-total', 'btn-start', 'level-grid', 'lang-select',
      'screen-pause', 'pause-title', 'btn-resume', 'btn-restart2', 'btn-tut-replay', 'btn-home3', 'lang-select-pause',
      'screen-result', 'result-title', 'result-stars', 'result-meta', 'btn-retry', 'btn-next', 'btn-home2',
      'tutorial', 'tut-title', 'tut-text', 'tut-skip', 'tut-next', 'tut-spotlight', 'tut-card',
      'rotate-text', 'btn-rotate-skip',
    ];
    for (const id of ids) this.el[id] = document.getElementById(id);
  },

  get lang() { return i18n.lang; },
  get dir() { return i18n.dir; },

  applyLang() {
    syncDocumentLang();
    this.el['title-text'].textContent = t('title');
    this.el['subtitle-text'].textContent = t('subtitle');
    this.el['btn-start'].textContent = t('start');
    this.el['btn-resume'].textContent = t('resume');
    this.el['btn-restart2'].textContent = t('restart');
    this.el['btn-tut-replay'].textContent = t('replayGuide');
    this.el['btn-home3'].textContent = t('home');
    this.el['pause-title'].textContent = t('paused');
    this.el['btn-retry'].textContent = t('retry');
    this.el['btn-next'].textContent = t('next');
    this.el['btn-home2'].textContent = t('home');
    this.el['btn-howto'].setAttribute('aria-label', t('howto'));
    this.el['btn-mute'].setAttribute('aria-label', t('mute'));
    this.el['btn-restart'].setAttribute('aria-label', t('restart'));
    this.el['btn-home'].setAttribute('aria-label', t('home'));
    this.el['rotate-text'].textContent = t('rotateHint');
    this.el['btn-rotate-skip'].textContent = t('rotateSkip');
    this.el['tut-title'].textContent = t('tutTitle');
    this.el['tut-skip'].textContent = t('tutSkip');
    this.el['tut-next'].textContent = t('tutNext');
    for (const sel of [this.el['lang-select'], this.el['lang-select-pause']]) {
      if (sel) sel.setAttribute('aria-label', t('language'));
    }
    this.fillLangOptions();
    this.renderLevelGrid();
  },

  fillLangOptions() {
    for (const sel of [this.el['lang-select'], this.el['lang-select-pause']]) {
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

  renderLevelGrid() {
    const grid = this.el['level-grid'];
    if (!grid) return;
    grid.innerHTML = '';
    const bestLevel = loadNum('bestLevel', 0); // 0 = 未通关任何一关
    for (let i = 0; i < LEVELS.length; i += 1) {
      const cell = document.createElement('button');
      cell.className = 'level-cell';
      if (i > bestLevel) cell.classList.add('level-locked');
      cell.innerHTML = `<span class="level-num">${i + 1}</span><span class="level-stars"></span>`;
      cell.addEventListener('click', () => {
        if (i <= bestLevel) window.__ll?.start(i);
      });
      grid.appendChild(cell);
    }
  },

  showTitle() {
    this.el['screen-title'].classList.remove('hidden');
    this.el['screen-title'].classList.add('is-active');
    this.el['screen-pause'].classList.add('hidden');
    this.el['screen-result'].classList.add('hidden');
    this.el['hud'].classList.add('hidden');
    this.applyLang();
    const total = loadNum('totalStars', 0);
    this.el['stars-total'].textContent = total > 0 ? '★'.repeat(3) + ` ${total}` : '';
  },

  showGame() {
    this.el['screen-title'].classList.add('hidden');
    this.el['screen-title'].classList.remove('is-active');
    this.el['screen-pause'].classList.add('hidden');
    this.el['screen-result'].classList.add('hidden');
    this.el['hud'].classList.remove('hidden');
  },

  showPause() {
    this.el['screen-pause'].classList.remove('hidden');
    this.applyLang();
  },

  hidePause() {
    this.el['screen-pause'].classList.add('hidden');
  },

  showResult(stars, hud, meta) {
    this.el['screen-result'].classList.remove('hidden');
    this.el['hud'].classList.add('hidden');
    const win = hud.phase === 'won';
    this.el['result-title'].textContent = win ? t('winTitle') : t('loseTitle');
    this.el['result-title'].style.color = win ? '#7df9ff' : '#ff5c7a';
    // 星星（失败时不显示星星）
    let starsHtml = '';
    if (win) {
      for (let i = 0; i < 3; i += 1) {
        starsHtml += `<span class="star ${i < stars ? 'star-on' : ''}">★</span>`;
      }
    }
    this.el['result-stars'].innerHTML = starsHtml;
    this.el['result-meta'].textContent = meta;
    this.el['btn-retry'].style.display = '';
    this.el['btn-next'].style.display = win ? '' : 'none';
    this.applyLang();
    this.el['result-title'].style.color = win ? '#7df9ff' : '#ff5c7a';
  },

  updateHUD(hud) {
    this.el['hud-level'].textContent = `${t('level')} ${hud.level} · ${t('lv' + hud.level)}`;
    const secs = Math.max(0, Math.ceil(hud.timeLeft));
    this.el['hud-time'].textContent = `${t('time')} ${secs}s`;
    this.el['hud-time'].classList.toggle('time-low', hud.timeLeft <= 10);
    this.el['hud-gems'].textContent = `${t('gems')} ${hud.gems}/${hud.gemsTotal}`;
    this.el['hud-score'].textContent = `${t('score')} ${hud.score}`;
  },

  setMuteIcon(muted) {
    this.el['btn-mute'].classList.toggle('is-muted', muted);
    this.el['btn-mute'].setAttribute('aria-label', muted ? t('unmute') : t('mute'));
  },
};
