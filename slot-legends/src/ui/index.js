// src/ui/index.js — createUI 装配：标题 / HUD+控制条 / 暂停 / 结算 / 设置 / 首次引导 / i18n。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';
import Sdk from '../core/sdk.js';
import { createScreens } from './screens.js';
import { createHud } from './hud.js';
import { TutorialMachine, createTutorialOverlay, TUTORIAL_KEY, TUT_STEP_IDS } from './tutorial.js';

export function createUI(root, hooks = {}) {
  const screens = createScreens(root);
  const hud = createHud(root);
  const els = screens.els;

  const machine = new TutorialMachine({
    save: (k, v) => Sdk.save(k, v),
    load: (k, d) => Sdk.load(k, d),
    key: TUTORIAL_KEY,
  });
  const overlay = createTutorialOverlay(root, machine, {
    targets: {
      spin: hud.els.spinBtn,
      win: root.querySelector('canvas'),
      bet: hud.els.betBar,
    },
  });

  let lastHud = null;
  let lastResult = null;
  let bestBalance = 0;
  let lastLevel = 1;
  let muted = false;
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
    setBest(bestBalance);
    setTitleLevel(lastLevel);
    setMuteLabel(muted);
    if (lastResult) screens.renderResult(lastResult);
    if (lastHud) hud.setHud(lastHud);
    overlay.render();
  }

  function setBest(best) {
    bestBalance = Math.max(0, Math.floor(best ?? 0));
    screens.setBest(bestBalance);
  }

  function setTitleLevel(level) {
    lastLevel = Math.max(1, Math.floor(level ?? 1));
    screens.setTitleLevel(lastLevel);
  }

  function setResult(data) {
    lastResult = data || {};
    screens.renderResult(lastResult);
  }

  function setMuteLabel(m) {
    muted = !!m;
    screens.setMuteLabel(muted);
  }

  function setHud(h) {
    lastHud = h || {};
    hud.setHud(lastHud);
  }

  function setPhase(phase) {
    hud.setPhase(phase);
  }

  function flashFeedback(text, cls) {
    hud.flashFeedback(text, cls);
  }

  function hideAll() {
    for (const key of ['title', 'pause', 'result', 'settings']) {
      els[key].classList.add('hidden');
    }
    hud.hide();
    overlay.hide();
  }

  function show(screen, data) {
    if (screen === 'dead' && data) setResult(data);
    const isTitle = screen === 'title';
    const isPlaying = screen === 'playing';
    const isPaused = screen === 'paused';
    const isDead = screen === 'dead';
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

    if (isTitle) applyLang();
    if (isSettings) applyLang();
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

  for (const sel of els.langSelects) {
    if (!sel) continue;
    sel.addEventListener('change', (e) => {
      if (i18n.setLang(e.target.value)) applyLang();
    });
  }

  const noop = () => {};
  els.btnStart.addEventListener('click', () => (hooks.onPlay || noop)());
  els.btnResume.addEventListener('click', () => (hooks.onResume || noop)());
  els.btnRestart.addEventListener('click', () => (hooks.onRestart || noop)());
  els.btnAgain.addEventListener('click', () => (hooks.onPlay || noop)());
  els.btnShare.addEventListener('click', () => (hooks.onShare || noop)());
  els.btnSettings.addEventListener('click', () => show('settings'));
  els.btnSettingsBack.addEventListener('click', () => (hooks.onBackToTitle || noop)());
  els.btnMute.addEventListener('click', () => (hooks.onMute || noop)());

  const replay = () => {
    machine.replay();
    overlay.show();
    if (typeof hooks.onHow === 'function') hooks.onHow();
  };
  els.btnHow.addEventListener('click', replay);
  els.btnHowPause.addEventListener('click', replay);

  // 玩法控制条
  for (const b of hud.els.betButtons) {
    b.addEventListener('click', () => (hooks.onBet || noop)(Number(b.dataset.bet)));
  }
  hud.els.escortBtn.addEventListener('click', () => (hooks.onEscort || noop)());
  hud.els.spinBtn.addEventListener('click', () => (hooks.onSpinOrStop || noop)());

  applyLang();

  return {
    show,
    setHud,
    setPhase,
    setResult,
    setBest,
    setTitleLevel,
    setMuteLabel,
    flashFeedback,
    onTutorial,
    applyLang,
    hideAll,
    els,
    hud,
    screens,
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
    },
    get lang() { return i18n.lang; },
    get dir() { return i18n.dir; },
  };
}

export default createUI;
