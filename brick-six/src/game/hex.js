// 六边形棋盘几何（纯逻辑，可 node 测试）：轴向坐标 side=5 的 61 格蜂窝盘。
// 棋盘是标准数学结构（3 个方向各 9 条平行线），这里程序化生成，不复用原素材/数组字面量。

export const SIDE = 5;          // 每条边格数；61 = 3*SIDE*SIDE - 3*SIDE + 1
export const RADIUS = SIDE - 1; // 轴向坐标半径

// 轴向坐标 (q, r)：|q|<=R && |r|<=R && |q+r|<=R
export function allCells() {
  const out = [];
  for (let q = -RADIUS; q <= RADIUS; q += 1) {
    for (let r = -RADIUS; r <= RADIUS; r += 1) {
      if (Math.abs(q + r) <= RADIUS) out.push({ q, r });
    }
  }
  return out;
}

// 像素坐标（pointy-top）：x = SIZE*(sqrt3*q + sqrt3/2*r)，y = SIZE*(3/2*r)
export function axialToXY(q, r, size) {
  const x = size * (Math.sqrt(3) * q + (Math.sqrt(3) / 2) * r);
  const y = size * (3 / 2) * r;
  return { x, y };
}

// 六邻域
export function neighbors(q, r) {
  return [
    [q + 1, r], [q - 1, r],
    [q, r + 1], [q, r - 1],
    [q + 1, r - 1], [q - 1, r + 1],
  ];
}

// 从 (q,r) 集合生成三族平行线（按 r / 按 q / 按 q+r 分组，长度>=2 的组即一条消除线）
export function buildLines(cells) {
  const lines = [];
  const by = new Map();
  const keyOf = (k) => String(k);
  const push = (k, cell) => {
    if (!by.has(k)) by.set(k, []);
    by.get(k).push(cell);
  };
  for (const c of cells) {
    push(`r:${c.r}`, c);
    push(`q:${c.q}`, c);
    push(`s:${c.q + c.r}`, c);
  }
  for (const arr of by.values()) {
    if (arr.length >= 2) lines.push(arr);
  }
  return lines;
}

// 旋转形状 60°：轴向坐标 (q,r) -> (-r, q+r)
export function rotateOffsets(offsets) {
  return offsets.map(([q, r]) => [-r || 0, q + r]);
}

// 归一化（去重 + 平移锚点让最小 q,r 尽量靠近原点，用于形状比较/去重）
export function normalizeOffsets(offsets) {
  const set = new Set(offsets.map(([q, r]) => `${q},${r}`));
  const uniq = [...set].map((s) => s.split(',').map(Number));
  const minQ = Math.min(...uniq.map(([q]) => q));
  const minR = Math.min(...uniq.map(([, r]) => r));
  return uniq.map(([q, r]) => [q - minQ, r - minR]);
}

// 形状是否连通（相邻即连通）
export function isConnected(offsets) {
  const set = new Set(offsets.map(([q, r]) => `${q},${r}`));
  if (set.size !== offsets.length) return false;
  const [first] = offsets;
  const seen = new Set([`${first[0]},${first[1]}`]);
  const stack = [first];
  while (stack.length) {
    const [q, r] = stack.pop();
    for (const [nq, nr] of neighbors(q, r)) {
      const k = `${nq},${nr}`;
      if (set.has(k) && !seen.has(k)) {
        seen.add(k);
        stack.push([nq, nr]);
      }
    }
  }
  return seen.size === offsets.length;
}
