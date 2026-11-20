// CARD ROYALE · 求解器（纯逻辑，零 DOM）
// 输入：run.snapshot() 产物 { board, stock, waste, redeals }。
// 输出：能清空牌阵的移动序列（[{t:'play',id}|{t:'draw'}|{t:'redeal'}|{t:'thaw',id}]），无解返回 null。
// 策略：DFS + 记忆化 + 移动排序（出牌优先、按露头收益排序）。节点上限防爆炸。
import { rankAdjacent } from './sim.js';

const COVER_DC = [-1, 0];

export function uncoveredIds(board) {
  const set = new Set();
  for (const c of board) {
    const covered = board.some((o) => o.r === c.r + 1 && (o.c === c.c - 1 || o.c === c.c));
    if (!covered) set.add(c.id);
  }
  return set;
}

function activeWaste(waste) {
  return waste[waste.length - 1];
}

function playable(board, waste) {
  const uncovered = uncoveredIds(board);
  const active = activeWaste(waste);
  return board.filter((c) =>
    uncovered.has(c.id) && (!c.frozen || c.thawed) && (active.wild || rankAdjacent(c.rank, active.rank)));
}

function thawable(board, waste) {
  const uncovered = uncoveredIds(board);
  const active = activeWaste(waste);
  return board.filter((c) =>
    uncovered.has(c.id) && c.frozen && !c.thawed && (active.wild || rankAdjacent(c.rank, active.rank)));
}

// 出牌后新露头的牌数（移动排序启发式）
function uncoverGain(board, card) {
  const rest = board.filter((c) => c.id !== card.id);
  const before = uncoveredIds(board);
  const after = uncoveredIds(rest);
  let gain = 0;
  for (const id of after) if (!before.has(id)) gain += 1;
  return gain;
}

function applyMove(snap, mv) {
  const s = {
    board: snap.board.map((c) => ({ ...c })),
    stock: snap.stock.map((c) => ({ ...c })),
    waste: snap.waste.map((c) => ({ ...c })),
    redeals: snap.redeals,
  };
  if (mv.t === 'play') {
    const card = s.board.find((c) => c.id === mv.id);
    s.board = s.board.filter((c) => c.id !== mv.id);
    s.waste.push(card);
  } else if (mv.t === 'draw') {
    s.waste.push(s.stock.pop());
  } else if (mv.t === 'redeal') {
    const top = s.waste[s.waste.length - 1];
    const rest = s.waste.slice(0, -1);
    for (const c of rest) s.stock.push(c);
    s.waste = [top];
    s.redeals -= 1;
  } else if (mv.t === 'thaw') {
    const card = s.board.find((c) => c.id === mv.id);
    card.thawed = true;
  }
  return s;
}

function enumerateMoves(snap) {
  const moves = [];
  const plays = playable(snap.board, snap.waste);
  plays.sort((a, b) => {
    const g = uncoverGain(snap.board, b) - uncoverGain(snap.board, a);
    if (g !== 0) return g;
    return b.r - a.r; // 越靠上层越优先（先挖顶）
  });
  for (const c of plays) moves.push({ t: 'play', id: c.id });
  for (const c of thawable(snap.board, snap.waste)) moves.push({ t: 'thaw', id: c.id });
  if (snap.stock.length > 0) moves.push({ t: 'draw' });
  else if (snap.waste.length > 1 && snap.redeals > 0) moves.push({ t: 'redeal' });
  return moves;
}

function stateKey(snap) {
  const boardKey = snap.board
    .map((c) => `${c.id}@${c.r}:${c.c}:${c.thawed ? 1 : 0}`)
    .sort()
    .join(',');
  const active = activeWaste(snap.waste);
  const activeKey = active ? `${active.id}:${active.wild ? 1 : 0}` : 'none';
  const stockKey = snap.stock.map((c) => c.id).join(',');
  return `${boardKey}|${activeKey}|${snap.redeals}|${stockKey}`;
}

/**
 * 查找清场移动序列。返回移动数组或 null。
 */
export function findWin(snapshot, maxNodes = 300000) {
  const root = {
    board: snapshot.board.map((c) => ({ ...c })),
    stock: snapshot.stock.map((c) => ({ ...c })),
    waste: snapshot.waste.map((c) => ({ ...c })),
    redeals: snapshot.redeals,
  };
  const memo = new Set();
  let nodes = 0;

  function dfs(snap, path) {
    nodes += 1;
    if (nodes > maxNodes) return null;
    if (snap.board.length === 0) return path;
    const key = stateKey(snap);
    if (memo.has(key)) return null;
    const moves = enumerateMoves(snap);
    if (moves.length === 0) {
      memo.add(key);
      return null;
    }
    for (const mv of moves) {
      const next = applyMove(snap, mv);
      const res = dfs(next, path.concat(mv));
      if (res) return res;
    }
    memo.add(key);
    return null;
  }

  return dfs(root, []);
}

/**
 * 快速解数统计：findWin 是否找到解（布尔）。
 */
export function isSolvable(snapshot, maxNodes = 300000) {
  return findWin(snapshot, maxNodes) !== null;
}
