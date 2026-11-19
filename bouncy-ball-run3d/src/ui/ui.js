// UI 模块：标题/暂停/结算/HUD/教程/竖屏提示 + 多语言（en/zh）。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';

const $ = (id) => document.getElementById(id);

export const ui = {
  titleScreen: $('screen-title'),
  pauseScreen: $('screen-pause'),
  resultScreen: $('screen-result'),
  hud: $('hud'),
  rotateScreen: $('rotate-screen'),

  titleText: $('title-text'),
  subtitleText: $('subtitle-text'),
  bestLine: $('best-line'),
  btnStart: $('btn-start'),

  pauseTitle: $('pause-title'),
  btnResume: $('btn-resume'),
  btnRestart2: $('btn-restart2'),
  btnHome3: $('btn-home3'),

  resultTitle: $('result-title'),
  resultStars: $('result-stars'),
  resultScore: $('result-score'),
  resultBest: $('result-best'),
  resultMeta: $('result-meta'),
  btnRetry: $('btn-retry'),
  btnHome2: $('btn-home2'),

  hudFloor: $('hud-floor'),
  hudTarget: $('hud-target'),
  hudBest: $('hud-best'),
  hudGems: $('hud-gems'),
  btnMute: $('btn-mute'),
  btnRestart: $('btn-restart'),
  btnHome: $('btn-home'),
  btnHowto: $('btn-howto'),

  rotateText: $('rotate-text'),
  rotatePlayAnyway: $('btn-rotate-skip'),

  tutorial: $('tutorial'),
  tutTitle: $('tut-title'),
  tutText: $('tut-text'),
  tutNext: $('tut-next'),
  tutSkip: $('tut-skip'),

  langSelects: [$('lang-select'), $('lang-select-pause')],

  get lang() { return i18n.lang; },
  get dir() { return i18n.dir; },

  applyLang() {
    syncDocumentLang();
    this.titleText.textContent = t('title');
    this.subtitleText.textContent = t('subtitle');
    this.btnStart.textContent = t('start');
    this.pauseTitle.textContent = t('paused');
    this.btnResume.textContent = t('resume');
    this.btnRestart2.textContent = t('restart');
    this.btnHome3.textContent = t('home2');
    this.btnRetry.textContent = t('retry');
    this.btnHome2.textContent = t('home2');
    this.btnHome.textContent = t('home');
    this.btnRestart.textContent = t('restart');
    this.btnHowto.textContent = t('howto');
    this.rotateText.textContent = t('rotateText');
    this.rotatePlayAnyway.textContent = t('playAnyway');
    this.tutNext.textContent = t('tutNext');
    this.tutSkip.textContent = t('tutSkip');
    for (const sel of this.langSelects) {
      if (sel) sel.setAttribute('aria-label', t('language'));
    }
    this.fillLangOptions();
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
  },

  show(screen) {
    for (const s of [this.titleScreen, this.pauseScreen, this.resultScreen]) {
      s.classList.add('hidden');
    }
    screen.classList.remove('hidden');
    this.applyLang();
  },

  showTitle() { this.show(this.titleScreen); this.hud.classList.add('hidden'); },
  showGame() {
    this.titleScreen.classList.add('hidden');
    this.pauseScreen.classList.add('hidden');
    this.resultScreen.classList.add('hidden');
    this.hud.classList.remove('hidden');
    this.applyLang();
  },
  showPause() { this.show(this.pauseScreen); },
  showResult(won, score, best, stars, gems, isNewBest) {
    this.show(this.resultScreen);
    this.resultTitle.textContent = won ? t('win') : t('gameOver');
    this.resultStars.textContent = '★'.repeat(stars) + '☆'.repeat(Math.max(0, 3 - stars));
    this.resultScore.textContent = `${t('score')} ${score}`;
    this.resultBest.textContent = `${t('best')} ${best}`;
    this.resultMeta.textContent = (isNewBest ? t('newBest') + ' · ' : '') + `${t('gems')} ${gems}`;
  },

  updateHUD(sim) {
    this.hudFloor.textContent = `${t('floor')} ${sim.state.floors}`;
    this.hudTarget.textContent = `▼ GOAL ${sim.state.targetFloors}`;
    this.hudGems.textContent = `◆ ${sim.state.gems}`;
  },

  updateBest(best) {
    this.bestLine.textContent = `${t('best')} ${best}`;
  },

  // 教程卡片
  showTutorial(title, text) {
    this.tutorial.classList.remove('hidden');
    this.tutTitle.textContent = title;
    this.tutText.textContent = text;
  },
  hideTutorial() {
    this.tutorial.classList.add('hidden');
  },
  setTutNext(label, isLast) {
    this.tutNext.textContent = label;
    this.tutNext.dataset.last = isLast ? '1' : '';
  },

  updateMuteLabel(muted) {
    this.btnMute.textContent = muted ? t('sound') : t('mute');
  },
};
