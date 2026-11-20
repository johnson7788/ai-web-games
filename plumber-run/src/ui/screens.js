// src/ui/screens.js — 标题 / 暂停 / 结算（死亡 & 通关）/ 设置。
// 只负责搭 DOM 与填数；文案走 data-i18n，由 index.js 统一 applyLang。
import { t } from '../core/i18n.js';

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

export function createScreens(root) {
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
      '<div class="result-stars" id="result-stars"></div>' +
      '<ul class="result-rows">' +
        '<li><span data-i18n="result.level"></span><b id="res-level">1</b></li>' +
        '<li><span data-i18n="result.coins"></span><b id="res-coins">0</b></li>' +
        '<li><span data-i18n="result.score"></span><b id="res-score">0</b></li>' +
        '<li><span data-i18n="result.best"></span><b id="res-best">1</b></li>' +
      '</ul>' +
      '<div class="result-actions">' +
        '<button id="btn-again" class="btn btn-primary" type="button" data-i18n="btn.again"></button>' +
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
      '<button id="btn-settings-back" class="btn btn-ghost" type="button" data-i18n="btn.back"></button>' +
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
    btnShare: result.querySelector('#btn-share'),
    btnSettingsBack: settings.querySelector('#btn-settings-back'),
    titleBest: title.querySelector('#title-best'),
    resultTitle: result.querySelector('#result-title'),
    newRecordBadge: result.querySelector('#result-new-record'),
    resultStars: result.querySelector('#result-stars'),
    resLevel: result.querySelector('#res-level'),
    resCoins: result.querySelector('#res-coins'),
    resScore: result.querySelector('#res-score'),
    resBest: result.querySelector('#res-best'),
    resultHint: result.querySelector('#result-hint'),
  };

  function setBest(best) {
    els.titleBest.textContent = t('title.best', { level: Math.max(1, Math.floor(best ?? 1)) });
  }

  function renderResult(data) {
    data = data || {};
    els.resultTitle.textContent = data.win ? t('result.winTitle') : t('result.title');
    els.resultHint.textContent = data.win ? t('result.winHint') : t('result.hint');
    els.resLevel.textContent = String(Math.max(1, Math.floor(data.level ?? 1)));
    els.resCoins.textContent = String(Math.max(0, Math.floor(data.coins ?? 0)));
    els.resScore.textContent = String(Math.max(0, Math.floor(data.score ?? 0)));
    els.resBest.textContent = String(Math.max(1, Math.floor(data.best ?? 1)));
    els.newRecordBadge.classList.toggle('hidden', !data.newRecord);
    const stars = Math.max(0, Math.floor(data.stars ?? 0));
    els.resultStars.textContent = t('result.stars') + ': ' + '★'.repeat(Math.min(3, stars)) + '☆'.repeat(Math.max(0, 3 - Math.min(3, stars)));
  }

  return { els, setBest, renderResult };
}
