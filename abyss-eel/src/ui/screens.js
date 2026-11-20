// src/ui/screens.js — 标题 / 暂停 / 死亡结算 / Boss 血条 / 设置。
// 只负责搭 DOM 与填数；所有可见文案走 data-i18n，由 index.js 统一 applyLang。
// 事件由 main 注册（通过返回的 els 直接 addEventListener）。
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
  // ---- 标题屏（复用骨架 #screen-title） ----
  const title = getOrCreate(root, 'screen-title', 'screen');
  title.innerHTML =
    '<div class="title-inner">' +
      '<div class="title-logo" id="title-text" data-i18n="title.logo"></div>' +
      '<div class="title-tagline" id="subtitle-text" data-i18n="title.tagline"></div>' +
      '<div class="title-best" id="title-best"></div>' +
      '<div class="title-actions">' +
        '<button id="btn-start" class="btn btn-primary" type="button" data-i18n="btn.dive" data-i18n-aria="btn.dive"></button>' +
        '<button id="btn-how" class="btn btn-ghost" type="button" data-tutorial-replay data-i18n="btn.how"></button>' +
        '<button id="btn-settings" class="btn btn-ghost" type="button" data-i18n="btn.settings" data-i18n-aria="btn.settings"></button>' +
      '</div>' +
    '</div>' +
    '<select id="lang-select" class="lang-select" aria-label=""></select>';

  // ---- 暂停屏（复用骨架 #screen-pause） ----
  const pause = getOrCreate(root, 'screen-pause', 'screen hidden');
  pause.innerHTML =
    '<div class="pause-inner">' +
      '<h2 class="pause-title" id="pause-title" data-i18n="pause.title"></h2>' +
      '<div class="pause-hint" data-i18n="pause.hint"></div>' +
      '<div class="pause-actions">' +
        '<button id="btn-resume" class="btn btn-primary" type="button" data-i18n="btn.resume"></button>' +
        '<button id="btn-restart" class="btn btn-ghost" type="button" data-i18n="btn.restart"></button>' +
        '<button id="btn-how-pause" class="btn btn-ghost" type="button" data-tutorial-replay data-i18n="btn.how"></button>' +
      '</div>' +
    '</div>' +
    '<select id="lang-select-pause" class="lang-select" aria-label=""></select>';

  // ---- 死亡结算卡 ----
  const result = getOrCreate(root, 'screen-result', 'screen hidden');
  result.innerHTML =
    '<div class="result-inner">' +
      '<div class="result-title" data-i18n="result.title"></div>' +
      '<div class="result-badge hidden" id="result-new-record" data-i18n="result.newRecord"></div>' +
      '<ul class="result-rows">' +
        '<li><span data-i18n="result.depth"></span><b id="res-depth">0m</b></li>' +
        '<li><span data-i18n="result.maxCombo"></span><b id="res-maxcombo">0</b></li>' +
        '<li><span data-i18n="result.zone"></span><b id="res-zone"></b></li>' +
        '<li><span data-i18n="result.best"></span><b id="res-best">0m</b></li>' +
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
      '<button id="btn-settings-back" class="btn btn-ghost" type="button" data-i18n="set.back"></button>' +
    '</div>';

  // ---- Boss 血条 ----
  const boss = el('div', 'boss-bar hidden', '');
  boss.id = 'boss-bar';
  boss.innerHTML =
    '<div class="boss-name" data-i18n="zone.boss"></div>' +
    '<div class="boss-track"><i class="boss-fill" id="boss-fill"></i></div>';
  root.appendChild(boss);

  const els = {
    title, pause, result, settings, boss,
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
    resDepth: result.querySelector('#res-depth'),
    resMaxCombo: result.querySelector('#res-maxcombo'),
    resZone: result.querySelector('#res-zone'),
    resBest: result.querySelector('#res-best'),
    bossFill: boss.querySelector('#boss-fill'),
  };

  function zoneLabel(zone, zoneName) {
    const key = 'zone.' + zone;
    const text = t(key);
    return text !== key ? text : (zoneName || '');
  }

  function setBest(best) {
    els.titleBest.textContent = t('title.best', { depth: Math.max(0, Math.floor(best ?? 0)) });
  }

  function renderResult(data) {
    data = data || {};
    const depth = Math.max(0, Math.floor(data.depth ?? 0));
    const maxCombo = Math.max(0, Math.floor(data.maxCombo ?? 0));
    const zone = Number(data.zoneReached) || Number(data.zone) || 1;
    const best = Math.max(0, Math.floor(data.best ?? 0));
    els.resDepth.textContent = depth + 'm';
    els.resMaxCombo.textContent = String(maxCombo);
    els.resZone.textContent = zoneLabel(zone, data.zoneName);
    els.resBest.textContent = best + 'm';
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

  return {
    els,
    setBest,
    renderResult,
    renderBoss,
  };
}
