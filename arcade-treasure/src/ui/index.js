// src/ui/index.js — createUI 装配：标题 / 机台选择 / HUD / 暂停 / 结算 / 打烊 / GRAND PRIX / 引导。
// 契约：createUI(root, hooks) → { show(screen, data), setHud(hud), onTutorial(cb), applyLang, els, tutorial }。
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
  const overlay = createTutorialOverlay(root, machine, { firstCab: els.cabs[0] });

  let lastHud = null;
  let lastResult = null;
  let bestRank = 1;
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
    setBest(bestRank);
    if (lastResult) screens.renderResult(lastResult);
    if (lastHud) hud.setHud(lastHud);
    overlay.render();
  }

  function setBest(best) {
    bestRank = Math.max(1, Math.floor(best ?? 1));
    screens.setBest(bestRank);
  }

  function setResult(data) {
    lastResult = data || {};
    screens.renderResult(lastResult);
  }

  function setHud(h) {
    lastHud = h || {};
    hud.setHud(lastHud);
  }

  function hideAllOverlays() {
    for (const key of ['title', 'pause', 'result', 'gameover', 'grandprix', 'settings']) {
      els[key].classList.add('hidden');
    }
  }

  function show(screen, data) {
    if (screen === 'result' && data) setResult(data);
    const isTitle = screen === 'title';
    const isHall = screen === 'hall';
    const isPlaying = screen === 'playing';
    const isPaused = screen === 'paused';
    const isResult = screen === 'result';
    const isGameover = screen === 'gameover';
    const isGrandprix = screen === 'grandprix';
    const isSettings = screen === 'settings';

    hideAllOverlays();
    els.title.classList.toggle('hidden', !isTitle);
    els.pause.classList.toggle('hidden', !isPaused);
    els.result.classList.toggle('hidden', !isResult);
    els.gameover.classList.toggle('hidden', !isGameover);
    els.grandprix.classList.toggle('hidden', !isGrandprix);
    els.settings.classList.toggle('hidden', !isSettings);
    els.hall.classList.toggle('hidden', !isHall);

    const showHud = isHall || isPlaying;
    if (showHud) hud.show();
    else hud.hide();

    if (isHall) {
      // 首次进入大厅自动弹引导
      if (!machine.done && !machine.active) machine.begin();
    }

    if (machine.active) overlay.show();
    else overlay.hide();

    if (isTitle || isSettings) applyLang();
  }

  function finishTutorial(result) {
    overlay.hide();
    if (tutorialDoneCb) { try { tutorialDoneCb(result); } catch { /* noop */ } }
  }
  machine.onDone = finishTutorial;

  function onTutorial(cb) { tutorialDoneCb = cb || null; }

  for (const sel of els.langSelects) {
    if (!sel) continue;
    sel.addEventListener('change', (e) => { if (i18n.setLang(e.target.value)) applyLang(); });
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
  els.btnContinue.addEventListener('click', () => (hooks.onContinue || noop)());
  els.btnPity.addEventListener('click', () => (hooks.onPity || noop)());
  els.btnOverBack.addEventListener('click', () => (hooks.onRestart || noop)());
  els.btnGrandBack.addEventListener('click', () => (hooks.onRestart || noop)());
  els.cabs.forEach((cab, i) => cab.addEventListener('click', () => (hooks.onPick || noop)(i)));

  applyLang();

  return {
    show, setHud, onTutorial, applyLang, setBest, setResult, els,
    tutorial: {
      machine, overlay,
      get active() { return machine.active; },
      get step() { return machine.step; },
      get steps() { return TUT_STEP_IDS; },
      get current() { return machine.currentId; },
      begin: () => machine.begin(),
      replay,
      skip: () => machine.skip(),
      onGameEvent: (ev) => { const s = machine.onGameEvent(ev); overlay.render(); return s; },
      tick: () => machine.tick(),
      state: () => machine.snapshot(),
    },
    get lang() { return i18n.lang; },
    get dir() { return i18n.dir; },
  };
}

export default createUI;
