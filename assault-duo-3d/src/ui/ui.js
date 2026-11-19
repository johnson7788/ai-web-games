// ASSAULT DUO 3D · UI 模块（标题 / 暂停 / 结算 / HUD / 教程 / 竖屏提示）
import { i18n, t, syncDocumentLang } from '../core/i18n.js';
import { save } from '../core/save.js';

const $ = (id) => document.getElementById(id);

const TUT_STEPS = [
  { id: 'move', textKey: 'tutMove' },
  { id: 'fire', textKey: 'tutFire' },
  { id: 'jump', textKey: 'tutJump' },
  { id: 'duo', textKey: 'tutDuo' },
];

export const ui = {
  titleScreen: $('screen-title'),
  pauseScreen: $('screen-pause'),
  resultScreen: $('screen-result'),
  hud: $('hud'),
  tutorialOverlay: $('tutorial'),
  tutCard: $('tut-card'),
  tutTitle: $('tut-title'),
  tutText: $('tut-text'),
  tutNextBtn: $('tut-next'),
  tutSkipBtn: $('tut-skip'),
  titleText: $('title-text'),
  subtitleText: $('subtitle-text'),
  titleHints: $('title-hints'),
  btnStart: $('btn-start'),
  btnResume: $('btn-resume'),
  btnRestart2: $('btn-restart2'),
  btnHome2: $('btn-home2'),
  btnRetry: $('btn-retry'),
  btnNext: $('btn-next'),
  btnHome3: $('btn-home3'),
  resultTitle: $('result-title'),
  resultStars: $('result-stars'),
  resultMeta: $('result-meta'),
  pauseTitle: $('pause-title'),
  hudLevel: $('hud-level'),
  hudTargets: $('hud-targets'),
  hudWave: $('hud-wave'),
  hudScore: $('hud-score'),
  hudCombo: $('hud-combo'),
  hudWeapon: $('hud-weapon'),
  hpText: $('hp-text'),
  hpFill: $('hp-fill'),
  duoText: $('duo-text'),
  duoFill: $('duo-fill'),
  langSelects: [$('lang-select'), $('lang-select-pause')],
  muteBtn: $('btn-mute'),

  // 教程状态（与 window.__ll.tutorial 契约一致）
  tutorial: { active: false, step: 0, steps: TUT_STEPS.map((s) => s.id), current: TUT_STEPS[0].id },

  applyLang() {
    syncDocumentLang();
    this.titleText.textContent = t('title');
    this.subtitleText.textContent = t('subtitle');
    this.btnStart.textContent = t('start');
    this.btnResume.textContent = t('resume');
    this.btnRestart2.textContent = t('restart');
    this.btnHome2.textContent = t('menu');
    this.btnHome3.textContent = t('menu');
    this.btnRetry.textContent = t('retry');
    this.btnNext.textContent = t('nextLevel');
    this.pauseTitle.textContent = t('paused');
    this.titleHints.innerHTML = [t('moveHint'), t('jumpHint'), t('fireHint'), t('switchHint'), t('blastHint')].join('<br>');
    document.querySelectorAll('[data-tutorial-replay]').forEach((b) => { b.textContent = t('howto'); });
    this.tutNextBtn.textContent = t('gotit');
    this.tutSkipBtn.textContent = t('skip');
    for (const sel of this.langSelects) if (sel) sel.setAttribute('aria-label', t('language'));
    this.fillLangOptions();
    if (!this.tutorial.active) this.renderTutStep();
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
    this.tutorialOverlay.classList.add('hidden');
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

  showResult(stats) {
    this.resultTitle.textContent = stats.won ? t('win') : t('lose');
    this.resultStars.textContent = stats.won ? '★'.repeat(Math.max(1, stats.stars)) : '—';
    this.resultMeta.textContent = `${t('score')}: ${stats.score}`;
    this.btnNext.classList.toggle('hidden', !stats.won || stats.isLastLevel);
    this.resultScreen.classList.remove('hidden');
    this.applyLang();
  },

  hideResult() {
    this.resultScreen.classList.add('hidden');
  },

  updateHUD(hud) {
    this.hudLevel.textContent = 'L' + hud.level;
    this.hudTargets.textContent = t('targets') + ' ' + hud.remaining;
    this.hudWave.textContent = t('wave') + ' ' + hud.wave;
    this.hudScore.textContent = String(hud.score);
    if (hud.combo >= 2) {
      this.hudCombo.classList.remove('hidden');
      this.hudCombo.textContent = t('combo') + ' x' + hud.combo;
    } else {
      this.hudCombo.classList.add('hidden');
    }
    this.hudWeapon.textContent = t('weapon' + (hud.weapon + 1));
    this.hpText.textContent = t('hp');
    this.hpFill.style.width = Math.max(0, Math.min(100, (hud.hp / hud.maxHp) * 100)) + '%';
    this.duoFill.style.width = Math.max(0, Math.min(100, hud.duoMeter)) + '%';
    this.duoText.textContent = t('duo') + (hud.duoReady ? '!' : '');
    this.duoText.classList.toggle('ready', !!hud.duoReady);
  },

  // ---- 教程 ----
  renderTutStep() {
    const s = TUT_STEPS[this.tutorial.step] || TUT_STEPS[0];
    this.tutTitle.textContent = t('howto') + ' · ' + (this.tutorial.step + 1) + '/' + TUT_STEPS.length;
    this.tutText.textContent = t(s.textKey);
  },

  startTutorial() {
    this.tutorial.active = true;
    this.tutorial.step = 0;
    this.tutorial.current = TUT_STEPS[0].id;
    this.tutorialOverlay.classList.remove('hidden');
    this.renderTutStep();
  },

  tutNext() {
    if (this.tutorial.step >= TUT_STEPS.length - 1) {
      this.finishTutorial();
      return;
    }
    this.tutorial.step += 1;
    this.tutorial.current = TUT_STEPS[this.tutorial.step].id;
    this.renderTutStep();
  },

  tutSkip() {
    this.finishTutorial();
  },

  finishTutorial() {
    this.tutorial.active = false;
    this.tutorialOverlay.classList.add('hidden');
    save.set('tutSeen', true);
  },
};
