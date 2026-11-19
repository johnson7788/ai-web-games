// UI 模块：标题/暂停/结算/商店/复活/竖屏提示/教程 + 多语言下拉。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';
import { save } from '../core/save.js';

const $ = (id) => document.getElementById(id);

export const ui = {
  canvas: $('canvas'),
  hud: $('hud'),
  hudLevel: $('hud-level'),
  hudWave: $('hud-wave'),
  hpFill: $('hp-fill'),
  hudCombo: $('hud-combo'),
  hudGold: $('hud-gold'),
  hudLives: $('hud-lives'),
  titleScreen: $('screen-title'),
  pauseScreen: $('screen-pause'),
  resultScreen: $('screen-result'),
  shopScreen: $('screen-shop'),
  reviveOverlay: $('revive-overlay'),
  rotateScreen: $('rotate-screen'),
  tutorial: $('tutorial'),
  tutCard: $('tut-card'),
  tutTitle: $('tut-title'),
  tutText: $('tut-text'),
  tutSkip: $('tut-skip'),
  tutNext: $('tut-next'),
  titleText: $('title-text'),
  subtitleText: $('subtitle-text'),
  pauseTitle: $('pause-title'),
  btnStart: $('btn-start'),
  btnResume: $('btn-resume'),
  btnNext: $('btn-next'),
  btnRetry: $('btn-retry'),
  btnMute: $('btn-mute'),
  resultTitle: $('result-title'),
  resultStars: $('result-stars'),
  resultMeta: $('result-meta'),
  reviveTitle: $('revive-title'),
  reviveHint: $('revive-hint'),
  reviveCount: $('revive-count'),
  shopTitle: $('shop-title'),
  shopGold: $('shop-gold'),
  shopList: $('shop-list'),
  shopClose: $('btn-shop-close'),
  langSelects: [$('lang-select'), $('lang-select-pause')],

  get lang() { return i18n.lang; },
  get dir() { return i18n.dir; },

  applyLang() {
    syncDocumentLang();
    this.titleText.textContent = t('title');
    this.subtitleText.textContent = t('subtitle');
    this.btnStart.textContent = t('start');
    this.btnResume.textContent = t('resume');
    this.pauseTitle.textContent = t('paused');
    this.btnNext.textContent = t('next');
    this.btnRetry.textContent = t('retry');
    this.shopTitle.textContent = t('shop');
    this.reviveTitle.textContent = t('reviveTitle');
    this.reviveHint.textContent = t('reviveHint');
    $('btn-restart').textContent = '↻';
    $('btn-restart2').textContent = t('restart');
    $('btn-home').textContent = '⌂';
    $('btn-home2').textContent = t('menu');
    $('btn-home3').textContent = t('menu');
    $('btn-howto').textContent = '?';
    $('btn-howto-title').textContent = t('howto');
    $('btn-tut-replay').textContent = t('replay');
    $('btn-shop').textContent = '+';
    $('btn-shop-title').textContent = t('shop');
    $('btn-shop2').textContent = t('shop');
    $('btn-mute').textContent = this._muted ? '🔇' : '🔊';
    $('rotate-text').textContent = t('rotateText');
    $('btn-rotate-skip').textContent = t('rotateSkip');
    this.shopClose.textContent = t('menu');
    for (const sel of this.langSelects) {
      if (sel) sel.setAttribute('aria-label', t('language'));
    }
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

  setMuted(m) {
    this._muted = m;
    const b = $('btn-mute');
    b.textContent = m ? '🔇' : '🔊';
  },

  showTitle() {
    this.titleScreen.classList.remove('hidden');
    this.titleScreen.classList.add('is-active');
    this.pauseScreen.classList.add('hidden');
    this.resultScreen.classList.add('hidden');
    this.shopScreen.classList.add('hidden');
    this.hud.classList.add('hidden');
    this.reviveOverlay.classList.add('hidden');
    this.applyLang();
  },

  showGame() {
    this.titleScreen.classList.add('hidden');
    this.titleScreen.classList.remove('is-active');
    this.pauseScreen.classList.add('hidden');
    this.resultScreen.classList.add('hidden');
    this.shopScreen.classList.add('hidden');
    this.hud.classList.remove('hidden');
    this.reviveOverlay.classList.add('hidden');
  },

  showPause() {
    this.pauseScreen.classList.remove('hidden');
    this.applyLang();
  },

  hidePause() {
    this.pauseScreen.classList.add('hidden');
  },

  showResult(type, meta) {
    this.hud.classList.add('hidden');
    this.resultScreen.classList.remove('hidden');
    this.resultTitle.textContent = t(type === 'win' ? 'resultWin' : 'resultLose');
    let stars = '';
    const n = meta.stars || 0;
    for (let i = 0; i < 3; i += 1) stars += i < n ? '★' : '☆';
    this.resultStars.textContent = stars;
    this.resultStars.className = `win-stars s${n}`;
    const lines = [];
    if (type === 'win') {
      lines.push(`${t('earned')}: ${meta.gold ?? 0}`);
      if ((meta.combo ?? 0) > 0) lines.push(`${t('starCombo')}: ${meta.combo}`);
      this.btnNext.classList.remove('hidden');
    } else {
      this.btnNext.classList.add('hidden');
    }
    this.resultMeta.innerHTML = lines.map((l) => `<div>${l}</div>`).join('');
    this.applyLang();
  },

  hideResult() {
    this.resultScreen.classList.add('hidden');
  },

  showShop(state) {
    this.shopScreen.classList.remove('hidden');
    this.shopGold.textContent = `${t('gold')}: ${state.gold}`;
    this.shopList.innerHTML = '';
    for (const row of state.rows) {
      const div = document.createElement('div');
      div.className = 'shop-row';
      const info = document.createElement('div');
      info.className = 'shop-info';
      info.innerHTML = `<span class="shop-name">${row.name}</span><span class="shop-lv">Lv ${row.level}/${row.max}</span>`;
      const btn = document.createElement('button');
      btn.className = 'shop-buy';
      btn.textContent = row.maxed ? t('maxed') : `${t('buy')} ${row.cost}`;
      btn.disabled = row.maxed || state.gold < row.cost;
      btn.addEventListener('click', () => row.onBuy());
      div.appendChild(info);
      div.appendChild(btn);
      this.shopList.appendChild(div);
    }
    this.applyLang();
  },

  hideShop() {
    this.shopScreen.classList.add('hidden');
  },

  showRevive(count) {
    this.reviveOverlay.classList.remove('hidden');
    this.reviveCount.textContent = String(count);
  },

  hideRevive() {
    this.reviveOverlay.classList.add('hidden');
  },

  updateHud(hud) {
    this.hudLevel.textContent = `${t('level')} ${hud.level}`;
    this.hudWave.textContent = `${t('wave')} ${hud.wave}/${hud.waveCount}`;
    this.hpFill.style.width = `${Math.round(hud.hpPct * 100)}%`;
    this.hudCombo.textContent = hud.combo > 1 ? `${t('combo')} ×${hud.combo}` : '';
    this.hudGold.textContent = `¤ ${hud.gold}`;
    const hearts = '♥'.repeat(Math.max(0, hud.lives)) + (hud.shield > 0 ? '◆'.repeat(hud.shield) : '');
    this.hudLives.textContent = hearts;
  },

  showTutorial() {
    this.tutorial.classList.remove('hidden');
  },

  hideTutorial() {
    this.tutorial.classList.add('hidden');
  },

  renderTutorialStep(step, steps) {
    this.tutTitle.textContent = t('tutTitle');
    this.tutText.textContent = t(step);
    this.tutSkip.textContent = t('tutSkip');
    this.tutNext.textContent = step === steps[steps.length - 1] ? t('tutNext') : t('tutNext');
  },
};
