// src/ui/screens.js — 标题 / 暂停 / 结算 / 设置 四个屏。
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
        '<button id="btn-settings" class="btn btn-ghost" type="button" data-i18n="btn.settings" data-i18n-aria="btn.settings"></button>' +
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
      '<div class="result-title" id="result-title" data-i18n="result.title"></div>' +
      '<div class="result-badge hidden" id="result-new-record" data-i18n="result.newRecord"></div>' +
      '<ul class="result-rows">' +
        '<li id="row-stars"><span data-i18n="result.stars"></span><b id="res-stars">★★★</b></li>' +
        '<li><span data-i18n="result.score"></span><b id="res-score">0</b></li>' +
        '<li><span data-i18n="result.time"></span><b id="res-time">0s</b></li>' +
        '<li><span data-i18n="result.steps"></span><b id="res-steps">0</b></li>' +
        '<li><span data-i18n="result.mistakes"></span><b id="res-mistakes">0</b></li>' +
        '<li><span data-i18n="result.best"></span><b id="res-best">0</b></li>' +
      '</ul>' +
      '<div class="result-actions">' +
        '<button id="btn-next" class="btn btn-primary hidden" type="button" data-i18n="btn.next"></button>' +
        '<button id="btn-again" class="btn btn-primary" type="button" data-i18n="btn.retry"></button>' +
        '<button id="btn-share" class="btn btn-ghost" type="button" data-i18n="btn.share"></button>' +
      '</div>' +
      '<div class="result-hint" id="result-hint" data-i18n="result.hint"></div>' +
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
    btnNext: result.querySelector('#btn-next'),
    btnShare: result.querySelector('#btn-share'),
    btnSettingsBack: settings.querySelector('#btn-settings-back'),
    titleBest: title.querySelector('#title-best'),
    newRecordBadge: result.querySelector('#result-new-record'),
    resultTitle: result.querySelector('#result-title'),
    rowStars: result.querySelector('#row-stars'),
    resStars: result.querySelector('#res-stars'),
    resScore: result.querySelector('#res-score'),
    resTime: result.querySelector('#res-time'),
    resSteps: result.querySelector('#res-steps'),
    resMistakes: result.querySelector('#res-mistakes'),
    resBest: result.querySelector('#res-best'),
    resultHint: result.querySelector('#result-hint'),
  };

  let lastResult = null;

  function setBest(stars, done, total) {
    els.titleBest.textContent = t('title.best', { stars, done, total });
  }

  function starText(n) {
    return '★★★'.slice(0, Math.max(0, Math.min(3, n))) + '☆☆☆'.slice(0, Math.max(0, 3 - n));
  }

  function renderResult(data) {
    lastResult = data || {};
    const won = !!lastResult.won;
    els.resultTitle.textContent = t(won ? 'result.title' : 'result.fail');
    els.resultHint.textContent = t(won ? 'result.hint' : 'result.failHint');
    els.rowStars.classList.toggle('hidden', !won);
    els.btnNext.classList.toggle('hidden', !won);
    els.resStars.textContent = starText(lastResult.stars || 0);
    els.resScore.textContent = String(Math.round(lastResult.score || 0));
    els.resTime.textContent = Math.round(lastResult.time || 0) + 's';
    els.resSteps.textContent = String(Math.round(lastResult.steps || 0));
    els.resMistakes.textContent = String(Math.round(lastResult.mistakes || 0));
    els.resBest.textContent = String(Math.round(lastResult.best || 0));
    els.newRecordBadge.classList.toggle('hidden', !lastResult.newRecord);
  }

  return { els, setBest, renderResult, get lastResult() { return lastResult; } };
}
