// src/ui/screens.js — 标题 / 机台选择 / 暂停 / 结算 / 打烊 / GRAND PRIX / 设置。
// 只负责搭 DOM 与填数；可见文案走 data-i18n，由 index.js 统一 applyLang。
import { t } from '../core/i18n.js';

function getOrCreate(root, id, className) {
  let n = root.querySelector('#' + id);
  if (!n) { n = document.createElement('div'); n.id = id; root.appendChild(n); }
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
    '</div>' + '<select id="lang-select" class="lang-select" aria-label=""></select>';

  // ---- 机台选择（覆盖层：三台街机透明按钮 + 底部铭牌 + 提示） ----
  const hall = getOrCreate(root, 'screen-hall', 'hall-overlay hidden');
  hall.innerHTML =
    '<div class="hall-hint" data-i18n="hud.hallHint"></div>' +
    '<div class="hall-cabs">' +
      '<button id="cab-0" class="cab-btn" type="button" aria-label=""></button>' +
      '<button id="cab-1" class="cab-btn" type="button" aria-label=""></button>' +
      '<button id="cab-2" class="cab-btn" type="button" aria-label=""></button>' +
    '</div>' +
    '<div class="hall-caps">' +
      '<div class="cab-cap"><span class="cab-name" data-i18n="machine.0"></span><span class="cab-desc" data-i18n="machine.0.desc"></span></div>' +
      '<div class="cab-cap"><span class="cab-name" data-i18n="machine.1"></span><span class="cab-desc" data-i18n="machine.1.desc"></span></div>' +
      '<div class="cab-cap"><span class="cab-name" data-i18n="machine.2"></span><span class="cab-desc" data-i18n="machine.2.desc"></span></div>' +
    '</div>';

  // ---- 暂停 ----
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
    '</div>' + '<select id="lang-select-pause" class="lang-select" aria-label=""></select>';

  // ---- 机台结算 ----
  const result = getOrCreate(root, 'screen-result', 'screen hidden');
  result.innerHTML =
    '<div class="result-inner">' +
      '<div class="result-title" data-i18n="result.title"></div>' +
      '<div class="result-badge hidden" id="result-cleared"></div>' +
      '<ul class="result-rows">' +
        '<li><span data-i18n="result.score"></span><b id="res-score">0</b></li>' +
        '<li><span data-i18n="result.target"></span><b id="res-target">0</b></li>' +
        '<li><span data-i18n="result.tokens"></span><b id="res-tokens">0</b></li>' +
        '<li><span data-i18n="result.rank"></span><b id="res-rank">1</b></li>' +
      '</ul>' +
      '<div class="result-actions">' +
        '<button id="btn-continue" class="btn btn-primary" type="button" data-i18n="btn.back"></button>' +
      '</div>' +
      '<div class="result-hint" data-i18n="result.hint"></div>' +
    '</div>';

  // ---- 打烊 / 币尽 ----
  const gameover = getOrCreate(root, 'screen-gameover', 'screen hidden');
  gameover.innerHTML =
    '<div class="result-inner">' +
      '<div class="result-title" id="over-title" data-i18n="over.title"></div>' +
      '<div class="over-desc" data-i18n="over.desc"></div>' +
      '<div class="result-actions">' +
        '<button id="btn-pity" class="btn btn-primary" type="button" data-i18n="over.hint"></button>' +
        '<button id="btn-over-back" class="btn btn-ghost" type="button" data-i18n="over.back"></button>' +
      '</div>' +
    '</div>';

  // ---- GRAND PRIX ----
  const grandprix = getOrCreate(root, 'screen-grandprix', 'screen hidden');
  grandprix.innerHTML =
    '<div class="result-inner">' +
      '<div class="grand-title" data-i18n="grand.title"></div>' +
      '<div class="over-desc" data-i18n="grand.desc"></div>' +
      '<div class="result-actions">' +
        '<button id="btn-grand-back" class="btn btn-primary" type="button" data-i18n="grand.back"></button>' +
      '</div>' +
    '</div>';

  // ---- 设置 ----
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
    title, hall, pause, result, gameover, grandprix, settings,
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
    btnContinue: result.querySelector('#btn-continue'),
    btnPity: gameover.querySelector('#btn-pity'),
    btnOverBack: gameover.querySelector('#btn-over-back'),
    btnGrandBack: grandprix.querySelector('#btn-grand-back'),
    btnSettingsBack: settings.querySelector('#btn-settings-back'),
    cabs: [hall.querySelector('#cab-0'), hall.querySelector('#cab-1'), hall.querySelector('#cab-2')],
    titleBest: title.querySelector('#title-best'),
    resScore: result.querySelector('#res-score'),
    resTarget: result.querySelector('#res-target'),
    resTokens: result.querySelector('#res-tokens'),
    resRank: result.querySelector('#res-rank'),
    resultCleared: result.querySelector('#result-cleared'),
    overTitle: gameover.querySelector('#over-title'),
  };

  function setBest(bestRank) {
    els.titleBest.textContent = t('title.best', { rank: Math.max(1, Math.floor(bestRank ?? 1)) });
  }

  function renderResult(data) {
    data = data || {};
    els.resScore.textContent = String(Math.max(0, Math.floor(data.score ?? 0)));
    els.resTarget.textContent = String(Math.max(0, Math.floor(data.target ?? 0)));
    els.resTokens.textContent = '+' + String(Math.max(0, Math.floor(data.tokens ?? 0)));
    els.resRank.textContent = String(Math.max(1, Math.floor(data.rank ?? 1)));
    const cleared = !!data.cleared;
    els.resultCleared.classList.toggle('hidden', !cleared);
    els.resultCleared.textContent = t(cleared ? 'result.cleared' : 'result.missed');
  }

  function renderGameover(outOfTokens) {
    els.overTitle.textContent = t(outOfTokens ? 'over.out' : 'over.title');
  }

  return { els, setBest, renderResult, renderGameover };
}
