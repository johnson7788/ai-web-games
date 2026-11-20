// UI 模块：语言切换 + 屏幕显隐的薄适配层。
// HUD/结算/关卡格/教程的 DOM 直写归 main.js；这里只负责静态文案与屏幕切换。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';

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
  t(key, vars) { return i18n.get(key, vars); },

  setMuted(m) { this._muted = !!m; return this._muted; },

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
    setText('title-text', t('title'));
    setText('subtitle-text', t('subtitle'));
    setText('btn-start', t('start'));
    setText('btn-resume', t('resume'));
    setText('pause-title', t('paused'));
    setText('btn-restart2', t('restart'));
    setText('btn-home3', t('home'));
    setText('btn-tut-replay', t('replayGuide'));
    setText('btn-retry', t('retry'));
    setText('btn-next', t('nextLevel'));
    setText('btn-home2', t('home'));
    setText('rotate-text', t('rotateHint'));
    setText('btn-rotate-skip', t('rotateSkip'));
    const rt = q('btn-mute');
    if (rt) rt.setAttribute('aria-label', t('mute'));
    const ho = q('btn-howto');
    if (ho) ho.setAttribute('aria-label', t('howto'));
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
    for (const s of [title, pause, result]) if (s) s.classList.add('hidden');
    if (title) title.classList.remove('is-active');

    if (name === 'title') {
      if (title) { title.classList.remove('hidden'); title.classList.add('is-active'); }
      if (hud) hud.classList.add('hidden');
      if (typeof window !== 'undefined' && window.__drawTitle) window.__drawTitle();
    } else if (name === 'game') {
      if (hud) hud.classList.remove('hidden');
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
