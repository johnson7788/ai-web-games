// GET ON BUS 3D · DOM UI（标题/暂停/结算/HUD/教程/竖屏提示 + 多语言）
import { i18n, t, syncDocumentLang } from '../core/i18n.js';
import { LEVEL_COUNT } from '../../config/levels.js';

const $ = (id) => document.getElementById(id);

export const ui = {
  titleScreen: $('screen-title'),
  pauseScreen: $('screen-pause'),
  resultScreen: $('screen-result'),
  hud: $('hud'),
  rotateScreen: $('rotate-screen'),
  tutorialOverlay: $('tutorial'),

  titleText: $('title-text'),
  subtitleText: $('subtitle-text'),
  pauseTitle: $('pause-title'),
  btnStart: $('btn-start'),
  btnResume: $('btn-resume'),
  btnRetry: $('btn-retry'),
  btnNext: $('btn-next'),
  levelGrid: $('level-grid'),
  resultTitle: $('result-title'),
  resultStars: $('result-stars'),
  resultMeta: $('result-meta'),
  resultCoins: $('result-coins'),
  tutTitle: $('tut-title'),
  tutText: $('tut-text'),
  tutNext: $('tut-next'),
  tutSkip: $('tut-skip'),
  rotateText: $('rotate-text'),

  hudLevel: $('hud-level'),
  hudGoal: $('hud-goal'),
  hudCoins: $('hud-coins'),
  hudFares: $('hud-fares'),
  hudCombo: $('hud-combo'),
  hudShield: $('hud-shield'),
  hudSpeed: $('hud-speed'),
  btnMute: $('btn-mute'),

  langSelects: [$('lang-select'), $('lang-select-pause')],

  get lang() {
    return i18n.lang;
  },
  get dir() {
    return i18n.dir;
  },

  applyLang() {
    syncDocumentLang();
    this.titleText.textContent = t('title');
    this.subtitleText.textContent = t('subtitle');
    this.btnStart.textContent = t('start');
    this.btnResume.textContent = t('resume');
    this.btnRetry.textContent = t('retry');
    this.btnNext.textContent = t('next');
    this.pauseTitle.textContent = t('paused');
    this.rotateText.textContent = t('rotateText');
    const rs = this.rotateScreen?.querySelector('#btn-rotate-skip');
    if (rs) rs.textContent = t('rotateSkip');
    for (const sel of this.langSelects) {
      if (sel) sel.setAttribute('aria-label', t('language'));
    }
    this.fillLangOptions();
    // 刷新教程当前步文案（如果正在显示）
    if (this.tutorialOverlay && !this.tutorialOverlay.classList.contains('hidden')) {
      const step = Number(this.tutorialOverlay.dataset.step || 0);
      this.renderTutStep(step);
    }
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
    this.hideAll();
    this.titleScreen.classList.remove('hidden');
    this.titleScreen.classList.add('is-active');
    this.applyLang();
  },

  showGame() {
    this.hideAll();
    this.hud.classList.remove('hidden');
  },

  showPause() {
    this.pauseScreen.classList.remove('hidden');
    this.applyLang();
  },

  hidePause() {
    this.pauseScreen.classList.add('hidden');
  },

  showResult(data) {
    this.hideAll();
    this.resultScreen.classList.remove('hidden');
    this.resultTitle.textContent = data.won ? t('resultTitle') : t('resultCrash');
    this.resultStars.textContent = '★'.repeat(data.stars || 0) + '☆'.repeat(Math.max(0, 3 - (data.stars || 0)));
    this.resultCoins.textContent = `${t('coinsEarned')}: ${data.coins}`;
    this.resultMeta.textContent = `${t('faresDelivered')}: ${data.delivered}/${data.total} · ${t('nearMisses')}: ${data.nearMisses}`;
    this.btnNext.classList.toggle('hidden', !data.won || data.isLast);
    this.applyLang();
  },

  hideAll() {
    for (const el of [this.titleScreen, this.pauseScreen, this.resultScreen, this.hud]) {
      if (el) el.classList.add('hidden');
    }
    this.titleScreen?.classList.remove('is-active');
  },

  updateHUD(st) {
    if (!st) return;
    this.hudLevel.textContent = `${t('level')} ${st.level}`;
    this.hudGoal.textContent = this.goalText(st);
    this.hudCoins.textContent = `🪙 ${st.coins}`;
    this.hudFares.textContent = `👥 ${st.delivered}/${st.totalPassengers}`;
    this.hudCombo.textContent = st.nearMisses > 0 ? `×${1 + Math.min(st.nearMisses, 5)}` : '';
    this.hudShield.textContent = st.shield > 0 ? `🛡 ×${st.shield}` : '';
    this.hudSpeed.textContent = `⚡ ${Math.round(st.speed)}`;
  },

  goalText(st) {
    let next = null;
    for (const pt of st.points) {
      if ((pt.type === 'pickup' || pt.type === 'dropoff' || pt.type === 'end') && pt.dist > st.dist + 2) {
        next = pt;
        break;
      }
    }
    if (!next) return '🏁';
    if (next.type === 'pickup') return t('nextPickup');
    if (next.type === 'dropoff') return t('nextDropoff');
    return t('nextFinish');
  },

  // 标题关卡格：锁定 / 星级
  updateLevelGrid(progress) {
    if (!this.levelGrid) return;
    this.levelGrid.innerHTML = '';
    for (let i = 0; i < LEVEL_COUNT; i += 1) {
      const cell = document.createElement('button');
      cell.className = 'level-cell';
      cell.dataset.level = String(i);
      const stars = progress?.stars?.[i] || 0;
      const unlocked = progress?.unlocked?.[i] ?? i === 0;
      cell.disabled = !unlocked;
      if (!unlocked) {
        cell.textContent = '🔒';
        cell.classList.add('locked');
      } else {
        cell.innerHTML = `<span class="lv-num">${i + 1}</span><span class="lv-stars">${'★'.repeat(stars)}</span>`;
        if (stars >= 3) cell.classList.add('max');
      }
      this.levelGrid.appendChild(cell);
    }
  },

  // 教程渲染
  renderTutStep(step) {
    const keys = [
      ['tut1t', 'tut1b'],
      ['tut2t', 'tut2b'],
      ['tut3t', 'tut3b'],
      ['tut4t', 'tut4b'],
    ];
    const [tk, bk] = keys[Math.min(step, keys.length - 1)];
    this.tutTitle.textContent = t(tk);
    this.tutText.textContent = t(bk);
    this.tutNext.textContent = step >= keys.length - 1 ? t('gotIt') : t('nextStep');
    if (this.tutorialOverlay) this.tutorialOverlay.dataset.step = String(step);
  },

  showTutorial(step) {
    this.tutorialOverlay.classList.remove('hidden');
    this.renderTutStep(step);
  },

  hideTutorial() {
    this.tutorialOverlay.classList.add('hidden');
  },

  setMuteIcon(muted) {
    if (this.btnMute) this.btnMute.textContent = muted ? '🔇' : '🔊';
  },
};
