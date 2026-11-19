// UI 模块：屏幕显隐 + 多语言下拉 + HUD/结算 DOM 更新。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';

const $ = (id) => document.getElementById(id);

export const ui = {
  titleScreen: $('screen-title'),
  pauseScreen: $('screen-pause'),
  resultScreen: $('screen-result'),
  hud: $('hud'),
  langSelects: [$('lang-select'), $('lang-select-pause')],

  get lang() {
    return i18n.lang;
  },

  applyLang() {
    syncDocumentLang();
    $('title-text').textContent = t('title');
    $('subtitle-text').textContent = t('subtitle');
    $('btn-start').textContent = t('start');
    $('btn-resume').textContent = t('resume');
    $('pause-title').textContent = t('paused');
    $('btn-restart2').textContent = t('restart');
    $('btn-home3').textContent = t('home');
    $('result-title').textContent = t('resultTitle');
    $('btn-retry').textContent = t('retry');
    $('btn-home2').textContent = t('home');
    $('btn-howto').textContent = '?';
    $('btn-howto').title = t('howto');
    $('controls-hint').textContent = t('controls');
    $('boost-label').textContent = t('boost');
    $('btn-rotate-skip').textContent = t('rotateSkip');
    $('rotate-text').textContent = t('rotateHint');
    for (const sel of this.langSelects) {
      if (sel) sel.setAttribute('aria-label', t('language'));
    }
    this.fillLangOptions();
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

  setLang(lang) {
    i18n.setLang(lang);
    this.applyLang();
    return i18n.lang;
  },

  setMuted(muted) {
    const b = $('btn-mute');
    b.textContent = muted ? '🔇' : '🔊';
    b.title = muted ? t('unmute') : t('mute');
  },

  showTitle() {
    this.titleScreen.classList.remove('hidden');
    this.titleScreen.classList.add('is-active');
    this.pauseScreen.classList.add('hidden');
    this.resultScreen.classList.add('hidden');
    this.hud.classList.add('hidden');
    this.applyLang();
  },

  showGame() {
    this.titleScreen.classList.add('hidden');
    this.titleScreen.classList.remove('is-active');
    this.pauseScreen.classList.add('hidden');
    this.resultScreen.classList.add('hidden');
    this.hud.classList.remove('hidden');
  },

  showPause() {
    this.pauseScreen.classList.remove('hidden');
    this.applyLang();
  },

  hidePause() {
    this.pauseScreen.classList.add('hidden');
  },

  showResult(score, best, isNewBest) {
    this.resultScreen.classList.remove('hidden');
    $('result-score').textContent = `${t('finalScore')}  ${Math.floor(score)}`;
    $('result-best').textContent = `${t('bestScore')}  ${Math.floor(best)}`;
    $('result-newbest').classList.toggle('hidden', !isNewBest);
  },

  hideResult() {
    this.resultScreen.classList.add('hidden');
  },

  updateHud(hud) {
    $('hud-score').textContent = String(Math.floor(hud.score));
    $('hud-stage').textContent = `${t('stage')} ${hud.stage}`;
    const combo = $('hud-combo');
    if (hud.combo >= 2) {
      combo.classList.remove('hidden');
      combo.textContent = `${t('combo')} ×${hud.combo}`;
    } else {
      combo.classList.add('hidden');
    }
    const hpPct = Math.max(0, hud.hp / hud.maxHp) * 100;
    $('hp-fill').style.width = `${hpPct}%`;
    $('hp-fill').classList.toggle('low', hud.hp <= 1);
    const boostPct = (hud.boost / hud.boostMax) * 100;
    $('boost-fill').style.width = `${boostPct}%`;
    $('boost-fill').classList.toggle('full', hud.boost >= hud.boostMax);
    document.body.classList.toggle('mode-hit', hud.mode === 'hit');
    document.body.classList.toggle('mode-hot', hud.mode === 'hot');
  },
};
