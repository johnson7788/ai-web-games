// MR HAT ESCAPE · DOM UI：标题/暂停/结算/HUD/关卡格/教程卡片 + 多语言刷新。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';

const $ = (id) => document.getElementById(id);

export const ui = {
  canvas: $('canvas'),
  hud: $('hud'),
  hudLevel: $('hud-level'),
  hudStars: $('hud-stars'),
  hudCombo: $('hud-combo'),
  hudTime: $('hud-time'),
  btnHold: $('btn-hold'),
  btnHold2: $('btn-hold2'),
  btnMute: $('btn-mute'),
  btnRestart: $('btn-restart'),
  btnHome: $('btn-home'),
  btnHowto: $('btn-howto'),

  titleScreen: $('screen-title'),
  pauseScreen: $('screen-pause'),
  resultScreen: $('screen-result'),
  titleText: $('title-text'),
  subtitleText: $('subtitle-text'),
  goalText: $('goal-text'),
  btnStart: $('btn-start'),
  levelGrid: $('level-grid'),
  langSelects: [$('lang-select'), $('lang-select-pause')],

  pauseTitle: $('pause-title'),
  btnResume: $('btn-resume'),
  btnRestart2: $('btn-restart2'),
  btnTutReplay: $('btn-tut-replay'),
  btnHome3: $('btn-home3'),

  resultTitle: $('result-title'),
  resultStars: $('result-stars'),
  resultMeta: $('result-meta'),
  btnRetry: $('btn-retry'),
  btnNext: $('btn-next'),
  btnHome2: $('btn-home2'),

  rotateScreen: $('rotate-screen'),
  rotateText: $('rotate-text'),
  touchControls: $('touch-controls'),
  btnLeft: $('btn-left'),
  btnRight: $('btn-right'),
  btnJump: $('btn-jump'),

  tutorialRoot: $('tutorial'),
  tutTitle: $('tut-title'),
  tutText: $('tut-text'),
  tutNext: $('tut-next'),
  tutSkip: $('tut-skip'),

  get lang() { return i18n.lang; },
  get dir() { return i18n.dir; },

  applyLang() {
    syncDocumentLang();
    this.titleText.textContent = t('title');
    this.subtitleText.textContent = t('subtitle');
    this.goalText.textContent = t('goal');
    this.btnStart.textContent = t('start');
    this.pauseTitle.textContent = t('paused');
    this.btnResume.textContent = t('resume');
    this.btnRestart.textContent = t('restart');
    this.btnRestart2.textContent = t('restart');
    this.btnRetry.textContent = t('retry');
    this.btnNext.textContent = t('next');
    this.btnHome.textContent = t('menu');
    this.btnHome2.textContent = t('menu');
    this.btnHome3.textContent = t('menu');
    this.btnHowto.textContent = '?';
    this.btnHold.textContent = t('key');
    this.btnHold2.textContent = t('key');
    this.btnTutReplay.textContent = t('howto');
    this.rotateText.textContent = t('rotateText');
    this.btnMute.textContent = '🔊';
    for (const sel of this.langSelects) if (sel) sel.setAttribute('aria-label', t('language'));
    this.fillLangOptions();
    this.renderTutorialLabel();
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

  renderTutorialLabel() {
    this.tutNext.textContent = t('gotIt');
    this.tutSkip.textContent = t('skip');
  },

  showTitle() {
    this.titleScreen.classList.remove('hidden');
    this.titleScreen.classList.add('is-active');
    this.pauseScreen.classList.add('hidden');
    this.resultScreen.classList.add('hidden');
    this.hud.classList.add('hidden');
    this.touchControls.classList.add('hidden');
    this.applyLang();
  },

  showGame() {
    this.titleScreen.classList.add('hidden');
    this.titleScreen.classList.remove('is-active');
    this.pauseScreen.classList.add('hidden');
    this.resultScreen.classList.add('hidden');
    this.hud.classList.remove('hidden');
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) {
      this.touchControls.classList.remove('hidden');
    }
  },

  showPause() {
    this.pauseScreen.classList.remove('hidden');
    this.applyLang();
  },

  hidePause() {
    this.pauseScreen.classList.add('hidden');
  },

  showResult(win, meta) {
    this.titleScreen.classList.add('hidden');
    this.pauseScreen.classList.add('hidden');
    this.resultScreen.classList.remove('hidden');
    this.resultTitle.textContent = win ? t('resultWin') : t('resultLose');
    const n = meta.starsEarned || 0;
    const total = meta.starsTotal || 0;
    let stars = '';
    for (let i = 0; i < total; i += 1) stars += i < n ? '★' : '☆';
    this.resultStars.textContent = stars;
    this.resultMeta.textContent = `${t('level')} ${meta.level} · ${t('time')} ${Math.round(meta.time)}s`;
    this.btnNext.classList.toggle('hidden', meta.isLast === true || !win);
  },

  hideResult() {
    this.resultScreen.classList.add('hidden');
  },

  updateHUD(s) {
    this.hudLevel.textContent = `${t('level')} ${s.level}`;
    this.hudStars.textContent = `★ ${s.starsCollected}/${s.starsTotal}`;
    this.hudCombo.textContent = s.combo >= 2 ? `${t('combo')} ×${s.combo}` : '';
    this.hudTime.textContent = `${t('time')} ${Math.floor(s.time)}s`;
  },

  renderLevelGrid(onPick, passedCount) {
    this.levelGrid.innerHTML = '';
    for (let i = 1; i <= 11; i += 1) {
      const b = document.createElement('button');
      b.className = 'level-cell';
      b.textContent = String(i);
      if (i > passedCount + 1) {
        b.classList.add('locked');
        b.disabled = true;
      } else {
        b.addEventListener('click', () => onPick(i - 1));
      }
      this.levelGrid.appendChild(b);
    }
  },

  setHoldVisible(vis) {
    this.btnHold.classList.toggle('hidden', !vis);
    this.btnHold2.classList.toggle('hidden', !vis);
  },

  setMuteIcon(muted) {
    this.btnMute.textContent = muted ? '🔇' : '🔊';
  },

  showTutorialStep(stepIndex) {
    this.tutorialRoot.classList.remove('hidden');
    this.tutTitle.textContent = t(`tut${stepIndex}Title`);
    this.tutText.textContent = t(`tut${stepIndex}Text`);
  },

  hideTutorial() {
    this.tutorialRoot.classList.add('hidden');
  },
};
