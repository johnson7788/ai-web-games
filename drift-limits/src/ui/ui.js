// src/ui/ui.js — 屏幕/HUD/教学/perk 选择。视觉样式在 styles.css（M3 主笔）。
// 逻辑契约见 README：showTitle/showGame/showPause/showResults/updateHUD/updateLights/popup/applyLang。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';
import { save } from '../core/save.js';
import { PERKS, CARS } from '../../config/game.config.js';

const $ = (id) => document.getElementById(id);
const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
const el = {
  title: $('screen-title'), pause: $('screen-pause'), results: $('screen-results'),
  hud: $('hud'), touch: $('touch'),
  score: $('hud-score'), mult: $('hud-mult'), speed: $('hud-speed'),
  nitro: $('hud-nitro-fill'), police: $('hud-police-fill'), policeM: $('hud-police-m'),
  lap: $('hud-lap'), heat: $('hud-heat'), time: $('hud-time'),
  tree: $('light-tree'), lt: [$('lt-r1'), $('lt-r2'), $('lt-r3')], ltG: $('lt-g'),
  launchHint: $('launch-hint'), fx: $('fx-layer'), vignette: $('cop-vignette'),
  titleBest: $('title-best'), carCards: $('car-cards'), perkGrid: $('perk-grid'), perkTitle: $('perk-title'),
  resTitle: $('res-title'), resSub: $('res-sub'), resRating: $('res-rating'),
  resScore: $('res-score'), resBest: $('res-best'), resRecord: $('res-record'), resStats: $('res-stats'),
  tut: $('tutorial'), tutText: $('tut-text'), tutDots: $('tut-dots'), tutHighlight: $('tut-highlight'),
};

const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// ---------------------------------------------------------------- 教学（4 步，真实动作推进）
const TUT_STEPS = ['tut1', 'tut2', 'tut3', 'tut4'];
const TUT_TARGET = ['light-tree', 'hud-score-box', 'hud-bars-box', 'hud-bars-box'];
const tutorial = {
  active: false, step: 0,
  get steps() { return TUT_STEPS; },
  get current() { return TUT_STEPS[this.step]; },
  start() {
    this.active = true; this.step = 0;
    // 从标题重看时保留标题屏作背景（左侧菜单+右侧留白），弹窗放右侧留白处，避免遮挡玩法画面
    this._fromTitle = !el.title.classList.contains('hidden');
    el.tut.classList.toggle('from-title', this._fromTitle);
    el.tut.classList.remove('hidden');
    this.render();
  },
  skip() {
    this.active = false;
    el.tut.classList.add('hidden');
    this._fromTitle = false;
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
$('tut-next').addEventListener('click', () => tutorial.next());
$('tut-skip').addEventListener('click', () => tutorial.skip());

// ---------------------------------------------------------------- 选择状态
let loadout = save.get('loadout', []);
let car = save.get('car', 0);

function buildCars() {
  el.carCards.innerHTML = '';
  CARS.forEach((c, i) => {
    const b = document.createElement('button');
    b.className = 'car-card' + (i === car ? ' on' : '');
    b.innerHTML = `<span class="chip" style="background:#${c.tint.toString(16).padStart(6, '0')}"></span><span>${c.name}</span>`;
    b.addEventListener('click', () => { car = i; save.set('car', i); buildCars(); });
    el.carCards.appendChild(b);
  });
}

function buildPerks() {
  const best = save.get('best', 0);
  el.perkGrid.innerHTML = '';
  PERKS.forEach((p) => {
    const unlocked = best >= p.unlock;
    const on = loadout.includes(p.id);
    const b = document.createElement('button');
    b.className = 'perk' + (on ? ' on' : '') + (unlocked ? '' : ' locked');
    b.innerHTML = `<b>${t('perk_' + p.id.replaceAll('-', '_'))}</b><small>${unlocked ? t('perk_' + p.id.replaceAll('-', '_') + '_d') : t('perkLocked', { v: p.unlock })}</small>`;
    b.addEventListener('click', () => {
      if (!unlocked) return;
      if (on) loadout = loadout.filter((x) => x !== p.id);
      else if (loadout.length < 2) loadout = [...loadout, p.id];
      save.set('loadout', loadout);
      buildPerks();
    });
    el.perkGrid.appendChild(b);
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
  getLoadout: () => loadout.filter((id) => PERKS.some((p) => p.id === id && save.get('best', 0) >= p.unlock)),
  getCar: () => car,

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
    $('btn-drift').textContent = t('driftLabel');
    $('btn-nitro').textContent = t('nitroLabel');
    el.perkTitle.textContent = t('perkTitle');
    $('rotate-text').textContent = t('rotate');
    $('btn-rotate-skip').textContent = t('rotateSkip');
    el.launchHint.textContent = t('launchHint');
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
    buildCars(); buildPerks();
    if (this._rating != null && !el.results.classList.contains('hidden')) el.resRating.innerHTML = `<span class="rank-label">${t('rating')}</span>${this._rating}`;
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
  },
  showPause() { hideScreens(); el.pause.classList.remove('hidden'); el.touch.classList.add('hidden'); this.applyLang(); },
  hidePause() { el.pause.classList.add('hidden'); el.touch.classList.toggle('hidden', !isTouch); },

  showResults(run, info) {
    hideScreens();
    el.results.classList.remove('hidden');
    el.hud.classList.add('hidden');
    el.touch.classList.add('hidden');
    const win = run.phase === 'finished';
    el.results.classList.toggle('escaped', win);
    el.results.classList.toggle('busted', !win);
    el.resTitle.textContent = win ? t('escaped') : t('busted');
    el.resSub.textContent = win ? t('resultsSubWin') : t('resultsSubBusted');
    this._rating = info.rating;
    el.resRating.innerHTML = `<span class="rank-label">${t('rating')}</span>${info.rating}`;
    el.resRating.className = 'rank-' + info.rating;
    el.resScore.textContent = String(info.score);
    el.resBest.textContent = String(info.best);
    el.resRecord.classList.toggle('hidden', !info.isRecord);
    el.resRecord.textContent = t('newRecord');
    el.resStats.innerHTML = [
      [t('statDrift'), run.stats.driftSec.toFixed(1) + t('seconds')],
      [t('statNear'), run.stats.nearMisses],
      [t('statCrash'), run.stats.crashes],
      [t('statTop'), '×' + run.stats.topMult],
      [t('statTime'), fmtTime(run.time)],
    ].map(([k, v]) => `<div class="stat"><span>${k}</span><b>${v}</b></div>`).join('');
    this.applyLang();
  },

  updateLights(lightT, phase, raceTime = 0) {
    const show = phase === 'lights' || (phase === 'race' && raceTime < 1.2);
    el.tree.classList.toggle('hidden', !show);
    el.lt.forEach((n, i) => n.classList.toggle('on', lightT > i + 0.2 && lightT < 3));
    el.ltG.classList.toggle('on', lightT >= 3);
    el.launchHint.classList.toggle('hidden', phase !== 'lights');
  },

  updateHUD(run) {
    const h = run.hud;
    el.score.textContent = String(h.score);
    el.mult.textContent = '×' + h.mult;
    el.mult.classList.toggle('hot', h.mult >= 5);
    el.speed.textContent = String(h.kmh);
    el.nitro.style.width = `${Math.round(h.nitro * 100)}%`;
    el.nitro.parentElement.classList.toggle('ready', h.nitro >= 0.999);
    const danger = Math.max(0, Math.min(1, h.gap / 60));
    el.police.style.width = `${Math.round(danger * 100)}%`;
    el.police.classList.toggle('danger', h.gap < 12);
    el.policeM.textContent = `${Math.round(h.gap)}${t('gapM')}`;
    el.lap.textContent = `${Math.min(h.lap, 3)}/3`;
    el.heat.textContent = `${t('heat')} ${h.heat}`;
    el.heat.className = 'heat-' + h.heat;
    el.time.textContent = fmtTime(h.time);
    el.vignette.classList.toggle('on', h.gap < 12);
    this.updateLights(run.lightT, run.phase, run.time);
  },

  popup(ev) {
    let text = null, cls = '';
    if (ev.type === 'nearMiss') { text = t('nearMiss', { v: ev.bonus }); cls = 'good'; }
    else if (ev.type === 'crash') { text = t('crash'); cls = 'bad'; }
    else if (ev.type === 'launchPerfect') { text = t('perfect'); cls = 'good'; }
    else if (ev.type === 'launchJump') { text = t('jump'); cls = 'bad'; }
    else if (ev.type === 'lap') { text = t('lapClear', { n: ev.n, v: ev.bonus }); cls = 'good'; }
    else if (ev.type === 'heat') { text = t('heatUp', { n: ev.n }); cls = 'warn'; }
    else if (ev.type === 'copClose') { text = t('copClose'); cls = 'bad'; }
    else if (ev.type === 'multReset') { text = t('crash'); cls = 'bad'; }
    if (!text) return;
    const d = document.createElement('div');
    d.className = 'popup ' + cls;
    d.textContent = text;
    el.fx.appendChild(d);
    while (el.fx.children.length > 6) el.fx.removeChild(el.fx.firstChild);
    setTimeout(() => d.remove(), 1400);
  },
};