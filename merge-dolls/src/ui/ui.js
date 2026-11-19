// UI 模块：标题/暂停/HUD/页签/教程/Toast + 多语言。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';

const $ = (id) => document.getElementById(id);

export const ui = {
  titleScreen: $('screen-title'),
  pauseScreen: $('screen-pause'),
  hud: $('hud'),
  tabs: $('tabs'),
  shop: $('shop'),
  toast: $('toast'),

  hudGold: $('hud-gold'),
  hudGps: $('hud-gps'),
  hudCombo: $('hud-combo'),
  stageBar: $('stage-bar'),
  stageLabel: $('stage-label'),

  titleText: $('title-text'),
  subtitleText: $('subtitle-text'),
  pauseTitle: $('pause-title'),
  btnStart: $('btn-start'),
  btnResume: $('btn-resume'),
  btnRestart2: $('btn-restart2'),
  btnMenu: $('btn-menu'),
  btnHowto: $('btn-howto'),
  btnHowtoPause: $('btn-howto-pause'),
  btnMute: $('btn-mute'),
  recycleLabel: $('recycle-label'),
  rotateText: $('rotate-text'),
  playAnyway: $('btn-rotate-skip'),
  tutTitle: $('tut-title'),
  tutText: $('tut-text'),
  tutSkip: $('tut-skip'),
  tutNext: $('tut-next'),
  buyBtn: $('btn-buy'),
  buyCost: $('buy-cost'),

  langSelects: [$('lang-select'), $('lang-select-pause')],

  get lang() { return i18n.lang; },
  get dir() { return i18n.dir; },

  applyLang() {
    syncDocumentLang();
    this.titleText.textContent = t('title');
    this.subtitleText.textContent = t('subtitle');
    this.btnStart.textContent = t('start');
    this.btnResume.textContent = t('resume');
    this.pauseTitle.textContent = t('paused');
    this.btnRestart2.textContent = t('restart');
    this.btnMenu.textContent = t('menu');
    this.btnHowto.textContent = t('howto');
    this.btnHowtoPause.textContent = t('howto');
    this.recycleLabel.textContent = t('recycle');
    this.rotateText.textContent = t('rotateText');
    this.playAnyway.textContent = t('playAnyway');
    this.tutSkip.textContent = t('skip');
    this.tutNext.textContent = t('next');
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
    this.hud.classList.add('hidden');
    this.tabs.classList.add('hidden');
    this.shop.classList.add('hidden');
    this.applyLang();
  },

  showGame() {
    this.titleScreen.classList.add('hidden');
    this.titleScreen.classList.remove('is-active');
    this.pauseScreen.classList.add('hidden');
    this.hud.classList.remove('hidden');
    this.tabs.classList.remove('hidden');
    this.shop.classList.remove('hidden');
    this.applyLang();
  },

  showPause() {
    this.pauseScreen.classList.remove('hidden');
    this.applyLang();
  },

  hidePause() {
    this.pauseScreen.classList.add('hidden');
  },

  updateHUD(h) {
    this.hudGold.textContent = Math.floor(h.gold).toLocaleString('en-US');
    this.hudGps.textContent = `${Math.round(h.gps)}${t('goldPerSec')}`;
    if (h.combo > 1 && h.comboActive) {
      this.hudCombo.classList.remove('hidden');
      this.hudCombo.textContent = `${t('combo').toUpperCase()} ×${h.combo}`;
    } else {
      this.hudCombo.classList.add('hidden');
    }
    this.stageLabel.textContent = `${t('stage')} ${h.stage} · ${h.stageLabel}`;
    this.stageBar.style.width = `${Math.max(0, Math.min(100, h.stagePct))}%`;

    // 页签锁定状态
    for (let i = 0; i < 3; i += 1) {
      const tabEl = $(`tab-${i}`);
      if (!tabEl) continue;
      if (h.unlockTabs[i]) tabEl.classList.remove('locked');
      else tabEl.classList.add('locked');
      const name = [t('tabGlow'), t('tabPixel'), t('tabStar')][i];
      tabEl.textContent = h.unlockTabs[i] ? name : `🔒 ${name}`;
      if (i === h.tab) tabEl.classList.add('is-active');
      else tabEl.classList.remove('is-active');
    }

    // 购买按钮
    this.buyCost.textContent = `${t('buyCost', { n: h.buyLevel })} · ${Math.floor(h.buyCost)}`;
    this.buyBtn.disabled = h.buyCost > h.gold;
  },

  showToast(msg) {
    this.toast.textContent = msg;
    this.toast.classList.remove('hidden');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => this.toast.classList.add('hidden'), 1800);
  },

  /** 教程步骤渲染：{ titleKey, textKey, target: DOMElement|null } */
  renderTutorial(step) {
    this.tutTitle.textContent = t(step.titleKey);
    this.tutText.textContent = t(step.textKey);
    document.querySelectorAll('.tut-highlight').forEach((el) => el.classList.remove('tut-highlight'));
    if (step.target) step.target.classList.add('tut-highlight');
  },

  clearTutorialHighlight() {
    document.querySelectorAll('.tut-highlight').forEach((el) => el.classList.remove('tut-highlight'));
  },
};
