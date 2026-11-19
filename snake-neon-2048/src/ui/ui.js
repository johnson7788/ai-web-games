// UI 语言与屏幕显隐助手（不写游戏逻辑，只负责 DOM 文案与显示切换）。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';
import { locales } from '../../config/locales.js';

function applyText(el, key) {
  if (!el) return;
  el.textContent = t(key);
}

export const ui = {
  setLang(lang) {
    i18n.setLang(lang);
    this.applyLang();
  },

  applyLang() {
    syncDocumentLang();
    const map = {
      'title-text': 'title',
      'subtitle-text': 'subtitle',
      'btn-start': 'start',
      'btn-resume': 'resume',
      'pause-title': 'paused',
      'btn-restart2': 'restart',
      'btn-home3': 'home',
      'btn-tut-replay': 'replayGuide',
      'result-title-lose': 'loseTitle',
      'result-title-win': 'winTitle',
      'btn-retry': 'retry',
      'btn-next': 'nextLevel',
      'btn-home2': 'home',
      'howto-label': 'howto',
      'rotate-text': 'rotateHint',
      'btn-rotate-skip': 'rotateSkip',
      'pause-hint': 'pauseKey',
    };
    for (const [id, key] of Object.entries(map)) applyText(document.getElementById(id), key);

    // 语言下拉
    document.querySelectorAll('.lang-select').forEach((sel) => {
      sel.innerHTML = '';
      for (const opt of i18n.options()) {
        const o = document.createElement('option');
        o.value = opt.code;
        o.textContent = opt.name;
        if (opt.code === i18n.lang) o.selected = true;
        sel.appendChild(o);
      }
    });

    // 静态 HUD 标签
    applyText(document.getElementById('hud-score-label'), 'score');
    applyText(document.getElementById('hud-best-label'), 'best');
    applyText(document.getElementById('hud-combo-label'), 'combo');
    applyText(document.getElementById('hud-target-label'), 'target');
    applyText(document.getElementById('hud-level-label'), 'level');
  },

  showTitle() {
    document.getElementById('screen-title').classList.add('is-active');
    document.getElementById('screen-pause').classList.remove('is-active');
    document.getElementById('screen-result').classList.remove('is-active');
    document.getElementById('hud').classList.add('hidden');
  },

  showGame() {
    document.getElementById('screen-title').classList.remove('is-active');
    document.getElementById('screen-pause').classList.remove('is-active');
    document.getElementById('screen-result').classList.remove('is-active');
    document.getElementById('hud').classList.remove('hidden');
  },

  showPause() {
    document.getElementById('screen-pause').classList.add('is-active');
  },

  hidePause() {
    document.getElementById('screen-pause').classList.remove('is-active');
  },

  setMuted(muted) {
    const b = document.getElementById('btn-mute');
    if (b) b.classList.toggle('is-muted', muted);
  },
};
