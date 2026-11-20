// src/ui/index.js — createUI 装配：标题 / HUD / 题目面板 / 暂停 / 结算 / 首次引导 / i18n。
// 契约：createUI(root, hooks) → { show(screen), setHud(hud), onTutorial(cb), hideAll(), setBest(best), applyLang(), els, tutorial, lang }。
// hooks：onStart / onResume / onRestart / onShare / onHow / onAnswer(i) / onSkip() / onHover(i|null)。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';
import Sdk from '../core/sdk.js';
import { createScreens } from './screens.js';
import { createHud } from './hud.js';
import { TutorialMachine, createTutorialOverlay, TUTORIAL_KEY, TUT_STEP_IDS } from './tutorial.js';

export function createUI(root, hooks = {}) {
  const screens = createScreens(root);
  const hud = createHud(root);

  const machine = new TutorialMachine({
    save: (k, v) => Sdk.save(k, v),
    load: (k, d) => Sdk.load(k, d),
    key: TUTORIAL_KEY,
  });
  const overlay = createTutorialOverlay(root, machine);
  const els = screens.els;

  let lastHud = null;
  let lastResult = null;
  let bestWins = 0;
  let tutorialDoneCb = null;

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

  function applyLang() {
    syncDocumentLang();
    root.querySelectorAll('[data-i18n]').forEach((n) => { n.textContent = t(n.dataset.i18n); });
    root.querySelectorAll('[data-i18n-aria]').forEach((n) => { n.setAttribute('aria-label', t(n.dataset.i18nAria)); });
    fillLang();
    setBest(bestWins);
    if (lastResult) screens.renderResult(lastResult);
    if (lastHud) hud.setHud(lastHud);
    overlay.render();
  }

  function setBest(best) {
    bestWins = Math.max(0, Math.floor(best ?? 0));
    screens.setBest(bestWins);
  }

  function setResult(data) {
    lastResult = data || {};
    screens.renderResult(lastResult);
  }

  function setHud(h) {
    lastHud = h || {};
    hud.setHud(lastHud);
  }

  function hideAll() {
    for (const key of ['title', 'pause', 'result', 'settings']) {
      els[key].classList.add('hidden');
    }
    hud.hide();
    overlay.hide();
  }

  function show(screen, data) {
    if (screen === 'dead' || screen === 'finished') {
      if (data) setResult(data);
    }
    const isTitle = screen === 'title';
    const isPlaying = screen === 'playing';
    const isPaused = screen === 'paused';
    const isDead = screen === 'dead' || screen === 'finished';
    const isSettings = screen === 'settings';

    els.title.classList.toggle('hidden', !isTitle);
    els.pause.classList.toggle('hidden', !isPaused);
    els.result.classList.toggle('hidden', !isDead);
    els.settings.classList.toggle('hidden', !isSettings);

    if (isPlaying) {
      hud.show();
      if (!machine.done && !machine.active) machine.begin();
      if (machine.active) overlay.show();
    } else {
      hud.hide();
      overlay.hide();
    }

    if (isTitle || isSettings) applyLang();
  }

  function finishTutorial(result) {
    overlay.hide();
    if (tutorialDoneCb) {
      try { tutorialDoneCb(result); } catch { /* 回调异常不影响游戏 */ }
    }
  }
  machine.onDone = finishTutorial;

  function onTutorial(cb) {
    tutorialDoneCb = cb || null;
  }

  // 语言切换
  for (const sel of els.langSelects) {
    if (!sel) continue;
    sel.addEventListener('change', (e) => {
      if (i18n.setLang(e.target.value)) applyLang();
    });
  }

  // 设置
  els.btnSettings.addEventListener('click', () => show('settings'));
  els.btnSettingsBack.addEventListener('click', () => show('title'));

  // 重看引导
  const replay = () => {
    machine.replay();
    overlay.show();
    if (typeof hooks.onHow === 'function') hooks.onHow();
  };
  els.btnHow.addEventListener('click', replay);
  els.btnHowPause.addEventListener('click', replay);

  // 游戏流转按钮
  const noop = () => {};
  els.btnStart.addEventListener('click', () => (hooks.onStart || noop)());
  els.btnResume.addEventListener('click', () => (hooks.onResume || noop)());
  els.btnRestart.addEventListener('click', () => (hooks.onRestart || noop)());
  els.btnAgain.addEventListener('click', () => (hooks.onRestart || noop)());
  els.btnShare.addEventListener('click', () => (hooks.onShare || noop)());

  // 题目面板交互
  hud.optButtons.forEach((btn, i) => {
    btn.addEventListener('click', () => {
      if (typeof hooks.onAnswer === 'function') hooks.onAnswer(i);
    });
    btn.addEventListener('pointerenter', () => {
      hud.setHover(i);
      if (typeof hooks.onHover === 'function') hooks.onHover(i);
    });
    btn.addEventListener('pointerleave', () => {
      if (typeof hooks.onHover === 'function') hooks.onHover(null);
    });
  });
  hud.skipBtn.addEventListener('click', () => {
    if (typeof hooks.onSkip === 'function') hooks.onSkip();
  });

  applyLang();

  return {
    show,
    setHud,
    onTutorial,
    hideAll,
    setBest,
    setResult,
    applyLang,
    els,
    hud,
    tutorial: {
      machine,
      overlay,
      get active() { return machine.active; },
      get step() { return machine.step; },
      get steps() { return TUT_STEP_IDS; },
      get current() { return machine.currentId; },
      begin: () => machine.begin(),
      replay,
      skip: () => machine.skip(),
      onGameEvent: (ev, now) => {
        const s = machine.onGameEvent(ev, now);
        overlay.render();
        return s;
      },
      tick: (now) => machine.tick(now),
      state: () => machine.snapshot(),
    },
    get lang() { return i18n.lang; },
    get dir() { return i18n.dir; },
  };
}

export default createUI;
