// src/ui/screens.js — 标题 / 暂停 / 过关 / 失败 / 通关 / 设置。
// 只负责搭 DOM 与填数；所有可见文案走 data-i18n，由 index.js 统一 applyLang。
import { t } from '../core/i18n.js';

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

const LANG_SELECT_HTML = '<select class="lang-select" aria-label=""></select>';

export function createScreens(root) {
  // ---- 标题屏 ----
  const title = getOrCreate(root, 'screen-title', 'screen');
  title.innerHTML =
    '<div class="title-inner">' +
      '<div class="title-logo" data-i18n="title.logo"></div>' +
      '<div class="title-tagline" data-i18n="title.tagline"></div>' +
      '<div class="title-best" id="title-best"></div>' +
      '<div class="title-actions">' +
        '<button id="btn-start" class="btn btn-primary" type="button" data-i18n="title.start" data-i18n-aria="title.start"></button>' +
        '<button id="btn-how" class="btn btn-ghost" type="button" data-tutorial-replay data-i18n="btn.how"></button>' +
        '<button id="btn-settings" class="btn btn-ghost" type="button" data-i18n="btn.settings" data-i18n-aria="btn.settings"></button>' +
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

  // ---- 过关卡 ----
  const clear = getOrCreate(root, 'screen-clear', 'screen hidden');
  clear.innerHTML =
    '<div class="result-inner">' +
      '<div class="result-title" data-i18n="clear.title"></div>' +
      '<div class="result-badge" id="clear-new" data-i18n="clear.new"></div>' +
      '<ul class="result-rows">' +
        '<li><span data-i18n="clear.score"></span><b id="clear-score">0</b></li>' +
        '<li><span data-i18n="clear.bonus"></span><b id="clear-bonus">0</b></li>' +
      '</ul>' +
      '<div class="result-actions">' +
        '<button id="btn-next" class="btn btn-primary" type="button" data-i18n="btn.next"></button>' +
      '</div>' +
    '</div>';

  // ---- 失败卡 ----
  const fail = getOrCreate(root, 'screen-fail', 'screen hidden');
  fail.innerHTML =
    '<div class="result-inner">' +
      '<div class="result-title" data-i18n="fail.title"></div>' +
      '<div class="fail-hint" data-i18n="fail.hint"></div>' +
      '<ul class="result-rows">' +
        '<li><span data-i18n="fail.score"></span><b id="fail-score">0</b></li>' +
        '<li><span data-i18n="fail.best"></span><b id="fail-best">1</b></li>' +
      '</ul>' +
      '<div class="result-actions">' +
        '<button id="btn-retry" class="btn btn-primary" type="button" data-i18n="btn.retry"></button>' +
        '<button id="btn-share" class="btn btn-ghost" type="button" data-i18n="btn.share"></button>' +
      '</div>' +
    '</div>';

  // ---- 通关卡 ----
  const won = getOrCreate(root, 'screen-won', 'screen hidden');
  won.innerHTML =
    '<div class="result-inner">' +
      '<div class="result-title" data-i18n="won.title"></div>' +
      '<ul class="result-rows">' +
        '<li><span data-i18n="won.score"></span><b id="won-score">0</b></li>' +
      '</ul>' +
      '<div class="result-actions">' +
        '<button id="btn-title" class="btn btn-primary" type="button" data-i18n="btn.restart"></button>' +
        '<button id="btn-share-won" class="btn btn-ghost" type="button" data-i18n="btn.share"></button>' +
      '</div>' +
    '</div>';

  // ---- 设置 ----
  const settings = getOrCreate(root, 'screen-settings', 'screen hidden');
  settings.innerHTML =
    '<div class="settings-inner">' +
      '<h2 class="settings-title" data-i18n="set.title"></h2>' +
      '<label class="settings-row"><span data-i18n="set.language"></span>' +
        '<select id="lang-select-settings" class="lang-select" aria-label=""></select>' +
      '</label>' +
      '<button id="btn-settings-back" class="btn btn-ghost" type="button" data-i18n="set.back"></button>' +
    '</div>';

  const els = {
    title, pause, clear, fail, won, settings,
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
    btnNext: clear.querySelector('#btn-next'),
    btnRetry: fail.querySelector('#btn-retry'),
    btnShare: fail.querySelector('#btn-share'),
    btnTitle: won.querySelector('#btn-title'),
    btnShareWon: won.querySelector('#btn-share-won'),
    btnSettingsBack: settings.querySelector('#btn-settings-back'),
    titleBest: title.querySelector('#title-best'),
    clearNew: clear.querySelector('#clear-new'),
    clearScore: clear.querySelector('#clear-score'),
    clearBonus: clear.querySelector('#clear-bonus'),
    failScore: fail.querySelector('#fail-score'),
    failBest: fail.querySelector('#fail-best'),
    wonScore: won.querySelector('#won-score'),
  };

  function setBest(level) {
    els.titleBest.textContent = t('title.best', { level: Math.max(1, Math.floor(level ?? 1)) });
  }

  function renderClear(data) {
    data = data || {};
    els.clearScore.textContent = String(data.score ?? 0);
    els.clearBonus.textContent = String(data.bonus ?? 0);
    els.clearNew.classList.toggle('hidden', !data.newLevel);
  }

  function renderFail(data) {
    data = data || {};
    els.failScore.textContent = String(data.score ?? 0);
    els.failBest.textContent = String(Math.max(1, Math.floor(data.best ?? 1)));
  }

  function renderWon(data) {
    data = data || {};
    els.wonScore.textContent = String(data.score ?? 0);
  }

  return {
    els,
    setBest,
    renderClear,
    renderFail,
    renderWon,
  };
}
