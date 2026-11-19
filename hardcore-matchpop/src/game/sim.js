// HARDCORE MATCHPOP · 模拟层（纯逻辑，零 DOM / window / Date.now / canvas）
// 玩法骨架 1:1 还原自参考源码（10×10 / 5 色 / 点同色连通块整块消除 / 重力下落 + 整列左移 /
// 得分 = 组块数×10−5 / 目标 = 500 + 关卡×100 / 60s 倒计时），并新增：岩石障碍、连击、炸弹、洗牌、星级。
// 契约：createRun / createRushRun / run.step / run.tap / run.bomb / run.shuffle / run.getHud / run.drainEvents。
// 随机：注入 seed 的 mulberry32，可复现。

import { LEVELS } from '../../config/levels.js';
import { GAME } from '../../config/game.config.js';

export const ROCK = -2;
export const EMPTY = -1;
export const COLORS = GAME.COLORS;

// ------------------------------------------------------------------ RNG
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const N = GAME.N;
const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

// ------------------------------------------------------------------ 建盘
function emptyGrid() {
  const g = [];
  for (let r = 0; r < N; r += 1) {
    g[r] = [];
    for (let c = 0; c < N; c += 1) g[r][c] = EMPTY;
  }
  return g;
}

function fillGems(grid, rng) {
  for (let r = 0; r < N; r += 1) {
    for (let c = 0; c < N; c += 1) {
      grid[r][c] = Math.floor(rng() * COLORS);
    }
  }
}

function placeRocks(grid, count, rng) {
  let placed = 0;
  let guard = 0;
  while (placed < count && guard++ < 1000) {
    const r = Math.floor(rng() * N);
    const c = Math.floor(rng() * N);
    if (grid[r][c] === ROCK) continue;
    let adjacent = false;
    for (let dr = -1; dr <= 1 && !adjacent; dr += 1) {
      for (let dc = -1; dc <= 1 && !adjacent; dc += 1) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < N && nc >= 0 && nc < N && grid[nr][nc] === ROCK) adjacent = true;
      }
    }
    if (adjacent) continue;
    grid[r][c] = ROCK;
    placed += 1;
  }
}

// ------------------------------------------------------------------ 工具
function countGems(grid) {
  let n = 0;
  for (let r = 0; r < N; r += 1) {
    for (let c = 0; c < N; c += 1) if (grid[r][c] >= 0) n += 1;
  }
  return n;
}

// 4 方向 BFS：返回与 (r,c) 同色相连的坐标列表（含自身）
export function connectedGroup(grid, r, c) {
  const color = grid[r][c];
  if (color < 0) return [];
  const seen = new Set([`${r},${c}`]);
  const cells = [[r, c]];
  const stack = [[r, c]];
  while (stack.length) {
    const [cr, cc] = stack.pop();
    for (const [dr, dc] of DIRS) {
      const nr = cr + dr;
      const nc = cc + dc;
      if (nr < 0 || nr >= N || nc < 0 || nc >= N) continue;
      if (grid[nr][nc] !== color) continue;
      const key = `${nr},${nc}`;
      if (seen.has(key)) continue;
      seen.add(key);
      cells.push([nr, nc]);
      stack.push([nr, nc]);
    }
  }
  return cells;
}

// 是否存在任意一步可消除（相邻同色）
export function hasMove(grid) {
  for (let r = 0; r < N; r += 1) {
    for (let c = 0; c < N; c += 1) {
      const v = grid[r][c];
      if (v < 0) continue;
      if (r + 1 < N && grid[r + 1][c] === v) return true;
      if (c + 1 < N && grid[r][c + 1] === v) return true;
    }
  }
  return false;
}

function shuffleGems(grid, rng) {
  const gems = [];
  for (let r = 0; r < N; r += 1) {
    for (let c = 0; c < N; c += 1) if (grid[r][c] >= 0) gems.push(grid[r][c]);
  }
  // Fisher–Yates
  for (let i = gems.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const t = gems[i];
    gems[i] = gems[j];
    gems[j] = t;
  }
  let k = 0;
  for (let r = 0; r < N; r += 1) {
    for (let c = 0; c < N; c += 1) if (grid[r][c] >= 0) grid[r][c] = gems[k++];
  }
}

function columnHasGem(grid, c) {
  for (let r = 0; r < N; r += 1) if (grid[r][c] >= 0) return true;
  return false;
}

function columnHasRock(grid, c) {
  for (let r = 0; r < N; r += 1) if (grid[r][c] === ROCK) return true;
  return false;
}

// ------------------------------------------------------------------ 工厂
function makeRun(levelMeta, opts) {
  const seed = (opts.seed ?? 1) >>> 0 || 1;
  const rng = mulberry32(seed);
  const grid = emptyGrid();
  fillGems(grid, rng);
  placeRocks(grid, levelMeta.rocks || 0, rng);

  const state = {
    mode: levelMeta.mode,             // 'campaign' | 'rush'
    level: levelMeta.index,
    phase: 'playing',                 // 'playing' | 'won' | 'lost'
    grid,
    gems: countGems(grid),
    rocks: levelMeta.rocks || 0,
    score: 0,
    target: levelMeta.target,         // campaign 才有
    timeLeft: levelMeta.time,
    initialTime: levelMeta.time,
    combo: 0,
    rival: 0,                          // rush 才有
    bombLeft: levelMeta.bombLeft,
    shuffleLeft: levelMeta.shuffleLeft,
    stars: 0,
    result: null,
  };

  const run = {
    state,
    _rng: rng,
    _events: [],
    _clock: 0,
    _lastPopAt: -Infinity,
    _lastSecond: Math.ceil(levelMeta.time),
    _autoShuffles: 0,

    step(dt) {
      const s = this.state;
      if (s.phase !== 'playing') return;
      dt = Number(dt);
      if (!Number.isFinite(dt) || dt <= 0) return;
      if (dt > 1) dt = 1;
      this._clock += dt;

      if (s.mode === 'campaign') {
        s.timeLeft -= dt;
        if (s.timeLeft < 0) s.timeLeft = 0;
        const sec = Math.ceil(s.timeLeft);
        if (sec < this._lastSecond && sec >= 0) {
          this._lastSecond = sec;
          this._emit({ type: 'countdownTick', timeLeft: sec });
        }
        if (s.timeLeft <= 0) {
          this._finish(s.gems === 0 && s.score >= s.target, s.gems === 0 ? 'lowScore' : 'timeOut');
        }
      } else {
        // rush：倒计时 + 对手每秒涨分（保留原味：每次 +10..100）
        s.timeLeft -= dt;
        if (s.timeLeft < 0) s.timeLeft = 0;
        const sec = Math.ceil(s.timeLeft);
        if (sec < this._lastSecond && sec >= 0) {
          this._lastSecond = sec;
          s.rival += GAME.RIVAL_STEP_MIN + Math.floor(rng() * ((GAME.RIVAL_STEP_MAX - GAME.RIVAL_STEP_MIN) / 10 + 1)) * 10;
          this._emit({ type: 'countdownTick', timeLeft: sec, rival: s.rival });
        }
        if (s.timeLeft <= 0) {
          this._finish(s.score > s.rival, 'rival');
        }
      }
    },

    // 点爆 (r,c) 同色连通块
    tap(r, c) {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      if (r < 0 || r >= N || c < 0 || c >= N) return { ok: false, reason: 'bounds' };
      if (s.grid[r][c] < 0) return { ok: false, reason: s.grid[r][c] === ROCK ? 'rock' : 'empty' };
      const color = s.grid[r][c];
      const cells = connectedGroup(s.grid, r, c);
      const size = cells.length;
      for (const [cr, cc] of cells) s.grid[cr][cc] = EMPTY;
      const base = size * GAME.SCORE_PER_GEM - GAME.SCORE_OFFSET;
      this._applyCombo();
      const bonus = s.combo >= 2 ? Math.floor(base * (s.combo - 1) * GAME.COMBO_BONUS_RATE) : 0;
      const gain = base + bonus;
      s.score += gain;
      s.gems -= size;
      this._emit({ type: 'pop', r, c, color, size, base, bonus, gain, combo: s.combo, cells });
      if (size >= 7) this._emit({ type: 'great', size, combo: s.combo });
      else if (size >= 5) this._emit({ type: 'good', size, combo: s.combo });
      else if (size >= 2) this._emit({ type: 'bigPop', size, combo: s.combo });
      if (s.combo >= 2) this._emit({ type: 'combo', combo: s.combo });
      const moved = this._applyGravity();
      if (moved > 0) this._emit({ type: 'fall', moved });
      this._checkNoMoves();
      this._checkEnd();
      return { ok: true, size, base, bonus, gain, combo: s.combo };
    },

    // 炸弹：点爆 3×3 范围（仅晶石）
    bomb(r, c) {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      if (s.bombLeft <= 0) return { ok: false, reason: 'noBomb' };
      const cells = [];
      for (let dr = -1; dr <= 1; dr += 1) {
        for (let dc = -1; dc <= 1; dc += 1) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr < 0 || nr >= N || nc < 0 || nc >= N) continue;
          if (s.grid[nr][nc] >= 0) cells.push([nr, nc]);
        }
      }
      if (!cells.length) return { ok: false, reason: 'empty' };
      for (const [cr, cc] of cells) s.grid[cr][cc] = EMPTY;
      s.bombLeft -= 1;
      const size = cells.length;
      const base = size * GAME.SCORE_PER_GEM - GAME.SCORE_OFFSET;
      this._applyCombo();
      const bonus = s.combo >= 2 ? Math.floor(base * (s.combo - 1) * GAME.COMBO_BONUS_RATE) : 0;
      const gain = base + bonus;
      s.score += gain;
      s.gems -= size;
      this._emit({ type: 'bomb', r, c, size, base, bonus, gain, combo: s.combo, cells });
      if (s.combo >= 2) this._emit({ type: 'combo', combo: s.combo });
      const moved = this._applyGravity();
      if (moved > 0) this._emit({ type: 'fall', moved });
      this._checkNoMoves();
      this._checkEnd();
      return { ok: true, size, gain, combo: s.combo };
    },

    // 洗牌：重排剩余晶石（岩石不动）
    shuffle() {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      if (s.shuffleLeft <= 0) return { ok: false, reason: 'noShuffle' };
      s.shuffleLeft -= 1;
      shuffleGems(s.grid, rng);
      this._emit({ type: 'shuffle' });
      this._checkNoMoves();
      return { ok: true };
    },

    getHud() {
      const s = this.state;
      return {
        mode: s.mode,
        level: s.level,
        phase: s.phase,
        score: s.score,
        target: s.target,
        timeLeft: s.timeLeft,
        combo: s.combo,
        gems: s.gems,
        rocks: s.rocks,
        bombLeft: s.bombLeft,
        shuffleLeft: s.shuffleLeft,
        rival: s.rival,
        stars: s.stars,
      };
    },

    drainEvents() {
      const ev = this._events;
      this._events = [];
      return ev;
    },

    // ---------------- 内部 ----------------
    _emit(e) { this._events.push(e); },

    _applyCombo() {
      const s = this.state;
      if (this._clock - this._lastPopAt <= GAME.COMBO_WINDOW) {
        s.combo += 1;
      } else {
        s.combo = 1;
      }
      this._lastPopAt = this._clock;
    },

    // 重力：列内下落（岩块是地板，晶石落到最低可落格），再按岩块分隔的段内整列左移
    _applyGravity() {
      const s = this.state;
      let moved = 0;
      // 1) 列内下落
      for (let c = 0; c < N; c += 1) {
        const gems = [];
        for (let r = N - 1; r >= 0; r -= 1) if (s.grid[r][c] >= 0) gems.push(s.grid[r][c]);
        let gi = 0;
        for (let r = N - 1; r >= 0; r -= 1) {
          if (s.grid[r][c] === ROCK) continue;
          const want = gi < gems.length ? gems[gi] : EMPTY;
          if (s.grid[r][c] !== want) moved += 1;
          s.grid[r][c] = want;
          if (gi < gems.length) gi += 1;
        }
      }
      // 2) 段内整列左移（岩块列是墙，段不可跨越）
      let segStart = 0;
      while (segStart < N) {
        if (columnHasRock(s.grid, segStart)) { segStart += 1; continue; }
        let segEnd = segStart;
        while (segEnd < N && !columnHasRock(s.grid, segEnd)) segEnd += 1;
        const cols = [];
        for (let c = segStart; c < segEnd; c += 1) if (columnHasGem(s.grid, c)) cols.push(c);
        for (let i = 0; i < cols.length; i += 1) {
          const from = cols[i];
          const to = segStart + i;
          if (from === to) continue;
          for (let r = 0; r < N; r += 1) {
            s.grid[r][to] = s.grid[r][from];
            s.grid[r][from] = EMPTY;
          }
          moved += 1;
        }
        segStart = segEnd;
      }
      return moved;
    },

    // 无路可走时自动重排（免费，不消耗道具），避免死局
    _checkNoMoves() {
      const s = this.state;
      if (s.gems <= 1) return;
      if (hasMove(s.grid)) return;
      if (this._autoShuffles >= GAME.AUTO_SHUFFLE_MAX) return;
      this._autoShuffles += 1;
      shuffleGems(s.grid, rng);
      this._emit({ type: 'noMoves' });
      this._emit({ type: 'shuffle' });
      // 极端情况再试几次，仍无路则交给时间/道具
      if (!hasMove(s.grid) && this._autoShuffles < GAME.AUTO_SHUFFLE_MAX) this._checkNoMoves();
    },

    _checkEnd() {
      const s = this.state;
      if (s.phase !== 'playing') return;
      if (s.mode === 'campaign') {
        if (s.gems === 0) this._finish(s.score >= s.target, s.score >= s.target ? 'clear' : 'lowScore');
      } else if (s.gems === 0) {
        this._finish(true, 'clear');
      }
    },

    _finish(won, reason) {
      const s = this.state;
      if (s.phase !== 'playing') return;
      let stars = 0;
      if (won) {
        if (s.mode === 'campaign') {
          stars = 1;
          if (s.timeLeft >= s.initialTime * GAME.STAR_TIME_RATIO) stars += 1;
          if (s.score >= s.target * GAME.STAR_SCORE_RATIO) stars += 1;
        } else {
          stars = 1 + (s.timeLeft >= s.initialTime * 0.33 ? 1 : 0) + (s.score >= s.rival * 1.5 ? 1 : 0);
        }
        s.stars = Math.max(1, Math.min(3, stars));
      }
      s.phase = won ? 'won' : 'lost';
      s.result = {
        won,
        stars: s.stars,
        score: s.score,
        target: s.target,
        rival: s.rival,
        timeLeft: s.timeLeft,
        gems: s.gems,
        reason,
      };
      this._emit({ type: won ? 'win' : 'lose', reason: won ? null : reason, stars: s.stars, score: s.score, timeLeft: s.timeLeft });
    },
  };

  // 初始盘必须至少有一手可走
  if (!hasMove(grid)) {
    shuffleGems(grid, rng);
    run._emit({ type: 'shuffle' });
  }

  return run;
}

// ------------------------------------------------------------------ 入口
export function createRun(levelIndex = 0, opts = {}) {
  const level = LEVELS[levelIndex] ?? LEVELS[0];
  return makeRun({
    mode: 'campaign',
    index: level.index,
    time: level.time,
    rocks: level.rocks,
    target: GAME.TARGET_BASE + level.index * GAME.TARGET_PER_LEVEL,
    bombLeft: GAME.BOMB_PER_LEVEL,
    shuffleLeft: GAME.SHUFFLE_PER_LEVEL,
  }, opts);
}

export function createRushRun(opts = {}) {
  return makeRun({
    mode: 'rush',
    index: 0,
    time: GAME.RUSH_TIME,
    rocks: 0,
    target: 0,
    bombLeft: GAME.BOMB_PER_LEVEL,
    shuffleLeft: GAME.SHUFFLE_PER_LEVEL,
  }, opts);
}

// 兼容骨架别名（playbook 契约需要 step / getHud / drainEvents 已内建在 run 上）
export function createSim() {
  return createRun(0, { seed: 1 });
}

export function updateSim(sim, _input) {
  sim.step(1 / 60);
  return sim;
}
