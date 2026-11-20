// src/game/euler.js — 欧拉路径纯逻辑（零依赖，node 可直接测）
// 提供：度数计算、连通分量、欧拉路径存在性判定、Hierholzer 求解。

export function edgeKey(a, b) {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

/** 无向图度数（并行边每一条都算）。 */
export function degrees(nodeCount, edges) {
  const deg = new Array(nodeCount).fill(0);
  for (const [a, b] of edges) {
    deg[a] += 1;
    deg[b] += 1;
  }
  return deg;
}

/** 返回每个节点的连通分量 id（忽略孤立点；BFS）。 */
export function components(nodeCount, edges) {
  const adj = Array.from({ length: nodeCount }, () => []);
  for (const [a, b] of edges) {
    adj[a].push(b);
    adj[b].push(a);
  }
  const comp = new Array(nodeCount).fill(-1);
  let cid = 0;
  for (let s = 0; s < nodeCount; s += 1) {
    if (comp[s] !== -1 || adj[s].length === 0) continue;
    const stack = [s];
    comp[s] = cid;
    while (stack.length) {
      const v = stack.pop();
      for (const w of adj[v]) {
        if (comp[w] === -1) {
          comp[w] = cid;
          stack.push(w);
        }
      }
    }
    cid += 1;
  }
  return { comp, count: cid };
}

/** 每个非孤立连通分量的奇度点数是否都是 0 或 2（欧拉路径存在性）。 */
export function hasEulerPath(nodeCount, edges) {
  const deg = degrees(nodeCount, edges);
  const { comp, count } = components(nodeCount, edges);
  const oddPerComp = new Array(count).fill(0);
  for (let i = 0; i < nodeCount; i += 1) {
    if (comp[i] >= 0 && deg[i] % 2 === 1) oddPerComp[comp[i]] += 1;
  }
  return oddPerComp.every((n) => n === 0 || n === 2);
}

/** 返回所有奇度节点（开路时即起/终点；回路时为空）。 */
export function oddVertices(nodeCount, edges) {
  const deg = degrees(nodeCount, edges);
  const out = [];
  for (let i = 0; i < nodeCount; i += 1) if (deg[i] % 2 === 1) out.push(i);
  return out;
}

/**
 * Hierholzer 算法（迭代栈式）：返回覆盖所有边的节点序列（欧拉回路/开路）。
 * 要求 start 是奇度点（开路）或任意点（回路）。结果长度 = edges.length + 1。
 * 返回 null 表示该 start 无法走出全量轨迹（例如从偶度点起走开路）。
 */
export function hierholzer(nodeCount, edges, start) {
  const adj = Array.from({ length: nodeCount }, () => []);
  edges.forEach(([a, b], i) => {
    adj[a].push({ to: b, ei: i });
    adj[b].push({ to: a, ei: i });
  });
  const used = new Set();
  const stack = [start];
  const trail = [];
  while (stack.length) {
    const v = stack[stack.length - 1];
    const next = adj[v].find((e) => !used.has(e.ei));
    if (next) {
      used.add(next.ei);
      stack.push(next.to);
    } else {
      trail.push(stack.pop());
    }
  }
  trail.reverse();
  if (used.size !== edges.length) return null; // 未能覆盖所有边（起点选错）
  return trail;
}

/** 对多分量图求解：返回每个分量的欧拉轨迹（顺序按分量出现顺序）。 */
export function solveLevel(level) {
  return level.components.map((c) => ({
    component: c,
    trail: hierholzer(c.nodes.length, c.edges, c.start),
  }));
}
