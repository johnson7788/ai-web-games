// src/ui/screens.js — 标题 / 暂停 / 结算 / 波间强化 / 设置。
// 只负责搭 DOM 与填数；所有可见文案走 data-i18n，由 index.js 统一 applyLang。
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
      '<div class="result-title" id="result-title" data-i18n="result.title"></div>' +
      '<div class="result-badge hidden" id="result-new-record" data-i18n="result.newRecord"></div>' +
      '<ul class="result-rows">' +
        '<li><span data-i18n="result.wave"></span><b id="res-wave">1</b></li>' +
        '<li><span data-i18n="result.score"></span><b id="res-score">0</b></li>' +
        '<li><span data-i18n="result.kills"></span><b id="res-kills">0</b></li>' +
        '<li><span data-i18n="result.best"></span><b id="res-best">1</b></li>' +
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

  const upgrade = getOrCreate(root, 'screen-upgrade', 'screen hidden');
  upgrade.innerHTML =
    '<div class="upgrade-inner">' +
      '<h2 class="upgrade-title" data-i18n="up.title"></h2>' +
      '<div class="upgrade-actions">' +
        '<button id="btn-upgrade-0" class="btn btn-primary" type="button"></button>' +
        '<button id="btn-upgrade-1" class="btn btn-primary" type="button"></button>' +
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
    btnMute: settings.querySelector('#btn-mute'),
    btnSettingsBack: settings.querySelector('#btn-settings-back'),
    btnUpgrade0: upgrade.querySelector('#btn-upgrade-0'),
    btnUpgrade1: upgrade.querySelector('#btn-upgrade-1'),
    titleBest: title.querySelector('#title-best'),
    resultTitle: result.querySelector('#result-title'),
    resultHint: result.querySelector('#result-hint'),
    newRecordBadge: result.querySelector('#result-new-record'),
    resWave: result.querySelector('#res-wave'),
    resScore: result.querySelector('#res-score'),
    resKills: result.querySelector('#res-kills'),
    resBest: result.querySelector('#res-best'),
  };

  function setBest(bestWave) {
    els.titleBest.textContent = t('title.best', { wave: Math.max(1, Math.floor(bestWave ?? 1)) });
  }

  function renderResult(data) {
    data = data || {};
    const wave = Math.max(1, Math.floor(data.wave ?? 1));
    const score = Math.max(0, Math.floor(data.score ?? 0));
    const kills = Math.max(0, Math.floor(data.kills ?? 0));
    const best = Math.max(1, Math.floor(data.best ?? 1));
    els.resultTitle.textContent = t(data.win ? 'result.winTitle' : 'result.title');
    els.resultHint.textContent = t(data.win ? 'result.winHint' : 'result.hint');
    els.resWave.textContent = String(wave);
    els.resScore.textContent = String(score);
    els.resKills.textContent = String(kills);
    els.resBest.textContent = String(best);
    els.newRecordBadge.classList.toggle('hidden', !data.newRecord);
  }

  function renderUpgrade(options) {
    options = options || [];
    els.btnUpgrade0.textContent = t(options[0] ? options[0].key : 'up.firepower');
    els.btnUpgrade1.textContent = t(options[1] ? options[1].key : 'up.speed');
  }

  function setMuted(muted) {
    els.btnMute.textContent = muted ? '🔇' : '🔊';
    els.btnMute.setAttribute('aria-pressed', String(!!muted));
  }

  return { els, setBest, renderResult, renderUpgrade, setMuted };
}
