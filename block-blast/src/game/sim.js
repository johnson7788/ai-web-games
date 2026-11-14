// 纯逻辑模拟：8×8 棋盘 + 三块托盘 + 行列消除 + 连击计分。
// 不碰 DOM / window / localStorage / Date.now；随机用可注入 seed。
import { BOARD, RULES } from '../../config/game.config.js';
import { SHAPES, TOTAL_WEIGHT } from '../../config/shapes.js';

const SIZE = BOARD.SIZE;

// mulberry32：可复现的伪随机
function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function emptyGrid() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

let uidCounter = 0;

function randomPiece(rng) {
  let roll = rng() * TOTAL_WEIGHT;
  let shape = SHAPES[0];
  for (const s of SHAPES) {
    roll -= s.weight;
    if (roll <= 0) { shape = s; break; }
  }
  uidCounter += 1;
  return {
    uid: uidCounter,
    shapeId: shape.id,
    cells: shape.cells.map(([r, c]) => [r, c]),
    color: shape.color,
    w: shape.w,
    h: shape.h,
  };
}

export function createSim({ seed = 1 } = {}) {
  const rng = makeRng(seed);
  const sim = {
    seed,
    grid: emptyGrid(),
    tray: [null, null, null],
    score: 0,
    combo: 0,
    lines: 0,
    piecesPlaced: 0,
    phase: 'playing', // playing | over
    events: [],
    rng,
  };
  refillTray(sim);
  return sim;
}

// 托盘全空时补满三块
export function refillTray(sim) {
  if (sim.tray.every((p) => p === null)) {
    for (let i = 0; i < RULES.traySize; i += 1) {
      sim.tray[i] = randomPiece(sim.rng);
    }
    sim.events.push({ type: 'refill' });
    return true;
  }
  return false;
}

// 某形状能否放在 (row,col)：全部格子在界内且为空
export function canPlaceAt(grid, cells, row, col) {
  for (const [r, c] of cells) {
    const rr = row + r;
    const cc = col + c;
    if (rr < 0 || rr >= SIZE || cc < 0 || cc >= SIZE) return false;
    if (grid[rr][cc] !== 0) return false;
  }
  return true;
}

export function canPlace(sim, pieceIndex, row, col) {
  const piece = sim.tray[pieceIndex];
  if (!piece || sim.phase !== 'playing') return false;
  return canPlaceAt(sim.grid, piece.cells, row, col);
}

// 找出任意一个可放位置（用于提示 / 死局判定）
export function findAnyFit(sim) {
  for (let i = 0; i < sim.tray.length; i += 1) {
    const piece = sim.tray[i];
    if (!piece) continue;
    for (let r = 0; r < SIZE; r += 1) {
      for (let c = 0; c < SIZE; c += 1) {
        if (canPlaceAt(sim.grid, piece.cells, r, c)) {
          return { pieceIndex: i, row: r, col: c };
        }
      }
    }
  }
  return null;
}

export function anyFit(sim) {
  return findAnyFit(sim) !== null;
}

// 找出所有满行 / 满列
function fullLines(grid) {
  const rows = [];
  const cols = [];
  for (let r = 0; r < SIZE; r += 1) {
    if (grid[r].every((v) => v !== 0)) rows.push(r);
  }
  for (let c = 0; c < SIZE; c += 1) {
    let full = true;
    for (let r = 0; r < SIZE; r += 1) {
      if (grid[r][c] === 0) { full = false; break; }
    }
    if (full) cols.push(c);
  }
  return { rows, cols };
}

// 放置一块：填格 → 计分 → 消行列 → 补托盘 → 判死局。
// 返回 { ok, ... }；非法放置返回 { ok:false }。
export function place(sim, pieceIndex, row, col) {
  if (!canPlace(sim, pieceIndex, row, col)) return { ok: false };
  const piece = sim.tray[pieceIndex];

  const placedCells = [];
  for (const [r, c] of piece.cells) {
    const rr = row + r;
    const cc = col + c;
    sim.grid[rr][cc] = piece.color;
    placedCells.push({ r: rr, c: cc, color: piece.color });
  }
  sim.tray[pieceIndex] = null;
  sim.piecesPlaced += 1;

  const placeGain = piece.cells.length * RULES.placeScorePerCell;
  sim.score += placeGain;
  sim.events.push({ type: 'place', cells: placedCells, gained: placeGain });

  const { rows, cols } = fullLines(sim.grid);
  const lineCount = rows.length + cols.length;
  let clearGain = 0;
  let comboGain = 0;

  if (lineCount > 0) {
    // 收集被消格子（去重），记录颜色供渲染
    const clearedMap = new Map();
    for (const r of rows) {
      for (let c = 0; c < SIZE; c += 1) clearedMap.set(`${r},${c}`, { r, c, color: sim.grid[r][c] });
    }
    for (const c of cols) {
      for (let r = 0; r < SIZE; r += 1) clearedMap.set(`${r},${c}`, { r, c, color: sim.grid[r][c] });
    }
    const clearedCells = [...clearedMap.values()];
    for (const { r, c } of clearedCells) sim.grid[r][c] = 0;

    sim.combo += 1;
    sim.lines += lineCount;
    clearGain = RULES.lineBaseScore * lineCount * lineCount;
    comboGain = RULES.comboBonus * (sim.combo - 1);
    sim.score += clearGain + comboGain;
    sim.events.push({
      type: 'blast', rows, cols, cells: clearedCells,
      lines: lineCount, combo: sim.combo, gained: clearGain + comboGain,
    });
  } else {
    sim.combo = 0;
  }

  refillTray(sim);

  if (!anyFit(sim)) {
    sim.phase = 'over';
    sim.events.push({ type: 'over', score: sim.score });
  }

  return {
    ok: true,
    lines: lineCount,
    combo: sim.combo,
    gained: placeGain + clearGain + comboGain,
    over: sim.phase === 'over',
  };
}

export function getHud(sim) {
  return {
    score: sim.score,
    combo: sim.combo,
    lines: sim.lines,
    piecesPlaced: sim.piecesPlaced,
    phase: sim.phase,
  };
}

export function drainEvents(sim) {
  const out = sim.events;
  sim.events = [];
  return out;
}

// 重置（重开）：保留同一接口
export function resetSim(sim, { seed = 1 } = {}) {
  const fresh = createSim({ seed });
  Object.assign(sim, fresh);
  return sim;
}