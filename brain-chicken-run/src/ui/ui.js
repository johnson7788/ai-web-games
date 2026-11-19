// src/ui/ui.js — createUI 装配：标题 / HUD / 题目卡 / 作答条 / 暂停 / 结算 / 引导 / i18n。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';
import Sdk from '../core/sdk.js';
import { TutorialMachine, createTutorialOverlay, TUT_STEP_IDS, TUTORIAL_KEY } from './tutorial.js';

export function createUI(root, hooks = {}) {
  const els = {
    canvas: root.querySelector('#canvas'),
    hud: root.querySelector('#hud'),
    hudStage: root.querySelector('#hud-stage'),
    hudScore: root.querySelector('#hud-score'),
    hudCombo: root.querySelector('#hud-combo'),
    hudShield: root.querySelector('#hud-shield'),
    questionCard: root.querySelector('#question-card'),
    qCategory: root.querySelector('#q-category'),
    qGolden: root.querySelector('#q-golden'),
    qText: root.querySelector('#q-text'),
    qHint: root.querySelector('#q-hint'),
    qTimer: root.querySelector('#q-timer'),
    answerBar: root.querySelector('#answer-bar'),
    btnTrue: root.querySelector('#btn-true'),
    btnFalse: root.querySelector('#btn-false'),
    screenTitle: root.querySelector('#screen-title'),
    screenPause: root.querySelector('#screen-pause'),
    screenResult: root.querySelector('#screen-result'),
    titleText: root.querySelector('#title-text'),
    subtitle: root.querySelector('#subtitle-text'),
    bestScore: root.querySelector('#best-score'),
    btnStart: root.querySelector('#btn-start'),
    btnHowto: root.querySelector('#btn-howto'),
    btnResume: root.querySelector('#btn-resume'),
    btnRestart: root.querySelector('#btn-restart'),
    btnHome: root.querySelector('#btn-home'),
    btnHome2: root.querySelector('#btn-home2'),
    btnRetry: root.querySelector('#btn-retry'),
    btnShare: root.querySelector('#btn-share'),
    pauseTitle: root.querySelector('#pause-title'),
    pauseHint: root.querySelector('#pause-hint'),
    resultTitle: root.querySelector('#result-title'),
    resultStars: root.querySelector('#result-stars'),
    resultMeta: root.querySelector('#result-meta'),
    langSelects: root.querySelectorAll('.lang-select'),
    toast: root.querySelector('#toast'),
    btnMute: root.querySelector('#btn-mute'),
    btnPause: root.querySelector('#btn-pause'),
    rotateText: root.querySelector('#rotate-text'),
    btnRotateSkip: root.querySelector('#btn-rotate-skip'),
  };

  const machine = new TutorialMachine({
    save: (k, v) => Sdk.save(k, v),
    load: (k, d) => Sdk.load(k, d),
    key: TUTORIAL_KEY,
  });
  const overlay = createTutorialOverlay(root, machine);

  let lastHud = null;
  let lastResult = null;
  let bestScore = 0;
  let tutorialDoneCb = null;
  let toastTimer = null;

  function fillLang() {
    for (const sel of els.langSelects) {
      if (!sel) continue;
      sel.innerHTML = '';
      for (const opt of i18n.options()) {
        const o = document.createElement('option');
        o.value = opt.code;
        o.textContent = opt.name;
        if (opt.code === i18n.lang) o.selected = true;
        sel.appendChild(o);
      }
      sel.setAttribute('aria-label', t('set.language'));
    }
  }

  function applyStatic() {
    root.querySelectorAll('[data-i18n]').forEach((n) => { n.textContent = t(n.dataset.i18n); });
    root.querySelectorAll('[data-i18n-aria]').forEach((n) => { n.setAttribute('aria-label', t(n.dataset.i18nAria)); });
  }

  function applyLang() {
    syncDocumentLang();
    applyStatic();
    fillLang();
    if (lastHud) setHud(lastHud);
    if (lastResult) renderResult(lastResult);
    els.rotateText.textContent = t('rotate.text');
    els.btnRotateSkip.textContent = t('btn.rotateSkip');
    overlay.render();
  }

  function setBest(best) {
    bestScore = Math.max(0, Math.floor(best ?? 0));
    els.bestScore.textContent = t('title.best', { score: bestScore });
  }

  function setHud(h) {
    lastHud = h || {};
    const hud = lastHud;
    els.hudStage.textContent = `${t('hud.stage')} ${hud.stage ?? 1}`;
    els.hudScore.textContent = `${t('hud.score')} ${hud.score ?? 0}`;
    els.hudCombo.textContent = `${t('hud.combo')} ${hud.combo ?? 0}`;
    els.hudShield.textContent = `${t('hud.shield')} ${hud.shield ?? 0}`;

    const q = hud.question;
    if (q) {
      els.questionCard.classList.remove('hidden');
      els.qCategory.textContent = t('q.category');
      els.qGolden.classList.toggle('hidden', !q.golden);
      els.qGolden.textContent = t('q.golden');
      const text = (q.text && (q.text[i18n.lang] || q.text.en)) || '';
      els.qText.textContent = text;
      els.qHint.textContent = t('q.tapHint');
      els.qTimer.textContent = `${t('hud.timer')} ${q.timer}`;
    } else {
      els.questionCard.classList.add('hidden');
    }

    // 当前选择的按钮高亮（0.5 = 未选择，两个都不亮）
    els.btnTrue.classList.toggle('selected', hud.playerCamp < 0.5);
    els.btnFalse.classList.toggle('selected', hud.playerCamp > 0.5);
  }

  function renderResult(data) {
    lastResult = data || {};
    const won = !!data.won;
    els.resultTitle.textContent = won ? t('result.titleWin') : t('result.titleLose');
    els.resultTitle.classList.toggle('win', won);
    els.resultTitle.classList.toggle('lose', !won);
    const stars = data.stars ?? 0;
    els.resultStars.textContent = '★'.repeat(Math.max(0, stars)) + '☆'.repeat(Math.max(0, 3 - stars));
    els.resultMeta.innerHTML = [
      `${t('result.rank')} #${data.rank ?? '—'}`,
      `${t('result.score')} ${data.score ?? 0}`,
      `${t('result.correct')} ${data.correct ?? 0}`,
      `${t('result.combo')} ${data.maxCombo ?? 0}`,
    ].map((s) => `<div>${s}</div>`).join('');
    if (data.newRecord) {
      const d = document.createElement('div');
      d.className = 'new-record';
      d.textContent = t('result.newRecord');
      els.resultMeta.appendChild(d);
    }
  }

  function hideAll() {
    els.screenTitle.classList.add('hidden');
    els.screenPause.classList.add('hidden');
    els.screenResult.classList.add('hidden');
    els.hud.classList.add('hidden');
    els.answerBar.classList.add('hidden');
    els.questionCard.classList.add('hidden');
  }

  function show(screen, data) {
    const isTitle = screen === 'title';
    const isPlaying = screen === 'playing';
    const isPaused = screen === 'paused';
    const isResult = screen === 'finished';

    els.screenTitle.classList.toggle('hidden', !isTitle);
    els.screenPause.classList.toggle('hidden', !isPaused);
    els.screenResult.classList.toggle('hidden', !isResult);
    els.hud.classList.toggle('hidden', !isPlaying && !isPaused);
    els.answerBar.classList.toggle('hidden', !isPlaying);
    els.questionCard.classList.toggle('hidden', !isPlaying && !isPaused);

    if (isResult && data) renderResult(data);

    if (isPlaying) {
      if (!machine.done && !machine.active) machine.begin();
      if (machine.active) overlay.show();
    } else {
      overlay.hide();
    }

    if (isTitle || isPaused) applyLang();
  }

  function finishTutorial(result) {
    overlay.hide();
    if (tutorialDoneCb) {
      try { tutorialDoneCb(result); } catch { /* noop */ }
    }
  }
  machine.onDone = finishTutorial;

  function onTutorial(cb) {
    tutorialDoneCb = cb || null;
  }

  function showToast(text) {
    if (!els.toast) return;
    els.toast.textContent = text;
    els.toast.classList.remove('hidden');
    els.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      els.toast.classList.remove('show');
      els.toast.classList.add('hidden');
    }, 1600);
  }

  // 事件绑定
  els.btnStart.addEventListener('click', () => { hooks.onStart?.(); });
  els.btnHowto.addEventListener('click', () => { machine.replay(); overlay.show(); });
  els.btnResume.addEventListener('click', () => { hooks.onResume?.(); });
  els.btnRestart.addEventListener('click', () => { hooks.onRestart?.(); });
  els.btnHome.addEventListener('click', () => { hooks.onHome?.(); });
  els.btnHome2.addEventListener('click', () => { hooks.onHome?.(); });
  els.btnRetry.addEventListener('click', () => { hooks.onRetry?.(); });
  els.btnShare.addEventListener('click', () => { hooks.onShare?.(); });
  els.btnPause.addEventListener('click', () => { hooks.onPause?.(); });
  els.btnMute.addEventListener('click', () => { hooks.onMute?.(); });
  els.btnTrue.addEventListener('click', () => { hooks.onAnswer?.('true'); });
  els.btnFalse.addEventListener('click', () => { hooks.onAnswer?.('false'); });

  for (const sel of els.langSelects) {
    if (!sel) continue;
    sel.addEventListener('change', (e) => {
      if (i18n.setLang(e.target.value)) applyLang();
    });
  }

  return {
    els,
    tutorial: {
      get active() { return machine.active; },
      get step() { return machine.step; },
      get steps() { return TUT_STEP_IDS; },
      get current() { return machine.currentId; },
      skip: () => machine.skip(),
      replay: () => machine.replay(),
      onGameEvent: (ev) => {
        const s = machine.onGameEvent(ev);
        if (machine.active && overlay.visible) overlay.render();
        return s;
      },
      tick: () => {
        if (machine.active && overlay.visible) overlay.render();
      },
    },
    overlay,
    onTutorial,
    applyLang,
    setHud,
    setBest,
    renderResult,
    show,
    hideAll,
    showToast,
  };
}
