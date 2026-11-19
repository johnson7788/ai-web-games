// COLOR PIPES FLOW · 关卡生成器（纯逻辑，零 DOM）
// 玩法（NumberLink / Flow Free）：棋盘上有若干对同色端口，玩家用正交路径把同色端口连起来，
// 并填满所有空格（岩石除外）。生成方式：先造一条覆盖全盘的「蛇形」哈密顿路径，再在蛇上
// 随机切割成 numColors 段，每段两端即一对同色端口；岩石作为蛇上的「断点」被移除。
// 这样保证：每个非岩石格恰好属于一段、每段是首尾相邻的合法路径、关卡必然可解。
// 随机：mulberry32（种子注入，可复现）。

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 霓虹街机 8 色（高对比、深底可读）
export const PALETTE = [
  '#FF4D6D', // 霓虹粉
  '#FFB020', // 琥珀
  '#3DE8A8', // 薄荷绿
  '#4FC3F7', // 天蓝
  '#B98CFF', // 紫罗兰
  '#FF8A3D', // 橙
  '#57F0FF', // 亮青
  '#A0E62E', // 荧光绿
];

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// 蛇形哈密顿路径：随机起角、随机行列方向，逐行/逐列蛇形遍历，保证覆盖全部格子。
function serpentine(rows, cols, rng) {
  const horizontal = rng() < 0.5;       // true=按行蛇形，false=按列蛇形
  const path = [];
  if (horizontal) {
    let leftToRight = rng() < 0.5;
    const rowOrder = [];
    for (let r = 0; r < rows; r += 1) rowOrder.push(r);
    if (rng() < 0.5) rowOrder.reverse();
    for (const r of rowOrder) {
      const colOrder = [];
      for (let c = 0; c < cols; c += 1) colOrder.push(c);
      if (!leftToRight) colOrder.reverse();
      for (const c of colOrder) path.push([r, c]);
      leftToRight = !leftToRight;
    }
  } else {
    let topToBottom = rng() < 0.5;
    const colOrder = [];
    for (let c = 0; c < cols; c += 1) colOrder.push(c);
    if (rng() < 0.5) colOrder.reverse();
    for (const c of colOrder) {
      const rowOrder = [];
      for (let r = 0; r < rows; r += 1) rowOrder.push(r);
      if (!topToBottom) rowOrder.reverse();
      for (const r of rowOrder) path.push([r, c]);
      topToBottom = !topToBottom;
    }
  }
  return path;
}

/**
 * 生成一关。
 * @returns { rows, cols, rocks:[[r,c]...], pairs:[{id,color,a:[r,c],b:[r,c],path:[[r,c]...]}...],
 *            colorCount, emptyCount, par, moveLimit, hints }
 */
export function generateLevel(seed, rows, cols, numColors, rockCount) {
  const rng = mulberry32(seed);
  const total = rows * cols;

  // 1) 蛇形路径覆盖全盘
  const snake = serpentine(rows, cols, rng);

  // 2) 选岩石位置：蛇上索引在 [3, total-4]，且两两间距 >=4，
  //    保证去掉岩石后每段 run 长度 >=3（每对端口至少有 1 个空格可填）。
  const maxRocksBySpace = Math.floor((total - 7) / 4) + 1;
  const targetRocks = Math.max(0, Math.min(rockCount, numColors - 1, maxRocksBySpace));
  const candidate = [];
  for (let i = 3; i <= total - 4; i += 1) candidate.push(i);
  shuffle(candidate, rng);
  const rockIdx = [];
  for (const idx of candidate) {
    if (rockIdx.length >= targetRocks) break;
    if (rockIdx.some((p) => Math.abs(p - idx) < 4)) continue;
    rockIdx.push(idx);
  }
  rockIdx.sort((a, b) => a - b);
  const rocks = rockIdx.map((i) => snake[i]);
  const rockSet = new Set(rockIdx.map((i) => `${snake[i][0]},${snake[i][1]}`));

  // 3) 去掉岩石后，蛇裂成若干「段」（run），每段长度 >=3
  const runs = [];
  let cur = [];
  for (let i = 0; i < snake.length; i += 1) {
    const cell = snake[i];
    if (rockSet.has(`${cell[0]},${cell[1]}`)) {
      if (cur.length) { runs.push(cur); cur = []; }
    } else {
      cur.push(cell);
    }
  }
  if (cur.length) runs.push(cur);

  // 4) 反复在长度 >=6 的段上切一刀（切点保证两侧都 >=3），直到段数达标
  const segments = runs.map((run) => run.slice());
  let guard = 0;
  while (segments.length < numColors && guard < 500) {
    guard += 1;
    let cut = -1;
    for (let s = 0; s < segments.length; s += 1) {
      if (segments[s].length >= 6) { cut = s; break; }
    }
    if (cut === -1) break;
    const seg = segments[cut];
    const at = 3 + Math.floor(rng() * (seg.length - 6 + 1)); // at ∈ [3, seg.length-3]
    const left = seg.slice(0, at);
    const right = seg.slice(at);
    segments.splice(cut, 1, left, right);
  }

  // 5) 所有段长度 >=3（保证每对端口至少填 1 格）
  const colors = shuffle(PALETTE.slice(), rng);
  const pairs = segments.map((seg, i) => ({
    id: i,
    color: colors[i % colors.length],
    a: seg[0],
    b: seg[seg.length - 1],
    path: seg,
  }));

  const emptyCount = total - rocks.length - pairs.length * 2;
  const par = Math.max(1, emptyCount);

  return {
    rows,
    cols,
    rocks,
    pairs,
    colorCount: pairs.length,
    emptyCount,
    par,
    moveLimit: par * 3,
    hints: 2,
  };
}

// 关卡规模表（12 关，逐步加大难度）
const LEVEL_SPECS = [
  { rows: 5, cols: 5, numColors: 4, rockCount: 0 },
  { rows: 5, cols: 5, numColors: 4, rockCount: 2 },
  { rows: 6, cols: 6, numColors: 5, rockCount: 1 },
  { rows: 6, cols: 6, numColors: 6, rockCount: 2 },
  { rows: 6, cols: 6, numColors: 6, rockCount: 3 },
  { rows: 7, cols: 7, numColors: 7, rockCount: 2 },
  { rows: 7, cols: 7, numColors: 7, rockCount: 3 },
  { rows: 7, cols: 7, numColors: 7, rockCount: 4 },
  { rows: 7, cols: 7, numColors: 8, rockCount: 4 },
  { rows: 7, cols: 7, numColors: 8, rockCount: 5 },
  { rows: 7, cols: 7, numColors: 8, rockCount: 5 },
  { rows: 7, cols: 7, numColors: 8, rockCount: 6 },
];

export function buildLevels() {
  return LEVEL_SPECS.map((spec, i) => {
    const base = generateLevel(1000 + i * 977, spec.rows, spec.cols, spec.numColors, spec.rockCount);
    return { index: i + 1, ...base };
  });
}
