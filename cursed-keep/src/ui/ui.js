// UI 模块：标题/暂停/胜负 + HUD + 建造栏 + 塔操作面板 + 多语言。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';

function el(id) { return document.getElementById(id); }

export const ui = {
  titleScreen: el('screen-title'),
  pauseScreen: el('screen-pause'),
  winScreen: el('screen-win'),
  loseScreen: el('screen-lose'),
  hud: el('hud'),
  buildbar: el('buildbar'),
  towerpanel: el('towerpanel'),
  hudWave: el('hud-wave'),
  hudGold: el('hud-gold'),
  hudLives: el('hud-lives'),
  buildHint: el('build-hint'),
  tpName: el('tp-name'),
  tpStats: el('tp-stats'),
  titleText: el('title-text'),
  subtitleText: el('subtitle-text'),
  titleBest: el('title-best'),
  howTo: el('how-to'),
  pauseTitle: el('pause-title'),
  winTitle: el('win-title'),
  winScore: el('win-score'),
  loseTitle: el('lose-title'),
  loseScore: el('lose-score'),
  btnStart: el('btn-start'),
  btnResume: el('btn-resume'),
  btnRestart: el('btn-restart'),
  btnAgain: el('btn-again'),
  btnTitle: el('btn-title'),
  btnAgain2: el('btn-again2'),
  btnTitle2: el('btn-title2'),
  btnWave: el('btn-wave'),
  btnUpgrade: el('btn-upgrade'),
  btnSell: el('btn-sell'),
  btnClose: el('btn-close'),
  btnMute: el('btn-mute'),
  btnPause: el('btn-pause'),
  buildBtns: { arrow: el('btn-arrow'), cannon: el('btn-cannon'), frost: el('btn-frost') },
  langSelects: [el('lang-select'), el('lang-select-pause')],

  get lang() { return i18n.lang; },
  get dir() { return i18n.dir; },

  applyLang() {
    syncDocumentLang();
    this.titleText.textContent = t('title');
    this.subtitleText.textContent = t('subtitle');
    this.howTo.textContent = t('howTo');
    this.pauseTitle.textContent = t('paused');
    this.winTitle.textContent = t('win');
    this.loseTitle.textContent = t('lose');
    this.btnStart.textContent = t('start');
    this.btnResume.textContent = t('resume');
    this.btnRestart.textContent = t('restartRun');
    this.btnAgain.textContent = t('playAgain');
    this.btnAgain2.textContent = t('playAgain');
    this.btnTitle.textContent = t('backTitle');
    this.btnTitle2.textContent = t('backTitle');
    this.btnWave.textContent = `▶ ${t('sendWave')}`;
    this.btnClose.textContent = '✕';
    for (const sel of this.langSelects) if (sel) sel.setAttribute('aria-label', t('language'));
    this.fillLangOptions();
    this.updateMute(this._muted);
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

  setLang(lang) { i18n.setLang(lang); this.applyLang(); return i18n.lang; },

  showTitle() {
    this.titleScreen.classList.remove('hidden');
    this.pauseScreen.classList.add('hidden');
    this.winScreen.classList.add('hidden');
    this.loseScreen.classList.add('hidden');
    this.hud.classList.add('hidden');
    this.buildbar.classList.add('hidden');
    this.towerpanel.classList.add('hidden');
    this.applyLang();
  },
  showGame() {
    this.titleScreen.classList.add('hidden');
    this.pauseScreen.classList.add('hidden');
    this.winScreen.classList.add('hidden');
    this.loseScreen.classList.add('hidden');
    this.hud.classList.remove('hidden');
    this.buildbar.classList.remove('hidden');
  },
  showPause() { this.pauseScreen.classList.remove('hidden'); this.applyLang(); },
  hidePause() { this.pauseScreen.classList.add('hidden'); },
  showWin(kills) {
    this.winScreen.classList.remove('hidden');
    this.buildbar.classList.add('hidden');
    this.towerpanel.classList.add('hidden');
    this.winScore.textContent = `${t('wave')} 10/10 · ${kills} kills`;
    this.applyLang();
  },
  showLose(wave) {
    this.loseScreen.classList.remove('hidden');
    this.buildbar.classList.add('hidden');
    this.towerpanel.classList.add('hidden');
    this.loseScore.textContent = `${t('finalWave')}: ${wave}/10`;
    this.applyLang();
    this.loseScore.textContent = `${t('finalWave')}: ${wave}/10`;
  },

  updateHUD(state) {
    this.hudWave.textContent = `${t('wave')} ${state.wave}/${state.totalWaves}`;
    this.hudGold.textContent = `🪙 ${state.gold}`;
    this.hudLives.textContent = `❤ ${state.lives}`;
    this.btnWave.disabled = state.inWave;
    this.btnWave.textContent = state.inWave ? `${t('wave')} ${state.wave}` : `▶ ${t('sendWave')}`;
  },
  updateBuildBar(state) {
    for (const b of state.towers) {
      const btn = this.buildBtns[b.id];
      if (!btn) continue;
      btn.querySelector('.bb-name').textContent = b.name;
      btn.querySelector('.bb-cost').textContent = `🪙 ${b.cost}`;
      btn.disabled = !b.canBuy;
      btn.classList.toggle('selected', state.selectedType === b.id);
    }
    this.buildHint.textContent = state.selectedType ? t('selectTower') : '';
  },
  showTowerPanel(info) {
    this.towerpanel.classList.remove('hidden');
    this.tpName.textContent = `${info.name} · ${t('level')}${info.level}`;
    this.tpStats.textContent = `${info.damage} ${t('damage')} · ${info.range} ${t('range')}`;
    this.btnUpgrade.textContent = info.maxed ? t('maxLevel') : `${t('upgrade')} 🪙${info.upgradeCost}`;
    this.btnUpgrade.disabled = info.maxed || !info.canUpgrade;
    this.btnSell.textContent = `${t('sell')} 🪙${info.sellValue}`;
  },
  hideTowerPanel() { this.towerpanel.classList.add('hidden'); },

  updateMute(muted) {
    this._muted = muted;
    this.btnMute.textContent = muted ? '🔇' : '🔊';
    this.btnMute.setAttribute('aria-label', `${t('sound')}: ${muted ? t('off') : t('on')}`);
  },
  updateBest(best) {
    this.titleBest.textContent = best > 0 ? `${t('best')}: ${t('wave')} ${best}` : '';
  },
};