// src/ui/screens.js — 标题 / 暂停 / 结算（过关=电路已通、失败=保险丝熔断）/ 设置。
// 只搭 DOM 与填数；所有可见文案走 data-i18n，由 index.js 统一 applyLang；事件由 main 注册。
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

const LANG_HTML = (id) => `<select id="${id}" class="lang-select" aria-label=""></select>`;

export function createScreens(root) {
  // 标题屏
  const title = getOrCreate(root, 'screen-title', 'screen');
  title.innerHTML =
    '<div class="title-card">' +
      '<div class="title-logo" data-i18n="title.logo"></div>' +
      '<div class="title-tagline" data-i18n="title.tagline"></div>' +
      '<div class="title-best" id="title-best"></div>' +
      '<div class="title-actions">' +
        '<button id="btn-start" class="btn btn-primary" type="button" data-i18n="btn.start" data-i18n-aria="btn.start"></button>' +
        '<button id="btn-how" class="btn btn-ghost" type="button" data-tutorial-replay data-i18n="btn.how"></button>' +
        '<button id="btn-settings" class="btn btn-ghost" type="button" data-i18n="btn.settings" data-i18n-aria="btn.settings"></button>' +
      '</div>' +
    '</div>' +
    LANG_HTML('lang-select');

  // 暂停屏
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
    LANG_HTML('lang-select-pause');

  // 结算卡（过关 / 熔断）
  const result = getOrCreate(root, 'screen-result', 'screen hidden');
  result.innerHTML =
    '<div class="result-inner">' +
      '<div class="result-title" id="result-title"></div>' +
      '<div class="result-badge hidden" id="result-new-record" data-i18n="result.newRecord"></div>' +
      '<div class="result-stars" id="result-stars">★★★</div>' +
      '<ul class="result-rows">' +
        '<li><span data-i18n="result.steps"></span><b id="res-steps">0</b></li>' +
        '<li><span data-i18n="result.par"></span><b id="res-par">0</b></li>' +
        '<li><span data-i18n="result.best"></span><b id="res-best">0★</b></li>' +
      '</ul>' +
      '<div class="result-actions">' +
        '<button id="btn-next" class="btn btn-primary" type="button" data-i18n="btn.next"></button>' +
        '<button id="btn-again" class="btn btn-ghost" type="button" data-i18n="btn.retry"></button>' +
        '<button id="btn-share" class="btn btn-ghost" type="button" data-i18n="btn.share"></button>' +
      '</div>' +
      '<div class="result-hint" id="result-hint"></div>' +
    '</div>';

  // 设置
  const settings = getOrCreate(root, 'screen-settings', 'screen hidden');
  settings.innerHTML =
    '<div class="settings-inner">' +
      '<h2 class="settings-title" data-i18n="set.title"></h2>' +
      '<label class="settings-row"><span data-i18n="set.language"></span>' +
        LANG_HTML('lang-select-settings') +
      '</label>' +
      '<label class="settings-row"><span data-i18n="set.mute"></span>' +
        '<input type="checkbox" id="settings-mute">' +
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
    btnNext: result.querySelector('#btn-next'),
    btnAgain: result.querySelector('#btn-again'),
    btnShare: result.querySelector('#btn-share'),
    btnSettingsBack: settings.querySelector('#btn-settings-back'),
    settingsMute: settings.querySelector('#settings-mute'),
    titleBest: title.querySelector('#title-best'),
    resultTitle: result.querySelector('#result-title'),
    resultStars: result.querySelector('#result-stars'),
    newRecordBadge: result.querySelector('#result-new-record'),
    resSteps: result.querySelector('#res-steps'),
    resPar: result.querySelector('#res-par'),
    resBest: result.querySelector('#res-best'),
    resultHint: result.querySelector('#result-hint'),
  };

  function setBest(data) {
    const stars = Math.max(0, Math.min(3, data?.stars || 0));
    const level = Math.max(1, data?.level || 1);
    els.titleBest.textContent = t('title.best', { stars, level });
  }

  function renderResult(data) {
    data = data || {};
    const win = data.win === true;
    els.resultTitle.textContent = t(win ? 'result.win.title' : 'result.overload.title');
    const stars = Math.max(0, Math.min(3, data.stars || 0));
    els.resultStars.textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    els.resSteps.textContent = String(data.steps ?? 0);
    els.resPar.textContent = String(data.par ?? 0);
    els.resBest.textContent = '★'.repeat(Math.max(0, Math.min(3, data.bestStars || 0)));
    els.newRecordBadge.classList.toggle('hidden', !data.newRecord);
    els.btnNext.classList.toggle('hidden', !win);
    els.resultHint.textContent = t(win ? 'result.nextHint' : 'result.hint');
  }

  return { els, setBest, renderResult };
}
