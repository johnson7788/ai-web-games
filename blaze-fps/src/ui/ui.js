// src/ui/ui.js — 屏幕/HUD/教学/升级/结算。样式在 styles.css。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';
import { save } from '../core/save.js';
import { UPGRADES } from '../../config/game.config.js';

const $ = (id) => document.getElementById(id);
const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

const el = {
  hud: $('hud'), crosshair: $('crosshair'), vignette: $('vignette'), damage: $('damage-flash'), slowmo: $('slowmo-flash'),
  hudMap: $('hud-map'), hudWave: $('hud-wave'), hudKills: $('hud-kills'),
  hpFill: $('hp-fill'), hpText: $('hp-text'), energyFill: $('energy-fill'),
  weaponName: $('weapon-name'), ammoMag: $('ammo-mag'), ammoReserve: $('ammo-reserve'), reloadHint: $('reload-hint'),
  banner: $('hud-banner'), bannerText: $('banner-text'),
  intro: $('hud-intro'), introWave: $('intro-wave'), introGet: $('intro-getready'), introCount: $('intro-count'),
  title: $('screen-title'), pause: $('screen-pause'), upgrade: $('screen-upgrade'), results: $('screen-results'),
  titleText: $('title-text'), subtitleText: $('subtitle-text'), titleBest: $('title-best'),
  pauseTitle: $('pause-title'), upgradeTitle: $('upgrade-title'), upgradeHint: $('upgrade-hint'), upgradeCards: $('upgrade-cards'),
  resTitle: $('res-title'), resSub: $('res-sub'), resRating: $('res-rating'), resStats: $('res-stats'), resRecord: $('res-record'),
  tut: $('tutorial'), tutText: $('tut-text'), tutDots: $('tut-dots'), tutHighlight: $('tut-highlight'), tutTitle: $('tut-title'),
  rotate: $('rotate'), rotateText: $('rotate-text'),
  touch: $('touch'),
  langSelects: [$('lang-select'), $('lang-select-pause')],
};

const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// ---------------------------------------------------------------- 教学
const TUT_STEPS = ['tut1', 'tut2', 'tut3', 'tut4'];
const TUT_TARGET = ['crosshair', 'crosshair', 'crosshair', 'hud-bottom-right'];
const tutorial = {
  active: false, step: 0,
  get steps() { return TUT_STEPS; },
  get current() { return TUT_STEPS[this.step]; },
  start() {
    this.active = true; this.step = 0;
    this._fromTitle = !el.title.classList.contains('hidden');
    if (this._fromTitle) el.title.classList.add('hidden');
    el.tut.classList.toggle('from-title', this._fromTitle);
    el.tut.classList.remove('hidden');
    this.render();
  },
  skip() {
    this.active = false;
    el.tut.classList.add('hidden');
    if (this._fromTitle) { el.title.classList.remove('hidden'); this._fromTitle = false; }
    save.set('tutDone', true);
  },
  next() {
    if (!this.active) return;
    this.step++;
    if (this.step >= TUT_STEPS.length) this.skip();
    else this.render();
  },
  advance(cond) {
    if (this.active && cond) this.next();
  },
  render() {
    el.tutText.textContent = t(TUT_STEPS[this.step]);
    el.tutDots.innerHTML = TUT_STEPS.map((_, i) => `<span class="dot${i === this.step ? ' on' : ''}"></span>`).join('');
    $('tut-next').textContent = t('tutNext');
    $('tut-skip').textContent = t('tutSkip');
    const target = $(TUT_TARGET[this.step]);
    if (target && target.getBoundingClientRect().width > 0) {
      const stage = $('stage').getBoundingClientRect();
      const r = target.getBoundingClientRect();
      const s = stage.width / 1280;
      el.tutHighlight.style.left = `${(r.left - stage.left) / s - 6}px`;
      el.tutHighlight.style.top = `${(r.top - stage.top) / s - 6}px`;
      el.tutHighlight.style.width = `${r.width / s + 12}px`;
      el.tutHighlight.style.height = `${r.height / s + 12}px`;
      el.tutHighlight.classList.remove('hidden');
    } else {
      el.tutHighlight.classList.add('hidden');
    }
  },
};
$('tut-next').addEventListener('click', () => tutorial.next());
$('tut-skip').addEventListener('click', () => tutorial.skip());

// ---------------------------------------------------------------- 工具
function hideScreens() {
  for (const s of [el.title, el.pause, el.upgrade, el.results]) s.classList.add('hidden');
}
let bannerTimer = null;
function banner(text, cls = '') {
  el.bannerText.textContent = text;
  el.banner.className = 'show' + (cls ? ' ' + cls : '');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => { el.banner.className = 'hidden'; }, 1800);
}

export const ui = {
  tutorial,
  onUpgradePick: null,
  get lang() { return i18n.lang; },
  get dir() { return i18n.dir; },

  applyLang() {
    syncDocumentLang();
    el.titleText.textContent = t('title');
    el.subtitleText.textContent = t('subtitle');
    el.pauseTitle.textContent = t('paused');
    el.upgradeTitle.textContent = t('upTitle');
    el.upgradeHint.textContent = t('upHint');
    el.rotateText.textContent = t('rotate');
    el.tutTitle.textContent = t('howto');
    $('btn-start').textContent = t('start');
    $('btn-howto').textContent = t('howto');
    $('btn-resume').textContent = t('resume');
    $('btn-restart-pause').textContent = t('restart');
    $('btn-menu-pause').textContent = t('menu');
    $('btn-restart').textContent = t('playAgain');
    $('btn-share').textContent = t('share');
    $('btn-menu').textContent = t('menu');
    $('btn-rotate-skip').textContent = t('rotateSkip');
    $('btn-mute').textContent = save.get('muted', false) ? t('unmute') : t('mute');
    $('btn-touch-fire').textContent = t('touch_fire');
    $('btn-touch-aim').textContent = t('touch_aim');
    $('btn-touch-sprint').textContent = t('touch_sprint');
    $('btn-touch-reload').textContent = t('touch_reload');
    for (const sel of el.langSelects) {
      sel.innerHTML = '';
      for (const o of i18n.options()) {
        const opt = document.createElement('option');
        opt.value = o.code; opt.textContent = o.name;
        if (o.code === i18n.lang) opt.selected = true;
        sel.appendChild(opt);
      }
    }
    if (tutorial.active) tutorial.render();
  },

  setLang(lang) { i18n.setLang(lang); this.applyLang(); return i18n.lang; },

  showTitle() {
    hideScreens();
    el.title.classList.remove('hidden');
    el.hud.classList.add('hidden');
    el.touch.classList.add('hidden');
    el.titleBest.textContent = String(save.get('best', 0));
    this.applyLang();
  },
  showGame() {
    hideScreens();
    el.hud.classList.remove('hidden');
    el.touch.classList.toggle('hidden', !isTouch);
    el.banner.className = 'hidden';
  },
  showPause() { hideScreens(); el.pause.classList.remove('hidden'); this.applyLang(); },
  hidePause() { el.pause.classList.add('hidden'); el.touch.classList.toggle('hidden', !isTouch); },
  showUpgrade(choices) {
    hideScreens();
    el.upgrade.classList.remove('hidden');
    el.upgradeCards.innerHTML = '';
    choices.forEach((id, i) => {
      const u = UPGRADES.find((x) => x.id === id);
      if (!u) return;
      const card = document.createElement('button');
      card.className = 'upgrade-card';
      card.innerHTML = `<b>${t('up_' + id.replaceAll('-', '_'))}</b><small>${t('up_' + id.replaceAll('-', '_') + '_d')}</small><span class="key">${i + 1}</span>`;
      card.addEventListener('click', () => { if (ui.onUpgradePick) ui.onUpgradePick(id); });
      el.upgradeCards.appendChild(card);
    });
    this.applyLang();
  },
  hideUpgrade() { el.upgrade.classList.add('hidden'); },

  showResults(info) {
    hideScreens();
    el.results.classList.remove('hidden');
    el.hud.classList.add('hidden');
    el.touch.classList.add('hidden');
    el.resTitle.textContent = info.win ? t('victory') : t('defeat');
    el.resSub.textContent = info.win ? t('resultSubWin') : t('resultSubLose');
    el.resRating.innerHTML = `<span class="rank-label">${t('rating')}</span><span class="rank-${info.rating}">${info.rating}</span>`;
    el.resRecord.classList.toggle('hidden', !info.isRecord);
    el.resRecord.textContent = t('newRecord');
    el.resStats.innerHTML = [
      [t('statKills'), info.kills],
      [t('statHeadshots'), info.headshots],
      [t('statAccuracy'), info.accuracy + '%'],
      [t('statWaves'), info.waves],
      [t('statTime'), fmtTime(info.time)],
      [t('best'), info.best],
    ].map(([k, v]) => `<div class="stat"><span>${k}</span><b>${v}</b></div>`).join('');
    this.applyLang();
  },

  updateHUD(hud) {
    el.hudMap.textContent = t('map_' + hud.mapId);
    el.hudWave.textContent = `${t('wave')} ${hud.wave}`;
    el.hudKills.textContent = `${t('kills')} ${hud.kills}`;
    const hpPct = Math.max(0, Math.min(100, (hud.hp / hud.maxHp) * 100));
    el.hpFill.style.width = hpPct + '%';
    el.hpFill.classList.toggle('low', hpPct < 30);
    el.hpText.textContent = String(hud.hp);
    el.energyFill.style.width = Math.round(hud.energy) + '%';
    el.weaponName.textContent = t('weapon_' + hud.weapon);
    el.ammoMag.textContent = String(hud.ammo);
    el.ammoReserve.textContent = hud.reserve === Infinity ? '∞' : String(hud.reserve);
    el.reloadHint.classList.toggle('hidden', !hud.reloading);
    // 准星扩张（后坐力 + 射速）
    const spread = Math.min(1.6, 1 + (hud.recoil || 0) * 6 + (hud.cooldown > 0 ? 0.12 : 0));
    el.crosshair.style.transform = `translate(-50%, -50%) scale(${spread})`;
    // 受击红闪
    el.damage.style.opacity = (hud.hurt || 0) > 0 ? Math.min(0.55, (hud.hurt || 0) * 2.2) : 0;
    el.slowmo.classList.toggle('on', (hud.slowmoT || 0) > 0);
    el.vignette.classList.toggle('low', hpPct < 30);
    // 波次开场倒计时（intro 期间显示，给玩家明确目标）
    if (hud.waveState === 'intro' && hud.phase === 'wave') {
      el.intro.classList.remove('hidden');
      el.introWave.textContent = `${t('wave')} ${hud.wave}`;
      el.introGet.textContent = t('getReady');
      el.introCount.textContent = String(Math.max(1, Math.ceil((hud.introT || 0) / 0.3)));
    } else {
      el.intro.classList.add('hidden');
    }
  },

  popup(ev) {
    if (ev.type === 'waveClear') banner(t('waveClear'), 'good');
    else if (ev.type === 'victory') banner(t('victory'), 'good');
    else if (ev.type === 'dead') banner(t('defeat'), 'bad');
    else if (ev.type === 'headshot') banner(t('headshot'), 'crit');
    else if (ev.type === 'bossSpawn') banner(t('bossIncoming'), 'bad');
    else if (ev.type === 'outOfAmmo') banner(t('outOfAmmo'), 'bad');
  },
};
