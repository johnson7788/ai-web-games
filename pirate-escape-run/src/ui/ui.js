// UI 模块：标题/暂停/结算/复活/HUD + 多语言 + 教程文案。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';

const $ = (id) => document.getElementById(id);

export const ui = {
  // 屏幕
  titleScreen: $('screen-title'),
  pauseScreen: $('screen-pause'),
  resultScreen: $('screen-result'),
  reviveScreen: $('screen-revive'),
  hud: $('hud'),
  tutorial: $('tutorial'),
  rotateScreen: $('rotate-screen'),

  // 文案节点
  titleText: $('title-text'),
  subtitleText: $('subtitle-text'),
  pauseTitle: $('pause-title'),
  btnStart: $('btn-start'),
  btnResume: $('btn-resume'),
  btnRetry: $('btn-retry'),
  btnHome: $('btn-home'),
  btnHomePause: $('btn-restart'),
  btnHowto: $('btn-howto'),
  btnHowtoPause: $('btn-howto-pause'),
  btnRevive: $('btn-revive'),
  btnReviveNo: $('btn-revive-no'),
  btnMute: $('btn-mute'),
  btnPause: $('btn-pause'),
  resultTitle: $('result-title'),
  resultStars: $('result-stars'),
  resultScore: $('result-score'),
  resultMeta: $('result-meta'),
  reviveTitle: $('revive-title'),
  reviveText: $('revive-text'),
  starsTotal: $('stars-total'),
  rotateText: $('rotate-text'),
  btnRotateSkip: $('btn-rotate-skip'),
  tutTitle: $('tut-title'),
  tutText: $('tut-text'),
  tutNext: $('tut-next'),
  tutSkip: $('tut-skip'),
  hudScore: $('hud-score'),
  hudBest: $('hud-best'),
  hudCoins: $('hud-coins'),
  hudStars: $('hud-stars'),
  hudCombo: $('hud-combo'),
  langSelects: [$('lang-select'), $('lang-select-pause')],
  lastHud: null,
  lastBest: 0,

  get lang() { return i18n.lang; },
  get dir() { return i18n.dir; },

  applyLang() {
    syncDocumentLang();
    this.titleText.textContent = t('title');
    this.subtitleText.textContent = t('subtitle');
    this.btnStart.textContent = t('start');
    this.btnResume.textContent = t('resume');
    this.pauseTitle.textContent = t('paused');
    this.btnRetry.textContent = t('retry');
    this.btnHome.textContent = t('home');
    this.btnHomePause.textContent = t('home');
    this.btnHowto.textContent = t('howto');
    this.btnHowtoPause.textContent = t('howto');
    this.btnRevive.textContent = t('reviveYes');
    this.btnReviveNo.textContent = t('noThanks');
    this.resultTitle.textContent = t('gameOver');
    this.reviveTitle.textContent = t('revive');
    this.reviveText.textContent = t('reviveQuestion');
    this.rotateText.textContent = t('rotate');
    this.btnRotateSkip.textContent = t('rotateSkip');
    this.btnMute.setAttribute('aria-label', t('mute'));
    this.tutSkip.textContent = t('skip');
    this.tutNext.textContent = t('next');
    for (const sel of this.langSelects) {
      if (sel) sel.setAttribute('aria-label', t('language'));
    }
    this.fillLangOptions();
    if (this.lastHud) this.updateHUD(this.lastHud, this.lastBest);
    this.updateStarsTotal(this.starsCount ?? 0, this.coinsCount ?? 0);
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

  setMuted(muted) {
    this.btnMute.textContent = muted ? '✕' : '♪';
  },

  // 屏幕显隐
  showTitle() {
    this.titleScreen.classList.remove('hidden');
    this.titleScreen.classList.add('is-active');
    this.pauseScreen.classList.add('hidden');
    this.resultScreen.classList.add('hidden');
    this.reviveScreen.classList.add('hidden');
    this.hud.classList.add('hidden');
    this.applyLang();
  },
  showGame() {
    this.titleScreen.classList.add('hidden');
    this.titleScreen.classList.remove('is-active');
    this.pauseScreen.classList.add('hidden');
    this.resultScreen.classList.add('hidden');
    this.reviveScreen.classList.add('hidden');
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
    this.reviveScreen.classList.add('hidden');
    this.hud.classList.add('hidden');
  },
  showRevive() {
    this.reviveScreen.classList.remove('hidden');
    this.hud.classList.add('hidden');
  },
  hideRevive() {
    this.reviveScreen.classList.add('hidden');
  },

  // HUD
  updateHUD(hud, best) {
    this.lastHud = hud;
    this.lastBest = best;
    this.hudScore.textContent = `${hud.score}${t('m')}`;
    this.hudBest.textContent = `${t('best')} ${best}${t('m')}`;
    this.hudCoins.textContent = `$ ${hud.coins}`;
    this.hudStars.textContent = `★ ${hud.starGems}`;
    if (hud.combo >= 2) {
      this.hudCombo.classList.remove('hidden');
      this.hudCombo.textContent = `${t('combo')} ×${hud.combo}`;
    } else {
      this.hudCombo.classList.add('hidden');
    }
  },

  updateStarsTotal(count, coins) {
    this.starsCount = count;
    this.coinsCount = coins;
    this.starsTotal.textContent = `★ ${count}   $ ${coins}`;
  },

  // 结算：rating 1–3 星
  renderResult({ score, best, coins, starGems, rating, newBest }) {
    const filled = '★'.repeat(rating) + '☆'.repeat(Math.max(0, 3 - rating));
    this.resultStars.textContent = filled;
    this.resultScore.textContent = `${t('resultScore')} ${score}${t('m')}`;
    this.resultMeta.textContent = `${t('resultBest')} ${best}${t('m')}\n${t('resultCoins')} +${coins}   ★ +${starGems}${newBest ? `\n${t('newBest')}` : ''}`;
    this.showResult();
  },

  // 教程文案
  tutorialSteps() {
    return [
      { title: t('tut1_title'), text: t('tut1_text') },
      { title: t('tut2_title'), text: t('tut2_text') },
      { title: t('tut3_title'), text: t('tut3_text') },
    ];
  },
  setTutorialStep(step) {
    const steps = this.tutorialSteps();
    const s = steps[step] || steps[0];
    this.tutTitle.textContent = s.title;
    this.tutText.textContent = s.text;
    this.tutNext.textContent = step >= steps.length - 1 ? t('start') : t('next');
  },
  showTutorial() {
    this.tutorial.classList.remove('hidden');
  },
  hideTutorial() {
    this.tutorial.classList.add('hidden');
  },
};

export default ui;
