// src/ui/screens.js — 标题 / 暂停 / 结算（破产）/ 设置。只搭 DOM + 填数，文案走 data-i18n。
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

const LANG_SELECT_HTML = '<select id="lang-select" class="lang-select" aria-label=""></select>';
const LANG_SELECT_PAUSE_HTML = '<select id="lang-select-pause" class="lang-select" aria-label=""></select>';

export function createScreens(root) {
  const title = getOrCreate(root, 'screen-title', 'screen');
  title.innerHTML =
    '<div class="title-inner">' +
      '<div class="title-logo" data-i18n="title.logo"></div>' +
      '<div class="title-tagline" data-i18n="title.tagline"></div>' +
      '<div class="title-best" id="title-best"></div>' +
      '<div class="title-level" id="title-level"></div>' +
      '<div class="title-actions">' +
        '<button id="btn-start" class="btn btn-primary" type="button" data-i18n="btn.play" data-i18n-aria="btn.play"></button>' +
        '<button id="btn-how" class="btn btn-ghost" type="button" data-tutorial-replay data-i18n="btn.how"></button>' +
        '<button id="btn-settings" class="btn btn-ghost" type="button" data-i18n="btn.settings"></button>' +
      '</div>' +
      '<div class="note-fun" data-i18n="note.fun"></div>' +
    '</div>' +
    LANG_SELECT_HTML;

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
    LANG_SELECT_PAUSE_HTML;

  const result = getOrCreate(root, 'screen-result', 'screen hidden');
  result.innerHTML =
    '<div class="result-inner">' +
      '<div class="result-title" data-i18n="result.title"></div>' +
      '<div class="result-badge hidden" id="result-new-record" data-i18n="result.newRecord"></div>' +
      '<ul class="result-rows">' +
        '<li><span data-i18n="result.level"></span><b id="res-level">1</b></li>' +
        '<li><span data-i18n="result.biggestWin"></span><b id="res-bigwin">0</b></li>' +
        '<li><span data-i18n="result.jackpots"></span><b id="res-jackpots">0</b></li>' +
        '<li><span data-i18n="result.spins"></span><b id="res-spins">0</b></li>' +
        '<li><span data-i18n="hud.balance"></span><b id="res-balance">0</b></li>' +
      '</ul>' +
      '<div class="result-actions">' +
        '<button id="btn-again" class="btn btn-primary" type="button" data-i18n="btn.again"></button>' +
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
      '<button id="btn-mute" class="btn btn-ghost" type="button"></button>' +
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
    titleLevel: title.querySelector('#title-level'),
    newRecordBadge: result.querySelector('#result-new-record'),
    resLevel: result.querySelector('#res-level'),
    resBigwin: result.querySelector('#res-bigwin'),
    resJackpots: result.querySelector('#res-jackpots'),
    resSpins: result.querySelector('#res-spins'),
    resBalance: result.querySelector('#res-balance'),
  };

  function setBest(best) {
    els.titleBest.textContent = t('title.best', { bal: Math.max(0, Math.floor(best ?? 0)) });
  }

  function setTitleLevel(level) {
    els.titleLevel.textContent = t('title.level', { level: Math.max(1, Math.floor(level ?? 1)) });
  }

  function renderResult(data) {
    data = data || {};
    els.resLevel.textContent = String(Math.max(1, Math.floor(data.level ?? 1)));
    els.resBigwin.textContent = String(Math.max(0, Math.floor(data.biggestWin ?? 0)));
    els.resJackpots.textContent = String(Math.max(0, Math.floor(data.jackpots ?? 0)));
    els.resSpins.textContent = String(Math.max(0, Math.floor(data.spins ?? 0)));
    els.resBalance.textContent = String(Math.max(0, Math.floor(data.balance ?? 0)));
    els.newRecordBadge.classList.toggle('hidden', !data.newRecord);
  }

  function setMuteLabel(muted) {
    els.btnMute.textContent = muted ? t('set.mute.on') : t('set.mute.off');
  }

  return { els, setBest, setTitleLevel, renderResult, setMuteLabel };
}
