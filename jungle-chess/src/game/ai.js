// 斗兽棋 AI —— 纯逻辑 minimax（alpha-beta）+ 简单评估（子力 + 位置表）。
// 目标（goal）：{ type: 'den' }（完整对局，占穴即胜）或 { type: 'piece', animal: rank }（谜题，吃关键子即胜）。
// 深度档位：随班=1 / 学长=2 / 长老=3 / 长老的秘密=4。
import {
  N, DEN, pieceSide, pieceRank, rOf, cOf, RAT,
  genMoves, applyMove, anyPiece, isWater, trapsOf,
} from './rules.js';

export const WIN_SCORE = 100000;

const MATERIAL = [1, 2, 3, 4, 5, 6, 7, 8]; // rat..elephant

// 对方某 rank 是否还有子在场（关键子是否被吃）
export function hasKeyPiece(board, side, animal) {
  for (let i = 0; i < N; i += 1) {
    const v = board[i];
    if (v !== 0 && pieceSide(v) === side && pieceRank(v) === animal) return true;
  }
  return false;
}

// side 是否已达成目标
export function goalWin(board, side, goal) {
  const enemy = 1 - side;
  // 占穴：敌穴上是我方子
  const d = DEN[enemy];
  if (board[d] !== 0 && pieceSide(board[d]) === side) return true;
  if (goal && goal.type === 'piece') {
    if (!hasKeyPiece(board, enemy, goal.animal)) return true;
  }
  return false;
}

function dist(i, j) {
  return Math.abs(rOf(i) - rOf(j)) + Math.abs(cOf(i) - cOf(j));
}

// 从 side 视角的静态评估（未终局时）
export function evaluate(board, side, goal) {
  const enemy = 1 - side;
  const enemyDen = DEN[enemy];

  let score = 0;
  for (let i = 0; i < N; i += 1) {
    const v = board[i];
    if (v === 0) continue;
    const rank = pieceRank(v);
    const s = pieceSide(v);
    const base = MATERIAL[rank];
    if (s === side) {
      score += base;
      // 靠近敌穴有分（鼓励进攻）
      score += Math.max(0, (14 - dist(i, enemyDen))) * 0.08;
      // 我的子踩进敌方陷阱很危险（敌可任意吃）
      if (isTrapOf(i, enemy)) score -= 1.2;
      // 鼠控河有分
      if (rank === RAT && isWater(i)) score += 0.5;
      // 紧邻敌穴施加压力
      if (dist(i, enemyDen) === 1) score += 0.8;
    } else {
      score -= base;
      // 敌子踩进我的陷阱是送分
      if (isTrapOf(i, side)) score += 1.5;
      if (rank === RAT && isWater(i)) score -= 0.35;
    }
  }
  return score;
}

function isTrapOf(i, side) {
  return trapsOf(side).has(i);
}

// 走法排序：先占穴/吃子（按吃子价值降序），提高剪枝效率
function moveScore(board, m) {
  const to = board[m.to];
  if (m.outcome === null && to === 0) return 0; // 普通移动
  if (m.outcome === 'mutual') return 5 + (to !== 0 ? pieceRank(to) : 0);
  return 20 + (to !== 0 ? pieceRank(to) + 1 : 0); // capture（含占穴）
}

function orderMoves(board, moves) {
  for (const m of moves) m._s = moveScore(board, m);
  moves.sort((a, b) => b._s - a._s);
}

function search(board, side, depth, alpha, beta, goal, me) {
  // 终局判定
  if (goalWin(board, me, goal)) return WIN_SCORE + depth;
  if (goalWin(board, 1 - me, goal)) return -WIN_SCORE - depth;
  if (!anyPiece(board, me)) return -WIN_SCORE - depth;
  if (!anyPiece(board, 1 - me)) return WIN_SCORE + depth;
  if (depth <= 0) return evaluate(board, me, goal);

  const moves = genMoves(board, side);
  if (moves.length === 0) {
    return side === me ? -WIN_SCORE - depth : WIN_SCORE + depth;
  }
  orderMoves(board, moves);

  if (side === me) {
    let best = -Infinity;
    for (const m of moves) {
      const { board: nb } = applyMove(board, m.from, m.to);
      const s = search(nb, 1 - side, depth - 1, alpha, beta, goal, me);
      if (s > best) best = s;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }
  let best = Infinity;
  for (const m of moves) {
    const { board: nb } = applyMove(board, m.from, m.to);
    const s = search(nb, 1 - side, depth - 1, alpha, beta, goal, me);
    if (s < best) best = s;
    if (best < beta) beta = best;
    if (alpha >= beta) break;
  }
  return best;
}

// 求 side 的最优走法。返回 { from, to, score } 或 null（无子/无走法）。
export function bestMove(board, side, depth, goal = { type: 'den' }) {
  const moves = genMoves(board, side);
  if (moves.length === 0) return null;
  orderMoves(board, moves);
  let best = null;
  let bestScore = -Infinity;
  const alpha = -Infinity;
  const beta = Infinity;
  for (const m of moves) {
    const { board: nb } = applyMove(board, m.from, m.to);
    const s = search(nb, 1 - side, depth - 1, alpha, beta, goal, side);
    if (s > bestScore) {
      bestScore = s;
      best = m;
    }
  }
  return { from: best.from, to: best.to, score: bestScore };
}

// 供测试 / solver：是否存在一步内（含）的必胜（score ≥ WIN_SCORE/2）
export function hasForcedWin(board, side, depth, goal = { type: 'den' }) {
  const m = bestMove(board, side, depth, goal);
  return m ? m.score >= WIN_SCORE - 10 : false;
}

export { MATERIAL };
