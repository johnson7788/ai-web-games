// src/ui/ui.js — 屏幕/HUD/教学/升级/结算。视觉样式在 styles.css。
// 契约：showTitle/showGame/showPause/hidePause/showResults/showUpgrade/updateHUD/popup/applyLang + tutorial。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';
import { save } from '../core/save.js';
import { MATCH } from '../../config/game.config.js';

const $ = (id) => document.getElementById(id);
const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
const el = {
  hud: $('hud'), hpFill: $('hud-hp-fill'), hpNum: $('hud-hp-num'), weapon: $('hud-weapon-val'),
  match: $('hud-match'), alive: $('hud-alive'), time: $('hud-time'),
  kills: $('hud-kills'), falls: $('hud-falls'), ultFill: $('hud-ult-fill'), hint: $('hud-hint'),
  fx: $('fx-layer'),
  title: $('screen-title'), pause: $('screen-pause'), results: $('screen-results'), upgrade: $('screen-upgrade'),
  titleBest: $('title-best'), resTitle: $('res-title'), resSub: $('res-sub'), resRating: $('res-rating'),
  resScore: $('res-score'), resRecord: $('res-record'), resStats: $('res-stats'),
  upgradeGrid: $('upgrade-grid'),
  tut: $('tutorial'), tutText: $('tut-text'), tutDots: $('tut-dots'), tutHighlight: $('tut-highlight'),
};

const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// ---------------------------------------------------------------- 教学（4 步，真实动作推进）
const TUT_STEPS = ['tut1', 'tut2', 'tut3', 'tut4'];
const TUT_TARGET = ['hud-hint', 'hud-hint', 'hud-hint', 'hud-alive'];
const tutorial = {
  active: false, step: 0,
  get steps() { return TUT_STEPS; },
  get current() { return TUT_STEPS[this.step]; },
  start(mode) {
    this.active = true; this.step = 0;
    el.tut.classList.toggle('modal', mode === 'title');
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
    } else el.tutHighlight.classList.add('hidden');
  },
};
$('tut-next').addEventListener('click', () => tutorial.next());
$('tut-skip').addEventListener('click', () => tutorial.skip());

// ---------------------------------------------------------------- 屏幕
function hideScreens() { for (const s of [el.title, el.pause, el.results, el.upgrade]) s.classList.add('hidden'); }

export const ui = {
  tutorial,
  isTouch,
  get lang() { return i18n.lang; },
  get dir() { return i18n.dir; },

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
    $('btn-restart').textContent = t('restart');
    $('btn-share').textContent = 'SHARE';
    $('btn-menu').textContent = t('menu');
    $('upgrade-title').textContent = t('upgradeTitle');
    $('upgrade-sub').textContent = t('upgradeSub');
    $('rotate-text').textContent = t('rotate');
    $('btn-rotate-skip').textContent = t('rotateSkip');
    $('btn-touch-punch').textContent = t('touchPunch');
    $('btn-touch-grab').textContent = t('touchGrab');
    $('btn-touch-ult').textContent = t('touchUlt');
    $('btn-mute').textContent = save.get('muted', false) ? t('unmute') : t('mute');
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
    $('touch').classList.add('hidden');
    el.titleBest.textContent = String(save.get('best', 0));
    this.applyLang();
  },
  showGame() {
    hideScreens();
    el.hud.classList.remove('hidden');
    $('touch').classList.toggle('hidden', !isTouch);
  },
  showPause() { hideScreens(); el.pause.classList.remove('hidden'); this.applyLang(); },
  hidePause() { el.pause.classList.add('hidden'); $('touch').classList.toggle('hidden', !isTouch); },

  showUpgrade(run, onPick) {
    hideScreens();
    el.upgrade.classList.remove('hidden');
    el.hud.classList.add('hidden');
    el.upgradeGrid.innerHTML = '';
    for (const id of run.upgradeChoices) {
      const b = document.createElement('button');
      b.className = 'upgrade-card';
      b.innerHTML = `<b>${t('upgrade_' + id.replaceAll('-', '_'))}</b><small>${t('upgrade_' + id.replaceAll('-', '_') + '_d')}</small>`;
      b.addEventListener('click', () => onPick(id));
      el.upgradeGrid.appendChild(b);
    }
    this.applyLang();
  },

  showResults(run, info) {
    hideScreens();
    el.results.classList.remove('hidden');
    el.hud.classList.add('hidden');
    $('touch').classList.add('hidden');
    const win = info.won;
    el.resTitle.textContent = win ? t('winTitle') : t('loseTitle');
    el.resSub.textContent = win ? t('winSub') : t('loseSub');
    el.resRating.textContent = t('rating') + ' ' + info.rating;
    el.resRating.className = 'rank-' + info.rating;
    el.resScore.textContent = String(info.score);
    el.resRecord.classList.toggle('hidden', !info.isRecord);
    el.resRecord.textContent = t('newRecord');
    el.resStats.innerHTML = [
      [t('statKills'), run.stats.kills],
      [t('statFalls'), run.stats.falls],
      [t('statWins'), run.stats.wins],
      [t('statTime'), fmtTime(run.totalTime || 0)],
    ].map(([k, v]) => `<div class="stat"><span>${k}</span><b>${v}</b></div>`).join('');
    this.applyLang();
  },

  updateHUD(run) {
    const h = run.hud;
    const hpPct = Math.max(0, Math.min(1, h.hp / h.maxHp));
    el.hpFill.style.width = `${Math.round(hpPct * 100)}%`;
    el.hpNum.textContent = String(h.hp);
    el.weapon.textContent = t(h.weapon ? 'weapon_' + h.weapon : 'weapon_none') + (h.weapon ? ` ${h.weaponDur}` : '');
    el.match.textContent = `${h.match}/${h.rounds}`;
    el.alive.textContent = String(h.alive);
    el.time.textContent = fmtTime(Math.max(0, MATCH.time - h.time));
    el.kills.textContent = String(h.kills);
    el.falls.textContent = String(h.falls);
    el.ultFill.style.width = `${Math.round(h.ultPct * 100)}%`;
    el.hint.textContent = tutorial.active
      ? (isTouch ? `${t('touchPunch')} · ${t('touchGrab')} · ${t('touchUlt')}` : `${t('hintMove')} · ${t('hintPunch')} · ${t('hintGrab')}`)
      : t('objective');
  },

  popup(ev) {
    let text = null, cls = '';
    if (ev.type === 'kill' && ev.by === 0) { text = 'KO!'; cls = 'good'; }
    else if (ev.type === 'fall' && ev.by === 0) { text = 'RING-OUT!'; cls = 'good'; }
    else if (ev.type === 'weaponPickup' && ev.id === 0) { text = t('weapon_' + ev.weapon); cls = 'pickup'; }
    if (!text) return;
    const d = document.createElement('div');
    d.className = 'popup ' + cls;
    d.textContent = text;
    el.fx.appendChild(d);
    while (el.fx.children.length > 5) el.fx.removeChild(el.fx.firstChild);
    setTimeout(() => d.remove(), 1200);
  },
};
