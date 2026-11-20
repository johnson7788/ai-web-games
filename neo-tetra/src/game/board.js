// 棋盘纯函数（无副作用）：碰撞判定 / 硬降落点 / 消行。
// sim 与 selfplay/tests 共用；坐标 x 右、y 下，棋盘 board[row][col]，0 = 空。
import { cellsFor } from './tetromino.js';

export const COLS = 10;
export const ROWS = 20;

// 空格取值：0 空；1-7 晶块（= COLOR_ID）；8 石头；9 墙（窄井）。
export const CELL = { EMPTY: 0, STONE: 8, WALL: 9 };

export function emptyBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(CELL.EMPTY));
}

export function cloneBoard(board) {
  return board.map((row) => row.slice());
}

// 该格是否可进入（y<0 视为隐藏行可进入；越界/墙/已填则不可）。
export function isEmptyCell(board, x, y) {
  if (y < 0) return true;
  if (x < 0 || x >= COLS || y >= ROWS) return false;
  return board[y][x] === CELL.EMPTY;
}

// 某块在 (x,y) 是否可放置。
export function canPlaceAt(board, type, rot, x, y) {
  const cells = cellsFor(type, rot);
  for (const [cx, cy] of cells) {
    if (!isEmptyCell(board, x + cx, y + cy)) return false;
  }
  return true;
}

// 硬降落点：返回 { ok, y, cells }（cells 为绝对坐标），无法放置则 ok:false。
export function dropResult(board, type, rot, x) {
  if (!canPlaceAt(board, type, rot, x, 0)) return { ok: false };
  let y = 0;
  while (canPlaceAt(board, type, rot, x, y + 1)) y += 1;
  const cells = cellsFor(type, rot).map(([cx, cy]) => [x + cx, y + cy]);
  return { ok: true, y, cells };
}

// 把 cells 写入棋盘（返回新棋盘），value 为单元格取值。
export function placeCells(board, cells, value) {
  const b = cloneBoard(board);
  for (const [x, y] of cells) {
    if (y >= 0 && y < ROWS && x >= 0 && x < COLS) b[y][x] = value;
  }
  return b;
}

// 可消除的行（自底向上索引）；窄井模式只统计非墙列，含石头则整行不可消。
export function clearableRows(board, { narrow = false } = {}) {
  const rows = [];
  const lo = narrow ? 1 : 0;
  const hi = narrow ? COLS - 1 : COLS; // 左闭右开
  for (let y = ROWS - 1; y >= 0; y -= 1) {
    let full = true;
    for (let x = lo; x < hi; x += 1) {
      const v = board[y][x];
      if (v === CELL.EMPTY || v === CELL.STONE) { full = false; break; }
    }
    if (full) rows.push(y);
  }
  return rows;
}

// 消掉指定行（返回新棋盘）：上方行整体下移。
export function clearRows(board, rowsToClear) {
  if (!rowsToClear.length) return cloneBoard(board);
  const remove = new Set(rowsToClear);
  const b = cloneBoard(board);
  let write = ROWS - 1;
  for (let y = ROWS - 1; y >= 0; y -= 1) {
    if (remove.has(y)) continue;
    if (write !== y) b[write] = b[y];
    write -= 1;
  }
  for (let y = write; y >= 0; y -= 1) b[y] = new Array(COLS).fill(CELL.EMPTY);
  return b;
}

// 最低已填行（gift：clearLowest 用）；narrow 模式只看非墙列是否非空。
export function lowestFilledRow(board, { narrow = false } = {}) {
  const lo = narrow ? 1 : 0;
  const hi = narrow ? COLS - 1 : COLS;
  for (let y = ROWS - 1; y >= 0; y -= 1) {
    for (let x = lo; x < hi; x += 1) {
      if (board[y][x] !== CELL.EMPTY) return y;
    }
  }
  return -1;
}

// 列高 / 空洞 / 崎岖度（greedy AI 代价函数用）。
export function heights(board) {
  const h = new Array(COLS).fill(0);
  for (let x = 0; x < COLS; x += 1) {
    for (let y = 0; y < ROWS; y += 1) {
      if (board[y][x] !== CELL.EMPTY) { h[x] = ROWS - y; break; }
    }
  }
  return h;
}

export function countHoles(board) {
  let holes = 0;
  for (let x = 0; x < COLS; x += 1) {
    let seen = false;
    for (let y = 0; y < ROWS; y += 1) {
      if (board[y][x] !== CELL.EMPTY) seen = true;
      else if (seen) holes += 1;
    }
  }
  return holes;
}

export function bumpiness(board) {
  const h = heights(board);
  let b = 0;
  for (let x = 1; x < COLS; x += 1) b += Math.abs(h[x] - h[x - 1]);
  return b;
}

export function aggregateHeight(board) {
  return heights(board).reduce((s, v) => s + v, 0);
}
