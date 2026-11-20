// src/ui/screens.js — 标题 / 暂停 / 结算 / 设置 / 升级三选一。
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

export function createScreens(root) {
  // ---- 标题屏 ----
  const title = getOrCreate(root, 'screen-title', 'screen');
  title.innerHTML =
    '<div class="title-inner">' +
      '<div class="title-logo" id="title-text" data-i18n="title.logo"></div>' +
      '<div class="title-tagline" id="subtitle-text" data-i18n="title.tagline"></div>' +
      '<div class="title-best" id="title-best"></div>' +
      '<div class="title-actions">' +
        '<button id="btn-start" class="btn btn-primary" type="button" data-i18n="btn.dive" data-i18n-aria="btn.dive"></button>' +
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
        '<li><span data-i18n="result.bestWave"></span><b id="res-wave">1</b></li>' +
        '<li><span data-i18n="result.rating"></span><b id="res-rating">C</b></li>' +
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
      '<button id="btn-settings-back" class="btn btn-ghost" type="button" data-i18n="set.back"></button>' +
    '</div>';

  // ---- 升级三选一 ----
  const upgrade = getOrCreate(root, 'screen-upgrade', 'screen hidden');
  upgrade.innerHTML =
    '<div class="upgrade-inner">' +
      '<div class="upgrade-title" data-i18n="upgrade.title"></div>' +
      '<div class="upgrade-sub" data-i18n="upgrade.pick"></div>' +
      '<div class="upgrade-choices">' +
        '<button class="btn btn-primary upg-choice" id="upg-0" type="button"></button>' +
        '<button class="btn btn-primary upg-choice" id="upg-1" type="button"></button>' +
        '<button class="btn btn-primary upg-choice" id="upg-2" type="button"></button>' +
      '</div>' +
    '</div>';

  const els = {
    title, pause, result, settings, upgrade,
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
    resScore: result.querySelector('#res-score'),
    resWave: result.querySelector('#res-wave'),
    resRating: result.querySelector('#res-rating'),
    resBest: result.querySelector('#res-best'),
    upgButtons: [
      upgrade.querySelector('#upg-0'),
      upgrade.querySelector('#upg-1'),
      upgrade.querySelector('#upg-2'),
    ],
  };

  function setBest(best) {
    els.titleBest.textContent = t('title.best', { score: Math.max(0, Math.floor(best ?? 0)) });
  }

  function renderResult(data) {
    data = data || {};
    els.resultTitle.textContent = t(data.victory ? 'result.victory' : 'result.defeat');
    els.resScore.textContent = String(Math.max(0, Math.floor(data.score ?? 0)));
    els.resWave.textContent = String(Math.max(1, Math.floor(data.wave ?? 1)));
    els.resRating.textContent = data.rating || 'C';
    els.resBest.textContent = String(Math.max(0, Math.floor(data.best ?? 0)));
    els.newRecordBadge.classList.toggle('hidden', !data.newRecord);
  }

  function renderUpgrade(offers) {
    offers = offers || [];
    els.upgButtons.forEach((btn, i) => {
      const id = offers[i];
      if (id) {
        btn.classList.remove('hidden');
        btn.textContent = t('upgrade.' + id);
        btn.setAttribute('aria-label', t('upgrade.' + id));
        btn.dataset.upgId = id;
      } else {
        btn.classList.add('hidden');
      }
    });
  }

  return {
    els,
    setBest,
    renderResult,
    renderUpgrade,
  };
}
