// src/ui/index.js — createUI 装配：标题 / HUD / 暂停 / 结算 / 升级 / 首次引导 / i18n。
// 契约：createUI(root, hooks) → { show, setHud, onTutorial, hideAll, els, tutorial, applyLang }。
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
  let lastOffers = null;
  let bestLength = 0;
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
    fillLang();
    setBest(bestLength);
    if (lastResult) screens.renderResult(lastResult);
    if (lastOffers) screens.renderUpgrade(lastOffers);
    if (lastHud) hud.setHud(lastHud);
    overlay.render();
  }

  function setBest(best) {
    bestLength = Math.max(0, Math.floor(best ?? 0));
    screens.setBest(bestLength);
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
    for (const key of ['title', 'pause', 'result', 'upgrade', 'settings']) {
      els[key].classList.add('hidden');
    }
    hud.hide();
    overlay.hide();
  }

  function show(screen, data) {
    if (screen === 'result') setResult(data);
    if (screen === 'upgrade') {
      lastOffers = data?.offers || [];
      screens.renderUpgrade(lastOffers);
      els.upgradeSubtitle.textContent = t('up.subtitle', { round: data?.round || 1 });
    }

    const isTitle = screen === 'title';
    const isPlaying = screen === 'playing';
    const isPaused = screen === 'paused';
    const isResult = screen === 'result';
    const isUpgrade = screen === 'upgrade';
    const isSettings = screen === 'settings';

    els.title.classList.toggle('hidden', !isTitle);
    els.pause.classList.toggle('hidden', !isPaused);
    els.result.classList.toggle('hidden', !isResult);
    els.upgrade.classList.toggle('hidden', !isUpgrade);
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
  els.btnAgain.addEventListener('click', () => (hooks.onRestart || noop)());
  els.btnShare.addEventListener('click', () => (hooks.onShare || noop)());
  els.upgradeChoices.addEventListener('click', (e) => {
    const b = e.target.closest('[data-upgrade-index]');
    if (b && typeof hooks.onUpgrade === 'function') hooks.onUpgrade(Number(b.dataset.upgradeIndex));
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
        machine.onGameEvent(ev, now);
        overlay.render();
      },
      tick: (now) => machine.tick(now),
      state: () => machine.snapshot(),
    },
    get lang() { return i18n.lang; },
    get dir() { return i18n.dir; },
  };
}

export default createUI;
