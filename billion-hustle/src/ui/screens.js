// src/ui/screens.js — 标题 / 暂停 / 设置 / 达成结算 / 融资翻牌卡。
// 只搭 DOM 与填数；所有可见文案走 data-i18n，由 index.js 统一 applyLang。
import { t } from '../core/i18n.js';
import { formatMoney } from '../game/sim.js';

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

const LANG_SELECT_HTML = '<select class="lang-select" aria-label=""></select>';

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
    LANG_SELECT_HTML.replace('class="lang-select"', 'id="lang-select" class="lang-select"');

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
    LANG_SELECT_HTML.replace('class="lang-select"', 'id="lang-select-pause" class="lang-select"');

  // ---- 设置 ----
  const settings = getOrCreate(root, 'screen-settings', 'screen hidden');
  settings.innerHTML =
    '<div class="settings-inner">' +
      '<h2 class="settings-title" data-i18n="set.title"></h2>' +
      '<label class="settings-row"><span data-i18n="set.language"></span>' +
        '<select id="lang-select-settings" class="lang-select" aria-label=""></select>' +
      '</label>' +
      '<button id="btn-mute" class="btn btn-ghost" type="button" data-i18n="set.mute"></button>' +
      '<button id="btn-settings-back" class="btn btn-ghost" type="button" data-i18n="btn.back"></button>' +
    '</div>';

  // ---- 达成结算（独角兽） ----
  const result = getOrCreate(root, 'screen-result', 'screen hidden');
  result.innerHTML =
    '<div class="result-inner">' +
      '<div class="result-title" data-i18n="result.title"></div>' +
      '<div class="result-subtitle" data-i18n="result.subtitle"></div>' +
      '<ul class="result-rows">' +
        '<li><span data-i18n="result.valuation"></span><b id="res-valuation">¥0</b></li>' +
        '<li><span data-i18n="result.income"></span><b id="res-income">¥0</b></li>' +
        '<li><span data-i18n="result.clicks"></span><b id="res-clicks">0</b></li>' +
      '</ul>' +
      '<div class="result-actions">' +
        '<button id="btn-again" class="btn btn-primary" type="button" data-i18n="won.again"></button>' +
        '<button id="btn-share" class="btn btn-ghost" type="button" data-i18n="btn.share"></button>' +
      '</div>' +
      '<div class="result-hint" data-i18n="result.hint"></div>' +
    '</div>';

  // ---- 融资翻牌卡（签名记忆点：估值翻牌数字翻滚） ----
  const fund = el('div', 'fund-card hidden', '');
  fund.id = 'fund-card';
  fund.innerHTML =
    '<div class="fund-flip">' +
      '<div class="fund-front">' +
        '<div class="fund-kicker" data-i18n="fund.card"></div>' +
        '<div class="fund-round" id="fund-round"></div>' +
        '<div class="fund-valuation" id="fund-valuation">¥0</div>' +
      '</div>' +
    '</div>';
  root.appendChild(fund);

  const els = {
    title, pause, settings, result, fund,
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
    btnMute: settings.querySelector('#btn-mute'),
    btnSettingsBack: settings.querySelector('#btn-settings-back'),
    btnAgain: result.querySelector('#btn-again'),
    btnShare: result.querySelector('#btn-share'),
    titleBest: title.querySelector('#title-best'),
    resValuation: result.querySelector('#res-valuation'),
    resIncome: result.querySelector('#res-income'),
    resClicks: result.querySelector('#res-clicks'),
    fundRound: fund.querySelector('#fund-round'),
    fundValuation: fund.querySelector('#fund-valuation'),
  };

  function setBest(best) {
    els.titleBest.textContent = t('title.best', { valuation: formatMoney(best ?? 0) });
  }

  function renderResult(data) {
    data = data || {};
    els.resValuation.textContent = '¥' + formatMoney(data.valuation ?? 0);
    els.resIncome.textContent = '¥' + formatMoney(data.income ?? 0);
    els.resClicks.textContent = String(Math.floor(data.clicks ?? 0));
  }

  function showFunding(data) {
    data = data || {};
    els.fundRound.textContent = t('fund.into', { round: t('round.' + (data.key || 'seed')) });
    els.fundValuation.textContent = '¥' + formatMoney(data.valuation ?? 0);
    fund.classList.remove('hidden');
  }

  function hideFunding() {
    fund.classList.add('hidden');
  }

  return {
    els,
    setBest,
    renderResult,
    showFunding,
    hideFunding,
  };
}
