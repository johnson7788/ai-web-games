// src/ui/ui.js — 屏幕 / HUD / 教学 / 触屏。样式在 styles.css。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';
import { save } from '../core/save.js';

const $ = (id) => document.getElementById(id);
const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

const el = {
  title: $('screen-title'), pause: $('screen-pause'), results: $('screen-results'),
  hud: $('hud'), touch: $('touch'), fx: $('fx-layer'),
  scoreP: $('hud-score-p'), scoreO: $('hud-score-o'),
  clock: $('hud-clock'), level: $('hud-level'), boostFill: $('hud-boost-fill'),
  titleBest: $('title-best'), titleWins: $('title-wins'),
  resTitle: $('res-title'), resSub: $('res-sub'), resRating: $('res-rating'),
  resStats: $('res-stats'), btnPrimary: $('btn-res-primary'),
  tut: $('tutorial'), tutText: $('tut-text'), tutDots: $('tut-dots'), tutHighlight: $('tut-highlight'),
  rotate: $('rotate'),
};

const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// ---------------------------------------------------------------- 教学（4 步，真实动作推进）
const TUT_STEPS = ['tut1', 'tut2', 'tut3', 'tut4'];
const TUT_TARGET = ['hud-score-box', 'hud-bars-box', 'hud-score-box', 'hud-time-box'];
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

function hideScreens() {
  for (const s of [el.title, el.pause, el.results]) s.classList.add('hidden');
}

export const ui = {
  tutorial,
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
    $('btn-share').textContent = t('share');
    $('btn-menu-res').textContent = t('menu');
    $('btn-boost').textContent = t('boost');
    $('btn-jump').textContent = t('aerial').replace('!', '');
    $('btn-throttle').textContent = 'GO';
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
    if (tutorial.active) tutorial.render();
  },

  setLang(lang) { i18n.setLang(lang); this.applyLang(); return i18n.lang; },

  showTitle() {
    hideScreens();
    el.title.classList.remove('hidden');
    el.hud.classList.add('hidden');
    el.touch.classList.add('hidden');
    el.titleBest.textContent = String(save.get('bestGoal', 0));
    el.titleWins.textContent = String(save.get('wins', 0));
    this.applyLang();
  },
  showGame() {
    hideScreens();
    el.hud.classList.remove('hidden');
    el.touch.classList.toggle('hidden', !isTouch);
    this.applyLang();
  },
  showPause() { hideScreens(); el.pause.classList.remove('hidden'); el.touch.classList.add('hidden'); this.applyLang(); },
  hidePause() { el.pause.classList.add('hidden'); el.touch.classList.toggle('hidden', !isTouch); },

  showResults(info) {
    hideScreens();
    el.results.classList.remove('hidden');
    el.hud.classList.add('hidden');
    el.touch.classList.add('hidden');
    const win = info.result === 'win';
    const champ = info.champion;
    el.resTitle.textContent = champ ? t('champion') : (win ? t('matchWon') : t('matchLost'));
    el.resSub.textContent = t('matchN', { n: info.level });
    el.resRating.textContent = info.rating;
    el.resRating.className = 'rank-' + info.rating;
    el.btnPrimary.textContent = champ ? t('restart') : (win ? t('nextMatch') : t('retry'));
    el.resStats.innerHTML = [
      [t('goals'), `${info.scoreP} : ${info.scoreO}`],
      [t('score'), String(Math.round(info.score))],
      [t('bestGoal'), String(Math.round(info.bestGoalSpeed)) + ' ' + 'km/h'],
    ].map(([k, v]) => `<div class="stat"><span>${k}</span><b>${v}</b></div>`).join('');
    this.applyLang();
  },

  updateHUD(h) {
    el.scoreP.textContent = String(h.scoreP);
    el.scoreO.textContent = String(h.scoreO);
    el.clock.textContent = h.overtime ? 'OT' : fmtTime(h.clock);
    el.level.textContent = t('matchN', { n: h.level });
    el.boostFill.style.width = `${Math.round(h.boost * 100)}%`;
    el.boostFill.classList.toggle('hot', h.boostOn);
  },

  popup(ev) {
    let text = null, cls = '';
    if (ev.type === 'goal') { text = t('goal'); cls = 'good'; }
    else if (ev.type === 'concede') { text = t('concede'); cls = 'bad'; }
    else if (ev.type === 'demo') { text = t('demo'); cls = 'good'; }
    else if (ev.type === 'demoed') { text = t('demoed'); cls = 'bad'; }
    else if (ev.type === 'overtime') { text = t('overtime'); cls = 'warn'; }
    else if (ev.type === 'kickoff') { text = t('kickoff'); cls = 'warn'; }
    else if (ev.type === 'aerial') { text = t('aerial'); cls = 'good'; }
    if (!text) return;
    const d = document.createElement('div');
    d.className = 'popup ' + cls;
    d.textContent = text;
    el.fx.appendChild(d);
    while (el.fx.children.length > 5) el.fx.removeChild(el.fx.firstChild);
    setTimeout(() => d.remove(), 1400);
  },
};

$('tut-next').addEventListener('click', () => tutorial.next());
$('tut-skip').addEventListener('click', () => tutorial.skip());
