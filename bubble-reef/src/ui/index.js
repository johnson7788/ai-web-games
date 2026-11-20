// src/ui/index.js — createUI 装配：标题 / HUD / 暂停 / 结算 / 关卡横幅 / 首次引导 / i18n。
// 契约：createUI(root, hooks) → { show(screen, data), setHud(hud), setBest(score), applyLang(), tutorial, els }
import { i18n, t, syncDocumentLang } from '../core/i18n.js';
import Sdk from '../core/sdk.js';
import { TutorialMachine, createTutorialOverlay, TUTORIAL_KEY, TUT_STEP_IDS } from './tutorial.js';

function getOrCreate(root, id, className) {
  let n = root.querySelector('#' + id);
  if (!n) {
    n = document.createElement('div');
    n.id = id;
    root.appendChild(n);
  }
  n.className = className;
  return n;
}

function el(tag, className, html) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (html != null) n.innerHTML = html;
  return n;
}

export function createUI(root, hooks = {}) {
  // ---- 标题屏 ----
  const title = getOrCreate(root, 'screen-title', 'screen');
  title.innerHTML =
    '<div class="title-inner">' +
      '<div class="title-logo" data-i18n="title.logo"></div>' +
      '<div class="title-tagline" data-i18n="title.tagline"></div>' +
      '<div class="title-best" id="title-best"></div>' +
      '<div class="title-actions">' +
        '<button id="btn-start" class="btn btn-primary" type="button" data-i18n="btn.start"></button>' +
        '<button id="btn-how" class="btn btn-ghost" type="button" data-tutorial-replay data-i18n="btn.how"></button>' +
        '<button id="btn-settings" class="btn btn-ghost" type="button" data-i18n="btn.settings"></button>' +
      '</div>' +
    '</div>' +
    '<select id="lang-select" class="lang-select" aria-label=""></select>';

  // ---- 暂停屏 ----
  const pause = getOrCreate(root, 'screen-pause', 'screen hidden');
  pause.innerHTML =
    '<div class="pause-inner">' +
      '<h2 class="pause-title" data-i18n="pause.title"></h2>' +
      '<div class="pause-hint" data-i18n="pause.hint"></div>' +
      '<div class="pause-actions">' +
        '<button id="btn-resume" class="btn btn-primary" type="button" data-i18n="btn.resume"></button>' +
        '<button id="btn-restart" class="btn btn-ghost" type="button" data-i18n="btn.restart"></button>' +
        '<button id="btn-how-pause" class="btn btn-ghost" type="button" data-tutorial-replay data-i18n="btn.how"></button>' +
      '</div>' +
    '</div>' +
    '<select id="lang-select-pause" class="lang-select" aria-label=""></select>';

  // ---- 结算卡 ----
  const result = getOrCreate(root, 'screen-result', 'screen hidden');
  result.innerHTML =
    '<div class="result-inner">' +
      '<div class="result-title" id="result-title"></div>' +
      '<div class="result-badge hidden" id="result-new-record" data-i18n="result.newRecord"></div>' +
      '<ul class="result-rows">' +
        '<li><span data-i18n="result.score"></span><b id="res-score">0</b></li>' +
        '<li><span data-i18n="result.level"></span><b id="res-level">1</b></li>' +
        '<li><span data-i18n="result.best"></span><b id="res-best">0</b></li>' +
      '</ul>' +
      '<div class="result-actions">' +
        '<button id="btn-again" class="btn btn-primary" type="button" data-i18n="btn.restart"></button>' +
        '<button id="btn-share" class="btn btn-ghost" type="button" data-i18n="btn.share"></button>' +
      '</div>' +
      '<div class="result-hint" data-i18n="result.hint"></div>' +
    '</div>';

  // ---- 设置 ----
  const settings = getOrCreate(root, 'screen-settings', 'screen hidden');
  settings.innerHTML =
    '<div class="settings-inner">' +
      '<h2 class="settings-title" data-i18n="set.title"></h2>' +
      '<label class="settings-row"><span data-i18n="set.language"></span>' +
        '<select id="lang-select-settings" class="lang-select" aria-label=""></select>' +
      '</label>' +
      '<button id="btn-mute" class="btn btn-ghost" type="button"></button>' +
      '<button id="btn-settings-back" class="btn btn-ghost" type="button" data-i18n="set.back"></button>' +
    '</div>';

  // ---- HUD ----
  const hud = getOrCreate(root, 'hud', 'hud hidden');
  hud.innerHTML =
    '<div class="hud-top">' +
      '<div class="hud-stat"><span data-i18n="hud.score"></span><b id="hud-score">0</b></div>' +
      '<div class="hud-stat hud-center"><span data-i18n="hud.level"></span><b id="hud-level">1</b></div>' +
      '<div class="hud-stat hud-right"><span data-i18n="hud.combo"></span><b id="hud-combo">0</b></div>' +
    '</div>' +
    '<div class="clearance-track"><div class="clearance-label"><span data-i18n="hud.clearance"></span><b id="hud-clearance-text">0%</b></div><i class="clearance-fill" id="hud-clearance-fill"></i></div>' +
    '<button id="btn-wildcard" class="hud-btn wildcard-btn hidden" type="button"><span class="wildcard-dot"></span><span data-i18n="hud.wildcard"></span></button>' +
    '<button id="btn-preview" class="hud-btn preview-btn" type="button" aria-label=""></button>';

  // ---- 关卡横幅 ----
  const banner = getOrCreate(root, 'level-banner', 'level-banner hidden');
  banner.innerHTML =
    '<div class="banner-title" id="banner-title"></div>' +
    '<div class="banner-sub" id="banner-sub"></div>';

  const els = {
    title, pause, result, settings, hud, banner,
    langSelects: [
      title.querySelector('#lang-select'),
      pause.querySelector('#lang-select-pause'),
      settings.querySelector('#lang-select-settings'),
    ],
    btnStart: title.querySelector('#btn-start'),
    btnHow: title.querySelector('#btn-how'),
    btnSettings: title.querySelector('#btn-settings'),
    btnResume: pause.querySelector('#btn-resume'),
    btnRestart: pause.querySelector('#btn-restart'),
    btnHowPause: pause.querySelector('#btn-how-pause'),
    btnAgain: result.querySelector('#btn-again'),
    btnShare: result.querySelector('#btn-share'),
    btnSettingsBack: settings.querySelector('#btn-settings-back'),
    btnMute: settings.querySelector('#btn-mute'),
    titleBest: title.querySelector('#title-best'),
    newRecordBadge: result.querySelector('#result-new-record'),
    resScore: result.querySelector('#res-score'),
    resLevel: result.querySelector('#res-level'),
    resBest: result.querySelector('#res-best'),
    resultTitle: result.querySelector('#result-title'),
    hudScore: hud.querySelector('#hud-score'),
    hudLevel: hud.querySelector('#hud-level'),
    hudCombo: hud.querySelector('#hud-combo'),
    hudClearanceText: hud.querySelector('#hud-clearance-text'),
    hudClearanceFill: hud.querySelector('#hud-clearance-fill'),
    btnWildcard: hud.querySelector('#btn-wildcard'),
    btnPreview: hud.querySelector('#btn-preview'),
    bannerTitle: banner.querySelector('#banner-title'),
    bannerSub: banner.querySelector('#banner-sub'),
  };

  // 教程状态机（存档走 Sdk.save/load）
  const machine = new TutorialMachine({
    save: (k, v) => Sdk.save(k, v),
    load: (k, d) => Sdk.load(k, d),
    key: TUTORIAL_KEY,
  });
  const overlay = createTutorialOverlay(root, machine);

  let lastHud = null;
  let lastResult = null;
  let bestScore = 0;
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
    setBest(bestScore);
    renderMute();
    if (lastResult) renderResult(lastResult);
    if (lastHud) setHud(lastHud);
    overlay.render();
  }

  function setBest(best) {
    bestScore = Math.max(0, Math.floor(best ?? 0));
    els.titleBest.textContent = t('title.best', { score: bestScore });
  }

  function renderResult(data) {
    data = data || {};
    const won = !!data.won;
    els.resultTitle.textContent = t(won ? 'result.win' : 'result.lose');
    els.resScore.textContent = String(Math.floor(data.score ?? 0));
    els.resLevel.textContent = String(Math.floor(data.level ?? 1));
    els.resBest.textContent = String(Math.floor(data.best ?? 0));
    els.newRecordBadge.classList.toggle('hidden', !data.newRecord);
  }

  function setResult(data) {
    lastResult = data || {};
    renderResult(lastResult);
  }

  function setHud(h) {
    lastHud = h || {};
    els.hudScore.textContent = String(Math.floor(lastHud.score ?? 0));
    els.hudLevel.textContent = String(lastHud.level ?? 1);
    els.hudCombo.textContent = String(lastHud.combo ?? 0);
    const pct = Math.min(1, Math.max(0, lastHud.clearance ?? 0));
    els.hudClearanceText.textContent = Math.round(pct * 100) + '%';
    els.hudClearanceFill.style.width = (pct * 100).toFixed(1) + '%';
    const wildcardShown = lastHud.wildcardAvailable || lastHud.wildcardLoaded;
    els.btnWildcard.classList.toggle('hidden', !wildcardShown);
    els.btnWildcard.classList.toggle('armed', !!lastHud.wildcardLoaded);
    els.btnPreview.setAttribute('aria-label', t('hud.preview', { n: lastHud.previewsLeft ?? 0 }));
    els.btnPreview.textContent = t('hud.previewKey') + ' · ' + (lastHud.previewsLeft ?? 0);
  }

  function renderMute() {
    els.btnMute.textContent = t('set.mute');
  }

  function hideAll() {
    for (const key of ['title', 'pause', 'result', 'settings']) {
      els[key].classList.add('hidden');
    }
    els.hud.classList.add('hidden');
    overlay.hide();
    els.banner.classList.add('hidden');
  }

  function show(screen, data) {
    if (screen === 'result' && data) setResult(data);
    const isTitle = screen === 'title';
    const isPlaying = screen === 'playing';
    const isPaused = screen === 'paused';
    const isResult = screen === 'result';
    const isSettings = screen === 'settings';

    els.title.classList.toggle('hidden', !isTitle);
    els.pause.classList.toggle('hidden', !isPaused);
    els.result.classList.toggle('hidden', !isResult);
    els.settings.classList.toggle('hidden', !isSettings);

    if (isPlaying) {
      els.hud.classList.remove('hidden');
      if (!machine.done && !machine.active) machine.begin();
      if (machine.active) overlay.show();
    } else {
      els.hud.classList.add('hidden');
      overlay.hide();
    }

    if (isTitle) applyLang();
    if (isSettings) applyLang();
  }

  function showBanner(titleText, subText) {
    els.bannerTitle.textContent = titleText;
    els.bannerSub.textContent = subText;
    els.banner.classList.remove('hidden');
    clearTimeout(showBanner._t);
    showBanner._t = setTimeout(() => els.banner.classList.add('hidden'), 1800);
  }
  showBanner._t = 0;

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
  els.btnMute.addEventListener('click', () => (hooks.onToggleMute || noop)());
  els.btnWildcard.addEventListener('click', () => (hooks.onWildcard || noop)());
  els.btnPreview.addEventListener('click', () => (hooks.onPreview || noop)());

  applyLang();

  return {
    show,
    setHud,
    setBest,
    setResult,
    showBanner,
    applyLang,
    hideAll,
    onTutorial,
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
