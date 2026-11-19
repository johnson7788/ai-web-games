// 简单 A*：在 cols×rows 网格上寻路，blocked(r,c) 返回 true 表示不可通行。
// 4 方向移动，曼哈顿启发。返回 [{r,c}, ...]（不含起点，含终点）；不可达返回 []。
export function findPath(rows, cols, start, goal, blocked) {
  if (start.r === goal.r && start.c === goal.c) return [];
  const key = (r, c) => r * cols + c;
  const startKey = key(start.r, start.c);
  const goalKey = key(goal.r, goal.c);
  if (blocked(goal.r, goal.c)) return [];

  const open = new Map();
  const closed = new Set();
  const g = new Map([[startKey, 0]]);
  const cameFrom = new Map();
  open.set(startKey, { r: start.r, c: start.c, f: heuristic(start, goal) });

  const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  while (open.size) {
    let curKey = null;
    let bestF = Infinity;
    for (const [k, v] of open) {
      if (v.f < bestF) { bestF = v.f; curKey = k; }
    }
    if (curKey === null) break;
    const cur = open.get(curKey);
    open.delete(curKey);
    if (curKey === goalKey) {
      // 回溯路径
      const path = [];
      let k = goalKey;
      while (k !== startKey) {
        path.push({ r: Math.floor(k / cols), c: k % cols });
        k = cameFrom.get(k);
        if (k == null) return [];
      }
      path.reverse();
      return path;
    }
    closed.add(curKey);

    for (const [dr, dc] of DIRS) {
      const nr = cur.r + dr;
      const nc = cur.c + dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      if (blocked(nr, nc)) continue;
      const nKey = key(nr, nc);
      if (closed.has(nKey)) continue;
      const tentative = (g.get(curKey) ?? Infinity) + 1;
      if (tentative < (g.get(nKey) ?? Infinity)) {
        cameFrom.set(nKey, curKey);
        g.set(nKey, tentative);
        const f = tentative + heuristic({ r: nr, c: nc }, goal);
        open.set(nKey, { r: nr, c: nc, f });
      }
    }
  }
  return [];
}

function heuristic(a, b) {
  return Math.abs(a.r - b.r) + Math.abs(a.c - b.c);
}
