// LAST LINE —— UI 层：屏幕切换、HUD、字卡、升级三选一、设置/画册/死亡/结局。
// 契约见 docs/stickman/README.md §6.3。只碰 DOM 与样式，不写玩法。
// 所有文案走 t()；DOM 节点复用（HUD 每帧只更新 textContent/width，不重建）。
import { t, getLang } from '../core/i18n.js';
import * as Save from '../core/save.js';

const $ = (s) => document.querySelector(s);
const screens = {};
let handlers = {};
let hudEl = null;
let current = null;
let currentData = null;
let showToken = 0;
let toastTimer = 0;

// ───────────────────────────── 升级图标（墨线符号，inline SVG）
const ICONS = {
  speed: '<path d="M4 12h8M4 7h14M4 17h14M15 9l4 3-4 3"/>',
  drop: '<path d="M12 3c3 4 5 6.6 5 9a5 5 0 0 1-10 0c0-2.4 2-5 5-9z"/>',
  magnet: '<path d="M6 3v7a6 6 0 0 0 12 0V3M8 3v6h8V3"/>',
  recoil: '<path d="M12 20V7M6 13l6-6 6 6M4 20h16"/>',
  split: '<path d="M4 12h6M10 12l6-6M10 12l6 6"/>',
  arrow: '<path d="M2 12h20M16 6l6 6-6 6"/><circle cx="10" cy="12" r="3.5"/>',
  splash: '<path d="M12 3c2.6 3.4 4.2 5.8 4.2 7.8a4.2 4.2 0 0 1-8.4 0c0-2 1.6-4.4 4.2-7.8z"/><path d="M4 18l-1.5 1.5M20 18l1.5 1.5M12 21v2"/>',
  wind: '<path d="M3 8h10a2 2 0 1 0-2-2M3 12h15a2 2 0 1 1-2 2M3 16h7"/>',
  feather: '<path d="M20 4c-6 0-11 3-13 8-1 2.5-1 5 0 6 1 1 3.5.5 5-1.5 1.5-2 3.5-5 4.5-9z"/><path d="M20 4c-1 4-4 8-8 11M8 18h8"/>',
  brush: '<path d="M5 19L19 5M15 5l4 4M14 10l-4 4"/>',
  heart: '<path d="M12 20s-7-4.6-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.4-7 10-7 10z"/>',
  combo: '<circle cx="9" cy="12" r="4"/><circle cx="15" cy="12" r="4"/>',
  regen: '<path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M17 3v4h-4"/>',
  line: '<path d="M3 12h18M3 8h18" opacity=".45"/>',
  shield: '<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z"/>',
};
function icon(name) {
  const body = ICONS[name] || ICONS.line;
  return `<svg class="up-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}
// ponytail: 升级没有稀有度字段，用 id 派生 1–3 个小点做装饰
function rarityDots(id = '') {
  return ((id.charCodeAt(0) || 0) + id.length) % 3 + 1;
}

// ───────────────────────────── 工具
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function setActFor(screen, data) {
  if (screen === 'title' || screen === 'story' || screen === 'loading') document.body.dataset.act = 'draft';
  else if (screen === 'ending') document.body.dataset.act = 'blank';
  else if (screen === 'act' && data.actId) document.body.dataset.act = data.actId;
  // playing/pause/upgrade/actclear/dead/gallery/settings 沿用当前幕配色
}

function syncHud(screen) {
  hudEl?.classList.toggle('is-hidden', screen !== 'playing' && screen !== 'pause');
}

// ───────────────────────────── 屏幕切换（旧屏 200ms 淡出，禁止双屏同显）
function show(screen, data = {}) {
  if (current === 'story' && screen !== 'story') stopStory();
  if (screen !== 'playing' && current !== screen) {
    const toast = $('#toast');
    if (toast) toast.classList.add('is-hidden');
  }
  currentData = data;
  setActFor(screen, data);
  if (screen === current) { renderFor(screen, data); syncHud(screen); return; }
  const token = ++showToken;
  const oldEl = current ? screens[current] : null;
  // 快速连续切屏时，上一段过渡的 setTimeout 会被 token 取消，
  // 导致旧屏永远留在 is-active。这里强制清掉所有"非当前"的活动屏。
  Object.values(screens).forEach((el) => {
    if (el !== oldEl && el.classList.contains('is-active')) el.classList.remove('is-active', 'is-exit', 'is-enter');
  });
  current = screen;
  const commit = () => {
    if (token !== showToken) return;
    if (oldEl) oldEl.classList.remove('is-active', 'is-exit');
    const el = screens[screen];
    if (el) {
      el.classList.remove('is-exit');
      el.classList.add('is-active', 'is-enter');
      setTimeout(() => el.classList.remove('is-enter'), 320);
    }
    syncHud(screen);
    renderFor(screen, data);
  };
  if (oldEl && oldEl.classList.contains('is-active')) {
    oldEl.classList.add('is-exit');
    setTimeout(commit, 200);
  } else {
    commit();
  }
}

function hideAll() {
  Object.values(screens).forEach((el) => el.classList.remove('is-active', 'is-exit', 'is-enter'));
  current = null;
}

function renderFor(screen, data) {
  if (screen === 'title') renderTitle(data);
  else if (screen === 'act') renderAct(data);
  else if (screen === 'upgrade') renderUpgrade(data.cards || [], data.pick, data.meta || {});
  else if (screen === 'actclear') renderActClear(data);
  else if (screen === 'settings') renderSettings(data);
  else if (screen === 'gallery') renderGallery(data);
  else if (screen === 'dead') renderDead(data);
  else if (screen === 'ending') renderEnding(data);
  else if (screen === 'loading') renderLoading();
}

// ───────────────────────────── 标题
function renderTitle(data = {}) {
  const best = $('#best-score');
  if (best) best.textContent = t('bestScore', { score: data.best ?? Save.load().best ?? 0 });
  const cont = $('#btn-continue');
  cont?.classList.toggle('is-hidden', !((data.continueAct ?? Save.load().bestAct) > 0));
  staggerLogo();
}
function staggerLogo() {
  const el = $('.logo-main');
  if (!el) return;
  el.innerHTML = 'LAST LINE'.split('').map((ch, i) =>
    `<span style="--i:${i}">${ch === ' ' ? '&nbsp;' : ch}</span>`).join('');
}

// ───────────────────────────── 幕卡 / 幕终
function renderAct(data = {}) {
  $('#act-no').textContent = data.no || '';
  $('#act-name').textContent = data.name || '';
  $('#act-sub').textContent = data.sub || '';
  $('#act-quote').textContent = data.quote ? `“${data.quote}”` : '';
  $('#btn-act-enter').textContent = t('act.enter');
}
function renderActClear(data = {}) {
  $('#clear-sub').textContent = data.sub || t('act.clearSub');
  $('#clear-bonus').textContent = data.bonus || '';
  $('#clear-quote').textContent = data.quote ? `“${data.quote}”` : '';
}

// ───────────────────────────── 设置
function renderSettings(data = {}) {
  const s = { ...Save.load().settings, ...data };
  const music = $('#set-music'); if (music) music.value = s.music;
  const musicVal = $('#set-music-val'); if (musicVal) musicVal.textContent = s.music;
  const sfx = $('#set-sfx'); if (sfx) sfx.value = s.sfx;
  const sfxVal = $('#set-sfx-val'); if (sfxVal) sfxVal.textContent = s.sfx;
  const shake = $('#set-shake'); if (shake) shake.dataset.on = String(!!s.shake);
  setSegment('#set-quality', s.quality);
  setSegment('#set-lang', getLang());
}
function setSegment(sel, value) {
  document.querySelectorAll(`${sel} button`).forEach((btn) => btn.classList.toggle('on', btn.dataset.value === value));
}

// ───────────────────────────── 画册
function renderGallery(data = {}) {
  const got = new Set(data.lore || Save.load().lore || []);
  const grid = $('#gallery-grid');
  if (!grid) return;
  grid.innerHTML = '';
  for (let i = 1; i <= 8; i += 1) {
    const unlocked = got.has(i);
    const card = document.createElement('div');
    card.className = `lore-card${unlocked ? ' got' : ''}`;
    card.innerHTML = `<small>${String(i).padStart(2, '0')}</small>${unlocked ? t(`lore.${i}`) : t('gallery.locked')}`;
    grid.appendChild(card);
  }
  const count = $('#gallery-count');
  if (count) count.textContent = t('gallery.count', { got: got.size, all: 8 });
}

// ───────────────────────────── 死亡 / 结局
function renderDead(data = {}) {
  $('#dead-stats').textContent = [
    `${t('result.score')} ${data.score ?? 0}`,
    `${t('result.kills')} ${data.kills ?? 0}`,
    `${t('result.time')} ${data.time ?? '00:00'}`,
  ].join('  ·  ');
  $('#dead-tip').textContent = data.tip || '';
}
function renderEnding(data = {}) {
  $('#ending-btns').classList.remove('is-hidden');
  $('#ending-after').classList.add('is-hidden');
  $('#ending-title').textContent = '';
  $('#ending-text').textContent = '';
  $('#ending-stats').textContent = [
    `${t('result.score')} ${data.score ?? 0}`,
    `${t('result.kills')} ${data.kills ?? 0}`,
    `${t('result.time')} ${data.time ?? '00:00'}`,
    `${t('result.best')} ${data.best ?? 0}`,
  ].join('   ·   ');
}

// ───────────────────────────── 加载
function renderLoading() {
  const tip = $('#loading-tip');
  if (tip) tip.textContent = t(`load.tip.${1 + Math.floor(Math.random() * 3)}`);
  const mark = $('.load-mark');
  if (mark && !mark.querySelector('.ink-drop')) mark.insertAdjacentHTML('beforeend', '<span class="ink-drop"></span>');
}
function setLoading(p) {
  const fill = $('#loading-fill');
  const pct = $('#loading-pct');
  if (fill) fill.style.width = `${Math.round(p * 100)}%`;
  if (pct) pct.textContent = `${Math.round(p * 100)}%`;
}

// ───────────────────────────── 开场字卡（打字机）
let storyCards = [];
let storyIndex = 0;
let storyDone = null;
let typingTimer = null;

function story(cards, done) {
  storyCards = cards || [];
  storyIndex = 0;
  storyDone = done;
  show('story');
  typeCard();
}
function typeCard() {
  stopTyping();
  const el = $('#story-text');
  if (!el) return;
  const text = storyCards[storyIndex] || '';
  let i = 0;
  el.textContent = '';
  el.classList.add('typing');
  typingTimer = setInterval(() => {
    i += 1;
    el.textContent = text.slice(0, i);
    if (i >= text.length) { stopTyping(); el.classList.remove('typing'); }
  }, 34);
}
function stopTyping() {
  if (typingTimer) clearInterval(typingTimer);
  typingTimer = null;
}
function advanceStory() {
  const el = $('#story-text');
  const full = storyCards[storyIndex] || '';
  if (el && el.textContent.length < full.length) {
    stopTyping();
    el.textContent = full;
    el.classList.remove('typing');
    return;
  }
  storyIndex += 1;
  if (storyIndex >= storyCards.length) { endStory(); return; }
  screens.story?.classList.toggle('deep', storyIndex >= 2);
  typeCard();
}
function endStory() {
  stopTyping();
  const done = storyDone;
  storyDone = null;
  if (done) done();
}
function stopStory() {
  stopTyping();
  storyCards = [];
  storyIndex = 0;
  storyDone = null;
  screens.story?.classList.remove('deep');
}

// ───────────────────────────── 升级三选一
function upgrade(cards, pick, meta = {}) {
  show('upgrade', { cards, pick, meta });
}
function renderUpgrade(cards, pick, meta) {
  const wrap = $('#upgrade-cards');
  if (!wrap) return;
  wrap.innerHTML = '';
  for (const card of cards) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'upgrade-card';
    btn.innerHTML = `${icon(card.icon)}<h3>${t(card.nameKey)}</h3><p>${t(card.descKey)}</p><span class="up-dots">${'<i></i>'.repeat(rarityDots(card.id))}</span>`;
    btn.addEventListener('click', () => {
      btn.classList.add('picked');
      setTimeout(() => pick?.(card.id), 260);
    });
    wrap.appendChild(btn);
  }
  const foot = $('#upgrade-ink');
  if (foot) foot.textContent = meta.ink != null ? `${t('hud.ink')} ${Math.round(meta.ink)} / ${Math.round(meta.inkMax)}` : '';
}

// ───────────────────────────── 结局二选一
function ending(data = {}) {
  show('ending', data);
}
function endingChoice(choice) {
  const kicker = document.querySelector('.ending-kicker');
  if (kicker) kicker.classList.add('is-hidden');
  $('#ending-title').textContent = t(`ending.${choice}.title`);
  $('#ending-text').textContent = t(`ending.${choice}.text`);
  $('#ending-btns').classList.add('is-hidden');
  $('#ending-after').classList.remove('is-hidden');
  Save.patch({ ending: choice });
}

// ───────────────────────────── HUD（每帧调用，只更新不重建）
let dashMax = 2;
let comboTimer = 0;
let lastCombo = 0;

function hud(state) {
  if (state == null) { hudEl?.classList.add('is-hidden'); return; }
  hudEl?.classList.remove('is-hidden');
  const inkPct = clamp((state.ink / state.inkMax) * 100, 0, 100);
  const fill = $('#hud-ink-fill'); if (fill) fill.style.width = `${inkPct}%`;
  const ghost = $('#hud-ink-ghost'); if (ghost) ghost.style.width = `${inkPct}%`;
  const inkText = $('#hud-ink-text'); if (inkText) inkText.textContent = Math.ceil(state.ink);
  hudEl.classList.toggle('low', inkPct < 30);

  const act = $('#hud-act'); if (act) act.textContent = t('hud.act', { n: (state.act ?? 0) + 1 });
  const wave = $('#hud-wave'); if (wave) wave.textContent = t('hud.wave', { n: state.wave });
  const score = $('#hud-score'); if (score) score.textContent = state.score;

  const combo = $('#hud-combo');
  if (combo) {
    if (state.combo > 1) {
      combo.textContent = t('hud.combo', { n: state.combo });
      combo.classList.remove('is-hidden');
      if (state.combo > lastCombo) {
        combo.classList.remove('fade', 'pop');
        void combo.offsetWidth; // 重放弹跳动画
        combo.classList.add('pop');
        clearTimeout(comboTimer);
        comboTimer = setTimeout(() => combo.classList.add('fade'), 2000);
      }
    } else {
      combo.classList.add('is-hidden');
      clearTimeout(comboTimer);
    }
  }
  lastCombo = state.combo;

  const weapon = $('#hud-weapon'); if (weapon) weapon.textContent = t(`weapon.${state.weapon}`);
  const weaponWrap = $('.hud-weapon');
  const ammo = $('#hud-ammo');
  if (ammo) {
    ammo.textContent = state.reloading ? t('hud.reload') : `${state.mag}/${state.magMax}`;
    weaponWrap?.classList.toggle('reloading', !!state.reloading);
  }

  const dashWrap = $('#hud-dash');
  if (dashWrap) {
    const want = state.dashMax || 2;
    if (dashMax !== want) {
      dashMax = want;
      dashWrap.innerHTML = '<i></i>'.repeat(dashMax);
    }
    dashWrap.querySelectorAll('i').forEach((el, i) => el.classList.toggle('on', i < (state.dash || 0)));
  }

  const boss = $('#hud-boss');
  if (boss) {
    if (state.bossMax > 0) {
      boss.classList.remove('is-hidden');
      const bfill = $('#hud-boss-fill');
      if (bfill) bfill.style.width = `${clamp((state.bossHp / state.bossMax) * 100, 0, 100)}%`;
    } else {
      boss.classList.add('is-hidden');
    }
  }
}

// ───────────────────────────── toast / flash
function toast(text, kind = '') {
  const el = $('#toast');
  if (!el) return;
  el.textContent = text || '';
  if (!text) { el.classList.add('is-hidden'); return; }
  el.dataset.kind = kind || '';
  el.classList.remove('is-hidden', 'show');
  void el.offsetWidth;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('is-hidden'), 2200);
}
function flash(strength = 0.3) {
  const el = $('#flash');
  if (!el) return;
  el.style.transition = 'none';
  el.style.opacity = String(clamp(strength, 0, 1));
  requestAnimationFrame(() => {
    el.style.transition = 'opacity .25s ease-out';
    el.style.opacity = '0';
  });
}

// ───────────────────────────── 语言 / 刷新
function setLang() { refresh(); }
function refresh() {
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  if (current) renderFor(current, currentData || {});
}

function isBlocking() { return current && current !== 'playing'; }

// ───────────────────────────── 接线
function init(nextHandlers) {
  handlers = nextHandlers || {};
  document.querySelectorAll('[data-screen]').forEach((el) => { screens[el.dataset.screen] = el; });
  hudEl = $('#hud');

  const on = (id, fn) => $(id)?.addEventListener('click', fn);
  on('#btn-play', () => handlers.onPlay?.());
  on('#btn-continue', () => handlers.onContinue?.());
  on('#btn-gallery', () => handlers.onGallery?.());
  on('#btn-settings', () => handlers.onSettings?.());
  on('#btn-story-skip', () => endStory());
  on('#btn-act-enter', () => handlers.onActEnter?.());
  on('#btn-act-continue', () => handlers.onActContinue?.());
  on('#btn-resume', () => handlers.onResume?.());
  on('#btn-restart', () => handlers.onRestart?.());
  on('#btn-pause-settings', () => handlers.onSettings?.());
  on('#btn-quit', () => handlers.onQuit?.());
  on('#btn-settings-back', () => handlers.onBack?.());
  on('#btn-gallery-back', () => handlers.onBack?.());
  on('#btn-retry', () => handlers.onRetry?.());
  on('#btn-dead-quit', () => handlers.onDeadQuit?.());
  on('#btn-ending-again', () => handlers.onEndingAgain?.());
  on('#btn-ending-gallery', () => handlers.onGallery?.());
  on('#btn-rotate-continue', () => handlers.onRotateContinue?.());
  on('#btn-end-finish', () => handlers.onEndingChoice?.('finish'));
  on('#btn-end-blank', () => handlers.onEndingChoice?.('blank'));

  $('#set-music')?.addEventListener('input', (e) => {
    $('#set-music-val').textContent = e.target.value;
    handlers.onSetting?.('music', Number(e.target.value));
  });
  $('#set-sfx')?.addEventListener('input', (e) => {
    $('#set-sfx-val').textContent = e.target.value;
    handlers.onSetting?.('sfx', Number(e.target.value));
  });
  $('#set-shake')?.addEventListener('click', (e) => {
    const next = e.currentTarget.dataset.on !== 'true';
    e.currentTarget.dataset.on = String(next);
    handlers.onSetting?.('shake', next);
  });
  document.querySelectorAll('#set-quality button').forEach((btn) => {
    btn.addEventListener('click', () => {
      setSegment('#set-quality', btn.dataset.value);
      handlers.onSetting?.('quality', btn.dataset.value);
    });
  });
  document.querySelectorAll('#set-lang button').forEach((btn) => {
    btn.addEventListener('click', () => {
      setSegment('#set-lang', btn.dataset.value);
      handlers.onSetting?.('lang', btn.dataset.value);
    });
  });
  on('#btn-reset', () => { if (confirm(t('settings.resetConfirm'))) handlers.onReset?.(); });

  screens.story?.addEventListener('click', (e) => {
    if (e.target.closest('button')) return;
    advanceStory();
  });

  document.body.dataset.act = 'draft';
}

const UI = {
  init, show, hideAll, hud, toast, flash, setLoading,
  story, upgrade, ending, endingChoice,
  isBlocking, setLang, refresh,
  get current() { return current; },
};
export { UI };
export default UI;
