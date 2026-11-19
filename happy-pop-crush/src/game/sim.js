// HAPPY POP CRUSH · 模拟层（纯逻辑，零 DOM/window/canvas）
// 职责：棋盘生成（无初始三消）、点选/交换状态机、三消判定、特殊宝石生成与引爆、
//       岩石震碎、重力下落、连锁、步数/目标分/星级结算、事件表、随机（seed 可复现）。
// 玩法骨架 1:1 于参考源码（开心消消乐）：相邻交换、≥3 消、4 连行/列特殊、L/T 包裹、
//       5 连彩虹、消除后下落补位、连锁循环。
// 新增机制：岩石格、连击倍率、目标分/步数/星级、锤子道具、自动洗牌。

import { LEVELS, LEVEL_COUNT } from '../../config/levels.js';
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

const key = (r, c) => `${r},${c}`;
const isGem = (cell) => !!cell && cell.kind !== 'rock';
const manhattan = (a, b) => Math.abs(a.r - b.r) + Math.abs(a.c - b.c);

// ------------------------------------------------------------------ createRun
export function createRun(levelIndex = 0, opts = {}) {
  const level = LEVELS[levelIndex] ?? LEVELS[0];
  const seed = (opts.seed ?? 1) >>> 0;
  const rng = mulberry32(seed);
  const rows = GAME.ROWS;
  const cols = GAME.COLS;
  const colors = Math.max(3, Math.min(GAME.BASE_COLORS, level.colors));

  let nextId = 1;
  const newId = () => nextId++;

  const grid = [];
  for (let r = 0; r < rows; r += 1) grid[r] = new Array(cols).fill(null);

  const state = {
    level: level.index,            // 1 基
    phase: 'playing',              // 'playing' | 'won' | 'lost'
    rows,
    cols,
    grid,
    colors,
    score: 0,
    targetScore: level.target,
    movesLeft: level.moves,
    initialMoves: level.moves,
    hammers: level.hammers || 0,
    selected: null,                // { r, c } | null
    combo: 0,
    stars: 0,
    result: null,
    seed,
  };

  const randColor = () => Math.floor(rng() * colors);

  // 在 (r,c) 放 color 是否立即形成三消（只查左两格与上两格）
  function wouldMatch(r, c, color) {
    if (c >= 2 && isGem(grid[r][c - 1]) && isGem(grid[r][c - 2])
      && grid[r][c - 1].color === color && grid[r][c - 2].color === color) return true;
    if (r >= 2 && isGem(grid[r - 1][c]) && isGem(grid[r - 2][c])
      && grid[r - 1][c].color === color && grid[r - 2][c].color === color) return true;
    return false;
  }

  function makeGem(color) {
    return { id: newId(), color, special: 'none' };
  }

  // 全盘重新填随机颜色（保持岩石不动），避免立即三消
  function fillRandomColors() {
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const cell = grid[r][c];
        if (!cell || cell.kind === 'rock') continue;
        let color;
        do { color = randColor(); } while (wouldMatch(r, c, color));
        cell.color = color;
        cell.special = 'none';
      }
    }
  }

  function buildBoard() {
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        let color;
        do { color = randColor(); } while (wouldMatch(r, c, color));
        grid[r][c] = makeGem(color);
      }
    }
    for (const [r, c] of level.rocks) {
      if (r >= 0 && r < rows && c >= 0 && c < cols) grid[r][c] = { kind: 'rock' };
    }
    ensurePlayable();
  }

  // 保证有可行交换；无解就反复重填
  function ensurePlayable() {
    for (let t = 0; t < 20 && !findMove(); t += 1) fillRandomColors();
  }

  // ------------------------------------------------------------------ 扫描
  // 返回 hLen/vLen 二维（参与 ≥3 连的长度，否则 0）与 groups（各 run 的格子）
  function scanMatches() {
    const hLen = [];
    const vLen = [];
    for (let r = 0; r < rows; r += 1) { hLen[r] = new Array(cols).fill(0); vLen[r] = new Array(cols).fill(0); }
    const groups = [];
    // 横排
    for (let r = 0; r < rows; r += 1) {
      let c = 0;
      while (c < cols) {
        const cell = grid[r][c];
        if (!isGem(cell)) { c += 1; continue; }
        let end = c;
        while (end + 1 < cols && isGem(grid[r][end + 1]) && grid[r][end + 1].color === cell.color) end += 1;
        const len = end - c + 1;
        if (len >= 3) {
          const cells = [];
          for (let k = c; k <= end; k += 1) { cells.push({ r, c: k }); hLen[r][k] = len; }
          groups.push({ cells, dir: 'h', len });
        }
        c = end + 1;
      }
    }
    // 竖排
    for (let c = 0; c < cols; c += 1) {
      let r = 0;
      while (r < rows) {
        const cell = grid[r][c];
        if (!isGem(cell)) { r += 1; continue; }
        let end = r;
        while (end + 1 < rows && isGem(grid[end + 1][c]) && grid[end + 1][c].color === cell.color) end += 1;
        const len = end - r + 1;
        if (len >= 3) {
          const cells = [];
          for (let k = r; k <= end; k += 1) { cells.push({ r: k, c }); vLen[k][c] = len; }
          groups.push({ cells, dir: 'v', len });
        }
        r = end + 1;
      }
    }
    return { hLen, vLen, groups };
  }

  function specialFor(r, c, hLen, vLen) {
    const h = hLen[r]?.[c] || 0;
    const v = vLen[r]?.[c] || 0;
    if (h >= 5 || v >= 5) return 'bird';
    if (h >= 3 && v >= 3) return 'wrap';
    if (h >= 4) return 'line';
    if (v >= 4) return 'column';
    return 'none';
  }

  function swapCells(a, b) {
    const t = grid[a.r][a.c];
    grid[a.r][a.c] = grid[b.r][b.c];
    grid[b.r][b.c] = t;
  }

  // ------------------------------------------------------------------ 特殊宝石
  function randomColorOnBoard() {
    const seen = [];
    for (let r = 0; r < rows; r += 1) for (let c = 0; c < cols; c += 1) {
      const cell = grid[r][c];
      if (isGem(cell) && cell.color >= 0) seen.push(cell.color);
    }
    return seen.length ? seen[Math.floor(rng() * seen.length)] : 0;
  }

  // 返回某个特殊宝石引爆时波及的格子（不含自身）
  function specialTargets(sp) {
    const out = [];
    if (sp.special === 'line') {
      for (let c = 0; c < cols; c += 1) out.push({ r: sp.r, c });
    } else if (sp.special === 'column') {
      for (let r = 0; r < rows; r += 1) out.push({ r, c: sp.c });
    } else if (sp.special === 'wrap') {
      for (let dr = -1; dr <= 1; dr += 1) for (let dc = -1; dc <= 1; dc += 1) {
        const rr = sp.r + dr, cc = sp.c + dc;
        if (rr >= 0 && rr < rows && cc >= 0 && cc < cols) out.push({ r: rr, c: cc });
      }
    } else if (sp.special === 'bird') {
      const color = sp.color >= 0 ? sp.color : randomColorOnBoard();
      for (let r = 0; r < rows; r += 1) for (let c = 0; c < cols; c += 1) {
        const cell = grid[r][c];
        if (isGem(cell) && cell.color === color) out.push({ r, c });
      }
    }
    return out;
  }

  // 收集被引爆的特殊宝石波及的所有格子（BFS 连锁）
  function collectSpecialTargets(initial, cleared) {
    let extraCount = 0;
    let lastSpecial = 'none';
    const queue = [...initial];
    const seen = new Set();
    while (queue.length) {
      const sp = queue.shift();
      const k = key(sp.r, sp.c);
      if (seen.has(k)) continue;
      seen.add(k);
      lastSpecial = sp.special;
      for (const t of specialTargets(sp)) {
        const obj = grid[t.r][t.c];
        if (obj && obj.kind !== 'rock') {
          if (obj.special !== 'none') queue.push({ r: t.r, c: t.c, special: obj.special, color: obj.color });
          const tk = key(t.r, t.c);
          if (!cleared.has(tk)) { cleared.add(tk); extraCount += 1; }
        }
      }
    }
    return { count: extraCount, lastSpecial };
  }

  // ------------------------------------------------------------------ 重力
  function applyGravity() {
    const oldRow = new Map();
    for (let r = 0; r < rows; r += 1) for (let c = 0; c < cols; c += 1) {
      const cell = grid[r][c];
      if (cell && cell.kind !== 'rock' && cell.id != null) oldRow.set(cell.id, r);
    }
    let spawned = 0;
    for (let c = 0; c < cols; c += 1) {
      const gems = [];
      const rockRows = [];
      for (let r = 0; r < rows; r += 1) {
        const cell = grid[r][c];
        if (!cell) continue;
        if (cell.kind === 'rock') rockRows.push(r);
        else gems.push(cell);
      }
      const rockSet = new Set(rockRows);
      const emptyRows = [];
      for (let r = rows - 1; r >= 0; r -= 1) if (!rockSet.has(r)) emptyRows.push(r);
      const newCol = new Array(rows).fill(null);
      for (const r of rockRows) newCol[r] = grid[r][c];
      let gi = gems.length - 1;
      for (const r of emptyRows) {
        if (gi >= 0) newCol[r] = gems[gi--];
        else { newCol[r] = makeGem(randColor()); spawned += 1; }
      }
      for (let r = 0; r < rows; r += 1) grid[r][c] = newCol[r];
    }
    let moved = spawned;
    for (let r = 0; r < rows; r += 1) for (let c = 0; c < cols; c += 1) {
      const cell = grid[r][c];
      if (cell && cell.id != null) {
        const or = oldRow.get(cell.id);
        if (or !== undefined && or !== r) moved += 1;
      }
    }
    return moved;
  }

  // ------------------------------------------------------------------ 连锁消除
  function resolve(anchors) {
    let combo = 0;
    for (let iter = 0; iter < 120; iter += 1) {
      const { hLen, vLen, groups } = scanMatches();
      if (groups.length === 0) break;
      combo += 1;

      const cleared = new Set();
      const crushedSpecials = [];
      const spawns = [];
      const spawnCells = new Set();

      for (const g of groups) {
        for (const cell of g.cells) {
          const obj = grid[cell.r][cell.c];
          if (!obj) continue;
          if (obj.special !== 'none') crushedSpecials.push({ r: cell.r, c: cell.c, special: obj.special, color: obj.color });
          cleared.add(key(cell.r, cell.c));
        }
      }

      // 决定在哪生成特殊宝石：优先落在本次交换的锚点格
      const anchorKeys = new Set(anchors.map((a) => key(a.r, a.c)));
      for (const g of groups) {
        let spawnCell = null;
        for (const cell of g.cells) if (anchorKeys.has(key(cell.r, cell.c))) { spawnCell = cell; break; }
        if (!spawnCell) spawnCell = g.cells[0];
        const sp = specialFor(spawnCell.r, spawnCell.c, hLen, vLen);
        if (sp !== 'none' && !spawnCells.has(key(spawnCell.r, spawnCell.c))) {
          spawnCells.add(key(spawnCell.r, spawnCell.c));
          const c = grid[spawnCell.r][spawnCell.c];
          spawns.push({ r: spawnCell.r, c: spawnCell.c, special: sp, color: c ? c.color : 0 });
        }
      }

      // 引爆被卷入消除的特殊宝石（连锁波及）
      const extra = collectSpecialTargets(crushedSpecials, cleared);

      // 落定：清空所有波及格，再放回新生成的特殊宝石
      for (const k of cleared) {
        const [r, c] = k.split(',').map(Number);
        grid[r][c] = null;
      }
      for (const s of spawns) {
        grid[s.r][s.c] = makeGem(s.special === 'bird' ? -1 : s.color);
        grid[s.r][s.c].special = s.special;
      }

      const count = cleared.size;
      state.score += count * GAME.POINTS_PER_GEM;
      run._emit({ type: 'crush', count, combo });
      run._emit({ type: 'score', score: state.score });
      if (extra.count > 0) {
        state.score += extra.count * GAME.SPECIAL_BONUS;
        run._emit({ type: 'special', special: extra.lastSpecial, count: extra.count });
        run._emit({ type: 'score', score: state.score });
      }

      // 震碎相邻岩石
      let rockBroken = 0;
      for (const k of cleared) {
        const [r, c] = k.split(',').map(Number);
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const rr = r + dr, cc = c + dc;
          if (rr >= 0 && rr < rows && cc >= 0 && cc < cols && grid[rr][cc] && grid[rr][cc].kind === 'rock') {
            grid[rr][cc] = null;
            rockBroken += 1;
          }
        }
      }
      if (rockBroken > 0) {
        state.score += rockBroken * GAME.ROCK_BONUS;
        run._emit({ type: 'rockBreak', count: rockBroken });
        run._emit({ type: 'score', score: state.score });
      }

      const fell = applyGravity();
      if (fell > 0) run._emit({ type: 'fall', count: fell });
    }
    state.combo = combo;
    if (combo >= 2) {
      state.score += GAME.COMBO_BONUS * (combo - 1);
      run._emit({ type: 'combo', combo });
      run._emit({ type: 'score', score: state.score });
    }
    return combo;
  }

  // ------------------------------------------------------------------ 查找可行交换
  function findMove() {
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const a = grid[r][c];
        if (!isGem(a)) continue;
        if (c + 1 < cols && isGem(grid[r][c + 1])) {
          swapCells({ r, c }, { r, c: c + 1 });
          const ok = scanMatches().groups.length > 0;
          swapCells({ r, c }, { r, c: c + 1 });
          if (ok) return { a: { r, c }, b: { r, c: c + 1 } };
        }
        if (r + 1 < rows && isGem(grid[r + 1][c])) {
          swapCells({ r, c }, { r: r + 1, c });
          const ok = scanMatches().groups.length > 0;
          swapCells({ r, c }, { r: r + 1, c });
          if (ok) return { a: { r, c }, b: { r: r + 1, c } };
        }
      }
    }
    return null;
  }

  function hasValidMove() { return findMove() != null; }

  function computeStars() {
    if (state.score < state.targetScore) return 0;
    let s = 1;
    if (state.score >= state.targetScore * GAME.STAR_2_RATIO) s += 1;
    if (state.score >= state.targetScore * GAME.STAR_3_RATIO) s += 1;
    return s;
  }

  function afterMove() {
    if (state.phase !== 'playing') return;
    if (!hasValidMove()) run.shuffle(true);
    if (state.phase !== 'playing') return;
    if (state.score >= state.targetScore) run.win();
    else if (state.movesLeft <= 0) run.lose('outOfMoves');
  }

  // ------------------------------------------------------------------ run 对象
  const run = {
    state,
    _rng: rng,
    _level: level,
    _events: [],

    step() { /* 离散玩法，无连续推进 */ },

    drainEvents() {
      const ev = this._events;
      this._events = [];
      return ev;
    },

    _emit(e) { this._events.push(e); },

    win() {
      if (state.phase !== 'playing') return;
      state.phase = 'won';
      state.stars = computeStars();
      state.result = { won: true, stars: state.stars, score: state.score, movesLeft: state.movesLeft };
      this._emit({ type: 'win', stars: state.stars, score: state.score });
    },

    lose(reason) {
      if (state.phase !== 'playing') return;
      state.phase = 'lost';
      state.stars = 0;
      state.result = { won: false, stars: 0, score: state.score, movesLeft: state.movesLeft };
      this._emit({ type: 'lose', reason });
    },

    tap(r, c) {
      const s = state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      if (r < 0 || r >= rows || c < 0 || c >= cols) return { ok: false, reason: 'bounds' };
      const cell = grid[r][c];
      if (!cell || cell.kind === 'rock') {
        if (s.selected) { s.selected = null; this._emit({ type: 'deselect' }); }
        return { ok: false, reason: 'notGem' };
      }
      if (!s.selected) {
        s.selected = { r, c };
        this._emit({ type: 'select', r, c });
        return { ok: true, selected: true };
      }
      if (s.selected.r === r && s.selected.c === c) {
        s.selected = null;
        this._emit({ type: 'deselect' });
        return { ok: true, deselected: true };
      }
      const a = s.selected;
      const b = { r, c };
      if (manhattan(a, b) !== 1) {
        s.selected = b;
        this._emit({ type: 'select', r, c });
        return { ok: true, reselected: true };
      }
      s.selected = null;
      return this.swap(a, b);
    },

    swap(a, b) {
      const s = state;
      const ca = grid[a.r][a.c];
      const cb = grid[b.r][b.c];
      if (!isGem(ca) || !isGem(cb)) return { ok: false, reason: 'blocked' };

      // 彩虹鸟 + 任意宝石：清一整色
      if (ca.special === 'bird' || cb.special === 'bird') {
        const bird = ca.special === 'bird' ? ca : cb;
        const other = ca.special === 'bird' ? cb : ca;
        swapCells(a, b);
        const color = other.color >= 0 ? other.color : randColor();
        s.movesLeft -= 1;
        this._emit({ type: 'swap', a, b });
        let count = 0;
        for (let r = 0; r < rows; r += 1) for (let c = 0; c < cols; c += 1) {
          const cell = grid[r][c];
          if (isGem(cell) && cell.color === color) { grid[r][c] = null; count += 1; }
        }
        if (count > 0) {
          state.score += count * GAME.POINTS_PER_GEM;
          this._emit({ type: 'special', special: 'bird', count });
          this._emit({ type: 'score', score: state.score });
        }
        const fell = applyGravity();
        if (fell > 0) this._emit({ type: 'fall', count: fell });
        afterMove();
        return { ok: true, matched: true, special: 'bird' };
      }

      swapCells(a, b);
      this._emit({ type: 'swap', a, b });
      if (scanMatches().groups.length === 0) {
        swapCells(a, b); // 弹回
        this._emit({ type: 'swapBack', a, b });
        s.movesLeft -= 1; // 每次交换消耗一步（含弹回）：更考验判断，也保证失败有成本
        afterMove();
        return { ok: true, matched: false };
      }
      s.movesLeft -= 1;
      resolve([a, b]);
      afterMove();
      return { ok: true, matched: true };
    },

    findMove,
    hasValidMove,

    shuffle(auto) {
      if (state.phase !== 'playing') return { ok: false, reason: 'phase' };
      for (let t = 0; t < 20; t += 1) {
        fillRandomColors();
        if (hasValidMove()) { this._emit({ type: 'shuffle', auto: !!auto }); return { ok: true }; }
      }
      fillRandomColors();
      this._emit({ type: 'shuffle', auto: !!auto });
      return { ok: true };
    },

    hammer(r, c) {
      const s = state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      if (r < 0 || r >= rows || c < 0 || c >= cols) return { ok: false, reason: 'bounds' };
      const cell = grid[r][c];
      if (!cell) return { ok: false, reason: 'empty' };
      if (s.hammers <= 0) return { ok: false, reason: 'noHammers' };
      s.hammers -= 1;
      s.selected = null;
      if (cell.kind === 'rock') {
        grid[r][c] = null;
        state.score += GAME.ROCK_BONUS;
        this._emit({ type: 'rockBreak', count: 1, hammer: true });
        this._emit({ type: 'score', score: state.score });
      } else {
        grid[r][c] = null;
        this._emit({ type: 'hammer', r, c });
      }
      const fell = applyGravity();
      if (fell > 0) this._emit({ type: 'fall', count: fell });
      resolve([]);
      afterMove();
      return { ok: true };
    },

    getHud() {
      return {
        level: state.level,
        score: state.score,
        targetScore: state.targetScore,
        movesLeft: state.movesLeft,
        initialMoves: state.initialMoves,
        hammers: state.hammers,
        phase: state.phase,
        stars: state.stars,
        combo: state.combo,
        selected: state.selected,
      };
    },

    // 调试：强制结算（验收脚本用）
    debugWin() { state.score = state.targetScore; this.win(); },
    debugLose() { state.movesLeft = 0; this.lose('outOfMoves'); },
  };

  buildBoard();
  return run;
}

export function createSim() {
  return createRun(0, { seed: 1 });
}

export function updateSim(sim, _input) {
  sim.step(1 / 60);
  return sim;
}

export { LEVEL_COUNT };
