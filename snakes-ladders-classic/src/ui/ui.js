// DOM UI：标题/暂停/结算/HUD/掷骰按钮 + 多语言 + 首次交互引导。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';
import { Sdk } from '../core/sdk.js';

const $ = (id) => document.getElementById(id);

export const ui = {
  titleScreen: $('screen-title'),
  pauseScreen: $('screen-pause'),
  resultScreen: $('screen-result'),
  hud: $('hud'),
  btnRoll: $('btn-roll'),
  btnStart: $('btn-start'),
  btnResume: $('btn-resume'),
  btnRestart2: $('btn-restart2'),
  btnHowto2: $('btn-howto2'),
  btnHome3: $('btn-home3'),
  btnRetry: $('btn-retry'),
  btnNext: $('btn-next'),
  btnHome2: $('btn-home2'),
  btnHelp: $('btn-help'),
  btnMute: $('btn-mute'),
  btnHome: $('btn-home'),
  titleText: $('title-text'),
  subtitleText: $('subtitle-text'),
  starsTotal: $('stars-total'),
  pauseTitle: $('pause-title'),
  resultTitle: $('result-title'),
  resultStars: $('result-stars'),
  resultMeta: $('result-meta'),
  hudLevel: $('hud-level'),
  hudTurn: $('hud-turn'),
  hudStars: $('hud-stars'),
  hudGems: $('hud-gems'),
  hudCombo: $('hud-combo'),
  rotateText: $('rotate-text'),
  btnRotateSkip: $('btn-rotate-skip'),
  tutTitle: $('tut-title'),
  tutText: $('tut-text'),
  tutSkip: $('tut-skip'),
  tutNext: $('tut-next'),
  tutRoot: $('tutorial'),
  langSelects: [$('lang-select'), $('lang-select-pause')],
  muted: false,
  _run: null,

  get lang() { return i18n.lang; },
  get dir() { return i18n.dir; },

  // 供 render 侧面板用
  renderLabels() {
    return {
      dice: t('dice'),
      finished: '✓',
      you: t('you'),
      rival1: t('rival1'),
      rival2: t('rival2'),
    };
  },

  applyLang() {
    syncDocumentLang();
    this.titleText.textContent = t('title');
    this.subtitleText.textContent = t('subtitle');
    this.btnStart.textContent = t('start');
    this.btnResume.textContent = t('resume');
    this.btnRestart2.textContent = t('restart');
    this.btnHowto2.textContent = t('howto');
    this.btnHome3.textContent = t('menu');
    this.btnRetry.textContent = t('retry');
    this.btnNext.textContent = t('nextLevel');
    this.btnHome2.textContent = t('menu');
    this.pauseTitle.textContent = t('paused');
    this.resultTitle.textContent = t('resultTitle');
    this.rotateText.textContent = t('rotateText');
    this.btnRotateSkip.textContent = t('playAnyway');
    this.tutSkip.textContent = t('skip');
    this.tutNext.textContent = t('gotit');
    this.btnRoll.textContent = t('roll');
    document.querySelector('#btn-howto') && (document.querySelector('#btn-howto').textContent = t('howto'));
    this.btnMute.setAttribute('aria-label', this.muted ? t('unmute') : t('mute'));
    this.btnMute.textContent = this.muted ? '🔇' : '🔊';
    for (const sel of this.langSelects) if (sel) sel.setAttribute('aria-label', t('language'));
    this.fillLangOptions();
    this.updateStarsTotal();
    this.updateHUD(this._run);
    if (tutorial.active) tutorial.render();
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

  updateStarsTotal() {
    const best = Sdk.load('bestStars', 0) || 0;
    this.starsTotal.textContent = best > 0 ? `${'★'.repeat(Math.min(3, best))} · ${t('stars')}: ${best}` : '';
  },

  updateHUD(run) {
    this._run = run;
    if (!run) return;
    const hud = run.getHud();
    const lvlKey = `level${hud.level}`;
    this.hudLevel.textContent = t(lvlKey) || `Level ${hud.level}`;
    const human = hud.players[0];
    const active = hud.phase === 'playing';
    if (active && hud.turn === 0) this.hudTurn.textContent = t('yourTurn');
    else if (active) this.hudTurn.textContent = t('rivalTurn');
    else this.hudTurn.textContent = '';
    this.hudStars.textContent = `${t('stars')}: ${'★'.repeat(human.stars)}`;
    this.hudGems.textContent = `${t('gems')}: ${human.gems}`;
    if (human.combo > 0) {
      this.hudCombo.textContent = `${t('combo')}${human.combo}`;
      this.hudCombo.classList.add('on');
    } else {
      this.hudCombo.classList.remove('on');
    }
  },

  updateRollButton(run) {
    if (!run) { this.btnRoll.disabled = true; return; }
    const can = run.canRoll();
    this.btnRoll.disabled = !can;
    if (can) this.btnRoll.textContent = t('roll');
    else if (run.state.phase === 'playing') this.btnRoll.textContent = t('rolling');
    else this.btnRoll.textContent = t('roll');
  },

  showTitle() {
    this.titleScreen.classList.remove('hidden');
    this.titleScreen.classList.add('is-active');
    this.pauseScreen.classList.add('hidden');
    this.resultScreen.classList.add('hidden');
    this.hud.classList.add('hidden');
    this.btnRoll.classList.add('hidden');
    this.applyLang();
  },

  showGame() {
    this.titleScreen.classList.add('hidden');
    this.titleScreen.classList.remove('is-active');
    this.pauseScreen.classList.add('hidden');
    this.resultScreen.classList.add('hidden');
    this.hud.classList.remove('hidden');
    this.btnRoll.classList.remove('hidden');
    this.applyLang();
  },

  showPause() {
    this.pauseScreen.classList.remove('hidden');
    this.applyLang();
  },

  hidePause() {
    this.pauseScreen.classList.add('hidden');
  },

  showResult(run) {
    this.resultScreen.classList.remove('hidden');
    const hud = run.getHud();
    const human = hud.players[0];
    this.resultStars.textContent = '★'.repeat(human.stars);
    const placeKey = hud.players.filter((p) => p.finished).length >= 1
      ? ['place1st', 'place2nd', 'place3rd', 'place4th'][Math.min(3, (run.state.finishCount || 1) - 1)]
      : 'place1st';
    this.resultMeta.textContent = `${t('yourPlace')}: ${t(placeKey)} · ${t('gemsCollected')}: ${human.gems}`;
    const hasNext = run.state.levelIndex < 2;
    this.btnNext.classList.toggle('hidden', !hasNext);
    this.applyLang();
  },
};

// ---------------- 首次交互引导 ----------------
export const tutorial = {
  active: false,
  step: 0,
  steps: ['roll', 'climb', 'race'],
  current: null,
  onSkip: null,

  render() {
    const n = this.step + 1;
    ui.tutTitle.textContent = t(`tut${n}Title`);
    ui.tutText.textContent = t(`tut${n}Text`);
    this.current = ui.tutText.textContent;
  },

  startTutorial() {
    this.active = true;
    this.step = 0;
    ui.tutRoot.classList.remove('hidden');
    this.render();
  },

  next() {
    if (!this.active) return;
    this.step += 1;
    if (this.step >= this.steps.length) {
      this.skip();
      return;
    }
    this.render();
  },

  skip() {
    this.active = false;
    ui.tutRoot.classList.add('hidden');
    Sdk.save('tutDone', true);
    if (typeof this.onSkip === 'function') this.onSkip();
  },

  isDone() {
    return Sdk.load('tutDone', false) === true;
  },
};
