// src/ui/index.js — createUI 装配：标题 / HUD / 暂停 / 结算 / 过关 / 胜利 / 首次引导 / i18n。
// 契约：createUI(root, hooks) → { show(screen), setHud(hud), onTutorial(cb), hideAll() }。
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
  let lastCleared = null;
  let bestDish = 0;
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
    setBest(bestDish);
    if (lastResult) screens.renderResult(lastResult);
    if (lastCleared) screens.renderCleared(lastCleared);
    if (lastHud) hud.setHud(lastHud);
    overlay.render();
  }

  function setBest(best) {
    bestDish = Math.max(0, Math.floor(best ?? 0));
    screens.setBest(bestDish);
  }

  function setResult(data) {
    lastResult = data || {};
    screens.renderResult(lastResult);
  }

  function setCleared(data) {
    lastCleared = data || {};
    screens.renderCleared(lastCleared);
  }

  function setHud(h) {
    lastHud = h || {};
    hud.setHud(lastHud);
  }

  function hideAll() {
    for (const key of ['title', 'pause', 'result', 'cleared', 'victory', 'settings']) {
      els[key].classList.add('hidden');
    }
    hud.hide();
    overlay.hide();
  }

  function show(screen, data) {
    if (screen === 'dead' && data) setResult(data);
    if (screen === 'cleared' && data) setCleared(data);

    els.title.classList.toggle('hidden', screen !== 'title');
    els.pause.classList.toggle('hidden', screen !== 'paused');
    els.result.classList.toggle('hidden', screen !== 'dead');
    els.cleared.classList.toggle('hidden', screen !== 'cleared');
    els.victory.classList.toggle('hidden', screen !== 'victory');
    els.settings.classList.toggle('hidden', screen !== 'settings');

    if (screen === 'playing') {
      hud.show();
      if (!machine.done && !machine.active) machine.begin();
      if (machine.active) overlay.show();
    } else {
      hud.hide();
      overlay.hide();
    }

    if (screen === 'title') applyLang();
    if (screen === 'settings') applyLang();
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

  // 语言切换（UI 自包含）：即时生效 + 刷新保留
  for (const sel of els.langSelects) {
    if (!sel) continue;
    sel.addEventListener('change', (e) => {
      if (i18n.setLang(e.target.value)) applyLang();
    });
  }

  // 设置
  els.btnSettings.addEventListener('click', () => show('settings'));
  els.btnSettingsBack.addEventListener('click', () => show('title'));
  els.btnSound.addEventListener('click', () => {
    if (typeof hooks.onSound === 'function') hooks.onSound();
  });

  // 重看引导
  const replay = () => {
    machine.replay();
    overlay.show();
    if (typeof hooks.onHow === 'function') hooks.onHow();
  };
  els.btnHow.addEventListener('click', replay);
  els.btnHowPause.addEventListener('click', replay);

  // 游戏流转
  const noop = () => {};
  els.btnStart.addEventListener('click', () => (hooks.onStart || noop)());
  els.btnResume.addEventListener('click', () => (hooks.onResume || noop)());
  els.btnRestart.addEventListener('click', () => (hooks.onRestart || noop)());
  els.btnAgain.addEventListener('click', () => (hooks.onRestart || noop)());
  els.btnAgainVictory.addEventListener('click', () => (hooks.onRestart || noop)());
  els.btnShare.addEventListener('click', () => (hooks.onShare || noop)());
  els.btnContinue.addEventListener('click', () => (hooks.onContinue || noop)());
  hud.els.phageBtn.addEventListener('click', () => (hooks.onPhage || noop)());

  applyLang();

  return {
    show,
    setHud,
    onTutorial,
    hideAll,
    setBest,
    setResult,
    setCleared,
    applyLang,
    setSoundLabel: (m) => screens.setSoundLabel(m),
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
      onGameEvent: (ev) => {
        const s = machine.onGameEvent(ev);
        overlay.render();
        return s;
      },
    },
    get lang() { return i18n.lang; },
    get dir() { return i18n.dir; },
  };
}

export default createUI;
