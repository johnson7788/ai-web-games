// TILE TRIAD · 棋盘生成器 + 回溯求解器（纯逻辑，零 DOM）
// 生成器用「逆向发牌」构造每关必然存在不依赖道具的解：
//   1) 货品按三张一组打乱成解序列（solution，按组 = 三同）；
//   2) 从序列末尾向开头发牌（后消除的沉底，先消除的浮顶），
//      于是任一牌堆从顶到底的解索引严格递增 → 按 solution 顺序拾取必然清空。
// 求解器 solveBoard() 是独立的回溯 DFS（memo + 「能消必消」剪枝），用于单测二次证明。
// 校验器 validateSolution() 线性验证生成器内置解的有效性。

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

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// 把 count 个深度槽均匀分给 indices 列表（每堆 ≤ maxA）
function fillEven(depths, indices, count, maxA) {
  if (!indices.length || count <= 0) return;
  for (let k = 0; k < count; k += 1) {
    let best = indices[0];
    for (const i of indices) {
      if (depths[i] < maxA && depths[i] < depths[best]) best = i;
    }
    if (depths[best] >= maxA) best = indices[k % indices.length];
    depths[best] += 1;
  }
}

// ------------------------------------------------------------------ 生成器
export function generateBoard(level, seed = 1) {
  const rng = mulberry32(seed >>> 0);
  const S = level.cols * level.rows;
  const T = level.totalTiles;
  const K = level.types;
  const feat = level.feature || 'basic';

  // 1) 品类计数：每类至少 3，剩余按 3 的倍数随机加
  const typeCounts = new Array(K).fill(3);
  let extra = T - 3 * K;
  while (extra > 0) {
    const t = Math.floor(rng() * K);
    typeCounts[t] += 3;
    extra -= 3;
  }

  // 2) 解序列：三张一组，组序打乱
  const groups = [];
  for (let t = 0; t < K; t += 1) {
    const n = typeCounts[t] / 3;
    for (let g = 0; g < n; g += 1) groups.push([t, t, t]);
  }
  shuffle(groups, rng);
  const solution = groups.flat(); // 长度 T，solution[i] = 第 i 次拾取的品类

  // 3) 牌堆
  const stacks = [];
  for (let s = 0; s < S; s += 1) {
    stacks.push({ id: s, col: s % level.cols, row: Math.floor(s / level.cols), tiles: [] });
  }

  // 压顶大层：顶部 S 张牌 = 每堆 1 张「顶盖」
  const capTop = (feat === 'cap' || feat === 'final') ? S : 0;
  const baseTotal = T - capTop;
  const maxA = capTop ? Math.max(1, level.layers - 1) : level.layers;

  const baseDepth = new Array(S).fill(0);
  if (feat === 'twin') {
    const half = Math.floor(S / 2);
    const left = Math.floor(baseTotal / 2);
    const lIds = []; const rIds = [];
    for (let s = 0; s < S; s += 1) (s < half ? lIds : rIds).push(s);
    fillEven(baseDepth, lIds, left, maxA);
    fillEven(baseDepth, rIds, baseTotal - left, maxA);
  } else if (feat === 'lock') {
    // 侧翼深堆（锚点）+ 中部浅堆
    const wingIds = [];
    const midIds = [];
    const wingCols = Math.max(1, Math.floor(level.cols * 0.25));
    for (let s = 0; s < S; s += 1) {
      const col = s % level.cols;
      if (col < wingCols || col >= level.cols - wingCols) wingIds.push(s);
      else midIds.push(s);
    }
    if (!midIds.length) { for (const s of wingIds.splice(Math.floor(wingIds.length / 2))) midIds.push(s); }
    const wingShare = Math.min(baseTotal, Math.floor(baseTotal * 0.65));
    fillEven(baseDepth, wingIds, wingShare, maxA);
    fillEven(baseDepth, midIds, baseTotal - wingShare, maxA);
  } else {
    const all = [];
    for (let s = 0; s < S; s += 1) all.push(s);
    fillEven(baseDepth, all, baseTotal, maxA);
  }

  const solStack = new Array(T);
  const capPlaced = new Array(S).fill(false);

  const baseRoom = () => {
    const out = [];
    for (let s = 0; s < S; s += 1) if (stacks[s].tiles.length < baseDepth[s]) out.push(s);
    return out;
  };
  const capRoom = () => {
    const out = [];
    for (let s = 0; s < S; s += 1) if (stacks[s].tiles.length === baseDepth[s] && !capPlaced[s]) out.push(s);
    return out;
  };
  const pickDistinct = (pool, n) => {
    // 从 pool 里取 n 项，尽量不同；pool 不足时循环补位（逆向发牌对堆选择无约束，仍可解）
    const c = pool.slice();
    shuffle(c, rng);
    if (c.length >= n) return c.slice(0, n);
    const out = c.slice();
    while (out.length < n) out.push(c[out.length % c.length]);
    return out;
  };

  const G = T / 3;
  for (let g = G - 1; g >= 0; g -= 1) {
    const idxs = [3 * g, 3 * g + 1, 3 * g + 2];
    const baseIdxs = idxs.filter((i) => i >= capTop);
    const capIdxs = idxs.filter((i) => i < capTop);

    if (baseIdxs.length) {
      const pool = baseRoom();
      const chosen = pickDistinct(pool, baseIdxs.length);
      for (let k = 0; k < baseIdxs.length; k += 1) {
        const st = stacks[chosen[k]];
        const idx = baseIdxs[k];
        st.tiles.push({ id: idx, type: solution[idx], lockAnchor: null });
        solStack[idx] = st.id;
      }
    }
    for (const idx of capIdxs) {
      const pool = capRoom();
      const st = stacks[pool[0]];
      capPlaced[st.id] = true;
      st.tiles.push({ id: idx, type: solution[idx], lockAnchor: null });
      solStack[idx] = st.id;
    }
  }

  // 4) 假锁层：锁定部分顶牌，锚点=某个已清空的侧翼堆（解索引严格小于被锁牌）
  if (feat === 'lock') {
    const maxId = stacks.map((s) => (s.tiles.length ? Math.max(...s.tiles.map((t) => t.id)) : -1));
    for (let s = 0; s < S; s += 1) {
      const st = stacks[s];
      if (!st.tiles.length) continue;
      const top = st.tiles[st.tiles.length - 1];
      if (rng() >= 0.35) continue;
      const anchors = [];
      for (let a = 0; a < S; a += 1) {
        if (a !== s && stacks[a].tiles.length && maxId[a] < top.id) anchors.push(a);
      }
      if (anchors.length) top.lockAnchor = anchors[Math.floor(rng() * anchors.length)];
    }
  }

  return { stacks, solution: solStack, totalTiles: T, types: K };
}

// ------------------------------------------------------------------ 判定
export function tileIsFree(stacks, stackId) {
  const st = stacks[stackId];
  if (!st || !st.tiles.length) return false;
  const top = st.tiles[st.tiles.length - 1];
  if (top.lockAnchor == null) return true;
  return stacks[top.lockAnchor] && stacks[top.lockAnchor].tiles.length === 0;
}

export function freeStackIds(stacks) {
  const out = [];
  for (let s = 0; s < stacks.length; s += 1) if (tileIsFree(stacks, s)) out.push(s);
  return out;
}

// ------------------------------------------------------------------ 线性校验
export function validateSolution(stacks, solution, slotCap) {
  const remaining = stacks.map((s) => s.tiles.length);
  let slot = [];
  for (const s of solution) {
    if (remaining[s] <= 0) return false;
    const tile = stacks[s].tiles[remaining[s] - 1];
    if (tile.lockAnchor != null && remaining[tile.lockAnchor] > 0) return false;
    remaining[s] -= 1;
    slot.push(tile.type);
    const cnt = slot.filter((x) => x === tile.type).length;
    if (cnt >= GAME.TRIPLE_CLEAR) {
      let rm = 0; const ns = [];
      for (const x of slot) { if (x === tile.type && rm < GAME.TRIPLE_CLEAR) rm += 1; else ns.push(x); }
      slot = ns;
    }
    if (slot.length >= slotCap) return false;
  }
  return remaining.every((r) => r === 0) && slot.length === 0;
}

// ------------------------------------------------------------------ 回溯求解
export function solveBoard(stacks, slotCap, budget = 500000) {
  const S = stacks.length;
  const type = stacks.map((s) => s.tiles.map((t) => t.type));
  const lock = stacks.map((s) => s.tiles.map((t) => t.lockAnchor));
  const memo = new Set();
  let nodes = 0;

  const isFree = (tops, s) => {
    if (tops[s] < 0) return false;
    const la = lock[s][tops[s]];
    return la == null || tops[la] < 0;
  };
  const key = (tops, slot) => tops.join(',') + '|' + slot.slice().sort((a, b) => a - b).join(',');

  function solve(tops, slot, moves) {
    nodes += 1;
    if (nodes > budget) return null;
    if (tops.every((p) => p < 0)) return moves;
    if (slot.length >= slotCap) return null;

    const free = [];
    for (let s = 0; s < S; s += 1) if (isFree(tops, s)) free.push(s);
    if (!free.length) return null;

    const k = key(tops, slot);
    if (memo.has(k)) return null;
    memo.add(k);

    // 能消必消：有可凑成三张的牌时，只考虑这些分支
    const completing = free.filter((s) => {
      const t = type[s][tops[s]];
      return slot.filter((x) => x === t).length === GAME.TRIPLE_CLEAR - 1;
    });
    const candidates = completing.length ? completing : free;

    // 排序：槽内已有多张的品类优先；其次品类在剩余自由牌里出现次数多
    const freeCount = new Map();
    for (const s of free) {
      const t = type[s][tops[s]];
      freeCount.set(t, (freeCount.get(t) || 0) + 1);
    }
    candidates.sort((a, b) => {
      const ta = type[a][tops[a]];
      const tb = type[b][tops[b]];
      const ca = slot.filter((x) => x === ta).length;
      const cb = slot.filter((x) => x === tb).length;
      if (ca !== cb) return cb - ca;
      if ((freeCount.get(ta) || 0) !== (freeCount.get(tb) || 0)) return (freeCount.get(tb) || 0) - (freeCount.get(ta) || 0);
      return a - b;
    });

    for (const s of candidates) {
      const t = type[s][tops[s]];
      const nt = tops.slice();
      nt[s] -= 1;
      let ns = slot.concat(t);
      const cnt = ns.filter((x) => x === t).length;
      if (cnt >= GAME.TRIPLE_CLEAR) {
        let rm = 0; const out = [];
        for (const x of ns) { if (x === t && rm < GAME.TRIPLE_CLEAR) rm += 1; else out.push(x); }
        ns = out;
      }
      if (ns.length >= slotCap) continue;
      const res = solve(nt, ns, moves.concat(s));
      if (res) return res;
    }
    return null;
  }

  const tops = stacks.map((s) => s.tiles.length - 1);
  const moves = solve(tops, [], []);
  return moves ? { solvable: true, moves } : { solvable: false, moves: [], nodes };
}
