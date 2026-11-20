// UI 模块：DOM 引用 + 语言切换 + 屏幕显隐（动态 HUD/结算由 main.js 直写）
import { i18n, t, syncDocumentLang } from '../core/i18n.js';

const $ = (id) => document.getElementById(id);

export const ui = {
  canvas: $('canvas'),
  hud: $('hud'),
  actionMenu: $('action-menu'),
  btnChi: $('btn-chi'),
  btnPeng: $('btn-peng'),
  btnGang: $('btn-gang'),
  btnHu: $('btn-hu'),
  btnPass: $('btn-pass'),

  titleScreen: $('screen-title'),
  pauseScreen: $('screen-pause'),
  resultScreen: $('screen-result'),

  titleText: $('title-text'),
  subtitleText: $('subtitle-text'),
  titleGoal: $('title-goal'),
  starsTotal: $('stars-total'),
  btnStart: $('btn-start'),
  btnHowtoTitle: $('btn-howto-title'),
  pauseTitle: $('pause-title'),
  btnResume: $('btn-resume'),
  btnRestart2: $('btn-restart2'),
  btnTutReplay: $('btn-tut-replay'),
  btnHome3: $('btn-home3'),
  resultTitle: $('result-title'),
  resultStars: $('result-stars'),
  resultMeta: $('result-meta'),
  btnRetry: $('btn-retry'),
  btnHome2: $('btn-home2'),

  hudRound: $('hud-round'),
  hudStreak: $('hud-streak'),
  hudCoins: $('hud-coins'),
  hudWall: $('hud-wall'),
  hudListen: $('hud-listen'),
  hudGoal: $('hud-goal'),
  hudJoker: $('hud-joker'),
  btnHint: $('btn-hint'),
  btnRejoker: $('btn-rejoker'),
  btnBackdraw: $('btn-backdraw'),
  btnHowto: $('btn-howto'),
  btnMute: $('btn-mute'),
  btnRestart: $('btn-restart'),
  btnHome: $('btn-home'),

  tut: $('tutorial'),
  tutSpot: $('tut-spotlight'),
  tutCard: $('tut-card'),
  tutTitle: $('tut-title'),
  tutText: $('tut-text'),
  tutSkip: $('tut-skip'),
  tutNext: $('tut-next'),

  rotateText: $('rotate-text'),
  btnRotateSkip: $('btn-rotate-skip'),

  langSelects: [$('lang-select'), $('lang-select-pause')],

  get lang() {
    return i18n.lang;
  },

  applyLang() {
    syncDocumentLang();
    this.titleText.textContent = t('title');
    this.subtitleText.textContent = t('subtitle');
    this.titleGoal.textContent = t('goal');
    this.hudGoal.textContent = t('goal');
    this.btnStart.textContent = t('start');
    this.btnHowtoTitle.textContent = t('howToPlay');
    this.pauseTitle.textContent = t('paused');
    this.btnResume.textContent = t('resume');
    this.btnRestart2.textContent = t('restart');
    this.btnTutReplay.textContent = t('replayGuide');
    this.btnHome3.textContent = t('menu');
    this.btnRetry.textContent = t('retry');
    this.btnHome2.textContent = t('menu');
    this.btnHint.title = `${t('hint')} · 10`;
    this.btnRejoker.title = `${t('reJoker')} · 30`;
    this.btnBackdraw.title = `${t('backDraw')} · 20`;
    this.btnHowto.title = t('howToPlay');
    this.btnMute.title = t('mute');
    this.btnRestart.title = t('restart');
    this.btnHome.title = t('menu');
    this.tutTitle.textContent = t('tutTitle');
    this.tutSkip.textContent = t('tutSkip');
    this.tutNext.textContent = t('tutNext');
    this.rotateText.textContent = t('rotateHint');
    this.btnRotateSkip.textContent = t('rotateSkip');
    this.btnChi.textContent = t('chi');
    this.btnPeng.textContent = t('peng');
    this.btnGang.textContent = t('gang');
    this.btnHu.textContent = t('hu');
    this.btnPass.textContent = t('pass');
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
    return i18n.lang;
  },

  showTitle() {
    this.titleScreen.classList.remove('hidden');
    this.titleScreen.classList.add('is-active');
    this.pauseScreen.classList.add('hidden');
    this.resultScreen.classList.add('hidden');
    this.hud.classList.add('hidden');
    this.actionMenu.classList.add('hidden');
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

  hideActionMenu() {
    this.actionMenu.classList.add('hidden');
    this.btnChi.classList.add('hidden');
    this.btnPeng.classList.add('hidden');
    this.btnGang.classList.add('hidden');
    this.btnHu.classList.add('hidden');
    this.btnPass.classList.add('hidden');
  },

  setMuted(m) {
    this.btnMute.classList.toggle('is-muted', m);
    this.btnMute.textContent = m ? '🔇' : '🔊';
  },
};
