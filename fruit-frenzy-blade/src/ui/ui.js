// UI 模块：标题 / 暂停 / 结算 / HUD / 教程 / 竖屏提示 + 多语言。
// 只做 DOM 读写与文案刷新；状态机在 main.js。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';

const $ = (id) => document.getElementById(id);

export const ui = {
  // 画布与屏幕
  canvas: $('canvas'),
  hud: $('hud'),
  screenTitle: $('screen-title'),
  screenPause: $('screen-pause'),
  screenResult: $('screen-result'),
  rotateScreen: $('rotate-screen'),
  tutorial: $('tutorial'),

  // HUD
  hudScore: $('hud-score'),
  hudBest: $('hud-best'),
  hudWave: $('hud-wave'),
  hudLives: $('hud-lives'),
  comboWrap: $('combo-wrap'),
  comboCount: $('combo-count'),
  frenzyBanner: $('frenzy-banner'),
  hint: $('hint'),

  // 标题
  titleText: $('title-text'),
  subtitleText: $('subtitle-text'),
  bestValue: $('best-value'),
  btnStart: $('btn-start'),
  btnHowto: $('btn-howto'),

  // 暂停
  pauseTitle: $('pause-title'),
  btnResume: $('btn-resume'),
  btnRestart: $('btn-restart'),
  btnHome: $('btn-home'),

  // 结算
  resultTitle: $('result-title'),
  resultStars: $('result-stars'),
  resultScore: $('result-score'),
  resultMeta: $('result-meta'),
  btnRetry: $('btn-retry'),
  btnHome2: $('btn-home2'),

  // 杂项
  btnMute: $('btn-mute'),
  btnPause: $('btn-pause'),
  tutTitle: $('tut-title'),
  tutText: $('tut-text'),
  tutDots: $('tut-dots'),
  tutSkip: $('tut-skip'),
  tutNext: $('tut-next'),
  rotateText: $('rotate-text'),
  btnRotateSkip: $('btn-rotate-skip'),
  langSelects: [$('lang-select'), $('lang-select-pause')],

  lastHud: null,
  lastBest: 0,

  get lang() { return i18n.lang; },
  get dir() { return i18n.dir; },

  applyLang() {
    syncDocumentLang();
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    this.titleText.textContent = t('title');
    this.subtitleText.textContent = t('subtitle');
    this.btnStart.textContent = t('start');
    this.btnHowto.textContent = t('howTo');
    this.pauseTitle.textContent = t('paused');
    this.btnResume.textContent = t('resume');
    this.btnRestart.textContent = t('restart');
    this.btnHome.textContent = t('menu');
    this.btnHome2.textContent = t('menu');
    this.resultTitle.textContent = t('gameOver');
    this.btnRetry.textContent = t('retry');
    this.tutTitle.textContent = t('tutTitle');
    this.tutSkip.textContent = t('tutSkip');
    this.rotateText.textContent = t('rotateHint');
    this.btnRotateSkip.textContent = t('rotateSkip');
    for (const sel of this.langSelects) {
      if (sel) sel.setAttribute('aria-label', t('language'));
    }
    this.fillLangOptions();
    this.refreshBest(this.lastBest);
    if (this.lastHud) this.updateHUD(this.lastHud, this.lastBest);
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

  // ---------- 屏幕切换 ----------
  showScreen(name) {
    const screens = [this.screenTitle, this.screenPause, this.screenResult];
    const idx = { title: 0, pause: 1, result: 2 }[name];
    screens.forEach((s, i) => {
      const active = i === idx;
      s.classList.toggle('hidden', !active);
      s.classList.toggle('is-active', active && i === 0);
    });
    this.hud.classList.toggle('hidden', name !== 'playing');
  },

  showTitle() { this.showScreen('title'); this.applyLang(); },
  showGame() { this.showScreen('playing'); },
  showPause() { this.showScreen('pause'); this.applyLang(); },
  hidePause() { this.showScreen('playing'); },
  showResult(hud) {
    this.showScreen('result');
    const stars = hud?.stars ?? 0;
    this.resultStars.textContent = '★'.repeat(Math.max(0, stars)) + '☆'.repeat(Math.max(0, 3 - stars));
    this.applyLang();
    this.resultScore.textContent = `${t('score')}: ${hud?.score ?? 0}`;
    this.resultMeta.textContent = `${t('wave')} ${hud?.wave ?? 1} · ${t('combo')} ×${hud?.maxCombo ?? 0}`;
  },

  // ---------- HUD ----------
  refreshBest(best) {
    this.lastBest = best || 0;
    this.bestValue.textContent = String(this.lastBest);
    this.hudBest.textContent = String(this.lastBest);
  },

  updateHUD(hud, best) {
    if (!hud) return;
    this.lastHud = hud;
    this.refreshBest(best ?? this.lastBest);
    this.hudScore.textContent = String(hud.score);
    this.hudWave.textContent = String(hud.wave);

    // 生命（红心）
    let hearts = '';
    for (let i = 0; i < 3; i += 1) {
      hearts += i < hud.lives ? '<span class="heart on">♥</span>' : '<span class="heart off">♡</span>';
    }
    this.hudLives.innerHTML = hearts;

    // 连击
    if (hud.combo >= 2) {
      this.comboWrap.classList.remove('hidden');
      this.comboCount.textContent = `×${hud.combo}`;
    } else {
      this.comboWrap.classList.add('hidden');
    }

    // 暴走横幅
    this.frenzyBanner.classList.toggle('hidden', !hud.frenzy);
  },

  // ---------- 教程 ----------
  setTutorialStep(step, total) {
    const key = `tutStep${step + 1}`;
    this.tutText.textContent = t(key);
    let dots = '';
    for (let i = 0; i < total; i += 1) dots += i === step ? '<span class="dot on"></span>' : '<span class="dot"></span>';
    this.tutDots.innerHTML = dots;
    this.tutNext.textContent = step >= total - 1 ? t('start') : t('tutNext');
  },

  showTutorial(step, total) {
    this.tutorial.classList.remove('hidden');
    this.setTutorialStep(step, total);
  },

  hideTutorial() {
    this.tutorial.classList.add('hidden');
  },

  // ---------- 局内提示 ----------
  showHint() {
    this.hint.classList.remove('hidden');
  },

  hideHint() {
    this.hint.classList.add('hidden');
  },
};
