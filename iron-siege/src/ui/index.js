// src/ui/index.js — createUI 装配：标题 / HUD / 暂停 / 结算 / 波间强化 / 首次引导 / i18n。
// 契约：createUI(root, hooks) → { show(screen,data), setHud(hud), onTutorial(cb), hideAll(), showUpgrade(opts), applyLang() }。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';
import Sdk from '../core/sdk.js';
import { createScreens } from './screens.js';
import { createHud } from './hud.js';
import { TutorialMachine, createTutorialOverlay, TUTORIAL_KEY, TUT_STEP_IDS } from './tutorial.js';

export function createUI(root, hooks = {}) {
  const screens = createScreens(root);
  const hud = createHud(root);

  // 教程标志走 Sdk.save/load（存档唯一出口），刷新/新会话不重复弹。
  const machine = new TutorialMachine({
    save: (k, v) => Sdk.save(k, v),
    load: (k, d) => Sdk.load(k, d),
    key: TUTORIAL_KEY,
  });
  const overlay = createTutorialOverlay(root, machine, { canvas: root.querySelector('canvas') });
  const els = screens.els;

  let lastHud = null;
  let lastResult = null;
  let bestWave = 1;
  let tutorialDoneCb = null;
  let muted = !!Sdk.load('audioMuted', false);

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
    setBest(bestWave);
    if (lastResult) screens.renderResult(lastResult);
    if (lastHud) hud.setHud(lastHud);
    screens.setMuted(muted);
    overlay.render();
  }

  function setBest(best) {
    bestWave = Math.max(1, Math.floor(best ?? 1));
    screens.setBest(bestWave);
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
    for (const key of ['title', 'pause', 'result', 'settings', 'upgrade']) {
      els[key].classList.add('hidden');
    }
    hud.hide();
    overlay.hide();
  }

  function show(screen, data) {
    if (screen === 'dead' || screen === 'win') {
      setResult(data);
      screen = 'result';
    }
    const isTitle = screen === 'title';
    const isPlaying = screen === 'playing';
    const isPaused = screen === 'paused';
    const isSettings = screen === 'settings';
    const isUpgrade = screen === 'upgrade';

    els.title.classList.toggle('hidden', !isTitle);
    els.pause.classList.toggle('hidden', !isPaused);
    els.result.classList.toggle('hidden', screen !== 'result');
    els.settings.classList.toggle('hidden', !isSettings);
    els.upgrade.classList.toggle('hidden', !isUpgrade);

    if (isPlaying) {
      // 教程进行中隐藏右侧控制台（引导聚焦战场动作，避免面板与战场视觉冲突）
      if (machine.active) {
        hud.hide();
      } else {
        hud.show();
        if (!machine.done && !machine.active) machine.begin();
      }
      if (machine.active) overlay.show();
    } else {
      hud.hide();
      overlay.hide();
    }

    if (isTitle || isSettings) applyLang();
  }

  function showUpgrade(options) {
    screens.renderUpgrade(options);
    els.upgrade.classList.remove('hidden');
  }

  function finishTutorial(result) {
    overlay.hide();
    hud.show(); // 教程结束恢复控制台
    if (tutorialDoneCb) {
      try { tutorialDoneCb(result); } catch { /* 回调异常不影响游戏 */ }
    }
  }
  machine.onDone = finishTutorial;

  function onTutorial(cb) {
    tutorialDoneCb = cb || null;
  }

  // 语言切换（UI 自包含）
  for (const sel of els.langSelects) {
    if (!sel) continue;
    sel.addEventListener('change', (e) => {
      if (i18n.setLang(e.target.value)) applyLang();
    });
  }

  // 设置
  els.btnSettings.addEventListener('click', () => show('settings'));
  els.btnSettingsBack.addEventListener('click', () => show('title'));
  els.btnMute.addEventListener('click', () => {
    muted = !muted;
    Sdk.save('audioMuted', muted);
    screens.setMuted(muted);
    if (typeof hooks.onMute === 'function') hooks.onMute(muted);
  });

  // 重看引导
  const replay = () => {
    machine.replay();
    overlay.show();
    if (typeof hooks.onHow === 'function') hooks.onHow();
  };
  els.btnHow.addEventListener('click', replay);
  els.btnHowPause.addEventListener('click', replay);

  // 流转按钮
  const noop = () => {};
  els.btnStart.addEventListener('click', () => (hooks.onStart || noop)());
  els.btnResume.addEventListener('click', () => (hooks.onResume || noop)());
  els.btnRestart.addEventListener('click', () => (hooks.onRestart || noop)());
  els.btnAgain.addEventListener('click', () => (hooks.onRestart || noop)());
  els.btnShare.addEventListener('click', () => (hooks.onShare || noop)());
  els.btnUpgrade0.addEventListener('click', () => (hooks.onUpgrade || noop)(0));
  els.btnUpgrade1.addEventListener('click', () => (hooks.onUpgrade || noop)(1));

  applyLang();

  return {
    show,
    setHud,
    onTutorial,
    hideAll,
    setBest,
    setResult,
    showUpgrade,
    applyLang,
    els,
    hud,
    setMuted: (m) => { muted = !!m; screens.setMuted(muted); },
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
      tick: (now) => machine.tick(now),
      state: () => machine.snapshot(),
    },
    get lang() { return i18n.lang; },
    get dir() { return i18n.dir; },
  };
}

export default createUI;
