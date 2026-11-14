// UI：标题/兵种/回合强化/结算 + HUD + 首次交互引导 + 触屏控件。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';
import { LOADOUTS, ROUNDS, RULES } from '../../config/game.config.js';
import { TUTORIAL_STEPS } from '../../config/tutorial.js';

function el(id) { return document.getElementById(id); }
const fmtTime = (sec) => `${Math.floor(Math.max(0, sec) / 60)}:${String(Math.max(0, sec) % 60).padStart(2, '0')}`;

export const ui = {
  hud: el('hud'),
  scoreBlue: el('score-blue'),
  scoreRed: el('score-red'),
  pipsBlue: el('pips-blue'),
  pipsRed: el('pips-red'),
  clock: el('clock'),
  roundLabel: el('round-label'),
  winPips: el('win-pips'),
  killFeed: el('kill-feed'),
  hpFill: el('hp-fill'),
  hpText: el('hp-text'),
  dashFill: el('dash-fill'),
  loadoutIcon: el('loadout-icon'),
  loadoutName: el('loadout-name'),
  overdriveBadge: el('overdrive-badge'),
  pickupHint: el('pickup-hint'),
  overtimeBadge: el('overtime-badge'),
  respawn: el('respawn'),
  respawnTime: el('respawn-time'),
  hurt: el('hurt'),
  touch: el('touch-controls'),
  btnMute: el('btn-mute'),
  btnPause: el('btn-pause'),

  titleScreen: el('screen-title'),
  loadoutScreen: el('screen-loadout'),
  roundScreen: el('screen-round'),
  pauseScreen: el('screen-pause'),
  endScreen: el('screen-end'),
  titleText: el('title-text'),
  subtitleText: el('subtitle-text'),
  howTo: el('how-to'),
  titleBest: el('title-best'),
  btnStart: el('btn-start'),
  btnHowto: el('btn-howto'),
  btnHowtoPause: el('btn-howto-pause'),
  btnResume: el('btn-resume'),
  btnRestart: el('btn-restart'),
  btnAgain: el('btn-again'),
  btnTitle: el('btn-title'),
  btnTitleEnd: el('btn-title-end'),
  pauseTitle: el('pause-title'),
  langSelects: [el('lang-select'), el('lang-select-pause')],

  loadoutKicker: el('loadout-kicker'),
  loadoutTitle: el('loadout-title'),
  loadoutSub: el('loadout-sub'),
  loadoutCards: el('loadout-cards'),
  btnLoadoutBack: el('btn-loadout-back'),
  roundKicker: el('round-kicker'),
  roundTitle: el('round-title'),
  roundSub: el('round-sub'),
  roundStats: el('round-stats'),
  perkCards: el('perk-cards'),
  btnRoundNext: el('btn-round-next'),
  endKicker: el('end-kicker'),
  endTitle: el('end-title'),
  endScore: el('end-score'),
  endKillsLabel: el('end-kills-label'),
  endDeathsLabel: el('end-deaths-label'),
  endRoundsLabel: el('end-rounds-label'),
  endKills: el('end-kills'),
  endDeaths: el('end-deaths'),
  endRounds: el('end-rounds'),
  endMessage: el('end-message'),
  roundBanner: el('round-banner'),
  bannerKicker: el('banner-kicker'),
  bannerName: el('banner-name'),
  bannerSub: el('banner-sub'),
  rotateTitle: el('rotate-title'),
  rotateText: el('rotate-text'),

  tutorialOverlay: el('tutorial'),
  tutorialStep: el('tutorial-step'),
  tutorialSkip: el('tutorial-skip'),
  tutorialTitle: el('tutorial-title'),
  tutorialText: el('tutorial-text'),
  tutorialDots: el('tutorial-dots'),
  tutorialNext: el('tutorial-next'),
  tutorialSteps: TUTORIAL_STEPS,
  tutorialActive: false,
  tutorialStepIndex: 0,
  _tutorialCompleteShown: false,
  _loadoutOnPick: null,
  _loadoutOnBack: null,
  touchMode: false,

  get lang() { return i18n.lang; },
  get dir() { return i18n.dir; },

  applyLang() {
    syncDocumentLang();
    this.titleText.textContent = t('title');
    this.subtitleText.textContent = t('subtitle');
    this.howTo.textContent = t('howTo');
    this.pauseTitle.textContent = t('paused');
    this.btnStart.textContent = t('start');
    this.btnHowto.textContent = t('howToPlay');
    this.btnHowtoPause.textContent = t('howToPlay');
    this.btnResume.textContent = t('resume');
    this.btnRestart.textContent = t('restartRun');
    this.btnAgain.textContent = t('playAgain');
    this.btnTitle.textContent = t('backTitle');
    this.btnTitleEnd.textContent = t('backTitle');
    this.btnLoadoutBack.textContent = t('loadoutBack');
    this.tutorialSkip.textContent = t('tutSkip');
    this.tutorialNext.textContent = t('tutStart');
    this.rotateTitle.textContent = t('rotateTitle');
    this.rotateText.textContent = t('rotateText');
    this.btnMute.setAttribute('aria-label', `${t('sound')}: ${this._muted ? t('off') : t('on')}`);
    for (const sel of this.langSelects) if (sel) sel.setAttribute('aria-label', t('language'));
    this.fillLangOptions();
    if (!this.loadoutScreen.classList.contains('hidden') && this._loadoutOnPick) {
      this.renderLoadoutCards(this._loadoutOnPick);
    }
    if (this.tutorialActive) this.renderTutorialUI();
    this.updateMute(this._muted);
  },

  fillLangOptions() {
    for (const sel of this.langSelects) {
      if (!sel) continue;
      sel.innerHTML = '';
      for (const item of i18n.options()) {
        const opt = document.createElement('option');
        opt.value = item.code; opt.textContent = item.name;
        if (item.code === i18n.lang) opt.selected = true;
        sel.appendChild(opt);
      }
    }
  },
  setLang(lang) { i18n.setLang(lang); this.applyLang(); return i18n.lang; },
  setTouchMode(on) { this.touchMode = !!on; this.touch.classList.toggle('hidden', !on); },

  hideScreens() {
    for (const s of [this.titleScreen, this.loadoutScreen, this.roundScreen, this.pauseScreen, this.endScreen]) s.classList.add('hidden');
  },
  showTitle() {
    this.hideScreens();
    this.titleScreen.classList.add('is-active');
    this.titleScreen.classList.remove('hidden');
    this.hud.classList.add('hidden');
    this.applyLang();
  },
  showLoadout(onPick, onBack) {
    this._loadoutOnPick = onPick;
    this._loadoutOnBack = onBack;
    this.hideScreens();
    this.hud.classList.add('hidden');
    this.loadoutKicker.textContent = t('loadoutKicker');
    this.loadoutTitle.textContent = t('chooseLoadout');
    this.loadoutSub.textContent = t('loadoutSub');
    this.renderLoadoutCards(onPick);
    this.btnLoadoutBack.onclick = onBack;
    this.loadoutScreen.classList.remove('hidden');
    this.applyLang();
  },
  renderLoadoutCards(onPick) {
    this.loadoutCards.innerHTML = '';
    for (const key of ['rifleman', 'scout', 'heavy']) {
      const l = LOADOUTS[key];
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'loadout-card-btn';
      card.dataset.loadout = key;
      card.innerHTML = `
        <span class="l-icon">${l.icon}</span>
        <span class="l-name">${l.name[this.lang] || l.name.en}</span>
        <span class="l-tag">${l.tag[this.lang] || l.tag.en}</span>
        <span class="l-desc">${l.desc[this.lang] || l.desc.en}</span>
        <span class="l-stats"><span>${t('classHp')} <b>${l.hp}</b></span><span>${t('classSpeed')} <b>${l.speed}</b></span><span>${t('classDamage')} <b>${l.damage}</b></span></span>`;
      card.addEventListener('click', () => onPick(key));
      this.loadoutCards.appendChild(card);
    }
  },
  showGame() {
    this.hideScreens();
    this.hud.classList.remove('hidden');
  },
  showPause() { this.pauseScreen.classList.remove('hidden'); this.applyLang(); },
  hidePause() { this.pauseScreen.classList.add('hidden'); },
  hideEnd() { this.endScreen.classList.add('hidden'); },

  showRoundBanner(hud) {
    const conf = ROUNDS[Math.min(hud.round - 1, ROUNDS.length - 1)];
    this.bannerKicker.textContent = t('round', { n: hud.round });
    this.bannerName.textContent = conf.name[this.lang] || conf.name.en;
    this.bannerSub.textContent = t('firstTo', { n: RULES.killTarget });
    this.roundBanner.classList.remove('show');
    void this.roundBanner.offsetWidth;
    this.roundBanner.classList.add('show');
    clearTimeout(this._bannerTimer);
    this._bannerTimer = setTimeout(() => this.roundBanner.classList.remove('show'), 1800);
  },

  updateHUD(hud) {
    this.scoreBlue.textContent = String(hud.scores[0]);
    this.scoreRed.textContent = String(hud.scores[1]);
    this.roundLabel.textContent = t('roundOf', { n: Math.min(hud.round, 3) });
    this.clock.textContent = hud.overtime ? 'OT' : fmtTime(hud.timeLeft);
    this.clock.style.color = hud.timeLeft <= 20 && !hud.overtime ? '#fbbf24' : '';
    this.ensurePips(this.pipsBlue, 4, hud.blueAlive);
    this.ensurePips(this.pipsRed, 4, hud.redAlive);
    this.ensureWinPips(hud.roundWins);
    const hpFrac = Math.max(0, Math.min(1, hud.hp / hud.maxHp));
    this.hpFill.style.width = `${hpFrac * 100}%`;
    this.hpFill.classList.toggle('low', hpFrac <= 0.35);
    this.hpText.textContent = String(hud.hp);
    this.dashFill.style.width = `${hud.dashReady ? 100 : Math.max(0, 100 - (hud.dashCd / RULES.dashCooldown) * 100)}%`;
    const load = LOADOUTS[hud.loadout] || LOADOUTS.rifleman;
    this.loadoutIcon.textContent = load.icon;
    this.loadoutName.textContent = load.name[this.lang] || load.name.en;
    this.overdriveBadge.classList.toggle('hidden', hud.overdrive <= 0);
    this.pickupHint.classList.toggle('hidden', !hud.pickupActive);
    this.overtimeBadge.classList.toggle('hidden', !hud.overtime);
    const showRespawn = !hud.alive && hud.phase === 'play';
    this.respawn.classList.toggle('hidden', !showRespawn);
    if (showRespawn) this.respawnTime.textContent = String(Math.max(0, Math.ceil(hud.respawnT)));
  },
  ensurePips(parent, total, alive) {
    if (parent.children.length !== total) {
      parent.innerHTML = '';
      for (let i = 0; i < total; i += 1) parent.appendChild(document.createElement('span'));
    }
    [...parent.children].forEach((s, i) => s.classList.toggle('on', i < alive));
  },
  ensureWinPips(wins) {
    if (this.winPips.children.length !== 4) {
      this.winPips.innerHTML = '';
      for (let i = 0; i < 4; i += 1) this.winPips.appendChild(document.createElement('span'));
    }
    let idx = 0;
    for (let team = 0; team < 2; team += 1) {
      for (let i = 0; i < wins[team]; i += 1) {
        if (idx < 4) { this.winPips.children[idx].className = team === 0 ? 'blue' : 'red'; idx += 1; }
      }
    }
  },
  updateKillFeed(events) {
    for (const ev of events) {
      if (ev.type !== 'kill') continue;
      const line = document.createElement('div');
      line.className = 'kill-line' + (ev.team === 1 ? ' red' : '');
      line.innerHTML = `<span class="k">${ev.killerName || '—'}</span> <span class="v">×</span> <span class="v">${ev.victimName || '—'}</span>`;
      this.killFeed.prepend(line);
      while (this.killFeed.children.length > 4) this.killFeed.lastChild.remove();
      setTimeout(() => line.remove(), 4200);
    }
  },
  flashHurt() {
    this.hurt.classList.remove('on');
    void this.hurt.offsetWidth;
    this.hurt.classList.add('on');
  },
  toast(text, kind = '') {
    const node = document.createElement('div');
    node.className = `toast ${kind}`;
    node.textContent = text;
    node.style.left = '50%';
    node.style.top = '58%';
    this.hud.appendChild(node);
    setTimeout(() => node.remove(), 950);
  },
  updateMute(muted) {
    this._muted = muted;
    this.btnMute.textContent = muted ? '🔇' : '🔊';
    this.btnMute.setAttribute('aria-label', `${t('sound')}: ${muted ? t('off') : t('on')}`);
  },
  updateBest(wins) { this.titleBest.textContent = wins > 0 ? `${t('wins')}: ${wins}` : ''; },

  showRoundResult(hud, choices, onPick, onNext) {
    this.hideScreens();
    this.hud.classList.add('hidden');
    this.roundKicker.textContent = t('roundOf', { n: hud.round });
    this.roundTitle.textContent = hud.winner === 0 ? t('roundWon') : t('roundLost');
    this.roundTitle.style.color = hud.winner === 0 ? '#38bdf8' : '#fb7185';
    this.roundSub.textContent = t('perkSub');
    this.roundStats.innerHTML = `
      <div><small>${t('score')}</small><b>${hud.scores[0]} – ${hud.scores[1]}</b></div>
      <div><small>${t('kills')}</small><b>${hud.roundKills}</b></div>
      <div><small>${t('deaths')}</small><b>${hud.roundDeaths}</b></div>`;
    this.perkCards.innerHTML = '';
    if (choices.length === 0) {
      this.btnRoundNext.classList.remove('hidden');
      this.btnRoundNext.textContent = t('nextRound');
      this.btnRoundNext.onclick = onNext;
    } else {
      this.btnRoundNext.classList.add('hidden');
      for (const perk of choices) {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'perk-card';
        card.innerHTML = `
          <span class="p-icon">${perk.icon}</span>
          <span class="p-kind ${perk.kind}">${perk.kind === 'rule' ? 'RULE' : 'STAT'}</span>
          <span class="p-name">${perk.name[this.lang] || perk.name.en}</span>
          <span class="p-desc">${perk.desc[this.lang] || perk.desc.en}</span>`;
        card.addEventListener('click', () => onPick(perk.id));
        this.perkCards.appendChild(card);
      }
    }
    this.roundScreen.classList.remove('hidden');
    this.applyLang();
  },

  showEnd(hud, best, onAgain, onTitle) {
    this.hideScreens();
    this.hud.classList.add('hidden');
    const win = hud.matchWinner === 0;
    this.endKicker.textContent = t('matchComplete');
    this.endTitle.textContent = win ? t('matchWon') : t('matchLost');
    this.endTitle.style.color = win ? '#38bdf8' : '#fb7185';
    this.endScore.textContent = `${hud.roundWins[0]} – ${hud.roundWins[1]}`;
    this.endScore.className = 'end-score' + (win ? '' : ' lose');
    this.endKillsLabel.textContent = t('kills');
    this.endDeathsLabel.textContent = t('deaths');
    this.endRoundsLabel.textContent = t('roundsWon');
    this.endKills.textContent = String(hud.kills);
    this.endDeaths.textContent = String(hud.deaths);
    this.endRounds.textContent = `${hud.roundWins[0]} – ${hud.roundWins[1]}`;
    this.endMessage.textContent = win ? t('endWin') : t('endLose');
    this.btnAgain.onclick = onAgain;
    this.btnTitleEnd.onclick = onTitle;
    this.endScreen.classList.remove('hidden');
    this.applyLang();
  },

  startTutorialUI() {
    this.tutorialActive = true;
    this.tutorialStepIndex = 0;
    this._tutorialCompleteShown = false;
    this.tutorialOverlay.classList.remove('hidden');
    this.tutorialNext.classList.add('hidden');
    this.tutorialSkip.classList.remove('hidden');
    this.renderTutorialUI();
  },
  endTutorialUI() {
    this.tutorialActive = false;
    this.tutorialOverlay.classList.add('hidden');
  },
  setTutorialStep(index) {
    if (!this.tutorialActive) return;
    this.tutorialStepIndex = Math.max(0, Math.min(index, this.tutorialSteps.length - 1));
    this._tutorialCompleteShown = false;
    this.renderTutorialUI();
  },
  renderTutorialUI() {
    if (!this.tutorialActive || this._tutorialCompleteShown) return;
    const step = this.tutorialSteps[this.tutorialStepIndex];
    if (!step) return;
    this.tutorialStep.textContent = t('tutStep', { n: this.tutorialStepIndex + 1, total: this.tutorialSteps.length });
    this.tutorialTitle.textContent = t(step.titleKey);
    this.tutorialText.textContent = t(step.textKey);
    this.tutorialNext.classList.add('hidden');
    this.tutorialSkip.classList.remove('hidden');
    this.tutorialDots.innerHTML = '';
    this.tutorialSteps.forEach((_, i) => {
      const dot = document.createElement('span');
      dot.className = 'tutorial-dot' + (i === this.tutorialStepIndex ? ' active' : i < this.tutorialStepIndex ? ' done' : '');
      this.tutorialDots.appendChild(dot);
    });
  },
  updateTutorial(hud) {
    if (!this.tutorialActive) return;
    if (hud.phase === 'tutorialDone') {
      this.showTutorialComplete();
      return;
    }
    const step = Number(hud.tutorialStep) || 0;
    if (step !== this.tutorialStepIndex) this.setTutorialStep(step);
  },
  showTutorialComplete() {
    if (this._tutorialCompleteShown) return;
    this._tutorialCompleteShown = true;
    this.tutorialStep.textContent = '';
    this.tutorialTitle.textContent = t('tutDoneTitle');
    this.tutorialText.textContent = t('tutDoneText');
    this.tutorialDots.innerHTML = '';
    this.tutorialSkip.classList.add('hidden');
    this.tutorialNext.classList.remove('hidden');
  },
};
