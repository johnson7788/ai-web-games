// src/ui/ui.js — 屏幕/HUD/引导/触屏/小地图。样式在 styles.css。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';
import { save } from '../core/save.js';
import { WEAPONS, MAP, COLORS } from '../../config/game.config.js';

const $ = (id) => document.getElementById(id);
const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

const el = {
  hud: $('hud'), alive: $('hud-alive'), kills: $('hud-kills'), zone: $('hud-zone'),
  healthFill: $('hud-health-fill'), healthText: $('hud-health-text'),
  armorFill: $('hud-armor-fill'), armorText: $('hud-armor-text'),
  weapon: $('hud-weapon'), ammo: $('hud-ammo'), blocks: $('hud-blocks'), meds: $('hud-meds'),
  crosshair: $('crosshair'), hitmarker: $('hitmarker'), reload: $('reload-hint'),
  pickup: $('pickup-hint'), build: $('build-hint'), drop: $('drop-hint'), minimap: $('minimap'),
  touch: $('touch'),
  title: $('screen-title'), pause: $('screen-pause'), results: $('screen-results'),
  titleText: $('title-text'), subtitle: $('subtitle-text'), btnStart: $('btn-start'),
  btnHowto: $('btn-howto'), titleBest: $('title-best'), btnMute: $('btn-mute'),
  pauseTitle: $('pause-title'), btnResume: $('btn-resume'), btnRestartPause: $('btn-restart-pause'), btnMenuPause: $('btn-menu-pause'),
  resTitle: $('res-title'), resSub: $('res-sub'), resRating: $('res-rating'), resStats: $('res-stats'),
  resBest: $('res-best'), resRecord: $('res-record'), btnRestart: $('btn-restart'), btnShare: $('btn-share'), btnMenu: $('btn-menu'),
  tut: $('tutorial'), tutHighlight: $('tut-highlight'), tutStep: $('tut-step'), tutText: $('tut-text'),
  tutDots: $('tut-dots'), tutNext: $('tut-next'), tutSkip: $('tut-skip'),
  rotate: $('rotate'), rotateText: $('rotate-text'), btnRotateSkip: $('btn-rotate-skip'),
};

// ---------------------------------------------------------------- 引导（4 步，真实动作推进）
const TUT_STEPS = ['tut1', 'tut2', 'tut3', 'tut4'];
const TUT_TARGET = ['crosshair', 'pickup-hint', 'crosshair', 'build-hint'];
const tutorial = {
  active: false, step: 0,
  get steps() { return TUT_STEPS; },
  get current() { return TUT_STEPS[this.step]; },
  start() {
    this.active = true; this.step = 0;
    el.tut.classList.remove('hidden');
    this.render();
  },
  skip() {
    this.active = false;
    el.tut.classList.add('hidden');
    el.tutHighlight.classList.add('hidden');
    save.set('tutDone', true);
  },
  next() {
    if (!this.active) return;
    this.step++;
    if (this.step >= TUT_STEPS.length) this.skip();
    else this.render();
  },
  render() {
    el.tutText.textContent = t(TUT_STEPS[this.step]);
    el.tutStep.textContent = `${this.step + 1} / ${TUT_STEPS.length}`;
    el.tutDots.innerHTML = TUT_STEPS.map((_, i) => `<span class="dot${i === this.step ? ' on' : ''}"></span>`).join('');
    $('tut-next').textContent = t('tutNext');
    $('tut-skip').textContent = t('tutSkip');
    // 高亮真实 UI
    const target = $('tut-highlight');
    const aim = document.querySelector(`[data-tutorial-target="${TUT_TARGET[this.step]}"]`);
    const tgt = aim && aim.getBoundingClientRect().width > 0 ? aim : el.crosshair;
    const r = tgt.getBoundingClientRect();
    const c = document.getElementById('game-container').getBoundingClientRect();
    target.style.left = `${r.left - c.left - 8}px`;
    target.style.top = `${r.top - c.top - 8}px`;
    target.style.width = `${r.width + 16}px`;
    target.style.height = `${r.height + 16}px`;
    target.classList.remove('hidden');
  },
};
$('tut-next').addEventListener('click', () => tutorial.next());
$('tut-skip').addEventListener('click', () => tutorial.skip());

function fmtTime(s) {
  const m = Math.floor(s / 60), ss = Math.floor(s % 60);
  return `${m}:${String(ss).padStart(2, '0')}`;
}

function hideScreens() { for (const s of [el.title, el.pause, el.results]) s.classList.add('hidden'); }

export const ui = {
  tutorial,
  get lang() { return i18n.lang; },
  get dir() { return i18n.dir; },

  applyLang() {
    syncDocumentLang();
    document.querySelectorAll('[data-i18n]').forEach((n) => { n.textContent = t(n.dataset.i18n); });
    el.titleText.textContent = t('title');
    el.subtitle.textContent = t('subtitle');
    el.btnStart.textContent = t('start');
    el.btnHowto.textContent = t('howto');
    el.pauseTitle.textContent = t('paused');
    el.btnResume.textContent = t('resume');
    el.btnRestartPause.textContent = t('restart');
    el.btnMenuPause.textContent = t('menu');
    el.btnRestart.textContent = t('playAgain');
    el.btnShare.textContent = t('share');
    el.btnMenu.textContent = t('menu');
    el.btnMute.textContent = save.get('muted', false) ? t('unmute') : t('mute');
    el.drop.textContent = t('dropHint');
    el.rotateText.textContent = t('rotate');
    el.btnRotateSkip.textContent = t('rotateSkip');
    $('btn-fire').textContent = t('touchFire');
    $('btn-build').textContent = t('touchBuild');
    $('btn-pickup').textContent = t('touchPickup');
    $('btn-reload').textContent = 'R';
    for (const sel of [$('lang-select'), $('lang-select-pause')]) {
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
    el.titleBest.textContent = `${t('best')} ${Math.floor(save.get('best', 0))}`;
    this.applyLang();
  },

  showGame() {
    hideScreens();
    el.hud.classList.remove('hidden');
    el.touch.classList.toggle('hidden', !isTouch);
  },

  showPause() { hideScreens(); el.pause.classList.remove('hidden'); el.touch.classList.add('hidden'); this.applyLang(); },
  hidePause() { el.pause.classList.add('hidden'); el.touch.classList.toggle('hidden', !isTouch); },

  showResults(run, info) {
    hideScreens();
    el.results.classList.remove('hidden');
    el.hud.classList.add('hidden');
    el.touch.classList.add('hidden');
    const win = info.victory;
    el.results.classList.toggle('won', win);
    el.results.classList.toggle('lost', !win);
    el.resTitle.textContent = win ? t('victory') : t('defeat');
    el.resSub.textContent = win ? t('rating') : t('rating');
    el.resRating.innerHTML = `<span class="rank-letter">${info.rating}</span>`;
    el.resStats.innerHTML = [
      [t('statKills'), info.kills],
      [t('statSurvival'), fmtTime(info.time)],
      [t('statTime'), fmtTime(info.time)],
      [t('hudAlive'), info.alive],
    ].map(([k, v]) => `<div class="stat"><span>${k}</span><b>${v}</b></div>`).join('');
    el.resBest.textContent = `${t('best')} ${Math.floor(info.best)}`;
    el.resRecord.classList.toggle('hidden', !info.isRecord);
    el.resRecord.textContent = t('newRecord');
    this.applyLang();
  },

  updateHUD(run) {
    const h = run.hud || run;
    el.alive.textContent = `${t('hudAlive')} ${h.alive}`;
    el.kills.textContent = `${t('hudKills')} ${h.kills}`;
    el.zone.textContent = `${t('hudZone')} ${h.zoneStage + 1}`;
    el.healthFill.style.width = `${Math.max(0, Math.min(100, h.hp))}%`;
    el.healthText.textContent = String(Math.max(0, h.hp));
    el.armorFill.style.width = `${Math.max(0, Math.min(100, h.armor))}%`;
    el.armorText.textContent = String(h.armor);
    el.weapon.textContent = t(`weapon${h.weapon[0].toUpperCase()}${h.weapon.slice(1)}`);
    el.ammo.textContent = h.reloading ? t('reload') : `${h.mag} / ${h.ammo}`;
    el.blocks.textContent = `⬛ ${h.blocks}`;
    el.meds.textContent = `✚ ${h.meds}`;
    el.reload.classList.toggle('hidden', !h.reloading);
    // 提示
    el.pickup.classList.toggle('hidden', !run.nearLoot);
    el.build.classList.toggle('hidden', !(h.blocks > 0));
    el.drop.classList.toggle('hidden', run.phase !== 'drop');
    el.hitmarker.classList.toggle('hidden', !run.hitmarkT || run.hitmarkT < run.time);
  },

  hitmark() { el.hitmarker.classList.remove('hidden'); },

  updateMinimap(run) {
    const g = el.minimap.getContext('2d');
    const w = el.minimap.width;
    g.clearRect(0, 0, w, w);
    const c = MAP.center, scale = w / MAP.size;
    // 岛
    g.fillStyle = 'rgba(101,163,13,0.9)';
    g.beginPath(); g.arc(c * scale, c * scale, MAP.islandRadius * scale, 0, Math.PI * 2); g.fill();
    // 圈
    g.strokeStyle = '#3b82f6'; g.lineWidth = 2;
    g.beginPath(); g.arc(run.zone.cx * scale, run.zone.cz * scale, run.zone.r * scale, 0, Math.PI * 2); g.stroke();
    // bot
    g.fillStyle = '#ef4444';
    for (const b of run.bots) if (b.alive) g.fillRect(b.x * scale - 1.5, b.z * scale - 1.5, 3, 3);
    // 玩家
    g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(run.player.x * scale, run.player.z * scale, 2.5, 0, Math.PI * 2); g.fill();
  },

  resetHud() {
    el.hitmarker.classList.add('hidden');
    el.reload.classList.add('hidden');
    el.pickup.classList.add('hidden');
    el.build.classList.add('hidden');
  },

  toggleMinimap() {
    el.minimap.classList.toggle('hidden');
  },

  toggleBackpack(run) {
    const bp = $('backpack');
    if (bp.classList.contains('hidden')) {
      const h = run.hud || run;
      $('backpack-title').textContent = t('backpack');
      $('backpack-items').innerHTML = [
        [t('hudWeapon'), t(`weapon${h.weapon[0].toUpperCase()}${h.weapon.slice(1)}`)],
        [t('hudAmmo'), `${h.mag} / ${h.ammo}`],
        [t('hudArmor'), h.armor],
        [t('hudBlocks'), h.blocks],
        [t('hudMeds'), h.meds],
        [t('hudKills'), h.kills],
      ].map(([k, v]) => `<div class="bp-row"><span>${k}</span><b>${v}</b></div>`).join('');
      bp.classList.remove('hidden');
    } else {
      bp.classList.add('hidden');
    }
  },
};
