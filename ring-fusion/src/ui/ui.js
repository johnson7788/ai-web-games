// UI 模块：标题 / HUD / 暂停 / 结算 / 教程 / 竖屏提示 + 多语言刷新。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';

const $ = (id) => document.getElementById(id);

export const ui = {
  hud: $('hud'),
  hudLevel: $('hud-level'),
  hudProgress: $('hud-progress'),
  hudTime: $('hud-time'),
  hudScore: $('hud-score'),
  hudBest: $('hud-best'),
  hudCombo: $('hud-combo'),
  hudBurstFill: $('hud-burst-fill'),
  hudBurstLabel: $('hud-burst-label'),
  btnBurst: $('btn-burst'),
  btnHudHowto: $('btn-howto'),
  btnMute: $('btn-mute'),
  btnPause: $('btn-pause'),

  titleScreen: $('screen-title'),
  titleText: $('title-text'),
  subtitleText: $('subtitle-text'),
  btnStart: $('btn-start'),
  btnTime: $('btn-time'),
  btnHowto: $('btn-howto-title'),
  langSelects: [$('lang-select'), $('lang-select-pause')],

  pauseScreen: $('screen-pause'),
  pauseTitle: $('pause-title'),
  btnResume: $('btn-resume'),
  btnRestart2: $('btn-restart2'),
  btnHome3: $('btn-home3'),

  resultScreen: $('screen-result'),
  resultTitle: $('result-title'),
  resultStars: $('result-stars'),
  resultMeta: $('result-meta'),
  btnRetry: $('btn-retry'),
  btnNext: $('btn-next'),
  btnHome2: $('btn-home2'),

  rotateText: $('rotate-text'),
  btnRotateSkip: $('btn-rotate-skip'),

  tutorialEl: $('tutorial'),
  tutSpotlight: $('tut-spotlight'),
  tutCard: $('tut-card'),
  tutTitle: $('tut-title'),
  tutText: $('tut-text'),
  tutSkip: $('tut-skip'),
  tutNext: $('tut-next'),

  lastHud: null,
  muteIcon: '🔊',

  get lang() { return i18n.lang; },
  get dir() { return i18n.dir; },

  applyLang() {
    syncDocumentLang();
    this.titleText.textContent = t('title');
    this.subtitleText.textContent = t('subtitle');
    this.btnStart.textContent = t('start');
    this.btnTime.textContent = t('timeMode');
    this.btnHowto.textContent = t('howto');
    this.pauseTitle.textContent = t('paused');
    this.btnResume.textContent = t('resume');
    this.btnRestart2.textContent = t('restart');
    this.btnHome3.textContent = t('menu');
    this.btnRetry.textContent = t('retry');
    this.btnNext.textContent = t('nextLevel');
    this.btnHome2.textContent = t('menu');
    this.rotateText.textContent = t('rotateText');
    this.btnRotateSkip.textContent = t('playAnyway');
    this.tutTitle.textContent = t('tutTitle');
    this.tutSkip.textContent = t('tutSkip');
    this.tutNext.textContent = t('tutNext');
    this.hudBurstLabel.textContent = t('burst');
    this.btnBurst.textContent = t('burst');
    this.btnHudHowto.textContent = '?';
    this.btnHudHowto.setAttribute('aria-label', t('howto'));
    this.btnMute.textContent = this.muteIcon;
    this.btnMute.setAttribute('aria-label', this.muteIcon === '🔊' ? t('mute') : t('unmute'));
    for (const sel of this.langSelects) {
      if (sel) sel.setAttribute('aria-label', t('howto') + ' / Language');
    }
    this.fillLangOptions();
    if (this.lastHud) this.updateHUD(this.lastHud);
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
    this.tutorialEl.classList.add('hidden');
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

  showResult({ won, stars, score, combo, isNewBest, timeLeft }) {
    this.resultScreen.classList.remove('hidden');
    this.resultTitle.textContent = won ? t('resultWin') : (timeLeft === 0 ? t('resultTimeUp') : t('resultLose'));
    let starHtml = '';
    for (let i = 1; i <= 3; i += 1) {
      starHtml += `<span class="star ${i <= stars ? 'star-on' : ''}">★</span>`;
    }
    this.resultStars.innerHTML = starHtml;
    this.resultMeta.innerHTML =
      `${t('score')}: <b>${score}</b> · ${t('combo')}: ×${combo}` + (isNewBest ? ` · <b>${t('newRecord')}</b>` : '');
    this.btnNext.classList.toggle('hidden', !won);
    this.applyLang();
  },

  hideResult() {
    this.resultScreen.classList.add('hidden');
  },

  updateHUD(s) {
    this.lastHud = s;
    if (!s) return;
    if (s.mode === 'time') {
      this.hudLevel.textContent = `${t('timeMode')} · ${t('timeGoal')}`;
      this.hudTime.classList.remove('hidden');
      this.hudTime.textContent = `⏱ ${t('time')}: ${Math.ceil(Math.max(0, s.timeLeft))}`;
      this.hudProgress.textContent = '';
    } else {
      this.hudLevel.textContent = `${t('level')} ${s.levelIndex + 1}`;
      this.hudTime.classList.add('hidden');
      this.hudProgress.textContent = `${t('cleared')}: ${s.cleared}/${s.target}`;
    }
    this.hudScore.textContent = `${t('score')}: ${s.score}`;
    this.hudBest.textContent = `${t('best')}: ${s.best}`;
    if (s.combo >= 2) {
      this.hudCombo.classList.remove('hidden');
      this.hudCombo.textContent = `×${s.combo}`;
    } else {
      this.hudCombo.classList.add('hidden');
    }
    const pct = Math.min(100, Math.round((s.burstMeter / (s.burstNeed || 1)) * 100));
    this.hudBurstFill.style.width = `${pct}%`;
    this.btnBurst.classList.toggle('ready', !!s.burstReady);
    this.btnBurst.textContent = s.burstReady ? t('burstReadyHint') : `${t('burst')} ${pct}%`;
  },

  setMuted(muted) {
    this.muteIcon = muted ? '🔇' : '🔊';
    this.btnMute.textContent = this.muteIcon;
  },
};
