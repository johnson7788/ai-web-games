// INK PATH · 通用求解器（纯逻辑，零依赖）
// 一次性覆盖三种机制的「可解性」验证与「最优路径」推算：
//   - nodes 模式：每个星子访问一次（哈密顿路径）
//   - edges 模式：每条丝线走一次（欧拉路径，可重走星子）
//   - 单向边（dir）+ 断线解锁（gate：访问触发星子后解锁）
// 供 config/levels.js 的校验、tests/levels.test.mjs、tools/selfplay.mjs 与 sim 使用。

import { LEVELS } from '../../config/levels.js';

// 归一化：nodes 带 id，edges 统一 {a,b,dir,gate}
export function normalizeLevel(level) {
  const nodes = level.nodes.map((n, i) => ({ id: i, x: n.x, y: n.y }));
  const edges = level.edges.map((e) => {
    if (Array.isArray(e)) return { a: e[0], b: e[1], dir: 0, gate: -1 };
    return { a: e.a, b: e.b, dir: e.dir || 0, gate: e.gate ?? -1 };
  });
  return { ...level, nodes, edges };
}

// 从节点 u 出发，按当前掩码列出合法下一步 [{edgeIdx, next}]
export function availableMoves(L, u, mask) {
  const { visitedMask, traversedMask, enteredMask } = mask;
  const mode = L.mode;
  const out = [];
  for (let i = 0; i < L.edges.length; i += 1) {
    const e = L.edges[i];
    let next = -1;
    if (e.a === u && (e.dir === 0 || e.dir === 1)) next = e.b;
    else if (e.b === u && (e.dir === 0 || e.dir === 2)) next = e.a;
    if (next === -1) continue;
    if (mode === 'edges') {
      if (traversedMask & (1 << i)) continue;
    } else if (visitedMask & (1 << next)) {
      continue;
    }
    const gateMask = mode === 'nodes' ? visitedMask : enteredMask;
    if (e.gate >= 0 && !((gateMask >> e.gate) & 1)) continue;
    out.push({ edgeIdx: i, next });
  }
  return out;
}

// 求解：返回星子 id 序列（含 start）或 null
export function solve(level) {
  const L = normalizeLevel(level);
  const n = L.nodes.length;
  const m = L.edges.length;
  const allNodes = (1 << n) - 1;
  const allEdges = (1 << m) - 1;
  const start = L.start;
  const seen = new Set();

  function dfs(cur, visitedMask, traversedMask, enteredMask, path) {
    if ((L.mode === 'nodes' ? visitedMask === allNodes : traversedMask === allEdges)) {
      return path.slice();
    }
    const key = `${cur}|${visitedMask}|${traversedMask}|${enteredMask}`;
    if (seen.has(key)) return null;
    seen.add(key);
    const opts = availableMoves(L, cur, { visitedMask, traversedMask, enteredMask });
    for (const { edgeIdx, next } of opts) {
      path.push(next);
      const res = dfs(
        next,
        visitedMask | (1 << next),
        traversedMask | (1 << edgeIdx),
        enteredMask | (1 << next),
        path,
      );
      if (res) return res;
      path.pop();
    }
    return null;
  }

  return dfs(start, 1 << start, 0, 1 << start, [start]);
}

export function hasSolution(level) {
  return solve(level) !== null;
}

export function par(level) {
  const p = solve(level);
  if (p) return p.length - 1;
  const L = normalizeLevel(level);
  return L.mode === 'nodes' ? level.nodes.length - 1 : level.edges.length;
}

export function allSolvable(levels = LEVELS) {
  const bad = [];
  for (const lv of levels) {
    if (!solve(lv)) bad.push(lv.index);
  }
  return bad;
}
