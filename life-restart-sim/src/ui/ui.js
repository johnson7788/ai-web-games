// UI 薄适配层：语言切换 + 屏幕显隐。HUD/天赋/分配/日志/结算 DOM 由 main.js 直写。
import { i18n, t as i18nT, syncDocumentLang } from '../core/i18n.js';

function q(id) { return typeof document !== 'undefined' ? document.getElementById(id) : null; }
function setText(id, txt) { const n = q(id); if (n && txt != null) n.textContent = txt; }

export const ui = {
  _muted: false,
  get lang() { return i18n.lang; },
  get dir() { return i18n.dir; },
  t(key, vars) { return i18nT(key, vars); },
  setMuted(muted) { this._muted = !!muted; return this._muted; },

  setLang(lang) {
    const changed = i18n.setLang(lang);
    if (changed || i18n.lang === lang) this.applyLang();
    return i18n.lang;
  },

  applyLang() {
    syncDocumentLang();
    setText('title-text', i18nT('title'));
    setText('subtitle-text', i18nT('subtitle'));
    setText('btn-start', i18nT('start'));
    setText('btn-howto', i18nT('howto'));
    setText('btn-resume', i18nT('resume'));
    setText('pause-title', i18nT('paused'));
    setText('btn-home3', i18nT('home'));
    setText('btn-replay', i18nT('replay'));
    setText('btn-home2', i18nT('home'));
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
    const screens = ['screen-title', 'screen-talent', 'screen-allocate', 'screen-life', 'screen-summary', 'screen-pause'];
    for (const s of screens) {
      const el = q(s);
      if (el) { el.classList.add('hidden'); if (s === 'screen-title') el.classList.remove('is-active'); }
    }
    const title = q('screen-title');
    const hud = q('hud');
    const action = q('action-bar');
    const nameMap = {
      title: 'screen-title', talent: 'screen-talent', allocate: 'screen-allocate',
      life: 'screen-life', summary: 'screen-summary', pause: 'screen-pause',
    };
    const id = nameMap[name];
    const el = q(id);
    if (el) el.classList.remove('hidden');
    if (name === 'title' && title) title.classList.add('is-active');
    if (hud) hud.classList.toggle('hidden', name !== 'life');
    if (action) action.classList.toggle('hidden', name !== 'life');
  },

  hide(name) {
    const id = { pause: 'screen-pause', title: 'screen-title', summary: 'screen-summary' }[name];
    const el = q(id);
    if (el) el.classList.add('hidden');
  },
  showTitle() { this.show('title'); },
  showPause() { this.show('pause'); },
  hidePause() { this.show('life'); },
};
