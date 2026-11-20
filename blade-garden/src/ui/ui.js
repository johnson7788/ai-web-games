// BLADE GARDEN · UI 薄适配层：语言切换 + 屏幕显隐。
// HUD/结算/升级卡/教程的 DOM 由 main.js 直写；这里只负责静态文案与显隐。
import { i18n, t as i18nT, syncDocumentLang } from '../core/i18n.js';

function q(id) {
  return typeof document !== 'undefined' ? document.getElementById(id) : null;
}

function setText(id, txt) {
  const n = q(id);
  if (n && txt != null) n.textContent = txt;
}

export const ui = {
  _muted: false,

  get lang() {
    return i18n.lang;
  },
  get dir() {
    return i18n.dir;
  },

  t(key, vars) {
    return i18nT(key, vars);
  },

  setMuted(muted) {
    this._muted = !!muted;
    return this._muted;
  },

  setLang(lang) {
    const changed = i18n.setLang(lang);
    if (changed || i18n.lang === lang) this.applyLang();
    return i18n.lang;
  },

  toggleLang() {
    i18n.setLang(i18n.next());
    this.applyLang();
    return i18n.lang;
  },

  applyLang() {
    syncDocumentLang();
    setText('title-text', i18nT('title'));
    setText('subtitle-text', i18nT('subtitle'));
    setText('btn-start', i18nT('start'));
    setText('btn-resume', i18nT('resume'));
    setText('pause-title', i18nT('paused'));
    setText('btn-restart2', i18nT('restart'));
    setText('btn-home3', i18nT('home'));
    setText('btn-tut-replay', i18nT('replayGuide'));
    setText('btn-retry', i18nT('retry'));
    setText('btn-next', i18nT('nextLevel'));
    setText('btn-home2', i18nT('home'));
    setText('upgrade-title', i18nT('upgradeTitle'));
    setText('upgrade-hint', i18nT('upgradeHint'));
    this.fillLangOptions();
  },

  fillLangOptions() {
    const sels = [q('lang-select'), q('lang-select-pause')];
    for (const sel of sels) {
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

  show(name) {
    const screens = ['screen-title', 'screen-pause', 'screen-result', 'screen-upgrade'];
    for (const id of screens) {
      const el = q(id);
      if (el) el.classList.add('hidden');
    }
    const title = q('screen-title');
    if (title) title.classList.remove('is-active');

    if (name === 'title') {
      if (title) { title.classList.remove('hidden'); title.classList.add('is-active'); }
      const hud = q('hud'); if (hud) hud.classList.add('hidden');
      if (typeof window !== 'undefined' && window.__drawTitle) window.__drawTitle();
    } else if (name === 'game') {
      const hud = q('hud'); if (hud) hud.classList.remove('hidden');
    } else {
      const el = q(`screen-${name}`);
      if (el) el.classList.remove('hidden');
    }
  },

  hide(name) {
    const el = q(`screen-${name}`);
    if (el) el.classList.add('hidden');
  },

  showTitle() { this.show('title'); },
  showGame() { this.show('game'); },
  showPause() { this.show('pause'); },
  hidePause() { this.hide('pause'); },
  showResult() { this.show('result'); },
  hideResult() { this.hide('result'); },
  showUpgrade() { this.show('upgrade'); },
  hideUpgrade() { this.hide('upgrade'); },
};
