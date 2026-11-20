// src/ui/screens.js — 标题 / 暂停 / 失败结算 / 过关 / 胜利 / 设置。
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
      '<div class="title-logo" id="title-text" data-i18n="title.logo"></div>' +
      '<div class="title-tagline" id="subtitle-text" data-i18n="title.tagline"></div>' +
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
      '<h2 class="pause-title" id="pause-title" data-i18n="pause.title"></h2>' +
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
        '<li><span data-i18n="result.dish"></span><b id="res-dish">0</b></li>' +
        '<li><span data-i18n="result.cleared"></span><b id="res-cleared">0</b></li>' +
        '<li><span data-i18n="result.best"></span><b id="res-best">0</b></li>' +
      '</ul>' +
      '<div class="result-actions">' +
        '<button id="btn-again" class="btn btn-primary" type="button" data-i18n="btn.restart"></button>' +
        '<button id="btn-share" class="btn btn-ghost" type="button" data-i18n="btn.share"></button>' +
      '</div>' +
      '<div class="result-hint" data-i18n="result.hint"></div>' +
    '</div>';

  const cleared = getOrCreate(root, 'screen-cleared', 'screen hidden');
  cleared.innerHTML =
    '<div class="cleared-inner">' +
      '<div class="cleared-title" id="clear-title" data-i18n="clear.title"></div>' +
      '<div class="cleared-sub" id="clear-sub" data-i18n="clear.next"></div>' +
      '<button id="btn-continue" class="btn btn-primary" type="button" data-i18n="btn.continue"></button>' +
    '</div>';

  const victory = getOrCreate(root, 'screen-victory', 'screen hidden');
  victory.innerHTML =
    '<div class="victory-inner">' +
      '<div class="victory-title" data-i18n="victory.title"></div>' +
      '<div class="victory-hint" data-i18n="victory.hint"></div>' +
      '<button id="btn-again-victory" class="btn btn-primary" type="button" data-i18n="btn.restart"></button>' +
    '</div>';

  const settings = getOrCreate(root, 'screen-settings', 'screen hidden');
  settings.innerHTML =
    '<div class="settings-inner">' +
      '<h2 class="settings-title" data-i18n="set.title"></h2>' +
      '<label class="settings-row"><span data-i18n="set.language"></span>' +
        '<select id="lang-select-settings" class="lang-select" aria-label=""></select>' +
      '</label>' +
      '<label class="settings-row"><span data-i18n="set.sound"></span>' +
        '<button id="btn-sound" class="btn btn-ghost btn-small" type="button">ON</button>' +
      '</label>' +
      '<button id="btn-settings-back" class="btn btn-ghost" type="button" data-i18n="set.back"></button>' +
    '</div>';

  const els = {
    title, pause, result, cleared, victory, settings,
    langSelects: [
      title.querySelector('.lang-select'),
      pause.querySelector('.lang-select'),
      settings.querySelector('.lang-select'),
    ],
    btnStart: title.querySelector('#btn-start'),
    btnHow: title.querySelector('#btn-how'),
    btnSettings: title.querySelector('#btn-settings'),
    btnResume: pause.querySelector('#btn-resume'),
    btnRestart: pause.querySelector('#btn-restart'),
    btnHowPause: pause.querySelector('#btn-how-pause'),
    btnAgain: result.querySelector('#btn-again'),
    btnShare: result.querySelector('#btn-share'),
    btnContinue: cleared.querySelector('#btn-continue'),
    btnAgainVictory: victory.querySelector('#btn-again-victory'),
    btnSound: settings.querySelector('#btn-sound'),
    btnSettingsBack: settings.querySelector('#btn-settings-back'),
    titleBest: title.querySelector('#title-best'),
    newRecordBadge: result.querySelector('#result-new-record'),
    resDish: result.querySelector('#res-dish'),
    resCleared: result.querySelector('#res-cleared'),
    resBest: result.querySelector('#res-best'),
    clearTitle: cleared.querySelector('#clear-title'),
    clearSub: cleared.querySelector('#clear-sub'),
  };

  function setBest(best) {
    els.titleBest.textContent = t('title.best', { dish: Math.max(0, Math.floor(best ?? 0)) });
  }

  function renderResult(data) {
    data = data || {};
    const dish = Math.max(1, Math.floor(data.dish ?? 1));
    const cleared = Math.max(0, Math.floor(data.cleared ?? 0));
    const best = Math.max(0, Math.floor(data.best ?? 0));
    els.resDish.textContent = String(dish);
    els.resCleared.textContent = String(cleared);
    els.resBest.textContent = String(best);
    els.newRecordBadge.classList.toggle('hidden', !data.newRecord);
  }

  function renderCleared(data) {
    data = data || {};
    els.clearTitle.textContent = t('clear.title', { dish: Math.max(1, Math.floor(data.dish ?? 1)) });
    els.clearSub.textContent = t('clear.next', { dish: Math.max(1, Math.floor((data.dish ?? 1) + 1)) });
  }

  function setSoundLabel(muted) {
    els.btnSound.textContent = muted ? 'OFF' : 'ON';
  }

  return {
    els,
    setBest,
    renderResult,
    renderCleared,
    setSoundLabel,
  };
}
