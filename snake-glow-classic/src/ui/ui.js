// src/ui/ui.js — DOM UI：HUD / 屏幕 / 教程层 / 竖屏提示。
// 所有可见文案经 applyLang() 刷新；不持有游戏状态，只负责显示。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';

const $ = (id) => document.getElementById(id);

export const ui = {
  // 屏幕
  titleScreen: $('screen-title'),
  pauseScreen: $('screen-pause'),
  resultScreen: $('screen-result'),
  hud: $('hud'),
  tutorial: $('tutorial'),
  rotate: $('rotate-screen'),

  // HUD
  hudScore: $('hud-score'),
  hudLength: $('hud-length'),
  hudTime: $('hud-time'),
  hudStage: $('hud-stage'),
  hudCombo: $('hud-combo'),
  hudEnergyFill: $('hud-energy-fill'),
  hudBoostHint: $('hud-boost-hint'),
  btnBoost: $('btn-boost'),
  btnMute: $('btn-mute'),

  // 标题
  titleText: $('title-text'),
  subtitleText: $('subtitle-text'),
  tapToPlay: $('tap-to-play'),
  btnStart: $('btn-start'),
  btnHowto: $('btn-howto'),

  // 暂停
  pauseTitle: $('pause-title'),
  btnResume: $('btn-resume'),

  // 结算
  resultTitle: $('result-title'),
  resultStars: $('result-stars'),
  resultScoreLabel: $('result-score-label'),
  resultScore: $('result-score'),
  resultLengthLabel: $('result-length-label'),
  resultLength: $('result-length'),
  resultBest: $('result-best'),
  btnRetry: $('btn-retry'),

  // 教程
  tutTitle: $('tut-title'),
  tutText: $('tut-text'),
  tutCard: $('tut-card'),
  tutSpotlight: $('tut-spotlight'),
  tutSkip: $('tut-skip'),
  tutNext: $('tut-next'),

  // 竖屏
  rotateText: $('rotate-text'),

  langSelects: [],
  muted: false,

  get lang() { return i18n.lang; },
  get dir() { return i18n.dir; },

  init() {
    this.langSelects = [$('lang-select'), $('lang-select-pause')].filter(Boolean);
    for (const sel of this.langSelects) {
      sel.innerHTML = '';
      for (const item of i18n.options()) {
        const opt = document.createElement('option');
        opt.value = item.code;
        opt.textContent = item.name;
        if (item.code === i18n.lang) opt.selected = true;
        sel.appendChild(opt);
      }
    }
    this.applyLang();
  },

  applyLang() {
    syncDocumentLang();
    this.titleText.textContent = t('title');
    this.subtitleText.textContent = t('subtitle');
    this.tapToPlay.textContent = t('tapToPlay');
    this.btnStart.textContent = t('start');
    this.btnHowto.textContent = t('howto');
    this.pauseTitle.textContent = t('paused');
    this.btnResume.textContent = t('resume');
    $('btn-restart2').textContent = t('restart');
    $('btn-replay-pause').textContent = t('howto');
    $('btn-home3').textContent = t('menu');
    this.resultScoreLabel.textContent = t('resultScore');
    this.resultLengthLabel.textContent = t('resultLength');
    this.btnRetry.textContent = t('retry');
    $('btn-home2').textContent = t('menu');
    this.rotateText.textContent = t('rotateText');
    $('btn-rotate-skip').textContent = t('playAnyway');
    this.tutSkip.textContent = t('skip');
    this.tutNext.textContent = t('gotIt');
    for (const sel of this.langSelects) sel.setAttribute('aria-label', t('language'));
    this.setMuteLabel(this.muted);
    this.fillLangOptions();
  },

  fillLangOptions() {
    for (const sel of this.langSelects) {
      if (!sel) continue;
      const prev = sel.value || i18n.lang;
      sel.innerHTML = '';
      for (const item of i18n.options()) {
        const opt = document.createElement('option');
        opt.value = item.code;
        opt.textContent = item.name;
        if (item.code === prev) opt.selected = true;
        sel.appendChild(opt);
      }
    }
  },

  setLang(lang) {
    i18n.setLang(lang);
    this.applyLang();
    return i18n.lang;
  },

  setMuteLabel(muted) {
    this.muted = muted;
    this.btnMute.textContent = muted ? '🔇' : '🔊';
  },

  show(el) { if (el) el.classList.remove('hidden'); },
  hide(el) { if (el) el.classList.add('hidden'); },

  showTitle() {
    this.show(this.titleScreen);
    this.hide(this.pauseScreen);
    this.hide(this.resultScreen);
    this.hide(this.hud);
    this.hide(this.tutorial);
    this.applyLang();
  },

  showGame() {
    this.hide(this.titleScreen);
    this.hide(this.pauseScreen);
    this.hide(this.resultScreen);
    this.show(this.hud);
  },

  showPause() {
    this.show(this.pauseScreen);
    this.applyLang();
  },

  hidePause() {
    this.hide(this.pauseScreen);
  },

  showResult(result) {
    this.hide(this.titleScreen);
    this.hide(this.pauseScreen);
    this.show(this.resultScreen);
    this.show(this.hud);
    this.hide(this.tutorial);
    this.resultTitle.textContent = result.win ? t('resultWin') : t('resultLose');
    this.resultStars.textContent = '★'.repeat(result.stars) + '☆'.repeat(Math.max(0, 3 - result.stars));
    this.resultScore.textContent = String(result.score);
    this.resultLength.textContent = String(result.length);
    this.resultBest.textContent = result.newBest ? t('newBest') : `${t('best')} ${result.best}`;
  },

  updateHUD(hud, best) {
    this.hudScore.textContent = `${t('score')} ${hud.score}`;
    this.hudLength.textContent = `${t('length')} ${hud.length}`;
    this.hudTime.textContent = `${t('time')} ${Math.ceil(hud.timeLeft)}s`;
    this.hudStage.textContent = t(`stage${hud.stage}`);
    this.hudCombo.textContent = hud.combo >= 2 ? `${t('combo')} ×${hud.combo}` : '';
    this.hudCombo.classList.toggle('active', hud.combo >= 2);
    this.hudEnergyFill.style.width = `${Math.max(0, Math.min(100, hud.energy))}%`;
    this.btnBoost.classList.toggle('boosting', !!hud.boosting);
    this.hudBoostHint.textContent = hud.boosting ? t('boost') : '';
    if (best != null) {
      // best 显示在标题屏，不占 HUD 空间
    }
  },

  // 教程层
  showTutorial(stepId, stepIndex, total) {
    this.show(this.tutorial);
    const titleKey = `tut_${stepId}_title`;
    const bodyKey = `tut_${stepId}_body`;
    this.tutTitle.textContent = t(titleKey);
    this.tutText.textContent = t(bodyKey);
    this.tutCard.dataset.step = String(stepIndex + 1);
    this.tutCard.dataset.total = String(total);
  },

  hideTutorial() {
    this.hide(this.tutorial);
  },

  // 把聚光灯套到给定像素区域（container 本地 1280×720 坐标，整体随 stage 缩放）
  positionSpotlight(rect) {
    this.tutSpotlight.style.left = `${rect.x}px`;
    this.tutSpotlight.style.top = `${rect.y}px`;
    this.tutSpotlight.style.width = `${rect.w}px`;
    this.tutSpotlight.style.height = `${rect.h}px`;
  },

  showRotateHint() {
    this.show(this.rotate);
  },
  hideRotateHint() {
    this.hide(this.rotate);
  },
};
