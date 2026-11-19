// UI 模块：标题/暂停/结算/升级/HUD/教程 + 多语言下拉
import { i18n, t, syncDocumentLang } from '../core/i18n.js';

const $ = (id) => document.getElementById(id);

export const ui = {
  canvas: $('canvas'),
  hud: $('hud'),
  hudLevel: $('hud-level'),
  hudTargets: $('hud-targets'),
  hudScore: $('hud-score'),
  hudCombo: $('hud-combo'),
  hudHpLabel: $('hud-hp-label'),
  hudHpFill: $('hud-hp-fill'),
  btnMute: $('btn-mute'),
  titleScreen: $('screen-title'),
  titleText: $('title-text'),
  subtitleText: $('subtitle-text'),
  starsTotal: $('stars-total'),
  btnStart: $('btn-start'),
  pauseScreen: $('screen-pause'),
  pauseTitle: $('pause-title'),
  btnResume: $('btn-resume'),
  resultScreen: $('screen-result'),
  resultTitle: $('result-title'),
  resultStars: $('result-stars'),
  resultMeta: $('result-meta'),
  btnRetry: $('btn-retry'),
  btnNext: $('btn-next'),
  upgradeScreen: $('screen-upgrade'),
  upgradeTitle: $('upgrade-title'),
  upgradeHint: $('upgrade-hint'),
  upgradeCards: $('upgrade-cards'),
  rotateScreen: $('rotate-screen'),
  rotateText: $('rotate-text'),
  joy: $('joy'),
  joyKnob: $('joy').querySelector('.knob'),
  tutorial: $('tutorial'),
  tutTitle: $('tut-title'),
  tutText: $('tut-text'),
  tutNext: $('tut-next'),
  langSelects: [$('lang-select'), $('lang-select-pause')],
  lastHud: null,
  muted: false,

  get lang() { return i18n.lang; },
  get dir() { return i18n.dir; },

  applyLang() {
    syncDocumentLang();
    this.titleText.textContent = t('title');
    this.subtitleText.textContent = t('subtitle');
    this.btnStart.textContent = t('start');
    this.pauseTitle.textContent = t('paused');
    this.btnResume.textContent = t('resume');
    this.upgradeTitle.textContent = t('upgradeTitle');
    this.upgradeHint.textContent = t('upgradeHint');
    this.rotateText.textContent = t('rotateText');
    document.getElementById('btn-rotate-skip').textContent = t('playAnyway');
    document.getElementById('btn-restart').setAttribute('aria-label', t('restart'));
    document.getElementById('btn-restart2').textContent = t('restart');
    document.getElementById('btn-tut-replay').textContent = t('howto');
    document.getElementById('btn-home2').textContent = t('menu');
    document.getElementById('btn-home3').textContent = t('menu');
    document.getElementById('btn-retry').textContent = t('retry');
    document.getElementById('btn-next').textContent = t('next');
    document.getElementById('btn-howto-title').textContent = t('howto');
    document.getElementById('tut-skip').textContent = t('tutorialSkip');
    this.tutNext.textContent = t('tutorialNext');
    this.tutTitle.textContent = t('tutorialTitle');
    for (const sel of this.langSelects) {
      if (sel) sel.setAttribute('aria-label', t('language'));
    }
    this.fillLangOptions();
    if (this.lastHud) this.updateHUD(this.lastHud);
    this.renderMuteBtn();
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

  renderMuteBtn() {
    this.btnMute.textContent = this.muted ? '🔇' : '🔊';
  },

  showTitle(totalStars) {
    this.hideAll();
    this.titleScreen.classList.remove('hidden');
    this.titleScreen.classList.add('is-active');
    this.starsTotal.textContent = totalStars > 0 ? `★ ${totalStars}` : '';
    this.applyLang();
  },

  showGame() {
    this.hideAll();
    this.hud.classList.remove('hidden');
  },

  showPause() {
    this.pauseScreen.classList.remove('hidden');
    this.applyLang();
  },

  hidePause() {
    this.pauseScreen.classList.add('hidden');
  },

  showResult({ won, stars, score, best, meta }) {
    this.hideAll();
    this.resultScreen.classList.remove('hidden');
    this.resultTitle.textContent = won ? t('winTitle') : t('loseTitle');
    this.resultStars.textContent = '★'.repeat(stars) + '☆'.repeat(Math.max(0, 3 - stars));
    this.resultMeta.textContent = `${t('scoreLabel')}: ${score}   ·   ${t('bestLabel')}: ${best}`;
    this.btnNext.classList.add('hidden');
    this.applyLang();
  },

  showUpgrade(cards, onPick) {
    this.upgradeScreen.classList.remove('hidden');
    this.upgradeCards.innerHTML = '';
    for (const id of cards) {
      const el = document.createElement('div');
      el.className = 'up-card';
      const h = document.createElement('h4');
      h.textContent = t(`upgrade.${id}`);
      const p = document.createElement('p');
      p.textContent = t(`upgradeDesc.${id}`);
      el.appendChild(h);
      el.appendChild(p);
      el.addEventListener('click', () => onPick(id));
      this.upgradeCards.appendChild(el);
    }
    this.applyLang();
  },

  hideUpgrade() {
    this.upgradeScreen.classList.add('hidden');
  },

  hideAll() {
    this.titleScreen.classList.add('hidden');
    this.titleScreen.classList.remove('is-active');
    this.pauseScreen.classList.add('hidden');
    this.resultScreen.classList.add('hidden');
    this.upgradeScreen.classList.add('hidden');
    this.hud.classList.add('hidden');
  },

  updateHUD(hud) {
    this.lastHud = hud;
    if (!hud) return;
    this.hudLevel.textContent = `${t('level')} ${hud.level}`;
    this.hudTargets.textContent = `${t('targets')}: ${hud.targets}`;
    this.hudScore.textContent = `${t('score')}: ${hud.score}`;
    this.hudCombo.textContent = hud.combo > 1 ? `${t('combo')} ×${hud.combo}` : '';
    this.hudHpLabel.textContent = `${t('hp')} ${hud.hp}/${hud.maxHp}`;
    const pct = Math.max(0, Math.min(100, (hud.hp / hud.maxHp) * 100));
    this.hudHpFill.style.width = `${pct}%`;
    this.hudHpFill.style.background = pct > 50 ? 'linear-gradient(90deg,#7dff6a,#17e0c8)' : pct > 25 ? 'linear-gradient(90deg,#ffd23f,#ffb300)' : 'linear-gradient(90deg,#ff4f6a,#ff2d55)';
  },

  // 教程
  setTutorialStep(text) {
    this.tutText.textContent = text;
  },

  showTutorial() {
    this.tutorial.classList.remove('hidden');
  },

  hideTutorial() {
    this.tutorial.classList.add('hidden');
  },
};
