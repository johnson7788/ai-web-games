// src/ui/screens.js — 标题 / 暂停 / 结算 / 通关 / 设置。只搭 DOM 与填数；文案走 data-i18n。
// 事件由 main 注册（通过返回的 els）。
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
        '<button id="btn-start" class="btn btn-primary" type="button" data-i18n="btn.start" data-i18n-aria="btn.start"></button>' +
        '<button id="btn-how" class="btn btn-ghost" type="button" data-tutorial-replay data-i18n="btn.how"></button>' +
        '<button id="btn-settings" class="btn btn-ghost" type="button" data-i18n="btn.settings"></button>' +
      '</div>' +
      '<div class="title-hint" data-i18n="title.startHint"></div>' +
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
      '<div class="result-badge hidden" id="result-new-record" data-i18n="result.newRecord"></div>' +
      '<ul class="result-rows">' +
        '<li><span data-i18n="result.score"></span><b id="res-score">0</b></li>' +
        '<li><span data-i18n="result.level"></span><b id="res-level">1</b></li>' +
        '<li><span data-i18n="result.layer"></span><b id="res-layer"></b></li>' +
        '<li><span data-i18n="result.lines"></span><b id="res-lines">0</b></li>' +
        '<li><span data-i18n="result.best"></span><b id="res-best">0</b></li>' +
      '</ul>' +
      '<div class="result-actions">' +
        '<button id="btn-again" class="btn btn-primary" type="button" data-i18n="btn.restart"></button>' +
        '<button id="btn-share" class="btn btn-ghost" type="button" data-i18n="btn.share"></button>' +
      '</div>' +
      '<div class="result-hint" data-i18n="result.hint"></div>' +
    '</div>';

  const win = getOrCreate(root, 'screen-win', 'screen hidden');
  win.innerHTML =
    '<div class="win-inner">' +
      '<div class="win-title" data-i18n="win.title"></div>' +
      '<div class="win-subtitle" data-i18n="win.subtitle"></div>' +
      '<div class="win-score"><span data-i18n="win.score"></span><b id="win-score">0</b></div>' +
      '<div class="result-actions">' +
        '<button id="btn-win-again" class="btn btn-primary" type="button" data-i18n="btn.restart"></button>' +
        '<button id="btn-share" class="btn btn-ghost" type="button" data-i18n="btn.share"></button>' +
      '</div>' +
    '</div>';

  const settings = getOrCreate(root, 'screen-settings', 'screen hidden');
  settings.innerHTML =
    '<div class="settings-inner">' +
      '<h2 class="settings-title" data-i18n="set.title"></h2>' +
      '<label class="settings-row"><span data-i18n="set.language"></span>' +
        '<select id="lang-select-settings" class="lang-select" aria-label=""></select>' +
      '</label>' +
      '<div class="settings-row"><span data-i18n="set.mute"></span>' +
        '<button id="btn-mute" class="btn btn-ghost" type="button"></button>' +
      '</div>' +
      '<button id="btn-settings-back" class="btn btn-ghost" type="button" data-i18n="btn.back"></button>' +
    '</div>';

  const els = {
    title, pause, result, win, settings,
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
    btnWinAgain: win.querySelector('#btn-win-again'),
    btnShare: result.querySelector('#btn-share'),
    btnShareWin: win.querySelector('#btn-share'),
    btnSettingsBack: settings.querySelector('#btn-settings-back'),
    btnMute: settings.querySelector('#btn-mute'),
    titleBest: title.querySelector('#title-best'),
    newRecordBadge: result.querySelector('#result-new-record'),
    resScore: result.querySelector('#res-score'),
    resLevel: result.querySelector('#res-level'),
    resLayer: result.querySelector('#res-layer'),
    resLines: result.querySelector('#res-lines'),
    resBest: result.querySelector('#res-best'),
    winScore: win.querySelector('#win-score'),
  };

  function layerLabel(layer) {
    const key = 'layer.' + layer;
    const text = t(key);
    return text !== key ? text : String(layer);
  }

  function setBest(best) {
    els.titleBest.textContent = t('title.best', { score: Math.max(0, Math.floor(best ?? 0)) });
  }

  function renderResult(data) {
    data = data || {};
    els.resScore.textContent = String(Math.max(0, Math.floor(data.score ?? 0)));
    els.resLevel.textContent = String(Math.max(1, Math.floor(data.level ?? 1)));
    els.resLayer.textContent = layerLabel(Number(data.layerReached) || Number(data.layer) || 1);
    els.resLines.textContent = String(Math.max(0, Math.floor(data.lines ?? 0)));
    els.resBest.textContent = String(Math.max(0, Math.floor(data.best ?? 0)));
    els.newRecordBadge.classList.toggle('hidden', !data.newRecord);
  }

  function renderWin(data) {
    data = data || {};
    els.winScore.textContent = String(Math.max(0, Math.floor(data.score ?? 0)));
  }

  return { els, setBest, renderResult, renderWin };
}
