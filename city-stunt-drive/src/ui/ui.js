// src/ui/ui.js — 屏幕 / HUD / 教学 / 车库 / 弹层。样式在 styles.css。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';
import { save } from '../core/save.js';
import { CARS, GARAGE } from '../../config/game.config.js';

const $ = (id) => document.getElementById(id);
const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

const el = {
  title: $('screen-title'), pause: $('screen-pause'), results: $('screen-results'),
  hud: $('hud'), touch: $('touch'), fx: $('fx'), rotate: $('rotate'), garage: $('garage'),
  score: $('hud-score'), combo: $('hud-combo'), coins: $('hud-coins'),
  nitro: $('hud-nitro-fill'), zone: $('hud-zone'), flips: $('hud-flips'),
  speed: $('hud-speed'), time: $('hud-time'),
  titleBest: $('title-best'),
  resTitle: $('res-title'), resRating: $('res-rating'), resScore: $('res-score'),
  resBest: $('res-best'), resRecord: $('res-record'), resStats: $('res-stats'),
  tut: $('tutorial'), tutText: $('tut-text'), tutDots: $('tut-dots'), tutHighlight: $('tut-highlight'),
};

const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// ---------------------------------------------------------------- 教学（4 步，真实动作推进）
const TUT_STEPS = ['tut1', 'tut2', 'tut3', 'tut4'];
const TUT_TARGET = ['hud-bars-box', 'hud-score-box', 'hud-zone-box', 'hud-zone-box'];
export const tutorial = {
  active: false, step: 0,
  get steps() { return TUT_STEPS; },
  get current() { return TUT_STEPS[this.step]; },
  start() {
    this.active = true; this.step = 0;
    this._fromTitle = !el.title.classList.contains('hidden');
    if (this._fromTitle) el.title.classList.add('hidden');
    el.tut.classList.remove('hidden');
    el.tut.classList.toggle('from-title', this._fromTitle);
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
    const stage = $('stage').getBoundingClientRect();
    const s = stage.width / 1280;
    if (target && target.getBoundingClientRect().width > 0) {
      const r = target.getBoundingClientRect();
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

// ---------------------------------------------------------------- 车库
function buildGarage() {
  const coins = save.get('coins', 0);
  el.garage.innerHTML = '';
  CARS.forEach((c, i) => {
    const unlocked = !GARAGE[i].locked || coins >= c.cost || i === 0;
    const selected = save.get('car', 0) === i;
    const b = document.createElement('button');
    b.className = 'car-card' + (selected ? ' on' : '') + (unlocked ? '' : ' locked');
    b.innerHTML = `<span class="chip" style="background:#${c.tint.toString(16).padStart(6, '0')}"></span><span>${c.name}</span><small>${unlocked ? (selected ? t('carSelect') : '') : t('carLocked', { v: c.cost })}</small>`;
    b.addEventListener('click', () => {
      if (!unlocked) return;
      save.set('car', i);
      buildGarage();
    });
    el.garage.appendChild(b);
  });
}

// ---------------------------------------------------------------- 屏幕
function hideScreens() {
  for (const s of [el.title, el.pause, el.results]) s.classList.add('hidden');
}

export const ui = {
  tutorial,
  get lang() { return i18n.lang; },
  get dir() { return i18n.dir; },
  getCar: () => save.get('car', 0),

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
    $('btn-menu').textContent = t('menu');
    $('btn-share').textContent = t('share');
    $('btn-gas').textContent = t('touchAccel');
    $('btn-brake').textContent = t('touchBrake');
    $('btn-flip-l').textContent = t('touchFlipL');
    $('btn-flip-r').textContent = t('touchFlipR');
    $('btn-nitro').textContent = t('touchNitro');
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
    el.titleBest.textContent = `${t('best')}: ${save.get('best', 0)}`;
    buildGarage();
    if (tutorial.active) tutorial.render();
    if (this._rating != null && !el.results.classList.contains('hidden')) el.resRating.textContent = this._rating;
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

  showResults(run, info) {
    hideScreens();
    el.results.classList.remove('hidden');
    el.hud.classList.add('hidden');
    el.touch.classList.add('hidden');
    const win = run.phase === 'finished';
    el.resTitle.textContent = win ? t('finished') : t('wrecked');
    this._rating = info.rating;
    el.resRating.textContent = info.rating;
    el.resRating.className = 'rank-' + info.rating;
    el.resScore.textContent = String(info.score);
    el.resBest.textContent = String(info.best);
    el.resRecord.classList.toggle('hidden', !info.isRecord);
    el.resRecord.textContent = t('newRecord');
    el.resStats.innerHTML = [
      [t('statScore'), String(info.score)],
      [t('statCombo'), '×' + run.stats.topCombo],
      [t('statFlips'), '×' + run.stats.farthestFlip],
      [t('statCoins'), String(run.coins)],
      [t('statTime'), fmtTime(run.time)],
    ].map(([k, v]) => `<div class="stat"><span>${k}</span><b>${v}</b></div>`).join('');
    this.applyLang();
  },

  updateHUD(run) {
    const h = run.hud;
    el.score.textContent = String(h.score);
    el.combo.textContent = '×' + h.combo;
    el.combo.classList.toggle('hot', h.combo >= 3);
    el.coins.textContent = String(h.coins);
    el.nitro.style.width = `${Math.round(h.nitro * 100)}%`;
    el.nitro.parentElement.classList.toggle('ready', h.nitro >= 0.999);
    el.zone.textContent = `${h.zone}/${h.zoneTotal}`;
    el.flips.textContent = String(h.flips);
    el.speed.textContent = String(h.kmh);
    el.time.textContent = fmtTime(h.time);
  },

  popup(ev) {
    let text = null, cls = '';
    if (ev.type === 'perfect') { text = t('perfect', { v: ev.combo }); cls = 'good'; }
    else if (ev.type === 'flip') { text = t('flipText', { v: ev.circles }); cls = 'flip'; }
    else if (ev.type === 'badLand') { text = t('badLand'); cls = 'bad'; }
    else if (ev.type === 'coin') { text = t('coinText', { v: ev.value }); cls = 'coin'; }
    else if (ev.type === 'zone') { text = t('zoneClear', { n: ev.n, v: ev.bonus }); cls = 'good'; }
    else if (ev.type === 'nitroReady') { text = t('nitroReady'); cls = 'good'; }
    else if (ev.type === 'nitro') { text = t('nitroGo'); cls = 'nitro'; }
    else if (ev.type === 'wreck') { text = t('overturn'); cls = 'bad'; }
    if (!text) return;
    const d = document.createElement('div');
    d.className = 'popup ' + cls;
    d.textContent = text;
    el.fx.appendChild(d);
    while (el.fx.children.length > 6) el.fx.removeChild(el.fx.firstChild);
    setTimeout(() => d.remove(), 1300);
  },
};
