// 纯逻辑国际象棋引擎：完整棋规（王车易位/吃过路兵/升变）+ 将杀/逼和 + negamax AI。
// 不碰 DOM / window / localStorage / Date.now。
import { PIECE_VALUE } from '../../config/game.config.js';

const N = 8;
const inside = (r, c) => r >= 0 && r < N && c >= 0 && c < N;
const other = (color) => (color === 'w' ? 'b' : 'w');

export function initialState() {
  const board = Array.from({ length: N }, () => Array(N).fill(null));
  const back = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
  for (let c = 0; c < N; c += 1) {
    board[0][c] = { type: back[c], color: 'b' };
    board[1][c] = { type: 'p', color: 'b' };
    board[6][c] = { type: 'p', color: 'w' };
    board[7][c] = { type: back[c], color: 'w' };
  }
  return {
    board,
    turn: 'w',
    castling: { wK: true, wQ: true, bK: true, bQ: true },
    ep: null,
    halfmove: 0,
    fullmove: 1,
  };
}

export function cloneState(s) {
  return {
    board: s.board.map((row) => row.map((p) => (p ? { ...p } : null))),
    turn: s.turn,
    castling: { ...s.castling },
    ep: s.ep ? { ...s.ep } : null,
    halfmove: s.halfmove,
    fullmove: s.fullmove,
  };
}

export function findKing(board, color) {
  for (let r = 0; r < N; r += 1) {
    for (let c = 0; c < N; c += 1) {
      const p = board[r][c];
      if (p && p.type === 'k' && p.color === color) return { r, c };
    }
  }
  return null;
}

const KNIGHT = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const KING = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const ORTH = [[-1, 0], [1, 0], [0, -1], [0, 1]];

export function isAttacked(board, r, c, by) {
  // 兵
  const pr = by === 'w' ? r + 1 : r - 1;
  for (const dc of [-1, 1]) {
    if (inside(pr, c + dc)) {
      const p = board[pr][c + dc];
      if (p && p.color === by && p.type === 'p') return true;
    }
  }
  // 马
  for (const [dr, dc] of KNIGHT) {
    if (inside(r + dr, c + dc)) {
      const p = board[r + dr][c + dc];
      if (p && p.color === by && p.type === 'n') return true;
    }
  }
  // 王
  for (const [dr, dc] of KING) {
    if (inside(r + dr, c + dc)) {
      const p = board[r + dr][c + dc];
      if (p && p.color === by && p.type === 'k') return true;
    }
  }
  // 斜线（象/后）
  for (const [dr, dc] of DIAG) {
    let rr = r + dr;
    let cc = c + dc;
    while (inside(rr, cc)) {
      const p = board[rr][cc];
      if (p) {
        if (p.color === by && (p.type === 'b' || p.type === 'q')) return true;
        break;
      }
      rr += dr; cc += dc;
    }
  }
  // 直线（车/后）
  for (const [dr, dc] of ORTH) {
    let rr = r + dr;
    let cc = c + dc;
    while (inside(rr, cc)) {
      const p = board[rr][cc];
      if (p) {
        if (p.color === by && (p.type === 'r' || p.type === 'q')) return true;
        break;
      }
      rr += dr; cc += dc;
    }
  }
  return false;
}

export function isInCheck(state, color) {
  const k = findKing(state.board, color);
  if (!k) return false;
  return isAttacked(state.board, k.r, k.c, other(color));
}

function slideMoves(state, r, c, dirs, moves) {
  const p = state.board[r][c];
  for (const [dr, dc] of dirs) {
    let rr = r + dr;
    let cc = c + dc;
    while (inside(rr, cc)) {
      const t = state.board[rr][cc];
      if (!t) {
        moves.push({ from: { r, c }, to: { r: rr, c: cc }, piece: p.type });
      } else {
        if (t.color !== p.color) moves.push({ from: { r, c }, to: { r: rr, c: cc }, piece: p.type, capture: true });
        break;
      }
      rr += dr; cc += dc;
    }
  }
}

export function pseudoMoves(state, color) {
  const moves = [];
  const b = state.board;
  for (let r = 0; r < N; r += 1) {
    for (let c = 0; c < N; c += 1) {
      const p = b[r][c];
      if (!p || p.color !== color) continue;
      if (p.type === 'p') {
        const dir = color === 'w' ? -1 : 1;
        const startRow = color === 'w' ? 6 : 1;
        const promoRow = color === 'w' ? 0 : 7;
        // 前进
        if (inside(r + dir, c) && !b[r + dir][c]) {
          if (r + dir === promoRow) moves.push({ from: { r, c }, to: { r: r + dir, c }, piece: 'p', promotion: true, promo: 'q' });
          else moves.push({ from: { r, c }, to: { r: r + dir, c }, piece: 'p' });
          if (r === startRow && !b[r + 2 * dir][c]) {
            moves.push({ from: { r, c }, to: { r: r + 2 * dir, c }, piece: 'p', double: true });
          }
        }
        // 吃子 + 过路兵
        for (const dc of [-1, 1]) {
          const rr = r + dir;
          const cc = c + dc;
          if (!inside(rr, cc)) continue;
          const t = b[rr][cc];
          if (t && t.color !== color) {
            if (rr === promoRow) moves.push({ from: { r, c }, to: { r: rr, c: cc }, piece: 'p', capture: true, promotion: true, promo: 'q' });
            else moves.push({ from: { r, c }, to: { r: rr, c: cc }, piece: 'p', capture: true });
          } else if (state.ep && state.ep.r === rr && state.ep.c === cc) {
            moves.push({ from: { r, c }, to: { r: rr, c: cc }, piece: 'p', capture: true, ep: true });
          }
        }
      } else if (p.type === 'n') {
        for (const [dr, dc] of KNIGHT) {
          const rr = r + dr;
          const cc = c + dc;
          if (!inside(rr, cc)) continue;
          const t = b[rr][cc];
          if (!t) moves.push({ from: { r, c }, to: { r: rr, c: cc }, piece: 'n' });
          else if (t.color !== color) moves.push({ from: { r, c }, to: { r: rr, c: cc }, piece: 'n', capture: true });
        }
      } else if (p.type === 'b') {
        slideMoves(state, r, c, DIAG, moves);
      } else if (p.type === 'r') {
        slideMoves(state, r, c, ORTH, moves);
      } else if (p.type === 'q') {
        slideMoves(state, r, c, [...DIAG, ...ORTH], moves);
      } else if (p.type === 'k') {
        for (const [dr, dc] of KING) {
          const rr = r + dr;
          const cc = c + dc;
          if (!inside(rr, cc)) continue;
          const t = b[rr][cc];
          if (!t) moves.push({ from: { r, c }, to: { r: rr, c: cc }, piece: 'k' });
          else if (t.color !== color) moves.push({ from: { r, c }, to: { r: rr, c: cc }, piece: 'k', capture: true });
        }
        // 王车易位
        const home = color === 'w' ? 7 : 0;
        if (r === home && c === 4 && !isAttacked(b, home, 4, other(color))) {
          const kSide = color === 'w' ? state.castling.wK : state.castling.bK;
          const qSide = color === 'w' ? state.castling.wQ : state.castling.bQ;
          if (kSide && !b[home][5] && !b[home][6]
            && b[home][7] && b[home][7].type === 'r' && b[home][7].color === color
            && !isAttacked(b, home, 5, other(color)) && !isAttacked(b, home, 6, other(color))) {
            moves.push({ from: { r, c }, to: { r: home, c: 6 }, piece: 'k', castle: 'K' });
          }
          if (qSide && !b[home][3] && !b[home][2] && !b[home][1]
            && b[home][0] && b[home][0].type === 'r' && b[home][0].color === color
            && !isAttacked(b, home, 3, other(color)) && !isAttacked(b, home, 2, other(color))) {
            moves.push({ from: { r, c }, to: { r: home, c: 2 }, piece: 'k', castle: 'Q' });
          }
        }
      }
    }
  }
  return moves;
}

export function applyMove(state, move) {
  const s = cloneState(state);
  const b = s.board;
  const p = b[move.from.r][move.from.c];
  const color = p.color;
  // 移动
  b[move.to.r][move.to.c] = p;
  b[move.from.r][move.from.c] = null;
  // 过路兵：移除被吃的兵
  if (move.ep) {
    const capRow = color === 'w' ? move.to.r + 1 : move.to.r - 1;
    b[capRow][move.to.c] = null;
  }
  // 易位：移动车
  if (move.castle) {
    const home = color === 'w' ? 7 : 0;
    if (move.castle === 'K') { b[home][5] = b[home][7]; b[home][7] = null; }
    else { b[home][3] = b[home][0]; b[home][0] = null; }
  }
  // 升变
  if (move.promotion) {
    b[move.to.r][move.to.c] = { type: move.promo || 'q', color };
  }
  // 易位权利
  if (p.type === 'k') {
    if (color === 'w') { s.castling.wK = false; s.castling.wQ = false; }
    else { s.castling.bK = false; s.castling.bQ = false; }
  }
  const affect = (r, c) => {
    if (r === 7 && c === 0) s.castling.wQ = false;
    if (r === 7 && c === 7) s.castling.wK = false;
    if (r === 0 && c === 0) s.castling.bQ = false;
    if (r === 0 && c === 7) s.castling.bK = false;
  };
  affect(move.from.r, move.from.c);
  affect(move.to.r, move.to.c);
  // 过路兵目标格
  s.ep = move.double ? { r: (move.from.r + move.to.r) / 2, c: move.from.c } : null;
  // 半步/全步
  s.halfmove = (p.type === 'p' || move.capture) ? 0 : s.halfmove + 1;
  if (color === 'b') s.fullmove += 1;
  s.turn = other(color);
  return s;
}

export function legalMoves(state, color = state.turn) {
  const out = [];
  for (const m of pseudoMoves(state, color)) {
    const next = applyMove(state, m);
    if (!isInCheck(next, color)) out.push(m);
  }
  return out;
}

export function gameStatus(state) {
  const moves = legalMoves(state, state.turn);
  if (moves.length === 0) {
    return isInCheck(state, state.turn) ? 'checkmate' : 'stalemate';
  }
  if (state.halfmove >= 100) return 'draw';
  return 'playing';
}

// ---- AI（negamax + alpha-beta）----
const PAWN_PST = [
  [0, 0, 0, 0, 0, 0, 0, 0],
  [50, 50, 50, 50, 50, 50, 50, 50],
  [10, 10, 20, 30, 30, 20, 10, 10],
  [5, 5, 10, 25, 25, 10, 5, 5],
  [0, 0, 0, 20, 20, 0, 0, 0],
  [5, -5, -10, 0, 0, -10, -5, 5],
  [5, 10, 10, -20, -20, 10, 10, 5],
  [0, 0, 0, 0, 0, 0, 0, 0],
];
const KNIGHT_PST = [
  [-50, -40, -30, -30, -30, -30, -40, -50],
  [-40, -20, 0, 0, 0, 0, -20, -40],
  [-30, 0, 10, 15, 15, 10, 0, -30],
  [-30, 5, 15, 20, 20, 15, 5, -30],
  [-30, 0, 15, 20, 20, 15, 0, -30],
  [-30, 5, 10, 15, 15, 10, 5, -30],
  [-40, -20, 0, 5, 5, 0, -20, -40],
  [-50, -40, -30, -30, -30, -30, -40, -50],
];

function pst(type, color, r, c) {
  const rr = color === 'w' ? r : 7 - r;
  if (type === 'p') return PAWN_PST[rr][c];
  if (type === 'n') return KNIGHT_PST[rr][c];
  return 0;
}

export function evaluate(state) {
  let score = 0;
  for (let r = 0; r < N; r += 1) {
    for (let c = 0; c < N; c += 1) {
      const p = state.board[r][c];
      if (!p) continue;
      const v = PIECE_VALUE[p.type] + pst(p.type, p.color, r, c);
      score += p.color === 'w' ? v : -v;
    }
  }
  return score;
}

const MATE = 1000000;

function negamax(state, depth, alpha, beta) {
  const status = gameStatus(state);
  if (status === 'checkmate') return -MATE - depth;
  if (status === 'stalemate' || status === 'draw') return 0;
  if (depth === 0) return evaluate(state) * (state.turn === 'w' ? 1 : -1);
  let best = -Infinity;
  for (const m of legalMoves(state, state.turn)) {
    const score = -negamax(applyMove(state, m), depth - 1, -beta, -alpha);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

export function aiBestMove(state, depth = 3, rng = Math.random) {
  const moves = legalMoves(state, state.turn);
  if (moves.length === 0) return null;
  let best = -Infinity;
  let bestMoves = [];
  for (const m of moves) {
    const score = -negamax(applyMove(state, m), depth - 1, -Infinity, Infinity);
    if (score > best) { best = score; bestMoves = [m]; }
    else if (score === best) bestMoves.push(m);
  }
  return bestMoves[Math.floor(rng() * bestMoves.length)];
}