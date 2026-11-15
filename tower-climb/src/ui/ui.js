// src/ui/ui.js — 屏幕/ HUD / 交互引导 / 触屏摇杆。所有可见文案走 i18n，切语言时 applyLang 一次刷新。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';
import { save } from '../core/save.js';
import { TOWER, WORLD } from '../../config/game.config.js';

const $ = (id) => document.getElementById(id);

function fmtTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export const ui = {
  // 元素引用
  screens: ['screen-title', 'screen-pause', 'screen-results'].map($),
  hud: $('hud'),
  hudFloor: $('hud-floor'),
  hudFalls: $('hud-falls'),
  hudTime: $('hud-time'),
  hudGoal: $('hud-goal'),
  hudBest: $('hud-best'),
  hudWind: $('hud-wind'),
  titleText: $('title-text'),
  subtitleText: $('subtitle-text'),
  titleControls: $('title-controls'),
  btnStart: $('btn-start'),
  btnHowto: $('btn-howto'),
  pauseTitle: $('pause-title'),
  btnResume: $('btn-resume'),
  btnRestartPause: $('btn-restart-pause'),
  btnMenuPause: $('btn-menu-pause'),
  btnHowtoPause: $('btn-howto-pause'),
  btnMute: $('btn-mute'),
  resultTitle: $('result-title'),
  resultRating: $('result-rating'),
  resultTime: $('result-time'),
  resultFalls: $('result-falls'),
  resultBest: $('result-best'),
  btnRestart: $('btn-restart'),
  btnMenu: $('btn-menu'),
  btnShare: $('btn-share'),
  langSelects: [$('lang-select'), $('lang-select-pause')],
  tutorialEl: $('tutorial'),
  tutTitle: $('tut-title'),
  tutStep: $('tut-step'),
  tutHighlight: $('tut-highlight'),
  tutSkip: $('tut-skip'),
  touchEl: $('touch'),
  joy: $('joy'),
  joyKnob: $('joy-knob'),
  btnJump: $('btn-jump'),
  btnDash: $('btn-dash'),
  rotate: $('rotate'),
  rotateText: $('rotate-text'),
  btnRotateSkip: $('btn-rotate-skip'),

  get lang() { return i18n.lang; },
  get dir() { return i18n.dir; },

  // 触屏输入（main 每帧读并清 edge）
  touch: { moveX: 0, moveY: 0, jump: false, dash: false },

  // ---------------------------------------------------------------- 语言
  applyLang() {
    syncDocumentLang();
    this.titleText.textContent = t('title');
    this.subtitleText.textContent = t('subtitle');
    this.titleControls.textContent = ui.isTouchDevice ? t('controlsTouch') : t('controlsDesktop');
    this.btnStart.textContent = t('start');
    this.btnHowto.textContent = t('howto');
    this.pauseTitle.textContent = t('paused');
    this.btnResume.textContent = t('resume');
    this.btnRestartPause.textContent = t('restart');
    this.btnMenuPause.textContent = t('menu');
    this.btnHowtoPause.textContent = t('howto');
    this.btnMute.textContent = save.get('muted', false) ? t('unmute') : t('mute');
    this.resultTitle.textContent = t('resultWin');
    this.btnRestart.textContent = t('resultRestart');
    this.btnMenu.textContent = t('resultMenu');
    this.btnShare.textContent = t('share');
    this.tutSkip.textContent = t('tutSkip');
    this.rotateText.textContent = t('rotate');
    this.btnRotateSkip.textContent = t('rotateSkip');
    for (const sel of this.langSelects) if (sel) sel.setAttribute('aria-label', t('language'));
    this.fillLangOptions();
    if (this.tutorial.active) this.tutorial.render();
  },

  fillLangOptions() {
    for (const sel of this.langSelects) {
      if (!sel) continue;
      sel.innerHTML = '';
      for (const item of i18n.options()) {
        const opt = document.createElement('option');
        opt.value = item.code;
        opt.textContent = item.name;
        if (item.code === i18n.lang) opt.selected = true;
        sel.appendChild(opt);
      }
    }
  },

  setLang(lang) { i18n.setLang(lang); this.applyLang(); return i18n.lang; },

  // ---------------------------------------------------------------- 屏幕
  show(el) { this.screens.forEach((s) => s.classList.add('hidden')); if (el) el.classList.remove('hidden'); },
  showTitle() {
    this.show($('screen-title'));
    this.hud.classList.add('hidden');
    this.touchEl.classList.add('hidden');
    this.tutorialEl.classList.add('hidden');
    this.tutorial.active = false;
  },
  showGame() {
    this.show(null);
    this.hud.classList.remove('hidden');
    if (ui.isTouchDevice) this.touchEl.classList.remove('hidden');
  },
  showPause() { this.show($('screen-pause')); this.applyLang(); },
  hidePause() { this.show(null); },
  showResults() {
    this.show($('screen-results'));
    this.hud.classList.add('hidden');
  },

  // ---------------------------------------------------------------- HUD
  updateHUD(hud) {
    this.hudFloor.textContent = `${t('floor')} ${hud.floor} / ${TOWER.floors}`;
    this.hudFalls.textContent = `${t('falls')} ${hud.falls}`;
    this.hudTime.textContent = `${t('time')} ${fmtTime(hud.time)}`;
    this.hudGoal.textContent = t('goal');
    const best = save.get('best', null);
    this.hudBest.textContent = best == null ? `${t('best')} —` : `${t('best')} ${fmtTime(best)}`;
    const windy = hud.y >= WORLD.WIND_MIN_Y;
    this.hudWind.classList.toggle('hidden', !windy);
    if (windy) this.hudWind.textContent = hud.windDir > 0 ? t('windIn') : t('windOut');
  },

  // ---------------------------------------------------------------- 结算
  showResultsData(hud) {
    this.resultRating.textContent = hud.rating;
    this.resultRating.className = 'rating rating-' + hud.rating;
    this.resultTime.textContent = `${t('resultTime')} ${fmtTime(hud.time)}`;
    this.resultFalls.textContent = `${t('resultFalls')} ${hud.falls}`;
    const best = save.get('best', null);
    if (hud.isRecord) this.resultBest.textContent = `${t('resultNewBest')} ${fmtTime(hud.time)}`;
    else this.resultBest.textContent = `${t('resultBest')} ${best == null ? '—' : fmtTime(best)}`;
  },

  // ---------------------------------------------------------------- 触屏
  isTouchDevice: ('ontouchstart' in window) || navigator.maxTouchPoints > 0,

  setupTouch() {
    if (!this.isTouchDevice) return;
    this.touchEl.classList.remove('hidden');
    const joy = this.joy, knob = this.joyKnob;
    let id = null, cx = 0, cy = 0;
    const R = 34;
    const setKnob = (dx, dy) => {
      const l = Math.hypot(dx, dy);
      const k = l > R ? R / l : 1;
      knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
      this.touch.moveX = dx / R;
      this.touch.moveY = -dy / R;
    };
    joy.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      id = e.pointerId;
      const r = joy.getBoundingClientRect();
      cx = r.left + r.width / 2; cy = r.top + r.height / 2;
      joy.setPointerCapture(id);
      setKnob(e.clientX - cx, e.clientY - cy);
    });
    joy.addEventListener('pointermove', (e) => { if (e.pointerId === id) setKnob(e.clientX - cx, e.clientY - cy); });
    const end = (e) => { if (e.pointerId === id) { id = null; knob.style.transform = 'translate(0px,0px)'; this.touch.moveX = 0; this.touch.moveY = 0; } };
    joy.addEventListener('pointerup', end);
    joy.addEventListener('pointercancel', end);

    const bind = (elm, key) => {
      const on = (e) => { e.preventDefault(); elm.classList.add('active'); this.touch[key] = true; };
      const off = (e) => { e.preventDefault(); elm.classList.remove('active'); };
      elm.addEventListener('pointerdown', on);
      elm.addEventListener('pointerup', off);
      elm.addEventListener('pointercancel', off);
      elm.addEventListener('pointerleave', off);
    };
    bind(this.btnJump, 'jump');
    bind(this.btnDash, 'dash');
  },

  // ---------------------------------------------------------------- 交互引导
  tutorial: {
    active: false,
    step: 0,
    steps: ['tutMove', 'tutJump', 'tutDash', 'tutClimb'],
    get current() { return t(this.steps[this.step] || 'tutMove'); },

    start(mode) {
      this.active = true;
      this.step = 0;
      // 'title' = 从标题/暂停重看（不透明模态底，避免透明弹窗压在塔身上被判 HUD 遮挡）
      // 'game'（默认）= 玩法内首次引导（右上窄卡，不遮中心目标）
      ui.tutorialEl.classList.toggle('title-mode', mode === 'title');
      ui.tutorialEl.classList.remove('hidden');
      this.render();
    },

    skip() {
      this.active = false;
      ui.tutorialEl.classList.add('hidden');
      ui.tutorialEl.querySelectorAll('.glow').forEach((e) => e.classList.remove('glow'));
      save.set('tutDone', true);
    },

    next() {
      this.step = Math.min(this.step + 1, this.steps.length - 1);
      this.render();
    },

    render() {
      ui.tutTitle.textContent = t('tutTitle');
      ui.tutStep.textContent = this.current;
      ui.tutHighlight.textContent = this.highlightKey();
      // 高亮真实触屏按钮
      ui.tutorialEl.querySelectorAll('.glow').forEach((e) => e.classList.remove('glow'));
      if (this.step === 1 && ui.btnJump) ui.btnJump.classList.add('glow');
      else if (this.step === 2 && ui.btnDash) ui.btnDash.classList.add('glow');
    },

    highlightKey() {
      return ['WASD / 🕹', 'SPACE / A', 'SHIFT / B', '⬆ CLIMB'][this.step] || '';
    },
  },
};

// 触屏按键的高亮样式类由 CSS 提供（.touch-btn.glow）
ui.setupTouch();
