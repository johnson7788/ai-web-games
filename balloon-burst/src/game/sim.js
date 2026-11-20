// Balloon Burst · 模拟层（纯逻辑，零 DOM/window/Date.now/canvas）
// 职责：灯笼网格、同色群点击消除、火星/锁链/变色/金属/石头等特殊件、
//       重力上浮补充、灯串连锁、计时与目标分、星级结算、事件表。
// 依赖：config/levels.js、config/game.config.js。
// 随机：注入 seed 的 mulberry32，可复现。
import { LEVELS } from '../../config/levels.js';
import { GAME, LANTERN_COLORS } from '../../config/game.config.js';

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

const key = (r, c) => `${r},${c}`;
const inBounds = (g, r, c) => r >= 0 && r < g.length && c >= 0 && c < g[0].length;
const isLantern = (cell) => cell && cell.kind === 'lantern';

// ------------------------------------------------------------------ 网格工具
// 返回所有同色连通群（size >= minSize），每群为 [{r,c}]。
export function findGroups(grid, minSize = 2) {
  const rows = grid.length;
  const cols = grid[0].length;
  const seen = new Set();
  const groups = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const cell = grid[r][c];
      if (!isLantern(cell) || seen.has(key(r, c))) continue;
      const color = cell.color;
      const comp = [];
      const stack = [[r, c]];
      seen.add(key(r, c));
      while (stack.length) {
        const [cr, cc] = stack.pop();
        comp.push({ r: cr, c: cc });
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const nr = cr + dr;
          const nc = cc + dc;
          if (!inBounds(grid, nr, nc) || seen.has(key(nr, nc))) continue;
          const n = grid[nr][nc];
          if (isLantern(n) && n.color === color) {
            seen.add(key(nr, nc));
            stack.push([nr, nc]);
          }
        }
      }
      if (comp.length >= minSize) groups.push(comp);
    }
  }
  return groups;
}

export function largestGroup(grid, minSize = 2) {
  let best = null;
  for (const g of findGroups(grid, minSize)) {
    if (!best || g.length > best.length) best = g;
  }
  return best;
}

function pick(arr, rng) {
  return arr[Math.floor(rng() * arr.length)];
}

function shuffled(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ------------------------------------------------------------------ 建盘
function emptyCell() {
  return { kind: 'empty' };
}

function lantern(color, type = 'normal') {
  return { kind: 'lantern', color, type, hp: type === 'metal' ? 2 : 1, chainId: null, cracked: false };
}

function buildGrid(level, rng) {
  const colors = LANTERN_COLORS.slice(0, level.colors);
  const grid = [];
  for (let r = 0; r < level.rows; r += 1) {
    grid[r] = [];
    for (let c = 0; c < level.cols; c += 1) {
      grid[r][c] = lantern(pick(colors, rng));
    }
  }
  for (const [r, c] of level.stones || []) {
    if (inBounds(grid, r, c)) grid[r][c] = { kind: 'stone' };
  }

  // 特殊灯笼按 seed 确定性摆放到随机灯笼格
  const cand = [];
  for (let r = 0; r < level.rows; r += 1) {
    for (let c = 0; c < level.cols; c += 1) {
      if (grid[r][c].kind === 'lantern') cand.push({ r, c });
    }
  }
  const pool = shuffled(cand, rng);
  let pi = 0;
  const take = () => (pi < pool.length ? pool[pi++] : null);
  const sp = level.specials || {};

  for (let i = 0; i < (sp.metal || 0); i += 1) {
    const p = take(); if (!p) break;
    grid[p.r][p.c] = lantern(grid[p.r][p.c].color, 'metal');
  }
  for (let i = 0; i < (sp.fire || 0); i += 1) {
    const p = take(); if (!p) break;
    grid[p.r][p.c] = lantern(grid[p.r][p.c].color, 'fire');
  }
  for (let i = 0; i < (sp.shifting || 0); i += 1) {
    const p = take(); if (!p) break;
    grid[p.r][p.c] = lantern(grid[p.r][p.c].color, 'shifting');
  }
  for (let i = 0; i < (sp.bomb || 0); i += 1) {
    const p = take(); if (!p) break;
    grid[p.r][p.c] = lantern(grid[p.r][p.c].color, 'bomb');
  }
  for (let i = 0; i < (sp.timeBonus || 0); i += 1) {
    const p = take(); if (!p) break;
    grid[p.r][p.c] = lantern(grid[p.r][p.c].color, 'timeBonus');
  }
  for (let i = 0; i < (sp.double || 0); i += 1) {
    const p = take(); if (!p) break;
    grid[p.r][p.c] = lantern(grid[p.r][p.c].color, 'double');
  }
  // 锁链灯笼：成对绑定
  for (let i = 0; i < (sp.chainedPairs || 0); i += 1) {
    const a = take(); const b = take();
    if (!a || !b) break;
    const ca = grid[a.r][a.c];
    const cb = grid[b.r][b.c];
    ca.type = 'chained';
    cb.type = 'chained';
    ca.chainId = i;
    cb.chainId = i;
  }

  return grid;
}

// 洗牌：重排普通/变色/双倍等可换色件的颜色（金属/锁链/火星/爆点/加时保持原色）
function reshuffle(grid, rng) {
  const colors = LANTERN_COLORS;
  for (let r = 0; r < grid.length; r += 1) {
    for (let c = 0; c < grid[0].length; c += 1) {
      const cell = grid[r][c];
      if (!isLantern(cell)) continue;
      if (cell.type === 'metal' || cell.type === 'chained') continue;
      cell.color = pick(colors, rng);
    }
  }
}

// ------------------------------------------------------------------ createRun
export function createRun(levelIndex = 0, opts = {}) {
  const level = LEVELS[levelIndex] ?? LEVELS[0];
  const seed = (opts.seed ?? 1) >>> 0;
  const rng = mulberry32(seed);

  let grid = buildGrid(level, rng);

  const state = {
    level: level.index,
    sceneKey: level.scene,
    phase: 'playing', // 'playing' | 'won' | 'lost'
    rows: level.rows,
    cols: level.cols,
    grid,
    score: 0,
    target: level.target,
    timeLeft: level.time,
    initialTime: level.time,
    stars: 0,
    result: null,
    moves: 0,
    bestClear: 0,
    bigClear: false,
    chain: 0,
    shiftClock: 0,
    shiftInterval: GAME.SHIFT_INTERVAL,
    stoneCount: (level.stones || []).length,
  };

  const run = {
    state,
    _level: level,
    _rng: rng,
    _events: [],
    _clock: 0,
    _lastSecond: Math.ceil(level.time),
    _chainId: 0,

    step(dt) {
      const s = this.state;
      if (s.phase !== 'playing') return;
      dt = Number(dt);
      if (!Number.isFinite(dt) || dt <= 0) return;
      if (dt > 1) dt = 1;
      this._clock += dt;

      s.timeLeft -= dt;
      const sec = Math.ceil(s.timeLeft);
      if (sec < this._lastSecond && sec >= 0) {
        this._lastSecond = sec;
        this._emit({ type: 'countdownTick', timeLeft: sec });
      }
      if (s.timeLeft <= 0) {
        s.timeLeft = 0;
        this._lose('timeOut');
        return;
      }

      // 变色灯笼周期换色
      s.shiftClock += dt;
      if (s.shiftClock >= s.shiftInterval) {
        s.shiftClock -= s.shiftInterval;
        this._shiftColors();
      }
    },

    getHud() {
      const s = this.state;
      return {
        level: s.level,
        score: s.score,
        target: s.target,
        timeLeft: s.timeLeft,
        stars: s.stars,
        chain: s.chain,
        moves: s.moves,
        bestClear: s.bestClear,
      };
    },

    drainEvents() {
      const ev = this._events;
      this._events = [];
      return ev;
    },

    // ---- 主操作：点击同色群消除 ----
    tap(r, c) {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      if (!inBounds(s.grid, r, c)) return { ok: false, reason: 'bounds' };
      const group = this._floodGroup(r, c);
      if (!group || group.length < GAME.MANUAL_MIN) return { ok: false, reason: 'noGroup' };

      s.moves += 1;
      this._emit({ type: 'tap', r, c });

      const removed = this._resolveRemoval(group);
      const n = removed.length;
      let pts = n * n * GAME.BASE_PER_LANTERN;
      // 双倍灯笼翻倍（本击消除的任意一盏是 double 即整击翻倍）
      const hasDouble = removed.some((x) => x.cell.type === 'double');
      if (hasDouble) {
        pts *= 2;
        this._emit({ type: 'double', n });
      }
      this._applyRemoval(removed, { kind: 'pop', pts, n, chain: 0, cells: removed.map((x) => ({ r: x.r, c: x.c })) });
      this._gravity();
      this._refill();
      this._runCascades();
      this._checkWin();
      return { ok: true, removed: n, score: pts };
    },

    // ---- 拖选多选（同一同色连通群的滑动多选，等价点击整群）----
    drag(r, c) {
      return this.tap(r, c);
    },

    // ---------------- 内部 ----------------
    _emit(e) { this._events.push(e); },

    _floodGroup(r, c) {
      const g = this.state.grid;
      const cell = g[r][c];
      if (!isLantern(cell)) return null;
      const color = cell.color;
      const seen = new Set([key(r, c)]);
      const stack = [[r, c]];
      const comp = [];
      while (stack.length) {
        const [cr, cc] = stack.pop();
        comp.push({ r: cr, c: cc });
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const nr = cr + dr;
          const nc = cc + dc;
          if (!inBounds(g, nr, nc) || seen.has(key(nr, nc))) continue;
          const n = g[nr][nc];
          if (isLantern(n) && n.color === color) {
            seen.add(key(nr, nc));
            stack.push([nr, nc]);
          }
        }
      }
      return comp;
    },

    // 命中一盏灯笼：扣 1 血，破则加入 removed
    _hit(cell, r, c, removed, removedSet) {
      if (!isLantern(cell)) return false;
      if (removedSet.has(key(r, c))) return false; // 已移除，不再处理（防止火焰/锁链重复入队）
      cell.hp -= 1;
      if (cell.hp > 0) {
        cell.cracked = true;
        this._emit({ type: 'metalHit', r, c });
        return false;
      }
      removedSet.add(key(r, c));
      removed.push({ r, c, cell });
      return true;
    },

    // 从一组格子出发，结算直接命中 + 火星/爆点/锁链扩展（固定点），返回 removed 列表
    _resolveRemoval(group) {
      const s = this.state;
      const removed = [];
      const removedSet = new Set();
      const queue = [];

      for (const { r, c } of group) {
        const cell = s.grid[r][c];
        if (this._hit(cell, r, c, removed, removedSet)) queue.push({ r, c });
      }

      while (queue.length) {
        const { r, c } = queue.shift();
        const cell = s.grid[r][c];
        if (!isLantern(cell)) continue;
        const expand = [];
        if (cell.type === 'fire') {
          this._emit({ type: 'fireRow', r });
          for (let cc = 0; cc < s.cols; cc += 1) expand.push({ r, c: cc });
        } else if (cell.type === 'bomb') {
          this._emit({ type: 'bomb', r, c });
          for (let dr = -1; dr <= 1; dr += 1) {
            for (let dc = -1; dc <= 1; dc += 1) {
              if (dr === 0 && dc === 0) continue;
              expand.push({ r: r + dr, c: c + dc });
            }
          }
        } else if (cell.type === 'chained' && cell.chainId != null) {
          for (let rr = 0; rr < s.rows; rr += 1) {
            for (let cc = 0; cc < s.cols; cc += 1) {
              const o = s.grid[rr][cc];
              if (isLantern(o) && o.type === 'chained' && o.chainId === cell.chainId && !(rr === r && cc === c)) {
                this._emit({ type: 'chainBreak', chainId: cell.chainId });
                expand.push({ r: rr, c: cc });
              }
            }
          }
        }
        for (const { r: er, c: ec } of expand) {
          if (!inBounds(s.grid, er, ec)) continue;
          const t = s.grid[er][ec];
          if (isLantern(t) && this._hit(t, er, ec, removed, removedSet)) queue.push({ r: er, c: ec });
        }
      }
      return removed;
    },

    _applyRemoval(removed, meta) {
      const s = this.state;
      for (const { r, c, cell } of removed) {
        // 时间灯笼：破掉补时
        if (cell.type === 'timeBonus') {
          s.timeLeft += GAME.TIME_LANTERN_BONUS;
          this._emit({ type: 'timeBonus', gained: GAME.TIME_LANTERN_BONUS });
        }
      }
      for (const { r, c } of removed) s.grid[r][c] = emptyCell();

      s.score += meta.pts;
      s.bestClear = Math.max(s.bestClear, meta.n);
      if (meta.n >= GAME.BIG_CLEAR_MIN && !s.bigClear) {
        s.bigClear = true;
        this._emit({ type: 'bigClear', n: meta.n });
      }
      this._emit({ type: meta.kind, n: meta.n, score: meta.pts, total: s.score, chain: meta.chain || 0, cells: (meta.cells || []).slice(0, 16) });
    },

    // 重力：石头沉底，灯笼按列下落堆叠
    _gravity() {
      const s = this.state;
      for (let c = 0; c < s.cols; c += 1) {
        const stones = [];
        const lanterns = [];
        for (let r = 0; r < s.rows; r += 1) {
          const cell = s.grid[r][c];
          if (cell.kind === 'stone') stones.push(cell);
          else if (cell.kind === 'lantern') lanterns.push(cell);
        }
        let idx = s.rows - 1;
        for (const st of stones) s.grid[idx--][c] = st;
        for (let i = lanterns.length - 1; i >= 0; i -= 1) s.grid[idx--][c] = lanterns[i];
        while (idx >= 0) s.grid[idx--][c] = emptyCell();
      }
    },

    // 补充：顶部空位填新灯笼
    _refill() {
      const s = this.state;
      const colors = LANTERN_COLORS.slice(0, this._level.colors);
      let filled = 0;
      for (let c = 0; c < s.cols; c += 1) {
        for (let r = 0; r < s.rows; r += 1) {
          if (s.grid[r][c].kind === 'empty') {
            s.grid[r][c] = lantern(pick(colors, this._rng));
            filled += 1;
          }
        }
      }
      if (filled > 0) this._emit({ type: 'refill', n: filled });
    },

    // 连锁：上浮重排后形成的 ≥CASCADE_MIN 同色群自动消除
    _runCascades() {
      const s = this.state;
      let chain = 0;
      let guard = 300;
      while (guard-- > 0) {
        const groups = findGroups(s.grid, GAME.CASCADE_MIN);
        if (!groups.length) break;
        chain += 1;
        let removed = [];
        const removedSet = new Set();
        const queue = [];
        // 每波把所有可消群一起结算
        for (const g of groups) {
          for (const { r, c } of g) {
            const cell = s.grid[r][c];
            if (this._hit(cell, r, c, removed, removedSet)) queue.push({ r, c });
          }
        }
        while (queue.length) {
          const { r, c } = queue.shift();
          const cell = s.grid[r][c];
          if (!isLantern(cell)) continue;
          const expand = [];
          if (cell.type === 'fire') {
            for (let cc = 0; cc < s.cols; cc += 1) expand.push({ r, c: cc });
          } else if (cell.type === 'bomb') {
            for (let dr = -1; dr <= 1; dr += 1) for (let dc = -1; dc <= 1; dc += 1) {
              if (dr || dc) expand.push({ r: r + dr, c: c + dc });
            }
          } else if (cell.type === 'chained' && cell.chainId != null) {
            for (let rr = 0; rr < s.rows; rr += 1) for (let cc = 0; cc < s.cols; cc += 1) {
              const o = s.grid[rr][cc];
              if (isLantern(o) && o.type === 'chained' && o.chainId === cell.chainId && !(rr === r && cc === c)) expand.push({ r: rr, c: cc });
            }
          }
          for (const { r: er, c: ec } of expand) {
            if (!inBounds(s.grid, er, ec)) continue;
            const t = s.grid[er][ec];
            if (isLantern(t) && this._hit(t, er, ec, removed, removedSet)) queue.push({ r: er, c: ec });
          }
        }
        const n = removed.length;
        if (!n) break;
        const pts = n * GAME.BASE_PER_LANTERN * chain;
        this._applyRemoval(removed, { kind: 'cascade', pts, n, chain, cells: removed.map((x) => ({ r: x.r, c: x.c })) });
        s.chain = chain;
        this._emit({ type: 'chain', chain });
        this._gravity();
        this._refill();
      }
    },

    _shiftColors() {
      const s = this.state;
      const colors = LANTERN_COLORS.slice(0, this._level.colors);
      let n = 0;
      for (let r = 0; r < s.rows; r += 1) {
        for (let c = 0; c < s.cols; c += 1) {
          const cell = s.grid[r][c];
          if (isLantern(cell) && cell.type === 'shifting') {
            const next = pick(colors.filter((x) => x !== cell.color), this._rng);
            cell.color = next;
            n += 1;
          }
        }
      }
      if (n > 0) this._emit({ type: 'shift', n });
    },

    _checkWin() {
      const s = this.state;
      if (s.phase !== 'playing') return;
      if (s.score >= s.target) this._win();
    },

    _win() {
      const s = this.state;
      if (s.phase !== 'playing') return;
      s.phase = 'won';
      const timeStar = s.timeLeft >= s.initialTime * GAME.STAR_TIME_RATIO ? 1 : 0;
      const bigStar = s.bigClear ? 1 : 0;
      s.stars = 1 + timeStar + bigStar;
      s.result = { won: true, stars: s.stars, score: s.score, target: s.target, timeLeft: s.timeLeft, bestClear: s.bestClear };
      this._emit({ type: 'win', stars: s.stars, score: s.score, timeLeft: s.timeLeft });
    },

    _lose(reason) {
      const s = this.state;
      if (s.phase !== 'playing') return;
      s.phase = 'lost';
      s.result = { won: false, stars: 0, score: s.score, target: s.target, timeLeft: s.timeLeft, bestClear: s.bestClear };
      this._emit({ type: 'lose', reason });
    },

    // 无合法群时洗牌，保证永远可继续（greedy/selfplay 依赖）
    ensurePlayable() {
      const s = this.state;
      let guard = 0;
      while (s.phase === 'playing' && !findGroups(s.grid, GAME.MANUAL_MIN).length && guard++ < 8) {
        reshuffle(s.grid, this._rng);
        this._emit({ type: 'shuffle' });
      }
    },
  };

  // 初始盘确保有合法群
  run.ensurePlayable();

  return run;
}

export function createSim() {
  return createRun(0, { seed: 1 });
}
