// MERGE MELON DROP · UI 模块：屏幕显隐 / 多语言 / HUD / 结算卡。
// 只负责 DOM 文案与可见性；游戏状态机与教程在 main.js。
import { i18n, t, syncDocumentLang } from '../core/i18n.js';
import { TIERS, ROCK } from '../../config/game.config.js';

const $ = (id) => document.getElementById(id);

export const ui = {
  titleScreen: $('screen-title'),
  pauseScreen: $('screen-pause'),
  resultScreen: $('screen-result'),
  hud: $('hud'),
  lastBest: 0,

  get lang() { return i18n.lang; },
  get dir() { return i18n.dir; },

  // 所有可见文案都从这里刷新；切语言时调用一次
  applyLang() {
    syncDocumentLang();
    $('title-text').textContent = t('title');
    $('subtitle-text').textContent = t('subtitle');
    $('btn-start').textContent = t('start');
    $('btn-resume').textContent = t('resume');
    $('pause-title').textContent = t('paused');
    $('result-title').textContent = t('gameover');
    $('btn-retry').textContent = t('retry');
    $('btn-home2').textContent = t('menu');
    $('btn-home3').textContent = t('menu');
    $('btn-restart2').textContent = t('restart');
    $('btn-tut-replay').textContent = t('howto');
    $('btn-howto-title').textContent = t('howto');
    $('btn-howto').setAttribute('aria-label', t('howto'));
    $('btn-home').setAttribute('aria-label', t('menu'));
    $('btn-restart').setAttribute('aria-label', t('restart'));
    $('btn-mute').setAttribute('aria-label', t('mute'));
    $('rotate-text').textContent = t('rotateHint');
    $('btn-rotate-skip').textContent = t('rotateSkip');
    $('tut-title').textContent = t('tutTitle');
    $('tut-skip').textContent = t('tutSkip');
    $('tut-next').textContent = t('tutNext');
    for (const sel of [$('lang-select'), $('lang-select-pause')]) {
      if (sel) sel.setAttribute('aria-label', t('language'));
    }
    this.fillLangOptions();
    this.updateBest(this.lastBest);
  },

  fillLangOptions() {
    for (const sel of [$('lang-select'), $('lang-select-pause')]) {
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

  updateBest(best) {
    this.lastBest = best;
    const s = String(best | 0);
    $('title-best').textContent = `${t('best')}: ${s}`;
    $('hud-best').textContent = s;
    $('result-best').textContent = `${t('bestFinal')}: ${s}`;
  },

  // 更新下一球预览（-1 = 岩石）
  updateNext(tier) {
    const orb = $('next-orb');
    const name = $('next-name');
    if (tier === -1) {
      orb.style.background = 'radial-gradient(circle at 35% 30%, #b9b9c9, #7a7a8c 55%, #3f3f50)';
      orb.style.boxShadow = '0 0 10px #9a9aac';
      orb.textContent = '';
      name.textContent = t('rock');
    } else {
      const ti = TIERS[tier];
      orb.style.background = `radial-gradient(circle at 35% 30%, ${ti.rim}, ${ti.color} 55%, ${ti.dark})`;
      orb.style.boxShadow = `0 0 12px ${ti.rim}`;
      orb.textContent = String(tier);
      name.textContent = `${ti.name}`;
    }
  },

  updateHud(h) {
    $('hud-score').textContent = String(h.score | 0);
    $('hud-best').textContent = String(Math.max(h.best | 0, h.score | 0));
    this.updateNext(h.nextTier);
    const comboEl = $('hud-combo');
    if (h.combo >= 2) {
      comboEl.classList.remove('hidden');
      comboEl.textContent = `COMBO ×${h.combo}`;
    } else {
      comboEl.classList.add('hidden');
    }
    const stage = h.levelsReached >= 3 ? 'stage3' : h.levelsReached >= 2 ? 'stage2' : 'stage1';
    $('hud-stage').textContent = t(stage);
  },

  showTitle() {
    this.hud.classList.add('hidden');
    this.pauseScreen.classList.add('hidden');
    this.resultScreen.classList.add('hidden');
    this.titleScreen.classList.remove('hidden');
    this.titleScreen.classList.add('is-active');
    this.applyLang();
  },

  showGame() {
    this.titleScreen.classList.add('hidden');
    this.titleScreen.classList.remove('is-active');
    this.pauseScreen.classList.add('hidden');
    this.resultScreen.classList.add('hidden');
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
    this.hud.classList.add('hidden');
    this.pauseScreen.classList.add('hidden');
    this.resultScreen.classList.remove('hidden');
    // 星星
    const starEl = $('result-stars');
    starEl.innerHTML = '';
    for (let i = 0; i < 3; i += 1) {
      const s = document.createElement('span');
      s.className = i < data.stars ? 'star on' : 'star';
      s.textContent = '★';
      starEl.appendChild(s);
    }
    $('result-score').textContent = `${t('scoreFinal')}: ${data.score}`;
    this.updateBest(data.best);
    const mt = data.maxTier >= 0 ? TIERS[data.maxTier].name : '—';
    $('result-maxtier').textContent = `${t('maxTier')}: ${mt}`;
    const nb = $('result-newbest');
    if (data.newBest) nb.classList.remove('hidden');
    else nb.classList.add('hidden');
    this.applyLang();
    // 重设星级文案
    const starMsg = data.stars >= 3 ? t('resultStars3') : data.stars >= 2 ? t('resultStars2') : t('resultStars1');
    $('result-score').textContent = `${t('scoreFinal')}: ${data.score} · ${starMsg}`;
  },
};
