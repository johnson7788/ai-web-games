// src/ui/screens.js — 标题 / 暂停 / 结算 / 升级 / 设置。
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
      '<ul class="result-rows">' +
        '<li><span data-i18n="result.rank"></span><b id="res-rank">1</b></li>' +
        '<li><span data-i18n="result.length"></span><b id="res-length">0</b></li>' +
        '<li><span data-i18n="result.kills"></span><b id="res-kills">0</b></li>' +
        '<li><span data-i18n="result.round"></span><b id="res-round">1</b></li>' +
        '<li><span data-i18n="result.best"></span><b id="res-best">0</b></li>' +
      '</ul>' +
      '<div class="result-actions">' +
        '<button id="btn-again" class="btn btn-primary" type="button" data-i18n="btn.restart"></button>' +
        '<button id="btn-share" class="btn btn-ghost" type="button" data-i18n="btn.share"></button>' +
      '</div>' +
      '<div class="result-hint" data-i18n="result.hint"></div>' +
    '</div>';

  const upgrade = getOrCreate(root, 'screen-upgrade', 'screen hidden');
  upgrade.innerHTML =
    '<div class="upgrade-inner">' +
      '<h2 class="upgrade-title" data-i18n="up.title"></h2>' +
      '<div class="upgrade-subtitle" id="upgrade-subtitle"></div>' +
      '<div class="upgrade-choices" id="upgrade-choices"></div>' +
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
    title, pause, result, upgrade, settings,
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
    newRecordBadge: result.querySelector('#result-new-record'),
    resultTitle: result.querySelector('#result-title'),
    resRank: result.querySelector('#res-rank'),
    resLength: result.querySelector('#res-length'),
    resKills: result.querySelector('#res-kills'),
    resRound: result.querySelector('#res-round'),
    resBest: result.querySelector('#res-best'),
    upgradeSubtitle: upgrade.querySelector('#upgrade-subtitle'),
    upgradeChoices: upgrade.querySelector('#upgrade-choices'),
  };

  function setBest(best) {
    els.titleBest.textContent = t('title.best', { length: Math.max(0, Math.floor(best ?? 0)) });
  }

  function renderResult(data) {
    data = data || {};
    els.resultTitle.textContent = t(data.won ? 'result.winTitle' : 'result.title');
    els.resRank.textContent = '#' + Math.max(1, Math.floor(data.rank ?? 1));
    els.resLength.textContent = String(Math.max(0, Math.floor(data.length ?? 0)));
    els.resKills.textContent = String(Math.max(0, Math.floor(data.kills ?? 0)));
    els.resRound.textContent = String(Math.max(1, Math.floor(data.round ?? 1)));
    els.resBest.textContent = String(Math.max(0, Math.floor(data.best ?? 0)));
    els.newRecordBadge.classList.toggle('hidden', !data.newRecord);
  }

  function renderUpgrade(offers) {
    els.upgradeChoices.innerHTML = '';
    (offers || []).forEach((id, i) => {
      const b = el('button', 'btn btn-upgrade', t('up.' + id));
      b.type = 'button';
      b.dataset.upgradeIndex = String(i);
      els.upgradeChoices.appendChild(b);
    });
  }

  return { els, setBest, renderResult, renderUpgrade };
}
