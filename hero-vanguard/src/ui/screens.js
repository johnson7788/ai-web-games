// src/ui/screens.js — 标题 / 暂停 / 结算 / 设置 / 波间升级 / Boss 血条
import { t } from '../core/i18n.js';
import { UPGRADES } from '../../config/gameplay.js';

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
      '<div class="title-logo" id="title-text" data-i18n="title.logo"></div>' +
      '<div class="title-tagline" id="subtitle-text" data-i18n="title.tagline"></div>' +
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
      '<div class="result-title" id="result-title"></div>' +
      '<div class="result-badge hidden" id="result-new-record" data-i18n="result.newRecord"></div>' +
      '<ul class="result-rows">' +
        '<li><span data-i18n="result.wave"></span><b id="res-wave">0</b></li>' +
        '<li><span data-i18n="result.kills"></span><b id="res-kills">0</b></li>' +
        '<li><span data-i18n="result.best"></span><b id="res-best">0</b></li>' +
      '</ul>' +
      '<div class="result-actions">' +
        '<button id="btn-again" class="btn btn-primary" type="button" data-i18n="btn.restart"></button>' +
        '<button id="btn-share" class="btn btn-ghost" type="button" data-i18n="btn.share"></button>' +
      '</div>' +
      '<div class="result-hint" id="result-hint"></div>' +
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

  // ---- 波间升级（三选一）----
  const upgrade = getOrCreate(root, 'screen-upgrade', 'screen hidden');
  upgrade.innerHTML =
    '<div class="upgrade-inner">' +
      '<div class="upgrade-title" data-i18n="upgrade.title"></div>' +
      '<div class="upgrade-sub" id="upgrade-sub"></div>' +
      '<div class="upgrade-choices" id="upgrade-choices"></div>' +
    '</div>';

  // ---- Boss 血条 ----
  const boss = getOrCreate(root, 'boss-bar', 'boss-bar hidden');
  boss.innerHTML =
    '<div class="boss-name" data-i18n="enemy.boss"></div>' +
    '<div class="boss-track"><i class="boss-fill" id="boss-fill"></i></div>';

  const els = {
    title, pause, result, settings, upgrade, boss,
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
    resultHint: result.querySelector('#result-hint'),
    newRecordBadge: result.querySelector('#result-new-record'),
    resWave: result.querySelector('#res-wave'),
    resKills: result.querySelector('#res-kills'),
    resBest: result.querySelector('#res-best'),
    upgradeSub: upgrade.querySelector('#upgrade-sub'),
    upgradeChoices: upgrade.querySelector('#upgrade-choices'),
    bossFill: boss.querySelector('#boss-fill'),
  };

  function setBest(best) {
    els.titleBest.textContent = t('title.best', { wave: Math.max(0, Math.floor(best ?? 0)) });
  }

  function renderResult(data) {
    data = data || {};
    const win = !!data.win;
    els.resultTitle.textContent = t(win ? 'result.win.title' : 'result.lose.title');
    els.resultHint.textContent = t(win ? 'result.winHint' : 'result.hint');
    els.resWave.textContent = String(Math.max(0, Math.floor(data.wave ?? 0)));
    els.resKills.textContent = String(Math.max(0, Math.floor(data.kills ?? 0)));
    els.resBest.textContent = String(Math.max(0, Math.floor(data.best ?? 0)));
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

  function renderUpgrade(choices, wave, onPick) {
    els.upgradeSub.textContent = t('upgrade.waveCleared', { wave });
    els.upgradeChoices.innerHTML = '';
    (choices || []).forEach((id, i) => {
      const u = UPGRADES.find((x) => x.id === id);
      const b = document.createElement('button');
      b.className = 'btn upgrade-choice';
      b.type = 'button';
      b.setAttribute('data-upgrade', String(i));
      b.textContent = t('up.' + id) || (u && u.title) || id;
      b.addEventListener('click', () => { if (onPick) onPick(i); });
      els.upgradeChoices.appendChild(b);
    });
  }

  return { els, setBest, renderResult, renderBoss, renderUpgrade };
}
