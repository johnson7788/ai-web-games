// UI 模块：语言切换 + 屏幕显隐的薄适配层。
// 契约：docs/README.md 状态机；main.js 直接操作 HUD/结算/关卡格/教程的 DOM。
// 这里只负责：lang/dir、t、setLang、applyLang（静态文案 + 语言下拉）、show/hide 屏幕。
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

  // 静态可见文案统一在此刷新（切语言时调用一次）
  applyLang() {
    syncDocumentLang();
    setText('title-text', i18nT('title'));
    setText('subtitle-text', i18nT('subtitle'));
    setText('btn-play', i18nT('play'));
    setText('btn-puzzle', i18nT('puzzle'));
    setText('btn-endless', i18nT('endless'));
    setText('puzzle-title', i18nT('puzzleTitle'));
    setText('btn-levels-back', i18nT('back'));
    setText('endless-title', i18nT('endlessTitle'));
    setText('btn-endless-back', i18nT('back'));
    setText('btn-vs-random', i18nT('vsRandom'));
    setText('btn-vs-greedy', i18nT('vsGreedy'));
    setText('btn-vs-perfect', i18nT('vsPerfect'));
    setText('btn-two-player', i18nT('twoPlayer'));
    setText('diff-random', i18nT('difficultyRandom'));
    setText('diff-greedy', i18nT('difficultyGreedy'));
    setText('diff-perfect', i18nT('difficultyPerfect'));
    setText('diff-2p', i18nT('difficulty2P'));
    setText('pause-title', i18nT('paused'));
    setText('btn-resume', i18nT('resume'));
    setText('btn-restart2', i18nT('restart'));
    setText('btn-tut-replay', i18nT('replayGuide'));
    setText('btn-home3', i18nT('home'));
    setText('rotate-text', i18nT('rotateHint'));
    setText('btn-rotate-skip', i18nT('rotateSkip'));
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

  // 屏幕切换：title / levels / endless / game / pause / result
  show(name) {
    const screens = ['screen-title', 'screen-levels', 'screen-endless', 'screen-pause', 'screen-result'];
    for (const id of screens) {
      const el = q(id);
      if (el) el.classList.add('hidden');
    }
    const hud = q('hud');
    if (name === 'title' || name === 'levels' || name === 'endless') {
      if (hud) hud.classList.add('hidden');
      if (name === 'title') q('screen-title')?.classList.remove('hidden');
      else if (name === 'levels') q('screen-levels')?.classList.remove('hidden');
      else if (name === 'endless') q('screen-endless')?.classList.remove('hidden');
    } else if (name === 'game') {
      if (hud) hud.classList.remove('hidden');
    } else if (name === 'pause') {
      q('screen-pause')?.classList.remove('hidden');
    } else if (name === 'result') {
      q('screen-result')?.classList.remove('hidden');
    }
  },

  hide(name) {
    if (name === 'pause') q('screen-pause')?.classList.add('hidden');
    else if (name === 'result') q('screen-result')?.classList.add('hidden');
  },

  showTitle() { this.show('title'); },
  showGame() { this.show('game'); },
  showPause() { this.show('pause'); },
  hidePause() { this.hide('pause'); },
};
