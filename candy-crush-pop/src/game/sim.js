// CANDY CRUSH POP · 模拟层（纯逻辑，零 DOM/window/Date.now/canvas）
// 职责：8×10 糖果网格、交换/消除/下落/补充级联、冰封岩石、连击倍率与加步、
//       步数+时间双重结算、事件表。随机注入 seed 的 mulberry32，可复现。
// 契约：createRun(levelIndex, opts) → run；run.step(dt) 推进状态机；run.swap(a,b) 提交交换；
//       run.hint() 找一步可消；run.drainEvents() 取事件；run.getHud() 取 HUD 数据。

import { LEVELS } from '../../config/levels.js';
import { GAME } from '../../config/game.config.js';

// ------------------------------------------------------------------ RNG
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------ 计分
// 单段连消得分：每颗 10 分 + 长度奖励（3=+20 / 4=+50 / 5+=+100+(len-5)*60）
export function runScore(len) {
  if (!Number.isFinite(len) || len < GAME.MATCH_MIN) return 0;
  let bonus = 0;
  if (len === 3) bonus = 20;
  else if (len === 4) bonus = 50;
  else bonus = 100 + (len - 5) * 60;
  return len * 10 + bonus;
}

export function comboMult(wave) {
  const w = Math.max(0, Math.min(2, wave));
  return GAME.COMBO_MULT[w];
}

// ------------------------------------------------------------------ 网格工具
function makeCell(type, rock = 0) {
  return { type, rock };
}

function key(r, c) { return `${r},${c}`; }

function swapCells(grid, r1, c1, r2, c2) {
  const a = grid[r1][c1];
  const b = grid[r2][c2];
  const t = a.type; a.type = b.type; b.type = t;
  const rr = a.rock; a.rock = b.rock; b.rock = rr;
}

/** 找所有长度 ≥MATCH_MIN 的连段（岩石切断连线，且自身不参与） */
export function findRuns(grid, rows, cols) {
  const runs = [];
  // 水平
  for (let r = 0; r < rows; r += 1) {
    let c = 0;
    while (c < cols) {
      if (grid[r][c].rock > 0) { c += 1; continue; }
      const t = grid[r][c].type;
      let e = c + 1;
      while (e < cols && grid[r][e].rock === 0 && grid[r][e].type === t) e += 1;
      if (e - c >= GAME.MATCH_MIN) {
        const run = [];
        for (let k = c; k < e; k += 1) run.push({ r, c: k });
        runs.push(run);
      }
      c = e;
    }
  }
  // 垂直
  for (let c = 0; c < cols; c += 1) {
    let r = 0;
    while (r < rows) {
      if (grid[r][c].rock > 0) { r += 1; continue; }
      const t = grid[r][c].type;
      let e = r + 1;
      while (e < rows && grid[e][c].rock === 0 && grid[e][c].type === t) e += 1;
      if (e - r >= GAME.MATCH_MIN) {
        const run = [];
        for (let k = r; k < e; k += 1) run.push({ r: k, c });
        runs.push(run);
      }
      r = e;
    }
  }
  return runs;
}

/** 是否存在至少一步可消 */
export function hasValidMove(grid, rows, cols) {
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      if (grid[r][c].rock > 0) continue;
      if (c + 1 < cols && grid[r][c + 1].rock === 0) {
        swapCells(grid, r, c, r, c + 1);
        const ok = findRuns(grid, rows, cols).length > 0;
        swapCells(grid, r, c, r, c + 1);
        if (ok) return true;
      }
      if (r + 1 < rows && grid[r + 1][c].rock === 0) {
        swapCells(grid, r, c, r + 1, c);
        const ok = findRuns(grid, rows, cols).length > 0;
        swapCells(grid, r, c, r + 1, c);
        if (ok) return true;
      }
    }
  }
  return false;
}

/** 找一步可消（用于提示 / 贪婪 bot），无可消返回 null */
export function findHint(grid, rows, cols) {
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      if (grid[r][c].rock > 0) continue;
      if (c + 1 < cols && grid[r][c + 1].rock === 0) {
        swapCells(grid, r, c, r, c + 1);
        const ok = findRuns(grid, rows, cols).length > 0;
        swapCells(grid, r, c, r, c + 1);
        if (ok) return { a: { r, c }, b: { r, c: c + 1 } };
      }
      if (r + 1 < rows && grid[r + 1][c].rock === 0) {
        swapCells(grid, r, c, r + 1, c);
        const ok = findRuns(grid, rows, cols).length > 0;
        swapCells(grid, r, c, r + 1, c);
        if (ok) return { a: { r, c }, b: { r: r + 1, c } };
      }
    }
  }
  return null;
}

// ------------------------------------------------------------------ 生成
function pickType(rng, grid, r, c, rows, cols) {
  const banned = new Set();
  if (c >= 2 && grid[r][c - 1].rock === 0 && grid[r][c - 2].rock === 0 && grid[r][c - 1].type === grid[r][c - 2].type) {
    banned.add(grid[r][c - 1].type);
  }
  if (r >= 2 && grid[r - 1][c].rock === 0 && grid[r - 2][c].rock === 0 && grid[r - 1][c].type === grid[r - 2][c].type) {
    banned.add(grid[r - 1][c].type);
  }
  let t;
  do { t = Math.floor(rng() * GAME.TYPES); } while (banned.has(t));
  return t;
}

function fillTypes(grid, rows, cols, rng) {
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      grid[r][c].type = pickType(rng, grid, r, c, rows, cols);
    }
  }
}

function buildGrid(level, rng) {
  const { rows, cols } = level;
  const grid = [];
  for (let r = 0; r < rows; r += 1) {
    grid[r] = [];
    for (let c = 0; c < cols; c += 1) grid[r][c] = makeCell(0, 0);
  }
  for (const [r, c, hp] of level.rocks) {
    if (r >= 0 && r < rows && c >= 0 && c < cols) grid[r][c].rock = Math.max(1, Math.min(GAME.ROCK_MAX_HP, hp || 1));
  }
  fillTypes(grid, rows, cols, rng);
  return grid;
}

// ------------------------------------------------------------------ createRun
export function createRun(levelIndex = 0, opts = {}) {
  const level = LEVELS[levelIndex] ?? LEVELS[0];
  const seed = (opts.seed ?? 1) >>> 0;
  const rng = mulberry32(seed);
  const { rows, cols } = level;

  const grid = buildGrid(level, rng);
  // 开局保证至少一步可消（极罕见死局洗牌兜底）
  let reshuffles = 0;
  let guard = 0;
  while (!hasValidMove(grid, rows, cols) && guard++ < 60) {
    fillTypes(grid, rows, cols, rng);
    reshuffles += 1;
  }

  const state = {
    level: level.index,
    phase: 'playing',          // playing | won | lost
    rows, cols,
    grid,
    moves: level.moves,
    movesLeft: level.moves,
    score: 0,
    target: level.target,
    time: level.time,
    timeLeft: level.time,
    action: 'idle',           // idle | swap | clear | fall
    actionT: 0,
    combo: 0,                 // 当前步已触发的级联波数（0 = 第一波尚未发生）
    comboGiven: false,        // 当前步是否已奖励加步
    swap: null,               // {a:{r,c}, b:{r,c}, back:bool}
    clearCells: [],           // 当前消除中的格子
    fallAnim: [],             // {r,c,fromR} 下落动画
    reshuffles,
    stars: 0,
    result: null,
    hintsUsed: 0,
  };

  const run = {
    state,
    _level: level,
    _rng: rng,
    _events: [],
    _clock: 0,
    _lastSecond: Math.ceil(level.time),

    step(dt) {
      const s = this.state;
      if (s.phase === 'won' || s.phase === 'lost') return;
      dt = Number(dt);
      if (!Number.isFinite(dt) || dt <= 0) return;
      if (dt > 1) dt = 1; // 防大跳帧
      this._clock += dt;

      // 时间倒计时（无论处于哪个 action 都计时）
      if (s.phase === 'playing') {
        s.timeLeft -= dt;
        const sec = Math.ceil(s.timeLeft);
        if (sec < this._lastSecond && sec >= 0) {
          this._lastSecond = sec;
          this._emit({ type: 'countdownTick', timeLeft: sec });
        }
        if (s.timeLeft <= 0) {
          s.timeLeft = 0;
          if (s.score >= s.target) this._win();
          else this._lose('timeOut');
          return;
        }
      }

      // 动作状态机
      if (s.action === 'swap') {
        s.actionT -= dt;
        if (s.actionT <= 0) this._finishSwap();
      } else if (s.action === 'clear') {
        s.actionT -= dt;
        if (s.actionT <= 0) this._collapse();
      } else if (s.action === 'fall') {
        s.actionT -= dt;
        if (s.actionT <= 0) this._settleAfterFall();
      }
    },

    // ---- 提交一次相邻交换（只有 idle + playing 且双方无岩石时有效）
    swap(a, b) {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      if (s.action !== 'idle') return { ok: false, reason: 'busy' };
      const dr = Math.abs(a.r - b.r);
      const dc = Math.abs(a.c - b.c);
      if ((dr + dc) !== 1) return { ok: false, reason: 'notAdjacent' };
      if (a.r < 0 || a.r >= s.rows || a.c < 0 || a.c >= s.cols) return { ok: false, reason: 'bounds' };
      if (b.r < 0 || b.r >= s.rows || b.c < 0 || b.c >= s.cols) return { ok: false, reason: 'bounds' };
      if (s.grid[a.r][a.c].rock > 0 || s.grid[b.r][b.c].rock > 0) return { ok: false, reason: 'rock' };
      s.swap = { a: { r: a.r, c: a.c }, b: { r: b.r, c: b.c }, back: false };
      s.action = 'swap';
      s.actionT = GAME.SWAP_TIME;
      this._emit({ type: 'swapStart', a: { r: a.r, c: a.c }, b: { r: b.r, c: b.c } });
      return { ok: true };
    },

    // ---- 提示：返回一步可消的 {a,b}（不消耗任何状态）
    hint() {
      const h = findHint(this.state.grid, this.state.rows, this.state.cols);
      if (h) this.state.hintsUsed += 1;
      return h;
    },

    getHud() {
      const s = this.state;
      return {
        level: s.level,
        phase: s.phase,
        score: s.score,
        target: s.target,
        movesLeft: s.movesLeft,
        timeLeft: s.timeLeft,
        combo: s.combo,
        stars: s.stars,
        action: s.action,
      };
    },

    drainEvents() {
      const ev = this._events;
      this._events = [];
      return ev;
    },

    // ---------------- 内部 ----------------
    _emit(e) { this._events.push(e); },

    _finishSwap() {
      const s = this.state;
      const { a, b, back } = s.swap;
      if (back) {
        // 交换失败弹回结束
        s.swap = null;
        s.action = 'idle';
        s.actionT = 0;
        this._emit({ type: 'idle' });
        return;
      }
      swapCells(s.grid, a.r, a.c, b.r, b.c);
      const runs = findRuns(s.grid, s.rows, s.cols);
      if (runs.length === 0) {
        // 换不出消除：弹回
        swapCells(s.grid, a.r, a.c, b.r, b.c);
        s.swap = { a, b, back: true };
        s.action = 'swap';
        s.actionT = GAME.SWAP_TIME;
        this._emit({ type: 'swapBack', a: { r: a.r, c: a.c }, b: { r: b.r, c: b.c } });
        return;
      }
      s.swap = null;
      s.movesLeft -= 1;
      s.combo = 0;
      s.comboGiven = false;
      this._emit({ type: 'move', movesLeft: s.movesLeft });
      this._startClear(runs);
    },

    _startClear(runs) {
      const s = this.state;
      const cellSet = new Set();
      for (const run of runs) for (const cell of run) cellSet.add(key(cell.r, cell.c));

      const wave = s.combo; // 0 = 第一波
      const mult = comboMult(wave);
      let gain = 0;
      for (const run of runs) {
        const base = runScore(run.length);
        const scored = Math.round(base * mult);
        gain += scored;
        this._emit({ type: 'match', len: run.length, score: scored, wave: wave + 1, r: run[0].r, c: run[0].c });
      }
      s.score += gain;
      this._emit({ type: 'score', score: s.score, gain, wave: wave + 1 });

      // 破冰：消除格的四邻岩石各减 1 层
      for (const k of cellSet) {
        const [r, c] = k.split(',').map(Number);
        const nb = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]];
        for (const [nr, nc] of nb) {
          if (nr < 0 || nr >= s.rows || nc < 0 || nc >= s.cols) continue;
          const cell = s.grid[nr][nc];
          if (cell.rock > 0) {
            cell.rock -= 1;
            if (cell.rock === 0) this._emit({ type: 'rockBreak', r: nr, c: nc });
            else this._emit({ type: 'rockChip', r: nr, c: nc, hp: cell.rock });
          }
        }
      }

      s.combo += 1;
      if (s.combo >= GAME.COMBO_BONUS_WAVE && !s.comboGiven) {
        s.comboGiven = true;
        s.movesLeft += 1;
        this._emit({ type: 'comboBonus', movesLeft: s.movesLeft });
      }

      s.clearCells = [...cellSet].map((k) => { const [r, c] = k.split(',').map(Number); return { r, c }; });
      s.action = 'clear';
      s.actionT = GAME.CLEAR_TIME;
    },

    _collapse() {
      const s = this.state;
      const clearing = new Set(s.clearCells.map((p) => key(p.r, p.c)));
      const { rows, cols } = s;
      s.fallAnim = [];

      for (let c = 0; c < cols; c += 1) {
        // 自顶向下收集幸存格（含岩石，岩石会随下落）
        const survivors = [];
        for (let r = 0; r < rows; r += 1) {
          if (!clearing.has(key(r, c))) survivors.push({ cell: s.grid[r][c], fromR: r });
        }
        const newCol = [];
        const startR = rows - survivors.length;
        for (let r = 0; r < startR; r += 1) newCol[r] = makeCell(Math.floor(this._rng() * GAME.TYPES), 0);
        for (let i = 0; i < survivors.length; i += 1) {
          const targetR = startR + i;
          newCol[targetR] = survivors[i].cell;
          if (survivors[i].fromR !== targetR) {
            s.fallAnim.push({ r: targetR, c, fromR: survivors[i].fromR });
          }
        }
        for (let r = 0; r < rows; r += 1) s.grid[r][c] = newCol[r];
      }

      s.clearCells = [];
      s.action = 'fall';
      s.actionT = GAME.FALL_TIME;
      this._emit({ type: 'fall', count: clearing.size });
    },

    _settleAfterFall() {
      const s = this.state;
      s.fallAnim = [];
      const runs = findRuns(s.grid, s.rows, s.cols);
      if (runs.length > 0) {
        // 级联：继续消除（combo 不重置，wave 递增）
        this._startClear(runs);
        return;
      }
      s.combo = 0;
      s.comboGiven = false;
      s.action = 'idle';
      s.actionT = 0;
      this._emit({ type: 'idle' });

      // 无可消 → 洗牌（保证 bot 与真人都不死局）
      if (s.phase === 'playing' && !hasValidMove(s.grid, s.rows, s.cols)) {
        fillTypes(s.grid, s.rows, s.cols, this._rng);
        let g = 0;
        while (!hasValidMove(s.grid, s.rows, s.cols) && g++ < 60) fillTypes(s.grid, s.rows, s.cols, this._rng);
        s.reshuffles += 1;
        this._emit({ type: 'reshuffle' });
      }

      this._checkEnd();
    },

    _checkEnd() {
      const s = this.state;
      if (s.phase !== 'playing') return;
      if (s.score >= s.target) {
        this._win();
      } else if (s.movesLeft <= 0) {
        this._lose('outOfMoves');
      } else if (s.timeLeft <= 0) {
        this._lose('timeOut');
      }
    },

    _win() {
      const s = this.state;
      const leftRatio = s.movesLeft / Math.max(1, s.moves);
      let stars = 1;
      if (leftRatio >= GAME.STAR_MOVES_HI) stars = 3;
      else if (leftRatio >= GAME.STAR_MOVES_LO) stars = 2;
      s.phase = 'won';
      s.stars = stars;
      s.result = { won: true, stars, score: s.score, target: s.target, movesLeft: s.movesLeft, timeLeft: s.timeLeft };
      this._emit({ type: 'win', stars, score: s.score, movesLeft: s.movesLeft });
    },

    _lose(reason) {
      const s = this.state;
      if (s.phase !== 'playing') return;
      s.phase = 'lost';
      s.result = { won: false, stars: 0, score: s.score, target: s.target, movesLeft: s.movesLeft, timeLeft: s.timeLeft, reason };
      this._emit({ type: 'lose', reason, score: s.score, target: s.target });
    },
  };

  return run;
}

// ------------------------------------------------------------------ 兼容骨架别名
export function createSim() {
  return createRun(0, { seed: 1 });
}

export function updateSim(sim, _input) {
  sim.step(1 / 60);
  return sim;
}
