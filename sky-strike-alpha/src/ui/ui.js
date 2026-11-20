// SKY STRIKE ALPHA · UI 模块：语言 + 屏幕显隐 + HUD + 结算。
// main.js 负责装配；这里只做 DOM 读写，不含游戏逻辑。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';
import { CONFIG } from '../../config/game.config.js';

const $ = (id) => document.getElementById(id);

export const ui = {
  get lang() { return i18n.lang; },
  get dir() { return i18n.dir; },

  applyLang() {
    syncDocumentLang();
    const set = (id, key) => { const el = $(id); if (el) el.textContent = t(key); };
    set('title-text', 'title');
    set('subtitle-text', 'subtitle');
    set('btn-start', 'start');
    set('pause-title', 'paused');
    set('btn-resume', 'resume');
    set('btn-restart2', 'restart');
    set('btn-tut-replay', 'replayGuide');
    set('btn-home3', 'home');
    set('btn-retry', 'retry');
    set('btn-next', 'nextLevel');
    set('btn-home2', 'home');
    set('hud-warp-label', 'warp');
    set('best-label', 'best');
    set('rotate-text', 'rotateHint');
    set('btn-rotate-skip', 'rotateSkip');
    set('tut-skip', 'tutSkip');
    set('tut-next', 'tutNext');
    set('tut-title', 'tutTitle');
    for (const sel of ['lang-select', 'lang-select-pause']) {
      const el = $(sel);
      if (el) el.setAttribute('aria-label', t('language'));
    }
    this.fillLangOptions();
  },

  fillLangOptions() {
    for (const selId of ['lang-select', 'lang-select-pause']) {
      const sel = $(selId);
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

  setLang(lang) {
    i18n.setLang(lang);
    this.applyLang();
    return i18n.lang;
  },

  showTitle() {
    $('screen-title').classList.remove('hidden');
    $('screen-title').classList.add('is-active');
    $('screen-pause').classList.add('hidden');
    $('screen-result').classList.add('hidden');
    $('hud').classList.add('hidden');
    this.applyLang();
  },

  showGame() {
    $('screen-title').classList.add('hidden');
    $('screen-title').classList.remove('is-active');
    $('screen-pause').classList.add('hidden');
    $('screen-result').classList.add('hidden');
    $('hud').classList.remove('hidden');
  },

  showPause() {
    $('screen-pause').classList.remove('hidden');
    this.applyLang();
  },

  hidePause() {
    $('screen-pause').classList.add('hidden');
  },

  showResult(res) {
    const won = res.won;
    const title = $('result-title');
    title.textContent = t(won ? 'winTitle' : 'loseTitle');
    title.classList.toggle('lose', !won);
    const starsEl = $('result-stars');
    starsEl.innerHTML = won
      ? `<span class="stars">${'★'.repeat(res.stars)}${'☆'.repeat(3 - res.stars)}</span>${res.stars >= 3 ? `<em>${t('perfect')}</em>` : ''}`
      : '';
    const meta = $('result-meta');
    if (won) {
      meta.innerHTML = `${t('score')} ${res.score} · ${t('coreResult')} ${res.coresCollected}/${res.coresSpawned}${res.hitsTaken === 0 ? ` · <em>${t('damageFree')}</em>` : ''}`;
    } else {
      meta.textContent = t(res.reason === 'crashGround' ? 'crashGround' : res.reason === 'crashRock' ? 'crashRock' : 'crashWall');
    }
    $('btn-next').style.display = won ? '' : 'none';
    $('screen-result').classList.remove('hidden');
  },

  hideResult() {
    $('screen-result').classList.add('hidden');
  },

  updateHud(hud, best) {
    const lv = $('hud-level');
    if (lv) lv.textContent = `${t('level')} ${hud.level}`;
    const score = $('hud-score');
    if (score) score.textContent = `${t('score')} ${hud.score}`;
    const cores = $('hud-cores');
    if (cores) cores.textContent = `${t('cores')} ${hud.cores}`;
    const combo = $('hud-combo');
    if (combo) {
      combo.textContent = `${t('combo')} ×${hud.combo}`;
      combo.classList.toggle('hot', hud.combo >= 4);
      combo.style.display = hud.combo > 1 ? '' : 'none';
    }
    const fill = $('hud-warp-fill');
    if (fill) {
      const pct = Math.max(0, Math.min(100, (hud.warp / hud.warpMax) * 100));
      fill.style.width = `${pct}%`;
      fill.classList.toggle('low', pct < 25);
    }
    const shield = $('hud-shield');
    if (shield) {
      shield.style.display = hud.shieldHits > 0 ? '' : 'none';
      shield.textContent = `🛡 ${hud.shieldHits}`;
    }
    const bestEl = $('hud-best');
    if (bestEl) bestEl.textContent = `${t('best')} ${best}`;
  },

  setMuted(muted) {
    const b = $('btn-mute');
    if (b) {
      b.textContent = muted ? '🔇' : '🔊';
      b.classList.toggle('is-muted', muted);
    }
  },

  setBest(value) {
    const el = $('best-value');
    if (el) el.textContent = String(value);
  },
};
