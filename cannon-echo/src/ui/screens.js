// src/ui/screens.js — 标题 / 暂停 / 结算 / 升级三选一 / Boss 血条 / 设置。
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
        '<button id="btn-start" class="btn btn-primary" type="button" data-i18n="btn.start" data-i18n-aria="btn.start"></button>' +
        '<button id="btn-how" class="btn btn-ghost" type="button" data-tutorial-replay data-i18n="btn.how"></button>' +
        '<button id="btn-settings" class="btn btn-ghost" type="button" data-i18n="btn.settings" data-i18n-aria="btn.settings"></button>' +
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
    LANG_SELECT_HTML;

  // ---- 结算卡 ----
  const result = getOrCreate(root, 'screen-result', 'screen hidden');
  result.innerHTML =
    '<div class="result-inner">' +
      '<div class="result-title" id="result-title" data-i18n="result.title"></div>' +
      '<div class="result-badge hidden" id="result-new-record" data-i18n="result.newRecord"></div>' +
      '<ul class="result-rows">' +
        '<li><span data-i18n="result.score"></span><b id="res-score">0</b></li>' +
        '<li><span data-i18n="result.wave"></span><b id="res-wave">0</b></li>' +
        '<li><span data-i18n="result.best"></span><b id="res-best">0</b></li>' +
      '</ul>' +
      '<div class="result-actions">' +
        '<button id="btn-again" class="btn btn-primary" type="button" data-i18n="btn.restart"></button>' +
        '<button id="btn-share" class="btn btn-ghost" type="button" data-i18n="btn.share"></button>' +
      '</div>' +
      '<div class="result-hint" data-i18n="result.hint"></div>' +
    '</div>';

  // ---- 升级三选一 ----
  const upgrade = getOrCreate(root, 'screen-upgrade', 'screen hidden');
  upgrade.innerHTML =
    '<div class="upgrade-inner">' +
      '<div class="upgrade-title" data-i18n="upgrade.title"></div>' +
      '<div class="upgrade-cards">' +
        '<button class="upg-card" id="upg-0" type="button"></button>' +
        '<button class="upg-card" id="upg-1" type="button"></button>' +
        '<button class="upg-card" id="upg-2" type="button"></button>' +
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

  // ---- Boss 血条 ----
  const boss = el('div', 'boss-bar hidden', '');
  boss.id = 'boss-bar';
  boss.innerHTML =
    '<div class="boss-name" data-i18n="boss.name"></div>' +
    '<div class="boss-track"><i class="boss-fill" id="boss-fill"></i></div>';
  root.appendChild(boss);

  const els = {
    title, pause, result, upgrade, settings, boss,
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
    titleBest: title.querySelector('#title-best'),
    resultTitle: result.querySelector('#result-title'),
    newRecordBadge: result.querySelector('#result-new-record'),
    resScore: result.querySelector('#res-score'),
    resWave: result.querySelector('#res-wave'),
    resBest: result.querySelector('#res-best'),
    bossFill: boss.querySelector('#boss-fill'),
    upgCards: [upgrade.querySelector('#upg-0'), upgrade.querySelector('#upg-1'), upgrade.querySelector('#upg-2')],
  };

  function setBest(score) {
    els.titleBest.textContent = t('title.best', { score: Math.max(0, Math.floor(score ?? 0)) });
  }

  function renderResult(data) {
    data = data || {};
    const score = Math.max(0, Math.floor(data.score ?? 0));
    const wave = Math.max(0, Math.floor(data.wave ?? 0));
    const best = Math.max(0, Math.floor(data.best ?? 0));
    els.resultTitle.textContent = t(data.won ? 'result.winTitle' : 'result.title');
    els.resScore.textContent = String(score);
    els.resWave.textContent = String(wave);
    els.resBest.textContent = String(best);
    els.newRecordBadge.classList.toggle('hidden', !data.newRecord);
  }

  function renderBoss(h) {
    h = h || {};
    const max = Number(h.bossMax) || 0;
    const hp = Math.max(0, Number(h.bossHp) || 0);
    const visible = max > 0;
    els.boss.classList.toggle('hidden', !visible);
    if (visible) els.bossFill.style.width = Math.min(100, (hp / max) * 100).toFixed(1) + '%';
  }

  function renderUpgrade(choices) {
    choices = choices || [];
    els.upgCards.forEach((card, i) => {
      const id = choices[i];
      if (!id) {
        card.classList.add('hidden');
        return;
      }
      card.classList.remove('hidden');
      card.innerHTML = '<b data-i18n="upgrade.' + id + '.name"></b>' +
        '<span data-i18n="upgrade.' + id + '.desc"></span>';
    });
  }

  return {
    els,
    setBest,
    renderResult,
    renderBoss,
    renderUpgrade,
  };
}
