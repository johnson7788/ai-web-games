// src/ui/ui.js — 屏幕/HUD/教学/小地图/触屏按钮。视觉样式在 styles.css。
// 逻辑契约见 README：showTitle/showGame/showPause/showResults/updateHUD/drawMap/applyLang/hint。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';
import { save } from '../core/save.js';
import { WORLD, PLAYER } from '../../config/game.config.js';

const $ = (id) => document.getElementById(id);
const el = {
  title: $('screen-title'), pause: $('screen-pause'), results: $('screen-results'),
  hud: $('hud'), touch: $('touch'), rotate: $('rotate'),
  objective: $('hud-objective'), time: $('hud-time'), exits: $('hud-exits'),
  caught: $('hud-caught'), staminaFill: $('hud-stamina-fill'), hint: $('hud-hint'),
  minimap: $('minimap'),
  titleText: $('title-text'), subtitleText: $('subtitle-text'), titleBest: $('title-best'),
  pauseTitle: $('pause-title'),
  resTitle: $('res-title'), resSub: $('res-sub'), resRecord: $('res-record'), resStats: $('res-stats'),
  btnStart: $('btn-start'), btnHowto: $('btn-howto'), btnResume: $('btn-resume'),
  btnRestartPause: $('btn-restart-pause'), btnMenuPause: $('btn-menu-pause'),
  btnRestart: $('btn-restart'), btnShare: $('btn-share'), btnMenu: $('btn-menu'),
  btnMute: $('btn-mute'),
  langSelects: [$('lang-select'), $('lang-select-pause')],
  tut: $('tutorial'), tutText: $('tut-text'), tutDots: $('tut-dots'), tutHighlight: $('tut-highlight'),
  btnSprint: $('btn-sprint'), btnHide: $('btn-hide'), btnMap: $('btn-map'),
  rotateTitle: $('rotate-title'), rotateText: $('rotate-text'), btnRotateSkip: $('btn-rotate-skip'),
};

const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// ---------------------------------------------------------------- 教学（4 步，真实动作推进）
const TUT_STEPS = ['tut1', 'tut2', 'tut3', 'tut4'];
const TUT_TARGET = ['hud-bottom', 'hud-bottom', 'hud-hint', 'minimap'];
const tutorial = {
  active: false, step: 0, _fromTitle: false,
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
    el.minimap.classList.add('hidden');
    this._fromTitle = false;
    save.set('tutDone', true);
  },
  next() {
    if (!this.active) return;
    this.step++;
    if (this.step >= TUT_STEPS.length) { this.skip(); return; }
    this.render();
  },
  // main 每帧调用：检查当前步骤的真实完成条件
  check(run) {
    if (!this.active) return;
    const done =
      this.step === 0 ? run.player.moved :
      this.step === 1 ? run.player.sprinted :
      this.step === 2 ? run.player.hiddenOnce :
      this.step === 3 ? run.exitIndex >= 1 : false;
    if (done) this.next();
  },
  render() {
    el.tutText.textContent = t(TUT_STEPS[this.step]);
    el.tutDots.innerHTML = TUT_STEPS.map((_, i) => `<span class="dot${i === this.step ? ' on' : ''}"></span>`).join('');
    $('tut-skip').textContent = t('tutSkip');
    // 小地图只在「找出口」那一步展示，避免前期出现一个空黑框
    el.minimap.classList.toggle('hidden', this._fromTitle || this.step !== 3);
    const target = $(TUT_TARGET[this.step]);
    const stage = $('stage').getBoundingClientRect();
    if (target && target.getBoundingClientRect().width > 0) {
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
function hideScreens() {
  for (const s of [el.title, el.pause, el.results]) s.classList.add('hidden');
  el.touch.classList.add('hidden');
}

export const ui = {
  tutorial,
  get lang() { return i18n.lang; },
  get dir() { return i18n.dir; },

  applyLang() {
    syncDocumentLang();
    el.titleText.textContent = t('title');
    el.subtitleText.textContent = t('subtitle');
    el.btnStart.textContent = t('start');
    el.btnHowto.textContent = t('howto');
    el.btnResume.textContent = t('resume');
    el.btnRestartPause.textContent = t('restart');
    el.btnMenuPause.textContent = t('menu');
    el.pauseTitle.textContent = t('paused');
    el.btnRestart.textContent = t('restart');
    el.btnShare.textContent = t('share');
    el.btnMenu.textContent = t('menu');
    el.btnSprint.textContent = t('sprintBtn');
    el.btnHide.textContent = t('hideBtn');
    el.btnMap.textContent = t('mapBtn');
    el.rotateTitle.textContent = t('rotateTitle');
    el.rotateText.textContent = t('rotateText');
    el.btnRotateSkip.textContent = t('rotateSkip');
    el.btnMute.textContent = save.get('muted', false) ? t('unmute') : t('mute');
    document.querySelectorAll('[data-i18n]').forEach((n) => { n.textContent = t(n.getAttribute('data-i18n')); });
    this.fillLangOptions();
    if (this.tutorial.active) this.tutorial.render();
  },

  fillLangOptions() {
    for (const sel of el.langSelects) {
      if (!sel) continue;
      sel.innerHTML = '';
      for (const item of i18n.options()) {
        const opt = document.createElement('option');
        opt.value = item.code; opt.textContent = item.name;
        if (item.code === i18n.lang) opt.selected = true;
        sel.appendChild(opt);
      }
    }
  },

  setLang(lang) { i18n.setLang(lang); this.applyLang(); return i18n.lang; },

  showTitle() {
    hideScreens();
    el.title.classList.remove('hidden');
    el.hud.classList.add('hidden');
    this.applyLang();
    el.titleBest.textContent = fmtTime(save.get('best', 0));
  },

  showGame() {
    hideScreens();
    el.hud.classList.remove('hidden');
    el.rotate.classList.add('hidden');
  },

  showPause() { el.pause.classList.remove('hidden'); this.applyLang(); },
  hidePause() { el.pause.classList.add('hidden'); },

  showResults(run) {
    hideScreens();
    el.results.classList.remove('hidden');
    el.hud.classList.add('hidden');
    this.applyLang();
    const time = run.time;
    const best = save.get('best', 0);
    const isRecord = time < (best || Infinity);
    el.resTitle.textContent = t('winTitle');
    el.resSub.textContent = t('winSub');
    el.resRecord.classList.toggle('hidden', !isRecord);
    el.resRecord.textContent = t('newBest');
    el.resStats.innerHTML =
      `<div><span class="hud-label" data-i18n="resultTime"></span><b>${fmtTime(time)}</b></div>` +
      `<div><span class="hud-label" data-i18n="resultCaught"></span><b>${run.caught}</b></div>`;
    el.resStats.querySelectorAll('[data-i18n]').forEach((n) => { n.textContent = t(n.getAttribute('data-i18n')); });
  },

  updateHUD(run) {
    const h = run;
    el.time.textContent = fmtTime(h.time);
    el.exits.textContent = `${h.exitIndex}/${h.totalExits}`;
    el.caught.textContent = h.caught > 0 ? `${t('caught')}: ${h.caught}` : '';
    el.objective.textContent = h.exitIndex === 0 ? t('objectiveFirst') : t('objective', { n: h.exitIndex + 1 });
    const pct = Math.max(0, Math.min(100, (h.player.stamina / PLAYER.staminaMax) * 100));
    el.staminaFill.style.width = `${pct}%`;
    el.staminaFill.classList.toggle('low', pct < 25);
    if (h.player.hidden) el.hint.textContent = t('hintHiding');
    else if (h.player.pantT > 0) el.hint.textContent = t('hintPanting');
    else el.hint.textContent = '';
    el.hint.classList.toggle('hidden', !el.hint.textContent);
    this.drawMap(run);
  },

  // 瞬时提示（被抓/重组/拾取）
  hint(msgKey) {
    el.hint.textContent = t(msgKey);
    el.hint.classList.remove('hidden');
    clearTimeout(this._hintTimer);
    this._hintTimer = setTimeout(() => {
      if (el.hint.textContent === t(msgKey)) el.hint.classList.add('hidden');
    }, 2200);
  },

  // 小地图：只显示已探索区域 + 玩家/当前出口
  drawMap(run) {
    const cv = el.minimap;
    if (cv.classList.contains('hidden')) return;
    const ctx = cv.getContext('2d');
    const W = WORLD.GRID_W, H = WORLD.GRID_H;
    const cell = 150 / Math.max(W, H);
    ctx.clearRect(0, 0, 150, 150);
    const { openE, openS } = run.maze;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const idx = j * W + i;
      if (!run.explored[idx]) continue;
      const x = i * cell, y = j * cell;
      ctx.fillStyle = 'rgba(212,193,122,0.18)';
      ctx.fillRect(x, y, cell, cell);
      ctx.strokeStyle = 'rgba(212,193,122,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (!openE[j][i]) { ctx.moveTo(x + cell, y); ctx.lineTo(x + cell, y + cell); }
      if (!openS[j][i]) { ctx.moveTo(x, y + cell); ctx.lineTo(x + cell, y + cell); }
      if (i === 0) { ctx.moveTo(x, y); ctx.lineTo(x, y + cell); }
      if (j === 0) { ctx.moveTo(x, y); ctx.lineTo(x + cell, y); }
      ctx.stroke();
    }
    // 出口（绿点）
    const ex = run.activeExit;
    const eci = Math.floor(ex.x / WORLD.CELL), ecj = Math.floor(ex.z / WORLD.CELL);
    if (run.explored[ecj * W + eci]) {
      ctx.fillStyle = '#7cff9a';
      ctx.beginPath(); ctx.arc((eci + 0.5) * cell, (ecj + 0.5) * cell, cell * 0.35, 0, Math.PI * 2); ctx.fill();
    }
    // 玩家（白点）
    const pi = Math.floor(run.player.x / WORLD.CELL), pj = Math.floor(run.player.z / WORLD.CELL);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc((pi + 0.5) * cell, (pj + 0.5) * cell, cell * 0.22, 0, Math.PI * 2); ctx.fill();
  },
};
