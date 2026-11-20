// src/ui/index.js — MARRY RICH · createUI 装配：标题/玩法/暂停/结局/记忆碎片 + HUD + 首次引导 + i18n。
// 契约：createUI(root, hooks) → { show, setHud, setPlay, applyLang, els, tutorial, ... }。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';
import Sdk from '../core/sdk.js';
import { createScreens } from './screens.js';
import { createHud } from './hud.js';
import { TutorialMachine, createTutorialOverlay, TUTORIAL_KEY, TUT_STEP_IDS } from './tutorial.js';
import { ENDINGS } from '../../config/endings.js';

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
  let endingsFound = 0;

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
    hud.applyLang();
    screens.setBest(endingsFound, ENDINGS.length);
    if (lastHud) {
      if (lastHud.phase === 'ended') screens.renderEnding(lastEnding, endingsFound, ENDINGS.length);
      else screens.renderPlay(lastHud);
      if (lastHud.stage === 'result') screens.renderResult(lastHud);
    }
    overlay.render();
  }

  let lastEnding = null;

  function setBest() {
    screens.setBest(endingsFound, ENDINGS.length);
  }

  function addEndingFound() {
    endingsFound += 1;
    if (endingsFound > ENDINGS.length) endingsFound = ENDINGS.length;
    Sdk.save('endingsFound', endingsFound);
  }

  function setHud(h) {
    lastHud = h || {};
    hud.setHud(lastHud);
  }

  function setPlay(h) {
    lastHud = h || {};
    screens.renderPlay(lastHud);
    screens.showChoiceOrResult(lastHud);
  }

  function hideAll() {
    for (const key of ['title', 'play', 'pause', 'ending', 'memory', 'settings']) {
      els[key].classList.add('hidden');
    }
    hud.hide();
    overlay.hide();
  }

  function show(screen, data) {
    const map = { title: 'title', play: 'play', paused: 'pause', ending: 'ending', memory: 'memory', settings: 'settings' };
    const key = map[screen] || 'title';
    for (const k of ['title', 'play', 'pause', 'ending', 'memory', 'settings']) {
      els[k].classList.toggle('hidden', k !== key);
    }

    const isPlaying = key === 'play';
    if (isPlaying) {
      hud.show();
      if (!machine.done && !machine.active) machine.begin();
      if (machine.active) overlay.show();
    } else {
      hud.hide();
      overlay.hide();
    }

    if (key === 'title' || key === 'settings') applyLang();
  }

  function finishTutorial(result) {
    overlay.hide();
    if (hooks.onTutorial) {
      try { hooks.onTutorial(result); } catch { /* 回调异常不影响游戏 */ }
    }
  }
  machine.onDone = finishTutorial;

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
  els.btnAgain.addEventListener('click', () => (hooks.onStart || noop)());
  els.btnShare.addEventListener('click', () => (hooks.onShare || noop)());
  els.btnContinue.addEventListener('click', () => (hooks.onContinue || noop)());
  els.btnMemory.addEventListener('click', () => (hooks.onMemory || noop)());
  els.btnMemoryClose.addEventListener('click', () => (hooks.onMemoryClose || noop)());

  // 选项点击（事件委托）
  els.choices.addEventListener('click', (e) => {
    const btn = e.target.closest('.choice-btn');
    if (!btn) return;
    const idx = Number(btn.dataset.choice);
    if (Number.isInteger(idx) && typeof hooks.onChoice === 'function') hooks.onChoice(idx);
  });

  applyLang();

  return {
    show,
    setHud,
    setPlay,
    applyLang,
    hideAll,
    setBest,
    addEndingFound,
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
      render: () => overlay.render(),
    },
    get lang() { return i18n.lang; },
    get dir() { return i18n.dir; },
    renderEnding: (ending, found) => {
      lastEnding = ending;
      screens.renderEnding(ending, found, ENDINGS.length);
    },
    renderMemory: (history) => screens.renderMemory(history),
    setEndingsFound: (n) => { endingsFound = Math.max(0, Math.floor(n ?? 0)); setBest(); },
  };
}

export default createUI;
