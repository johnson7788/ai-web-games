// UI 模块：标题/暂停/结算/HUD/教程/竖屏提示 + 多语言
import { i18n, t, syncDocumentLang } from '../core/i18n.js';

const $ = (id) => document.getElementById(id);

export const ui = {
  els: {
    hud: $('hud'),
    hudLevel: $('hud-level'),
    hudScore: $('hud-score'),
    hudCombo: $('hud-combo'),
    hudHearts: $('hud-hearts'),
    title: $('screen-title'),
    pause: $('screen-pause'),
    result: $('screen-result'),
    titleText: $('title-text'),
    subtitleText: $('subtitle-text'),
    bestText: $('best-text'),
    pauseTitle: $('pause-title'),
    resultTitle: $('result-title'),
    resultStars: $('result-stars'),
    resultScore: $('result-score'),
    resultBest: $('result-best'),
    resultNew: $('result-newrecord'),
    btnStart: $('btn-start'),
    btnResume: $('btn-resume'),
    btnNext: $('btn-next'),
    rotate: $('rotate-screen'),
    rotateText: $('rotate-text'),
    btnMute: $('btn-mute'),
    langSelects: [$('lang-select'), $('lang-select-pause')].filter(Boolean),
  },

  lastHud: null,

  applyLang() {
    syncDocumentLang();
    this.els.titleText.textContent = t('title');
    this.els.subtitleText.textContent = t('subtitle');
    this.els.btnStart.textContent = t('start');
    this.els.btnResume.textContent = t('resume');
    this.els.pauseTitle.textContent = t('paused');
    this.els.btnNext.textContent = t('next');
    this.els.rotateText.textContent = t('rotate');
    const skip = $('btn-rotate-skip');
    if (skip) skip.textContent = t('playAnyway');
    this.fillLangOptions();
    this.updateMuteLabel();
    if (this.lastHud) this.updateHUD(this.lastHud);
  },

  fillLangOptions() {
    for (const sel of this.els.langSelects) {
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

  setLang(lang) {
    i18n.setLang(lang);
    this.applyLang();
    return i18n.lang;
  },

  setMuted(muted) {
    const btn = this.els.btnMute;
    if (btn) btn.textContent = muted ? t('sound') : t('mute');
  },
  updateMuteLabel() {
    // 占位：由 main 在 applyLang 后覆盖真实状态
  },

  hideAllScreens() {
    for (const s of [this.els.title, this.els.pause, this.els.result]) {
      s.classList.add('hidden');
      s.classList.remove('is-active');
    }
  },

  showTitle(best = 0) {
    this.hideAllScreens();
    this.els.title.classList.remove('hidden');
    this.els.title.classList.add('is-active');
    this.els.hud.classList.add('hidden');
    this.els.bestText.textContent = `${t('best')}: ${Math.floor(best)}`;
    this.applyLang();
  },

  showGame() {
    this.hideAllScreens();
    this.els.hud.classList.remove('hidden');
  },

  showPause() {
    this.els.pause.classList.remove('hidden');
    this.applyLang();
  },

  hidePause() {
    this.els.pause.classList.add('hidden');
  },

  showResult({ won, stars, score, best, isNew, canNext }) {
    this.hideAllScreens();
    this.els.result.classList.remove('hidden');
    this.els.resultTitle.textContent = won ? t('resultWin') : t('resultLose');
    this.els.resultStars.textContent = won ? `${t('resultStars')}: ${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}` : '';
    this.els.resultScore.textContent = `${t('resultScore')}: ${Math.floor(score)}`;
    this.els.resultBest.textContent = `${t('resultBest')}: ${Math.floor(best)}`;
    this.els.resultNew.classList.toggle('hidden', !isNew);
    this.els.resultNew.textContent = t('newRecord');
    this.els.btnNext.classList.toggle('hidden', !(won && canNext));
    this.applyLang();
  },

  updateHUD(hud) {
    this.lastHud = hud;
    if (!hud) return;
    this.els.hudLevel.textContent = `${t('level')} ${hud.level}`;
    this.els.hudScore.textContent = `${t('score')} ${Math.floor(hud.score)}`;
    this.els.hudCombo.textContent = hud.combo >= 2 ? `${t('combo')} ×${hud.combo}` : '';
    this.els.hudHearts.textContent = '♥'.repeat(Math.max(0, hud.hearts)) + '♡'.repeat(Math.max(0, 3 - hud.hearts));
  },
};

// ---- 教程状态机（首次进入交互引导；可跳过、可重看、持久化）----
const TUT_KEY = 'bubble-brawl-io-tutorial-seen';
const TUT_STEPS = ['tut1', 'tut2', 'tut3', 'tut4'];

function readSeen() {
  try { return localStorage.getItem(TUT_KEY) === '1'; } catch { return false; }
}
function writeSeen() {
  try { localStorage.setItem(TUT_KEY, '1'); } catch { /* ignore */ }
}

export const tutorial = {
  active: false,
  step: 0,
  steps: TUT_STEPS.map((k) => k),
  seen: readSeen(),

  get current() {
    return t(TUT_STEPS[this.step] || 'tut1');
  },

  show() {
    const root = document.querySelector('[data-tutorial]');
    if (!root) return;
    this.active = true;
    this.step = 0;
    root.classList.remove('hidden');
    this.render();
  },

  hide() {
    const root = document.querySelector('[data-tutorial]');
    if (root) root.classList.add('hidden');
    this.active = false;
    writeSeen();
    this.seen = true;
  },

  skip() {
    this.hide();
  },

  next() {
    if (this.step >= TUT_STEPS.length - 1) {
      this.hide();
      return;
    }
    this.step += 1;
    this.render();
  },

  render() {
    const root = document.querySelector('[data-tutorial]');
    if (!root) return;
    const title = root.querySelector('#tut-title');
    const text = root.querySelector('#tut-text');
    const nextBtn = root.querySelector('#tut-next');
    if (title) title.textContent = t('tutTitle');
    if (text) text.textContent = t(TUT_STEPS[this.step]);
    if (nextBtn) nextBtn.textContent = this.step >= TUT_STEPS.length - 1 ? t('tutNext') : t('tutNext');
  },
};
