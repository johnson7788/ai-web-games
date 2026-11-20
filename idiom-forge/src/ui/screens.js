// src/ui/screens.js — 标题 / 暂停 / 结算 / 设置屏。
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

const LANG_SELECT_TITLE = '<select id="lang-select" class="lang-select" aria-label=""></select>';
const LANG_SELECT_PAUSE = '<select id="lang-select-pause" class="lang-select" aria-label=""></select>';

export function createScreens(root) {
  const title = getOrCreate(root, 'screen-title', 'screen');
  title.innerHTML =
    '<div class="title-inner">' +
      '<div class="title-logo" data-i18n="title.logo"></div>' +
      '<div class="title-sub" data-i18n="title.sub"></div>' +
      '<div class="title-tagline" data-i18n="title.tagline"></div>' +
      '<div class="title-best" id="title-best"></div>' +
      '<div class="title-forge" id="title-forge"></div>' +
      '<div class="title-actions">' +
        '<button id="btn-start" class="btn btn-primary" type="button" data-i18n="btn.forge" data-i18n-aria="btn.forge"></button>' +
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
      '<div class="result-title" id="result-title" data-i18n="result.title"></div>' +
      '<div class="result-badge hidden" id="result-new-record" data-i18n="result.newRecord"></div>' +
      '<ul class="result-rows">' +
        '<li><span data-i18n="result.score"></span><b id="res-score">0</b></li>' +
        '<li><span data-i18n="result.level"></span><b id="res-level">1</b></li>' +
        '<li><span data-i18n="result.maxCombo"></span><b id="res-maxcombo">0</b></li>' +
        '<li><span data-i18n="result.weapons"></span><b id="res-weapons">0</b></li>' +
        '<li><span data-i18n="result.best"></span><b id="res-best">0</b></li>' +
      '</ul>' +
      '<div class="result-actions">' +
        '<button id="btn-again" class="btn btn-primary" type="button" data-i18n="btn.restart"></button>' +
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
      '<label class="settings-row"><span data-i18n="set.mute"></span>' +
        '<button id="btn-mute" class="btn btn-ghost" type="button"></button>' +
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
    btnAgain: result.querySelector('#btn-again'),
    btnShare: result.querySelector('#btn-share'),
    btnSettingsBack: settings.querySelector('#btn-settings-back'),
    btnMute: settings.querySelector('#btn-mute'),
    titleBest: title.querySelector('#title-best'),
    titleForge: title.querySelector('#title-forge'),
    newRecordBadge: result.querySelector('#result-new-record'),
    resScore: result.querySelector('#res-score'),
    resLevel: result.querySelector('#res-level'),
    resMaxCombo: result.querySelector('#res-maxcombo'),
    resWeapons: result.querySelector('#res-weapons'),
    resBest: result.querySelector('#res-best'),
    resTitle: result.querySelector('#result-title'),
    resHint: result.querySelector('#result-hint'),
  };

  function setBest(best) {
    els.titleBest.textContent = t('title.best', { score: Math.max(0, Math.floor(best ?? 0)) });
  }

  function setForge(n) {
    els.titleForge.textContent = t('title.forge', { n: Math.max(0, Math.floor(n ?? 0)) });
  }

  function renderResult(data) {
    data = data || {};
    const won = !!data.won;
    els.resTitle.textContent = won ? t('result.winTitle') : t('result.title');
    els.resScore.textContent = String(Math.max(0, Math.floor(data.score ?? 0)));
    els.resLevel.textContent = String(Math.max(1, Math.floor(data.level ?? 1)));
    els.resMaxCombo.textContent = String(Math.max(0, Math.floor(data.maxCombo ?? 0)));
    els.resWeapons.textContent = String(Math.max(0, Math.floor(data.weapons ?? 0)));
    els.resBest.textContent = String(Math.max(0, Math.floor(data.best ?? 0)));
    els.newRecordBadge.classList.toggle('hidden', !data.newRecord);
    els.resHint.textContent = won ? t('result.winHint') : t('result.hint');
  }

  return { els, setBest, setForge, renderResult };
}
