// src/ui/index.js — UI 装配：屏幕切换 / HUD / 引导 / 语言 / 按钮回调。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';
import { createScreens } from './screens.js';
import { createHud } from './hud.js';
import { TutorialMachine, createTutorialOverlay, TUT_STEP_IDS } from './tutorial.js';

export function createUI(root, callbacks = {}) {
  const screens = createScreens(root);
  const hud = createHud(root);

  const machine = new TutorialMachine({
    save: callbacks.save,
    load: callbacks.load,
  });
  const overlay = createTutorialOverlay(root, machine, { canvas: root.querySelector('canvas') });
  machine.onDone = (result) => {
    overlay.hide();
    if (typeof callbacks.onTutorial === 'function') callbacks.onTutorial(result);
  };

  const els = screens.els;
  let bestLevel = 0;

  function applyLang() {
    syncDocumentLang();
    for (const el of root.querySelectorAll('[data-i18n]')) {
      const key = el.getAttribute('data-i18n');
      el.textContent = t(key);
    }
    for (const sel of els.langSelects) {
      if (sel) sel.setAttribute('aria-label', t('set.language'));
    }
    fillLangOptions();
    setBest(bestLevel);
    // 刷新 HUD 文案（label 已有 data-i18n，由上方循环刷新）
  }

  function fillLangOptions() {
    for (const sel of els.langSelects) {
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
  }

  function setLang(lang) {
    i18n.setLang(lang);
    applyLang();
    return i18n.lang;
  }

  function setBest(best) {
    bestLevel = Math.max(0, Number(best) || 0);
    screens.setBest(bestLevel);
  }

  function show(phase, resultData) {
    applyLang();
    const s = screens.els;
    const all = [s.title, s.pause, s.result, s.settings];
    all.forEach((x) => { x.classList.add('hidden'); x.classList.remove('is-active'); });
    if (phase === 'title') { s.title.classList.remove('hidden'); s.title.classList.add('is-active'); }
    else if (phase === 'paused') s.pause.classList.remove('hidden');
    else if (phase === 'settings') s.settings.classList.remove('hidden');
    else if (phase === 'win' || phase === 'dead') {
      s.result.classList.remove('hidden');
      screens.renderResult(resultData);
    }
    // playing / boot：不显示任何屏
    hud.wrap.classList.toggle('hidden', phase !== 'playing' && phase !== 'paused');
    if (phase === 'playing') {
      if (machine.begin()) overlay.show();
    }
    if (phase !== 'playing' && overlay.visible) overlay.hide();
  }

  function showTutorialReplay() {
    machine.replay();
    overlay.show();
    // 重看时若当前处于标题，保持标题；若在 playing，暂停引导需 overlay 显示即可
  }

  // 按钮事件
  els.btnStart.addEventListener('click', () => callbacks.onStart && callbacks.onStart());
  els.btnResume.addEventListener('click', () => callbacks.onResume && callbacks.onResume());
  els.btnRestart.addEventListener('click', () => callbacks.onRestart && callbacks.onRestart());
  els.btnAgain.addEventListener('click', () => callbacks.onAgain && callbacks.onAgain());
  els.btnNext.addEventListener('click', () => callbacks.onNext && callbacks.onNext());
  els.btnShare.addEventListener('click', () => callbacks.onShare && callbacks.onShare());
  els.btnSettings.addEventListener('click', () => { callbacks.onSettings && callbacks.onSettings(); show('settings'); });
  els.btnSettingsBack.addEventListener('click', () => callbacks.onSettingsBack && callbacks.onSettingsBack());
  for (const b of [els.btnHow, els.btnHowPause]) {
    b.addEventListener('click', () => showTutorialReplay());
  }
  for (const sel of els.langSelects) {
    if (sel) sel.addEventListener('change', (e) => setLang(e.target.value));
  }

  return {
    els,
    hud,
    screens,
    tutorial: {
      get active() { return machine.active; },
      get step() { return machine.step; },
      get steps() { return TUT_STEP_IDS; },
      get current() { return machine.currentId; },
      skip: () => machine.skip(),
      onGameEvent: (ev) => machine.onGameEvent(ev),
      begin: () => machine.begin(),
      replay: () => showTutorialReplay(),
    },
    overlay,
    applyLang,
    setLang,
    setBest,
    setHud: (h) => hud.setHud(h),
    show,
  };
}
