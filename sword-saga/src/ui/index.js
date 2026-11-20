// src/ui/index.js — createUI 装配：标题 / HUD / 暂停 / 结算 / 对话 / 战斗菜单 / 首次引导 / i18n。
// 契约：createUI(root, hooks, opts) → { show, setHud, onTutorial, hideAll, setBest, setResult, applyLang, els, tutorial, lang, dir }
import { i18n, t, syncDocumentLang } from '../core/i18n.js';
import Sdk from '../core/sdk.js';
import { createScreens } from './screens.js';
import { TutorialMachine, createTutorialOverlay, TUTORIAL_KEY, TUT_STEP_IDS } from './tutorial.js';
import { SKILLS, ITEMS, HEROES } from '../../config/gameplay.js';

const ELEM_TIP = { metal: 'elem.metal', wood: 'elem.wood', earth: 'elem.earth', water: 'elem.water', fire: 'elem.fire' };

export function createUI(root, hooks = {}, opts = {}) {
  const screens = createScreens(root);
  const els = screens.els;

  const machine = new TutorialMachine({
    save: (k, v) => Sdk.save(k, v),
    load: (k, d) => Sdk.load(k, d),
    key: TUTORIAL_KEY,
  });
  const overlay = createTutorialOverlay(root, machine, { canvas: opts.canvas });

  let lastHud = null;
  let lastResult = null;
  let bestChapter = 1;
  let tutorialDoneCb = null;
  let lastMenuKey = '';

  // ---- 语言 ----
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
    root.querySelectorAll('[data-i18n-aria]').forEach((n) => { n.setAttribute('aria-label', t(n.dataset.i18nAria)); });
    fillLang();
    setBest(bestChapter);
    if (lastResult) screens.renderResult(lastResult);
    if (lastHud) {
      screens.renderHud(lastHud);
      screens.showDialog(lastHud);
    }
    overlay.render();
    lastMenuKey = '';   // 强制重建菜单以刷新文案
  }

  function setBest(chapter) {
    bestChapter = Math.max(1, chapter || 1);
    screens.setBest(bestChapter);
  }

  function setResult(data) {
    lastResult = data || {};
    screens.renderResult(lastResult);
  }

  function setHud(h) {
    lastHud = h || {};
    screens.renderHud(lastHud);
    screens.showDialog(lastHud);
    renderBattleMenu(lastHud);
  }

  // ---- 战斗菜单 ----
  function mkBtn(text, className, data) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'bm-btn ' + (className || '');
    b.textContent = text;
    if (data) Object.assign(b.dataset, data);
    return b;
  }

  function clearRows() {
    els.bmMain.innerHTML = '';
    els.bmSkills.innerHTML = '';
    els.bmItems.innerHTML = '';
    els.bmTargets.innerHTML = '';
  }

  function showRow(row) {
    els.bmMain.classList.toggle('hidden', row !== 'main');
    els.bmSkills.classList.toggle('hidden', row !== 'skills');
    els.bmItems.classList.toggle('hidden', row !== 'items');
    els.bmTargets.classList.toggle('hidden', row !== 'targets');
  }

  function renderBattleMenu(hud) {
    const b = hud?.battle;
    const pending = b?.pending || null;
    const key = pending ? `${pending}:${b.activeHero}` : '';
    if (!pending) {
      els.battle.classList.add('hidden');
      lastMenuKey = '';
      return;
    }
    els.battle.classList.remove('hidden');
    if (key === lastMenuKey) return;
    lastMenuKey = key;

    const hero = HEROES[b.activeHero];
    clearRows();

    // 主菜单
    els.bmMain.appendChild(mkBtn(t('battle.attack'), 'primary', { action: 'attack' }));
    els.bmMain.appendChild(mkBtn(t('battle.skill'), '', { action: 'skill' }));
    els.bmMain.appendChild(mkBtn(t('battle.item'), '', { action: 'item' }));
    els.bmMain.appendChild(mkBtn(t('battle.defend'), '', { action: 'defend' }));
    els.bmMain.appendChild(mkBtn(t('battle.switch'), '', { action: 'switch' }));
    els.bmMain.appendChild(mkBtn(t('battle.guard') + (b.foxGuard ? ' ON' : ' OFF'), 'guard', { action: 'guard', guard: b.foxGuard ? 'off' : 'on' }));

    // 技能子菜单
    for (const sid of hero.skills) {
      const s = SKILLS[sid];
      const label = `${t(s.nameKey)} ${t(ELEM_TIP[s.element])} · MP${s.mp}`;
      els.bmSkills.appendChild(mkBtn(label, '', { skill: sid }));
    }
    els.bmSkills.appendChild(mkBtn(t('btn.back'), 'back', { back: 'main' }));

    // 道具子菜单
    for (const itemId of Object.keys(ITEMS)) {
      const item = ITEMS[itemId];
      const have = hud.inventory?.[itemId] ?? 0;
      els.bmItems.appendChild(mkBtn(`${t(item.nameKey)} ×${have}`, '', { item: itemId }));
    }
    els.bmItems.appendChild(mkBtn(t('btn.back'), 'back', { back: 'main' }));

    // 目标子菜单
    const enemies = b.units.filter((u) => u.side === 'enemy' && u.alive);
    for (const e of enemies) {
      const label = `${t(e.nameKey)} (${t(ELEM_TIP[e.element])})`;
      els.bmTargets.appendChild(mkBtn(label, '', { target: e.id }));
    }
    els.bmTargets.appendChild(mkBtn(t('btn.back'), 'back', { back: 'main' }));

    showRow('main');
  }

  function bindBattleMenu() {
    function clickHandler(e) {
      const btn = e.target.closest('.bm-btn');
      if (!btn) return;
      const d = btn.dataset;
      if (d.back) { showRow(d.back); return; }
      if (d.action === 'attack') { showRow('targets'); return; }
      if (d.action === 'skill') { showRow('skills'); return; }
      if (d.action === 'item') { showRow('items'); return; }
      if (d.action === 'defend') { fire({ type: 'defend' }); return; }
      if (d.action === 'switch') { fire({ type: 'switch' }); return; }
      if (d.action === 'guard') { fire({ type: 'guard' }); return; }
      if (d.skill) { showRow('targets'); els.bmTargets.dataset.skillId = d.skill; return; }
      if (d.item) { fire({ type: 'item', itemId: d.item }); return; }
      if (d.target) {
        const skillId = els.bmTargets.dataset.skillId || null;
        fire({ type: skillId ? 'skill' : 'attack', skillId: skillId || undefined, target: d.target });
        els.bmTargets.dataset.skillId = '';
      }
    }
    function fire(cmd) {
      if (typeof hooks.onBattleCommand === 'function') hooks.onBattleCommand(cmd);
    }
    els.battle.addEventListener('click', clickHandler);
  }

  // ---- 屏显切换 ----
  function hideAll() {
    for (const key of ['title', 'pause', 'result', 'settings']) {
      els[key].classList.add('hidden');
    }
    els.hud.classList.add('hidden');
    els.dialog.classList.add('hidden');
    els.battle.classList.add('hidden');
    overlay.hide();
  }

  function show(screen, data) {
    if ((screen === 'victory' || screen === 'dead') && data) setResult(data);
    els.title.classList.toggle('hidden', screen !== 'title');
    els.pause.classList.toggle('hidden', screen !== 'paused');
    els.result.classList.toggle('hidden', screen !== 'victory' && screen !== 'dead');
    els.settings.classList.toggle('hidden', screen !== 'settings');

    const isPlaying = screen === 'playing';
    els.hud.classList.toggle('hidden', !isPlaying);
    if (!isPlaying) { els.battle.classList.add('hidden'); els.dialog.classList.add('hidden'); }

    if (isPlaying) {
      if (!machine.done && !machine.active) machine.begin();
      if (machine.active) overlay.show();
    } else {
      overlay.hide();
    }

    if (screen === 'title' || screen === 'settings') applyLang();
  }

  function finishTutorial(result) {
    overlay.hide();
    if (tutorialDoneCb) { try { tutorialDoneCb(result); } catch { /* 回调异常不影响游戏 */ } }
  }
  machine.onDone = finishTutorial;

  function onTutorial(cb) { tutorialDoneCb = cb || null; }

  // 语言切换
  for (const sel of els.langSelects) {
    if (!sel) continue;
    sel.addEventListener('change', (e) => {
      if (i18n.setLang(e.target.value)) applyLang();
    });
  }

  // 游戏流转按钮
  const noop = () => {};
  els.btnStart.addEventListener('click', () => (hooks.onStart || noop)());
  els.btnResume.addEventListener('click', () => (hooks.onResume || noop)());
  els.btnRestart.addEventListener('click', () => (hooks.onRestart || noop)());
  els.btnAgain.addEventListener('click', () => (hooks.onRestart || noop)());
  els.btnShare.addEventListener('click', () => (hooks.onShare || noop)());
  els.btnSettings.addEventListener('click', () => show('settings'));
  els.btnSettingsBack.addEventListener('click', () => show('title'));
  els.btnDialogNext.addEventListener('click', () => (hooks.onDialogAdvance || noop)());

  const replay = () => { machine.replay(); overlay.show(); if (typeof hooks.onHow === 'function') hooks.onHow(); };
  els.btnHow.addEventListener('click', replay);
  els.btnHowPause.addEventListener('click', replay);

  bindBattleMenu();
  applyLang();

  return {
    show,
    setHud,
    onTutorial,
    hideAll,
    setBest,
    setResult,
    applyLang,
    els,
    tutorial: {
      machine,
      overlay,
      get active() { return machine.active; },
      get step() { return machine.step; },
      get steps() { return TUT_STEP_IDS; },
      get current() { return machine.currentId; },
      begin: () => machine.begin(),
      replay,
      skip: () => machine.skip(),
      onGameEvent: (ev) => {
        const s = machine.onGameEvent(ev);
        overlay.render();
        return s;
      },
      tick: () => machine.tick(),
      state: () => machine.snapshot(),
    },
    get lang() { return i18n.lang; },
    get dir() { return i18n.dir; },
  };
}

export default createUI;
