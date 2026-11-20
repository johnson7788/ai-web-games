// src/ui/index.js — DOM UI：标题 / HUD / 记牌器 / 动作条 / 暂停 / 结算。i18n 统一走 t()。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';
import { TIER_NAMES } from '../../config/gameplay.js';
import { rankLabel } from '../game/cards.js';
import { createTutorialOverlay, TutorialMachine } from './tutorial.js';

export function createUI(root, callbacks = {}, sdk = null) {
  const el = (id) => root.querySelector(`#${id}`);
  const cbs = callbacks;

  root.innerHTML = `
    <div id="screen-title" class="screen">
      <div class="title-inner">
        <div class="title-logo" data-i18n="title">CARD LORD</div>
        <div class="title-tagline" data-i18n="subtitle">Cyber Card Table</div>
        <div class="title-best" id="title-best"></div>
        <div class="title-actions">
          <button id="btn-start" class="btn btn-primary" data-i18n="start">Start</button>
          <button id="btn-how" class="btn btn-ghost" data-tutorial-replay data-i18n="how">How to play</button>
        </div>
      </div>
      <select id="lang-select" class="lang-select" aria-label="Language"></select>
    </div>

    <div id="hud" class="hud hidden">
      <div class="hud-left">
        <div class="hud-stat"><span class="hud-label" data-i18n="tier"></span><b id="hud-tier"></b></div>
        <div class="hud-stat"><span class="hud-label" data-i18n="multiplier"></span><b id="hud-mult"></b></div>
        <div class="hud-stat"><span class="hud-label" data-i18n="baseScore"></span><b id="hud-base"></b></div>
      </div>
      <div class="hud-center" id="hud-seats">
        <span class="seat-chip" id="seat-0"></span>
        <span class="seat-chip" id="seat-1"></span>
        <span class="seat-chip" id="seat-2"></span>
      </div>
      <div class="hud-right">
        <button id="btn-mute" class="btn btn-ghost hud-btn" type="button">♪</button>
      </div>
    </div>

    <div id="counter" class="counter hidden"></div>

    <div id="status" class="status hidden"></div>

    <div id="actions" class="actions hidden">
      <div class="actions-bid">
        <button class="btn btn-primary" data-bid="1">1</button>
        <button class="btn btn-primary" data-bid="2">2</button>
        <button class="btn btn-primary" data-bid="3">3</button>
        <button class="btn btn-ghost" data-bid="0" data-i18n="bidPass">Pass</button>
      </div>
      <div class="actions-double hidden">
        <button class="btn btn-primary" id="btn-double" data-i18n="double">Double</button>
        <button class="btn btn-ghost" id="btn-nodouble" data-i18n="noDouble">No</button>
      </div>
      <div class="actions-play hidden">
        <button class="btn btn-primary" id="btn-play" data-i18n="play">Play</button>
        <button class="btn btn-ghost" id="btn-pass" data-i18n="playPass">Pass</button>
        <button class="btn btn-ghost" id="btn-hint" data-i18n="hint">Hint</button>
      </div>
    </div>

    <div id="screen-pause" class="screen hidden">
      <div class="pause-inner">
        <div class="pause-title" data-i18n="paused">Paused</div>
        <div class="pause-actions">
          <button id="btn-resume" class="btn btn-primary" data-i18n="resume">Resume</button>
          <button id="btn-restart" class="btn btn-ghost" data-i18n="restart">Restart</button>
        </div>
        <select id="lang-select-pause" class="lang-select inline" aria-label="Language"></select>
      </div>
    </div>

    <div id="screen-result" class="screen hidden">
      <div class="result-inner">
        <div class="result-title" id="result-title"></div>
        <div class="result-badge" id="result-badge"></div>
        <ul class="result-rows" id="result-rows"></ul>
        <div class="result-actions">
          <button id="btn-next" class="btn btn-primary" data-i18n="next">Next Round</button>
          <button id="btn-replay" class="btn btn-ghost" data-i18n="replay">Play Again</button>
        </div>
      </div>
    </div>
  `;

  // ---------- 记牌器 ----------
  const counter = el('counter');
  const cells = new Map();
  for (let r = 3; r <= 17; r += 1) {
    const c = document.createElement('div');
    c.className = 'counter-cell';
    c.innerHTML = `<span class="cc-rank">${rankLabel(r)}</span><span class="cc-num">${r >= 16 ? 1 : 4}</span>`;
    counter.appendChild(c);
    cells.set(r, c);
  }

  // ---------- 状态 ----------
  const screens = {
    title: el('screen-title'),
    pause: el('screen-pause'),
    result: el('screen-result'),
  };

  function applyLangTexts() {
    root.querySelectorAll('[data-i18n]').forEach((n) => {
      n.textContent = t(n.getAttribute('data-i18n'));
    });
    fillLangOptions();
    el('btn-mute').textContent = SOUND_ON ? t('mute') : t('sound');
  }

  function fillLangOptions() {
    for (const sel of [el('lang-select'), el('lang-select-pause')]) {
      if (!sel) continue;
      sel.innerHTML = '';
      for (const item of i18n.options()) {
        const opt = document.createElement('option');
        opt.value = item.code;
        opt.textContent = item.name;
        if (item.code === i18n.lang) opt.selected = true;
        sel.appendChild(opt);
      }
    }
  }

  let SOUND_ON = true;

  function show(phase, payload = {}) {
    for (const k of Object.keys(screens)) screens[k].classList.add('hidden');
    el('hud').classList.add('hidden');
    el('counter').classList.add('hidden');
    el('status').classList.add('hidden');
    el('actions').classList.add('hidden');
    el('screen-result').classList.add('hidden');

    if (phase === 'title') {
      screens.title.classList.remove('hidden');
      setBest(payload.best);
    } else if (phase === 'playing') {
      el('hud').classList.remove('hidden');
      el('counter').classList.remove('hidden');
      el('status').classList.remove('hidden');
      el('actions').classList.remove('hidden');
    } else if (phase === 'paused') {
      screens.pause.classList.remove('hidden');
    } else if (phase === 'dead' || phase === 'result') {
      screens.result.classList.remove('hidden');
    }
  }

  function setBest(tier) {
    if (tier > 0) el('title-best').textContent = `${t('best')}: ${TIER_NAMES.en[tier - 1]}`;
    else el('title-best').textContent = '';
  }

  function setHud(hud, uiState = {}) {
    const tierName = TIER_NAMES[i18n.lang][hud.tier - 1] || TIER_NAMES.en[hud.tier - 1];
    el('hud-tier').textContent = `${hud.tier} · ${tierName}`;
    el('hud-mult').textContent = `×${hud.multiplier}`;
    el('hud-base').textContent = String(hud.baseScore);

    // 三家座位信息（牌数 + 地主标识）
    for (let s = 0; s < 3; s += 1) {
      const chip = el(`seat-${s}`);
      const name = s === 0 ? t('you') : t('ai') + (s === 1 ? '·L' : '·R');
      const isLord = hud.landlord === s;
      chip.textContent = `${isLord ? '♛ ' : ''}${name} · ${hud.handCounts[s]}`;
      chip.classList.toggle('lord', isLord);
      chip.classList.toggle('you', s === 0);
    }

    // 记牌器
    for (let r = 3; r <= 17; r += 1) {
      const cell = cells.get(r);
      const rem = hud.remaining ? hud.remaining[r] : (r >= 16 ? 1 : 4);
      cell.querySelector('.cc-num').textContent = String(rem);
      cell.classList.toggle('empty', rem === 0);
      cell.classList.toggle('low', rem === 1);
    }

    // 状态与动作条
    const isHumanTurn = uiState.isHumanTurn;
    const rp = hud.roundPhase;
    const actions = el('actions');
    const bidRow = actions.querySelector('.actions-bid');
    const doubleRow = actions.querySelector('.actions-double');
    const playRow = actions.querySelector('.actions-play');
    bidRow.classList.add('hidden');
    doubleRow.classList.add('hidden');
    playRow.classList.add('hidden');

    if (rp === 'bidding') {
      bidRow.classList.remove('hidden');
      el('status').textContent = isHumanTurn ? `${t('bidding')} — ${t('yourTurn')}` : `${t('bidding')} — ${t('waiting')}`;
      bidRow.querySelectorAll('button').forEach((b) => { b.disabled = !isHumanTurn; });
    } else if (rp === 'doubling') {
      doubleRow.classList.remove('hidden');
      el('status').textContent = isHumanTurn ? `${t('doubling')} — ${t('yourTurn')}` : `${t('doubling')} — ${t('waiting')}`;
      el('btn-double').disabled = !isHumanTurn;
      el('btn-nodouble').disabled = !isHumanTurn;
    } else if (rp === 'playing') {
      playRow.classList.remove('hidden');
      el('status').textContent = isHumanTurn ? t('yourTurn') : t('waiting');
      el('btn-play').disabled = !isHumanTurn || !(uiState.selectedIds && uiState.selectedIds.size);
      el('btn-pass').disabled = !isHumanTurn || (hud.lastPlay && hud.lastPlay.seat === 0) || !hud.lastPlay;
      el('btn-hint').disabled = !isHumanTurn;
    } else {
      el('status').textContent = '';
    }
  }

  function showResult(result, stats) {
    screens.result.classList.remove('hidden');
    el('screen-title').classList.add('hidden');
    el('hud').classList.add('hidden');
    el('counter').classList.add('hidden');
    el('status').classList.add('hidden');
    el('actions').classList.add('hidden');

    const isWin = result.humanWon;
    el('result-title').textContent = isWin ? t('win') : t('lose');
    const badges = [];
    if (result.spring) badges.push(t('spring'));
    if (result.antiSpring) badges.push(t('antiSpring'));
    if (isWin && stats) badges.push(`${t('rankUp')} ${stats.maxTier}`);
    el('result-badge').textContent = badges.join(' · ');
    el('result-badge').style.display = badges.length ? '' : 'none';

    const rows = el('result-rows');
    rows.innerHTML = '';
    const addRow = (label, value) => {
      const li = document.createElement('li');
      li.innerHTML = `<span>${label}</span><b>${value}</b>`;
      rows.appendChild(li);
    };
    addRow(t('tier'), `${result.tierBefore} → ${result.humanWon ? result.tierBefore + 1 : result.tierBefore}`);
    addRow(t('multiplier'), `×${result.multiplier}`);
    addRow(t('points'), `+${result.points}`);
    addRow(result.humanWon ? t('next') : t('replay'), '');

    el('btn-next').classList.toggle('hidden', !isWin);
    el('btn-replay').classList.toggle('hidden', isWin);
  }

  // ---------- 事件 ----------
  el('btn-start').addEventListener('click', () => cbs.onStart && cbs.onStart());
  el('btn-how').addEventListener('click', () => cbs.onHow && cbs.onHow());
  el('btn-resume').addEventListener('click', () => cbs.onResume && cbs.onResume());
  el('btn-restart').addEventListener('click', () => cbs.onRestart && cbs.onRestart());
  el('btn-next').addEventListener('click', () => cbs.onNext && cbs.onNext());
  el('btn-replay').addEventListener('click', () => cbs.onReplay && cbs.onReplay());
  el('btn-mute').addEventListener('click', () => {
    SOUND_ON = !SOUND_ON;
    el('btn-mute').textContent = SOUND_ON ? t('mute') : t('sound');
    cbs.onMute && cbs.onMute(SOUND_ON);
  });

  el('actions').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn || btn.disabled) return;
    if (btn.dataset.bid !== undefined) {
      cbs.onAction && cbs.onAction({ action: 'bid', bid: Number(btn.dataset.bid) });
    } else if (btn.id === 'btn-double') {
      cbs.onAction && cbs.onAction({ action: 'double', double: true });
    } else if (btn.id === 'btn-nodouble') {
      cbs.onAction && cbs.onAction({ action: 'double', double: false });
    } else if (btn.id === 'btn-play') {
      cbs.onAction && cbs.onAction({ action: 'play' });
    } else if (btn.id === 'btn-pass') {
      cbs.onAction && cbs.onAction({ action: 'pass' });
    } else if (btn.id === 'btn-hint') {
      cbs.onAction && cbs.onAction({ action: 'hint' });
    }
  });

  const langSelects = [el('lang-select'), el('lang-select-pause')];
  for (const sel of langSelects) {
    if (sel) sel.addEventListener('change', (e) => { if (cbs.onLang) cbs.onLang(e.target.value); });
  }

  // 引导（持久化走 Sdk.save/load，业务代码不直接碰 localStorage）
  const machine = new TutorialMachine({
    save: sdk && sdk.save ? (k, v) => sdk.save(k, v) : null,
    load: sdk && sdk.load ? (k, d) => sdk.load(k, d) : null,
  });
  const tutorialOverlay = createTutorialOverlay(root, machine, {});
  machine.onDone = () => {
    tutorialOverlay.hide();
    if (cbs.onTutorialDone) cbs.onTutorialDone();
  };

  return {
    show,
    setHud,
    setBest,
    showResult,
    applyLang: applyLangTexts,
    fillLangOptions,
    get tutorial() { return machine; },
    get tutorialOverlay() { return tutorialOverlay; },
    setLang: (l) => { i18n.setLang(l); applyLangTexts(); },
    syncDoc: syncDocumentLang,
  };
}

export default createUI;
