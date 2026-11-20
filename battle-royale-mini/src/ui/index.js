// src/ui/index.js — createUI 装配：标题 / HUD / 暂停 / 结算 / 设置 / 首次引导 / i18n。
// 契约：createUI(root, hooks) → { show(screen), setHud(hud), onTutorial(cb), hideAll(), setBest(), applyLang(), els, tutorial }
import { i18n, t, syncDocumentLang } from '../core/i18n.js';
import Sdk from '../core/sdk.js';
import { TutorialMachine, createTutorialOverlay, TUTORIAL_KEY, TUT_STEP_IDS } from './tutorial.js';

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

function buildScreens(root) {
  const els = {};

  // 标题
  const title = el('div', 'screen', '');
  title.id = 'screen-title';
  title.innerHTML = `
    <select id="lang-select" class="lang-select" aria-label="Language"></select>
    <div class="title-inner">
      <div class="title-logo" data-i18n="title.logo">BATTLE ROYALE MINI</div>
      <div class="title-tagline" data-i18n="title.tagline"></div>
      <div class="title-best" data-i18n="title.best"></div>
      <div class="title-actions">
        <button id="btn-start" class="btn btn-primary" type="button" data-i18n="btn.start"></button>
        <button id="btn-how" class="btn btn-ghost" type="button" data-tutorial-replay data-i18n="btn.how"></button>
        <button id="btn-settings" class="btn btn-ghost" type="button" data-i18n="btn.settings"></button>
      </div>
    </div>`;
  root.appendChild(title);

  // 暂停
  const pause = el('div', 'screen hidden', '');
  pause.id = 'screen-pause';
  pause.innerHTML = `
    <div class="pause-inner">
      <div class="pause-title" data-i18n="pause.title"></div>
      <div class="pause-hint" data-i18n="pause.hint"></div>
      <div class="pause-actions">
        <button id="btn-resume" class="btn btn-primary" type="button" data-i18n="btn.resume"></button>
        <button id="btn-how-pause" class="btn btn-ghost" type="button" data-tutorial-replay data-i18n="btn.how"></button>
      </div>
      <select id="lang-select-pause" class="lang-select" aria-label="Language"></select>
    </div>`;
  root.appendChild(pause);

  // 结算
  const result = el('div', 'screen hidden', '');
  result.id = 'screen-result';
  result.innerHTML = `
    <div class="result-inner">
      <div class="result-title" id="result-title" data-i18n="result.lose"></div>
      <div class="result-badge hidden" id="result-badge" data-i18n="result.newRecord"></div>
      <ul class="result-rows">
        <li><span data-i18n="result.rank"></span><b id="result-rank">—</b></li>
        <li><span data-i18n="result.kills"></span><b id="result-kills">—</b></li>
        <li><span data-i18n="result.match"></span><b id="result-match">—</b></li>
        <li><span data-i18n="result.best"></span><b id="result-best">—</b></li>
      </ul>
      <div class="result-hint" data-i18n="result.hint"></div>
      <div class="pause-actions">
        <button id="btn-again" class="btn btn-primary" type="button" data-i18n="btn.again"></button>
        <button id="btn-share" class="btn btn-ghost" type="button" data-i18n="btn.share"></button>
      </div>
    </div>`;
  root.appendChild(result);

  // 设置
  const settings = el('div', 'screen hidden', '');
  settings.id = 'screen-settings';
  settings.innerHTML = `
    <div class="settings-inner">
      <div class="settings-title" data-i18n="set.title"></div>
      <div class="settings-row"><span data-i18n="set.language"></span><select id="lang-select-settings" class="lang-select" aria-label="Language"></select></div>
      <button id="btn-settings-back" class="btn btn-ghost" type="button" data-i18n="set.back"></button>
    </div>`;
  root.appendChild(settings);

  els.title = title;
  els.pause = pause;
  els.result = result;
  els.settings = settings;
  els.btnStart = document.getElementById('btn-start');
  els.btnHow = document.getElementById('btn-how');
  els.btnHowPause = document.getElementById('btn-how-pause');
  els.btnSettings = document.getElementById('btn-settings');
  els.btnResume = document.getElementById('btn-resume');
  els.btnAgain = document.getElementById('btn-again');
  els.btnShare = document.getElementById('btn-share');
  els.btnSettingsBack = document.getElementById('btn-settings-back');
  els.langSelects = [
    document.getElementById('lang-select'),
    document.getElementById('lang-select-pause'),
    document.getElementById('lang-select-settings'),
  ];
  els.resultTitle = document.getElementById('result-title');
  els.resultBadge = document.getElementById('result-badge');
  els.resultRank = document.getElementById('result-rank');
  els.resultKills = document.getElementById('result-kills');
  els.resultMatch = document.getElementById('result-match');
  els.resultBest = document.getElementById('result-best');
  return els;
}

function buildHud(root) {
  const hud = el('div', 'hud hidden', '');
  hud.id = 'hud';
  hud.innerHTML = `
    <div class="hud-bar">
      <span class="hud-item"><span class="hud-label" data-i18n="hud.match"></span><b id="hud-match">1</b></span>
      <span class="hud-item"><span class="hud-label" data-i18n="hud.alive"></span><b id="hud-alive">16</b></span>
      <span class="hud-item"><span class="hud-label" data-i18n="hud.kills"></span><b id="hud-kills">0</b></span>
      <span class="hud-item" id="hud-gas"><span data-i18n="gas.wait"></span> <b id="hud-gas-t">12</b>s</span>
      <span class="hud-spacer"></span>
      <span class="hud-item"><span class="hud-label" data-i18n="hud.hp"></span><b id="hud-hp-text">100</b></span>
      <span class="hud-item"><span class="hud-label" data-i18n="hud.weapon"></span><b id="hud-weapon">—</b> <b id="hud-ammo" class="hud-unit"></b></span>
      <span class="hud-bag" id="hud-bag"></span>
    </div>`;
  root.appendChild(hud);
  return {
    root: hud,
    match: document.getElementById('hud-match'),
    alive: document.getElementById('hud-alive'),
    kills: document.getElementById('hud-kills'),
    gas: document.getElementById('hud-gas'),
    gasT: document.getElementById('hud-gas-t'),
    hpFill: document.getElementById('hud-hp-fill'),
    hpText: document.getElementById('hud-hp-text'),
    weapon: document.getElementById('hud-weapon'),
    ammo: document.getElementById('hud-ammo'),
    bag: document.getElementById('hud-bag'),
  };
}

export function createUI(root, hooks = {}) {
  const els = buildScreens(root);
  const hud = buildHud(root);

  const machine = new TutorialMachine({
    save: (k, v) => Sdk.save(k, v),
    load: (k, d) => Sdk.load(k, d),
    key: TUTORIAL_KEY,
  });
  const overlay = createTutorialOverlay(root, machine);

  let lastHud = null;
  let lastResult = null;
  let bestRank = 0;
  let tutorialDoneCb = null;

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
    setBest(bestRank);
    if (lastResult) renderResult(lastResult);
    if (lastHud) setHud(lastHud);
    overlay.render();
  }

  function setBest(best) {
    bestRank = Math.max(0, Math.floor(best ?? 0));
    if (els.title) {
      const b = els.title.querySelector('.title-best');
      if (b) b.textContent = t('title.best', { rank: bestRank || '—' });
    }
  }

  function renderResult(data) {
    lastResult = data || {};
    const win = !!lastResult.win;
    els.resultTitle.textContent = t(win ? 'result.win' : 'result.lose');
    els.resultBadge.classList.toggle('hidden', !lastResult.newRecord);
    els.resultRank.textContent = lastResult.rank ?? '—';
    els.resultKills.textContent = lastResult.kills ?? '—';
    els.resultMatch.textContent = lastResult.match ?? '—';
    els.resultBest.textContent = lastResult.best ?? '—';
  }

  function setHud(h) {
    lastHud = h || {};
    hud.match.textContent = lastHud.match ?? 1;
    hud.alive.textContent = lastHud.alive ?? 0;
    hud.kills.textContent = lastHud.kills ?? 0;
    hud.hpText.textContent = `${lastHud.hp ?? 0}`;
    hud.weapon.textContent = t(`weapon.${lastHud.weaponName || 'none'}`);
    hud.ammo.textContent = `${lastHud.ammo ?? 0}/${lastHud.clip ?? 0}`;
    // 背包
    hud.bag.innerHTML = '';
    for (const it of lastHud.bag || []) {
      const b = el('span', 'hud-bag-slot', '');
      b.textContent = it === 'med' ? t('item.med') : t('item.armor');
      hud.bag.appendChild(b);
    }
    // 毒圈
    const gs = lastHud.gasState;
    if (gs === 'shrink') hud.gas.querySelector('span').textContent = t('gas.shrink');
    else if (lastHud.gasRadius <= 60) hud.gas.querySelector('span').textContent = t('gas.final');
    else hud.gas.querySelector('span').textContent = t('gas.wait');
    hud.gasT.textContent = `${Math.ceil(lastHud.gasSec ?? 0)}`;
  }

  function hideAll() {
    for (const key of ['title', 'pause', 'result', 'settings']) {
      els[key].classList.add('hidden');
    }
    hud.root.classList.add('hidden');
    overlay.hide();
  }

  function show(screen, data) {
    if (screen === 'dead' && data) renderResult(data);
    const isTitle = screen === 'title';
    const isPlaying = screen === 'playing';
    const isPaused = screen === 'paused';
    const isDead = screen === 'dead';
    const isSettings = screen === 'settings';

    els.title.classList.toggle('hidden', !isTitle);
    els.pause.classList.toggle('hidden', !isPaused);
    els.result.classList.toggle('hidden', !isDead);
    els.settings.classList.toggle('hidden', !isSettings);

    if (isPlaying) {
      hud.root.classList.remove('hidden');
      if (!machine.done && !machine.active) machine.begin();
      if (machine.active) overlay.show();
    } else {
      hud.root.classList.add('hidden');
      overlay.hide();
    }

    if (isTitle || isSettings) applyLang();
  }

  function finishTutorial(result) {
    overlay.hide();
    if (tutorialDoneCb) {
      try { tutorialDoneCb(result); } catch { /* noop */ }
    }
  }
  machine.onDone = finishTutorial;

  function onTutorial(cb) { tutorialDoneCb = cb || null; }

  for (const sel of els.langSelects) {
    if (!sel) continue;
    sel.addEventListener('change', (e) => { if (i18n.setLang(e.target.value)) applyLang(); });
  }

  const noop = () => {};
  els.btnStart.addEventListener('click', () => (hooks.onStart || noop)());
  els.btnResume.addEventListener('click', () => (hooks.onResume || noop)());
  els.btnAgain.addEventListener('click', () => (hooks.onRestart || noop)());
  els.btnShare.addEventListener('click', () => (hooks.onShare || noop)());
  els.btnSettings.addEventListener('click', () => show('settings'));
  els.btnSettingsBack.addEventListener('click', () => show('title'));

  const replay = () => { machine.replay(); overlay.show(); };
  els.btnHow.addEventListener('click', replay);
  els.btnHowPause.addEventListener('click', replay);

  applyLang();

  return {
    show,
    setHud,
    onTutorial,
    hideAll,
    setBest,
    setResult: (d) => renderResult(d),
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
      onGameEvent: (ev, now) => {
        const s = machine.onGameEvent(ev, now);
        overlay.render();
        return s;
      },
      tick: (now) => machine.tick(now),
      state: () => machine.snapshot(),
    },
    get lang() { return i18n.lang; },
    get dir() { return i18n.dir; },
  };
}

export default createUI;
