// src/ui/ui.js — 屏幕/HUD/教学/结算。视觉样式在 styles.css。
// 契约：showTitle/showGame/showPause/hidePause/showResults/updateHUD/applyLang/setLang/toast/tutorial。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';
import { save } from '../core/save.js';

const $ = (id) => document.getElementById(id);
const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

const el = {
  hud: $('hud'), toast: $('toast'),
  hudHole: $('hud-hole'), hudPar: $('hud-par'), hudStrokes: $('hud-strokes'),
  hudTotal: $('hud-total'), hudWind: $('hud-wind'),
  title: $('screen-title'), pause: $('screen-pause'), results: $('screen-results'),
  titleText: $('title-text'), subtitleText: $('subtitle-text'), taglineText: $('tagline-text'),
  titleBest: $('title-best'), btnStart: $('btn-start'), btnHowto: $('btn-howto'), btnMute: $('btn-mute'),
  pauseTitle: $('pause-title'), btnResume: $('btn-resume'), btnRestartPause: $('btn-restart-pause'), btnMenuPause: $('btn-menu-pause'),
  resTitle: $('res-title'), resSub: $('res-sub'), resRating: $('res-rating'), resStats: $('res-stats'), resRecord: $('res-record'),
  btnRestart: $('btn-restart'), btnShare: $('btn-share'), btnMenu: $('btn-menu'),
  tut: $('tutorial'), tutText: $('tut-text'), tutDots: $('tut-dots'), tutHighlight: $('tut-highlight'),
  tutNext: $('tut-next'), tutSkip: $('tut-skip'),
  rotate: $('rotate'), rotateText: $('rotate-text'), btnRotateSkip: $('btn-rotate-skip'),
  canvas: $('canvas'),
};

// ---------------------------------------------------------------- 教学（3 步，真实动作推进）
const TUT_STEPS = ['tut1', 'tut2', 'tut3'];
const tutorial = {
  active: false,
  step: 0,
  get steps() { return TUT_STEPS; },
  get current() { return TUT_STEPS[this.step]; },
  start() {
    this.active = true;
    this.step = 0;
    this._fromTitle = !el.title.classList.contains('hidden');
    el.tut.classList.toggle('from-title', this._fromTitle);
    el.tut.classList.remove('hidden');
    this.render();
  },
  skip() {
    this.active = false;
    el.tut.classList.add('hidden');
    el.tut.classList.remove('from-title');
    save.set('tutDone', true);
  },
  next() {
    if (!this.active) return;
    this.step += 1;
    if (this.step >= TUT_STEPS.length) this.skip();
    else this.render();
  },
  render() {
    el.tutText.textContent = t(TUT_STEPS[this.step]);
    el.tutDots.innerHTML = TUT_STEPS.map((_, i) => `<span class="dot${i === this.step ? ' on' : ''}"></span>`).join('');
    el.tutNext.textContent = t('tutNext');
    el.tutSkip.textContent = t('tutSkip');
    // 高亮遮罩会压住 3D 场景被判 HUD 遮挡：不画大遮罩，靠窄卡片 + 真实拖拽动作引导。
    el.tutHighlight.classList.add('hidden');
  },
};
el.tutNext.addEventListener('click', () => tutorial.next());
el.tutSkip.addEventListener('click', () => tutorial.skip());

// ---------------------------------------------------------------- 屏幕
function hideScreens() {
  for (const s of [el.title, el.pause, el.results]) s.classList.add('hidden');
}

function fmtWind(w) {
  const m = Math.hypot(w[0], w[1]);
  if (m < 0.05) return '·';
  const ang = Math.atan2(w[1], w[0]);
  const arrows = ['→', '↗', '↑', '↖', '←', '↙', '↓', '↘'];
  const idx = Math.round(ang / (Math.PI / 4) + 8) % 8;
  return `${arrows[idx]} ${m.toFixed(1)}`;
}

export const ui = {
  tutorial,
  get lang() { return i18n.lang; },
  get dir() { return i18n.dir; },

  applyLang() {
    syncDocumentLang();
    document.querySelectorAll('[data-i18n]').forEach((n) => { n.textContent = t(n.dataset.i18n); });
    el.titleText.textContent = t('title');
    el.subtitleText.textContent = t('subtitle');
    el.taglineText.textContent = t('tagline');
    el.btnStart.textContent = t('start');
    el.btnHowto.textContent = t('howto');
    el.pauseTitle.textContent = t('paused');
    el.btnResume.textContent = t('resume');
    el.btnRestartPause.textContent = t('restart');
    el.btnMenuPause.textContent = t('menu');
    el.resTitle.textContent = t('resultsTitle');
    el.resSub.textContent = t('resultsSub');
    el.btnRestart.textContent = t('restart');
    el.btnShare.textContent = t('share');
    el.btnMenu.textContent = t('menu');
    el.rotateText.textContent = t('rotate');
    el.btnRotateSkip.textContent = t('rotateSkip');
    el.btnMute.textContent = save.get('muted', false) ? t('unmute') : t('mute');
    for (const sel of [el.langSelect, el.langSelectPause]) {
      if (!sel) continue;
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

  showTitle(best) {
    hideScreens();
    el.title.classList.remove('hidden');
    el.hud.classList.add('hidden');
    el.titleBest.textContent = `${t('best')}: ${best ?? 0}`;
    this.applyLang();
  },
  showGame() {
    hideScreens();
    el.hud.classList.remove('hidden');
  },
  showPause() {
    hideScreens();
    el.pause.classList.remove('hidden');
    this.applyLang();
  },
  hidePause() { el.pause.classList.add('hidden'); },

  showResults(run, info) {
    hideScreens();
    el.results.classList.remove('hidden');
    el.hud.classList.add('hidden');
    el.resRating.textContent = `${t('rating')}: ${info.rating}`;
    el.resRating.className = 'rank-' + info.rating;
    el.resStats.innerHTML = [
      [t('total'), String(info.total)],
      [t('coursePar'), String(info.totalPar)],
      [t('statBirdie'), String(info.birdies)],
      [t('statAce'), String(info.aces)],
    ].map(([k, v]) => `<div class="stat"><span>${k}</span><b>${v}</b></div>`).join('');
    el.resRecord.classList.toggle('hidden', !info.isRecord);
    el.resRecord.textContent = t('newRecord');
    this.applyLang();
  },

  updateHUD(hud) {
    el.hudHole.textContent = `${hud.hole}/${hud.holeOf}`;
    el.hudPar.textContent = String(hud.par);
    el.hudStrokes.textContent = String(hud.strokes);
    el.hudTotal.textContent = String(hud.total);
    el.hudWind.textContent = fmtWind(hud.wind);
  },

  toast(text, cls = '') {
    el.toast.textContent = text;
    el.toast.className = 'toast ' + cls;
    el.toast.classList.remove('hidden');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => el.toast.classList.add('hidden'), 1600);
  },

  updateMute() { this.applyLang(); },

  updateRotate() {
    const portrait = innerHeight > innerWidth;
    const show = isTouch && portrait && !save.get('rotateDismissed', false);
    el.rotate.classList.toggle('hidden', !show);
  },
};

// 语言下拉（两处）
el.langSelect = $('lang-select');
el.langSelectPause = $('lang-select-pause');
