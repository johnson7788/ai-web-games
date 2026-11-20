// UI 屏幕管理 + 牌桌渲染 + i18n 刷新（文案全部走 i18n，禁止 innerHTML 拼动态文案）
import { i18n, t } from '../core/i18n.js';
import { save } from '../core/save.js';

const $ = (id) => document.getElementById(id);

export const ui = {
  lang: i18n.lang,
  dir: i18n.dir,
  langSelects: [document.getElementById('lang-select'), document.getElementById('lang-select-pause')],

  btnStart: $('btn-start'),
  btnResume: $('btn-resume'),
  btnPause: $('btn-pause'),
  btnPeek: $('btn-peek'),

  board: $('board'),

  // ---- 屏切换 ----
  show(id) {
    for (const s of document.querySelectorAll('.screen')) s.classList.add('hidden');
    $(id).classList.remove('hidden');
  },
  showTitle() { this.show('screen-title'); this.refreshTitle(); },
  showGame() { this.show('screen-game'); },
  showPause() { this.show('screen-pause'); },
  showWin() { this.show('screen-win'); },
  showFail() { this.show('screen-fail'); },
  showCollection() { this.show('screen-collection'); },
  showShop() { this.show('screen-shop'); },
  hideAll() { for (const s of document.querySelectorAll('.screen')) s.classList.add('hidden'); },

  hud: {
    show() { $('hud').classList.remove('hidden'); },
    hide() { $('hud').classList.add('hidden'); },
    update(run) {
      $('hud-level').textContent = `LV ${run.levelIndex}`;
      $('hud-moves').textContent = `${t('moves')} ${Math.max(0, run.movesLeft)}`;
      $('hud-pairs').textContent = `${t('pairs')} ${run.pairsMatched}/${run.pairsTotal}`;
      const combo = $('hud-combo');
      if (run.combo >= 2) {
        combo.classList.remove('hidden');
        combo.textContent = `${t('combo')} ×${run.combo}`;
      } else {
        combo.classList.add('hidden');
      }
      $('peek-count').textContent = run.peeksLeft > 0 ? run.peeksLeft : (run.peekRefillsUsed >= 2 ? '✕' : '▶');
      const peekBtn = $('btn-peek');
      peekBtn.classList.toggle('empty', run.peeksLeft <= 0);
    },
    coins(n) { $('hud-coins').textContent = `🪙 ${n}`; },
  },

  toast(text, ms = 1600) {
    const el = $('toast');
    el.textContent = text;
    el.classList.remove('hidden');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => el.classList.add('hidden'), ms);
  },

  // ---- 牌桌 ----
  buildBoard(run, cardAssets) {
    const board = $('board');
    board.innerHTML = '';
    board.style.setProperty('--rows', run.level.rows);
    board.style.gridTemplateColumns = `repeat(${run.level.cols}, 1fr)`;
    for (const card of run.deck) {
      const el = document.createElement('button');
      el.className = 'card';
      el.dataset.id = card.id;
      el.setAttribute('aria-label', 'card');
      el.innerHTML = `
        <div class="card-inner">
          <div class="face back"></div>
          <div class="face front"></div>
        </div>`;
      const front = el.querySelector('.face.front');
      if (card.kind === 'obstacle') {
        el.classList.add('obstacle');
      } else {
        const img = document.createElement('img');
        img.src = cardAssets[card.char];
        img.alt = '';
        img.draggable = false;
        if (card.mirrored) img.classList.add('mirrored');
        front.appendChild(img);
        if (card.kind === 'star') el.classList.add('star');
      }
      el.addEventListener('click', () => this.onCardClick?.(card.id, el));
      board.appendChild(el);
    }
    this._cardEls = [...board.querySelectorAll('.card')];
  },

  cardEl(id) { return this._cardEls?.[id]; },

  setCardUp(id, up) { this.cardEl(id)?.classList.toggle('up', up); },

  setCardMatched(id) {
    const el = this.cardEl(id);
    if (!el) return;
    el.classList.add('up', 'matched');
    el.disabled = true;
  },

  flashWrong(id, ms) {
    const el = this.cardEl(id);
    if (!el) return;
    el.classList.add('wrong');
    setTimeout(() => el.classList.remove('wrong'), ms);
  },

  peekShow(ids, ms) {
    for (const id of ids) {
      const el = this.cardEl(id);
      if (!el) continue;
      el.classList.add('peeking');
      setTimeout(() => el.classList.remove('peeking'), ms);
    }
  },

  shuffleAnim() {
    for (const el of this._cardEls || []) {
      el.classList.add('shuffle-anim');
      setTimeout(() => el.classList.remove('shuffle-anim'), 520);
    }
  },

  revealAll(ms) {
    for (const el of this._cardEls || []) el.classList.add('peeking');
    setTimeout(() => {
      for (const el of this._cardEls || []) el.classList.remove('peeking');
    }, ms);
  },

  // ---- 结算 ----
  showWinPanel(run, stars, coins, canDouble) {
    $('win-title').textContent = t('win');
    const starsEl = $('win-stars');
    starsEl.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const s = document.createElement('span');
      s.className = i < stars ? 'on' : 'off';
      s.textContent = '★';
      starsEl.appendChild(s);
    }
    $('win-reward').textContent = `+${coins} 🪙 · ${t('movesLeft')} ${Math.max(0, run.movesLeft)}`;
    $('btn-double').classList.toggle('hidden', !canDouble);
    $('btn-next').classList.toggle('hidden', run.levelIndex >= 12);
    this.showWin();
  },

  showFailPanel(run, canRevive) {
    $('fail-title').textContent = t('fail');
    $('fail-pairs').textContent = `${t('pairs')} ${run.pairsMatched}/${run.pairsTotal}`;
    $('btn-revive').classList.toggle('hidden', !canRevive);
    this.showFail();
  },

  // ---- 图鉴 ----
  buildCollection(cardAssets, collected, newIds = []) {
    const grid = $('collection-grid');
    grid.innerHTML = '';
    const ids = Object.keys(cardAssets);
    for (const id of ids) {
      const el = document.createElement('div');
      el.className = 'col-item';
      if (collected[id]) {
        const img = document.createElement('img');
        img.src = cardAssets[id];
        img.alt = '';
        el.appendChild(img);
        if (newIds.includes(id)) el.classList.add('new-found');
      } else {
        el.classList.add('locked');
      }
      grid.appendChild(el);
    }
    $('collection-progress').textContent = `${t('collected')} ${Object.keys(collected).length} / ${ids.length}`;
  },

  // ---- 商店 ----
  buildShop(upgrades, owned, coins, onBuy) {
    const list = $('shop-list');
    list.innerHTML = '';
    for (const u of upgrades) {
      if (u.auto) continue;
      const row = document.createElement('div');
      row.className = 'shop-item' + (owned.includes(u.id) ? ' owned' : '');
      const text = document.createElement('div');
      text.className = 'si-text';
      const name = document.createElement('div');
      name.className = 'si-name';
      name.textContent = u.detail[i18n.lang] ?? u.detail.en;
      const desc = document.createElement('div');
      desc.className = 'si-desc';
      desc.textContent = owned.includes(u.id) ? t('shopOwned') : `${t('buy')} · 🪙 ${u.cost}`;
      text.append(name, desc);
      row.appendChild(text);
      if (!owned.includes(u.id)) {
        const btn = document.createElement('button');
        btn.className = 'btn btn-secondary';
        btn.textContent = `${u.cost} 🪙`;
        btn.addEventListener('click', () => onBuy(u));
        row.appendChild(btn);
      }
      list.appendChild(row);
    }
    $('shop-coins').textContent = `🪙 ${coins}`;
  },

  // ---- i18n ----
  applyLang() {
    this.lang = i18n.lang;
    this.dir = i18n.dir;
    document.documentElement.lang = i18n.lang;
    document.documentElement.dir = i18n.dir;
    const map = {
      'btn-start': this._startLabel || 'start',
      'btn-collection': 'collection',
      'btn-shop': 'shop',
      'btn-howto': 'howto',
      'btn-resume': 'resume',
      'btn-restart': 'restart',
      'btn-quit': 'quit',
      'btn-next': 'nextLevel',
      'btn-retry-win': 'retry',
      'btn-retry-fail': 'retry',
      'btn-revive': 'revive',
      'btn-double': 'doubleCoins',
      'btn-menu-win': 'quit',
      'btn-menu-fail': 'quit',
      'btn-collection-back': 'back',
      'btn-shop-back': 'back',
      'tut-skip': 'skip',
      'pause-title': 'paused',
      'collection-title': 'collection',
      'shop-title': 'shop',
      'subtitle-text': 'subtitle',
    };
    for (const [id, key] of Object.entries(map)) {
      const el = $(id);
      if (el) el.textContent = t(key);
    }
    $('subtitle-text').textContent = t('subtitle');
    // 语言下拉
    for (const sel of this.langSelects) {
      if (!sel) continue;
      sel.innerHTML = '';
      for (const { code, name } of i18n.options()) {
        const opt = document.createElement('option');
        opt.value = code;
        opt.textContent = name;
        if (code === i18n.lang) opt.selected = true;
        sel.appendChild(opt);
      }
    }
  },

  setStartLabel(txt) { this._startLabel = txt; $('btn-start').textContent = txt; },

  refreshTitle() {
    $('subtitle-text').textContent = t('subtitle');
  },

  setLang(lang) {
    if (i18n.setLang(lang)) {
      this.applyLang();
      return true;
    }
    return false;
  },
};

export default ui;
