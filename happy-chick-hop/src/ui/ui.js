// UI 模块：标题/暂停/结算/HUD 显隐 + 多语言下拉（默认英文）
import { i18n, t, syncDocumentLang } from '../core/i18n.js';

export const ui = {
  titleScreen: document.getElementById('screen-title'),
  pauseScreen: document.getElementById('screen-pause'),
  resultScreen: document.getElementById('screen-result'),
  hud: document.getElementById('hud'),
  titleText: document.getElementById('title-text'),
  subtitleText: document.getElementById('subtitle-text'),
  btnStart: document.getElementById('btn-start'),
  langSelects: [
    document.getElementById('lang-select'),
    document.getElementById('lang-select-pause'),
  ],

  get lang() {
    return i18n.lang;
  },

  get dir() {
    return i18n.dir;
  },

  applyLang() {
    syncDocumentLang();
    this.titleText.textContent = t('title');
    this.subtitleText.textContent = t('subtitle');
    this.btnStart.textContent = t('start');
    this.fillLangOptions();
    const rt = document.getElementById('rotate-text');
    const rb = document.getElementById('btn-rotate-skip');
    if (rt) rt.textContent = t('rotateHint');
    if (rb) rb.textContent = t('rotateSkip');
    // HUD 的「?」帮助键保持图标本身（写全「How to play」会把 44px 按钮挤换行/裁切）
    const howto = document.getElementById('btn-howto');
    if (howto) howto.textContent = '?';
    // 暂停屏 / 结算屏文案本地化
    const set = (id, key) => { const el = document.getElementById(id); if (el) el.textContent = t(key); };
    set('pause-title', 'paused');
    set('btn-resume', 'resume');
    set('btn-restart2', 'restart');
    set('btn-tut-replay', 'replayGuide');
    set('btn-home2', 'home');
    set('btn-home3', 'home');
    set('btn-retry', 'retry');
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

  showTitle() {
    this.titleScreen.classList.remove('hidden');
    this.titleScreen.classList.add('is-active');
    this.pauseScreen.classList.add('hidden');
    this.resultScreen.classList.add('hidden');
    this.hud.classList.add('hidden');
    this.applyLang();
  },

  showGame() {
    this.titleScreen.classList.add('hidden');
    this.titleScreen.classList.remove('is-active');
    this.pauseScreen.classList.add('hidden');
    this.resultScreen.classList.add('hidden');
    this.hud.classList.remove('hidden');
  },

  showPause() {
    this.pauseScreen.classList.remove('hidden');
    this.applyLang();
  },

  hidePause() {
    this.pauseScreen.classList.add('hidden');
  },

  showResult() {
    this.resultScreen.classList.remove('hidden');
  },

  hideResult() {
    this.resultScreen.classList.add('hidden');
  },
};
