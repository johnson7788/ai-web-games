// src/ui/ui.js — 屏幕/HUD/首次交互引导。视觉样式在 styles.css。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';
import { save } from '../core/save.js';
import { ratingFor } from '../game/sim.js';

const $ = (id) => document.getElementById(id);
const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
const el = {
  hud: $('hud'), holdZone: $('hold-zone'), holdHint: $('hold-hint'),
  score: $('hud-score'), mult: $('hud-mult'), dist: $('hud-dist'), shield: $('hud-shield'), segment: $('hud-segment'),
  title: $('screen-title'), pause: $('screen-pause'), results: $('screen-results'),
  titleBest: $('title-best'),
  resTitle: $('res-title'), resSub: $('res-sub'), resRating: $('res-rating'),
  resScore: $('res-score'), resBest: $('res-best'), resRecord: $('res-record'), resStats: $('res-stats'),
  tut: $('tutorial'), tutText: $('tut-text'), tutDots: $('tut-dots'), tutHighlight: $('tut-highlight'),
  rotate: $('rotate'),
};

const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// ---------------------------------------------------------------- 教学（3 步，真实动作推进）
const TUT_STEPS = ['tut1', 'tut2', 'tut3'];
const TUT_TARGET = ['#hold-hint', '#hud-score-box', '#hud-mult'];
const tutorial = {
  active: false, step: 0,
  get steps() { return TUT_STEPS; },
  get current() { return TUT_STEPS[this.step]; },
  start() {
    this.active = true; this.step = 0;
    this._fromTitle = !el.title.classList.contains('hidden');
    el.tut.classList.toggle('from-title', this._fromTitle);
    el.tut.classList.remove('hidden');
    el.holdHint.classList.add('hidden'); // 引导期间由卡片说明操作，避免与底部条重复
    this.render();
  },
  skip() { this.active = false; el.tut.classList.add('hidden'); el.tutHighlight.classList.add('hidden'); el.holdHint.classList.remove('hidden'); this._fromTitle = false; save.set('tutDone', true); },
  next() { if (!this.active) return; this.step++; if (this.step >= TUT_STEPS.length) this.skip(); else this.render(); },
  render() {
    el.tutText.textContent = t(TUT_STEPS[this.step]);
    el.tutDots.innerHTML = TUT_STEPS.map((_, i) => `<span class="dot${i === this.step ? ' on' : ''}"></span>`).join('');
    $('tut-next').textContent = t('tutNext');
    $('tut-skip').textContent = t('tutSkip');
    const target = document.querySelector(TUT_TARGET[this.step]);
    if (target && target.getBoundingClientRect().width > 0 && !target.classList.contains('hidden')) {
      const stage = el.hud.getBoundingClientRect();
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

function hideScreens() { for (const s of [el.title, el.pause, el.results]) s.classList.add('hidden'); }

export const ui = {
  tutorial,
  get lang() { return i18n.lang; },
  get dir() { return i18n.dir; },
  isTouch,

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
    $('btn-mute').textContent = save.get('muted', false) ? t('unmute') : t('mute');
    $('rotate-text').textContent = t('rotate');
    $('btn-rotate-skip').textContent = t('rotateSkip');
    for (const sel of [$('lang-select'), $('lang-select-pause')]) {
      sel.innerHTML = '';
      for (const o of i18n.options()) {
        const opt = document.createElement('option');
        opt.value = o.code; opt.textContent = o.name;
        if (o.code === i18n.lang) opt.selected = true;
        sel.appendChild(opt);
      }
    }
    if (this._rating != null && !el.results.classList.contains('hidden')) el.resRating.textContent = this._rating;
    if (tutorial.active) tutorial.render();
  },

  setLang(lang) { i18n.setLang(lang); this.applyLang(); return i18n.lang; },

  showTitle() {
    hideScreens();
    el.title.classList.remove('hidden');
    el.hud.classList.add('hidden');
    el.holdZone.classList.add('hidden');
    el.holdHint.classList.add('hidden');
    el.titleBest.textContent = String(save.get('best', 0));
    this.applyLang();
  },
  showGame() {
    hideScreens();
    el.hud.classList.remove('hidden');
    el.holdZone.classList.remove('hidden'); // 桌面鼠标 + 触屏都能按住
    el.holdHint.classList.remove('hidden');
  },
  showPause() { hideScreens(); el.pause.classList.remove('hidden'); el.holdZone.classList.add('hidden'); this.applyLang(); },
  hidePause() { el.pause.classList.add('hidden'); el.holdZone.classList.remove('hidden'); },

  showResults(run, info) {
    hideScreens();
    el.results.classList.remove('hidden');
    el.hud.classList.add('hidden');
    el.holdZone.classList.add('hidden');
    const win = run.phase === 'finished';
    el.resTitle.textContent = win ? t('title') : t('gameover');
    el.resSub.textContent = win ? t('resultsSub') : t('resultsSub');
    this._rating = info.rating;
    el.resRating.textContent = info.rating;
    el.resRating.className = 'rank-' + info.rating;
    el.resScore.textContent = String(info.score);
    el.resBest.textContent = String(info.best);
    el.resRecord.classList.toggle('hidden', !info.isRecord);
    el.resRecord.textContent = t('newRecord');
    el.resStats.innerHTML = [
      [t('statDistance'), `${Math.round(run.dist)}m`],
      [t('statPerfect'), run.stats.perfects],
      [t('statTop'), '×' + run.stats.topMult],
      [t('statOrbs'), run.stats.orbs],
      [t('statTime'), fmtTime(run.time)],
    ].map(([k, v]) => `<div class="stat"><span>${k}</span><b>${v}</b></div>`).join('');
    this.applyLang();
  },

  updateHUD(run, hud) {
    el.score.textContent = String(hud.score);
    el.dist.textContent = `${Math.floor(hud.dist)}m`;
    el.mult.textContent = '×' + hud.mult;
    el.mult.classList.toggle('hot', hud.mult >= 5);
    el.shield.textContent = '◆';
    el.shield.classList.toggle('off', hud.shield <= 0);
    el.segment.textContent = 'S' + hud.level;
  },

  popup(ev) {
    let text = null, cls = 'good';
    if (ev.type === 'perfect') { text = t('mult').toUpperCase() + ' ×' + ev.mult; cls = 'gold'; }
    else if (ev.type === 'combo') { text = 'COMBO ×' + ev.mult; cls = 'gold'; }
    else if (ev.type === 'nearMiss') { text = 'NEAR +' + ev.add; cls = 'good'; }
    else if (ev.type === 'orb') { text = ev.shield ? 'SHIELD +1' : 'ORB +' + Math.round(ev.add || 0); cls = 'good'; }
    else if (ev.type === 'shield') { text = 'SHIELD DOWN'; cls = 'bad'; }
    else if (ev.type === 'segment') { text = 'SECTOR ' + ev.level; cls = 'gold'; }
    if (!text) return;
    const d = document.createElement('div');
    d.className = 'popup ' + cls;
    d.textContent = text;
    $('fx-layer').appendChild(d);
    while ($('fx-layer').children.length > 6) $('fx-layer').removeChild($('fx-layer').firstChild);
    setTimeout(() => d.remove(), 1100);
  },
};
