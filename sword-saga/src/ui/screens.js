// src/ui/screens.js — 标题 / 暂停 / 结算 / 设置 / HUD / 对话 / 战斗菜单的 DOM 搭建与填数。
// 只负责搭 DOM 与填数；所有可见文案走 data-i18n，由 index.js 统一 applyLang。
// 事件由 main 注册（通过返回的 els 或 hooks）。
import { t } from '../core/i18n.js';
import { SKILLS, ITEMS, HEROES } from '../../config/gameplay.js';

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

const LANG_SELECT = '<select id="lang-select" class="lang-select" aria-label=""></select>';
const LANG_SELECT_PAUSE = '<select id="lang-select-pause" class="lang-select" aria-label=""></select>';

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
    LANG_SELECT;

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
    LANG_SELECT_PAUSE;

  // ---- 结算卡 ----
  const result = getOrCreate(root, 'screen-result', 'screen hidden');
  result.innerHTML =
    '<div class="result-inner">' +
      '<div class="result-title" id="result-title"></div>' +
      '<ul class="result-rows">' +
        '<li><span data-i18n="result.chapter"></span><b id="res-chapter">1</b></li>' +
      '</ul>' +
      '<div class="result-actions">' +
        '<button id="btn-again" class="btn btn-primary" type="button" data-i18n="btn.again"></button>' +
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

  // ---- HUD ----
  const hud = getOrCreate(root, 'hud', 'hud hidden');
  hud.innerHTML =
    '<div class="hud-top">' +
      '<div class="hud-left">' +
        '<div class="hud-line"><span data-i18n="hud.chapter"></span><b id="hud-chapter">1/12</b></div>' +
        '<div class="hud-line"><span data-i18n="hud.scene"></span><b id="hud-scene"></b></div>' +
      '</div>' +
      '<div class="hud-party">' +
        '<div class="hud-unit" id="hud-hero"><span class="hud-name" data-i18n="hero.name"></span>' +
          '<i class="bar hp"><b id="hud-hero-hp"></b></i><i class="bar mp"><b id="hud-hero-mp"></b></i></div>' +
        '<div class="hud-unit" id="hud-fox"><span class="hud-name" data-i18n="fox.name"></span>' +
          '<i class="bar hp"><b id="hud-fox-hp"></b></i><i class="bar mp"><b id="hud-fox-mp"></b></i></div>' +
      '</div>' +
    '</div>' +
    '<div class="hud-hint" data-i18n="hud.hint"></div>';

  // ---- 对话盒 ----
  const dialog = getOrCreate(root, 'dialog-box', 'dialog-box hidden');
  dialog.innerHTML =
    '<div class="dialog-name" id="dialog-name"></div>' +
    '<div class="dialog-text" id="dialog-text"></div>' +
    '<button id="btn-dialog-next" class="btn btn-primary btn-dialog-next" type="button" data-i18n="dialog.next"></button>';

  // ---- 战斗菜单 ----
  const battle = getOrCreate(root, 'battle-menu', 'battle-menu hidden');
  battle.innerHTML =
    '<div class="bm-row" id="bm-main"></div>' +
    '<div class="bm-row hidden" id="bm-skills"></div>' +
    '<div class="bm-row hidden" id="bm-items"></div>' +
    '<div class="bm-row hidden" id="bm-targets"></div>';

  const els = {
    title, pause, result, settings, hud, dialog, battle,
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
    resChapter: result.querySelector('#res-chapter'),
    hudChapter: hud.querySelector('#hud-chapter'),
    hudScene: hud.querySelector('#hud-scene'),
    hudHeroHp: hud.querySelector('#hud-hero-hp'),
    hudHeroMp: hud.querySelector('#hud-hero-mp'),
    hudFoxHp: hud.querySelector('#hud-fox-hp'),
    hudFoxMp: hud.querySelector('#hud-fox-mp'),
    hudHeroUnit: hud.querySelector('#hud-hero'),
    hudFoxUnit: hud.querySelector('#hud-fox'),
    dialogName: dialog.querySelector('#dialog-name'),
    dialogText: dialog.querySelector('#dialog-text'),
    btnDialogNext: dialog.querySelector('#btn-dialog-next'),
    bmMain: battle.querySelector('#bm-main'),
    bmSkills: battle.querySelector('#bm-skills'),
    bmItems: battle.querySelector('#bm-items'),
    bmTargets: battle.querySelector('#bm-targets'),
  };

  function setBest(chapter) {
    els.titleBest.textContent = t('title.best', { chapter: Math.max(1, chapter || 1) });
  }

  function renderResult(data) {
    data = data || {};
    const victory = data.victory !== false;
    els.resultTitle.textContent = t(victory ? 'result.victory' : 'result.gameover');
    els.resChapter.textContent = String(data.chapter || 1);
  }

  function setHudBar(unitEl, hpEl, mpEl, unit) {
    if (!unit) return;
    hpEl.style.width = Math.max(0, Math.min(100, (unit.hp / unit.maxHp) * 100)).toFixed(1) + '%';
    mpEl.style.width = Math.max(0, Math.min(100, (unit.mp / unit.maxMp) * 100)).toFixed(1) + '%';
    unitEl.classList.toggle('dead', unit.hp <= 0);
  }

  function renderHud(hud) {
    hud = hud || {};
    els.hudChapter.textContent = `${hud.chapter || 1}/12`;
    els.hudScene.textContent = t('scene.' + (hud.scene || 1));
    // 战斗中：顶部 DOM 血条与画布内的单位血条冗余，隐藏 DOM 血条避免视觉重复/遮挡
    els.hud.classList.toggle('battle', hud.mode === 'battle');
    setHudBar(els.hudHeroUnit, els.hudHeroHp, els.hudHeroMp, hud.party?.hero);
    setHudBar(els.hudFoxUnit, els.hudFoxHp, els.hudFoxMp, hud.party?.fox);
  }

  function showDialog(hud) {
    const line = hud?.dialog?.line;
    if (!line) { els.dialog.classList.add('hidden'); return; }
    els.dialog.classList.remove('hidden');
    els.dialogName.textContent = t('who.' + (line.who || 'narrator'));
    const lang = document.documentElement.lang || 'en';
    els.dialogText.textContent = line[lang] || line.en || '';
    els.btnDialogNext.textContent = t('dialog.next');
  }

  return {
    els,
    setBest,
    renderResult,
    renderHud,
    showDialog,
  };
}

export { SKILLS, ITEMS, HEROES };
