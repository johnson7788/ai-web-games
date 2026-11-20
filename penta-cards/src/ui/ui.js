// src/ui/ui.js — 屏幕 / HUD / 动作条 / 结算卡（DOM 装配与 i18n）。
// 玩家可见文案一律走 t(key)，不硬编码。
import { t, i18n } from '../core/i18n.js';

const SCREENS = ['screen-title', 'screen-pause', 'screen-settings', 'screen-round', 'screen-session'];
const SCREEN_MAP = {
  title: 'screen-title',
  paused: 'screen-pause',
  settings: 'screen-settings',
  roundEnd: 'screen-round',
  sessionEnd: 'screen-session',
  playing: null,
};

export function createUI(root, cbs = {}) {
  const $ = (sel) => root.querySelector(sel);
  const langSelect = $('#lang-select');
  const langSelectSettings = $('#lang-select-settings');
  const hud = $('#hud');
  const statusEl = $('#status');
  const actionBar = $('#action-bar');

  // 动作按钮
  const buttons = {
    draw: $('#btn-draw'),
    stargaze: $('#btn-stargaze'),
    swap: $('#btn-swap'),
    hu: $('#btn-hu'),
    gang: $('#btn-gang'),
    peng: $('#btn-peng'),
    pass: $('#btn-pass'),
  };

  function applyLang() {
    root.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    populateLangSelects();
  }

  function populateLangSelects() {
    const opts = i18n.options();
    for (const sel of [langSelect, langSelectSettings]) {
      if (!sel) continue;
      sel.innerHTML = '';
      for (const o of opts) {
        const opt = document.createElement('option');
        opt.value = o.code;
        opt.textContent = o.name;
        if (o.code === i18n.lang) opt.selected = true;
        sel.appendChild(opt);
      }
    }
  }

  function show(screen) {
    const target = SCREEN_MAP[screen] || null;
    for (const id of SCREENS) {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('hidden', id !== target);
    }
    hud.classList.toggle('hidden', screen !== 'playing' && screen !== 'paused');
    statusEl.classList.toggle('hidden', screen !== 'playing');
    actionBar.classList.toggle('hidden', screen !== 'playing');
  }

  function setHud(h) {
    $('#hud-round').textContent = `${h.round}/${h.totalRounds}`;
    $('#hud-bet').textContent = String(h.baseBet);
    $('#hud-chips').textContent = String(h.chips);
    $('#hud-wall').textContent = String(h.wallRemaining);
    $('#hud-scene-name').textContent = t('scene.' + h.scene);
    $('#hud-abilities').innerHTML =
      `✦${h.stargazeLeft} <span class="hud-unit">·</span> ⇄${h.swapLeft}`;
  }

  function setStatus(msg) {
    statusEl.textContent = msg;
  }

  function setActionBar(kind, options = {}) {
    const all = ['draw', 'stargaze', 'swap', 'hu', 'gang', 'peng', 'pass'];
    for (const k of all) buttons[k].hidden = true;
    if (kind === 'turnStart') {
      if (options.stargaze) buttons.stargaze.hidden = false;
      if (options.swap) buttons.swap.hidden = false;
      buttons.draw.hidden = false;
    } else if (kind === 'discard') {
      if (options.canHu) buttons.hu.hidden = false;
      if (options.canGang) buttons.gang.hidden = false;
    } else if (kind === 'claim') {
      if (options.hu) buttons.hu.hidden = false;
      if (options.gang) buttons.gang.hidden = false;
      if (options.peng) buttons.peng.hidden = false;
      buttons.pass.hidden = false;
    }
  }

  function hideActionBar() {
    for (const k of Object.keys(buttons)) buttons[k].hidden = true;
  }

  function setBest(rank) {
    $('#title-best').textContent = rank ? t('title.best', { rank }) : '';
  }

  function setRoundResult({ won, draw, fan, score, chips, round, totalRounds }) {
    $('#round-title').textContent = draw ? t('result.draw') : won ? t('result.win') : t('result.lose');
    $('#round-badge').classList.toggle('hidden', true);
    $('#round-fan').textContent = String(fan);
    $('#round-score').textContent = (score >= 0 ? '+' : '') + score;
    $('#round-chips').textContent = String(chips);
    $('#round-num').textContent = `${round}/${totalRounds}`;
  }

  function setSessionResult({ rank, chips, maxFan, isRecord }) {
    $('#session-title').textContent = chips > 0 ? t('result.sessionWin') : t('result.sessionLose');
    $('#session-badge').classList.toggle('hidden', !isRecord);
    $('#session-rank').textContent = String(rank);
    $('#session-chips').textContent = String(chips);
    $('#session-fan').textContent = String(maxFan);
  }

  // 事件绑定
  if (buttons.draw) buttons.draw.addEventListener('click', () => cbs.onAction?.('draw'));
  if (buttons.stargaze) buttons.stargaze.addEventListener('click', () => cbs.onAction?.('stargaze'));
  if (buttons.swap) buttons.swap.addEventListener('click', () => cbs.onAction?.('swap'));
  if (buttons.hu) buttons.hu.addEventListener('click', () => cbs.onAction?.('hu'));
  if (buttons.gang) buttons.gang.addEventListener('click', () => cbs.onAction?.('gang'));
  if (buttons.peng) buttons.peng.addEventListener('click', () => cbs.onAction?.('peng'));
  if (buttons.pass) buttons.pass.addEventListener('click', () => cbs.onAction?.('pass'));
  $('#btn-start')?.addEventListener('click', () => cbs.onStart?.());
  $('#btn-how')?.addEventListener('click', () => cbs.onHow?.());
  $('#btn-settings')?.addEventListener('click', () => cbs.onSettings?.());
  $('#btn-pause-settings')?.addEventListener('click', () => cbs.onSettings?.());
  $('#btn-close-settings')?.addEventListener('click', () => cbs.onCloseSettings?.());
  $('#btn-resume')?.addEventListener('click', () => cbs.onResume?.());
  $('#btn-restart')?.addEventListener('click', () => cbs.onRestart?.());
  $('#btn-session-restart')?.addEventListener('click', () => cbs.onRestart?.());
  $('#btn-next')?.addEventListener('click', () => cbs.onNext?.());

  function bindLang() {
    for (const sel of [langSelect, langSelectSettings]) {
      sel?.addEventListener('change', () => {
        cbs.onLang?.(sel.value);
      });
    }
  }
  bindLang();

  return {
    applyLang,
    show,
    setHud,
    setStatus,
    setActionBar,
    hideActionBar,
    setBest,
    setRoundResult,
    setSessionResult,
    buttons,
  };
}
