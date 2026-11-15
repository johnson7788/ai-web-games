// src/ui/ui.js — 屏幕/HUD/升级面板/结果/教学/浮字。样式在 styles.css。
// 教学是 4 步真实动作推进（移动→挖掘→出售→升级），可跳过/可重看，落 save.tutDone。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';
import { save } from '../core/save.js';
import { UPGRADES, GOAL, BLOCKS } from '../../config/game.config.js';
import { buyUpgrade } from '../game/sim.js';

const $ = (id) => document.getElementById(id);
const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

const el = {
  title: $('screen-title'), pause: $('screen-pause'), results: $('screen-results'), upgrade: $('screen-upgrade'),
  hud: $('hud'), touch: $('touch'), fx: $('fx-layer'), rotate: $('rotate'),
  coins: $('hud-coins'), depth: $('hud-depth'), goal: $('hud-goal'),
  staminaFill: $('hud-stamina-fill'), staminaTxt: $('hud-stamina-txt'), bag: $('hud-bag'),
  crackFill: $('hud-crack-fill'), hint: $('hud-hint'),
  titleBest: $('title-best'),
  resTitle: $('res-title'), resSub: $('res-sub'), resStats: $('res-stats'), resRecord: $('res-record'),
  upgGrid: $('upg-grid'), upgTitle: $('upg-title'),
  tut: $('tutorial'), tutText: $('tut-text'), tutDots: $('tut-dots'), tutHighlight: $('tut-highlight'),
};

// ---------- 教学 ----------
const TUT_STEPS = ['tut1', 'tut2', 'tut3', 'tut4'];
const TUT_FOCUS = ['#reticle', '#hud-crack', '#hud-coins', '#upg-grid'];
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
    save.set('tutDone', true);
  },
  next() {
    if (!this.active) return;
    this.step++;
    if (this.step >= TUT_STEPS.length) this.skip();
    else this.render();
  },
  doneCheck(run) {
    if (!this.active) return;
    const s = run.stats;
    const ok = [s.moved, s.mined >= 1, s.sold >= 1, s.upgraded >= 1];
    if (ok[this.step]) this.next();
  },
  render() {
    el.tutText.textContent = t(TUT_STEPS[this.step]);
    el.tutDots.textContent = `${this.step + 1} / ${TUT_STEPS.length}`;
    $('btn-tut-next').textContent = t('tutNext');
    $('btn-tut-skip').textContent = t('tutSkip');
    const target = document.querySelector(TUT_FOCUS[this.step]);
    const stage = $('stage').getBoundingClientRect();
    if (target && target.getBoundingClientRect().width > 0) {
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
$('btn-tut-next').addEventListener('click', () => tutorial.next());
$('btn-tut-skip').addEventListener('click', () => tutorial.skip());

// ---------- 屏幕 ----------
function hideScreens() {
  for (const s of [el.title, el.pause, el.results, el.upgrade]) s.classList.add('hidden');
}

export const ui = {
  el,
  tutorial,
  run: null,

  get lang() { return i18n.lang; },
  get dir() { return i18n.dir; },
  setRun(run) { this.run = run; },

  applyLang() {
    syncDocumentLang();
    document.querySelectorAll('[data-i18n]').forEach((n) => { n.textContent = t(n.dataset.i18n); });
    $('title-text').textContent = t('title');
    $('subtitle-text').textContent = t('subtitle');
    $('btn-start').textContent = t('start');
    $('btn-howto').textContent = t('howto');
    $('btn-resume').textContent = t('resume');
    $('btn-restart-pause').textContent = t('restart');
    $('btn-menu-pause').textContent = t('menu');
    $('pause-title').textContent = t('paused');
    $('btn-restart').textContent = t('playAgain');
    $('btn-menu').textContent = t('backToTitle');
    $('btn-upg-close').textContent = t('close');
    $('upg-title').textContent = t('upgradeTitle');
    $('hud-hint').textContent = t('moveHint') + ' · ' + t('mineHint') + ' · ' + t('placeHint') + ' · TAB · R';
    $('rotate-text').textContent = t('rotate');
    $('btn-rotate-skip').textContent = t('rotateSkip');
    $('btn-mute').textContent = '♪ ' + (save.get('muted', false) ? t('unmute') : t('mute'));
    for (const sel of [$('lang-select'), $('lang-select-pause')]) {
      sel.innerHTML = '';
      for (const o of i18n.options()) {
        const opt = document.createElement('option');
        opt.value = o.code; opt.textContent = o.name;
        if (o.code === i18n.lang) opt.selected = true;
        sel.appendChild(opt);
      }
    }
    el.titleBest.textContent = `${t('bestDepth')}: ${save.get('bestDepth', 0)}m`;
    if (this.run) this.buildUpgrades(this.run);
    if (tutorial.active) tutorial.render();
  },

  setLang(lang) { i18n.setLang(lang); this.applyLang(); return i18n.lang; },

  showTitle() {
    hideScreens();
    el.title.classList.remove('hidden');
    el.hud.classList.add('hidden');
    el.touch.classList.add('hidden');
    this.applyLang();
  },
  showGame() {
    hideScreens();
    el.hud.classList.remove('hidden');
    el.touch.classList.toggle('hidden', !isTouch);
  },
  showPause() { hideScreens(); el.pause.classList.remove('hidden'); el.touch.classList.add('hidden'); this.applyLang(); },
  hidePause() { el.pause.classList.add('hidden'); el.touch.classList.toggle('hidden', !isTouch); },

  showResults(run) {
    hideScreens();
    el.results.classList.remove('hidden');
    el.hud.classList.add('hidden');
    el.touch.classList.add('hidden');
    const win = run.treasureFound;
    el.resTitle.textContent = win ? t('resultsTitleWin') : t('resultsTitle');
    el.resSub.textContent = t('resultsSub');
    el.resStats.innerHTML = [
      [t('totalEarned'), `${run.stats.earned}`],
      [t('depthReached'), `${Math.floor(run.depthMax)}m`],
      [t('blocksMined'), `${run.stats.mined}`],
      [t('oresSold'), `${run.stats.sold}`],
      [t('goalLabel'), run.goalDone ? '✓' : '—'],
    ].map(([k, v]) => `<div class="stat"><span>${k}</span><b>${v}</b></div>`).join('');
    el.resRecord.classList.toggle('hidden', !run.stats.depthRecord);
    el.resRecord.textContent = t('newRecord');
    this.applyLang();
  },

  updateHUD(run) {
    const h = run.hud;
    el.coins.textContent = `${h.coins}`;
    el.depth.textContent = `${h.depth}m`;
    el.goal.textContent = h.goal.done ? t('goalDone', { v: GOAL.reward }) : t('goalDepth', { v: GOAL.target });
    el.staminaFill.style.width = `${Math.round((h.stamina / h.staminaMax) * 100)}%`;
    el.staminaTxt.textContent = `${h.stamina}/${h.staminaMax}`;
    el.bag.textContent = `${h.inv}/${h.capacity}`;
    el.crackFill.style.width = `${Math.round(h.crack * 100)}%`;
  },

  popup(ev) {
    let text = null, cls = '';
    switch (ev.type) {
      case 'ore_collect': text = t('orePickup', { v: ev.count, name: t('block_' + BLOCKS[ev.block]?.name) }); cls = 'good'; break;
      case 'sell': text = t('sold', { n: ev.n, v: ev.value }); cls = 'good'; break;
      case 'forced_return': text = t('forcedReturn'); cls = 'bad'; break;
      case 'lava_hit': text = t('lavaHit'); cls = 'bad'; break;
      case 'inventory_full': text = t('inventoryFull'); cls = 'warn'; break;
      case 'gold_vein': text = t('goldVein'); cls = 'good'; break;
      case 'treasure_found': text = t('treasureFound', { v: ev.value }); cls = 'good'; break;
      case 'depth_record': text = t('depthRecord', { v: ev.depth }); cls = 'good'; break;
      case 'goal_complete': text = t('goalDone', { v: ev.value }); cls = 'good'; break;
      case 'stamina_low': text = t('staminaLow'); cls = 'warn'; break;
      default: return;
    }
    const d = document.createElement('div');
    d.className = 'popup ' + cls;
    d.textContent = text;
    el.fx.appendChild(d);
    while (el.fx.children.length > 6) el.fx.removeChild(el.fx.firstChild);
    setTimeout(() => d.remove(), 1400);
  },

  // ---------- 升级面板 ----------
  openUpgrade(run) {
    this.run = run;
    this.buildUpgrades(run);
    hideScreens();
    el.upgrade.classList.remove('hidden');
    this.applyLang();
  },
  closeUpgrade() { el.upgrade.classList.add('hidden'); },

  buildUpgrades(run) {
    el.upgGrid.innerHTML = '';
    const order = ['pick', 'pack', 'stamina', 'lamp', 'vein', 'double', 'smelt', 'sort', 'lava'];
    for (const id of order) {
      const u = UPGRADES[id];
      const stat = u.levels != null;
      const cur = run.upgrades[id];
      const maxed = stat ? cur >= u.levels : !!cur;
      const cost = stat ? (maxed ? 0 : u.costs[cur]) : u.cost;
      const card = document.createElement('div');
      card.className = 'upg-card';
      const lvl = stat ? ` Lv${cur}/${u.levels}` : (cur ? ` ${t('owned')}` : '');
      card.innerHTML = `<b>${t('upg_' + id)}${lvl}</b><small>${t('upg_' + id + '_d')}</small>`;
      const btn = document.createElement('button');
      btn.textContent = maxed ? (stat ? 'MAX' : t('owned')) : `${cost} 🪙`;
      btn.disabled = maxed;
      btn.addEventListener('click', () => {
        const r = buyUpgrade(run, id);
        if (r.ok) { this.applyLang(); this.updateHUD(run); if (this.run) this.buildUpgrades(this.run); }
        else if (r.need) { btn.textContent = t('needCoins', { v: r.need }); setTimeout(() => this.buildUpgrades(run), 900); }
      });
      card.appendChild(btn);
      el.upgGrid.appendChild(card);
    }
  },
};
