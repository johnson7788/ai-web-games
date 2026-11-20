// src/ui/screens.js — 标题 / 暂停 / 死亡结算 / 通关 / 设置 / 环间升级。
// 只搭 DOM 与填数；可见文案走 data-i18n，由 index.js 统一 applyLang。
// 事件由 main 通过返回的 els 直接 addEventListener。
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
        '<button id="btn-start" class="btn btn-primary" type="button" data-i18n="btn.start" data-i18n-aria="btn.start"></button>' +
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

  // ---- 死亡结算 ----
  const result = getOrCreate(root, 'screen-result', 'screen hidden');
  result.innerHTML =
    '<div class="result-inner">' +
      '<div class="result-title" data-i18n="result.title"></div>' +
      '<div class="result-badge hidden" id="result-new-record" data-i18n="result.newRecord"></div>' +
      '<ul class="result-rows">' +
        '<li><span data-i18n="result.score"></span><b id="res-score">0</b></li>' +
        '<li><span data-i18n="result.ring"></span><b id="res-ring">1</b></li>' +
        '<li><span data-i18n="result.best"></span><b id="res-best">0</b></li>' +
      '</ul>' +
      '<div class="result-actions">' +
        '<button id="btn-again" class="btn btn-primary" type="button" data-i18n="btn.restart"></button>' +
        '<button id="btn-share" class="btn btn-ghost" type="button" data-i18n="btn.share"></button>' +
      '</div>' +
      '<div class="result-hint" data-i18n="result.hint"></div>' +
    '</div>';

  // ---- 通关 ----
  const win = getOrCreate(root, 'screen-win', 'screen hidden');
  win.innerHTML =
    '<div class="result-inner">' +
      '<div class="result-title win-title" data-i18n="win.title"></div>' +
      '<ul class="result-rows">' +
        '<li><span data-i18n="win.ring"></span><b>12/12</b></li>' +
        '<li><span data-i18n="win.score"></span><b id="win-score">0</b></li>' +
      '</ul>' +
      '<div class="result-actions">' +
        '<button id="btn-win-again" class="btn btn-primary" type="button" data-i18n="btn.restart"></button>' +
      '</div>' +
      '<div class="result-hint" data-i18n="win.hint"></div>' +
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

  // ---- 环间升级 ----
  const upgrade = getOrCreate(root, 'screen-upgrade', 'screen hidden');
  upgrade.innerHTML =
    '<div class="upgrade-inner">' +
      '<h2 class="upgrade-title" data-i18n="up.title"></h2>' +
      '<div class="upgrade-sub" data-i18n="up.pick"></div>' +
      '<div class="upgrade-cards" id="upgrade-cards"></div>' +
    '</div>';

  const els = {
    title, pause, result, win, settings, upgrade,
    langSelects: [
      title.querySelector('.lang-select'),
      pause.querySelector('.lang-select'),
      settings.querySelector('#lang-select-settings'),
    ].filter(Boolean),
    btnStart: title.querySelector('#btn-start'),
    btnHow: title.querySelector('#btn-how'),
    btnSettings: title.querySelector('#btn-settings'),
    btnResume: pause.querySelector('#btn-resume'),
    btnRestart: pause.querySelector('#btn-restart'),
    btnHowPause: pause.querySelector('#btn-how-pause'),
    btnAgain: result.querySelector('#btn-again'),
    btnShare: result.querySelector('#btn-share'),
    btnWinAgain: win.querySelector('#btn-win-again'),
    btnSettingsBack: settings.querySelector('#btn-settings-back'),
    titleBest: title.querySelector('#title-best'),
    newRecordBadge: result.querySelector('#result-new-record'),
    resScore: result.querySelector('#res-score'),
    resRing: result.querySelector('#res-ring'),
    resBest: result.querySelector('#res-best'),
    winScore: win.querySelector('#win-score'),
    upgradeCards: upgrade.querySelector('#upgrade-cards'),
  };

  function setBest(best) {
    els.titleBest.textContent = t('title.best', { score: Math.max(0, Math.floor(best ?? 0)) });
  }

  function renderResult(data) {
    data = data || {};
    const score = Math.max(0, Math.floor(data.score ?? 0));
    const ring = Math.max(1, Math.floor(data.ring ?? 1));
    const best = Math.max(0, Math.floor(data.best ?? 0));
    els.resScore.textContent = String(score);
    els.resRing.textContent = String(ring);
    els.resBest.textContent = String(best);
    els.newRecordBadge.classList.toggle('hidden', !data.newRecord);
  }

  function renderWin(data) {
    data = data || {};
    els.winScore.textContent = String(Math.max(0, Math.floor(data.score ?? 0)));
  }

  function renderUpgrades(options) {
    els.upgradeCards.innerHTML = '';
    for (const up of options) {
      const card = el('button', 'upgrade-card', '');
      card.type = 'button';
      card.dataset.upgradeId = up.id;
      const kind = el('span', 'upgrade-kind', up.kind === 'rule' ? 'RULE' : 'STAT');
      const name = el('span', 'upgrade-name', '');
      name.setAttribute('data-i18n', up.key);
      const desc = el('span', 'upgrade-desc', up.desc);
      card.appendChild(kind);
      card.appendChild(name);
      card.appendChild(desc);
      els.upgradeCards.appendChild(card);
    }
  }

  return {
    els,
    setBest,
    renderResult,
    renderWin,
    renderUpgrades,
  };
}
