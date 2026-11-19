// UI 模块：语言切换 + 屏幕显隐的薄适配层。HUD/结算/教程的 DOM 由 main.js 直写。
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

  get lang() { return i18n.lang; },
  get dir() { return i18n.dir; },

  t(key, vars) { return i18nT(key, vars); },

  setMuted(muted) { this._muted = !!muted; return this._muted; },

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
    const title = q('screen-title');
    const pause = q('screen-pause');
    const result = q('screen-result');
    const hud = q('hud');
    const hands = q('hands');
    for (const s of [title, pause, result]) if (s) s.classList.add('hidden');
    if (title) title.classList.remove('is-active');
    if (name === 'title') {
      if (title) { title.classList.remove('hidden'); title.classList.add('is-active'); }
      if (hud) hud.classList.add('hidden');
      if (hands) hands.classList.add('hidden');
    } else if (name === 'game') {
      if (hud) hud.classList.remove('hidden');
      if (hands) hands.classList.remove('hidden');
    } else if (name === 'pause') {
      if (pause) pause.classList.remove('hidden');
    } else if (name === 'result') {
      if (result) result.classList.remove('hidden');
    }
  },

  hide(name) {
    if (name === 'pause') { const p = q('screen-pause'); if (p) p.classList.add('hidden'); }
    else if (name === 'title') { const t = q('screen-title'); if (t) t.classList.add('hidden'); }
    else if (name === 'result') { const r = q('screen-result'); if (r) r.classList.add('hidden'); }
  },

  showTitle() { this.show('title'); },
  showGame() { this.show('game'); },
  showPause() { this.show('pause'); },
  hidePause() { this.hide('pause'); },
};
