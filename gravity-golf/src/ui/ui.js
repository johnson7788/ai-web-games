// UI 模块：标题 / HUD / 升级面板 / 暂停 / 横幅 / toast + 语言下拉
import { i18n, t, syncDocumentLang } from '../core/i18n.js';
import { UPGRADES } from '../../config/game.config.js';
import { upgradeCost } from '../game/sim.js';

const $ = (id) => document.getElementById(id);

export const ui = {
  titleScreen: $('screen-title'),
  pauseScreen: $('screen-pause'),
  upgradeScreen: $('screen-upgrade'),
  hud: $('hud'),
  hudDist: $('hud-dist'),
  hudBest: $('hud-best'),
  hudCoins: $('hud-coins'),
  hudPlanet: $('hud-planet'),
  hudShot: $('hud-shot'),
  powerBar: $('power-bar'),
  powerFill: $('power-fill'),
  titleText: $('title-text'),
  tagline: $('tagline'),
  titleBest: $('title-best'),
  titleHint: $('title-hint'),
  hudDistLabel: $('hud-dist-label'),
  hudBestLabel: $('hud-best-label'),
  hudCoinsLabel: $('hud-coins-label'),
  hudShotLabel: $('hud-shot-label'),
  units: document.querySelectorAll('.unit'),
  btnStart: $('btn-start'),
  banner: $('banner'),
  toast: $('toast'),
  upgradeTitle: $('upgrade-title'),
  upgradeCards: $('upgrade-cards'),
  btnCloseUpgrade: $('btn-close-upgrade'),
  pauseTitle: $('pause-title'),
  btnResume: $('btn-resume'),
  btnRestart: $('btn-restart'),
  btnMute: $('btn-mute'),
  langSelects: [$('lang-select'), $('lang-select-pause')],

  onUpgradeBuy: null,

  _cache: { dist: '', best: '', coins: '', planet: '', shot: '' },

  get lang() { return i18n.lang; },
  get dir() { return i18n.dir; },

  applyLang() {
    syncDocumentLang();
    this.titleText.textContent = t('title');
    this.tagline.textContent = t('tagline');
    this.btnStart.textContent = t('start');
    this.titleHint.textContent = t('hint');
    this.hudDistLabel.textContent = t('dist');
    this.hudBestLabel.textContent = t('best');
    this.hudCoinsLabel.textContent = t('coins');
    this.hudShotLabel.textContent = t('shot');
    for (const el of this.units) el.textContent = t('unit_m');
    this.upgradeTitle.textContent = t('up_title');
    this.btnCloseUpgrade.textContent = t('close');
    this.pauseTitle.textContent = t('paused');
    this.btnResume.textContent = t('resume');
    this.btnRestart.textContent = t('restart');
    for (const sel of this.langSelects) {
      if (sel) sel.setAttribute('aria-label', t('language'));
    }
    this.fillLangOptions();
    this._cache = { dist: '', best: '', coins: '', planet: '', shot: '' };
    if (!this.upgradeScreen.classList.contains('hidden')) this.refreshUpgrades();
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

  showTitle(best) {
    this.titleScreen.classList.remove('hidden');
    this.titleScreen.classList.add('is-active');
    this.pauseScreen.classList.add('hidden');
    this.upgradeScreen.classList.add('hidden');
    this.hud.classList.add('hidden');
    this.powerBar.classList.add('hidden');
    this.titleBest.textContent = `${t('best')}  ${best} ${t('unit_m')}`;
    this.applyLang();
  },

  showGame() {
    this.titleScreen.classList.add('hidden');
    this.titleScreen.classList.remove('is-active');
    this.pauseScreen.classList.add('hidden');
    this.hud.classList.remove('hidden');
  },

  showPause() {
    this.pauseScreen.classList.remove('hidden');
    this.applyLang();
  },

  hidePause() {
    this.pauseScreen.classList.add('hidden');
  },

  showUpgrade() {
    this.upgradeScreen.classList.remove('hidden');
    if (this._upState) this.refreshUpgrades(this._upState.levels, this._upState.coins);
  },

  hideUpgrade() {
    this.upgradeScreen.classList.add('hidden');
  },

  get upgradeOpen() {
    return !this.upgradeScreen.classList.contains('hidden');
  },

  refreshUpgrades(levels, coins) {
    if (!levels) return;
    this._upState = { levels: { ...levels }, coins };
    this.upgradeCards.innerHTML = '';
    for (const key of Object.keys(UPGRADES)) {
      const lvl = levels[key];
      const maxed = lvl >= UPGRADES[key].maxLevel;
      const cost = upgradeCost(key, lvl);
      const card = document.createElement('div');
      card.className = 'up-card';

      const name = document.createElement('div');
      name.className = 'up-name';
      name.textContent = t(`up_${key}`);
      card.appendChild(name);

      const desc = document.createElement('div');
      desc.className = 'up-desc';
      desc.textContent = t(`up_${key}_desc`);
      card.appendChild(desc);

      const lv = document.createElement('div');
      lv.className = 'up-level';
      lv.textContent = t('level', { n: lvl });
      card.appendChild(lv);

      const btn = document.createElement('button');
      btn.className = 'up-buy';
      btn.dataset.upgrade = key;
      if (maxed) {
        btn.textContent = t('maxed');
        btn.disabled = true;
        btn.classList.add('is-max');
      } else {
        const ico = document.createElement('span');
        ico.className = 'coin-ico';
        btn.appendChild(ico);
        btn.appendChild(document.createTextNode(String(cost)));
        btn.disabled = coins < cost;
        btn.classList.toggle('is-poor', btn.disabled);
        btn.addEventListener('click', () => {
          if (this.onUpgradeBuy) this.onUpgradeBuy(key);
        });
      }
      card.appendChild(btn);
      this.upgradeCards.appendChild(card);
    }
  },

  updateHud(hud, powerVisible, power) {
    const d = `${hud.distance}`;
    if (d !== this._cache.dist) { this.hudDist.textContent = d; this._cache.dist = d; }
    const b = `${hud.best}`;
    if (b !== this._cache.best) { this.hudBest.textContent = b; this._cache.best = b; }
    const c = `${hud.coins}`;
    if (c !== this._cache.coins) { this.hudCoins.textContent = c; this._cache.coins = c; }
    if (hud.planet !== this._cache.planet) {
      this.hudPlanet.textContent = t(`planet_${hud.planet}`);
      this._cache.planet = hud.planet;
    }
    if (hud.shot !== this._cache.shot) {
      this._cache.shot = hud.shot;
      this.renderShotDots(hud.shot, hud.shotOf);
    }

    if (powerVisible) {
      this.powerBar.classList.remove('hidden');
      this.powerFill.style.width = `${Math.round(power * 100)}%`;
      this.powerFill.classList.toggle('is-hot', power > 0.85);
    } else {
      this.powerBar.classList.add('hidden');
    }
  },

  renderShotDots(current, total) {
    this.hudShot.innerHTML = '';
    for (let i = 1; i <= total; i += 1) {
      const d = document.createElement('span');
      d.className = 'shot-dot' + (i === current ? ' is-now' : i < current ? ' is-done' : '');
      this.hudShot.appendChild(d);
    }
    this.hudShot.setAttribute('aria-label', t('shot_of', { n: current }));
  },

  showBanner(text) {
    this.banner.textContent = text;
    this.banner.classList.remove('hidden', 'is-anim');
    void this.banner.offsetWidth;
    this.banner.classList.add('is-anim');
  },

  showToast(text) {
    this.toast.textContent = text;
    this.toast.classList.remove('hidden', 'is-anim');
    void this.toast.offsetWidth;
    this.toast.classList.add('is-anim');
  },

  updateMute(muted) {
    this.btnMute.textContent = muted ? t('sound_off') : t('sound_on');
  },
};
