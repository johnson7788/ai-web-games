// UI 模块：标题 / 暂停 / 结算 / HUD + 多语言下拉（默认英文，zh 完整）。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';

const $ = (id) => document.getElementById(id);

export const ui = {
  titleScreen: $('screen-title'),
  pauseScreen: $('screen-pause'),
  resultScreen: $('screen-result'),
  hud: $('hud'),
  tutorial: $('tutorial'),
  rotateScreen: $('rotate-screen'),
  btnBlast: $('btn-blast'),
  langSelects: [$('lang-select'), $('lang-select-pause')].filter(Boolean),

  get lang() { return i18n.lang; },
  get dir() { return i18n.dir; },

  applyLang() {
    syncDocumentLang();
    const set = (id, key, vars) => { const el = $(id); if (el) el.textContent = t(key, vars); };
    set('title-text', 'title');
    set('subtitle-text', 'subtitle');
    set('btn-start', 'start');
    set('btn-resume', 'resume');
    set('btn-restart', 'restart');
    set('btn-restart2', 'restart');
    set('btn-retry', 'retry');
    set('btn-next', 'next');
    set('btn-home', 'home');
    set('btn-home2', 'home');
    set('btn-home3', 'home');
    set('btn-howto-title', 'howto');
    set('btn-tut-replay', 'howto');
    set('pause-title', 'paused');
    set('rotate-text', 'rotateHint');
    set('btn-rotate-skip', 'rotateSkip');
    set('tut-title', 'tutTitle');
    set('tut-next', 'tutNext');
    set('tut-skip', 'tutSkip');
    set('btn-blast-label', 'super');
    set('press-any', 'pressAny');
    for (const sel of this.langSelects) {
      if (sel) sel.setAttribute('aria-label', t('language'));
    }
    // 图标按钮保留图形，只更新可访问标签（避免长文案挤在圆形按钮里重叠）
    const mute = $('btn-mute');
    if (mute) mute.setAttribute('aria-label', mute.classList.contains('is-muted') ? t('unmute') : t('mute'));
    const howto = $('btn-howto');
    if (howto) howto.setAttribute('aria-label', t('howto'));
    const restart = $('btn-restart');
    if (restart) restart.setAttribute('aria-label', t('restart'));
    const home = $('btn-home');
    if (home) home.setAttribute('aria-label', t('home'));
    this.fillLangOptions();
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

  setLang(lang) {
    i18n.setLang(lang);
    this.applyLang();
    return i18n.lang;
  },

  showTitle() {
    this.titleScreen.classList.remove('hidden');
    this.pauseScreen.classList.add('hidden');
    this.resultScreen.classList.add('hidden');
    this.hud.classList.add('hidden');
    this.btnBlast.classList.add('hidden');
    this.applyLang();
  },

  showGame() {
    this.titleScreen.classList.add('hidden');
    this.pauseScreen.classList.add('hidden');
    this.resultScreen.classList.add('hidden');
    this.hud.classList.remove('hidden');
    this.btnBlast.classList.remove('hidden');
  },

  showPause() {
    this.pauseScreen.classList.remove('hidden');
    this.applyLang();
  },

  hidePause() {
    this.pauseScreen.classList.add('hidden');
  },

  showResult(won, stars, meta) {
    const title = $('result-title');
    title.textContent = t(won ? 'winTitle' : 'loseTitle');
    title.classList.toggle('lose', !won);
    const starsEl = $('result-stars');
    starsEl.innerHTML = won
      ? `<span class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>${stars >= 3 ? `<em>${t('perfect')}</em>` : ''}`
      : '';
    $('result-meta').textContent = meta;
    $('btn-next').style.display = won ? '' : 'none';
    this.resultScreen.classList.remove('hidden');
  },

  hideResult() {
    this.resultScreen.classList.add('hidden');
  },

  updateHud(h) {
    const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
    set('hud-targets', `${t('targets')} ${h.remaining}`);
    set('hud-wave', `${t('wave')} ${h.level}`);
    set('hud-score', h.score);
    set('hud-combo', h.combo > 1 ? `×${Math.min(8, 1 + Math.floor(h.combo / 4))}` : '');
    set('hud-kills', `${t('kills')} ${h.kills}`);
    set('hud-breach', `${t('breach')} ${h.leaks}/${h.leakLimit}`);
    const pct = Math.max(0, Math.min(100, (h.energy / 100) * 100));
    const fill = $('energy-fill');
    if (fill) fill.style.width = `${pct}%`;
    const ef = $('energy-fill');
    if (ef) ef.classList.toggle('ready', h.energy >= 100);
    set('energy-text', `⚡${Math.round(h.energy)}`);
    const sp = $('shield-pill');
    if (sp) sp.textContent = `${t('shield')} ${h.shield}`;
    const sb = $('btn-blast');
    if (sb) sb.classList.toggle('ready', h.energy >= 100);
  },

  setMuted(muted) {
    const b = $('btn-mute');
    if (b) b.classList.toggle('is-muted', muted);
    if (b) b.setAttribute('aria-label', t(muted ? 'unmute' : 'mute'));
  },

  updateBest(bestWave, totalStars) {
    const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
    set('best-wave', `${t('bestWave')}: ${bestWave}`);
    set('total-stars', `★ ${totalStars}`);
  },
};
