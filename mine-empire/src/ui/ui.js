// UI 模块：标题/暂停 + HUD + 右侧升级面板（DOM）+ 多语言。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';

function el(id) { return document.getElementById(id); }

export const ui = {
  titleScreen: el('screen-title'),
  pauseScreen: el('screen-pause'),
  hud: el('hud'),
  panel: el('panel'),
  hudLayer: el('hud-layer'),
  hudDepth: el('hud-depth'),
  panelMoney: el('panel-money'),
  panelStats: el('panel-stats'),
  panelLayer: el('panel-layer'),
  titleText: el('title-text'),
  subtitleText: el('subtitle-text'),
  titleBest: el('title-best'),
  howTo: el('how-to'),
  pauseTitle: el('pause-title'),
  btnStart: el('btn-start'),
  btnResume: el('btn-resume'),
  btnReset: el('btn-reset'),
  btnTitle: el('btn-title'),
  btnMute: el('btn-mute'),
  btnPause: el('btn-pause'),
  upBtns: { pick: el('btn-pick'), drill: el('btn-drill'), refinery: el('btn-refinery') },
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
    this.hudLayer.textContent = `${t('layer')}: ${state.layerName}`;
    this.hudDepth.textContent = `${t('depth')}: ${state.depth} ${t('meters')}`;
  },
  updatePanel(state) {
    this.panelMoney.textContent = `💰 ${fmt(state.money)}`;
    this.panelStats.textContent =
      `${state.clickPower} ${t('perClick')} · ${state.digRate} ${t('perSec')} · ×${state.incomeMult.toFixed(1)}`;
    this.panelLayer.textContent = `${t('layer')}: ${state.layerName}`;
    for (const up of state.upgrades) {
      const btn = this.upBtns[up.id];
      if (!btn) continue;
      btn.querySelector('.up-name').textContent = `${up.name} · ${t('level')}${up.level}`;
      btn.querySelector('.up-desc').textContent = up.desc;
      btn.querySelector('.up-cost').textContent = `💰 ${fmt(up.cost)}`;
      btn.disabled = !up.canBuy;
    }
  },
  updateMute(muted) {
    this._muted = muted;
    this.btnMute.textContent = muted ? '🔇' : '🔊';
    this.btnMute.setAttribute('aria-label', `${t('sound')}: ${muted ? t('off') : t('on')}`);
  },
  updateBest(best) {
    this.titleBest.textContent = best > 0 ? `${t('best')}: ${fmt(best)}` : '';
  },
};

function fmt(n) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(Math.floor(n));
}