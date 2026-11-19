// UI 模块：屏幕 / HUD / 操作条 / 语言下拉，全部文案经 i18n.t()。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';
import { STAGES } from '../../config/balance.js';

const $ = (id) => document.getElementById(id);

export const ui = {
  els: {
    canvas: $('canvas'),
    hud: $('hud'),
    hudSelfName: $('hud-self-name'),
    hudOtherName: $('hud-other-name'),
    hudSelfHp: $('hud-self-hp'),
    hudSelfHpNum: $('hud-self-hp-num'),
    hudSelfMp: $('hud-self-mp'),
    hudOtherHp: $('hud-other-hp'),
    hudOtherHpNum: $('hud-other-hp-num'),
    hudOtherMp: $('hud-other-mp'),
    hudCombo: $('hud-combo'),
    hudRound: $('hud-round'),
    actionBar: $('action-bar'),
    btnDodge: $('btn-dodge'),
    dodgeLabel: $('dodge-label'),
    dodgeCd: $('dodge-cd'),
    weaponRow: $('weapon-row'),
    skillCol: $('skill-col'),
    screenTitle: $('screen-title'),
    screenPause: $('screen-pause'),
    screenResult: $('screen-result'),
    titleText: $('title-text'),
    subtitleText: $('subtitle-text'),
    pauseTitle: $('pause-title'),
    resultTitle: $('result-title'),
    resultStars: $('result-stars'),
    resultMeta: $('result-meta'),
    btnStart: $('btn-start'),
    btnHowto: $('btn-howto'),
    btnResume: $('btn-resume'),
    btnRestart: $('btn-restart'),
    btnHome: $('btn-home'),
    btnRetry: $('btn-retry'),
    btnHome2: $('btn-home2'),
    btnMute: $('btn-mute'),
    btnPause: $('btn-pause'),
    langSelects: [$('lang-select'), $('lang-select-pause')],
    rotateScreen: $('rotate-screen'),
    rotateText: $('rotate-text'),
    btnRotateSkip: $('btn-rotate-skip'),
    tutorial: $('tutorial'),
    tutTitle: $('tut-title'),
    tutText: $('tut-text'),
    tutSkip: $('tut-skip'),
    tutNext: $('tut-next'),
  },

  get lang() { return i18n.lang; },
  get dir() { return i18n.dir; },

  applyLang() {
    syncDocumentLang();
    const E = this.els;
    E.titleText.textContent = t('title');
    E.subtitleText.textContent = t('subtitle');
    E.btnStart.textContent = t('start');
    E.btnHowto.textContent = t('howto');
    E.pauseTitle.textContent = t('paused');
    E.btnResume.textContent = t('resume');
    E.btnRestart.textContent = t('restart');
    E.btnHome.textContent = t('menu');
    E.btnHome2.textContent = t('backToMenu');
    E.btnRetry.textContent = t('retry');
    E.dodgeLabel.textContent = t('dodgeLabel');
    E.rotateText.textContent = t('rotateText');
    E.btnRotateSkip.textContent = t('playAnyway');
    E.tutSkip.textContent = t('skip');
    E.tutNext.textContent = t('gotIt');
    E.tutTitle.textContent = t('tutTitle');
    for (const sel of E.langSelects) {
      if (sel) sel.setAttribute('aria-label', t('language'));
    }
    // 图标（几何字形，避免豆腐块）
    E.btnDodge.querySelector('.btn-icon').textContent = '◯';
    document.getElementById('wicon-0').textContent = '◇';
    document.getElementById('wicon-1').textContent = '✦';
    document.getElementById('wicon-2').textContent = '◆';
    document.getElementById('sicon-0').textContent = '⚡';
    document.getElementById('sicon-1').textContent = '✚';
    document.getElementById('slabel-0').textContent = t('skillDragon');
    document.getElementById('slabel-1').textContent = t('skillSurge');
    document.getElementById('wbtn-0').setAttribute('aria-label', t('weaponLight'));
    document.getElementById('wbtn-1').setAttribute('aria-label', t('weaponArc'));
    document.getElementById('wbtn-2').setAttribute('aria-label', t('weaponHeavy'));
    document.getElementById('skill-0').setAttribute('aria-label', t('skillDragon'));
    document.getElementById('skill-1').setAttribute('aria-label', t('skillSurge'));
    this.fillLangOptions();
  },

  fillLangOptions() {
    for (const sel of this.els.langSelects) {
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
    this.els.screenTitle.classList.remove('hidden');
    this.els.screenTitle.classList.add('is-active');
    this.els.screenPause.classList.add('hidden');
    this.els.screenResult.classList.add('hidden');
    this.els.hud.classList.add('hidden');
    this.els.actionBar.classList.add('hidden');
  },

  showGame() {
    this.els.screenTitle.classList.add('hidden');
    this.els.screenTitle.classList.remove('is-active');
    this.els.screenPause.classList.add('hidden');
    this.els.screenResult.classList.add('hidden');
    this.els.hud.classList.remove('hidden');
    this.els.actionBar.classList.remove('hidden');
  },

  showPause() {
    this.els.screenPause.classList.remove('hidden');
    this.applyLang();
  },

  hidePause() {
    this.els.screenPause.classList.add('hidden');
  },

  showResult(won, stars, meta) {
    this.els.screenResult.classList.remove('hidden');
    this.els.resultTitle.textContent = t(won ? 'campaignWin' : 'campaignLose');
    this.els.resultStars.textContent = '★'.repeat(Math.max(1, stars));
    this.els.resultMeta.textContent = meta;
    this.els.actionBar.classList.add('hidden');
  },

  updateHud(run) {
    const E = this.els;
    const hud = run.getHud();
    const s = hud.self;
    const o = hud.other;
    const selfHpPct = Math.max(0, s.hp / s.maxHp);
    const otherHpPct = Math.max(0, o.hp / o.maxHp);
    const selfMpPct = Math.max(0, s.mp / s.maxMp);
    const otherMpPct = Math.max(0, o.mp / o.maxMp);
    E.hudSelfHp.style.transform = `scaleX(${selfHpPct})`;
    E.hudOtherHp.style.transform = `scaleX(${otherHpPct})`;
    E.hudSelfMp.style.transform = `scaleX(${selfMpPct})`;
    E.hudOtherMp.style.transform = `scaleX(${otherMpPct})`;
    E.hudSelfHpNum.textContent = `${Math.ceil(s.hp)} / ${s.maxHp}`;
    E.hudOtherHpNum.textContent = `${Math.ceil(o.hp)} / ${o.maxHp}`;
    if (s.combo >= 2) {
      E.hudCombo.textContent = `${t('combo')} ×${s.combo}`;
      E.hudCombo.classList.add('show');
    } else {
      E.hudCombo.classList.remove('show');
    }
  },

  updateRound(stage) {
    this.els.hudRound.textContent = `${t('round')} ${stage} / ${STAGES.length}`;
    this.els.hudSelfName.textContent = t('enemy1');
    this.els.hudOtherName.textContent = t(STAGES[stage - 1]?.name || 'enemy1');
  },

  updateActionBar(run) {
    const hud = run.getHud();
    for (let i = 0; i < 3; i += 1) {
      const w = hud.selfWeapons[i];
      const btn = document.getElementById(`wbtn-${i}`);
      const cd = document.getElementById(`wcd-${i}`);
      const cost = document.getElementById(`wcost-${i}`);
      if (w) {
        cost.textContent = `${w.cost}`;
        const ready = w.ready && hud.self.mp >= w.cost;
        btn.classList.toggle('disabled', !ready);
        const frac = w.maxCd > 0 ? Math.max(0, w.cdLeft / w.maxCd) : 0;
        cd.style.transform = `scaleY(${frac})`;
      }
    }
    for (let i = 0; i < 2; i += 1) {
      const s = hud.selfSkills[i];
      const btn = document.getElementById(`skill-${i}`);
      const cd = document.getElementById(`scd-${i}`);
      if (s) {
        const ready = s.ready && hud.self.mp >= s.cost;
        btn.classList.toggle('disabled', !ready);
        const frac = s.maxCd > 0 ? Math.max(0, s.cdLeft / s.maxCd) : 0;
        cd.style.transform = `scaleY(${frac})`;
      }
    }
    const d = hud.selfDodge;
    const dBtn = document.getElementById('btn-dodge');
    dBtn.classList.toggle('disabled', !d.ready);
    document.getElementById('dodge-cd').style.transform = `scaleY(${d.maxCd > 0 ? Math.max(0, d.cdLeft / d.maxCd) : 0})`;
  },

  setMuted(muted) {
    this.els.btnMute.textContent = muted ? '♪̶' : '♪';
    this.els.btnMute.setAttribute('aria-label', muted ? t('mute') + ' (on)' : t('mute'));
  },
};
