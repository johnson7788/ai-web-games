// COLOR MASTER MIX · 程序化形状 + 关卡定义
// 所有图形都是代码栅格化生成的「霓虹像素」轮廓（不复制参考源素材）。
// 每个格子 = 一个可上色区域；4 邻接为邻居；封印格（rock）需邻居上色才解锁。
import { GAME } from './game.config.js';

// ---------- 几何工具 ----------

function pointInPolygon(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// 五角星（顶点朝上）：外半径 1，内半径 0.45
function starPolygon() {
  const pts = [];
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 === 0 ? 1 : 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return pts;
}

function hexPolygon(r = 0.94) {
  const pts = [];
  for (let i = 0; i < 6; i += 1) {
    const a = -Math.PI / 2 + (i * Math.PI) / 3; // 顶角朝上
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return pts;
}

function boltPolygon() {
  // 闪电 ⚡：三段折线构成的实心多边形（顶点朝上/下交替，稍加粗）
  return [
    [-0.14, 1.0],
    [-0.62, 0.02],
    [-0.06, 0.02],
    [-0.4, -1.0],
    [0.52, -0.04],
    [0.0, -0.04],
    [0.28, 1.0],
  ];
}

// 图形谓词：输入 (x,y) ∈ [-1,1]²（y 向上），返回是否在形状内
const PREDICATES = {
  star(x, y) {
    return pointInPolygon(x * 1.05, y * 1.05, starPolygon());
  },
  diamond(x, y) {
    return Math.abs(x) + Math.abs(y) <= 0.9;
  },
  heart(x, y) {
    // 经典心形隐式曲线；缩放/平移使其居中填满
    const hx = x / 0.78;
    const hy = (y - 0.06) / 0.82;
    const v = hx * hx + hy * hy - 1;
    const cube = v * v * v;
    return cube - hx * hx * hy * hy * hy <= 0;
  },
  rocket(x, y) {
    // 鼻锥（底部半宽 0.5，向上收尖）
    if (y >= 0.3 && y <= 0.96 && Math.abs(x) <= 0.5 * ((0.96 - y) / 0.66)) return true;
    // 箭体（向下连到喷口，保证尾焰连通）
    if (y >= -0.8 && y <= 0.3 && Math.abs(x) <= 0.34) return true;
    // 尾翼（左右对称，向下张开）
    if (y >= -0.8 && y <= -0.42) {
      const w = 0.3 + ((y + 0.42) / 0.38) * 0.52;
      if (Math.abs(x) >= 0.3 && Math.abs(x) <= w) return true;
    }
    // 尾焰
    if (y >= -0.94 && y <= -0.74 && Math.abs(x) <= 0.18) return true;
    return false;
  },
  bolt(x, y) {
    return pointInPolygon(x, y, boltPolygon());
  },
  flower(x, y) {
    const d = (px, py) => Math.hypot(x - px, y - py);
    if (d(0, 0) <= 0.32) return true; // 花心
    for (let k = 0; k < 6; k += 1) {
      const a = (k * Math.PI) / 3;
      if (d(Math.cos(a) * 0.62, Math.sin(a) * 0.62) <= 0.3) return true; // 花瓣
    }
    return false;
  },
  butterfly(x, y) {
    if (Math.abs(x) <= 0.08 && y >= -0.92 && y <= 0.92) return true; // 身体
    const wing = (cx, cy, rx, ry) => {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      return dx * dx + dy * dy <= 1;
    };
    return wing(0.52, 0.34, 0.44, 0.5) || wing(-0.52, 0.34, 0.44, 0.5)
      || wing(0.36, -0.34, 0.32, 0.4) || wing(-0.36, -0.34, 0.32, 0.4);
  },
  gem(x, y) {
    return pointInPolygon(x, y, hexPolygon());
  },
};

// 栅格化：grid×grid 的格子里，中心点落在形状内的格子保留
function rasterize(grid, pred) {
  const cells = [];
  for (let r = 0; r < grid; r += 1) {
    for (let c = 0; c < grid; c += 1) {
      const x = ((c + 0.5) / grid) * 2 - 1;
      const y = 1 - ((r + 0.5) / grid) * 2;
      if (pred(x, y)) cells.push({ r, c, x, y });
    }
  }
  return cells;
}

// 建立 4 邻接
function linkNeighbors(cells) {
  const byKey = new Map();
  cells.forEach((cell, i) => { cell.id = i; byKey.set(`${cell.r},${cell.c}`, cell); });
  cells.forEach((cell) => {
    cell.neighbors = [
      [cell.r - 1, cell.c], [cell.r + 1, cell.c], [cell.r, cell.c - 1], [cell.r, cell.c + 1],
    ].map(([r, c]) => byKey.get(`${r},${c}`)).filter(Boolean).map((n) => n.id);
  });
  return cells;
}

// 只保留最大连通分量，剔除栅格化产生的零星散点，保证形状连通
function keepLargestComponent(cells) {
  const seen = new Set();
  const comps = [];
  for (const cell of cells) {
    if (seen.has(cell.id)) continue;
    const comp = [];
    const q = [cell.id];
    seen.add(cell.id);
    while (q.length) {
      const id = q.pop();
      comp.push(id);
      for (const n of cells[id].neighbors) {
        if (!seen.has(n)) { seen.add(n); q.push(n); }
      }
    }
    comps.push(comp);
  }
  if (comps.length <= 1) return cells;
  comps.sort((a, b) => b.length - a.length);
  const keep = new Set(comps[0]);
  return cells.filter((c) => keep.has(c.id));
}

// 选封印格：优先选「邻居最多」的内层格，且保证每个封印格至少有一个非封印邻居（可解性）
function pickRocks(cells, k) {
  if (k <= 0) return [];
  const sorted = [...cells].sort((a, b) => (b.neighbors.length - a.neighbors.length) || (a.r - b.r) || (a.c - b.c));
  const chosen = [];
  for (const cell of sorted) {
    if (chosen.length >= k) break;
    if (chosen.includes(cell.id)) continue;
    // 不能把某个已选封印格的所有邻居都选掉
    const blocksAll = chosen.some((cid) => {
      const rock = cells[cid];
      const nonRockNeighbors = rock.neighbors.filter((n) => n !== cell.id && !chosen.includes(n));
      return nonRockNeighbors.length === 0 && rock.neighbors.includes(cell.id);
    });
    if (blocksAll) continue;
    chosen.push(cell.id);
  }
  return chosen;
}

function buildLevel(def) {
  let cells = linkNeighbors(rasterize(def.grid, PREDICATES[def.shape]));
  cells = keepLargestComponent(cells);
  cells.forEach((cell, i) => { cell.id = i; }); // 重编号
  cells = linkNeighbors(cells);                  // 重算邻接
  const rockIds = pickRocks(cells, def.rocks || 0);
  const rockSet = new Set(rockIds);
  return {
    grid: def.grid,
    shape: def.shape,
    time: def.time,
    nameEn: def.nameEn,
    nameZh: def.nameZh,
    newElement: def.newElement,
    cells: cells.map((cell) => ({
      id: cell.id,
      r: cell.r,
      c: cell.c,
      x: cell.x,
      y: cell.y,
      neighbors: cell.neighbors.slice(),
      locked: rockSet.has(cell.id),
    })),
  };
}

export const LEVELS = [
  buildLevel({ grid: 7, shape: 'star', rocks: 0, time: 40, nameEn: 'Neon Star', nameZh: '霓虹之星', newElement: 'paint your first region' }),
  buildLevel({ grid: 7, shape: 'diamond', rocks: 0, time: 40, nameEn: 'Prism Diamond', nameZh: '棱镜钻石', newElement: 'full 8×8 neon palette' }),
  buildLevel({ grid: 9, shape: 'heart', rocks: 2, time: 45, nameEn: 'Arcade Heart', nameZh: '街机之心', newElement: 'sealed rocks unlock by neighbors' }),
  buildLevel({ grid: 9, shape: 'rocket', rocks: 3, time: 45, nameEn: 'Retro Rocket', nameZh: '复古火箭', newElement: 'combo multiplier streaks' }),
  buildLevel({ grid: 9, shape: 'bolt', rocks: 3, time: 50, nameEn: 'Volt Bolt', nameZh: '伏特闪电', newElement: 'double rock chains' }),
  buildLevel({ grid: 9, shape: 'flower', rocks: 4, time: 50, nameEn: 'Neon Bloom', nameZh: '霓虹花', newElement: 'six-petal symmetry' }),
  buildLevel({ grid: 9, shape: 'butterfly', rocks: 5, time: 55, nameEn: 'Pulse Butterfly', nameZh: '脉冲蝶', newElement: 'wing-span canvas' }),
  buildLevel({ grid: 8, shape: 'gem', rocks: 5, time: 60, nameEn: 'Hex Gem', nameZh: '六方宝石', newElement: 'hex finale max rocks' }),
];

// 供测试/自检使用：验证可解性
// 可解条件：① 全图（含封印格）连通；② 每个封印格至少一个非封印邻居（能先被解开）。
export function validateLevel(level) {
  const cells = level.cells;
  const problems = [];
  // 1) 每个封印格至少一个非封印邻居
  for (const c of cells) {
    if (c.locked && !c.neighbors.some((n) => !cells[n].locked)) {
      problems.push(`rock ${c.id} has no free neighbor`);
    }
  }
  // 2) 全图连通（BFS）
  if (cells.length) {
    const seen = new Set([cells[0].id]);
    const q = [cells[0].id];
    while (q.length) {
      const id = q.pop();
      for (const n of cells[id].neighbors) {
        if (!seen.has(n)) { seen.add(n); q.push(n); }
      }
    }
    if (seen.size !== cells.length) problems.push(`graph disconnected: ${seen.size}/${cells.length}`);
  }
  return problems;
}
