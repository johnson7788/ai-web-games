// Oasis Pipeworks · 关卡辅助（M1 拥有，可选文件）
// 职责：可解性 solver（BFS 找 start→end 通路，岩石不可穿，且尊重 start.exit / end.entrance）
//       + 管路所需管件推算。
// 供 tests/levels.test.mjs 与 tools/selfplay.mjs 使用；纯逻辑，零依赖。

const DR = { top: -1, down: 1, left: 0, right: 0 };
const DC = { top: 0, down: 0, left: -1, right: 1 };
const OPPOSITE = { top: 'down', down: 'top', left: 'right', right: 'left' };

export function direction(from, to) {
  const dr = to.r - from.r;
  const dc = to.c - from.c;
  if (dr === -1 && dc === 0) return 'top';
  if (dr === 1 && dc === 0) return 'down';
  if (dr === 0 && dc === -1) return 'left';
  if (dr === 0 && dc === 1) return 'right';
  return null;
}

// 给定水进入边与离开边，返回所需 2 边管件。
export function neededPiece(enter, exit) {
  const pair = [enter, exit].sort().join('');
  switch (pair) {
    case 'downtop': return 'N';
    case 'leftright': return 'E';
    case 'lefttop': return 'UL';
    case 'righttop': return 'UR';
    case 'downleft': return 'LL';
    case 'downright': return 'LR';
    default: return null;
  }
}

function inBounds(level, r, c) {
  return r >= 0 && r < level.rows && c >= 0 && c < level.cols;
}

// BFS 求 start→end 最短通路。尊重 start.exit（第一步方向）与 end.entrance（最后一步方向），
// 岩石不可穿。返回 [{r,c}]（含 start/end）或 null。
export function findPath(level) {
  const { rows, cols, start, end, rocks } = level;
  const rockSet = new Set(rocks.map(([r, c]) => `${r},${c}`));
  const key = (r, c) => `${r},${c}`;

  const startExit = OPPOSITE[start.entrance]; // start → 首格的方向
  const endMove = OPPOSITE[end.entrance];     // 末前格 → end 的方向
  const first = { r: start.r + DR[startExit], c: start.c + DC[startExit] };
  const beforeEnd = { r: end.r - DR[endMove], c: end.c - DC[endMove] };

  if (!inBounds(level, first.r, first.c) || rockSet.has(key(first.r, first.c))) return null;
  if (!inBounds(level, beforeEnd.r, beforeEnd.c) || rockSet.has(key(beforeEnd.r, beforeEnd.c))) return null;

  const startKey = key(start.r, start.c);
  const endKey = key(end.r, end.c);
  const goalKey = key(beforeEnd.r, beforeEnd.c);
  const firstKey = key(first.r, first.c);

  // start → first 已定；从 first BFS 到 beforeEnd（end 格作墙，避免通路提前穿过终点）
  const blocked = new Set(rockSet);
  blocked.add(endKey);
  const visited = new Set([startKey, firstKey]);
  const prev = new Map([[firstKey, startKey]]);
  const q = [first];

  while (q.length) {
    const { r, c } = q.shift();
    if (key(r, c) === goalKey) {
      const path = [];
      let k = goalKey;
      while (k !== undefined) {
        const [rr, cc] = k.split(',').map(Number);
        path.unshift({ r: rr, c: cc });
        k = prev.get(k);
      }
      path.push({ r: end.r, c: end.c });
      return path;
    }
    for (const d of ['top', 'down', 'left', 'right']) {
      const nr = r + DR[d];
      const nc = c + DC[d];
      if (!inBounds(level, nr, nc)) continue;
      const k = key(nr, nc);
      if (visited.has(k)) continue;
      if (blocked.has(k)) continue;
      visited.add(k);
      prev.set(k, key(r, c));
      q.push({ r: nr, c: nc });
    }
  }
  return null;
}

// 通路是否可解（存在即可）。
export function isSolvable(level) {
  return findPath(level) !== null;
}

// 返回一条最短通路每个中间格所需的管件映射 `r,c` → piece（不含 start/end）。
export function pathRequirements(level) {
  const path = findPath(level);
  if (!path) return null;
  const req = new Map();
  for (let i = 1; i < path.length - 1; i += 1) {
    const enter = OPPOSITE[direction(path[i - 1], path[i])];
    const exit = direction(path[i], path[i + 1]);
    req.set(`${path[i].r},${path[i].c}`, neededPiece(enter, exit));
  }
  return req;
}

export { DR, DC, OPPOSITE };
