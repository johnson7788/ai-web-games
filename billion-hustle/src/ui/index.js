// src/ui/index.js — createUI 装配：标题 / HUD / 成长条 / 风口面板 / 结算 / 融资翻牌 / 首次引导 / i18n。
// 契约：createUI(root, hooks) → { show, setHud, onTutorial, hideAll, setBest, showFunding, hideFunding, applyLang, els, tutorial }。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';
import Sdk from '../core/sdk.js';
import { LAYOUT } from '../render/index.js';
import { createScreens } from './screens.js';
import { createHud } from './hud.js';
import { createShop } from './shop.js';
import { TutorialMachine, createTutorialOverlay, TUTORIAL_KEY, TUT_STEP_IDS } from './tutorial.js';
import { UPGRADES, PARTNERS, SECTORS } from '../../config/gameplay.js';

export function createUI(root, hooks = {}) {
  const screens = createScreens(root);
  const hud = createHud(root);
  const shop = createShop(root);

  // 核心点击按钮（DOM，与 render 的 LAYOUT 百分比对齐）
  const tapBtn = document.createElement('button');
  tapBtn.id = 'btn-tap';
  tapBtn.className = 'tap-btn';
  tapBtn.type = 'button';
  tapBtn.setAttribute('data-i18n', 'btn.tap');
  const tapSize = LAYOUT.tapR * 2;
  tapBtn.style.left = ((LAYOUT.tapX - LAYOUT.tapR) / 1280 * 100).toFixed(3) + '%';
  tapBtn.style.top = ((LAYOUT.tapY - LAYOUT.tapR) / 720 * 100).toFixed(3) + '%';
  tapBtn.style.width = (tapSize / 1280 * 100).toFixed(3) + '%';
  tapBtn.style.height = (tapSize / 720 * 100).toFixed(3) + '%';
  root.appendChild(tapBtn);

  // 教程标志走 Sdk.save/load（存档唯一出口）
  const machine = new TutorialMachine({
    save: (k, v) => Sdk.save(k, v),
    load: (k, d) => Sdk.load(k, d),
    key: TUTORIAL_KEY,
  });
  const overlay = createTutorialOverlay(root, machine);
  const els = screens.els;

  let lastHud = null;
  let bestValuation = 0;
  let tutorialDoneCb = null;
  let muted = typeof hooks.getMuted === 'function' ? !!hooks.getMuted() : false;

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
    setBest(bestValuation);
    updateMuteLabel();
    if (lastHud) setHud(lastHud);
    overlay.render();
  }

  function setBest(best) {
    bestValuation = Math.max(0, Math.floor(best ?? 0));
    screens.setBest(bestValuation);
  }

  function setHud(h) {
    lastHud = h || {};
    hud.setHud(lastHud);
    shop.setHud(lastHud);
  }

  function updateMuteLabel() {
    els.btnMute.textContent = muted ? t('set.unmute') : t('set.mute');
  }

  function hideAll() {
    for (const key of ['title', 'pause', 'result', 'settings']) {
      els[key].classList.add('hidden');
    }
    hud.hide();
    shop.hide();
    overlay.hide();
    tapBtn.classList.add('hidden');
    screens.hideFunding();
  }

  function show(screen, data) {
    const isTitle = screen === 'title';
    const isPlaying = screen === 'playing';
    const isPaused = screen === 'paused';
    const isWon = screen === 'won';
    const isSettings = screen === 'settings';

    els.title.classList.toggle('hidden', !isTitle);
    els.pause.classList.toggle('hidden', !isPaused);
    els.result.classList.toggle('hidden', !isWon);
    els.settings.classList.toggle('hidden', !isSettings);

    if (isWon && data) screens.renderResult(data);

    if (isPlaying) {
      hud.show();
      shop.show();
      tapBtn.classList.remove('hidden');
      if (!machine.done && !machine.active) machine.begin();
      if (machine.active) overlay.show();
      screens.hideFunding();
    } else {
      hud.hide();
      shop.hide();
      tapBtn.classList.add('hidden');
      overlay.hide();
    }

    if (isTitle) applyLang();
    if (isSettings) applyLang();
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

  // ---- 语言切换 ----
  for (const sel of els.langSelects) {
    if (!sel) continue;
    sel.addEventListener('change', (e) => {
      if (i18n.setLang(e.target.value)) applyLang();
    });
  }

  // ---- 设置 ----
  els.btnSettings.addEventListener('click', () => show('settings'));
  els.btnSettingsBack.addEventListener('click', () => show('title'));
  els.btnMute.addEventListener('click', () => {
    muted = !muted;
    if (typeof hooks.onMute === 'function') muted = !!hooks.onMute(muted);
    updateMuteLabel();
  });

  // ---- 重看引导 ----
  const replay = () => {
    machine.replay();
    overlay.show();
    if (typeof hooks.onHow === 'function') hooks.onHow();
  };
  els.btnHow.addEventListener('click', replay);
  els.btnHowPause.addEventListener('click', replay);

  // ---- 游戏流转 ----
  const noop = () => {};
  els.btnStart.addEventListener('click', () => (hooks.onStart || noop)());
  els.btnResume.addEventListener('click', () => (hooks.onResume || noop)());
  els.btnRestart.addEventListener('click', () => (hooks.onRestart || noop)());
  els.btnAgain.addEventListener('click', () => (hooks.onRestart || noop)());
  els.btnShare.addEventListener('click', () => (hooks.onShare || noop)());

  // ---- 核心交互 ----
  tapBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (typeof hooks.onTap === 'function') hooks.onTap(e);
  });
  hud.btnBurn.addEventListener('click', () => (hooks.onBurn || noop)());

  for (const u of UPGRADES) {
    const btn = shop.els.upBtns[UPGRADES.indexOf(u)];
    if (btn) btn.addEventListener('click', () => (hooks.onUpgrade || noop)(u.id));
  }
  for (const p of PARTNERS) {
    const btn = shop.els.partnerBtns[PARTNERS.indexOf(p)];
    if (btn) btn.addEventListener('click', () => (hooks.onPartner || noop)(p.id));
  }
  for (let i = 0; i < SECTORS.length; i += 1) {
    const btn = shop.els.sectorBtns[i];
    if (btn) btn.addEventListener('click', () => (hooks.onBet || noop)(i));
  }

  applyLang();

  return {
    show,
    setHud,
    onTutorial,
    hideAll,
    setBest,
    showFunding: screens.showFunding,
    hideFunding: screens.hideFunding,
    flashValuation: hud.flashValuation,
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
