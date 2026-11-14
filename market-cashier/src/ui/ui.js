// UI 模块：标题/暂停/HUD/商品/小票/钱箱/班次结算 + 多语言。
// DOM 只在状态变化时重建；每帧只更新分数与耐心。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';
import { DENOMINATIONS } from '../../config/products.js';
import { DAYS } from '../../config/game.config.js';
import { TUTORIAL_STEPS } from '../../config/tutorial.js';

function el(id) { return document.getElementById(id); }

export function money(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

const DAY_NAMES = [
  { en: 'MORNING RUSH', zh: '早高峰' },
  { en: 'LUNCH CROWD', zh: '午间人流' },
  { en: 'CLOSING TIME', zh: '打烊前' },
];

function dayName(index, lang) {
  const d = DAY_NAMES[Math.min(index, DAY_NAMES.length - 1)];
  return d[lang] || d.en;
}

export const ui = {
  titleScreen: el('screen-title'),
  pauseScreen: el('screen-pause'),
  dayScreen: el('screen-day'),
  endingScreen: el('screen-ending'),
  hud: el('hud'),
  playArea: el('play-area'),
  hudDay: el('hud-day'),
  hudDayName: el('hud-day-name'),
  hudCustomer: el('hud-customer'),
  hudScore: el('hud-score'),
  hudScoreLabel: el('hud-score-label'),
  comboBadge: el('combo-badge'),
  comboMult: el('combo-mult'),
  comboLabel: el('combo-label'),
  patienceTitle: el('patience-title'),
  patienceValue: el('patience-value'),
  patienceFill: el('patience-fill'),
  itemsLabel: el('items-label'),
  scanProgress: el('scan-progress'),
  scanHint: el('scan-hint'),
  bagCount: el('bag-count'),
  customerNote: el('customer-note'),
  queueLabel: el('queue-label'),
  queueCount: el('queue-count'),
  customerDots: el('customer-dots'),
  beltTotal: el('belt-total'),
  beltTotalLabel: el('belt-total-label'),
  shortcuts: el('shortcuts'),
  itemsList: el('items-list'),
  receiptLabel: el('receipt-label'),
  receiptDay: el('receipt-day'),
  receipt: el('receipt'),
  feedback: el('feedback'),
  tipLabel: el('tip-label'),
  tipValue: el('tip-value'),
  streakLabel: el('streak-label'),
  streakValue: el('streak-value'),
  nextLabel: el('next-label'),
  nextText: el('next-text'),
  mathPaid: el('math-paid'),
  mathTotal: el('math-total'),
  mathChange: el('math-change'),
  targetLabel: el('target-label'),
  targetText: el('target-text'),
  targetFill: el('target-fill'),
  mistakesLabel: el('mistakes-label'),
  mistakesValue: el('mistakes-value'),
  drawerLabel: el('drawer-label'),
  changeStatus: el('change-status'),
  changeDueLabel: el('change-due-label'),
  changeDue: el('change-due'),
  givenLabel: el('given-label'),
  given: el('given'),
  paidLabel: el('paid-label'),
  paidValue: el('paid-value'),
  moneyGrid: el('money-grid'),
  changeTray: el('change-tray'),
  traySummary: el('tray-summary'),
  moneyHint: el('money-hint'),
  btnGive: el('btn-give'),
  btnReset: el('btn-reset'),
  customerStrip: el('customer-strip'),
  customerAvatar: el('customer-avatar'),
  customerName: el('customer-name'),
  customerType: el('customer-type'),
  customerBubble: el('customer-bubble'),
  titleText: el('title-text'),
  subtitleText: el('subtitle-text'),
  tutorial1: el('tutorial-1'),
  tutorial2: el('tutorial-2'),
  tutorial3: el('tutorial-3'),
  tutorial4: el('tutorial-4'),
  titleBest: el('title-best'),
  pauseTitle: el('pause-title'),
  btnStart: el('btn-start'),
  btnHowto: el('btn-howto'),
  btnHowtoPause: el('btn-howto-pause'),
  btnResume: el('btn-resume'),
  btnRestart: el('btn-restart'),
  btnTitle: el('btn-title'),
  btnAgain: el('btn-again'),
  btnRetry: el('btn-retry'),
  tutorialOverlay: el('tutorial'),
  tutorialSpot: el('tutorial-spot'),
  tutorialStep: el('tutorial-step'),
  tutorialSkip: el('tutorial-skip'),
  tutorialTitle: el('tutorial-title'),
  tutorialText: el('tutorial-text'),
  tutorialDots: el('tutorial-dots'),
  tutorialNext: el('tutorial-next'),
  tutorialActive: false,
  tutorialStepIndex: 0,
  tutorialSteps: TUTORIAL_STEPS,
  _tutorialCompleteShown: false,
  btnMute: el('btn-mute'),
  btnPause: el('btn-pause'),
  dayKicker: el('day-kicker'),
  dayTitle: el('day-title'),
  dayScoreLabel: el('day-score-label'),
  dayScoreValue: el('day-score-value'),
  dayTargetLabel: el('day-target-label'),
  dayTargetValue: el('day-target-value'),
  dayMistakesLabel: el('day-mistakes-label'),
  dayMistakesValue: el('day-mistakes-value'),
  dayPerfectLabel: el('day-perfect-label'),
  dayPerfectValue: el('day-perfect-value'),
  dayComboLabel: el('day-combo-label'),
  dayComboValue: el('day-combo-value'),
  dayTipsLabel: el('day-tips-label'),
  dayTipsValue: el('day-tips-value'),
  rotateTitle: el('rotate-title'),
  rotateText: el('rotate-text'),
  dayMessage: el('day-message'),
  upgradeCards: el('upgrade-cards'),
  upgradeHint: el('upgrade-hint'),
  endingKicker: el('ending-kicker'),
  endingTitle: el('ending-title'),
  rankBadge: el('rank-badge'),
  finalScoreLabel: el('final-score-label'),
  finalScoreValue: el('final-score-value'),
  endingMessage: el('ending-message'),
  endingBestLabel: el('ending-best-label'),
  endingBestValue: el('ending-best-value'),
  endingDayLabel: el('ending-day-label'),
  endingDayValue: el('ending-day-value'),
  toastLayer: el('toast-layer'),
  flashEl: el('flash'),
  langSelects: [el('lang-select'), el('lang-select-pause')],

  get lang() { return i18n.lang; },
  get dir() { return i18n.dir; },

  applyLang() {
    syncDocumentLang();
    this.titleText.textContent = t('title');
    this.subtitleText.textContent = t('subtitle');
    this.tutorial1.textContent = t('tutorial1');
    this.tutorial2.textContent = t('tutorial2');
    this.tutorial3.textContent = t('tutorial3');
    this.tutorial4.textContent = t('tutorial4');
    this.pauseTitle.textContent = t('paused');
    this.btnStart.textContent = t('start');
    this.btnHowto.textContent = t('howToPlay');
    this.btnHowtoPause.textContent = t('howToPlay');
    this.tutorialSkip.textContent = t('tutSkip');
    this.tutorialNext.textContent = t('tutStartShift');
    if (this.tutorialActive) this.renderTutorialUI();
    this.btnResume.textContent = t('resume');
    this.btnRestart.textContent = t('restartRun');
    this.btnTitle.textContent = t('backTitle');
    this.btnGive.textContent = t('giveChange');
    this.btnReset.textContent = t('reset');
    this.btnRetry.textContent = t('retryDay');
    this.btnAgain.textContent = t('playAgain');
    this.itemsLabel.textContent = t('scanItems');
    this.scanHint.textContent = t('scanHint');
    this.beltTotalLabel.textContent = t('basketTotal');
    this.shortcuts.textContent = t('shortcuts');
    this.targetLabel.textContent = t('targetShort');
    this.tipLabel.textContent = t('tipPotential');
    this.queueLabel.textContent = t('queueLabel');
    this.nextLabel.textContent = t('nextLabel');
    this.streakLabel.textContent = t('streakShort');
    this.mistakesLabel.textContent = t('mistakes');
    this.paidLabel.textContent = t('paid');
    this.receiptLabel.textContent = t('receipt');
    this.drawerLabel.textContent = t('cashDrawer');
    this.changeDueLabel.textContent = t('changeDue');
    this.givenLabel.textContent = t('yourChange');
    this.hudScoreLabel.textContent = t('score');
    this.comboLabel.textContent = t('comboLabel');
    this.patienceTitle.textContent = t('patience');
    this.dayScoreLabel.textContent = t('dayScore');
    this.dayTargetLabel.textContent = t('dayTarget');
    this.dayMistakesLabel.textContent = t('mistakes');
    this.dayPerfectLabel.textContent = t('perfectCustomers');
    this.dayComboLabel.textContent = t('bestCombo');
    this.dayTipsLabel.textContent = t('tipsEarned');
    this.rotateTitle.textContent = t('rotateTitle');
    this.rotateText.textContent = t('rotateText');
    this.upgradeHint.textContent = t('upgradeHint');
    this.finalScoreLabel.textContent = t('finalScore');
    this.endingBestLabel.textContent = t('best');
    this.endingDayLabel.textContent = t('dayLabel');
    for (const sel of this.langSelects) if (sel) sel.setAttribute('aria-label', t('language'));
    this.btnMute.setAttribute('aria-label', `${t('sound')}: ${this._muted ? t('off') : t('on')}`);
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

  setLang(lang) {
    i18n.setLang(lang);
    this.applyLang();
    return i18n.lang;
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
    this.tutorialSpot.classList.remove('show');
  },

  setTutorialStep(index) {
    if (!this.tutorialActive) return;
    this.tutorialStepIndex = Math.max(0, Math.min(index, this.tutorialSteps.length - 1));
    this._tutorialCompleteShown = false;
    this.renderTutorialUI();
  },

  renderTutorialUI() {
    if (!this.tutorialActive) return;
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
    requestAnimationFrame(() => this.positionTutorialSpot(step.focus));
  },

  positionTutorialSpot(selector) {
    const target = selector ? document.querySelector(selector) : null;
    if (!target || target.offsetParent === null) {
      this.tutorialSpot.classList.remove('show');
      return;
    }
    const r = target.getBoundingClientRect();
    const g = document.getElementById('game-container').getBoundingClientRect();
    this.tutorialSpot.style.left = `${r.left - g.left - 5}px`;
    this.tutorialSpot.style.top = `${r.top - g.top - 5}px`;
    this.tutorialSpot.style.width = `${r.width + 10}px`;
    this.tutorialSpot.style.height = `${r.height + 10}px`;
    this.tutorialSpot.classList.add('show');
  },

  updateTutorial(hud) {
    if (!this.tutorialActive) return;
    if (hud.phase === 'tutorialDone') {
      this.showTutorialComplete();
      return;
    }
    const step = this.tutorialSteps[this.tutorialStepIndex];
    if (!step) return;
    if (step.id === 'scan-one' && hud.scanned >= 1) this.setTutorialStep(1);
    else if (step.id === 'scan-all' && hud.phase === 'change') this.setTutorialStep(2);
    else if (step.id === 'change' && hud.change > 0 && hud.givenChange === hud.change) this.setTutorialStep(3);
  },

  showTutorialComplete() {
    if (this._tutorialCompleteShown) return;
    this._tutorialCompleteShown = true;
    this.tutorialStep.textContent = '';
    this.tutorialTitle.textContent = t('tutDoneTitle');
    this.tutorialText.textContent = t('tutDoneText');
    this.tutorialDots.innerHTML = '';
    this.tutorialSpot.classList.remove('show');
    this.tutorialSkip.classList.add('hidden');
    this.tutorialNext.classList.remove('hidden');
  },

  repositionTutorial() {
    if (!this.tutorialActive) return;
    const step = this.tutorialSteps[this.tutorialStepIndex];
    if (step) this.positionTutorialSpot(step.focus);
  },

  showTitle() {
    this.toastLayer.innerHTML = '';
    this.titleScreen.classList.add('is-active');
    this.titleScreen.classList.remove('hidden');
    this.pauseScreen.classList.add('hidden');
    this.dayScreen.classList.add('hidden');
    this.endingScreen.classList.add('hidden');
    this.hud.classList.add('hidden');
    this.playArea.classList.add('hidden');
    this.applyLang();
  },

  showGame() {
    this.titleScreen.classList.remove('is-active');
    this.titleScreen.classList.add('hidden');
    this.pauseScreen.classList.add('hidden');
    this.dayScreen.classList.add('hidden');
    this.endingScreen.classList.add('hidden');
    this.hud.classList.remove('hidden');
    this.playArea.classList.remove('hidden');
    this.buildMoney();
  },

  showPause() { this.pauseScreen.classList.remove('hidden'); this.applyLang(); },
  hidePause() { this.pauseScreen.classList.add('hidden'); },

  buildMoney() {
    this.moneyGrid.innerHTML = '';
    for (const d of DENOMINATIONS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'money-btn ' + (d >= 100 ? 'bill' : d <= 10 ? 'coin small' : 'coin');
      btn.dataset.cents = String(d);
      btn.textContent = money(d);
      this.moneyGrid.appendChild(btn);
    }
  },

  updateHUD(hud) {
    this.hudDay.textContent = t('day', { n: hud.day });
    this.hudDayName.textContent = dayName(hud.day - 1, this.lang);
    this.hudCustomer.textContent = t('customer', { n: hud.customerNo, total: hud.customerTotal });
    this.hudScore.textContent = String(hud.score);
    if (hud.combo > 0) {
      this.comboBadge.classList.remove('hidden');
      this.comboMult.textContent = `×${hud.mult.toFixed(1)}`;
      this.comboLabel.textContent = t('comboLabel');
    } else {
      this.comboBadge.classList.add('hidden');
    }
    const frac = Math.max(0, Math.min(1, hud.patience / hud.patienceMax));
    this.patienceFill.style.width = `${Math.round(frac * 100)}%`;
    this.patienceFill.classList.toggle('warn', frac <= 0.5 && frac > 0.25);
    this.patienceFill.classList.toggle('bad', frac <= 0.25);
    this.patienceValue.textContent = `${Math.ceil(hud.patience)}s`;
    this.beltTotal.textContent = money(hud.total);
    this.targetText.textContent = `${hud.dayScore} / ${hud.target}`;
    this.targetFill.style.width = `${Math.max(0, Math.min(100, Math.round((hud.dayScore / Math.max(1, hud.target)) * 100)))}%`;
    this.mistakesValue.textContent = String(hud.mistakes);
    this.paidValue.textContent = money(hud.payment);
    this.queueCount.textContent = `${hud.phase === 'dayClear' ? hud.customerTotal : hud.customerNo - 1}/${hud.customerTotal}`;
    this.updateDots(hud);
    this.tipValue.textContent = money(hud.tipPotential || 0);
    this.streakValue.textContent = `×${hud.mult.toFixed(1)}`;
    this.mathPaid.textContent = money(hud.payment);
    this.mathTotal.textContent = money(hud.total);
    this.mathChange.textContent = money(hud.change);
    if (hud.phase === 'scan') this.nextText.textContent = t('nextScan', { n: hud.items.length });
    else if (hud.phase === 'change') this.nextText.textContent = hud.exact ? t('nextExact') : t('nextChange', { change: money(hud.change) });
    else this.nextText.textContent = '';
  },

  sync(hud) {
    this.updateHUD(hud);
    this.renderItems(hud);
    this.renderReceipt(hud);
    this.updateCustomer(hud);
    this.setMoneyEnabled(hud.phase === 'change');
    this.updateHint(hud);
    this.renderChangeTray(hud);
    this.updateTutorial(hud);
  },

  renderItems(hud) {
    this.itemsList.innerHTML = '';
    const lang = this.lang;
    hud.items.forEach((item, idx) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'item-row' + (item.scanned ? ' scanned' : '');
      row.dataset.idx = String(idx);
      row.style.setProperty('--item-color', item.color || '#5eead4');
      row.disabled = item.scanned || hud.phase !== 'scan';
      const emoji = document.createElement('span');
      emoji.className = 'item-emoji';
      emoji.textContent = item.emoji;
      const name = document.createElement('span');
      name.className = 'item-name';
      name.textContent = item.name[lang] || item.name.en;
      const price = document.createElement('span');
      price.className = 'item-price';
      price.textContent = money(item.price);
      const check = document.createElement('span');
      check.className = 'item-check';
      check.textContent = item.scanned ? '✓' : '';
      row.append(emoji, name, price, check);
      this.itemsList.appendChild(row);
    });
    this.scanProgress.textContent = t('scanProgress', { n: hud.scanned, total: hud.items.length });
    this.bagCount.textContent = String(hud.scanned);
  },

  renderReceipt(hud) {
    const lang = this.lang;
    const wrap = this.receipt;
    wrap.innerHTML = '';
    const brand = document.createElement('div');
    brand.className = 'reci-brand';
    brand.textContent = 'PIPY MART';
    const sub = document.createElement('div');
    sub.className = 'reci-sub';
    sub.textContent = `DAY ${hud.day} · #${String(hud.served + 1).padStart(3, '0')}`;
    wrap.append(brand, sub);

    const line = (label, value, cls) => {
      const div = document.createElement('div');
      div.className = 'receipt-line' + (cls ? ` ${cls}` : '');
      const l = document.createElement('span');
      l.className = 'lbl';
      l.textContent = label;
      const v = document.createElement('span');
      v.className = 'val';
      v.textContent = value;
      div.append(l, v);
      wrap.append(div);
    };

    const rule = () => {
      const r = document.createElement('div');
      r.className = 'reci-rule';
      wrap.append(r);
    };

    const scanned = hud.items.filter((i) => i.scanned);
    if (scanned.length) {
      for (const item of scanned) {
        line(item.name[lang] || item.name.en, money(item.price));
      }
    } else {
      const waiting = document.createElement('div');
      waiting.className = 'reci-sub';
      waiting.style.margin = '10px 0';
      waiting.textContent = t('receiptEmpty');
      wrap.append(waiting);
    }

    rule();
    line(t('total'), money(hud.total), 'total');
    if (hud.phase !== 'scan') {
      line(t('paid'), money(hud.payment));
      line(t('changeDue'), money(hud.change), 'due big');
      line(t('yourChange'), money(hud.givenChange), 'given');
      if (hud.exact) {
        const e = document.createElement('div');
        e.className = 'reci-sub';
        e.style.marginTop = '4px';
        e.textContent = t('exactHint');
        wrap.append(e);
      }
      if (hud.givenChange === hud.change && hud.change > 0) {
        const stamp = document.createElement('div');
        stamp.className = 'reci-stamp good';
        stamp.textContent = 'EXACT';
        wrap.append(stamp);
      } else if (hud.givenChange > hud.change) {
        const stamp = document.createElement('div');
        stamp.className = 'reci-stamp bad';
        stamp.textContent = 'TOO MUCH';
        wrap.append(stamp);
      }
    }
    this.receiptDay.textContent = t('day', { n: hud.day });
    this.changeStatus.textContent = hud.phase === 'change'
      ? (hud.givenChange === hud.change ? '✓' : '…')
      : '';
    this.changeDue.textContent = money(hud.change);
    this.given.textContent = money(hud.givenChange);
  },

  updateCustomer(hud) {
    const lang = this.lang;
    this.customerAvatar.style.setProperty('--shirt', hud.shirt || '#5eead4');
    this.customerAvatar.style.setProperty('--hair', hud.hair || '#3b2f2f');
    this.customerName.textContent = hud.name[lang] || hud.name.en;
    const typeName = hud.typeName ? (hud.typeName[lang] || hud.typeName.en) : '';
    this.customerType.textContent = typeName;
    const noteKey = hud.type === 'hurry' ? 'noteHurry' : hud.type === 'bulk' ? 'noteBulk' : 'noteRegular';
    this.customerNote.textContent = t(noteKey);
    let bubble = '';
    if (hud.phase === 'scan') {
      bubble = hud.exact ? '💳' : '🛒';
    } else if (hud.phase === 'change') {
      bubble = hud.exact ? '💵' : '🪙';
    }
    this.customerBubble.textContent = bubble;
  },

  updateHint(hud) {
    if (hud.phase !== 'change') {
      this.moneyHint.textContent = '';
      return;
    }
    if (hud.givenChange > hud.change) {
      this.moneyHint.textContent = t('tooMuch');
    } else if (hud.givenChange === hud.change) {
      this.moneyHint.textContent = '';
    } else if (hud.givenChange === 0) {
      this.moneyHint.textContent = t('nextChange', { change: money(hud.change) });
    } else if (hud.suggest && hud.suggest.length) {
      this.moneyHint.textContent = t('hint', { coins: hud.suggest.map(money).join(' + ') });
    } else {
      this.moneyHint.textContent = t('notEnough');
    }
  },

  updateDots(hud) {
    if (this.customerDots.children.length !== hud.customerTotal) {
      this.customerDots.innerHTML = '';
      for (let i = 0; i < hud.customerTotal; i += 1) {
        const d = document.createElement('span');
        d.className = 'dot';
        this.customerDots.appendChild(d);
      }
    }
    [...this.customerDots.children].forEach((d, i) => {
      d.classList.toggle('done', i < hud.customerNo - 1 || hud.phase === 'dayClear');
      d.classList.toggle('current', i === hud.customerNo - 1 && hud.phase !== 'dayClear');
    });
  },

  renderChangeTray(hud) {
    this.changeTray.innerHTML = '';
    const stack = hud.givenStack || [];
    const bills = stack.filter((c) => c >= 100).reduce((a, b) => a + b, 0);
    const coins = stack.filter((c) => c < 100).reduce((a, b) => a + b, 0);
    this.traySummary.textContent = `${t('billsLabel')} ${money(bills)} · ${t('coinsLabel')} ${money(coins)}`;
    if (!stack.length) {
      this.changeTray.classList.remove('has');
      this.changeTray.dataset.empty = t('tapCoins');
      return;
    }
    delete this.changeTray.dataset.empty;
    this.changeTray.classList.add('has');
    for (const cents of stack.slice(0, 10)) {
      const chip = document.createElement('span');
      chip.className = 'tray-chip' + (cents >= 100 ? ' bill' : '');
      chip.textContent = money(cents);
      this.changeTray.appendChild(chip);
    }
    if (stack.length > 10) {
      const more = document.createElement('span');
      more.className = 'tray-chip more';
      more.textContent = `+${stack.length - 10}`;
      this.changeTray.appendChild(more);
    }
  },

  setFeedback(text, kind = '') {
    this.feedback.textContent = text || '';
    this.feedback.className = `feedback ${kind}`;
  },

  setMoneyEnabled(on) {
    this.moneyGrid.querySelectorAll('.money-btn').forEach((b) => { b.disabled = !on; });
    this.btnGive.disabled = !on;
    this.btnReset.disabled = !on;
  },

  updateMute(muted) {
    this._muted = muted;
    this.btnMute.textContent = muted ? '🔇' : '🔊';
    this.btnMute.setAttribute('aria-label', `${t('sound')}: ${muted ? t('off') : t('on')}`);
  },

  updateBest(best) {
    this.titleBest.textContent = best > 0 ? `${t('best')}: ${best}` : '';
  },

  pulseDayChip() {
    const chip = this.hudDay.closest('.day-chip');
    if (!chip) return;
    chip.classList.remove('pulse');
    void chip.offsetWidth;
    chip.classList.add('pulse');
    setTimeout(() => chip.classList.remove('pulse'), 900);
  },

  scanPulse() {
    const panel = document.querySelector('.belt-panel');
    if (!panel) return;
    panel.classList.remove('scanning');
    void panel.offsetWidth;
    panel.classList.add('scanning');
    setTimeout(() => panel.classList.remove('scanning'), 380);
  },

  showDayClear(hud, choices, onPick) {
    this.toastLayer.innerHTML = '';
    this.dayKicker.textContent = t('dayClearTitle');
    this.dayTitle.textContent = t('dayOf', { n: hud.day, total: hud.dayTotal });
    this.dayScoreValue.textContent = String(hud.dayScore);
    this.dayTargetValue.textContent = String(hud.target);
    this.dayMistakesValue.textContent = String(hud.mistakes);
    this.dayPerfectValue.textContent = String(hud.stats?.perfect ?? 0);
    this.dayComboValue.textContent = String(hud.stats?.bestCombo ?? 0);
    this.dayTipsValue.textContent = money(hud.stats?.tips ?? 0);
    this.dayMessage.textContent = hud.perfectDay
      ? `${t('perfectDay', { n: hud.bonus || 0 })} · ${t('chooseUpgrade')}`
      : `${t('bonus', { n: hud.bonus || 0 })} · ${t('chooseUpgrade')}`;
    this.upgradeCards.innerHTML = '';
    this.upgradeCards.classList.remove('hidden');
    this.btnRetry.classList.add('hidden');
    this.upgradeHint.classList.remove('hidden');
    for (const up of choices) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'upgrade-card';
      card.dataset.id = up.id;
      const icon = document.createElement('span');
      icon.className = 'u-icon';
      icon.textContent = up.icon;
      const name = document.createElement('span');
      name.className = 'u-name';
      name.textContent = up.name[this.lang] || up.name.en;
      const desc = document.createElement('span');
      desc.className = 'u-desc';
      desc.textContent = up.desc[this.lang] || up.desc.en;
      const tag = document.createElement('span');
      tag.className = `u-tag ${up.kind}`;
      tag.textContent = up.kind === 'rule' ? t('ruleUpgrade') : t('statUpgrade');
      card.append(icon, name, desc, tag);
      card.addEventListener('click', () => onPick(up.id));
      this.upgradeCards.appendChild(card);
    }
    this.dayScreen.classList.remove('hidden');
  },

  showDayFail(hud, onRetry) {
    this.toastLayer.innerHTML = '';
    this.dayKicker.textContent = t('dayFailTitle');
    this.dayTitle.textContent = t('dayOf', { n: hud.day, total: hud.dayTotal });
    this.dayScoreValue.textContent = String(hud.dayScore);
    this.dayTargetValue.textContent = String(hud.target);
    this.dayMistakesValue.textContent = String(hud.mistakes);
    this.dayPerfectValue.textContent = String(hud.stats?.perfect ?? 0);
    this.dayComboValue.textContent = String(hud.stats?.bestCombo ?? 0);
    this.dayTipsValue.textContent = money(hud.stats?.tips ?? 0);
    this.dayMessage.textContent = t('dayTargetMissed', { n: Math.max(0, hud.target - hud.dayScore) });
    this.upgradeCards.innerHTML = '';
    this.upgradeCards.classList.add('hidden');
    this.btnRetry.classList.remove('hidden');
    this.upgradeHint.classList.add('hidden');
    this.btnRetry.onclick = onRetry;
    this.dayScreen.classList.remove('hidden');
  },

  hideDay() { this.dayScreen.classList.add('hidden'); },

  showEnding(hud, best, onAgain) {
    this.toastLayer.innerHTML = '';
    this.endingKicker.textContent = t('runComplete');
    this.endingTitle.textContent = t('endingTitle');
    this.rankBadge.textContent = hud.rank;
    this.finalScoreValue.textContent = String(hud.score);
    this.endingBestValue.textContent = String(best);
    this.endingDayValue.textContent = `${hud.day}/${hud.dayTotal}`;
    this.endingMessage.textContent = t(`ending${hud.rank}`);
    this.btnAgain.onclick = onAgain;
    this.endingScreen.classList.remove('hidden');
  },

  hideEnding() { this.endingScreen.classList.add('hidden'); },

  toast(text, kind = '', x = 50, y = 55) {
    const node = document.createElement('div');
    node.className = `toast ${kind}`;
    node.textContent = text;
    node.style.left = `${x}%`;
    node.style.top = `${y}%`;
    this.toastLayer.appendChild(node);
    setTimeout(() => node.remove(), 950);
  },

  flash(kind = '') {
    this.flashEl.className = `flash ${kind} on`;
    setTimeout(() => { this.flashEl.className = `flash ${kind}`; }, 280);
  },

  shake() {
    this.playArea.classList.add('shake');
    setTimeout(() => this.playArea.classList.remove('shake'), 300);
  },
};
