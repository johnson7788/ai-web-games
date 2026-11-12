// HUD / 覆盖屏 / 提示条：DOM 只在这里读写，所有玩家可见文案走 t('key')。
import { AI, BALL, BALL_COLORS, WORLD } from '../../config/game.config.js';
import { i18n, syncDocumentLang, t } from '../core/i18n.js';
import { kindOf } from '../game/balls.js';
import { PLAYER, RIVAL } from '../game/match.js';

const GROUP_IDS = { solid: BALL.SOLID, stripe: BALL.STRIPE };
const TOAST_MS = 1900;

const el = (id) => document.getElementById(id);

// 每帧都会调用，写入前先比对，避免无谓的 DOM 写。
function setText(node, text) {
  if (node && node.textContent !== text) node.textContent = text;
}

function chip(id, alive) {
  const span = document.createElement('span');
  span.className = alive ? 'ball' : 'ball gone';
  const color = BALL_COLORS[id];
  if (color) span.style.setProperty('--bc', color);
  if (kindOf(id) === 'stripe') span.classList.add('stripe');
  span.textContent = String(id);
  span.setAttribute('aria-hidden', 'true');
  return span;
}

export const ui = {
  root: el('game-container'),
  canvas: el('canvas'),
  hud: el('hud'),
  nameYou: el('name-you'),
  groupYou: el('group-you'),
  ballsYou: el('balls-you'),
  nameRival: el('name-rival'),
  groupRival: el('group-rival'),
  ballsRival: el('balls-rival'),
  cardYou: el('card-you'),
  cardRival: el('card-rival'),
  turnLabel: el('turn-label'),
  turnSub: el('turn-sub'),
  btnSound: el('btn-sound'),
  btnPause: el('btn-pause'),
  btnRestart: el('btn-restart'),
  toast: el('toast'),
  hint: el('hint'),
  titleScreen: el('screen-title'),
  pauseScreen: el('screen-pause'),
  resultScreen: el('screen-result'),
  titleText: el('title-text'),
  subtitleText: el('subtitle-text'),
  labelAi: el('label-ai'),
  aiSelect: el('ai-select'),
  recordLabel: el('record-label'),
  recordValue: el('record-value'),
  btnStart: el('btn-start'),
  howtoText: el('howto-text'),
  pauseTitle: el('pause-title'),
  btnResume: el('btn-resume'),
  btnQuit: el('btn-quit'),
  resultPanel: el('result-panel'),
  resultTitle: el('result-title'),
  resultDesc: el('result-desc'),
  resultShots: el('result-shots'),
  btnAgain: el('btn-again'),
  langSelects: [el('lang-select'), el('lang-select-pause'), el('lang-select-hud')],

  lastHud: null,
  lastChips: '',
  toastTimer: 0,

  get lang() {
    return i18n.lang;
  },

  get dir() {
    return i18n.dir;
  },

  // —— 语言 ——
  applyLang() {
    syncDocumentLang();
    this.titleText.textContent = t('title');
    this.subtitleText.textContent = t('subtitle');
    this.btnStart.textContent = t('start');
    this.howtoText.textContent = t('howto');
    this.labelAi.textContent = t('aiLevel');
    this.recordLabel.textContent = t('record');
    this.pauseTitle.textContent = t('paused');
    this.btnResume.textContent = t('resume');
    this.btnQuit.textContent = t('btn_restart');
    this.btnAgain.textContent = t('play_again');
    this.btnPause.setAttribute('aria-label', t('btn_pause'));
    this.btnRestart.setAttribute('aria-label', t('btn_restart'));
    this.btnSound.setAttribute('aria-label', t('btn_sound'));

    for (const opt of this.aiSelect.querySelectorAll('option')) {
      opt.textContent = t(`level_${opt.value}`);
    }
    for (const sel of this.langSelects) {
      if (sel) sel.setAttribute('aria-label', t('language'));
    }
    this.fillLangOptions();
    if (this.lastHud) this.updateHud(this.lastHud, true);
  },

  fillLangOptions() {
    for (const sel of this.langSelects) {
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
  },

  setLang(code) {
    i18n.setLang(code);
    this.applyLang();
    return i18n.lang;
  },

  setAiLevel(level) {
    if (AI.LEVELS[level]) this.aiSelect.value = level;
    return this.aiSelect.value;
  },

  // —— 尺寸：letterbox 下保持控件物理尺寸 ——
  setScale(scale) {
    const k = Math.max(1, Math.min(scale, 2.2));
    document.documentElement.style.setProperty('--k', String(+k.toFixed(3)));
    this.root.style.width = `${Math.round(WORLD.WIDTH * scale)}px`;
    this.root.style.height = `${Math.round(WORLD.HEIGHT * scale)}px`;
  },

  // —— 屏幕切换 ——
  showTitle(record) {
    this.titleScreen.classList.remove('hidden');
    this.pauseScreen.classList.add('hidden');
    this.resultScreen.classList.add('hidden');
    this.hud.classList.add('hidden');
    this.hideToast();
    this.setHint('');
    if (record) this.updateRecord(record);
    this.applyLang();
  },

  showGame() {
    this.titleScreen.classList.add('hidden');
    this.pauseScreen.classList.add('hidden');
    this.resultScreen.classList.add('hidden');
    this.hud.classList.remove('hidden');
  },

  showPause() {
    this.pauseScreen.classList.remove('hidden');
    this.applyLang();
  },

  hidePause() {
    this.pauseScreen.classList.add('hidden');
  },

  showResult(hud) {
    const win = hud.result === 'win';
    this.resultPanel.classList.toggle('win', win);
    this.resultPanel.classList.toggle('lose', !win);
    this.resultTitle.textContent = t(win ? 'win_title' : 'lose_title');
    this.resultDesc.textContent = t(resultDescKey(hud));
    this.resultShots.textContent = `${t('result_shots')}: ${hud.shots[PLAYER]}`;
    this.resultScreen.classList.remove('hidden');
    this.hideToast();
  },

  hideResult() {
    this.resultScreen.classList.add('hidden');
  },

  updateRecord(record) {
    this.recordValue.textContent = `${record.wins | 0} / ${record.losses | 0}`;
  },

  // —— 局内 HUD ——
  updateHud(hud, force = false) {
    this.lastHud = hud;
    const myGroup = hud.groups[PLAYER];
    const rivalGroup = hud.groups[RIVAL];

    setText(this.nameYou, t('you'));
    setText(this.nameRival, t('rival'));
    setText(this.groupYou, t(myGroup || 'open'));
    setText(this.groupRival, t(rivalGroup || 'open'));

    const youActive = hud.turn === PLAYER && hud.phase !== 'over';
    this.cardYou.classList.toggle('active', youActive);
    this.cardRival.classList.toggle('active', !youActive && hud.phase !== 'over');

    const over = hud.phase === 'over';
    setText(this.turnLabel, over
      ? t(hud.result === 'win' ? 'win_title' : 'lose_title')
      : (hud.isBreak ? t('break_label') : t(hud.turn === PLAYER ? 'turn_you' : 'turn_rival')));
    setText(this.turnSub, over
      ? ''
      : (hud.thinking ? t('thinking') : `${t('shots')}: ${hud.shots[PLAYER] + hud.shots[RIVAL]}`));

    const chips = `${myGroup}:${hud.left[PLAYER].join(',')}|${rivalGroup}:${hud.left[RIVAL].join(',')}`;
    if (force || chips !== this.lastChips) {
      this.lastChips = chips;
      this.paintChips(this.ballsYou, myGroup, hud.left[PLAYER]);
      this.paintChips(this.ballsRival, rivalGroup, hud.left[RIVAL]);
    }

    this.setHint(hud.ballInHand && hud.turn === PLAYER && hud.phase !== 'over' ? t('ball_in_hand') : '');
  },

  paintChips(container, group, remaining) {
    container.innerHTML = '';
    const ids = GROUP_IDS[group];
    if (!ids) return;
    for (const id of ids) container.appendChild(chip(id, remaining.indexOf(id) >= 0));
  },

  // —— 提示条 ——
  setHint(text) {
    if (!text) {
      this.hint.classList.add('hidden');
      return;
    }
    if (this.hint.textContent !== text) this.hint.textContent = text;
    this.hint.classList.remove('hidden');
  },

  toast(text, tone = '') {
    this.toast.textContent = text;
    this.toast.className = `toast${tone ? ` ${tone}` : ''}`;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.hideToast(), TOAST_MS);
  },

  hideToast() {
    clearTimeout(this.toastTimer);
    this.toast.className = 'toast hidden';
  },

  setSound(muted) {
    this.btnSound.classList.toggle('off', !!muted);
    this.btnSound.setAttribute('aria-label', t(muted ? 'btn_muted' : 'btn_sound'));
    this.btnSound.setAttribute('aria-pressed', muted ? 'true' : 'false');
  },

  setCursor(mode) {
    const cls = mode === 'drag' ? 'dragging' : mode === 'grab' ? 'aiming' : mode === 'hand' ? 'hand' : '';
    if (this.canvas.className !== cls) this.canvas.className = cls;
  },
};

function resultDescKey(hud) {
  if (hud.result === 'win') return 'win_desc';
  if (hud.resultReason === 'early') return 'lose_early';
  if (hud.resultReason === 'scratch') return 'lose_scratch';
  return 'lose_rival';
}

export function foulText(foul) {
  return t(`foul_${foul.reason}`);
}
