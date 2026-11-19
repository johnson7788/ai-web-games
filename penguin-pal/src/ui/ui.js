// UI 模块：HUD / 动作条 / 商店 / 标题·暂停·结算 / 教程 / 竖屏提示 + 多语言。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';

const $ = (id) => document.getElementById(id);

export const ui = {
  // 屏幕
  titleScreen: $('screen-title'),
  pauseScreen: $('screen-pause'),
  resultScreen: $('screen-result'),
  hud: $('hud'),
  actions: $('actions'),
  shopPanel: $('shop-panel'),
  tutorial: $('tutorial'),
  rotateScreen: $('rotate-screen'),

  // 标题
  titleText: $('title-text'),
  subtitleText: $('subtitle-text'),
  btnStart: $('btn-start'),
  btnHowto: $('btn-howto'),

  // 暂停
  pauseTitle: $('pause-title'),
  btnResume: $('btn-resume'),
  btnRestart2: $('btn-restart2'),
  btnHowto2: $('btn-howto2'),
  btnHome3: $('btn-home3'),

  // 结算
  resultTitle: $('result-title'),
  resultStars: $('result-stars'),
  resultMsg: $('result-msg'),
  btnNew: $('btn-new'),
  btnHome2: $('btn-home2'),

  // HUD
  hudLevel: $('hud-level-label'),
  xpFill: $('xp-fill'),
  hudGoal: $('hud-goal'),
  hudGold: $('hud-gold'),
  hudCombo: $('hud-combo'),
  btnShop: $('btn-shop'),
  btnMute: $('btn-mute'),
  btnHome: $('btn-home'),
  fillFull: $('fill-full'),
  fillEnergy: $('fill-energy'),
  fillMood: $('fill-mood'),
  fillClean: $('fill-clean'),
  labelFull: $('label-full'),
  labelEnergy: $('label-energy'),
  labelMood: $('label-mood'),
  labelClean: $('label-clean'),

  // 商店
  shopTitle: $('shop-title'),
  buyFish: $('buy-fish'),
  buyIcecream: $('buy-icecream'),
  buyToy: $('buy-toy'),
  fishDesc: $('fish-desc'),
  icecreamDesc: $('icecream-desc'),
  toyDesc: $('toy-desc'),
  btnShopClose: $('btn-shop-close'),

  // 教程
  tutTitle: $('tut-title'),
  tutText: $('tut-text'),
  tutSkip: $('tut-skip'),
  tutNext: $('tut-next'),

  // 竖屏
  rotateText: $('rotate-text'),
  btnRotateSkip: $('btn-rotate-skip'),

  langSelects: [$('lang-select'), $('lang-select-pause')],

  get lang() { return i18n.lang; },
  get dir() { return i18n.dir; },

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

  applyLang() {
    syncDocumentLang();
    this.titleText.textContent = t('title');
    this.subtitleText.textContent = t('subtitle');
    this.btnStart.textContent = t('start');
    this.btnHowto.textContent = t('howto');
    this.pauseTitle.textContent = t('paused');
    this.btnResume.textContent = t('resume');
    this.btnRestart2.textContent = t('restart');
    this.btnHowto2.textContent = t('howto');
    this.btnHome3.textContent = t('menu');
    this.resultTitle.textContent = t('resultTitle');
    this.resultMsg.textContent = t('resultMsg');
    this.btnNew.textContent = t('newPal');
    this.btnHome2.textContent = t('menu');
    this.btnShopClose.textContent = t('shopClose');
    this.shopTitle.textContent = t('shop');
    this.buyFish.textContent = t('buyFish');
    this.buyIcecream.textContent = t('buyIcecream');
    this.buyToy.textContent = t('buyToy');
    this.fishDesc.textContent = t('fishDesc');
    this.icecreamDesc.textContent = t('icecreamDesc');
    this.toyDesc.textContent = t('toyDesc');
    this.tutSkip.textContent = t('tutSkip');
    this.tutNext.textContent = t('tutNext');
    this.rotateText.textContent = t('rotateText');
    this.btnRotateSkip.textContent = t('rotateSkip');
    this.hudGoal.textContent = t('goal');
    this.labelFull.textContent = t('full');
    this.labelEnergy.textContent = t('energy');
    this.labelMood.textContent = t('mood');
    this.labelClean.textContent = t('clean');
    for (const b of document.querySelectorAll('.act-btn[data-action]')) {
      const name = b.getAttribute('data-action');
      const label = b.querySelector('.act-label');
      if (label) label.textContent = t('act' + name.charAt(0).toUpperCase() + name.slice(1));
    }
    for (const sel of this.langSelects) {
      if (sel) sel.setAttribute('aria-label', t('language'));
    }
    this.fillLangOptions();
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
    this.actions.classList.add('hidden');
    this.shopPanel.classList.add('hidden');
    this.tutorial.classList.add('hidden');
    this.applyLang();
  },

  showGame() {
    this.titleScreen.classList.add('hidden');
    this.titleScreen.classList.remove('is-active');
    this.pauseScreen.classList.add('hidden');
    this.resultScreen.classList.add('hidden');
    this.hud.classList.remove('hidden');
    this.actions.classList.remove('hidden');
    this.applyLang();
  },

  showPause() {
    this.pauseScreen.classList.remove('hidden');
    this.applyLang();
  },

  hidePause() {
    this.pauseScreen.classList.add('hidden');
  },

  showResult(stars) {
    this.resultScreen.classList.remove('hidden');
    this.resultStars.textContent = '⭐'.repeat(Math.max(1, Math.min(3, stars)));
    this.applyLang();
  },

  showShop() {
    this.shopPanel.classList.remove('hidden');
  },

  hideShop() {
    this.shopPanel.classList.add('hidden');
  },

  updateHUD(h) {
    this.hudLevel.textContent = `${t('level')}${h.level}`;
    const pct = h.xpNeed > 0 ? Math.round((h.xp / h.xpNeed) * 100) : 100;
    this.xpFill.style.width = `${Math.min(100, pct)}%`;
    this.hudGold.textContent = `💰 ${h.gold}`;
    if (h.combo >= 2) {
      this.hudCombo.classList.remove('hidden');
      this.hudCombo.textContent = `${t('combo')} ×${h.combo}`;
    } else {
      this.hudCombo.classList.add('hidden');
    }
    this.fillFull.style.width = `${Math.max(0, Math.min(100, 100 - h.hunger))}%`;
    this.fillEnergy.style.width = `${Math.max(0, Math.min(100, h.energy))}%`;
    this.fillMood.style.width = `${Math.max(0, Math.min(100, h.mood))}%`;
    this.fillClean.style.width = `${Math.max(0, Math.min(100, h.clean))}%`;
  },

  setMuted(muted) {
    this.btnMute.textContent = muted ? '🔇' : '🔊';
    this.btnMute.setAttribute('aria-label', muted ? t('unmute') : t('mute'));
  },

  // 教学卡文案
  setTutorialStep(step) {
    this.tutTitle.textContent = t(step.titleKey);
    this.tutText.textContent = t(step.textKey);
  },
};
