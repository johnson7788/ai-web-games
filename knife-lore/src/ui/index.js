// src/ui/index.js — createUI 装配：标题 / HUD / 暂停 / 过关 / 失败 / 通关 / 首次引导 / i18n。
// 契约：createUI(root, hooks) → { show(screen, data), setHud(hud), onTutorial(cb), hideAll(), els, tutorial }。
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
  els.btnZantie = hud.el.querySelector('#btn-zantie');

  let lastHud = null;
  let bestLevel = 1;
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
    setBest(bestLevel);
    if (lastHud) hud.setHud(lastHud);
    overlay.render();
  }

  function setBest(level) {
    bestLevel = Math.max(1, Math.floor(level ?? 1));
    screens.setBest(bestLevel);
  }

  function setHud(h) {
    lastHud = h || {};
    hud.setHud(lastHud);
  }

  function hideAll() {
    for (const key of ['title', 'pause', 'clear', 'fail', 'won', 'settings']) {
      els[key].classList.add('hidden');
    }
    hud.hide();
    overlay.hide();
  }

  function show(screen, data) {
    const isTitle = screen === 'title';
    const isPlaying = screen === 'playing';
    const isPaused = screen === 'paused';
    const isClear = screen === 'clear';
    const isFail = screen === 'fail';
    const isWon = screen === 'won';
    const isSettings = screen === 'settings';

    els.title.classList.toggle('hidden', !isTitle);
    els.pause.classList.toggle('hidden', !isPaused);
    els.clear.classList.toggle('hidden', !isClear);
    els.fail.classList.toggle('hidden', !isFail);
    els.won.classList.toggle('hidden', !isWon);
    els.settings.classList.toggle('hidden', !isSettings);

    if (isClear) screens.renderClear(data);
    if (isFail) screens.renderFail(data);
    if (isWon) screens.renderWon(data);

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

  for (const sel of els.langSelects) {
    if (!sel) continue;
    sel.addEventListener('change', (e) => {
      if (i18n.setLang(e.target.value)) applyLang();
    });
  }

  els.btnSettings.addEventListener('click', () => show('settings'));
  els.btnSettingsBack.addEventListener('click', () => show('title'));

  const replay = () => {
    machine.replay();
    overlay.show();
    if (typeof hooks.onHow === 'function') hooks.onHow();
  };
  els.btnHow.addEventListener('click', replay);
  els.btnHowPause.addEventListener('click', replay);

  const noop = () => {};
  els.btnStart.addEventListener('click', () => (hooks.onStart || noop)());
  els.btnResume.addEventListener('click', () => (hooks.onResume || noop)());
  els.btnRestart.addEventListener('click', () => (hooks.onRestart || noop)());
  els.btnNext.addEventListener('click', () => (hooks.onNext || noop)());
  els.btnRetry.addEventListener('click', () => (hooks.onRetry || noop)());
  els.btnShare.addEventListener('click', () => (hooks.onShare || noop)());
  els.btnShareWon.addEventListener('click', () => (hooks.onShare || noop)());
  els.btnTitle.addEventListener('click', () => (hooks.onRestart || noop)());

  applyLang();

  return {
    show,
    setHud,
    onTutorial,
    hideAll,
    setBest,
    applyLang,
    els,
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
      onGameEvent: (ev) => {
        const s = machine.onGameEvent(ev);
        overlay.render();
        return s;
      },
      state: () => machine.snapshot(),
    },
    get lang() { return i18n.lang; },
    get dir() { return i18n.dir; },
  };
}

export default createUI;
