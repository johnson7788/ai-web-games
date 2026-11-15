// src/ui/ui.js — 屏幕/HUD/教学/触屏/赛道选择。样式在 styles.css。
// 契约：showTitle/showGame/showPause/hidePause/showResults/updateHUD/popup/applyLang。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';
import { save } from '../core/save.js';
import { TRACKS, CONFIG } from '../../config/game.config.js';

const $ = (id) => document.getElementById(id);
const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
const el = {
  title: $('screen-title'), pause: $('screen-pause'), results: $('screen-results'),
  hud: $('hud'), touch: $('touch'),
  speed: $('hud-speed'), rank: $('hud-rank'), lap: $('hud-lap'), time: $('hud-time'),
  penalty: $('hud-penalty'), ring: $('hud-ring'), boost: $('hud-boost-fill'),
  boostReady: $('hud-boost-wrap'), arrow: $('ring-arrow'), arrowUp: $('ring-arrow-up'), arrowDown: $('ring-arrow-down'),
  countdown: $('countdown'), cd: $('countdown-text'),
  titleBest: $('title-best'), trackCards: $('track-cards'), controls: $('controls-hint'),
  resTitle: $('res-title'), resSub: $('res-sub'), resRating: $('res-rating'), resRank: $('res-rank'),
  resTime: $('res-time'), resBest: $('res-best'), resRecord: $('res-record'), resStats: $('res-stats'),
  tut: $('tutorial'), tutText: $('tut-text'), tutDots: $('tut-dots'), tutHighlight: $('tut-highlight'),
};

const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// ---------------- 教学（4 步，真实动作推进） ----------------
const TUT_STEPS = ['tut1', 'tut2', 'tut3', 'tut4'];
const TUT_TARGET = ['hud-speed-box', 'hud-race-box', 'hud-bars-box', 'hud-ring-box'];
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
    if (this._fromTitle) el.title.classList.remove('hidden');
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
    if (target && !this._fromTitle && target.getBoundingClientRect().width > 0) {
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

// ---------------- 赛道选择 ----------------
let trackIndex = save.get('trackIndex', 0);
function buildTracks() {
  el.trackCards.innerHTML = '';
  TRACKS.forEach((tr, i) => {
    const b = document.createElement('button');
    b.className = 'track-card' + (i === trackIndex ? ' on' : '');
    b.innerHTML = `<span class="tk-idx">${i + 1}</span><span>${t('track' + i)}</span>`;
    b.addEventListener('click', () => { trackIndex = i; save.set('trackIndex', i); buildTracks(); });
    el.trackCards.appendChild(b);
  });
}

function hideScreens() {
  for (const s of [el.title, el.pause, el.results]) s.classList.add('hidden');
}

// ---------------- 触屏（左摇杆飞行，右 boost/刹车） ----------------
const touch = { pitch: 0, yaw: 0, boost: false, brake: false };
function setupTouch() {
  const joy = $('joy'), knob = $('joy-knob');
  let id = null, cx = 0, cy = 0;
  const R = 44;
  joy.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t = e.changedTouches[0];
    id = t.identifier;
    const r = joy.getBoundingClientRect();
    cx = r.left + r.width / 2; cy = r.top + r.height / 2;
    move(t.clientX, t.clientY);
  }, { passive: false });
  joy.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) if (t.identifier === id) move(t.clientX, t.clientY);
  }, { passive: false });
  const end = (e) => {
    for (const t of e.changedTouches) if (t.identifier === id) {
      id = null; touch.pitch = 0; touch.yaw = 0;
      knob.style.transform = 'translate(-50%, -50%)';
    }
  };
  joy.addEventListener('touchend', end); joy.addEventListener('touchcancel', end);
  function move(x, y) {
    let dx = x - cx, dy = y - cy;
    const d = Math.hypot(dx, dy);
    if (d > R) { dx *= R / d; dy *= R / d; }
    knob.style.transform = `translate(${dx - 14}px, ${dy - 14}px)`;
    touch.pitch = clamp(-dy / R, -1, 1); // 上推 = 爬升（+1）
    touch.yaw = clamp(dx / R, -1, 1);
  }
  const bind = (sel, key) => {
    const btn = $(sel);
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); touch[key] = true; btn.classList.add('active'); }, { passive: false });
    const up = (e) => { e.preventDefault(); touch[key] = false; btn.classList.remove('active'); };
    btn.addEventListener('touchend', up); btn.addEventListener('touchcancel', up);
  };
  bind('btn-boost', 'boost'); bind('btn-brake', 'brake');
}
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

export const ui = {
  tutorial, touch,
  get lang() { return i18n.lang; },
  get dir() { return i18n.dir; },
  getTrack: () => trackIndex,

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
    $('btn-boost').textContent = t('boostLabel');
    $('btn-brake').textContent = t('brakeLabel');
    $('rotate-text').textContent = t('rotate');
    $('btn-rotate-skip').textContent = t('rotateSkip');
    $('btn-mute').textContent = save.get('muted', false) ? t('unmute') : t('mute');
    el.controls.textContent = t('controls');
    for (const sel of [$('lang-select'), $('lang-select-pause')]) {
      sel.innerHTML = '';
      for (const o of i18n.options()) {
        const opt = document.createElement('option');
        opt.value = o.code; opt.textContent = o.name;
        if (o.code === i18n.lang) opt.selected = true;
        sel.appendChild(opt);
      }
    }
    buildTracks();
    if (tutorial.active) tutorial.render();
  },

  setLang(lang) { i18n.setLang(lang); this.applyLang(); return i18n.lang; },

  showTitle() {
    hideScreens();
    el.title.classList.remove('hidden');
    el.hud.classList.add('hidden');
    el.touch.classList.add('hidden');
    el.titleBest.textContent = save.get('best', 0) ? fmtTime(save.get('best', 0)) : '--';
    this.applyLang();
  },
  showGame() {
    hideScreens();
    el.hud.classList.remove('hidden');
    el.touch.classList.toggle('hidden', !isTouch);
    el.countdown.classList.remove('hidden');
  },
  showPause() { hideScreens(); el.pause.classList.remove('hidden'); el.touch.classList.add('hidden'); this.applyLang(); },
  hidePause() { el.pause.classList.add('hidden'); el.touch.classList.toggle('hidden', !isTouch); },

  showResults(run, info) {
    hideScreens();
    el.results.classList.remove('hidden');
    el.hud.classList.add('hidden');
    el.touch.classList.add('hidden');
    el.resTitle.textContent = t('resultsTitle');
    el.resSub.textContent = t('finished');
    el.resRating.textContent = info.rating;
    el.resRating.className = 'rank-' + info.rating;
    el.resRank.textContent = '#' + info.rank;
    el.resTime.textContent = fmtTime(info.time);
    el.resBest.textContent = fmtTime(info.best);
    el.resRecord.classList.toggle('hidden', !info.isRecord);
    el.resRecord.textContent = t('newRecord');
    el.resStats.innerHTML = [
      [t('statTime'), fmtTime(run.time)],
      [t('statRings'), `${run.player.ringsPassed}/${run.stats.ringsTotal}`],
      [t('statMiss'), run.stats.misses],
      [t('statCrash'), run.stats.crashes],
      [t('statTopSpeed'), `${Math.round(run.stats.topSpeed * 3.6)}`],
    ].map(([k, v]) => `<div class="stat"><span>${k}</span><b>${v}</b></div>`).join('');
    this.applyLang();
  },

  updateHUD(h) {
    el.speed.textContent = String(h.kmh);
    el.lap.textContent = `${h.lap}/${h.laps}`;
    el.time.textContent = fmtTime(h.time);
    el.penalty.textContent = h.penalty > 0 ? `+${h.penalty.toFixed(0)}s` : '';
    el.ring.textContent = `${h.ring}/${h.ringCount}`;
    el.boost.style.width = `${Math.round(h.boost * 100)}%`;
    el.boostReady.classList.toggle('ready', h.boost >= 0.99);
    // 下一环箭头
    el.arrow.style.transform = `rotate(${h.arrowDeg}deg)`;
    el.arrowUp.classList.toggle('hidden', !h.above);
    el.arrowDown.classList.toggle('hidden', h.above);
  },

  updateCountdown(h) {
    const remain = h.simPhase === 'countdown' ? Math.max(0, 3 - h.countdown) : (h.simPhase === 'race' && h.time < 1.2 ? 0 : -1);
    if (h.simPhase === 'race' && h.time < 1.2) {
      el.cd.textContent = t('go');
    } else if (remain > 0) {
      el.cd.textContent = String(Math.ceil(remain));
    }
    el.countdown.classList.toggle('hidden', !(remain > 0 || (h.simPhase === 'race' && h.time < 1.2)));
  },

  popup(ev) {
    let text = null, cls = '';
    if (ev.type === 'ringPass') { text = t('ringPass', { v: ev.n }); cls = 'good'; }
    else if (ev.type === 'ringHit') { text = t('ringHit'); cls = 'bad'; }
    else if (ev.type === 'ringMiss') { text = t('ringMiss'); cls = 'warn'; }
    else if (ev.type === 'groundHit') { text = t('groundHit'); cls = 'bad'; }
    else if (ev.type === 'crash') { text = t('crash'); cls = 'bad'; }
    else if (ev.type === 'slipstream') { text = t('slipstream'); cls = 'good'; }
    else if (ev.type === 'lap') { text = t('lapClear', { n: ev.n - 1 }); cls = 'good'; }
    else if (ev.type === 'raceStart') { text = t('go'); cls = 'good'; }
    if (!text) return;
    const d = document.createElement('div');
    d.className = 'popup ' + cls;
    d.textContent = text;
    $('fx-layer').appendChild(d);
    while ($('fx-layer').children.length > 6) $('fx-layer').removeChild($('fx-layer').firstChild);
    setTimeout(() => d.remove(), 1400);
  },
};

if (isTouch) setupTouch();
