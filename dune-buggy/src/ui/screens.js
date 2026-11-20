// src/ui/screens.js — 标题 / 暂停 / 结算卡 / 设置。
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
        '<button id="btn-start" class="btn btn-primary" type="button" data-i18n="btn.start" data-i18n-aria="btn.start"></button>' +
        '<button id="btn-how" class="btn btn-ghost" type="button" data-tutorial-replay data-i18n="btn.how"></button>' +
        '<button id="btn-settings" class="btn btn-ghost" type="button" data-i18n="btn.settings"></button>' +
      '</div>' +
      '<div class="title-press" data-i18n="title.press"></div>' +
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
    LANG_SELECT_HTML;

  // ---- 结算卡 ----
  const result = getOrCreate(root, 'screen-result', 'screen hidden');
  result.innerHTML =
    '<div class="result-inner">' +
      '<div class="result-title" id="result-title"></div>' +
      '<div class="result-badge hidden" id="result-new-record" data-i18n="result.newRecord"></div>' +
      '<ul class="result-rows">' +
        '<li><span data-i18n="result.time"></span><b id="res-time">0.0s</b></li>' +
        '<li><span data-i18n="result.target"></span><b id="res-target">0s</b></li>' +
        '<li><span data-i18n="result.rating"></span><b id="res-rating">—</b></li>' +
        '<li><span data-i18n="result.stage"></span><b id="res-stage">1</b></li>' +
        '<li id="res-total-row" class="hidden"><span data-i18n="result.total"></span><b id="res-total">0.0s</b></li>' +
        '<li><span data-i18n="result.best"></span><b id="res-best">—</b></li>' +
      '</ul>' +
      '<div class="result-actions">' +
        '<button id="btn-next" class="btn btn-primary hidden" type="button" data-i18n="btn.next"></button>' +
        '<button id="btn-retry" class="btn btn-primary hidden" type="button" data-i18n="btn.retry"></button>' +
        '<button id="btn-again" class="btn btn-ghost" type="button" data-i18n="btn.restart"></button>' +
        '<button id="btn-share" class="btn btn-ghost" type="button" data-i18n="btn.share"></button>' +
      '</div>' +
      '<div class="result-hint" id="result-hint"></div>' +
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
    title, pause, result, settings,
    langSelects: [
      title.querySelector('.lang-select'),
      pause.querySelector('.lang-select'),
      settings.querySelector('#lang-select-settings'),
    ],
    btnStart: title.querySelector('#btn-start'),
    btnHow: title.querySelector('#btn-how'),
    btnSettings: title.querySelector('#btn-settings'),
    btnResume: pause.querySelector('#btn-resume'),
    btnRestart: pause.querySelector('#btn-restart'),
    btnHowPause: pause.querySelector('#btn-how-pause'),
    btnNext: result.querySelector('#btn-next'),
    btnRetry: result.querySelector('#btn-retry'),
    btnAgain: result.querySelector('#btn-again'),
    btnShare: result.querySelector('#btn-share'),
    btnSettingsBack: settings.querySelector('#btn-settings-back'),
    titleBest: title.querySelector('#title-best'),
    resultTitle: result.querySelector('#result-title'),
    newRecordBadge: result.querySelector('#result-new-record'),
    resTime: result.querySelector('#res-time'),
    resTarget: result.querySelector('#res-target'),
    resRating: result.querySelector('#res-rating'),
    resStage: result.querySelector('#res-stage'),
    resTotalRow: result.querySelector('#res-total-row'),
    resTotal: result.querySelector('#res-total'),
    resBest: result.querySelector('#res-best'),
    resultHint: result.querySelector('#result-hint'),
  };

  function fmtTime(v) {
    return (Number(v) || 0).toFixed(1) + 's';
  }

  function ratingLabel(r) {
    const key = 'rating.' + (r || 'finish');
    const text = t(key);
    return text !== key ? text : (r || 'finish');
  }

  function setBest(stage, time) {
    if (!time) { els.titleBest.textContent = ''; return; }
    els.titleBest.textContent = t('title.best', { stage, time: (Number(time) || 0).toFixed(1) });
  }

  function renderResult(data) {
    data = data || {};
    const mode = data.mode || 'clear';
    els.resultTitle.textContent = t(mode === 'champion' ? 'result.champion' : mode === 'dnf' ? 'result.dnf' : 'result.clear');
    els.resTime.textContent = fmtTime(data.time);
    els.resTarget.textContent = String(Math.max(0, Math.floor(data.parSec ?? 0))) + 's';
    els.resRating.textContent = ratingLabel(data.rating);
    els.resStage.textContent = String(Math.max(1, Math.floor(data.stage ?? 1)));
    els.resBest.textContent = data.best > 0 ? fmtTime(data.best) : '—';
    els.resTotalRow.classList.toggle('hidden', mode !== 'champion');
    els.resTotal.textContent = fmtTime(data.totalTime);
    els.newRecordBadge.classList.toggle('hidden', !data.newRecord);
    els.btnNext.classList.toggle('hidden', mode !== 'clear');
    els.btnRetry.classList.toggle('hidden', mode !== 'dnf');
    els.resultHint.textContent = mode === 'clear' ? t('result.nextHint') : t('result.hint');
  }

  return {
    els,
    setBest,
    renderResult,
  };
}
