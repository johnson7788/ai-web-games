// src/ui/index.js — createUI 装配：标题 / HUD / 目标横幅 / 暂停 / 过关结算 / 通关 / 设置 / 首次引导。
// 契约：createUI(root, hooks) → { show(screen, data), setHud(hud), applyLang(), els, tutorial }。
// 所有可见文案走 data-i18n / t()；事件回调由 main 通过 hooks 注册。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';
import Sdk from '../core/sdk.js';
import { TutorialMachine, createTutorialOverlay, TUTORIAL_KEY, TUT_STEP_IDS } from './tutorial.js';

const FONT = "'PingFang SC', 'Hiragino Sans', 'Segoe UI', 'Microsoft YaHei', 'Courier New', monospace";

function el(tag, className, html) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (html != null) n.innerHTML = html;
  return n;
}

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

function fmtTime(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function starText(n) {
  return '★★★'.slice(0, Math.max(0, n)) + '☆☆☆'.slice(0, Math.max(0, 3 - n));
}

const LANG_SELECT_HTML = '<select class="lang-select" aria-label=""></select>';

export function createUI(root, hooks = {}) {
  // ---- 标题屏 ----
  const title = getOrCreate(root, 'screen-title', 'screen');
  title.innerHTML =
    '<div class="title-inner">' +
      '<div class="title-logo" data-i18n="title.logo"></div>' +
      '<div class="title-tagline" data-i18n="title.tagline"></div>' +
      '<div class="title-best" id="title-best"></div>' +
      '<div class="title-cleared" id="title-cleared"></div>' +
      '<div class="title-kisses" id="title-kisses"></div>' +
      '<div class="title-actions">' +
        '<button id="btn-start" class="btn btn-primary" type="button" data-i18n="btn.start"></button>' +
        '<button id="btn-how" class="btn btn-ghost" type="button" data-tutorial-replay data-i18n="btn.how"></button>' +
        '<button id="btn-settings" class="btn btn-ghost" type="button" data-i18n="btn.settings"></button>' +
      '</div>' +
    '</div>' +
    LANG_SELECT_HTML;

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
    LANG_SELECT_HTML;

  // ---- 过关结算卡 ----
  const result = getOrCreate(root, 'screen-result', 'screen hidden');
  result.innerHTML =
    '<div class="result-inner">' +
      '<div class="result-title" data-i18n="result.title"></div>' +
      '<div class="result-stars" id="res-stars"></div>' +
      '<div class="result-badge hidden" id="result-new-record" data-i18n="result.newRecord"></div>' +
      '<ul class="result-rows">' +
        '<li><span data-i18n="result.time"></span><b id="res-time">0:00</b></li>' +
        '<li><span data-i18n="result.kisses"></span><b id="res-kisses">+3</b></li>' +
      '</ul>' +
      '<div class="roast-box"><div class="roast-label" data-i18n="result.roastLabel"></div><div class="roast-text" id="res-roast"></div></div>' +
      '<div class="result-actions">' +
        '<button id="btn-next" class="btn btn-primary" type="button" data-i18n="btn.next"></button>' +
        '<button id="btn-retry" class="btn btn-ghost" type="button" data-i18n="btn.retry"></button>' +
        '<button id="btn-share" class="btn btn-ghost" type="button" data-i18n="btn.share"></button>' +
      '</div>' +
      '<div class="result-hint" data-i18n="result.hint"></div>' +
    '</div>';

  // ---- 通关 ----
  const complete = getOrCreate(root, 'screen-complete', 'screen hidden');
  complete.innerHTML =
    '<div class="complete-inner">' +
      '<div class="complete-title" data-i18n="complete.title"></div>' +
      '<div class="complete-sub" data-i18n="complete.sub"></div>' +
      '<div class="complete-time" id="complete-time"></div>' +
      '<div class="complete-actions">' +
        '<button id="btn-again" class="btn btn-primary" type="button" data-i18n="btn.restart"></button>' +
        '<button id="btn-share-complete" class="btn btn-ghost" type="button" data-i18n="btn.share"></button>' +
      '</div>' +
      '<div class="complete-hint" data-i18n="complete.hint"></div>' +
    '</div>';

  // ---- 设置 ----
  const settings = getOrCreate(root, 'screen-settings', 'screen hidden');
  settings.innerHTML =
    '<div class="settings-inner">' +
      '<h2 class="settings-title" data-i18n="set.title"></h2>' +
      '<label class="settings-row"><span data-i18n="set.language"></span>' + LANG_SELECT_HTML + '</label>' +
      '<button id="btn-settings-back" class="btn btn-ghost" type="button" data-i18n="set.back"></button>' +
    '</div>';

  // ---- HUD（顶部不透明条）----
  const hud = getOrCreate(root, 'hud', 'hud hidden');
  hud.setAttribute('aria-hidden', 'true');
  hud.innerHTML =
    '<div class="hud-left">' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.level"></span><b id="hud-level">1</b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.chapter"></span><b id="hud-chapter">—</b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.kisses"></span><b id="hud-kisses">0</b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.streak"></span><b id="hud-streak">0</b></div>' +
    '</div>' +
    '<div class="hud-right">' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.stars"></span><b id="hud-stars">★★★</b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.time"></span><b id="hud-time">0:00</b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.mistakes"></span><b id="hud-mistakes">0</b></div>' +
      '<button id="btn-hint" class="btn btn-ghost btn-sm" type="button" data-i18n="btn.hint"></button>' +
      '<button id="btn-help" class="btn btn-ghost btn-sm hidden" type="button" data-i18n="btn.help"></button>' +
    '</div>';

  // ---- 目标横幅（不透明，避免遮挡交互物）----
  const goal = getOrCreate(root, 'goal', 'goal hidden');
  goal.setAttribute('aria-hidden', 'true');
  goal.innerHTML =
    '<span class="goal-label" data-i18n="hud.goal"></span>' +
    '<span class="goal-text" id="goal-text"></span>';

  // ---- 首次引导 ----
  const machine = new TutorialMachine({
    save: (k, v) => Sdk.save(k, v),
    load: (k, d) => Sdk.load(k, d),
    key: TUTORIAL_KEY,
  });
  const overlay = createTutorialOverlay(root, machine);

  const els = {
    title, pause, result, complete, settings, hud, goal,
    langSelects: [
      title.querySelector('.lang-select'),
      pause.querySelector('.lang-select'),
      settings.querySelector('.lang-select'),
    ],
    btnStart: title.querySelector('#btn-start'),
    btnHow: title.querySelector('#btn-how'),
    btnSettings: title.querySelector('#btn-settings'),
    btnResume: pause.querySelector('#btn-resume'),
    btnRestart: pause.querySelector('#btn-restart'),
    btnHowPause: pause.querySelector('#btn-how-pause'),
    btnNext: result.querySelector('#btn-next'),
    btnRetry: result.querySelector('#btn-retry'),
    btnShare: result.querySelector('#btn-share'),
    btnAgain: complete.querySelector('#btn-again'),
    btnShareComplete: complete.querySelector('#btn-share-complete'),
    btnSettingsBack: settings.querySelector('#btn-settings-back'),
    btnHint: hud.querySelector('#btn-hint'),
    btnHelp: hud.querySelector('#btn-help'),
    titleBest: title.querySelector('#title-best'),
    titleCleared: title.querySelector('#title-cleared'),
    titleKisses: title.querySelector('#title-kisses'),
    resStars: result.querySelector('#res-stars'),
    resTime: result.querySelector('#res-time'),
    resKisses: result.querySelector('#res-kisses'),
    resRoast: result.querySelector('#res-roast'),
    newRecordBadge: result.querySelector('#result-new-record'),
    completeTime: complete.querySelector('#complete-time'),
    hudLevel: hud.querySelector('#hud-level'),
    hudChapter: hud.querySelector('#hud-chapter'),
    hudKisses: hud.querySelector('#hud-kisses'),
    hudStreak: hud.querySelector('#hud-streak'),
    hudStars: hud.querySelector('#hud-stars'),
    hudTime: hud.querySelector('#hud-time'),
    hudMistakes: hud.querySelector('#hud-mistakes'),
    goalText: goal.querySelector('#goal-text'),
  };

  let lastHud = null;
  let lastResult = null;
  let bestMs = 0;
  let cleared = 0;
  let totalKisses = 0;
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
    renderTitleMeta();
    if (lastResult) renderResult(lastResult);
    if (lastHud) setHud(lastHud);
    overlay.render();
  }

  function setBest(ms) {
    bestMs = Math.max(0, Number(ms) || 0);
    renderTitleMeta();
  }

  function setCleared(n) {
    cleared = Math.max(0, Math.floor(n) || 0);
    renderTitleMeta();
  }

  function setTotalKisses(n) {
    totalKisses = Math.max(0, Math.floor(n) || 0);
    renderTitleMeta();
  }

  function renderTitleMeta() {
    els.titleBest.textContent = bestMs > 0 ? t('title.best', { time: fmtTime(bestMs) }) : '';
    els.titleCleared.textContent = cleared > 0 ? t('title.cleared', { n: cleared, total: 24 }) : '';
    els.titleKisses.textContent = totalKisses > 0 ? t('title.kisses', { n: totalKisses }) : '';
  }

  function setHud(h) {
    lastHud = h || {};
    h = lastHud;
    els.hudLevel.textContent = String(h.levelNumber ?? 1);
    els.hudChapter.textContent = t('chapter.' + (h.chapter || 1));
    els.hudStars.textContent = starText(h.totalStars || 0);
    els.hudTime.textContent = fmtTime(h.elapsedMs || 0);
    els.hudMistakes.textContent = String(h.failCount || 0);
    els.hudKisses.textContent = String(h.kisses ?? 0);
    els.hudStreak.textContent = String(h.streak ?? 0);
    els.goalText.textContent = (h.goal && (h.goal[i18n.lang] || h.goal.en)) || '';
    els.btnHelp.classList.toggle('hidden', !h.helpUnlocked);
  }

  function renderResult(data) {
    data = data || {};
    els.resStars.textContent = starText(data.stars || 0);
    els.resTime.textContent = fmtTime(data.elapsedMs || 0);
    els.resKisses.textContent = (data.kisses != null && data.kisses > 0) ? `+${data.kisses}` : '—';
    els.resRoast.textContent = (data.roast && (data.roast[i18n.lang] || data.roast.en)) || '';
    els.newRecordBadge.classList.toggle('hidden', !data.newRecord);
    if (data.lastLevel) {
      els.btnNext.textContent = t('btn.restart');
    } else {
      els.btnNext.textContent = t('btn.next');
    }
  }

  function setResult(data) {
    lastResult = data || {};
    renderResult(lastResult);
  }

  function show(screen, data) {
    if (screen === 'solved' && data) setResult(data);
    const isTitle = screen === 'title';
    const isPlaying = screen === 'playing';
    const isPaused = screen === 'paused';
    const isSolved = screen === 'solved';
    const isComplete = screen === 'complete';
    const isSettings = screen === 'settings';

    els.title.classList.toggle('hidden', !isTitle);
    els.pause.classList.toggle('hidden', !isPaused);
    els.result.classList.toggle('hidden', !isSolved);
    els.complete.classList.toggle('hidden', !isComplete);
    els.settings.classList.toggle('hidden', !isSettings);

    els.hud.classList.toggle('hidden', !(isPlaying || isSolved || isComplete));
    els.goal.classList.toggle('hidden', !(isPlaying));

    if (isPlaying) {
      if (!machine.done && !machine.active) machine.begin();
      if (machine.active) overlay.show();
    } else {
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

  function onTutorial(cb) { tutorialDoneCb = cb || null; }

  for (const sel of els.langSelects) {
    if (!sel) continue;
    sel.addEventListener('change', (e) => {
      if (i18n.setLang(e.target.value)) applyLang();
    });
  }

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
  els.btnAgain.addEventListener('click', () => (hooks.onRestart || noop)());
  els.btnShareComplete.addEventListener('click', () => (hooks.onShare || noop)());
  els.btnSettings.addEventListener('click', () => show('settings'));
  els.btnSettingsBack.addEventListener('click', () => show('title'));
  els.btnHint.addEventListener('click', () => (hooks.onHint || noop)());
  els.btnHelp.addEventListener('click', () => (hooks.onHelp || noop)());

  applyLang();

  return {
    show,
    setHud,
    setBest,
    setCleared,
    setTotalKisses,
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
      onGameEvent: (ev) => {
        const s = machine.onGameEvent(ev);
        overlay.render();
        return s;
      },
      tick: () => machine.tick(),
      state: () => machine.snapshot(),
    },
    get lang() { return i18n.lang; },
    get dir() { return i18n.dir; },
  };
}

export default createUI;
