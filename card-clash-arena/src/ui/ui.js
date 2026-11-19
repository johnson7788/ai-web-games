// UI 模块：DOM 引用、语言切换、屏幕显隐、HUD/动作条/结算/教程渲染。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';
import { GAME } from '../../config/game.config.js';

const $ = (id) => document.getElementById(id);

export const ui = {
  // 屏幕
  titleScreen: $('screen-title'),
  pauseScreen: $('screen-pause'),
  resultScreen: $('screen-result'),
  hud: $('hud'),
  actionBar: $('action-bar'),
  tutorial: $('tutorial'),
  canvas: $('canvas'),

  // 标题
  titleText: $('title-text'),
  subtitleText: $('subtitle-text'),
  btnStart: $('btn-start'),
  bestStars: $('best-stars'),

  // HUD
  hpEnemy: $('hp-enemy'),
  hpYou: $('hp-you'),
  hpEnemyNum: $('hp-enemy-num'),
  hpYouNum: $('hp-you-num'),
  hudRound: $('hud-round'),
  hudCoins: $('hud-coins'),
  hudCombo: $('hud-combo'),
  hudRivalLabel: $('hud-rival-label'),
  hudYouLabel: $('hud-you-label'),

  // 动作条
  btnBuff: $('btn-buff'),
  btnDebuff: $('btn-debuff'),
  btnOverdrive: $('btn-overdrive'),
  btnCancel: $('btn-cancel'),

  // 暂停/结算
  pauseTitle: $('pause-title'),
  btnResume: $('btn-resume'),
  resultTitle: $('result-title'),
  resultStars: $('result-stars'),
  resultMeta: $('result-meta'),
  btnMute: $('btn-mute'),

  langSelects: [$('lang-select'), $('lang-select-pause')],

  get lang() { return i18n.lang; },
  get dir() { return i18n.dir; },

  applyLang() {
    syncDocumentLang();
    this.titleText.textContent = t('title');
    this.subtitleText.textContent = t('subtitle');
    this.btnStart.textContent = t('start');
    this.btnResume.textContent = t('resume');
    this.pauseTitle.textContent = t('paused');
    $('btn-restart2').textContent = t('restart');
    $('btn-tut-replay').textContent = t('howto');
    $('btn-home3').textContent = t('home');
    $('btn-retry').textContent = t('retry');
    $('btn-home2').textContent = t('home');
    $('btn-howto').setAttribute('aria-label', t('howto'));
    $('btn-restart').setAttribute('aria-label', t('restart'));
    $('btn-home').setAttribute('aria-label', t('home'));
    $('btn-mute').setAttribute('aria-label', ui.muted ? t('unmute') : t('mute'));
    $('hud-rival-label').textContent = t('hpRival');
    $('hud-you-label').textContent = t('hpYou');
    for (const sel of this.langSelects) if (sel) sel.setAttribute('aria-label', t('language'));
    this.fillLangOptions();
    this.renderAbilityButtons();
    this.renderRotate();
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

  showTitle() {
    this.titleScreen.classList.remove('hidden');
    this.titleScreen.classList.add('is-active');
    this.pauseScreen.classList.add('hidden');
    this.resultScreen.classList.add('hidden');
    this.hud.classList.add('hidden');
    this.actionBar.classList.add('hidden');
    this.hideTutorial();
    this.applyLang();
  },

  showGame() {
    this.titleScreen.classList.add('hidden');
    this.titleScreen.classList.remove('is-active');
    this.pauseScreen.classList.add('hidden');
    this.resultScreen.classList.add('hidden');
    this.hud.classList.remove('hidden');
    this.actionBar.classList.remove('hidden');
  },

  showPause() {
    this.pauseScreen.classList.remove('hidden');
    this.applyLang();
  },

  hidePause() {
    this.pauseScreen.classList.add('hidden');
  },

  showResult() {
    this.resultScreen.classList.remove('hidden');
  },

  hideResult() {
    this.resultScreen.classList.add('hidden');
  },

  updateHud(state) {
    if (!state) return;
    const e = Math.max(0, state.enemyHp);
    const p = Math.max(0, state.playerHp);
    this.hpEnemy.style.width = `${(e / GAME.MAX_HEALTH) * 100}%`;
    this.hpYou.style.width = `${(p / GAME.MAX_HEALTH) * 100}%`;
    this.hpEnemyNum.textContent = e;
    this.hpYouNum.textContent = p;
    this.hudRound.textContent = `${t('round')} ${state.round} · ${this.attrName(state.roundAttribute)}`;
    this.hudCoins.textContent = `◈ ${state.coins}`;
    this.hudCombo.textContent = state.combo >= 2 ? t('comboOn', { n: state.combo }) : '';
    this.hudCombo.style.display = state.combo >= 2 ? '' : 'none';
    this.renderAbilityButtons();
    this.renderAbilityEnabled(state);
  },

  attrName(attr) {
    return t(['attrPower', 'attrVitality', 'attrSpeed'][attr]);
  },

  renderAbilityButtons() {
    const btns = [
      [this.btnBuff, t('buff'), GAME.BUFF_COST],
      [this.btnDebuff, t('debuff'), GAME.DEBUFF_COST],
      [this.btnOverdrive, t('overdrive'), GAME.OVERDRIVE_COST],
      [this.btnCancel, t('cancel'), GAME.CANCEL_COST],
    ];
    for (const [btn, name, cost] of btns) {
      if (!btn) continue;
      btn.querySelector('.ab-name').textContent = name;
      btn.querySelector('.ab-cost').textContent = `◈${cost}`;
    }
  },

  renderAbilityEnabled(state) {
    if (!state) return;
    const canAct = state.phase === 'playerTurn';
    this._setAb(this.btnBuff, canAct && !state.buffActive && state.coins >= GAME.BUFF_COST);
    this._setAb(this.btnDebuff, canAct && !state.debuffActive && state.coins >= GAME.DEBUFF_COST);
    this._setAb(this.btnOverdrive, canAct && !state.overdriveActive && state.coins >= GAME.OVERDRIVE_COST);
    this._setAb(this.btnCancel, canAct && !state.cancelActive && state.coins >= GAME.CANCEL_COST);
    this._setAbActive(this.btnBuff, state.buffActive);
    this._setAbActive(this.btnDebuff, state.debuffActive);
    this._setAbActive(this.btnOverdrive, state.overdriveActive);
    this._setAbActive(this.btnCancel, state.cancelActive);
  },

  _setAb(btn, enabled) {
    if (!btn) return;
    btn.disabled = !enabled;
    btn.classList.toggle('disabled', !enabled);
  },

  _setAbActive(btn, active) {
    if (!btn) return;
    btn.classList.toggle('active', active);
  },

  renderResult(state, best) {
    const won = state.phase === 'won';
    this.resultTitle.textContent = won ? t('winTitle') : t('loseTitle');
    this.resultTitle.classList.toggle('lose', !won);
    if (won) {
      const stars = state.stars || 1;
      this.resultStars.innerHTML = `<span class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>`;
      this.resultMeta.textContent =
        `${t('resultRemaining')} ${state.playerHp}/${GAME.MAX_HEALTH} · ${t('resultRounds')} ${state.round} · ${t('resultBest')} ${best}★`;
    } else {
      this.resultStars.innerHTML = '';
      this.resultMeta.textContent = `${t('resultRounds')} ${state.round} · ${t('resultBest')} ${best}★`;
    }
  },

  renderRotate() {
    const rt = $('rotate-text');
    const rb = $('btn-rotate-skip');
    if (rt) rt.textContent = t('rotateHint');
    if (rb) rb.textContent = t('rotateSkip');
  },

  // ---- 教程 ----
  showTutorial(step, steps) {
    this.tutorial.classList.remove('hidden');
    this.renderTutorial(step, steps);
  },

  hideTutorial() {
    this.tutorial.classList.add('hidden');
  },

  renderTutorial(step, steps) {
    const s = steps[step];
    $('tut-title').textContent = t('tutTitle');
    $('tut-text').textContent = s || '';
    $('tut-skip').textContent = t('tutSkip');
    $('tut-next').textContent = t('tutNext');
    // 教程卡固定底部居中；无聚光灯（文本引导）
    const spot = $('tut-spotlight');
    if (spot) spot.style.display = 'none';
  },

  setMuted(muted) {
    this.muted = muted;
    this.btnMute?.classList.toggle('is-muted', muted);
    if (this.btnMute) this.btnMute.textContent = muted ? '🔇' : '🔊';
    if (this.btnMute) this.btnMute.setAttribute('aria-label', muted ? t('unmute') : t('mute'));
  },
};

ui.muted = false;
