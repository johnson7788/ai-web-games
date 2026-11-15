// src/ui/ui.js — 屏幕 / HUD / 教学 / 弹字。样式在 styles.css。
// 契约：showTitle/showGame/showPause/hidePause/showResults/updateHUD/popup/applyLang + tutorial 对象。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';
import { save } from '../core/save.js';
import { SEGMENTS } from '../../config/game.config.js';

const $ = (id) => document.getElementById(id);
const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

const el = {
  hud: $('hud'), score: $('hud-score'), combo: $('hud-combo'),
  distance: $('hud-distance'), speed: $('hud-speed'), nitro: $('hud-nitro-fill'), segment: $('hud-segment'),
  title: $('screen-title'), pause: $('screen-pause'), results: $('screen-results'),
  titleBest: $('title-best'), resTitle: $('res-title'), resSub: $('res-sub'), resRating: $('res-rating'),
  resScore: $('res-score'), resBest: $('res-best'), resRecord: $('res-record'), resStats: $('res-stats'),
  tut: $('tutorial'), tutText: $('tut-text'), tutDots: $('tut-dots'), tutHighlight: $('tut-highlight'),
  fx: $('fx-layer'), flash: $('flash'), rotate: $('rotate'),
};

// ---------------------------------------------------------------- 教学（4 步，真实动作推进）
const TUT_STEPS = ['tut1', 'tut2', 'tut3', 'tut4'];
const TUT_TARGET = ['hud-speed-box', 'tut-road-zone', 'hud-nitro', 'hud-score-box'];
const tutorial = {
  active: false, step: 0,
  get steps() { return TUT_STEPS; },
  get current() { return TUT_STEPS[this.step]; },
  start(fromTitle = false) {
    this.active = true; this.step = 0;
    this._fromTitle = fromTitle;
    el.tut.classList.toggle('from-title', fromTitle);
    el.tut.classList.remove('hidden');
    this.render();
  },
  skip() {
    this.active = false;
    this._fromTitle = false;
    el.tut.classList.add('hidden');
    el.tut.classList.remove('from-title');
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
    el.tutDots.innerHTML = TUT_STEPS.map((_, i) => `<span class="dot${i === this.step ? ' on' : ''}"></span>`).join('');
    $('tut-next').textContent = t('tutNext');
    $('tut-skip').textContent = t('tutSkip');
    const target = $(TUT_TARGET[this.step]);
    const stage = $('stage').getBoundingClientRect();
    if (this._fromTitle || !target) {
      el.tutHighlight.classList.add('hidden');
    } else {
      const r = target.getBoundingClientRect();
      const s = stage.width / 1280;
      el.tutHighlight.style.left = `${(r.left - stage.left) / s - 6}px`;
      el.tutHighlight.style.top = `${(r.top - stage.top) / s - 6}px`;
      el.tutHighlight.style.width = `${r.width / s + 12}px`;
      el.tutHighlight.style.height = `${r.height / s + 12}px`;
      el.tutHighlight.classList.remove('hidden');
    }
  },
};

function hideScreens() {
  for (const s of [el.title, el.pause, el.results]) s.classList.add('hidden');
}

export const ui = {
  tutorial,
  get lang() { return i18n.lang; },
  get dir() { return i18n.dir; },
  _rating: null,

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
    $('btn-share').textContent = t('share');
    $('btn-menu').textContent = t('menu');
    $('btn-throttle').textContent = t('throttle');
    $('btn-nitro').textContent = t('nitro');
    $('rotate-text').textContent = t('rotate');
    $('btn-rotate-skip').textContent = t('rotateSkip');
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
    if (this._rating != null && !el.results.classList.contains('hidden')) {
      el.resRating.innerHTML = `<span class="rank-label">${t('rating')}</span>${this._rating}`;
    }
    if (tutorial.active) tutorial.render();
    this.updateHUD(this._hud || null);
  },

  setLang(lang) { i18n.setLang(lang); this.applyLang(); return i18n.lang; },

  showTitle() {
    hideScreens();
    el.title.classList.remove('hidden');
    el.hud.classList.add('hidden');
    $('touch').classList.add('hidden');
    el.titleBest.textContent = `${save.get('best', 0)} ${t('meters')}`;
    this.applyLang();
  },

  showGame() {
    hideScreens();
    el.hud.classList.remove('hidden');
    $('touch').classList.toggle('hidden', !isTouch);
    el.flash.classList.add('hidden');
  },

  showPause() { hideScreens(); el.pause.classList.remove('hidden'); this.applyLang(); },
  hidePause() { el.pause.classList.add('hidden'); $('touch').classList.toggle('hidden', !isTouch); },

  showResults(run, info) {
    hideScreens();
    el.results.classList.remove('hidden');
    el.hud.classList.add('hidden');
    $('touch').classList.add('hidden');
    this._rating = info.rating;
    el.resTitle.textContent = t('resultsTitle');
    el.resSub.textContent = t('resultsSub');
    el.resRating.innerHTML = `<span class="rank-label">${t('rating')}</span>${info.rating}`;
    el.resRating.className = 'rank-' + info.rating;
    el.resScore.textContent = String(info.score);
    el.resBest.textContent = `${info.best} ${t('meters')}`;
    el.resRecord.classList.toggle('hidden', !info.isRecord);
    el.resRecord.textContent = t('newRecord');
    el.resStats.innerHTML = [
      [t('statDistance'), `${Math.floor(info.distance)}${t('meters')}`],
      [t('statNear'), String(info.nearMisses)],
      [t('statCombo'), '×' + info.topCombo],
      [t('statTime'), fmtTime(info.time)],
    ].map(([k, v]) => `<div class="stat"><span>${k}</span><b>${v}</b></div>`).join('');
    this.applyLang();
  },

  updateHUD(run) {
    this._hud = run;
    if (!run) return;
    const h = run.hud || run;
    el.score.textContent = String(h.score);
    el.combo.textContent = h.combo >= 2 ? '×' + h.combo : '';
    el.distance.textContent = `${Math.floor(h.distance)} ${t('meters')}`;
    el.speed.textContent = String(h.kmh);
    el.nitro.style.width = `${Math.round(h.nitro * 100)}%`;
    el.nitro.parentElement.parentElement.classList.toggle('ready', h.nitro >= 0.999);
    const seg = SEGMENTS[h.segment] || SEGMENTS[0];
    el.segment.textContent = t('segment' + seg.name.charAt(0).toUpperCase() + seg.name.slice(1));
    el.segment.className = 'seg-' + seg.name;
  },

  popup(ev) {
    let text = null, cls = '';
    if (ev.type === 'nearMiss') { text = t('nearMiss', { v: ev.bonus }); cls = 'good'; this._flash('0, 180, 90'); }
    else if (ev.type === 'combo') { text = t('comboPop', { n: ev.n }); cls = 'good'; }
    else if (ev.type === 'boost') { text = t('boost'); cls = 'nitro'; }
    else if (ev.type === 'checkpoint') { text = t('checkpoint', { n: ev.m }); cls = 'good'; this._flash('120, 200, 255'); }
    else if (ev.type === 'crash') { text = t('crash'); cls = 'bad'; this._flash('255, 40, 40', 0.35); }
    else if (ev.type === 'segment') { text = t('segment' + ev.name.charAt(0).toUpperCase() + ev.name.slice(1)); cls = 'warn'; }
    if (!text) return;
    const d = document.createElement('div');
    d.className = 'popup ' + cls;
    d.textContent = text;
    el.fx.appendChild(d);
    while (el.fx.children.length > 6) el.fx.removeChild(el.fx.firstChild);
    setTimeout(() => d.remove(), 1300);
  },

  _flash(rgb, alpha = 0.18) {
    el.flash.style.background = `rgba(${rgb}, ${alpha})`;
    el.flash.classList.remove('flash-on');
    void el.flash.offsetWidth;
    el.flash.classList.add('flash-on');
  },
};

function fmtTime(s) {
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}
