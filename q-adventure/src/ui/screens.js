// src/ui/screens.js — 标题 / 暂停 / 结算 / 设置 / 过关横幅。只搭 DOM + 填数；文案走 data-i18n。
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
      '<div class="result-title" id="result-title"></div>' +
      '<div class="result-badge hidden" id="result-new-record" data-i18n="result.newRecord"></div>' +
      '<ul class="result-rows">' +
        '<li><span data-i18n="result.level"></span><b id="res-level"></b></li>' +
        '<li><span data-i18n="result.stars"></span><b id="res-stars"></b></li>' +
        '<li><span data-i18n="result.coins"></span><b id="res-coins"></b></li>' +
        '<li><span data-i18n="result.best"></span><b id="res-best"></b></li>' +
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

  const banner = getOrCreate(root, 'banner', 'banner hidden');
  banner.innerHTML = '<div class="banner-text" id="banner-text"></div>';

  const els = {
    title, pause, result, settings, banner,
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
    resLevel: result.querySelector('#res-level'),
    resStars: result.querySelector('#res-stars'),
    resCoins: result.querySelector('#res-coins'),
    resBest: result.querySelector('#res-best'),
    bannerText: banner.querySelector('#banner-text'),
  };

  function setBest(best) {
    els.titleBest.textContent = t('title.best', { stars: Math.max(0, Math.floor(best ?? 0)) });
  }

  function renderResult(data) {
    data = data || {};
    const win = data.win === true;
    els.resultTitle.textContent = t(win ? 'result.win' : 'result.lose');
    els.resLevel.textContent = t('level.' + (Number(data.level) || 1));
    els.resStars.textContent = String(Math.max(0, Math.floor(data.stars ?? 0)));
    els.resCoins.textContent = String(Math.max(0, Math.floor(data.coins ?? 0)));
    els.resBest.textContent = String(Math.max(0, Math.floor(data.best ?? 0)));
    els.newRecordBadge.classList.toggle('hidden', !data.newRecord);
  }

  function showBanner(text) {
    els.bannerText.textContent = text;
    els.banner.classList.remove('hidden');
    clearTimeout(showBanner._t);
    showBanner._t = setTimeout(() => els.banner.classList.add('hidden'), 1600);
  }

  return { els, setBest, renderResult, showBanner };
}
