// src/ui/index.js — GOBLIN MINES UI 装配：标题/暂停/结算/设置/HUD/技能/矿工/塌方预警/首次引导。
// 契约：createUI(root, hooks) → { show, setHud, onTutorial, hideAll, setBest, applyLang, els, tutorial, lang, dir }。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';
import Sdk from '../core/sdk.js';
import { TutorialMachine, createTutorialOverlay, TUTORIAL_KEY, TUT_STEP_IDS } from './tutorial.js';
import { SKILLS, CAPS } from '../../config/gameplay.js';
import { ORE_KEYS } from '../game/sim.js';

function el(tag, className, html) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (html != null) n.innerHTML = html;
  return n;
}
function getOrCreate(root, id, className) {
  let n = root.querySelector('#' + id);
  if (!n) { n = document.createElement('div'); n.id = id; root.appendChild(n); }
  n.className = className;
  return n;
}

export function createUI(root, hooks = {}) {
  const noop = () => {};

  // ---------- 标题屏 ----------
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

  // ---------- 暂停屏 ----------
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

  // ---------- 结算卡 ----------
  const result = getOrCreate(root, 'screen-result', 'screen hidden');
  result.innerHTML =
    '<div class="result-inner">' +
      '<div class="result-title" data-i18n="result.title"></div>' +
      '<div class="result-badge hidden" id="result-new-record" data-i18n="result.newRecord"></div>' +
      '<ul class="result-rows">' +
        '<li><span data-i18n="result.shaft"></span><b id="res-shaft">1</b></li>' +
        '<li><span data-i18n="result.depth"></span><b id="res-depth">0m</b></li>' +
        '<li><span data-i18n="result.coins"></span><b id="res-coins">0</b></li>' +
        '<li><span data-i18n="result.best"></span><b id="res-best">1</b></li>' +
      '</ul>' +
      '<div class="result-actions">' +
        '<button id="btn-again" class="btn btn-primary" type="button" data-i18n="btn.restart"></button>' +
        '<button id="btn-share" class="btn btn-ghost" type="button" data-i18n="btn.share"></button>' +
      '</div>' +
      '<div class="result-hint" data-i18n="result.hint"></div>' +
    '</div>';

  // ---------- 设置 ----------
  const settings = getOrCreate(root, 'screen-settings', 'screen hidden');
  settings.innerHTML =
    '<div class="settings-inner">' +
      '<h2 class="settings-title" data-i18n="set.title"></h2>' +
      '<label class="settings-row"><span data-i18n="set.language"></span>' +
        '<select id="lang-select-settings" class="lang-select" aria-label=""></select>' +
      '</label>' +
      '<button id="btn-settings-back" class="btn btn-ghost" type="button" data-i18n="set.back"></button>' +
    '</div>';

  // ---------- Boss 血条 ----------
  const boss = el('div', 'boss-bar hidden', '');
  boss.id = 'boss-bar';
  boss.innerHTML = '<div class="boss-name" data-i18n="hud.boss"></div><div class="boss-track"><i class="boss-fill" id="boss-fill"></i></div>';
  root.appendChild(boss);

  // ---------- HUD ----------
  const hud = getOrCreate(root, 'hud', 'hud hidden');
  hud.setAttribute('aria-hidden', 'true');
  hud.innerHTML =
    '<div class="hud-left">' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.shaft"></span><b id="hud-shaft">1</b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.depth"></span><b id="hud-depth">0</b><i class="hud-unit">m</i></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.moves"></span><b id="hud-moves">0</b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.stability"></span><b id="hud-stability">100</b></div>' +
    '</div>' +
    '<div class="hud-center"><div class="hud-zone" id="hud-zone"></div></div>' +
    '<div class="hud-right">' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.coins"></span><b id="hud-coins">0</b></div>' +
      '<div class="hud-stat"><span class="hud-label" data-i18n="hud.fuel"></span><b id="hud-fuel">0</b></div>' +
    '</div>';

  // ---------- 左侧资源/矿工面板 ----------
  const panelLeft = getOrCreate(root, 'panel-left', 'panel-side');
  panelLeft.innerHTML =
    '<div class="panel-block" id="ores-block">' +
      '<div class="ore-row"><i class="ore-dot" style="background:#ff4d6d"></i><span class="ore-name" data-i18n="ore.ruby"></span><b id="ore-ruby">0</b></div>' +
      '<div class="ore-row"><i class="ore-dot" style="background:#4da6ff"></i><span class="ore-name" data-i18n="ore.sapphire"></span><b id="ore-sapphire">0</b></div>' +
      '<div class="ore-row"><i class="ore-dot" style="background:#b06bff"></i><span class="ore-name" data-i18n="ore.amethyst"></span><b id="ore-amethyst">0</b></div>' +
      '<div class="ore-row"><i class="ore-dot" style="background:#4dff88"></i><span class="ore-name" data-i18n="ore.emerald"></span><b id="ore-emerald">0</b></div>' +
    '</div>' +
    '<div class="panel-block" id="goblins-block">' +
      '<div class="panel-title" data-i18n="goblin.title"></div>' +
      '<div id="goblin-list"></div>' +
      '<button id="btn-hire" class="btn btn-mini" type="button" data-i18n="btn.hire"></button>' +
    '</div>';

  // ---------- 右侧技能/挖掘面板 ----------
  const panelRight = getOrCreate(root, 'panel-right', 'panel-side');
  panelRight.innerHTML =
    '<div class="panel-block" id="skills-block">' +
      '<div id="skill-list"></div>' +
    '</div>' +
    '<button id="btn-dig" class="btn btn-dig" type="button" data-i18n="btn.dig"></button>';

  // ---------- 塌方预警 ----------
  const collapse = el('div', 'collapse-banner hidden', '');
  collapse.id = 'collapse-banner';
  collapse.innerHTML =
    '<span class="collapse-text" data-i18n="event.collapse"></span>' +
    '<button id="btn-reinforce" class="btn btn-mini" type="button" data-i18n="btn.reinforce"></button>' +
    '<button id="btn-gamble" class="btn btn-mini btn-ghost" type="button" data-i18n="btn.gamble"></button>';
  root.appendChild(collapse);

  const els = {
    title, pause, result, settings, boss, hud, panelLeft, panelRight, collapse,
    langSelects: [title.querySelector('#lang-select'), pause.querySelector('#lang-select-pause'), settings.querySelector('#lang-select-settings')],
    btnStart: title.querySelector('#btn-start'),
    btnHow: title.querySelector('#btn-how'),
    btnSettings: title.querySelector('#btn-settings'),
    btnResume: pause.querySelector('#btn-resume'),
    btnRestart: pause.querySelector('#btn-restart'),
    btnHowPause: pause.querySelector('#btn-how-pause'),
    btnAgain: result.querySelector('#btn-again'),
    btnShare: result.querySelector('#btn-share'),
    btnSettingsBack: settings.querySelector('#btn-settings-back'),
    btnDig: panelRight.querySelector('#btn-dig'),
    btnHire: panelLeft.querySelector('#btn-hire'),
    btnReinforce: collapse.querySelector('#btn-reinforce'),
    btnGamble: collapse.querySelector('#btn-gamble'),
    titleBest: title.querySelector('#title-best'),
    newRecordBadge: result.querySelector('#result-new-record'),
    resShaft: result.querySelector('#res-shaft'),
    resDepth: result.querySelector('#res-depth'),
    resCoins: result.querySelector('#res-coins'),
    resBest: result.querySelector('#res-best'),
    bossFill: boss.querySelector('#boss-fill'),
    hudShaft: hud.querySelector('#hud-shaft'),
    hudDepth: hud.querySelector('#hud-depth'),
    hudMoves: hud.querySelector('#hud-moves'),
    hudStability: hud.querySelector('#hud-stability'),
    hudCoins: hud.querySelector('#hud-coins'),
    hudFuel: hud.querySelector('#hud-fuel'),
    hudZone: hud.querySelector('#hud-zone'),
    ores: { ruby: panelLeft.querySelector('#ore-ruby'), sapphire: panelLeft.querySelector('#ore-sapphire'), amethyst: panelLeft.querySelector('#ore-amethyst'), emerald: panelLeft.querySelector('#ore-emerald') },
    goblinList: panelLeft.querySelector('#goblin-list'),
    skillList: panelRight.querySelector('#skill-list'),
  };

  // 技能按钮
  const skillButtons = [];
  SKILLS.forEach((s) => {
    const b = el('button', 'btn btn-skill', '');
    b.dataset.skill = s.id;
    b.innerHTML = '<span class="skill-name" data-i18n="skill.' + s.id + '"></span><span class="skill-cost"></span>';
    els.skillList.appendChild(b);
    b.addEventListener('click', () => (hooks.onSkill || noop)(s.id));
    skillButtons.push({ id: s.id, btn: b, def: s });
  });

  function costText(skill) {
    const parts = [];
    for (const k of ['ruby', 'sapphire', 'amethyst', 'emerald', 'fuel']) {
      if (skill.cost[k]) parts.push(`${t('ore.' + k)}${skill.cost[k]}`);
    }
    return parts.join(' ');
  }

  let lastHud = null;
  let lastResult = null;
  let bestShaft = 1;
  let tutorialDoneCb = null;

  // ---------- 教程 ----------
  const machine = new TutorialMachine({ save: (k, v) => Sdk.save(k, v), load: (k, d) => Sdk.load(k, d), key: TUTORIAL_KEY });
  const overlay = createTutorialOverlay(root, machine, { canvas: root.querySelector('canvas'), digBtn: els.btnDig });
  machine.onDone = (result) => { overlay.hide(); if (tutorialDoneCb) { try { tutorialDoneCb(result); } catch { /* noop */ } } };

  function fillLang() {
    for (const sel of els.langSelects) {
      if (!sel) continue;
      sel.innerHTML = '';
      for (const opt of i18n.options()) {
        const o = document.createElement('option');
        o.value = opt.code;
        o.textContent = opt.name;
        if (opt.code === i18n.lang) o.selected = true;
        sel.appendChild(o);
      }
      sel.setAttribute('aria-label', t('set.language'));
    }
  }

  function applyLang() {
    syncDocumentLang();
    root.querySelectorAll('[data-i18n]').forEach((n) => { n.textContent = t(n.dataset.i18n); });
    fillLang();
    setBest(bestShaft);
    if (lastResult) renderResult(lastResult);
    if (lastHud) setHud(lastHud);
    overlay.render();
    for (const s of skillButtons) s.btn.querySelector('.skill-cost').textContent = costText(s.def);
  }

  function setBest(shaft) {
    bestShaft = Math.max(1, Math.floor(shaft ?? 1));
    els.titleBest.textContent = t('title.best', { shaft: bestShaft, coins: Math.floor(lastHud?.coins ?? 0) });
  }

  function renderResult(data) {
    data = data || {};
    els.resShaft.textContent = String(Math.max(1, Math.floor(data.shaft ?? 1)));
    els.resDepth.textContent = Math.floor(data.depth ?? 0) + 'm';
    els.resCoins.textContent = String(Math.floor(data.coins ?? 0));
    els.resBest.textContent = String(Math.max(1, Math.floor(data.best ?? 1)));
    els.newRecordBadge.classList.toggle('hidden', !data.newRecord);
  }

  function chapterName(chapter) {
    const key = ['scene.fluorite', 'scene.copper', 'scene.abyss'][chapter] || 'scene.fluorite';
    const text = t(key);
    return text !== key ? text : 'Fluorite Cave';
  }

  function setHud(h) {
    lastHud = h || {};
    h = lastHud;
    els.hudShaft.textContent = String(h.shaft ?? 1);
    els.hudDepth.textContent = String(Math.floor(h.depth ?? 0));
    els.hudMoves.textContent = String(Math.floor(h.moves ?? 0));
    els.hudStability.textContent = String(Math.floor(h.stability ?? 0));
    els.hudCoins.textContent = String(Math.floor(h.coins ?? 0));
    els.hudFuel.textContent = String(Math.floor(h.fuel ?? 0));
    els.hudZone.textContent = chapterName(h.chapter);

    for (const k of ['ruby', 'sapphire', 'amethyst', 'emerald']) {
      els.ores[k].textContent = `${h.resources?.[k] ?? 0}/${CAPS[k]}`;
    }

    // 矿工列表
    els.goblinList.innerHTML = '';
    for (const g of h.goblins || []) {
      const row = el('div', 'goblin-row', '');
      row.innerHTML = '<span class="goblin-col">' + (g.col + 1) + '</span><span class="goblin-lvl">L' + g.level + '</span>';
      row.addEventListener('click', () => (hooks.onUpgradeGoblin || noop)(g.id));
      els.goblinList.appendChild(row);
    }

    // 技能可用性
    for (const s of skillButtons) {
      const ok = canAfford(s.def);
      s.btn.classList.toggle('disabled', !ok);
    }

    // 挖掘按钮
    els.btnDig.classList.toggle('disabled', !h.canDig);

    // 塌方预警
    const warn = h.collapseIn != null && h.collapseIn <= 5;
    collapse.classList.toggle('hidden', !warn);
    if (warn) {
      els.btnReinforce.textContent = h.reinforced ? '✓ ' + t('btn.reinforce') : t('btn.reinforce');
      els.btnReinforce.classList.toggle('disabled', !!h.reinforced);
    }

    // Boss 血条
    const max = h.boss?.max || 0;
    els.boss.classList.toggle('hidden', max <= 0);
    if (max > 0) els.bossFill.style.width = Math.min(100, ((h.boss.hp || 0) / max) * 100).toFixed(1) + '%';
  }

  function canAfford(skill) {
    const res = lastHud?.resources || { ruby: 0, sapphire: 0, amethyst: 0, emerald: 0, fuel: 0 };
    for (const k of ['ruby', 'sapphire', 'amethyst', 'emerald', 'fuel']) {
      if (skill.cost[k] && (res[k] ?? 0) < skill.cost[k]) return false;
    }
    return true;
  }

  function hideAll() {
    for (const key of ['title', 'pause', 'result', 'settings']) els[key].classList.add('hidden');
    hud.classList.add('hidden');
    panelLeft.classList.add('hidden');
    panelRight.classList.add('hidden');
    collapse.classList.add('hidden');
    overlay.hide();
    els.boss.classList.add('hidden');
  }

  function show(screen, data) {
    if (screen === 'dead' && data) { setResult(data); }
    const isTitle = screen === 'title';
    const isPlaying = screen === 'playing';
    const isPaused = screen === 'paused';
    const isDead = screen === 'dead';
    const isSettings = screen === 'settings';

    els.title.classList.toggle('hidden', !isTitle);
    els.pause.classList.toggle('hidden', !isPaused);
    els.result.classList.toggle('hidden', !isDead);
    els.settings.classList.toggle('hidden', !isSettings);

    const inGame = isPlaying || isPaused || isDead;
    hud.classList.toggle('hidden', !isPlaying && !isPaused);
    panelLeft.classList.toggle('hidden', !inGame);
    panelRight.classList.toggle('hidden', !inGame);

    if (isPlaying) {
      if (!machine.done && !machine.active) machine.begin();
      if (machine.active) overlay.show();
    } else {
      overlay.hide();
    }

    if (isTitle) applyLang();
    if (isSettings) applyLang();
  }

  function setResult(data) {
    lastResult = data || {};
    renderResult(lastResult);
  }

  function onTutorial(cb) { tutorialDoneCb = cb || null; }

  for (const sel of els.langSelects) {
    if (!sel) continue;
    sel.addEventListener('change', (e) => { if (i18n.setLang(e.target.value)) applyLang(); });
  }

  els.btnSettings.addEventListener('click', () => show('settings'));
  els.btnSettingsBack.addEventListener('click', () => show('title'));
  const replay = () => { machine.replay(); overlay.show(); if (hooks.onHow) hooks.onHow(); };
  els.btnHow.addEventListener('click', replay);
  els.btnHowPause.addEventListener('click', replay);

  els.btnStart.addEventListener('click', () => (hooks.onStart || noop)());
  els.btnResume.addEventListener('click', () => (hooks.onResume || noop)());
  els.btnRestart.addEventListener('click', () => (hooks.onRestart || noop)());
  els.btnAgain.addEventListener('click', () => (hooks.onRestart || noop)());
  els.btnShare.addEventListener('click', () => (hooks.onShare || noop)());
  els.btnDig.addEventListener('click', () => (hooks.onDig || noop)());
  els.btnHire.addEventListener('click', () => (hooks.onHire || noop)());
  els.btnReinforce.addEventListener('click', () => (hooks.onReinforce || noop)());
  els.btnGamble.addEventListener('click', () => (hooks.onGamble || noop)());

  applyLang();

  return {
    show, setHud, onTutorial, hideAll, setBest, setResult, applyLang, els,
    skillMode: null,
    get lang() { return i18n.lang; },
    get dir() { return i18n.dir; },
    tutorial: {
      machine, overlay,
      get active() { return machine.active; },
      get step() { return machine.step; },
      get steps() { return TUT_STEP_IDS; },
      get current() { return machine.currentId; },
      begin: () => machine.begin(),
      replay,
      skip: () => machine.skip(),
      onGameEvent: (ev, now) => { const s = machine.onGameEvent(ev, now); overlay.render(); return s; },
      tick: (now) => machine.tick(now),
      state: () => machine.snapshot(),
    },
  };
}

export default createUI;
