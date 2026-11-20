// src/game/board.js — 棋盘纯逻辑（零 DOM/零 window/零随机依赖注入）。
// 数据形状：cell = { o: OWNER, d: def }；board = cell[row][col]。
// 全部函数无副作用或只改传入 board（标注 *mut），便于 node:test 直测。
import { OWNER, captureCost } from '../../config/gameplay.js';
import { randInt } from './rng.js';

export const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

export function inBounds(size, r, c) {
  return r >= 0 && r < size && c >= 0 && c < size;
}

export function neighbors(size, r, c) {
  const out = [];
  for (const [dr, dc] of DIRS) {
    const nr = r + dr;
    const nc = c + dc;
    if (inBounds(size, nr, nc)) out.push([nr, nc]);
  }
  return out;
}

/** 新建一个 size×size 的中立棋盘。 */
export function createBoard(size) {
  const cells = [];
  for (let r = 0; r < size; r += 1) {
    const row = [];
    for (let c = 0; c < size; c += 1) row.push({ o: OWNER.NEUTRAL, d: 0 });
    cells.push(row);
  }
  return cells;
}

export function setCell(board, r, c, o, d) {
  board[r][c].o = o;
  board[r][c].d = d;
}

/** 把 holes（[r,c] 数组）标为空洞（不可玩）。 */
export function applyHoles(board, size, holes) {
  for (const [r, c] of holes || []) {
    if (inBounds(size, r, c)) board[r][c].o = OWNER.VOID;
  }
}

/** 统计归属为 o 的格子数。 */
export function countTerritory(board, o) {
  let n = 0;
  for (const row of board) for (const cell of row) if (cell.o === o) n += 1;
  return n;
}

/** 与 (r,c) 相邻且归属为 o 的格子数（感染力基数）。 */
export function countAdjacentOwned(board, size, r, c, o) {
  let n = 0;
  for (const [nr, nc] of neighbors(size, r, c)) {
    if (board[nr][nc].o === o) n += 1;
  }
  return n;
}

/** 是否为 side 的可攻击前沿（敌方/中立且与 side 相邻）。 */
export function isFrontier(board, size, r, c, side) {
  const cell = board[r][c];
  if (cell.o === side || cell.o === OWNER.VOID) return false;
  return countAdjacentOwned(board, size, r, c, side) > 0;
}

/** 列出 side 的全部前沿格 [r,c]。 */
export function listFrontier(board, size, side) {
  const out = [];
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (isFrontier(board, size, r, c, side)) out.push([r, c]);
    }
  }
  return out;
}

/**
 * 在 board 上原地解析一次感染（*mut）。
 * @param auraBonus 该格子来自营养滴的额外感染力（默认 0）。
 * @returns {{ captured:[r,c][], blocked:boolean, power:number, def:number, wasEnemy:boolean }}
 * 占领成功：目标变 side、def=1；并按剩余预算 BFS 连锁（光丝蔓延）。
 * 失败：目标若 def>0 则 def-1（削弱）。
 */
export function resolveInfect(board, size, r, c, side, auraBonus = 0) {
  const target = board[r][c];
  const wasEnemy = target.o === OWNER.ENEMY;
  const wasFortress = target.o === OWNER.NEUTRAL && target.d > 0;
  const power = countAdjacentOwned(board, size, r, c, side) + auraBonus;
  const cost = captureCost(target.d);
  const captured = [];

  if (power < cost) {
    if (target.d > 0) target.d -= 1;
    return { captured, blocked: true, power, def: target.d, wasEnemy };
  }

  let budget = power - cost;
  captured.push([r, c]);
  target.o = side;
  target.d = 1;

  const queue = [[r, c]];
  const seen = new Set([`${r},${c}`]);
  while (queue.length && budget > 0) {
    const [cr, cc] = queue.shift();
    for (const [nr, nc] of neighbors(size, cr, cc)) {
      const key = `${nr},${nc}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const cell = board[nr][nc];
      if (cell.o === side || cell.o === OWNER.VOID) continue;
      const ccost = captureCost(cell.d);
      if (budget >= ccost) {
        budget -= ccost;
        captured.push([nr, nc]);
        cell.o = side;
        cell.d = 1;
        queue.push([nr, nc]);
      }
    }
  }

  return { captured, blocked: false, power, def: 1, wasEnemy, wasFortress };
}

/** 噬菌体：清空以 (r,c) 为左上角的 2×2 区域内的敌方格 → 中立 def 0（*mut）。返回清除的格子。 */
export function resolvePhage(board, size, r, c, side, phSize = 2) {
  const cleared = [];
  for (let dr = 0; dr < phSize; dr += 1) {
    for (let dc = 0; dc < phSize; dc += 1) {
      const nr = r + dr;
      const nc = c + dc;
      if (!inBounds(size, nr, nc)) continue;
      const cell = board[nr][nc];
      if (cell.o === OWNER.ENEMY) {
        cell.o = OWNER.NEUTRAL;
        cell.d = 0;
        cleared.push([nr, nc]);
      }
    }
  }
  return cleared;
}

/** 营养滴：目标格 + 4 邻格 aura + bonus（*mut aura 二维数组）。 */
export function applyAura(aura, size, r, c, bonus) {
  const cells = [[r, c], ...neighbors(size, r, c)];
  for (const [ar, ac] of cells) {
    if (inBounds(size, ar, ac) && aura[ar][ac] != null) aura[ar][ac] += bonus;
  }
  return cells;
}

export function createAura(size) {
  const a = [];
  for (let r = 0; r < size; r += 1) {
    const row = [];
    for (let c = 0; c < size; c += 1) row.push(0);
    a.push(row);
  }
  return a;
}

/** 从 level 配置构建一皿棋盘（确定性：用传入 rng）。 */
export function buildBoard(level, rng) {
  const size = level.size;
  const board = createBoard(size);

  // 玩家起点：左下 2×2
  for (let r = size - 2; r < size; r += 1) {
    for (let c = 0; c < 2; c += 1) setCell(board, r, c, OWNER.PLAYER, 1);
  }
  // 敌方起点：右上 2×2
  for (let r = 0; r < 2; r += 1) {
    for (let c = size - 2; c < size; c += 1) setCell(board, r, c, OWNER.ENEMY, level.enemyStartDef || 1);
  }

  applyHoles(board, size, level.holes);

  // 中立堡垒：随机撒 fortressCount 个（避开起点角与空洞），def = fortressDef
  const fortressDef = level.fortressDef || 2;
  const fortresses = [];
  const attempts = (level.fortressCount || 0) * 40;
  let placed = 0;
  for (let i = 0; i < attempts && placed < (level.fortressCount || 0); i += 1) {
    const r = randInt(rng, 0, size - 1);
    const c = randInt(rng, 0, size - 1);
    if (board[r][c].o !== OWNER.NEUTRAL) continue;
    // 避开两个起始角（保持开局清晰）
    if (r < 2 && c >= size - 2) continue;
    if (r >= size - 2 && c < 2) continue;
    board[r][c].o = OWNER.NEUTRAL;
    board[r][c].d = fortressDef;
    fortresses.push([r, c]);
    placed += 1;
  }

  // 散菌（变异皿）：随机散 scatter 个中立格，轮流给双方
  const scatter = level.scatter || 0;
  let turn = 0;
  for (let i = 0; i < scatter * 40 && placedScatter(board) < scatter; i += 1) {
    const r = randInt(rng, 0, size - 1);
    const c = randInt(rng, 0, size - 1);
    if (board[r][c].o !== OWNER.NEUTRAL) continue;
    if (r < 2 && c >= size - 2) continue;
    if (r >= size - 2 && c < 2) continue;
    const side = (turn % 2 === 0) ? OWNER.PLAYER : OWNER.ENEMY;
    board[r][c].o = side;
    board[r][c].d = 1;
    turn += 1;
  }

  return board;
}

function placedScatter(board) {
  let n = 0;
  for (const row of board) {
    for (const cell of row) {
      if (cell.o === OWNER.PLAYER || cell.o === OWNER.ENEMY) n += 1;
    }
  }
  // 减去固定 8 个起点
  return Math.max(0, n - 8);
}
