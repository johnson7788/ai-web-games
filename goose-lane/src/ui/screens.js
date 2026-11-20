// src/ui/screens.js — 标题 / 暂停 / 死亡结算 / 复活 / 设置。
// 只搭 DOM 与填数；文案走 data-i18n，由 index.js 统一 applyLang；事件由 main 注册。
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

const LANG_SELECT_TITLE = '<select id="lang-select" class="lang-select" aria-label=""></select>';
const LANG_SELECT_PAUSE = '<select id="lang-select-pause" class="lang-select" aria-label=""></select>';

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
    LANG_SELECT_TITLE;

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
    LANG_SELECT_PAUSE;

  const result = getOrCreate(root, 'screen-result', 'screen hidden');
  result.innerHTML =
    '<div class="result-inner">' +
      '<div class="result-title" data-i18n="result.title"></div>' +
      '<div class="result-badge hidden" id="result-new-record" data-i18n="result.newRecord"></div>' +
      '<ul class="result-rows">' +
        '<li><span data-i18n="result.distance"></span><b id="res-distance">0m</b></li>' +
        '<li><span data-i18n="result.gems"></span><b id="res-gems">0</b></li>' +
        '<li><span data-i18n="result.station"></span><b id="res-station">1/12</b></li>' +
        '<li><span data-i18n="result.best"></span><b id="res-best">0m</b></li>' +
      '</ul>' +
      '<div class="result-actions">' +
        '<button id="btn-again" class="btn btn-primary" type="button" data-i18n="btn.restart"></button>' +
        '<button id="btn-share" class="btn btn-ghost" type="button" data-i18n="btn.share"></button>' +
      '</div>' +
      '<div class="result-hint" data-i18n="result.hint"></div>' +
    '</div>';

  const revive = getOrCreate(root, 'screen-revive', 'screen hidden');
  revive.innerHTML =
    '<div class="result-inner">' +
      '<div class="result-title" data-i18n="revive.title"></div>' +
      '<div class="result-hint" data-i18n="revive.hint"></div>' +
      '<div class="result-actions">' +
        '<button id="btn-revive" class="btn btn-primary" type="button" data-i18n="btn.revive"></button>' +
        '<button id="btn-giveup" class="btn btn-ghost" type="button" data-i18n="btn.giveup"></button>' +
      '</div>' +
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
    title, pause, result, revive, settings,
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
    btnRevive: revive.querySelector('#btn-revive'),
    btnGiveup: revive.querySelector('#btn-giveup'),
    btnSettingsBack: settings.querySelector('#btn-settings-back'),
    titleBest: title.querySelector('#title-best'),
    newRecordBadge: result.querySelector('#result-new-record'),
    resDistance: result.querySelector('#res-distance'),
    resGems: result.querySelector('#res-gems'),
    resStation: result.querySelector('#res-station'),
    resBest: result.querySelector('#res-best'),
  };

  function stationLabel(station, stationName) {
    const key = 'station.' + stationName;
    const text = t(key);
    return (text !== key ? text : stationName || '');
  }

  function setBest(best) {
    els.titleBest.textContent = t('title.best', { distance: Math.max(0, Math.floor(best ?? 0)) });
  }

  function renderResult(data) {
    data = data || {};
    const distance = Math.max(0, Math.floor(data.distance ?? 0));
    const gems = Math.max(0, Math.floor(data.gems ?? 0));
    const station = Math.max(1, Math.floor(data.station ?? 1));
    const best = Math.max(0, Math.floor(data.best ?? 0));
    els.resDistance.textContent = distance + 'm';
    els.resGems.textContent = String(gems);
    els.resStation.textContent = `${station}/12 · ${stationLabel(station, data.stationName)}`;
    els.resBest.textContent = best + 'm';
    els.newRecordBadge.classList.toggle('hidden', !data.newRecord);
  }

  return { els, setBest, renderResult };
}
