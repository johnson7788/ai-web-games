// TAICHI FLOW · 模拟层（纯逻辑，零 DOM/window/Date.now/canvas）
// 职责：阴阳棋盘、点格换邻、撤销、步数/星级结算、连击、事件表。
// 依赖：config/levels.js（LEVELS）与 config/game.config.js（GAME/SIZE）。
// 契约：createRun(levelIndex, opts) → run；run.click(index) 是核心操作。
import { LEVELS, SIZE, applySwap } from '../../config/levels.js';
import { GAME } from '../../config/game.config.js';

function countMatched(cells, targetMask) {
  let n = 0;
  for (let i = 0; i < cells.length; i += 1) {
    if (targetMask[i] && cells[i].color === 'yin') n += 1;
  }
  return n;
}

export function createRun(levelIndex = 0, _opts = {}) {
  const level = LEVELS[levelIndex] ?? LEVELS[0];
  const cells = level.board.map((c) => ({ color: c.color, movable: c.movable, matched: false, flash: 0 }));
  const targetMask = new Array(SIZE * SIZE).fill(false);
  for (const i of level.target) targetMask[i] = true;
  for (const i of level.target) if (cells[i].color === 'yin') cells[i].matched = true;

  const state = {
    level: level.index,
    phase: 'playing',            // playing | won | lost
    size: level.size,
    cells,
    target: [...level.target],
    rocks: level.rocks.map((r) => ({ ...r })),
    targetMask,
    scramble: [...level.scramble],
    par: level.par,
    maxMoves: level.maxMoves,
    targetCount: level.targetCount,
    moves: 0,
    matched: countMatched(cells, targetMask),
    combo: 0,
    bestCombo: 0,
    undoLeft: GAME.UNDO_MAX,
    stars: 0,
    time: 0,
    result: null,
  };

  const run = {
    state,
    _level: level,
    _events: [],
    _history: [],
    _milestone: Math.floor((state.matched / Math.max(1, state.targetCount)) * 4),

    step(dt) {
      const d = Number(dt);
      if (Number.isFinite(d) && d > 0) this.state.time += d;
    },

    click(index) {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      const i = Number(index);
      if (!Number.isInteger(i) || i < 0 || i >= SIZE * SIZE) return { ok: false, reason: 'bounds' };
      if (!s.cells[i].movable) return { ok: false, reason: 'locked' };

      const before = s.cells.map((c) => c.color);
      const swaps = applySwap(s.cells, i);
      if (swaps === 0) return { ok: false, reason: 'noSwap' };

      this._history.push(before);
      s.moves += 1;

      // 重新结算匹配 / 连击
      let newMatches = 0;
      for (let k = 0; k < s.cells.length; k += 1) {
        const isMatch = s.targetMask[k] && s.cells[k].color === 'yin';
        if (isMatch && !s.cells[k].matched) newMatches += 1;
        s.cells[k].matched = isMatch;
      }
      s.matched = countMatched(s.cells, s.targetMask);

      this._emit({ type: 'tap', index: i });
      this._emit({ type: 'swap', index: i, pairs: swaps });
      if (newMatches > 0) {
        this._emit({ type: 'match', count: newMatches });
        if (newMatches >= GAME.COMBO_MIN) {
          s.combo += 1;
          s.bestCombo = Math.max(s.bestCombo, s.combo);
          this._emit({ type: 'combo', streak: s.combo, count: newMatches });
        }
      }

      // 推进里程碑（25% / 50% / 75% / 100%）
      const bucket = Math.min(4, Math.floor((s.matched / Math.max(1, s.targetCount)) * 4));
      while (this._milestone < bucket) {
        this._milestone += 1;
        this._emit({ type: 'progress', pct: this._milestone * 25 });
      }

      if (s.matched >= s.targetCount) {
        this._win();
      } else if (s.moves > s.maxMoves) {
        this._lose('movesOut');
      }
      return { ok: true, index: i, swaps };
    },

    undo() {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      if (this._history.length === 0) return { ok: false, reason: 'noHistory' };
      if (s.undoLeft <= 0) return { ok: false, reason: 'noUndo' };
      const before = this._history.pop();
      for (let k = 0; k < s.cells.length; k += 1) s.cells[k].color = before[k];
      s.undoLeft -= 1;
      s.moves = Math.max(0, s.moves - 1);
      s.combo = 0;
      for (let k = 0; k < s.cells.length; k += 1) {
        s.cells[k].matched = s.targetMask[k] && s.cells[k].color === 'yin';
      }
      s.matched = countMatched(s.cells, s.targetMask);
      this._emit({ type: 'undo', undoLeft: s.undoLeft });
      return { ok: true };
    },

    getHud() {
      const s = this.state;
      return {
        level: s.level,
        phase: s.phase,
        moves: s.moves,
        par: s.par,
        matched: s.matched,
        targetCount: s.targetCount,
        stars: s.stars,
        combo: s.combo,
        bestCombo: s.bestCombo,
        undoLeft: s.undoLeft,
      };
    },

    drainEvents() {
      const ev = this._events;
      this._events = [];
      return ev;
    },

    _emit(e) { this._events.push(e); },

    _win() {
      const s = this.state;
      s.phase = 'won';
      const stars = s.moves <= s.par ? 3 : (s.moves <= s.par + GAME.PAR_SLACK ? 2 : 1);
      s.stars = stars;
      s.result = { won: true, stars, moves: s.moves, par: s.par };
      this._emit({ type: 'star', stars });
      this._emit({ type: 'win', stars, moves: s.moves, par: s.par });
    },

    _lose(reason) {
      const s = this.state;
      s.phase = 'lost';
      s.result = { won: false, stars: 0, moves: s.moves, par: s.par };
      this._emit({ type: 'lose', reason });
    },
  };

  run._emit({ type: 'levelStart', level: level.index });
  return run;
}
