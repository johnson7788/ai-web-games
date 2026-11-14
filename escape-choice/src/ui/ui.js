// UI 模块：标题/暂停 + HUD + 叙事文本/选项 + 结局遮罩 + 多语言。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';

function el(id) { return document.getElementById(id); }

export const ui = {
  titleScreen: el('screen-title'),
  pauseScreen: el('screen-pause'),
  endingScreen: el('screen-ending'),
  hud: el('hud'),
  storyArea: el('story-area'),
  hudFails: el('hud-fails'),
  hudEndings: el('hud-endings'),
  storyText: el('story-text'),
  chooseLabel: el('choose-label'),
  choices: el('choices'),
  endingTitle: el('ending-title'),
  endingText: el('ending-text'),
  titleText: el('title-text'),
  subtitleText: el('subtitle-text'),
  titleBest: el('title-best'),
  howTo: el('how-to'),
  pauseTitle: el('pause-title'),
  btnStart: el('btn-start'),
  btnResume: el('btn-resume'),
  btnRestart: el('btn-restart'),
  btnRetry: el('btn-retry'),
  btnTitle: el('btn-title'),
  btnTitle2: el('btn-title2'),
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
    this.btnStart.textContent = t('start');
    this.btnResume.textContent = t('resume');
    this.btnRestart.textContent = t('restartRun');
    this.btnRetry.textContent = t('tryAgain');
    this.btnTitle.textContent = t('backTitle');
    this.btnTitle2.textContent = t('backTitle');
    this.chooseLabel.textContent = t('choose');
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
    this.endingScreen.classList.add('hidden');
    this.hud.classList.add('hidden');
    this.storyArea.classList.add('hidden');
    this.applyLang();
  },
  showGame() {
    this.titleScreen.classList.add('hidden');
    this.pauseScreen.classList.add('hidden');
    this.endingScreen.classList.add('hidden');
    this.hud.classList.remove('hidden');
    this.storyArea.classList.remove('hidden');
  },
  showPause() { this.pauseScreen.classList.remove('hidden'); this.applyLang(); },
  hidePause() { this.pauseScreen.classList.add('hidden'); },

  setStory(text, choices, lang) {
    this.storyText.textContent = text;
    this.choices.innerHTML = '';
    this.chooseLabel.classList.toggle('hidden', !choices || choices.length === 0);
    (choices || []).forEach((c, i) => {
      const btn = document.createElement('button');
      btn.className = 'choice-btn';
      btn.dataset.index = String(i);
      btn.textContent = c.text[lang] || c.text.en;
      this.choices.appendChild(btn);
    });
  },

  showEnding(kind, text) {
    this.endingScreen.classList.remove('hidden');
    this.endingTitle.textContent = kind === 'win' ? t('escaped') : t('busted');
    this.endingTitle.className = kind === 'win' ? 'win' : 'fail';
    this.endingText.textContent = text;
    this.btnRetry.textContent = kind === 'win' ? t('playAgain') : t('tryAgain');
    this.applyLang();
    this.endingText.textContent = text;
    this.btnRetry.textContent = kind === 'win' ? t('playAgain') : t('tryAgain');
  },
  hideEnding() { this.endingScreen.classList.add('hidden'); },

  updateHUD(state) {
    this.hudFails.textContent = `${t('fails')}: ${state.fails}`;
    this.hudEndings.textContent = `${t('endings')}: ${state.endings}/${state.totalEndings}`;
  },
  updateMute(muted) {
    this._muted = muted;
    this.btnMute.textContent = muted ? '🔇' : '🔊';
    this.btnMute.setAttribute('aria-label', `${t('sound')}: ${muted ? t('off') : t('on')}`);
  },
  updateBest(endings) {
    this.titleBest.textContent = endings > 0 ? `${t('endings')}: ${endings}/4` : '';
  },
};