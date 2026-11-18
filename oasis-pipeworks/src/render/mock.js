// 本地 mock：sim 未就绪时，按契约 §3.4 的 state 形状构造可渲染的演示关卡。
// 仅渲染消费；Lead 接上真实 sim.js 后此文件不再使用。
// 只输出 state，不做像素换算（像素由 render 从 r,c 映射）。

export const SCENES = ['dawn-desert', 'dusk-canyon', 'night-oasis'];

// 每套场景一个演示关卡：rows/cols、起终点、岩石、花朵、已铺管路 + 水流进度。
const DEMOS = {
  'dawn-desert': {
    rows: 4,
    cols: 5,
    initialTime: 45,
    timeLeft: 32,
    queueCap: 4,
    start: { r: 0, c: 0, entrance: 'top', exit: 'down' },
    end: { r: 3, c: 4, entrance: 'top', exit: 'down' },
    rocks: [],
    blooms: [[2, 1], [2, 3]],
    // 已铺管路（从 start 到 end 的连通链）
    path: [
      { r: 0, c: 0, piece: 'N' },
      { r: 1, c: 0, piece: 'N' },
      { r: 2, c: 0, piece: 'UR' },
      { r: 2, c: 1, piece: 'E' },
      { r: 2, c: 2, piece: 'E' },
      { r: 2, c: 3, piece: 'E' },
      { r: 2, c: 4, piece: 'LR' },
      { r: 3, c: 4, piece: 'N' },
    ],
    waterHead: 5, // cells[0..4] 已灌满，正在灌 cells[5]
    waterT: 0.62,
    queue: ['E', 'UL', 'N', 'LR'],
    locked: [],
  },

  'dusk-canyon': {
    rows: 4,
    cols: 6,
    initialTime: 50,
    timeLeft: 40,
    queueCap: 4,
    start: { r: 0, c: 0, entrance: 'top', exit: 'down' },
    end: { r: 3, c: 5, entrance: 'top', exit: 'down' },
    rocks: [[1, 2], [2, 3], [0, 4]],
    blooms: [[2, 1], [3, 3]], // 两朵在管路上（已浇）
    path: [
      { r: 0, c: 0, piece: 'N' },
      { r: 1, c: 0, piece: 'N' },
      { r: 2, c: 0, piece: 'UR' },
      { r: 2, c: 1, piece: 'LR' },
      { r: 3, c: 1, piece: 'E' },
      { r: 3, c: 2, piece: 'E' },
      { r: 3, c: 3, piece: 'E' },
      { r: 3, c: 4, piece: 'E' },
      { r: 3, c: 5, piece: 'N' },
    ],
    waterHead: 6,
    waterT: 0.4,
    queue: ['N', 'UL', 'X', 'E'],
    locked: [2],
  },

  'night-oasis': {
    rows: 5,
    cols: 6,
    initialTime: 60,
    timeLeft: 50,
    queueCap: 5,
    start: { r: 0, c: 0, entrance: 'top', exit: 'down' },
    end: { r: 4, c: 5, entrance: 'top', exit: 'down' },
    rocks: [[1, 1], [3, 3]],
    blooms: [[2, 1], [2, 4]], // 管路上的已浇花
    path: [
      { r: 0, c: 0, piece: 'N' },
      { r: 1, c: 0, piece: 'N' },
      { r: 2, c: 0, piece: 'UR' },
      { r: 2, c: 1, piece: 'E' },
      { r: 2, c: 2, piece: 'E' },
      { r: 2, c: 3, piece: 'E' },
      { r: 2, c: 4, piece: 'LR' },
      { r: 3, c: 4, piece: 'E' },
      { r: 3, c: 5, piece: 'LR' },
      { r: 4, c: 5, piece: 'N' },
    ],
    waterHead: 7,
    waterT: 0.55,
    queue: ['X', 'N', 'UL', 'E', 'LR'],
    locked: [2],
  },
};

// 场景里额外摆放的「未浇灌花苞」（kind:'bloom'），丰富画面。
const BUD_CELLS = {
  'dawn-desert': [[1, 3]],
  'dusk-canyon': [[1, 4], [0, 1]],
  'night-oasis': [[4, 1], [4, 2], [4, 3]],
};

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 稳定伪随机（供地面裂纹等装饰，不依赖真实随机）
export function seededRand(r, c, seed = 7) {
  return mulberry32((r * 73856093) ^ (c * 19349663) ^ (seed * 83492791))();
}

export function createMockState(sceneKey = 'dawn-desert') {
  const D = DEMOS[sceneKey] || DEMOS['dawn-desert'];
  const { rows, cols } = D;

  // 网格：默认空
  const grid = [];
  for (let r = 0; r < rows; r += 1) {
    const row = [];
    for (let c = 0; c < cols; c += 1) {
      row.push({ kind: 'empty', piece: null, watered: false, waterT: 0 });
    }
    grid.push(row);
  }

  // 起点 / 终点
  grid[D.start.r][D.start.c] = { kind: 'start', piece: 'N', watered: false, waterT: 0 };
  grid[D.end.r][D.end.c] = { kind: 'end', piece: 'N', watered: false, waterT: 0 };

  // 岩石
  for (const [r, c] of D.rocks) grid[r][c] = { kind: 'rock', piece: null, watered: false, waterT: 0 };

  // 花苞（未浇）
  for (const [r, c] of (BUD_CELLS[sceneKey] || [])) {
    grid[r][c] = { kind: 'bloom', piece: null, watered: false, waterT: 0 };
  }

  // 已铺管路
  const pathCells = [];
  for (let i = 0; i < D.path.length; i += 1) {
    const { r, c, piece } = D.path[i];
    const isBloom = D.blooms.some(([br, bc]) => br === r && bc === c);
    grid[r][c] = {
      kind: 'pipe',
      piece,
      watered: false,
      waterT: 0,
      bloom: isBloom,
    };
    const prev = D.path[i - 1];
    let enter = 'top';
    if (prev) {
      enter = prev.c < c ? 'left' : prev.c > c ? 'right' : prev.r < r ? 'top' : 'down';
    }
    pathCells.push({ r, c, tEnter: i * 1.0, tExit: (i + 1) * 1.0, enter });
  }

  // 水流状态：cells[0..head-1] 灌满，cells[head] 进行中
  const head = Math.min(D.waterHead, pathCells.length);
  for (let i = 0; i < head; i += 1) {
    const cell = grid[pathCells[i].r][pathCells[i].c];
    cell.watered = true;
    cell.waterT = 1;
  }
  if (head < pathCells.length) {
    const cur = grid[pathCells[head].r][pathCells[head].c];
    cur.waterT = D.waterT;
  }

  const water = {
    path: pathCells.map(({ r, c }) => ({ r, c })), // sim 不算像素，render 从 r,c 映射
    cells: pathCells,
    head,
    t: D.waterT,
  };

  const blooms = D.blooms.filter(([br, bc]) => {
    const cell = grid[br][bc];
    return cell.watered;
  }).length;

  const queue = D.queue.map((piece, i) => ({
    piece,
    locked: (D.locked || []).includes(i),
    offsetT: 0,
  }));

  return {
    sceneKey,
    level: DEMOS[sceneKey] === DEMOS['dawn-desert'] ? 1 : DEMOS[sceneKey] === DEMOS['dusk-canyon'] ? 5 : 9,
    phase: 'flowing',
    rows,
    cols,
    grid,
    start: D.start,
    end: D.end,
    queue,
    queueCap: D.queueCap,
    selected: null,
    timeLeft: D.timeLeft,
    initialTime: D.initialTime,
    water,
    blooms,
    bloomTotal: D.blooms.length,
    digLeft: 1,
    digMax: 1,
    placements: pathCells.length - 2,
    stars: 0,
    result: null,
  };
}
