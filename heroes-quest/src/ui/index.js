// src/ui/index.js — DOM UI 装配：屏幕 / HUD / 布阵 / 战斗指令条 / 升级 / 事件 / 休整
// 所有可见文案经 applyLang 从 config/locales.js 刷新；面板按 hud.mode 显隐。
import { t, i18n } from '../core/i18n.js';
import { HEROES, HERO_IDS } from '../../config/gameplay.js';
import { TutorialMachine, createTutorialOverlay } from './tutorial.js';

const TARGET_SKILLS = { basic: 'enemy', mark: 'enemy', heal: 'hero' };

function make(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

export function createUI(root, handlers) {
  root.innerHTML = `
    <div id="screen-title" class="screen is-active">
      <div class="title-inner">
        <div class="title-logo" data-i18n="title.logo"></div>
        <div class="title-tagline" data-i18n="title.tagline"></div>
        <div class="title-best" id="title-best"></div>
        <div class="title-actions">
          <button id="btn-start" class="btn btn-primary" data-i18n="btn.start"></button>
          <button id="btn-how" class="btn btn-ghost" data-tutorial-replay data-i18n="btn.how"></button>
          <button id="btn-settings" class="btn btn-ghost" data-i18n="btn.settings"></button>
        </div>
      </div>
    </div>

    <div id="screen-pause" class="screen hidden">
      <div class="pause-inner">
        <div class="pause-title" data-i18n="pause.title"></div>
        <div class="pause-actions">
          <button id="btn-resume" class="btn btn-primary" data-i18n="btn.resume"></button>
          <button id="btn-restart" class="btn btn-ghost" data-i18n="btn.restart"></button>
          <button id="btn-settings2" class="btn btn-ghost" data-i18n="btn.settings"></button>
        </div>
      </div>
    </div>

    <div id="screen-settings" class="screen hidden">
      <div class="settings-inner">
        <div class="settings-title" data-i18n="set.title"></div>
        <div class="settings-row"><span data-i18n="set.language"></span><select id="lang-select-settings" class="lang-select"></select></div>
        <button id="btn-settings-back" class="btn btn-ghost" data-i18n="set.back"></button>
      </div>
    </div>

    <div id="screen-result" class="screen hidden">
      <div class="result-inner">
        <div class="result-title" id="result-title"></div>
        <div class="result-badge hidden" id="result-badge" data-i18n="result.newRecord"></div>
        <ul class="result-rows" id="result-rows"></ul>
        <div class="result-best" id="result-best"></div>
        <div class="pause-actions">
          <button id="btn-result-restart" class="btn btn-primary" data-i18n="btn.restart"></button>
          <button id="btn-share" class="btn btn-ghost" data-i18n="btn.share"></button>
        </div>
        <div class="result-hint" data-i18n="result.hint"></div>
      </div>
    </div>

    <div id="hud" class="hud hidden">
      <div class="hud-left">
        <div class="hud-stat"><span class="hud-label" data-i18n="hud.chapter"></span><b id="hud-chapter"></b></div>
        <div class="hud-stat"><span class="hud-label" data-i18n="hud.node"></span><b id="hud-node"></b></div>
        <div class="hud-stat" id="hud-targets" hidden><span class="hud-label" data-i18n="hud.targets"></span><b id="hud-targets-n"></b></div>
      </div>
      <div class="hud-signature">
        <div class="hud-label"><span data-i18n="hud.signature"></span></div>
        <div class="sig-track"><div class="sig-fill" id="sig-fill"></div></div>
        <div class="sig-ready hidden" id="sig-ready" data-i18n="battle.sigReady"></div>
      </div>
      <div class="hud-right">
        <div class="hud-stat"><span class="hud-label" data-i18n="hud.supplies"></span><b id="hud-supplies"></b></div>
        <div class="hud-stat" id="hud-starving" hidden><span data-i18n="hud.starving"></span></div>
      </div>
    </div>

    <div id="panel-formation" class="panel hidden">
      <div class="panel-card">
        <div class="panel-title" data-i18n="form.title"></div>
        <div class="panel-hint" data-i18n="form.hint"></div>
        <div class="rows" id="rows"></div>
        <div class="heroes" id="heroes"></div>
        <button id="btn-confirm" class="btn btn-primary" data-i18n="btn.confirm"></button>
      </div>
    </div>

    <div id="battle-bar" class="battle-bar hidden">
      <div class="battle-prompt" id="battle-prompt"></div>
      <div class="skill-row" id="skill-row"></div>
    </div>

    <div id="panel-upgrade" class="panel hidden">
      <div class="panel-card">
        <div class="panel-title" data-i18n="up.title"></div>
        <div class="panel-hint" data-i18n="up.hint"></div>
        <div class="up-cards" id="up-cards"></div>
      </div>
    </div>

    <div id="panel-event" class="panel hidden">
      <div class="panel-card">
        <div class="panel-title" data-i18n="node.event"></div>
        <div class="panel-text" id="evt-text"></div>
        <div class="event-choices" id="evt-choices"></div>
      </div>
    </div>

    <div id="panel-rest" class="panel hidden">
      <div class="panel-card">
        <div class="panel-title" data-i18n="rest.title"></div>
        <div class="panel-text" data-i18n="rest.hint"></div>
        <button id="btn-rest-continue" class="btn btn-primary" data-i18n="btn.continue"></button>
      </div>
    </div>

    <div id="map-hint" class="map-hint hidden" data-i18n="map.hint"></div>
  `;

  const $ = (id) => root.querySelector(id);
  const screens = { title: $('#screen-title'), pause: $('#screen-pause'), settings: $('#screen-settings'), result: $('#screen-result') };
  const panels = { formation: $('#panel-formation'), upgrade: $('#panel-upgrade'), event: $('#panel-event'), rest: $('#panel-rest') };
  const hud = $('#hud');
  const battleBar = $('#battle-bar');

  // 语言下拉
  const titleLangSelect = $('#lang-select') || (() => {
    const s = document.createElement('select');
    s.id = 'lang-select';
    s.className = 'lang-select';
    $('#screen-title .title-inner').appendChild(s);
    return s;
  })();

  // 语言选择器（标题右上角）
  titleLangSelect.id = 'lang-select';
  titleLangSelect.className = 'lang-select';

  const state = {
    formation: [HERO_IDS[0], HERO_IDS[1], HERO_IDS[2]],
    selectedHero: null,
    pendingSkill: null,
    hud: null,
    best: 0,
  };

  function fillLangOptions(sel) {
    if (!sel) return;
    sel.innerHTML = '';
    const list = ['en', 'zh'];
    const names = { en: 'English', zh: '中文' };
    for (const code of list) {
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = names[code];
      sel.appendChild(opt);
    }
    sel.value = i18n.lang === 'zh' ? 'zh' : 'en';
  }

  function applyLang() {
    for (const e of root.querySelectorAll('[data-i18n]')) {
      e.textContent = t(e.getAttribute('data-i18n'));
    }
    for (const sel of [titleLangSelect, $('#lang-select-settings')]) fillLangOptions(sel);
    if (state.hud) setHud(state.hud);
  }

  // ---------- 布阵 ----------
  function buildFormation() {
    const rowsEl = $('#rows');
    rowsEl.innerHTML = '';
    for (let r = 0; r < 3; r += 1) {
      const row = make('button', 'row-slot', '');
      row.dataset.row = r;
      const heroId = state.formation[r];
      const hero = HEROES[heroId];
      row.innerHTML = `<span class="row-label">${t(['form.front', 'form.mid', 'form.back'][r])}</span><span class="row-hero">${t(hero.nameKey)}</span>`;
      row.addEventListener('click', () => assignHeroToRow(state.selectedHero, r));
      rowsEl.appendChild(row);
    }
    const heroesEl = $('#heroes');
    heroesEl.innerHTML = '';
    for (const id of HERO_IDS) {
      const h = HEROES[id];
      const card = make('button', 'hero-card' + (state.selectedHero === id ? ' selected' : ''), '');
      card.dataset.hero = id;
      card.innerHTML = `<span class="hero-card-name">${t(h.nameKey)}</span><span class="hero-card-cls">${t(h.cls + '.cls') || h.cls}</span>`;
      card.addEventListener('click', () => { state.selectedHero = id; buildFormation(); });
      heroesEl.appendChild(card);
    }
  }

  function assignHeroToRow(heroId, row) {
    if (!heroId) return;
    const oldRow = state.formation.indexOf(heroId);
    const displaced = state.formation[row];
    state.formation[row] = heroId;
    if (oldRow >= 0) state.formation[oldRow] = displaced;
    buildFormation();
  }

  // ---------- 战斗指令条 ----------
  function buildBattleBar() {
    const h = state.hud;
    battleBar.classList.remove('hidden');
    const prompt = $('#battle-prompt');
    const row = $('#skill-row');
    row.innerHTML = '';

    if (!h.battle || h.mode !== 'battle') { battleBar.classList.add('hidden'); return; }
    const b = h.battle;
    if (!b.waiting) {
      prompt.textContent = t('battle.enemyTurn');
      return;
    }
    const pending = b.heroes.find((x) => x.id === b.pending);
    prompt.textContent = t('battle.yourTurn') + ' · ' + (pending ? t(pending.nameKey) : '');

    if (pending) {
      const basic = make('button', 'btn skill-btn', t('skill.basic'));
      basic.addEventListener('click', () => chooseSkill('basic', 'enemy'));
      row.appendChild(basic);

      for (const s of pending.skills) {
        const off = s.cdLeft > 0;
        const btn = make('button', 'btn skill-btn' + (off ? ' disabled' : ''), `${t(s.nameKey)}${off ? ` (${s.cdLeft})` : ''}`);
        btn.disabled = off;
        if (!off) {
          const needs = TARGET_SKILLS[s.id] || null;
          btn.addEventListener('click', () => chooseSkill(s.id, needs));
        }
        row.appendChild(btn);
      }

      const sig = make('button', 'btn btn-sig' + (h.signatureReady ? ' ready' : ' disabled'), t('skill.signature'));
      sig.disabled = !h.signatureReady;
      if (h.signatureReady) sig.addEventListener('click', () => handlers.onAction({ skill: 'signature' }));
      row.appendChild(sig);
    }
  }

  function chooseSkill(skill, needsTarget) {
    if (needsTarget) {
      state.pendingSkill = { skill, side: needsTarget };
      buildBattleBar();
      $('#battle-prompt').textContent = t('battle.choose');
    } else {
      handlers.onAction({ skill });
    }
  }

  // ---------- 升级 / 事件 ----------
  function buildUpgrade() {
    const h = state.hud;
    const cards = $('#up-cards');
    cards.innerHTML = '';
    for (const id of h.upgradeChoices) {
      const btn = make('button', 'btn up-card', '');
      btn.innerHTML = `<b data-up="${id}">${t(`up.${id}`)}</b><span>${t(`up.${id}.desc`)}</span>`;
      btn.addEventListener('click', () => handlers.onUpgrade(id));
      cards.appendChild(btn);
    }
  }

  function buildEvent() {
    const h = state.hud;
    $('#evt-text').textContent = t(h.event.textKey);
    const choices = $('#evt-choices');
    choices.innerHTML = '';
    h.event.choices.forEach((ck, i) => {
      const btn = make('button', 'btn btn-primary', t(ck));
      btn.addEventListener('click', () => handlers.onChoice(i));
      choices.appendChild(btn);
    });
  }

  // ---------- HUD / 面板显隐 ----------
  function setHud(h) {
    state.hud = h;
    $('#hud-chapter').textContent = t(h.chapterName);
    $('#hud-node').textContent = `${h.levelsReached}/${h.nodesTotal}`;
    $('#hud-supplies').textContent = String(h.supplies);
    $('#hud-starving').hidden = !h.starving;
    const pct = Math.round((h.signature / h.signatureMax) * 100);
    $('#sig-fill').style.width = pct + '%';
    $('#sig-ready').classList.toggle('hidden', !h.signatureReady);
    const enemiesAlive = h.battle ? h.battle.enemies.filter((e) => e.alive).length : 0;
    $('#hud-targets').hidden = !(h.mode === 'battle' && h.battle);
    $('#hud-targets-n').textContent = String(enemiesAlive);

    // 面板显隐
    for (const key in panels) panels[key].classList.add('hidden');
    if (h.mode === 'formation') { panels.formation.classList.remove('hidden'); buildFormation(); }
    else if (h.mode === 'battle') { buildBattleBar(); }
    else if (h.mode === 'upgrade') { panels.upgrade.classList.remove('hidden'); buildUpgrade(); }
    else if (h.mode === 'event') { panels.event.classList.remove('hidden'); buildEvent(); }
    else if (h.mode === 'rest') { panels.rest.classList.remove('hidden'); }
    if (h.mode !== 'battle') battleBar.classList.add('hidden');

    $('#map-hint').classList.toggle('hidden', h.mode !== 'map');
  }

  // ---------- 屏幕 ----------
  function show(phase) {
    for (const key in screens) screens[key].classList.add('hidden');
    hud.classList.add('hidden');
    for (const key in panels) panels[key].classList.add('hidden');
    battleBar.classList.add('hidden');
    $('#map-hint').classList.add('hidden');

    if (phase === 'title') screens.title.classList.remove('hidden');
    else if (phase === 'pause') screens.pause.classList.remove('hidden');
    else if (phase === 'settings') screens.settings.classList.remove('hidden');
    else if (phase === 'result') screens.result.classList.remove('hidden');
    else if (phase === 'playing') hud.classList.remove('hidden');

    if (phase !== 'playing') hideTutorial();
  }

  function showResult({ won, nodes, supplies, battles, best, newRecord }) {
    $('#result-title').textContent = t(won ? 'result.win.title' : 'result.lose.title');
    $('#result-badge').classList.toggle('hidden', !newRecord);
    $('#result-best').textContent = t('result.best') + ': ' + best;
    $('#result-rows').innerHTML =
      `<li><span>${t('result.nodes')}</span><b>${nodes}</b></li>` +
      `<li><span>${t('result.supplies')}</span><b>${supplies}</b></li>` +
      `<li><span>${t('result.battles')}</span><b>${battles}</b></li>`;
    show('result');
  }

  function setBest(n) {
    state.best = n;
    $('#title-best').textContent = t('title.best', { n });
  }

  function reset() {
    state.formation = [HERO_IDS[0], HERO_IDS[1], HERO_IDS[2]];
    state.selectedHero = null;
    state.pendingSkill = null;
  }

  // ---------- 事件绑定 ----------
  $('#btn-start').addEventListener('click', () => handlers.onStart());
  $('#btn-how').addEventListener('click', () => handlers.onHow());
  $('#btn-settings').addEventListener('click', () => { show('settings'); });
  $('#btn-settings2').addEventListener('click', () => { show('settings'); });
  $('#btn-settings-back').addEventListener('click', () => handlers.onBack());
  $('#btn-resume').addEventListener('click', () => handlers.onResume());
  $('#btn-restart').addEventListener('click', () => handlers.onRestart());
  $('#btn-result-restart').addEventListener('click', () => handlers.onRestart());
  $('#btn-share').addEventListener('click', () => handlers.onShare());
  $('#btn-confirm').addEventListener('click', () => handlers.onConfirmFormation([...state.formation]));
  $('#btn-rest-continue').addEventListener('click', () => handlers.onContinue());
  titleLangSelect.addEventListener('change', (e) => handlers.onLangChange(e.target.value));
  $('#lang-select-settings').addEventListener('change', (e) => handlers.onLangChange(e.target.value));

  // ---------- 教程 ----------
  const machine = new TutorialMachine({ save: handlers.save, load: handlers.load });
  const overlay = createTutorialOverlay(root, machine);
  let tutorialCb = null;
  machine.onDone = (r) => { overlay.hide(); if (tutorialCb) tutorialCb(r); };

  function showTutorial() { overlay.show(); }
  function hideTutorial() { overlay.hide(); }

  return {
    applyLang,
    onTutorial: (cb) => { tutorialCb = cb; },
    setHud,
    show,
    showResult,
    setBest,
    reset,
    showTutorial,
    hideTutorial,
    tutorial: {
      get active() { return machine.active; },
      get step() { return machine.step; },
      get steps() { return ['formation', 'march', 'strike', 'win']; },
      get current() { return machine.currentId; },
      skip: () => machine.skip(),
    },
    machine,
    onGameEvent: (ev) => { machine.onGameEvent(ev); overlay.render(); },
    get pendingSkill() { return state.pendingSkill; },
    clearPendingSkill() { state.pendingSkill = null; buildBattleBar(); },
    isAwaitingTarget() { return !!state.pendingSkill; },
    get titleLangSelect() { return titleLangSelect; },
  };
}
