// COLOR MASTER MIX · UI 模块：屏幕 / HUD / 色板 / 关卡格 / 标题预览 / 教程卡片渲染
import { i18n, t, syncDocumentLang } from '../core/i18n.js';
import { PALETTE } from '../../config/colors.js';
import { LEVELS } from '../../config/shapes.js';
import { GAME, LAYOUT } from '../../config/game.config.js';

const $ = (id) => document.getElementById(id);

export const ui = {
  // 屏幕
  screenTitle: $('screen-title'),
  screenPause: $('screen-pause'),
  screenResult: $('screen-result'),
  // 标题
  titleText: $('title-text'),
  subtitleText: $('subtitle-text'),
  btnStart: $('btn-start'),
  btnHowtoTitle: $('btn-howto-title'),
  langSelect: $('lang-select'),
  titlePreview: $('title-preview'),
  levelGrid: $('level-grid'),
  // 暂停
  pauseTitle: $('pause-title'),
  btnResume: $('btn-resume'),
  btnRestart2: $('btn-restart2'),
  btnTutReplay: $('btn-tut-replay'),
  btnHome3: $('btn-home3'),
  langSelectPause: $('lang-select-pause'),
  // 结果
  resultTitle: $('result-title'),
  resultStars: $('result-stars'),
  resultTime: $('result-time'),
  resultMeta: $('result-meta'),
  btnRetry: $('btn-retry'),
  btnNext: $('btn-next'),
  btnHome2: $('btn-home2'),
  // HUD
  hud: $('hud'),
  hudLevel: $('hud-level'),
  hudTime: $('hud-time'),
  hudScore: $('hud-score'),
  hudCombo: $('hud-combo'),
  hudProgress: $('hud-progress'),
  btnMagic: $('btn-magic'),
  magicBadge: $('magic-badge'),
  btnUndo: $('btn-undo'),
  btnHowto: $('btn-howto'),
  btnMute: $('btn-mute'),
  btnRestart: $('btn-restart'),
  btnHome: $('btn-home'),
  // 色板 / 旋转 / 教程 / 目标参考
  palette: $('palette'),
  goalPreview: $('goal-preview'),
  goalLabel: $('goal-label'),
  goalGrid: $('goal-grid'),
  rotateScreen: $('rotate-screen'),
  rotateText: $('rotate-text'),
  tutorial: $('tutorial'),
  tutCard: $('tut-card'),
  tutTitle: $('tut-title'),
  tutText: $('tut-text'),
  tutNext: $('tut-next'),
  tutSkip: $('tut-skip'),

  langSelects: [null, null],
  swatchEls: [],
  _selFamily: 0,
  _selShade: 0,

  get lang() { return i18n.lang; },
  get dir() { return i18n.dir; },

  // 所有可见文案从这里刷新
  applyLang() {
    syncDocumentLang();
    this.titleText.textContent = t('title');
    this.subtitleText.textContent = t('subtitle');
    this.btnStart.textContent = t('start');
    this.btnHowtoTitle.textContent = t('howto');
    this.pauseTitle.textContent = t('paused');
    this.btnResume.textContent = t('resume');
    this.btnRestart2.textContent = t('restart');
    this.btnTutReplay.textContent = t('replayGuide');
    this.btnHome3.textContent = t('home');
    this.btnRetry.textContent = t('retry');
    this.btnNext.textContent = t('nextLevel');
    this.btnHome2.textContent = t('home');
    this.rotateText.textContent = t('rotateHint');
    this.btnUndo.title = t('undo');
    this.btnMagic.title = t('magic');
    this.btnHowto.title = t('howto');
    this.btnRestart.title = t('restart');
    this.btnHome.title = t('home');
    for (const sel of [this.langSelect, this.langSelectPause]) {
      if (sel) sel.setAttribute('aria-label', t('language'));
    }
    this.fillLangOptions();
  },

  fillLangOptions() {
    for (const sel of [this.langSelect, this.langSelectPause]) {
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
    if (this._onPick && this.swatchEls.length) {
      this.buildPalette(this._onPick);
      this.highlightSelected(this._selFamily, this._selShade);
    }
    return i18n.lang;
  },

  buildTitlePreview() {
    this.titlePreview.innerHTML = '';
    for (let f = 0; f < PALETTE.length; f += 1) {
      for (let s = 0; s < PALETTE[f].shades.length; s += 1) {
        const d = document.createElement('div');
        d.className = 'mini-swatch';
        d.style.background = PALETTE[f].shades[s];
        this.titlePreview.appendChild(d);
      }
    }
  },

  buildPalette(onPick) {
    this._onPick = onPick;
    this.palette.innerHTML = '';
    this.swatchEls = [];
    for (let f = 0; f < PALETTE.length; f += 1) {
      const row = document.createElement('div');
      row.className = 'pal-row';
      row.dataset.family = String(f);
      const label = document.createElement('div');
      label.className = 'pal-label';
      label.style.background = `linear-gradient(180deg, ${PALETTE[f].shades[7]}, ${PALETTE[f].shades[0]})`;
      const name = document.createElement('span');
      name.className = 'fam-name';
      name.textContent = (i18n.lang === 'zh' ? ['红', '橙', '黄', '绿', '青', '蓝', '紫', '粉'][f] : ['R', 'O', 'Y', 'G', 'C', 'B', 'P', 'M'][f]);
      label.appendChild(name);
      row.appendChild(label);
      for (let s = 0; s < PALETTE[f].shades.length; s += 1) {
        const btn = document.createElement('button');
        btn.className = 'swatch';
        btn.dataset.family = String(f);
        btn.dataset.shade = String(s);
        btn.style.background = PALETTE[f].shades[s];
        btn.setAttribute('aria-label', `color ${f}-${s}`);
        btn.addEventListener('click', () => onPick(f, s));
        row.appendChild(btn);
        this.swatchEls.push(btn);
      }
      this.palette.appendChild(row);
    }
    this._selFamily = 0;
    this._selShade = 0;
    this.highlightSelected(0, 0);
  },

  highlightSelected(f, s) {
    this._selFamily = f;
    this._selShade = s;
    for (const el of this.swatchEls) {
      const on = Number(el.dataset.family) === f && Number(el.dataset.shade) === s;
      el.classList.toggle('sel', on);
    }
    for (const row of this.palette.querySelectorAll('.pal-row')) {
      row.classList.toggle('sel-row', Number(row.dataset.family) === f);
    }
  },

  buildLevelGrid(levelsUnlocked) {
    this.levelGrid.innerHTML = '';
    LEVELS.forEach((lv, i) => {
      const cell = document.createElement('button');
      cell.className = 'level-cell' + (i >= levelsUnlocked ? ' locked' : '');
      cell.textContent = String(i + 1);
      const stars = document.createElement('span');
      stars.className = 'lv-stars';
      stars.textContent = '·'.repeat(Math.min(3, i + 1)); // 占位；真实星级由 main 传入覆盖
      cell.appendChild(stars);
      if (i < levelsUnlocked) {
        cell.addEventListener('click', () => this._onLevelClick(i));
      }
      this.levelGrid.appendChild(cell);
    });
  },

  // 真实星级回填（main 用存档更新）
  setLevelStars(starsByLevel) {
    const cells = this.levelGrid.querySelectorAll('.level-cell');
    cells.forEach((cell, i) => {
      const st = starsByLevel[i] || 0;
      const span = cell.querySelector('.lv-stars');
      if (span) span.textContent = st > 0 ? '★'.repeat(st) : '·';
    });
  },

  _onLevelClick: null,

  // 目标参考缩略图：把本关图形按彩虹渐变涂满，告诉玩家「要完成的图案」
  buildGoalPreview(run) {
    this.goalGrid.innerHTML = '';
    const grid = run.level.grid;
    const cell = 13;
    this.goalGrid.style.width = `${grid * cell}px`;
    this.goalGrid.style.height = `${grid * cell}px`;
    for (const c of run.level.cells) {
      const idx = (c.r + c.c) % 64;
      const d = document.createElement('div');
      d.className = 'gcell';
      d.style.left = `${c.c * cell + 1}px`;
      d.style.top = `${c.r * cell + 1}px`;
      d.style.width = `${cell - 2}px`;
      d.style.height = `${cell - 2}px`;
      d.style.background = PALETTE[Math.floor(idx / 8)].shades[idx % 8];
      this.goalGrid.appendChild(d);
    }
    this.goalLabel.textContent = t('goal');
  },

  // ---------- 屏幕切换 ----------
  hideAllScreens() {
    this.screenTitle.classList.add('hidden');
    this.screenTitle.classList.remove('is-active');
    this.screenPause.classList.add('hidden');
    this.screenResult.classList.add('hidden');
  },

  showTitle() {
    this.hideAllScreens();
    this.screenTitle.classList.remove('hidden');
    this.screenTitle.classList.add('is-active');
    this.hud.classList.add('hidden');
    this.palette.classList.add('hidden');
    this.goalPreview.classList.add('hidden');
    this.tutorial.classList.add('hidden');
    this.applyLang();
  },

  showGame() {
    this.hideAllScreens();
    this.hud.classList.remove('hidden');
    this.palette.classList.remove('hidden');
    this.goalPreview.classList.remove('hidden');
    this.tutorial.classList.add('hidden');
  },

  showPause() {
    this.screenPause.classList.remove('hidden');
    this.applyLang();
  },

  hidePause() {
    this.screenPause.classList.add('hidden');
  },

  showResult(win, hud) {
    this.hideAllScreens();
    this.screenResult.classList.remove('hidden');
    this.hud.classList.add('hidden');
    this.palette.classList.add('hidden');
    this.tutorial.classList.add('hidden');
    this.resultTitle.textContent = win ? t('winTitle') : t('loseTitle');
    this.resultTitle.style.color = win ? '#ffe14a' : '#ff6b8a';
    this.resultStars.textContent = win ? '★'.repeat(hud.stars) + '☆'.repeat(Math.max(0, 3 - hud.stars)) : '—';
    this.resultTime.textContent = win ? t('timeLeft', { s: hud.timeLeft }) : t('timeOut');
    this.resultMeta.textContent = `${t('score')}: ${hud.score}  ·  ${t('combo')}: ${hud.maxCombo}`;
    this.btnNext.style.display = win && hud.level < LEVELS.length ? '' : 'none';
  },

  updateHUD(hud) {
    this.hudLevel.textContent = `${t('level')} ${hud.level}`;
    this.hudTime.textContent = `${hud.timeLeft}s`;
    this.hudScore.textContent = `${t('score')} ${hud.score}`;
    this.hudCombo.textContent = `×${hud.combo}`;
    this.hudProgress.textContent = `${hud.filled}/${hud.total}`;
    this.magicBadge.textContent = hud.magicFillsLeft > 0 ? String(hud.magicFillsLeft) : '';
    this.magicBadge.style.display = hud.magicFillsLeft > 0 ? '' : 'none';
    this.btnMagic.disabled = hud.magicFillsLeft <= 0;
    this.btnUndo.disabled = false;
  },

  setMuteIcon(muted) {
    this.btnMute.textContent = muted ? '🔇' : '🔊';
  },

  // ---------- 教程卡片 ----------
  showTutorial(stepTitle, stepText, targetSelector) {
    this.tutTitle.textContent = stepTitle;
    this.tutText.textContent = stepText;
    this.clearTutorialTarget();
    if (targetSelector) {
      const el = document.querySelector(targetSelector);
      if (el) el.classList.add('tut-target');
    }
    this.tutorial.classList.remove('hidden');
  },

  clearTutorialTarget() {
    for (const el of document.querySelectorAll('.tut-target')) el.classList.remove('tut-target');
  },

  hideTutorial() {
    this.tutorial.classList.add('hidden');
    this.clearTutorialTarget();
  },
};
