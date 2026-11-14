// M3 UI 模块：屏幕切换 + HUD + 升级三选一 + 结算 + 交互引导 + 事件总线。
// 约束：只渲染 main 给的 hud 快照（不读 run、不调 sim）；文案一律走 locales（t()）；
// 图标一律内联 SVG（不用 emoji）；只使用 index.html 已存在的节点，需要新样式只加 class。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';
import { UPGRADES, WEAPONS, RANKS, KARTS, RULES } from '../../config/game.config.js';
import Sdk from '../core/sdk.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const setText = (id, s) => { const n = $(id); if (n) n.textContent = s; };
const setAttr = (id, a, v) => { const n = $(id); if (n) n.setAttribute(a, v); };

// ---- 内联 SVG 图标（24×24，currentColor）----
const ICONS = {
  gun: '<circle cx="8" cy="12" r="5"/><rect x="12" y="10" width="9" height="4" rx="2"/>',
  rapid: '<circle cx="6" cy="12" r="2.6"/><circle cx="12" cy="12" r="2.6"/><circle cx="18" cy="12" r="2.6"/>',
  shotgun: '<circle cx="9" cy="12" r="5"/><circle cx="16.5" cy="7" r="2.2"/><circle cx="18" cy="12" r="2.2"/><circle cx="16.5" cy="17" r="2.2"/>',
  rocket: '<path d="M12 2c3 4 5 6.2 5 10a5 5 0 0 1-10 0c0-3.8 2-6 5-10z"/><path d="M7.5 15.5 4 20M16.5 15.5 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  bounce: '<path d="M4 15a8 8 0 0 1 14.5-4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M19 4v7h-7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 20H6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  triple: '<path d="M5 8l7-4 7 4M5 16l7-4 7 4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  trail: '<path d="M12 2c3.5 3 5.5 6 5.5 9.5a5.5 5.5 0 0 1-11 0C6.5 8 8.5 5 12 2z"/><path d="M12 22c-1.5-1.5-2.5-3-2.5-4.5a2.5 2.5 0 0 1 5 0c0 1.5-1 3-2.5 4.5z"/>',
  turbo: '<path d="M13 2 4 14h6l-2 8 9-12h-6l2-8z"/>',
  ram: '<path d="M12 2l8 3.2v6c0 5-3.5 8-8 10.8C7.5 19.2 4 16.2 4 11.2V5.2z"/><path d="M9 11h6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  ghost: '<path d="M12 3a7 7 0 0 1 7 7v10l-2.3-2-2.4 2-2.3-2-2.3 2-2.3-2L5 20V10a7 7 0 0 1 7-7z"/><circle cx="9.5" cy="11" r="1.3"/><circle cx="14.5" cy="11" r="1.3"/>',
  magnet: '<path d="M6 4h5v8a4 4 0 0 1-8 0V4h3v8a1 1 0 0 0 2 0V4z"/><path d="M13 4h5v8a4 4 0 0 1-8 0V4h3v8a1 1 0 0 0 2 0V4z"/>',
  lucky: '<path d="M12 2l2.6 6.4L21 10l-6.4 1.6L12 18l-2.6-6.4L3 10l6.4-1.6z"/>',
  armor: '<path d="M12 2l8 3.4v5.2c0 4.6-3.2 7.4-8 10.4-4.8-3-8-5.8-8-10.4V5.4z"/><path d="M9 10h6M9 13h6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  reload: '<path d="M17.5 7A8 8 0 1 0 19 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M19 3v5h-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  engine: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  pause: '<rect x="6" y="5" width="4" height="14" rx="1.2"/><rect x="14" y="5" width="4" height="14" rx="1.2"/>',
  'speaker-on': '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 9.5a3.5 3.5 0 0 1 0 5M18.5 7a7 7 0 0 1 0 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  'speaker-off': '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9l4 6M21 9l-4 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  crown: '<path d="M3 7l4.2 3.4L12 4l4.8 6.4L21 7l-1.2 11H4.2z"/><rect x="4.8" y="18" width="14.4" height="2" rx="1"/>',
  dot: '<circle cx="12" cy="12" r="5"/>',
};

function icon(name, cls) {
  return `<svg class="${cls || ''}" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">${ICONS[name] || ICONS.dot}</svg>`;
}
const shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
const formatTime = (sec) => { const s = Math.max(0, Math.ceil(sec || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

// ---- 事件总线 ----
const listeners = {};
function emit(evt, payload) { for (const fn of listeners[evt] || []) { try { fn(payload); } catch { /* 监听器异常不影响 UI */ } } }

// ---- 交互引导状态 ----
const tut = { active: false, step: 0, ids: [], list: [] };

function defaultSteps() {
  return [
    { id: 'drive', title: t('tut1Title'), body: t('tut1Body'), target: null },
    { id: 'drift', title: t('tut2Title'), body: t('tut2Body'), target: null },
    { id: 'boost', title: t('tut3Title'), body: t('tut3Body'), target: null },
    { id: 'crate', title: t('tut4Title'), body: t('tut4Body'), target: null },
  ];
}

function persistTutorial() { try { Sdk.save('tutorial', true); } catch { /* 隐私模式 */ } }

function renderTutorial() {
  const list = tut.list;
  const s = list[tut.step] || {};
  setText('tutorial-step', `${tut.step + 1}/${list.length}`);
  setText('tutorial-title', s.title || '');
  setText('tutorial-body', s.body || '');
  setText('tutorial-next', tut.step + 1 >= list.length ? t('tutorialDone') : t('tutorialNext'));
  $('tutorial').classList.remove('hidden');
  const spot = $('tutorial-spot');
  const target = s.target ? document.querySelector(s.target) : null;
  if (target && spot) {
    const r = target.getBoundingClientRect();
    const cr = $('tutorial').getBoundingClientRect();
    spot.style.display = 'block';
    spot.style.left = `${r.left - cr.left}px`;
    spot.style.top = `${r.top - cr.top}px`;
    spot.style.width = `${r.width}px`;
    spot.style.height = `${r.height}px`;
  } else if (spot) {
    spot.style.display = 'none';
  }
}

function hideTutorial() {
  tut.active = false;
  $('tutorial').classList.add('hidden');
}

const SCREENS = ['screen-title', 'screen-pause', 'screen-round', 'screen-end'];
function showScreen(id) { for (const s of SCREENS) $(s).classList.toggle('hidden', s !== id); }

export const ui = {
  _muted: false,
  _touch: false,
  _lastHud: null,
  _boardSig: '',
  _pipRound: -1,

  get lang() { return i18n.lang; },
  get dir() { return i18n.dir; },
  // main 的输入合成需要这几个触屏节点
  get joystick() { return $('joystick'); },
  get joystickKnob() { return $('joystick-knob'); },
  get fireBtn() { return $('fire-btn'); },
  get driftBtn() { return $('drift-btn'); },

  on(evt, cb) { (listeners[evt] ||= []).push(cb); },

  setLang(lang) { i18n.setLang(lang); this.applyLang(); return i18n.lang; },

  applyLang() {
    syncDocumentLang();
    setText('loading-text', t('loading'));
    setText('title-text', t('title'));
    setText('subtitle-text', t('subtitle'));
    setText('tagline-text', t('tagline'));
    setText('btn-start', t('start'));
    setText('btn-howto', t('howToPlay'));
    setText('how-to', t('howTo'));
    setText('pause-title', t('paused'));
    setText('btn-resume', t('resume'));
    setText('btn-restart', t('restartRun'));
    setText('btn-howto-pause', t('howToReplay'));
    setText('btn-title', t('backTitle'));
    setText('reduced-label', t('reducedMotion'));
    setText('btn-again', t('playAgain'));
    setText('btn-back', t('backTitle'));
    setText('hp-label', t('hp'));
    setText('boost-label', t('boost'));
    setText('respawn-note', t('respawn'));
    setText('fire-btn', t('fire'));
    setText('drift-btn', t('drift'));
    setText('rotate-text', t('title'));
    setText('tutorial-skip', t('tutorialSkip'));
    setAttr('lang-select', 'aria-label', t('language'));
    setAttr('lang-select-pause', 'aria-label', t('language'));
    setAttr('btn-pause', 'aria-label', t('paused'));
    this.fillLangOptions();
    this._renderMute();
    this._renderBest();
    if (tut.active) renderTutorial();
    if (this._lastHud) this.updateHUD(this._lastHud);
    if (!$('screen-round').classList.contains('hidden')) this._renderUpgrades(this._lastPicks);
  },

  fillLangOptions() {
    for (const id of ['lang-select', 'lang-select-pause']) {
      const sel = $(id);
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

  // ---- 屏幕切换 ----
  showTitle() {
    showScreen('screen-title');
    $('hud').classList.add('hidden');
    this._setTouch(false);
    this.applyLang();
  },
  showGame() {
    showScreen(null);
    $('hud').classList.remove('hidden');
    this._setTouch(this._touch);
  },
  showPause() { showScreen('screen-pause'); },
  hidePause() { $('screen-pause').classList.add('hidden'); },
  hideEnd() { $('screen-end').classList.add('hidden'); },

  showRoundEnd(o = {}) {
    showScreen('screen-round');
    $('hud').classList.remove('hidden');
    this._setTouch(false);
    setText('round-title', o.playerWon ? t('roundWin') : t('roundLose'));
    const arena = o.arenaName;
    setText('round-sub', typeof arena === 'string' ? arena : (arena ? (arena[i18n.lang] || arena.en) : t('nextRound')));
    setText('pick-hint', o.lastPick ? t('lastPick') : t('pickHint'));
    this._renderUpgrades(o.picks);
    this._lastPicks = o.picks;
  },

  showMatchEnd(o = {}) {
    showScreen('screen-end');
    $('hud').classList.add('hidden');
    this._setTouch(false);
    const title = $('end-title');
    setText('end-title', o.won ? t('youWin') : t('youLose'));
    title.className = o.won ? 'win' : 'lose';
    const rank = RANKS.find((r) => r.id === o.rank) || RANKS[RANKS.length - 1];
    const badge = $('rank-badge');
    badge.textContent = o.rank || 'C';
    badge.style.background = rank.color;
    badge.setAttribute('aria-label', `${t('rank')}: ${o.rank || 'C'}`);
    const stats = $('end-stats');
    stats.innerHTML = '';
    for (const [k, v] of [[t('score'), o.score ?? 0], [t('smash'), o.kills ?? 0], [t('koed'), o.deaths ?? 0], [t('cups'), o.roundsWon ?? 0]]) {
      const row = document.createElement('div');
      row.className = 'stat-row';
      const key = document.createElement('span'); key.className = 'stat-key'; key.textContent = k;
      const val = document.createElement('span'); val.className = 'stat-val'; val.textContent = v;
      row.append(key, val);
      stats.appendChild(row);
    }
    const near = $('end-near');
    if (!o.won && typeof o.nearMiss === 'number' && o.nearMiss > 0) {
      near.textContent = o.nearMiss === 1 ? t('nearMiss', { n: o.nearMiss }) : t('nearMissPlural', { n: o.nearMiss });
      near.classList.remove('hidden');
    } else {
      near.classList.add('hidden');
    }
  },

  // ---- HUD ----
  updateHUD(hud) {
    this._lastHud = hud;
    const p = hud.player || {};
    const maxHp = p.maxHp || 100;
    const hpFrac = clamp((p.hp ?? maxHp) / maxHp, 0, 1);
    const hpFill = $('hp-fill');
    if (hpFill) {
      hpFill.style.width = `${hpFrac * 100}%`;
      hpFill.classList.toggle('hp-good', hpFrac > 0.5);
      hpFill.classList.toggle('hp-mid', hpFrac > 0.25 && hpFrac <= 0.5);
      hpFill.classList.toggle('hp-low', hpFrac <= 0.25);
    }
    const boost = clamp(p.boost ?? 0, 0, 1);
    const boostFill = $('boost-fill');
    if (boostFill) boostFill.style.width = `${boost * 100}%`;
    $('boost-flash').classList.toggle('hidden', boost < 1);
    const wp = WEAPONS[p.weapon] || WEAPONS.gun;
    $('weapon-icon').innerHTML = icon(wp.icon || 'gun', 'ui-icon');
    setText('weapon-name', wp.name[i18n.lang] || wp.name.en);
    setText('weapon-ammo', Number.isFinite(p.ammo) ? `${p.ammo}` : '∞');
    setText('timer', formatTime(hud.timeLeft));
    const round = hud.roundIndex ?? 0;
    if (round !== this._pipRound) { this._pipRound = round; this._renderPips(round); }
    setText('kill-goal', t('goal', { n: hud.killTarget ?? RULES.killTarget }));
    const board = hud.board || hud.scores || [];
    const sig = board.map((b) => `${b.id ?? b.name ?? b.kartId ?? ''}:${b.kills ?? 0}`).join(',');
    if (sig !== this._boardSig) { this._boardSig = sig; this._renderBoard(board); }
    const cd = $('countdown');
    if (hud.countdown != null) {
      cd.classList.remove('hidden');
      cd.textContent = hud.countdown > 0 ? String(hud.countdown) : t('countdown');
    } else {
      cd.classList.add('hidden');
    }
    $('respawn-note').classList.toggle('hidden', !p.dead);
  },

  _renderPips(current) {
    const box = $('round-pips');
    box.innerHTML = '';
    const total = RULES.rounds || 3;
    for (let i = 0; i < total; i += 1) {
      const d = document.createElement('span');
      d.className = 'pip' + (i < current ? ' done' : '') + (i === current ? ' now' : '');
      box.appendChild(d);
    }
  },

  _renderBoard(board) {
    const box = $('scoreboard');
    box.innerHTML = '';
    const rows = [...board].sort((a, b) => (b.kills || 0) - (a.kills || 0));
    for (const b of rows) {
      const row = document.createElement('div');
      row.className = 'score-row' + (b.isPlayer ? ' is-player' : '') + (b.isChampion ? ' is-champion' : '');
      const dot = document.createElement('span');
      dot.className = 'score-dot';
      dot.style.background = b.color || 'var(--ink)';
      const name = document.createElement('span');
      name.className = 'score-name';
      name.textContent = b.name || (b.isPlayer ? t('you') : (KARTS[b.kartId] ? KARTS[b.kartId].name : ''));
      const val = document.createElement('span');
      val.className = 'score-val';
      val.textContent = b.kills ?? 0;
      row.append(dot, name);
      if (b.isChampion) { const c = document.createElement('span'); c.className = 'crown'; c.innerHTML = icon('crown', 'ui-icon'); row.append(c); }
      row.append(val);
      box.appendChild(row);
    }
  },

  _renderUpgrades(picks) {
    const box = $('upgrade-cards');
    box.innerHTML = '';
    const pool = Array.isArray(picks) && picks.length
      ? picks.map((p) => UPGRADES.find((u) => u.id === (typeof p === 'string' ? p : p.id))).filter(Boolean)
      : shuffle([...UPGRADES]).slice(0, 3);
    for (const u of pool) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'upgrade-card';
      card.innerHTML = `<span class="upgrade-icon">${icon(u.icon, 'ui-icon')}</span>`
        + `<span class="upgrade-name">${u.name[i18n.lang] || u.name.en}</span>`
        + `<span class="upgrade-desc">${u.desc[i18n.lang] || u.desc.en}</span>`;
      card.addEventListener('click', () => { $('screen-round').classList.add('hidden'); emit('upgrade', u.id); });
      box.appendChild(card);
    }
  },

  // ---- 触屏 / 摇杆 ----
  setTouch(on) { this._touch = on; this._setTouch(on); },
  _setTouch(on) {
    $('joystick').classList.toggle('hidden', !on);
    $('fire-btn').classList.toggle('hidden', !on);
    $('drift-btn').classList.toggle('hidden', !on);
  },
  setKnob(dx, dy) { const k = $('joystick-knob'); if (k) k.style.transform = `translate(${dx}px, ${dy}px)`; },
  setBoostPulse(v) { const m = document.querySelector('.boost-meter'); if (m) m.classList.toggle('pulse', !!v); },

  // ---- 静音 / 最佳分（供 main 同步，图标由 UI 自理）----
  updateMute(muted) { this._muted = muted; this._renderMute(); },
  _renderMute() {
    const n = $('btn-mute');
    if (!n) return;
    n.innerHTML = icon(this._muted ? 'speaker-off' : 'speaker-on', 'ui-icon');
    n.setAttribute('aria-label', `${t('sound')}: ${this._muted ? t('off') : t('on')}`);
  },
  _renderBest() {
    const best = Number(Sdk.load('best', 0)) || 0;
    setText('title-best', best > 0 ? `${t('best')}: ${best}` : '');
  },

  // ---- 交互引导 ----
  tutorial: {
    get active() { return tut.active; },
    get step() { return tut.step; },
    get steps() { return tut.ids; },
    get current() { return tut.ids[tut.step] ?? null; },
    start(steps) {
      const list = Array.isArray(steps) && steps.length ? steps : defaultSteps();
      tut.list = list;
      tut.ids = list.map((s, i) => s.id || String(i));
      tut.step = 0;
      tut.active = true;
      renderTutorial();
    },
    next() {
      if (!tut.active) return;
      if (tut.step + 1 >= tut.list.length) { this.finish(); return; }
      tut.step += 1;
      renderTutorial();
    },
    skip() { if (tut.active) { persistTutorial(); hideTutorial(); emit('tutorial-end', 'skip'); } },
    finish() { if (tut.active) { persistTutorial(); hideTutorial(); emit('tutorial-end', 'finish'); } },
  },

  // 最高分（main 在启动/结算/切语言后调用）
  updateBest(score, rank) {
    const s = Number(score) || 0;
    setText('title-best', s > 0 ? `${t('best')}: ${s}${rank ? ` · ${t('rank')} ${rank}` : ''}` : '');
  },
};

// ---- 一次性接线：DOM 事件 → 事件总线 ----
function wire(id, evt) { const n = $(id); if (n) n.addEventListener('click', () => emit(evt)); }

function init() {
  wire('btn-start', 'start');
  wire('btn-resume', 'resume');
  wire('btn-restart', 'restart');
  wire('btn-again', 'again');
  wire('btn-title', 'title');
  wire('btn-back', 'title');
  wire('btn-pause', 'pause');
  wire('btn-howto', 'howto');
  wire('btn-howto-pause', 'howto');
  const mute = $('btn-mute');
  if (mute) mute.addEventListener('click', () => { ui._muted = !ui._muted; ui._renderMute(); emit('mute', ui._muted); });
  const pauseBtn = $('btn-pause');
  if (pauseBtn) pauseBtn.innerHTML = icon('pause', 'ui-icon');
  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = $(id);
    if (sel) sel.addEventListener('change', () => { ui.setLang(sel.value); emit('lang', sel.value); });
  }
  const chk = $('chk-reduced');
  if (chk) {
    chk.checked = matchMedia('(prefers-reduced-motion: reduce)').matches;
    chk.addEventListener('change', () => emit('reduced', chk.checked));
  }
  const next = $('tutorial-next'); if (next) next.addEventListener('click', () => ui.tutorial.next());
  const skip = $('tutorial-skip'); if (skip) skip.addEventListener('click', () => ui.tutorial.skip());
  const mq = matchMedia('(orientation: portrait)');
  const updateRotate = () => $('rotate-hint').classList.toggle('hidden', !mq.matches);
  if (mq.addEventListener) mq.addEventListener('change', updateRotate); else mq.addListener(updateRotate);
  updateRotate();
  ui.applyLang();
}

init();
