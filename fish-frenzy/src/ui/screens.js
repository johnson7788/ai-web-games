// src/ui/screens.js — 标题 / 暂停 / 结算 / 设置 DOM。
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
  const title = getOrCreate(root, 'screen-title', 'screen');
  title.innerHTML =
    '<div class="title-inner">' +
      '<div class="title-logo" data-i18n="title.logo"></div>' +
      '<div class="title-tagline" data-i18n="title.tagline"></div>' +
      '<div class="title-best" id="title-best"></div>' +
      '<div class="title-actions">' +
        '<button id="btn-start" class="btn btn-primary" type="button" data-i18n="btn.start" data-i18n-aria="btn.start"></button>' +
        '<button id="btn-how" class="btn btn-ghost" type="button" data-tutorial-replay data-i18n="btn.how"></button>' +
        '<button id="btn-settings" class="btn btn-ghost" type="button" data-i18n="btn.settings"></button>' +
      '</div>' +
    '</div>' +
    '<select id="lang-select" class="lang-select" aria-label=""></select>';

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

  const result = getOrCreate(root, 'screen-result', 'screen hidden');
  result.innerHTML =
    '<div class="result-inner">' +
      '<div class="result-title" data-i18n="result.title"></div>' +
      '<div class="result-badge hidden" id="result-won" data-i18n="result.won"></div>' +
      '<div class="result-badge hidden" id="result-new-record" data-i18n="result.newRecord"></div>' +
      '<ul class="result-rows">' +
        '<li><span data-i18n="result.stage"></span><b id="res-stage">1</b></li>' +
        '<li><span data-i18n="result.revenue"></span><b id="res-revenue">0</b></li>' +
        '<li><span data-i18n="result.catches"></span><b id="res-catches">0</b></li>' +
        '<li><span data-i18n="result.best"></span><b id="res-best">1</b></li>' +
      '</ul>' +
      '<div class="result-actions">' +
        '<button id="btn-again" class="btn btn-primary" type="button" data-i18n="btn.restart"></button>' +
        '<button id="btn-share" class="btn btn-ghost" type="button" data-i18n="btn.share"></button>' +
      '</div>' +
      '<div class="result-hint" data-i18n="result.hint"></div>' +
    '</div>';

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
    title, pause, result, settings,
    langSelects: [
      title.querySelector('.lang-select'),
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
    titleBest: title.querySelector('#title-best'),
    wonBadge: result.querySelector('#result-won'),
    newRecordBadge: result.querySelector('#result-new-record'),
    resStage: result.querySelector('#res-stage'),
    resRevenue: result.querySelector('#res-revenue'),
    resCatches: result.querySelector('#res-catches'),
    resBest: result.querySelector('#res-best'),
  };

  function setBest(best) {
    els.titleBest.textContent = t('title.best', { stage: Math.max(1, Math.floor(best ?? 1)) });
  }

  function renderResult(data) {
    data = data || {};
    const stage = Math.max(1, Math.floor(data.stage ?? 1));
    els.resStage.textContent = String(stage);
    els.resRevenue.textContent = String(Math.floor(data.revenue ?? 0));
    els.resCatches.textContent = String(Math.floor(data.catches ?? 0));
    els.resBest.textContent = String(Math.max(1, Math.floor(data.best ?? 1)));
    els.wonBadge.classList.toggle('hidden', !data.won);
    els.newRecordBadge.classList.toggle('hidden', !data.newRecord);
  }

  return { els, setBest, renderResult };
}
