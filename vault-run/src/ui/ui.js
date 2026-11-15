// src/ui/ui.js — 屏幕/HUD/教学/触屏。视觉样式在 styles.css。
// 契约：showTitle/showGame/showPause/hidePause/showResults/updateHUD/popup/applyLang + tutorial。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';
import { save } from '../core/save.js';

const $ = (id) => document.getElementById(id);
const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

const el = {
  hud: $('hud'), fx: $('fx-layer'),
  time: $('hud-time'), dist: $('hud-dist'), score: $('hud-score'),
  combo: $('hud-combo'), staminaFill: $('hud-stamina-fill'), section: $('hud-section'),
  hint: $('action-hint'),
  title: $('screen-title'), pause: $('screen-pause'), results: $('screen-results'),
  titleText: $('title-text'), subtitleText: $('subtitle-text'), titleBest: $('title-best'),
  pauseTitle: $('pause-title'),
  resTitle: $('res-title'), resSub: $('res-sub'), resRating: $('res-rating'),
  resScore: $('res-score'), resBest: $('res-best'), resRecord: $('res-record'), resStats: $('res-stats'),
  touch: $('touch'), rotate: $('rotate'),
  tut: $('tutorial'), tutText: $('tut-text'), tutDots: $('tut-dots'), tutHighlight: $('tut-highlight'),
};

const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;

// ---------------------------------------------------------------- 教学（4 步，真实动作推进）
const TUT_STEPS = ['tut1', 'tut2', 'tut3', 'tut4'];
const TUT_TARGET = ['action-hint', 'stamina-box', 'combo-box', 'action-hint'];
const tutorial = {
  active: false, step: 0,
  get steps() { return TUT_STEPS; },
  get current() { return TUT_STEPS[this.step]; },
  start() {
    this.active = true; this.step = 0;
    this._fromTitle = !el.title.classList.contains('hidden');
    el.tut.classList.toggle('from-title', this._fromTitle);
    el.tut.classList.remove('hidden');
    this.render();
  },
  skip() {
    this.active = false;
    el.tut.classList.add('hidden');
    save.set('tutDone', true);
  },
  advance(type) {
    if (!this.active) return;
    const cur = TUT_STEPS[this.step];
    const done = (cur === 'tut1' && type === 'vault')
      || (cur === 'tut2' && type === 'sprint')
      || (cur === 'tut3' && type === 'combo')
      || (cur === 'tut4' && type === 'slide');
    if (!done) return;
    this.step++;
    if (this.step >= TUT_STEPS.length) this.skip();
    else this.render();
  },
  render() {
    el.tutText.textContent = t(TUT_STEPS[this.step]);
    el.tutDots.innerHTML = TUT_STEPS.map((_, i) => `<span class="dot${i === this.step ? ' on' : ''}"></span>`).join('');
    $('tut-skip').textContent = t('tutSkip');
    const target = $(TUT_TARGET[this.step]);
    if (target && target.getBoundingClientRect().width > 0 && !this._fromTitle) {
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
$('tut-skip').addEventListener('click', () => tutorial.skip());

// ---------------------------------------------------------------- 屏幕
function hideScreens() { for (const s of [el.title, el.pause, el.results]) s.classList.add('hidden'); }

export const ui = {
  tutorial,
  get lang() { return i18n.lang; },
  get dir() { return i18n.dir; },

  applyLang() {
    syncDocumentLang();
    document.querySelectorAll('[data-i18n]').forEach((n) => { n.textContent = t(n.dataset.i18n); });
    el.titleText.textContent = t('title');
    el.subtitleText.textContent = t('subtitle');
    $('btn-start').textContent = t('start');
    $('btn-howto').textContent = t('howto');
    $('btn-resume').textContent = t('resume');
    $('btn-restart-pause').textContent = t('restart');
    $('btn-menu-pause').textContent = t('menu');
    el.pauseTitle.textContent = t('paused');
    $('btn-restart').textContent = t('restart');
    $('btn-share').textContent = t('share');
    $('btn-menu').textContent = t('menu');
    $('btn-mute').textContent = save.get('muted', false) ? t('unmute') : t('mute');
    $('rotate-text').textContent = t('rotate');
    $('btn-rotate-skip').textContent = t('rotateSkip');
    el.titleBest.textContent = String(Math.floor(save.get('best', 0)));
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
    // 结算屏已显示时刷新评分文本
    if (this._rating != null && !el.results.classList.contains('hidden')) {
      el.resRating.innerHTML = `<span class="rank-label">${t('rating')}</span><b>${this._rating}</b>`;
    }
  },

  setLang(lang) { i18n.setLang(lang); this.applyLang(); return i18n.lang; },

  showTitle() {
    hideScreens();
    el.title.classList.remove('hidden');
    el.hud.classList.add('hidden');
    el.touch.classList.add('hidden');
    el.titleBest.textContent = String(Math.floor(save.get('best', 0)));
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
    el.results.classList.toggle('win', run.win);
    el.results.classList.toggle('lose', !run.win);
    el.resTitle.textContent = run.win ? t('resultsWin') : t('resultsLose');
    el.resSub.textContent = run.win ? t('resultsSubWin') : t('resultsSubLose');
    this._rating = info.rating;
    el.resRating.innerHTML = `<span class="rank-label">${t('rating')}</span><b>${info.rating}</b>`;
    el.resRating.className = 'rank-' + info.rating;
    el.resScore.textContent = String(info.score);
    el.resBest.textContent = String(info.best);
    el.resRecord.classList.toggle('hidden', !info.isRecord);
    el.resRecord.textContent = t('newRecord');
    el.resStats.innerHTML = [
      [t('statDistance'), Math.floor(run.player.z) + t('m')],
      [t('statVault'), run.stats.vault],
      [t('statSlide'), run.stats.slide],
      [t('statWallrun'), run.stats.wallrun],
      [t('statCombo'), '×' + run.stats.topCombo],
      [t('statTime'), fmtTime(run.clock)],
    ].map(([k, v]) => `<div class="stat"><span>${k}</span><b>${v}</b></div>`).join('');
    this.applyLang();
  },

  updateHUD(run) {
    const h = run.hud;
    el.time.textContent = fmtTime(h.time);
    el.dist.textContent = Math.floor(h.dist) + t('m');
    el.score.textContent = String(h.score);
    el.combo.textContent = h.combo > 1 ? '×' + h.combo : '';
    el.combo.classList.toggle('hot', h.combo >= 5);
    el.staminaFill.style.width = `${Math.round(h.stamina)}%`;
    el.staminaFill.parentElement.classList.toggle('empty', h.stamina < 20);
    el.section.textContent = t('level' + h.section);
    // 上下文动作提示（真实 UI，教学高亮它）
    if (h.next && h.next !== 'crane') {
      el.hint.textContent = t(h.next === 'vault' ? 'hintVault' : h.next === 'slide' ? 'hintSlide' : 'hintWallrun');
      el.hint.classList.remove('hidden');
    } else {
      el.hint.classList.add('hidden');
    }
    if (tutorial.active) tutorial.render();
  },

  popup(ev) {
    let text = null, cls = '';
    if (ev.type === 'vault') { text = t('popVault'); cls = 'good'; }
    else if (ev.type === 'slide') { text = t('popSlide'); cls = 'good'; }
    else if (ev.type === 'wallrun') { text = t('popWallrun'); cls = 'good'; }
    else if (ev.type === 'hit') { text = t('popHit'); cls = 'bad'; }
    else if (ev.type === 'fall') { text = t('popFall'); cls = 'bad'; }
    else if (ev.type === 'pickup') { text = t('popPickup'); cls = 'good'; }
    else if (ev.type === 'combo') { text = t('popCombo') + ev.n; cls = 'good'; }
    else if (ev.type === 'milestone') { text = t('popMilestone'); cls = 'good'; }
    else if (ev.type === 'section') { text = t('popSection'); cls = 'warn'; }
    if (!text) return;
    const d = document.createElement('div');
    d.className = 'popup ' + cls;
    d.textContent = text;
    el.fx.appendChild(d);
    while (el.fx.children.length > 6) el.fx.removeChild(el.fx.firstChild);
    setTimeout(() => d.remove(), 1200);
  },
};
