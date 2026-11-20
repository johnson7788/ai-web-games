// src/ui/screens.js — 标题 / 暂停 / 结算 / 设置。
// 只负责搭 DOM 与填数；所有可见文案走 data-i18n，由 index.js 统一 applyLang。
// 事件由 main 注册（通过返回的 els 直接 addEventListener）。
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

const LANG_SELECT_HTML = '<select class="lang-select" aria-label=""></select>';
const TITLE_LANG_SELECT_HTML = '<select id="lang-select" class="lang-select" aria-label=""></select>';

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
        '<button id="btn-settings" class="btn btn-ghost" type="button" data-i18n="btn.settings" data-i18n-aria="btn.settings"></button>' +
      '</div>' +
    '</div>' +
    TITLE_LANG_SELECT_HTML;

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
      '<div class="result-title" data-i18n="result.title"></div>' +
      '<div class="result-badge hidden" id="result-new-record" data-i18n="result.newRecord"></div>' +
      '<ul class="result-rows">' +
        '<li><span data-i18n="result.distance"></span><b id="res-distance">0m</b></li>' +
        '<li><span data-i18n="result.score"></span><b id="res-score">0</b></li>' +
        '<li><span data-i18n="result.flock"></span><b id="res-flock">0</b></li>' +
        '<li><span data-i18n="result.segment"></span><b id="res-segment"></b></li>' +
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
      '<div class="settings-row"><span data-i18n="set.mute"></span>' +
        '<button id="btn-mute" class="btn btn-ghost toggle" type="button" aria-pressed="false">' +
        '<span id="mute-state">OFF</span></button>' +
      '</div>' +
      '<div class="settings-row"><span data-i18n="set.shake"></span>' +
        '<button id="btn-shake" class="btn btn-ghost toggle" type="button" aria-pressed="true">' +
        '<span id="shake-state">ON</span></button>' +
      '</div>' +
      '<button id="btn-settings-back" class="btn btn-ghost" type="button" data-i18n="set.back"></button>' +
    '</div>';

  const els = {
    title, pause, result, settings,
    langSelects: [
      title.querySelector('.lang-select'),
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
    btnMute: settings.querySelector('#btn-mute'),
    btnShake: settings.querySelector('#btn-shake'),
    muteState: settings.querySelector('#mute-state'),
    shakeState: settings.querySelector('#shake-state'),
    titleBest: title.querySelector('#title-best'),
    newRecordBadge: result.querySelector('#result-new-record'),
    resDistance: result.querySelector('#res-distance'),
    resScore: result.querySelector('#res-score'),
    resFlock: result.querySelector('#res-flock'),
    resSegment: result.querySelector('#res-segment'),
    resBest: result.querySelector('#res-best'),
  };

  function segmentLabel(seg) {
    const key = 'seg.' + seg;
    const text = t(key);
    return text !== key ? text : String(seg);
  }

  function setBest(best) {
    els.titleBest.textContent = t('title.best', { score: Math.max(0, Math.floor(best ?? 0)) });
  }

  function renderResult(data) {
    data = data || {};
    const distance = Math.max(0, Math.floor(data.distance ?? 0));
    const score = Math.max(0, Math.floor(data.score ?? 0));
    const flock = Math.max(0, Math.floor(data.flock ?? 0));
    const segment = Number(data.segmentReached) || 1;
    const best = Math.max(0, Math.floor(data.best ?? 0));
    els.resDistance.textContent = distance + 'm';
    els.resScore.textContent = String(score);
    els.resFlock.textContent = String(flock);
    els.resSegment.textContent = segmentLabel(segment);
    els.resBest.textContent = String(best);
    els.newRecordBadge.classList.toggle('hidden', !data.newRecord);
  }

  function renderSettings(muted, shake) {
    els.muteState.textContent = muted ? 'ON' : 'OFF';
    els.shakeState.textContent = shake ? 'ON' : 'OFF';
    els.btnMute.setAttribute('aria-pressed', muted ? 'true' : 'false');
    els.btnShake.setAttribute('aria-pressed', shake ? 'true' : 'false');
  }

  return { els, setBest, renderResult, renderSettings };
}
