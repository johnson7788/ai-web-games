// COLOR PIPES FLOW · 模拟层（纯逻辑，零 DOM/window/canvas）
// NumberLink / Flow Free：同色端口用正交路径连接，填满全部空格（岩石除外）。
// 依赖：config/levels.js（LEVELS）。随机：自持（关卡已确定性生成，运行时无随机）。
// 契约：createRun(idx, opts) → run；run.state 形状见 createRun；事件表见 _emit。

import { LEVELS } from '../../config/levels.js';

const same = (a, b) => a[0] === b[0] && a[1] === b[1];

export function createRun(levelIndex = 0, opts = {}) {
  const level = LEVELS[levelIndex] ?? LEVELS[0];

  // 网格：cell = { rock, dot, owner, hinted }
  const grid = [];
  for (let r = 0; r < level.rows; r += 1) {
    grid[r] = [];
    for (let c = 0; c < level.cols; c += 1) {
      grid[r][c] = { rock: false, dot: -1, owner: -1, hinted: false };
    }
  }
  for (const [r, c] of level.rocks) grid[r][c].rock = true;
  for (const pair of level.pairs) {
    grid[pair.a[0]][pair.a[1]].dot = pair.id;
    grid[pair.b[0]][pair.b[1]].dot = pair.id;
  }

  const state = {
    level: level.index,
    levelIndex,
    phase: 'playing',            // 'playing' | 'won' | 'lost'
    rows: level.rows,
    cols: level.cols,
    grid,
    pairs: level.pairs,
    rocks: level.rocks,
    colorCount: level.colorCount,
    emptyCount: level.emptyCount,
    par: level.par,
    moveLimit: level.moveLimit,
    hintsLeft: level.hints,
    paths: level.pairs.map(() => []), // 每条颜色的已画路径（含两端点）
    activeColor: -1,
    activeEnd: null,
    moves: 0,
    fillCount: 0,
    completedPairs: 0,
    comboCount: 0,
    stars: 0,
    result: null,
    hintCell: null,
    clock: 0,
  };

  const run = {
    state,
    _events: [],
    _backtracks: 0,
    _lastDir: null,

    // ---------- 时间推进（谜题无倒计时，clock 仅供遥测/UI 提示） ----------
    step(dt) {
      const s = this.state;
      if (s.phase === 'won' || s.phase === 'lost') return;
      dt = Number(dt);
      if (!Number.isFinite(dt) || dt <= 0) return;
      s.clock += Math.min(1, dt);
    },

    // ---------- 从某个端口开始画（该颜色已有路径则先清空重画） ----------
    startDraw(id, end = 'a') {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      const pair = s.pairs[id];
      if (!pair) return { ok: false, reason: 'badId' };

      // 清掉该颜色旧路径
      this._clearPath(id);

      s.activeColor = id;
      s.activeEnd = end;
      const start = end === 'b' ? pair.b : pair.a;
      s.paths[id] = [start.slice()];
      this._lastDir = null;
      this._backtracks = 0;
      this._emit({ type: 'drawStart', id, color: pair.color });
      return { ok: true, id };
    },

    // ---------- 向相邻格延伸（支持回溯到倒数第二格 = 撤销最后一格） ----------
    drawTo(r, c) {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      const id = s.activeColor;
      if (id < 0) return { ok: false, reason: 'noActive' };
      if (r < 0 || r >= s.rows || c < 0 || c >= s.cols) return { ok: false, reason: 'bounds' };
      if (s.grid[r][c].rock) return { ok: false, reason: 'rock' };

      const path = s.paths[id];
      const last = path[path.length - 1];
      const dr = Math.abs(r - last[0]);
      const dc = Math.abs(c - last[1]);
      if (dr + dc !== 1) return { ok: false, reason: 'notAdjacent' };

      // 回溯：回到倒数第二格 → 撤销最后一格
      if (path.length >= 2 && r === path[path.length - 2][0] && c === path[path.length - 2][1]) {
        const popped = path.pop();
        const cell = s.grid[popped[0]][popped[1]];
        if (cell.dot === -1 && cell.owner === id) {
          cell.owner = -1;
          s.fillCount -= 1;
        }
        this._backtracks += 1;
        this._lastDir = null;
        this._emit({ type: 'backtrack', r, c, id });
        return { ok: true, backtrack: true };
      }

      const cell = s.grid[r][c];
      const pair = s.pairs[id];

      // 命中端口
      if (cell.dot !== -1) {
        if (cell.dot !== id) return { ok: false, reason: 'wrongDot' };
        const other = s.activeEnd === 'b' ? pair.a : pair.b;
        if (!same([r, c], other)) return { ok: false, reason: 'sameEndpoint' };
        path.push([r, c]);
        this._emit({ type: 'pairComplete', id, color: pair.color });
        if (this._backtracks === 0) {
          s.comboCount += 1;
          this._emit({ type: 'combo', id, combo: s.comboCount });
        } else {
          s.comboCount = 0;
        }
        this._backtracks = 0;
        this._lastDir = null;
        this._checkWin();
        return { ok: true, pair: true };
      }

      // 空格
      if (cell.owner !== -1) return { ok: false, reason: 'occupied' };
      path.push([r, c]);
      cell.owner = id;
      s.fillCount += 1;
      s.moves += 1;
      const dir = r === last[0] ? 'h' : 'v'; // 横或竖，用于拐弯反馈
      if (this._lastDir && this._lastDir !== dir) this._emit({ type: 'turn', r, c, id });
      this._lastDir = dir;
      this._emit({ type: 'cellFill', r, c, id, moves: s.moves });

      if (s.moves > s.moveLimit) {
        this._lose('outOfMoves');
        return { ok: true, lost: true };
      }
      this._checkWin();
      return { ok: true };
    },

    // ---------- 结束本次绘制 ----------
    endDraw() {
      const s = this.state;
      if (s.activeColor < 0) return { ok: false, reason: 'noActive' };
      s.activeColor = -1;
      s.activeEnd = null;
      this._lastDir = null;
      this._checkWin();
      return { ok: true };
    },

    // ---------- 回退：把当前路径剪回到 (r,c)，撤销其后所有格 ----------
    cutBack(r, c) {
      const s = this.state;
      const id = s.activeColor;
      if (s.phase !== 'playing' || id < 0) return { ok: false, reason: 'noActive' };
      const path = s.paths[id];
      const idx = path.findIndex((cell) => cell[0] === r && cell[1] === c);
      if (idx < 0 || idx >= path.length - 1) return { ok: false, reason: 'notInPath' };
      const removed = path.splice(idx + 1);
      for (const [rr, cc] of removed) {
        const cell = s.grid[rr][cc];
        if (cell.dot === -1 && cell.owner === id) {
          cell.owner = -1;
          s.fillCount -= 1;
        }
      }
      this._backtracks += 1;
      this._lastDir = null;
      this._emit({ type: 'backtrack', r, c, id });
      return { ok: true };
    },

    // ---------- 提示：揭示某条未连通管道的下一个正确格 ----------
    hint() {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      if (s.hintsLeft <= 0) return { ok: false, reason: 'noHints' };
      const cell = this._suggest();
      if (!cell) return { ok: false, reason: 'solved' };
      s.hintsLeft -= 1;
      s.hintCell = cell;
      if (s.grid[cell[0]][cell[1]]) s.grid[cell[0]][cell[1]].hinted = true;
      this._emit({ type: 'hint', r: cell[0], c: cell[1] });
      return { ok: true, cell };
    },

    // ---------- 认输 ----------
    giveUp() {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      this._lose('giveUp');
      return { ok: true };
    },

    // ---------- HUD ----------
    getHud() {
      const s = this.state;
      return {
        level: s.level,
        phase: s.phase,
        moves: s.moves,
        par: s.par,
        moveLimit: s.moveLimit,
        hintsLeft: s.hintsLeft,
        stars: s.stars,
        colorCount: s.colorCount,
        completedPairs: s.completedPairs,
        fillCount: s.fillCount,
        emptyCount: s.emptyCount,
        clock: s.clock,
      };
    },

    drainEvents() {
      const ev = this._events;
      this._events = [];
      return ev;
    },

    // ---------------- 内部 ----------------
    _emit(e) {
      this._events.push(e);
    },

    _clearPath(id) {
      const s = this.state;
      const path = s.paths[id] || [];
      for (const [r, c] of path) {
        const cell = s.grid[r][c];
        if (cell.dot === -1 && cell.owner === id) {
          cell.owner = -1;
          s.fillCount -= 1;
        }
      }
      s.paths[id] = [];
    },

    _connected(id) {
      const s = this.state;
      const pair = s.pairs[id];
      const path = s.paths[id] || [];
      if (path.length < 2) return false;
      const first = path[0];
      const last = path[path.length - 1];
      return (same(first, pair.a) && same(last, pair.b)) || (same(first, pair.b) && same(last, pair.a));
    },

    _completedCount() {
      const s = this.state;
      let n = 0;
      for (let id = 0; id < s.pairs.length; id += 1) if (this._connected(id)) n += 1;
      return n;
    },

    _suggest() {
      const s = this.state;
      const order = [];
      if (s.activeColor >= 0) order.push(s.activeColor);
      for (let id = 0; id < s.pairs.length; id += 1) if (!order.includes(id)) order.push(id);
      for (const id of order) {
        if (this._connected(id)) continue;
        const pair = s.pairs[id];
        for (const cell of pair.path) {
          const g = s.grid[cell[0]][cell[1]];
          if (g.dot === -1 && g.owner !== id) return cell;
        }
      }
      return null;
    },

    _checkWin() {
      const s = this.state;
      if (s.phase !== 'playing') return;
      const completed = this._completedCount();
      s.completedPairs = completed;
      if (s.fillCount === s.emptyCount && completed === s.pairs.length) {
        this._win();
      }
    },

    _win() {
      const s = this.state;
      s.phase = 'won';
      const stars = s.moves <= s.par ? 3 : (s.moves <= s.par * 1.5 ? 2 : 1);
      s.stars = stars;
      s.result = { won: true, stars, moves: s.moves, par: s.par };
      this._emit({ type: 'win', stars, moves: s.moves, par: s.par });
    },

    _lose(reason) {
      const s = this.state;
      s.phase = 'lost';
      s.result = { won: false, stars: 0, moves: s.moves, reason };
      this._emit({ type: 'lose', reason, moves: s.moves });
    },
  };

  run._emit({ type: 'levelStart', level: state.level, pairs: state.pairs.length, rocks: state.rocks.length });
  return run;
}
