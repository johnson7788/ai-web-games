// src/ui/screens.js — 标题 / 暂停 / 结算卡 / 设置 / 奖励轮盘。
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
      '<div class="result-title" id="result-title" data-i18n="result.title"></div>' +
      '<div class="result-badge hidden" id="result-new-record" data-i18n="result.newRecord"></div>' +
      '<ul class="result-rows">' +
        '<li><span data-i18n="result.score"></span><b id="res-score">0</b></li>' +
        '<li><span data-i18n="result.maxCombo"></span><b id="res-maxcombo">0</b></li>' +
        '<li><span data-i18n="result.level"></span><b id="res-level">1</b></li>' +
        '<li><span data-i18n="result.best"></span><b id="res-best">0</b></li>' +
      '</ul>' +
      '<div class="result-sub" id="result-sub"></div>' +
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
      '<button id="btn-settings-back" class="btn btn-ghost" type="button" data-i18n="btn.back"></button>' +
    '</div>';

  // ---- 奖励轮盘（命中红灯鸭时短暂出现，纯视觉揭示）----
  const wheel = getOrCreate(root, 'wheel', 'wheel hidden');
  wheel.innerHTML =
    '<div class="wheel-inner">' +
      '<div class="wheel-title" data-i18n="wheel.title"></div>' +
      '<div class="wheel-result" id="wheel-result"></div>' +
    '</div>';

  const els = {
    title, pause, result, settings, wheel,
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
    resScore: result.querySelector('#res-score'),
    resMaxCombo: result.querySelector('#res-maxcombo'),
    resLevel: result.querySelector('#res-level'),
    resBest: result.querySelector('#res-best'),
    resultSub: result.querySelector('#result-sub'),
    wheelResult: wheel.querySelector('#wheel-result'),
  };

  function setBest(score, level) {
    const s = Math.max(0, Math.floor(score ?? 0));
    els.titleBest.textContent = t('title.best', { score: s });
    if (level != null && level > 1) {
      els.titleBest.textContent += ' · ' + t('title.level', { level });
    }
  }

  function renderResult(data) {
    data = data || {};
    const score = Math.max(0, Math.floor(data.score ?? 0));
    const maxCombo = Math.max(0, Math.floor(data.maxCombo ?? 0));
    const level = Math.max(1, Math.floor(data.levelReached ?? data.level ?? 1));
    const best = Math.max(0, Math.floor(data.best ?? 0));
    els.resultTitle.textContent = data.win ? t('result.winTitle') : t('result.title');
    els.resScore.textContent = String(score);
    els.resMaxCombo.textContent = String(maxCombo);
    els.resLevel.textContent = String(level);
    els.resBest.textContent = String(best);
    els.newRecordBadge.classList.toggle('hidden', !data.newRecord);
    if (data.win) els.resultSub.textContent = '';
    else if (data.need != null) els.resultSub.textContent = t('result.missed', { need: Math.max(0, data.need) });
    else els.resultSub.textContent = '';
  }

  function showWheel(kind) {
    const key = kind === 'double' ? 'wheel.double' : kind === 'addTime' ? 'wheel.addTime' : 'wheel.fullAmmo';
    els.wheelResult.textContent = t(key);
    els.wheel.classList.remove('hidden');
  }
  function hideWheel() { els.wheel.classList.add('hidden'); }

  return { els, setBest, renderResult, showWheel, hideWheel };
}
