// src/ui/gameboard.js — 核心玩区：题目卡（成语/单词 + 缺字槽）+ 候选字格 + 提示/重置道具。
// 数据来自 main 每帧喂入的 hud；只在 boardKey 变化时重建 DOM（避免每帧重建打断点击）。
import { t } from '../core/i18n.js';

export function createGameboard(root, hooks = {}) {
  let el = root.querySelector('#gameboard');
  if (!el) {
    el = document.createElement('div');
    el.id = 'gameboard';
    root.appendChild(el);
  }
  el.className = 'gameboard hidden';
  el.innerHTML =
    '<div class="board-card">' +
      '<div class="board-top">' +
        '<span class="board-mode" id="board-mode"></span>' +
        '<span class="board-count" id="board-count"></span>' +
      '</div>' +
      '<div class="board-clue" id="board-clue"></div>' +
      '<div class="board-cells" id="board-cells"></div>' +
    '</div>' +
    '<div class="board-grid" id="board-grid"></div>' +
    '<div class="board-props">' +
      '<button id="btn-hint" class="prop-btn" type="button"><span class="prop-ico">💡</span><span id="hint-label"></span></button>' +
      '<button id="btn-reset" class="prop-btn" type="button"><span class="prop-ico">🔁</span><span id="reset-label"></span></button>' +
    '</div>';

  const modeEl = el.querySelector('#board-mode');
  const countEl = el.querySelector('#board-count');
  const clueEl = el.querySelector('#board-clue');
  const cellsEl = el.querySelector('#board-cells');
  const gridEl = el.querySelector('#board-grid');
  const hintBtn = el.querySelector('#btn-hint');
  const resetBtn = el.querySelector('#btn-reset');
  const hintLabel = el.querySelector('#hint-label');
  const resetLabel = el.querySelector('#reset-label');

  let _key = '';

  function boardKey(h) {
    const q = h.question || {};
    const filled = h.filled || {};
    const grid = h.grid || [];
    const blanks = q.blanks || [];
    return [
      h.level, h.questionIndex, q.key, q.riddle ? 'r' : 'f',
      h.currentBlank,
      blanks.map((b) => b + ':' + (filled[b] ?? '')).join(','),
      grid.join(''),
      h.hints, h.resets, h.slag,
    ].join('|');
  }

  function buildCells(q, filled, currentBlank) {
    cellsEl.innerHTML = '';
    const isRiddle = !!q.riddle;
    const positions = isRiddle ? q.blanks : q.answer.map((_, i) => i);
    for (const pos of positions) {
      const cell = document.createElement('div');
      const isBlank = q.blanks.includes(pos);
      if (isBlank) {
        const bi = q.blanks.indexOf(pos);
        cell.className = 'cell slot' + (bi === currentBlank ? ' current' : '') + (filled[pos] ? ' filled' : '');
        cell.textContent = filled[pos] || '';
      } else {
        cell.className = 'cell revealed';
        cell.textContent = q.answer[pos];
      }
      cellsEl.appendChild(cell);
    }
  }

  function buildGrid(grid, filledChars) {
    gridEl.innerHTML = '';
    const used = new Set(filledChars);
    grid.forEach((ch, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tile' + (used.has(ch) ? ' used' : '');
      btn.textContent = ch;
      btn.dataset.index = String(i);
      btn.setAttribute('aria-label', ch);
      gridEl.appendChild(btn);
    });
  }

  gridEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.tile');
    if (!btn) return;
    const idx = Number(btn.dataset.index);
    if (Number.isInteger(idx) && typeof hooks.onPick === 'function') hooks.onPick(idx);
  });

  hintBtn.addEventListener('click', () => { if (typeof hooks.onHint === 'function') hooks.onHint(); });
  resetBtn.addEventListener('click', () => { if (typeof hooks.onReset === 'function') hooks.onReset(); });

  function setHud(h) {
    h = h || {};
    const q = h.question || {};
    hintBtn.disabled = !(h.hints > 0);
    resetBtn.disabled = !(h.resets > 0);
    hintLabel.textContent = t('btn.hint') + ' ×' + (h.hints ?? 0);
    resetLabel.textContent = t('btn.reset') + ' ×' + (h.resets ?? 0);

    if (!h.question) return;
    const key = boardKey(h);
    if (key === _key) return;
    _key = key;

    modeEl.textContent = q.riddle ? t('q.riddle') : t('q.meaning');
    modeEl.classList.toggle('is-riddle', !!q.riddle);
    countEl.textContent = `${h.questionIndex}/${h.totalQuestions}`;
    clueEl.textContent = q.clue || '';
    buildCells(q, h.filled || {}, h.currentBlank ?? 0);
    const filledChars = Object.values(h.filled || {}).filter(Boolean);
    buildGrid(h.grid || [], filledChars);
  }

  return {
    el,
    setHud,
    show() { el.classList.remove('hidden'); },
    hide() { el.classList.add('hidden'); },
  };
}
