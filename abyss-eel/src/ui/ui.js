// UI 模块：标题/暂停/HUD + 多语言下拉（默认英文，ar 自动 RTL）
import { i18n, t, syncDocumentLang } from '../core/i18n.js';
import { save } from '../core/save.js';

export const ui = {
  titleScreen: document.getElementById('screen-title'),
  pauseScreen: document.getElementById('screen-pause'),
  hud: document.getElementById('hud'),
  hudTime: document.getElementById('hud-time'),
  hudBest: document.getElementById('hud-best'),
  titleText: document.getElementById('title-text'),
  subtitleText: document.getElementById('subtitle-text'),
  pauseTitle: document.getElementById('pause-title'),
  btnStart: document.getElementById('btn-start'),
  btnResume: document.getElementById('btn-resume'),
  langSelects: [
    document.getElementById('lang-select'),
    document.getElementById('lang-select-pause'),
  ],
  lastTime: 0,

  get lang() {
    return i18n.lang;
  },

  get dir() {
    return i18n.dir;
  },

  // 所有可见文案都从这里刷新；切语言时调用一次即可
  applyLang() {
    syncDocumentLang();
    this.titleText.textContent = t('title');
    this.subtitleText.textContent = t('subtitle');
    this.btnStart.textContent = t('start');
    this.btnResume.textContent = t('resume');
    this.pauseTitle.textContent = t('paused');
    for (const sel of this.langSelects) {
      if (sel) sel.setAttribute('aria-label', t('language'));
    }
    this.fillLangOptions();
    this.updateHUD(this.lastTime);
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

  toggleLang() {
    i18n.setLang(i18n.next());
    this.applyLang();
    return i18n.lang;
  },

  showTitle() {
    this.titleScreen.classList.remove('hidden');
    this.titleScreen.classList.add('is-active');
    this.pauseScreen.classList.add('hidden');
    this.hud.classList.add('hidden');
    this.applyLang();
  },

  showGame() {
    this.titleScreen.classList.add('hidden');
    this.titleScreen.classList.remove('is-active');
    this.pauseScreen.classList.add('hidden');
    this.hud.classList.remove('hidden');
  },

  showPause() {
    this.pauseScreen.classList.remove('hidden');
    this.applyLang();
  },

  hidePause() {
    this.pauseScreen.classList.add('hidden');
  },

  updateHUD(time) {
    this.lastTime = time;
    this.hudTime.textContent = t('time') + ': ' + Math.floor(time) + 's';
    const best = save.get('best', 0);
    this.hudBest.textContent = t('best') + ': ' + Math.floor(best) + 's';
  },

  updateBest(time) {
    const best = save.get('best', 0);
    if (time > best) {
      save.set('best', time);
    }
  },
};
