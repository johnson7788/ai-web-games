// UI 模块：标题/暂停 + HUD + 右侧升级面板（DOM 按钮）+ 多语言。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';

function el(id) { return document.getElementById(id); }

export const ui = {
  titleScreen: el('screen-title'),
  pauseScreen: el('screen-pause'),
  hud: el('hud'),
  panel: el('panel'),
  hudTier: el('hud-tier'),
  hudCrushed: el('hud-crushed'),
  panelCoins: el('panel-coins'),
  panelStats: el('panel-stats'),
  titleText: el('title-text'),
  subtitleText: el('subtitle-text'),
  howTo: el('how-to'),
  pauseTitle: el('pause-title'),
  btnStart: el('btn-start'),
  btnResume: el('btn-resume'),
  btnReset: el('btn-reset'),
  btnTitle: el('btn-title'),
  btnMute: el('btn-mute'),
  btnPause: el('btn-pause'),
  upBtns: { click: el('btn-click'), auto: el('btn-auto'), crit: el('btn-crit') },
  langSelects: [el('lang-select'), el('lang-select-pause')],

  get lang() { return i18n.lang; },
  get dir() { return i18n.dir; },

  applyLang() {
    syncDocumentLang();
    this.titleText.textContent = t('title');
    this.subtitleText.textContent = t('subtitle');
    this.howTo.textContent = t('howTo');
    this.pauseTitle.textContent = t('paused');
    this.btnStart.textContent = t('start');
    this.btnResume.textContent = t('resume');
    this.btnReset.textContent = t('restartRun');
    this.btnTitle.textContent = t('backTitle');
    const pt = document.querySelector('#panel .panel-title');
    if (pt) pt.textContent = t('upgrades');
    for (const sel of this.langSelects) if (sel) sel.setAttribute('aria-label', t('language'));
    this.fillLangOptions();
    this.updateMute(this._muted);
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

  showTitle() {
    this.titleScreen.classList.remove('hidden');
    this.pauseScreen.classList.add('hidden');
    this.hud.classList.add('hidden');
    this.panel.classList.add('hidden');
    this.applyLang();
  },
  showGame() {
    this.titleScreen.classList.add('hidden');
    this.pauseScreen.classList.add('hidden');
    this.hud.classList.remove('hidden');
    this.panel.classList.remove('hidden');
  },
  showPause() { this.pauseScreen.classList.remove('hidden'); this.applyLang(); },
  hidePause() { this.pauseScreen.classList.add('hidden'); },

  updateHUD(state) {
    this.hudTier.textContent = `${t('tier')}: ${state.tierName}`;
    this.hudCrushed.textContent = `${t('crushed')}: ${state.crushed}`;
  },
  updatePanel(state) {
    this.panelCoins.textContent = `🪙 ${state.coins}`;
    this.panelStats.textContent =
      `${state.clickPower} ${t('perClick')} · ${state.dps} ${t('perSec')} · ${Math.round(state.critChance * 100)}% ${t('crit')}`;
    for (const up of state.upgrades) {
      const btn = this.upBtns[up.id];
      if (!btn) continue;
      btn.querySelector('.up-name').textContent = `${up.name} · ${t('level')}${up.level}`;
      btn.querySelector('.up-desc').textContent = up.desc;
      btn.querySelector('.up-cost').textContent = `🪙 ${up.cost}`;
      btn.disabled = !up.canBuy;
    }
  },
  updateMute(muted) {
    this._muted = muted;
    this.btnMute.textContent = muted ? '🔇' : '🔊';
    this.btnMute.setAttribute('aria-label', `${t('sound')}: ${muted ? t('off') : t('on')}`);
  },
};