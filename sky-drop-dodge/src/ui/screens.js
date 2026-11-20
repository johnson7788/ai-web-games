// src/ui/screens.js — 标题 / 暂停 / 结算 / 设置。
// 只负责搭 DOM 与填数；文案走 data-i18n，由 index.js 统一 applyLang；事件由 main 注册。
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
        '<button id="btn-settings" class="btn btn-ghost" type="button" data-i18n="btn.settings" data-i18n-aria="btn.settings"></button>' +
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
        '<li><span data-i18n="result.wave"></span><b id="res-wave">0</b></li>' +
        '<li><span data-i18n="result.style"></span><b id="res-style">0</b></li>' +
        '<li><span data-i18n="result.grade"></span><b id="res-grade">D</b></li>' +
        '<li><span data-i18n="result.best"></span><b id="res-best">—</b></li>' +
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

  const els = {
    title, pause, result, settings,
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
    resWave: result.querySelector('#res-wave'),
    resStyle: result.querySelector('#res-style'),
    resGrade: result.querySelector('#res-grade'),
    resBest: result.querySelector('#res-best'),
  };

  function setBest(bestWave, bestGrade) {
    els.titleBest.textContent = t('title.best', {
      wave: Math.max(0, Math.floor(bestWave ?? 0)),
      grade: bestGrade || 'D',
    });
  }

  function renderResult(data) {
    data = data || {};
    const wave = Math.max(0, Math.floor(data.wave ?? 0));
    const style = Math.max(0, Math.floor(data.style ?? 0));
    const grade = data.grade || 'D';
    const won = !!data.won;
    els.resultTitle.textContent = t(won ? 'result.winTitle' : 'result.title');
    els.resWave.textContent = String(wave);
    els.resStyle.textContent = String(style);
    els.resGrade.textContent = grade;
    els.resBest.textContent = data.bestWave != null ? `${Math.floor(data.bestWave)} · ${data.bestGrade || 'D'}` : '—';
    els.newRecordBadge.classList.toggle('hidden', !data.newRecord);
  }

  return { els, setBest, renderResult };
}
