// src/game/board.js — 三消棋盘纯逻辑（零 DOM/零依赖，node 可直接测）
//
// 格：null（空）| { color: 0..colors-1, special: 0|'row'|'col'|'nova', dark: bool }
//   - 暗物质格 { color:-1, dark:true }：固定占位、不参与消除、不被重力移动，靠相邻特殊星爆开。
//   - 特殊星仍有颜色，参与普通连线；被消除时触发 row/col/nova 爆发。
// 计分 / 阈值全来自 config/gameplay.js。
import {
  BOARD, SPECIAL, CELL, MATCH_MIN, SPECIAL_LEN, NOVA_LEN, SCORE, GRAVITY,
} from '../../config/gameplay.js';
import { mulberry32, randInt } from './rng.js';

const ROWS = BOARD.ROWS;
const COLS = BOARD.COLS;
const N = ROWS * COLS;

export function idx(r, c) { return r * COLS + c; }
export function rc(i) { return { r: Math.floor(i / COLS), c: i % COLS }; }
export function inBounds(r, c) { return r >= 0 && r < ROWS && c >= 0 && c < COLS; }
export function isDark(cell) { return !!cell && cell.dark === true; }
export function isColored(cell) { return !!cell && cell.dark !== true && cell.color >= 0; }

export function cloneGrid(grid) { return grid.slice(); }

export function newStar(rng, colors) {
  return { color: randInt(rng, 0, colors - 1), special: 0, dark: false };
}

// ---------------------------------------------------------------------------
// 连线查找
// ---------------------------------------------------------------------------

/** 所有长度 ≥ MATCH_MIN 的横/竖同色连线。run = { dir, r, c, len, cells, color } */
export function findAllMatches(grid) {
  const runs = [];
  // 横向
  for (let r = 0; r < ROWS; r += 1) {
    let c = 0;
    while (c < COLS) {
      const cell = grid[idx(r, c)];
      if (!isColored(cell)) { c += 1; continue; }
      const color = cell.color;
      let end = c;
      while (end + 1 < COLS && isColored(grid[idx(r, end + 1)]) && grid[idx(r, end + 1)].color === color) end += 1;
      const len = end - c + 1;
      if (len >= MATCH_MIN) {
        const cells = [];
        for (let k = 0; k < len; k += 1) cells.push(idx(r, c + k));
        runs.push({ dir: 'h', r, c, len, cells, color });
      }
      c = end + 1;
    }
  }
  // 纵向
  for (let c = 0; c < COLS; c += 1) {
    let r = 0;
    while (r < ROWS) {
      const cell = grid[idx(r, c)];
      if (!isColored(cell)) { r += 1; continue; }
      const color = cell.color;
      let end = r;
      while (end + 1 < ROWS && isColored(grid[idx(end + 1, c)]) && grid[idx(end + 1, c)].color === color) end += 1;
      const len = end - r + 1;
      if (len >= MATCH_MIN) {
        const cells = [];
        for (let k = 0; k < len; k += 1) cells.push(idx(r + k, c));
        runs.push({ dir: 'v', r, c, len, cells, color });
      }
      r = end + 1;
    }
  }
  return runs;
}

// ---------------------------------------------------------------------------
// 交换
// ---------------------------------------------------------------------------

/** 相邻判定：同一行左右相邻或同一列上下相邻。 */
export function areAdjacent(a, b) {
  const pa = rc(a); const pb = rc(b);
  return (pa.r === pb.r && Math.abs(pa.c - pb.c) === 1) || (pa.c === pb.c && Math.abs(pa.r - pb.r) === 1);
}

export function swapCells(grid, a, b) {
  const t = grid[a]; grid[a] = grid[b]; grid[b] = t;
}

/** 是否存在任意一步相邻交换能成连。 */
export function hasValidMove(grid) {
  return findValidSwaps(grid).length > 0;
}

/** 枚举所有「交换后能成连」的相邻交换（用于重排判定与 bot）。 */
export function findValidSwaps(grid) {
  const out = [];
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const a = idx(r, c);
      if (!isColored(grid[a])) continue;
      // 右
      if (c + 1 < COLS && isColored(grid[idx(r, c + 1)])) {
        const b = idx(r, c + 1);
        swapCells(grid, a, b);
        if (findAllMatches(grid).length) out.push([a, b]);
        swapCells(grid, a, b);
      }
      // 下
      if (r + 1 < ROWS && isColored(grid[idx(r + 1, c)])) {
        const b = idx(r + 1, c);
        swapCells(grid, a, b);
        if (findAllMatches(grid).length) out.push([a, b]);
        swapCells(grid, a, b);
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 特殊星爆发范围
// ---------------------------------------------------------------------------

function blastCells(grid, cell, pos) {
  const out = [];
  if (cell.special === SPECIAL.ROW) {
    for (let c = 0; c < COLS; c += 1) out.push(idx(pos.r, c));
  } else if (cell.special === SPECIAL.COL) {
    for (let r = 0; r < ROWS; r += 1) out.push(idx(r, pos.c));
  } else if (cell.special === SPECIAL.NOVA) {
    for (let i = 0; i < N; i += 1) {
      const g = grid[i];
      if (isColored(g) && g.color === cell.color) out.push(i);
    }
  }
  // 暗物质格：被相邻（四方向）特殊星爆开
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const [dr, dc] of dirs) {
    const nr = pos.r + dr; const nc = pos.c + dc;
    if (inBounds(nr, nc) && isDark(grid[idx(nr, nc)])) out.push(idx(nr, nc));
  }
  return out;
}

// ---------------------------------------------------------------------------
// 重力 + 补给（按列分段，暗物质格固定不落，星屑不能穿过）
// ---------------------------------------------------------------------------

function compactSegment(grid, c, top, bottom, rng, colors, gravity) {
  const cells = [];
  for (let r = top; r <= bottom; r += 1) cells.push(grid[idx(r, c)]);
  const stars = cells.filter((x) => x != null); // 段内全是非暗格（段已按暗格切分）
  let k = 0;
  if (gravity === GRAVITY.DOWN) {
    for (let r = bottom; r >= top; r -= 1) {
      grid[idx(r, c)] = (k < stars.length) ? stars[stars.length - 1 - k] : newStar(rng, colors);
      k += 1;
    }
  } else {
    for (let r = top; r <= bottom; r += 1) {
      grid[idx(r, c)] = (k < stars.length) ? stars[k] : newStar(rng, colors);
      k += 1;
    }
  }
}

function applyGravity(grid, rng, colors, gravity, emit) {
  let fell = 0;
  let refilled = 0;
  for (let c = 0; c < COLS; c += 1) {
    let segTop = 0;
    for (let r = 0; r <= ROWS; r += 1) {
      if (r === ROWS || isDark(grid[idx(r, c)])) {
        const segBottom = r - 1;
        if (segBottom >= segTop) {
          const segLen = segBottom - segTop + 1;
          const before = [];
          for (let rr = segTop; rr <= segBottom; rr += 1) before.push(grid[idx(rr, c)]);
          const starRows = [];
          for (let k = 0; k < before.length; k += 1) if (before[k] != null) starRows.push(segTop + k);
          compactSegment(grid, c, segTop, segBottom, rng, colors, gravity);
          // 位移近似：原星数与补给星数（事件密度用，精确值不影响玩法）
          const stars = starRows.length;
          for (let k = 0; k < stars; k += 1) {
            const settledRow = gravity === GRAVITY.DOWN ? segBottom - k : segTop + k;
            if (settledRow !== starRows[k]) fell += 1;
          }
          refilled += segLen - stars;
        }
        segTop = r + 1;
      }
    }
  }
  if (fell > 0 && emit) emit({ type: 'fall', count: fell });
  if (refilled > 0 && emit) emit({ type: 'refill', count: refilled });
}

// ---------------------------------------------------------------------------
// 整体解析（连锁消除直到无连）
// ---------------------------------------------------------------------------

/**
 * 在 grid 上原地执行：反复「找连 → 消 → 造特殊星 → 爆发 → 重力补给」，直到无连。
 * emit(event) 回调逐事件上报；返回 { score, cleared, cascades, specials }。
 * swapCells：本回合玩家交换的那两个格（用于把特殊星落在交换点）。
 */
export function resolveBoard(grid, emit, { rng, colors = BOARD.COLORS, gravity = GRAVITY.DOWN, swapCells = [] } = {}) {
  const r = rng || mulberry32(1);
  let cascade = 0;
  let totalScore = 0;
  let totalCleared = 0;
  let totalSpecials = 0;

  for (;;) {
    const matches = findAllMatches(grid);
    if (!matches.length) break;
    cascade += 1;

    // --- 1) 特殊星落点（四连/五连/横竖交叉） ---
    const seeds = new Map(); // idx -> { type, color }
    const cellMatchCount = new Map();
    for (const m of matches) {
      for (const i of m.cells) cellMatchCount.set(i, (cellMatchCount.get(i) || 0) + 1);
    }
    for (const m of matches) {
      if (m.len < SPECIAL_LEN) continue;
      let seed = null;
      if (cascade === 1) {
        for (const sc of swapCells) {
          if (sc != null && m.cells.includes(sc)) { seed = sc; break; }
        }
      }
      if (seed == null) seed = m.cells[Math.floor(m.len / 2)];
      let type = m.len >= NOVA_LEN ? SPECIAL.NOVA : (m.dir === 'h' ? SPECIAL.ROW : SPECIAL.COL);
      const color = isColored(grid[seed]) ? grid[seed].color : m.color;
      seeds.set(seed, { type, color });
    }
    for (const [i, s] of seeds) {
      if ((cellMatchCount.get(i) || 0) >= 2) s.type = SPECIAL.NOVA; // L/T 形 → 超新星
    }

    // --- 2) 待消除集合（含特殊星连锁爆发） ---
    const toClear = new Set();
    for (const m of matches) {
      for (const i of m.cells) if (!seeds.has(i)) toClear.add(i);
    }
    const blastQueue = [];
    for (const i of toClear) {
      const cell = grid[i];
      if (cell && cell.special) blastQueue.push(i);
    }
    while (blastQueue.length) {
      const i = blastQueue.shift();
      const cell = grid[i];
      if (!cell || !cell.special) continue;
      if (emit) emit({ type: cell.special === SPECIAL.NOVA ? 'novaBlast' : 'specialBlast', i, r: rc(i).r, c: rc(i).c, special: cell.special });
      const extras = blastCells(grid, cell, rc(i));
      for (const j of extras) {
        if (toClear.has(j)) continue;
        toClear.add(j);
        const jc = grid[j];
        if (jc && jc.special) blastQueue.push(j);
      }
    }

    // --- 3) 清空 ---
    let starCleared = 0;
    let darkCleared = 0;
    for (const i of toClear) {
      const cell = grid[i];
      if (!cell) continue;
      if (isDark(cell)) {
        darkCleared += 1;
        if (emit) emit({ type: 'darkBreak', i, r: rc(i).r, c: rc(i).c });
      } else {
        starCleared += 1;
        if (emit) emit({ type: 'clearStar', i, r: rc(i).r, c: rc(i).c, color: cell.color, special: cell.special, cascade });
      }
      grid[i] = null;
    }

    // --- 4) 上报连线 ---
    for (const m of matches) {
      if (emit) emit({ type: 'match', r: m.r, c: m.c, len: m.len, color: m.color, dir: m.dir, cascade });
    }

    // --- 5) 重力 + 补给 ---
    applyGravity(grid, r, colors, gravity, emit);

    // --- 6) 在落点放置特殊星（覆盖补给星，锚定在交换点） ---
    let passSpecials = 0;
    for (const [i, s] of seeds) {
      grid[i] = { color: s.color, special: s.type, dark: false };
      passSpecials += 1;
      if (emit) emit({ type: 'specialCreate', i, r: rc(i).r, c: rc(i).c, special: s.type, color: s.color });
    }

    // --- 计分 ---
    let passScore = starCleared * SCORE.BASE_PER_STAR + darkCleared * SCORE.DARK_BONUS + passSpecials * SCORE.SPECIAL_BONUS;
    passScore *= (1 + SCORE.CASCADE_BONUS * (cascade - 1));
    totalScore += passScore;
    totalCleared += starCleared;
    totalSpecials += passSpecials;
    if (cascade > 1 && emit) emit({ type: 'cascade', n: cascade });
  }

  return { score: Math.round(totalScore), cleared: totalCleared, cascades: cascade, specials: totalSpecials };
}

// ---------------------------------------------------------------------------
// 生成 / 重排 / 评估
// ---------------------------------------------------------------------------

/** 生成一块「无现成连线、且至少一步有效交换」的棋盘。 */
export function createGrid(rng, { colors = BOARD.COLORS, darkCells = [], seeded = [], gravity = GRAVITY.DOWN } = {}) {
  const r = rng || mulberry32(1);
  let grid;
  for (let attempt = 0; attempt < 200; attempt += 1) {
    grid = new Array(N).fill(null);
    for (let i = 0; i < N; i += 1) grid[i] = { color: randInt(r, 0, colors - 1), special: 0, dark: false };
    for (const d of darkCells) {
      if (inBounds(d.r, d.c)) grid[idx(d.r, d.c)] = { color: CELL.DARK, special: 0, dark: true };
    }
    for (const s of seeded) {
      if (inBounds(s.r, s.c) && !isDark(grid[idx(s.r, s.c)])) grid[idx(s.r, s.c)].special = s.s;
    }
    if (findAllMatches(grid).length === 0 && hasValidMove(grid)) return grid;
  }
  return grid; // 极端情况下兜底返回（几乎不可能）
}

/** 重排：换色直到无现成连线且有解（不改变暗物质格）。 */
export function shuffleGrid(rng, grid, colors = BOARD.COLORS) {
  const r = rng || mulberry32(1);
  for (let attempt = 0; attempt < 200; attempt += 1) {
    for (let i = 0; i < N; i += 1) {
      if (isDark(grid[i])) continue;
      grid[i] = { color: randInt(r, 0, colors - 1), special: 0, dark: false };
    }
    if (findAllMatches(grid).length === 0 && hasValidMove(grid)) return true;
  }
  return false;
}

/** 评估某次相邻交换的收益（不改原棋盘）。返回 { valid, score, cleared, cascades, specials }。 */
export function evaluateSwap(grid, a, b, colors = BOARD.COLORS, gravity = GRAVITY.DOWN) {
  const g = cloneGrid(grid);
  swapCells(g, a, b);
  if (!findAllMatches(g).length) return { valid: false, score: 0, cleared: 0, cascades: 0, specials: 0 };
  const res = resolveBoard(g, null, { rng: mulberry32(7), colors, gravity, swapCells: [a, b] });
  return { valid: true, ...res };
}
