// INK PATH · 关卡数据（12 关 3 章：薄暮林间 / 极光冰原 / 深空星云）
// 主题：萤火虫蛛在星空网上织丝。节点 = 星子，边 = 丝线；画过之处丝线发亮，
//       完成瞬间整张星网亮起涟漪 + 萤火虫群飞散。
//
// 字段：
//   index / scene / mode / start / nodes / edges / name / newElement
//   mode: 'nodes' = 每个星子只访问一次（哈密顿路径，原作规则）；
//         'edges' = 每条丝线只走一次（欧拉路径，可重走星子）。
//   nodes: [{x,y}]，id = 数组下标；x/y ∈ [0,1] 归一化坐标。
//   edges: [a,b] 无向 ｜ {a,b,dir:1} a→b ｜ {a,b,dir:2} b→a ｜ {a,b,gate:k} 访问星子 k 后解锁。
//
// 全部关卡由 src/game/solver.js 的通用求解器验证可解（tests/levels.test.mjs 断言）。

// 边构造辅助：o.dir = 0 双向 / 1 a→b / 2 b→a；o.gate = 触发星子下标（-1 无）。
const ed = (a, b, o = {}) => ({ a, b, dir: o.dir || 0, gate: o.gate ?? -1 });

export const LEVELS = [
  // ─────────────────────────── 第 1 章 · 薄暮林间 ───────────────────────────
  {
    index: 1, scene: 'dusk-forest', mode: 'nodes', start: 0,
    nodes: [{ x: 0.20, y: 0.50 }, { x: 0.50, y: 0.50 }, { x: 0.80, y: 0.50 }],
    edges: [ed(0, 1), ed(1, 2)],
    name: { en: 'First Thread', zh: '初丝' },
    newElement: '三节点丝链：点相邻星子延伸',
  },
  {
    index: 2, scene: 'dusk-forest', mode: 'nodes', start: 1,
    nodes: [
      { x: 0.50, y: 0.50 },
      { x: 0.50, y: 0.12 },
      { x: 0.88, y: 0.50 },
      { x: 0.50, y: 0.88 },
      { x: 0.12, y: 0.50 },
    ],
    edges: [ed(0, 1), ed(0, 2), ed(0, 3), ed(0, 4), ed(1, 2), ed(2, 3), ed(3, 4), ed(4, 1)],
    name: { en: 'Star Wheel', zh: '星轮' },
    newElement: '星形轮盘：多岔路，走错要回退',
  },
  {
    index: 3, scene: 'dusk-forest', mode: 'nodes', start: 0,
    nodes: [
      { x: 0.20, y: 0.30 }, { x: 0.35, y: 0.12 }, { x: 0.35, y: 0.50 },
      { x: 0.65, y: 0.50 }, { x: 0.65, y: 0.12 }, { x: 0.80, y: 0.30 },
    ],
    edges: [ed(0, 1), ed(1, 2), ed(2, 0), ed(3, 4), ed(4, 5), ed(5, 3), ed(2, 3)],
    name: { en: 'The Bridge', zh: '桥' },
    newElement: '桥图：唯一桥边决定过桥时机',
  },
  {
    index: 4, scene: 'dusk-forest', mode: 'nodes', start: 1,
    nodes: [
      { x: 0.50, y: 0.50 },
      { x: 0.28, y: 0.25 }, { x: 0.28, y: 0.75 },
      { x: 0.72, y: 0.25 }, { x: 0.72, y: 0.75 },
    ],
    edges: [ed(0, 1), ed(1, 2), ed(2, 0), ed(0, 3), ed(3, 4), ed(4, 0)],
    name: { en: 'Twin Rings', zh: '双环' },
    newElement: '双环交汇：共中心星的双环，进错会被堵在环里',
  },

  // ─────────────────────────── 第 2 章 · 极光冰原 ───────────────────────────
  {
    index: 5, scene: 'aurora-ice', mode: 'nodes', start: 0,
    nodes: [
      { x: 0.20, y: 0.28 }, { x: 0.80, y: 0.28 }, { x: 0.50, y: 0.50 },
      { x: 0.20, y: 0.72 }, { x: 0.80, y: 0.72 },
    ],
    edges: [
      ed(0, 1), ed(0, 2), ed(0, 3), ed(0, 4),
      ed(1, 2), ed(1, 3), ed(1, 4),
      ed(2, 3), ed(2, 4), ed(3, 4),
    ],
    name: { en: 'Dense Sky', zh: '密网' },
    newElement: '密集星座：几乎全连接，岔路最密',
  },
  {
    index: 6, scene: 'aurora-ice', mode: 'edges', start: 0,
    nodes: [
      { x: 0.50, y: 0.50 },
      { x: 0.30, y: 0.30 }, { x: 0.70, y: 0.30 },
      { x: 0.30, y: 0.70 }, { x: 0.70, y: 0.70 },
    ],
    edges: [ed(0, 1), ed(1, 2), ed(2, 0), ed(0, 3), ed(3, 4), ed(4, 0)],
    name: { en: 'Weave Twice', zh: '重织' },
    newElement: '重走节点：星子可二次进入，丝线只走一次',
  },
  {
    index: 7, scene: 'aurora-ice', mode: 'nodes', start: 0,
    nodes: [
      { x: 0.15, y: 0.50 }, { x: 0.40, y: 0.50 }, { x: 0.65, y: 0.50 },
      { x: 0.88, y: 0.50 }, { x: 0.50, y: 0.20 },
    ],
    edges: [ed(0, 1, { dir: 1 }), ed(1, 2, { dir: 1 }), ed(2, 3, { dir: 1 }), ed(1, 4), ed(4, 2, { dir: 1 })],
    name: { en: 'One-Way Thread', zh: '单向丝' },
    newElement: '单向丝：箭头只能顺向走，逆走直接断路',
  },
  {
    index: 8, scene: 'aurora-ice', mode: 'nodes', start: 0,
    nodes: [
      { x: 0.20, y: 0.30 }, { x: 0.45, y: 0.20 }, { x: 0.70, y: 0.30 },
      { x: 0.85, y: 0.55 }, { x: 0.55, y: 0.65 }, { x: 0.25, y: 0.65 },
    ],
    edges: [ed(0, 1), ed(1, 2), ed(0, 2), ed(2, 3, { gate: 1 }), ed(3, 4), ed(4, 5)],
    name: { en: 'Broken Line', zh: '断线' },
    newElement: '断线解锁：先点亮触发星子，才能解锁新丝',
  },

  // ─────────────────────────── 第 3 章 · 深空星云 ───────────────────────────
  {
    index: 9, scene: 'deep-space', mode: 'nodes', start: 0,
    nodes: [
      { x: 0.20, y: 0.50 }, { x: 0.40, y: 0.20 }, { x: 0.60, y: 0.20 },
      { x: 0.80, y: 0.50 }, { x: 0.50, y: 0.55 }, { x: 0.50, y: 0.85 },
    ],
    edges: [
      ed(0, 1, { dir: 1 }), ed(1, 2, { dir: 1 }), ed(2, 3, { dir: 1 }),
      ed(2, 4, { gate: 1 }), ed(4, 5), ed(5, 3, { dir: 1 }),
    ],
    name: { en: 'Ordered Gate', zh: '序门' },
    newElement: '单向 + 解锁叠加：箭头限定顺序，触发解锁开新丝',
  },
  {
    index: 10, scene: 'deep-space', mode: 'nodes', start: 0,
    nodes: [
      { x: 0.15, y: 0.15 }, { x: 0.50, y: 0.15 }, { x: 0.85, y: 0.15 },
      { x: 0.15, y: 0.50 }, { x: 0.50, y: 0.50 }, { x: 0.85, y: 0.50 },
      { x: 0.15, y: 0.85 }, { x: 0.50, y: 0.85 }, { x: 0.85, y: 0.85 },
    ],
    edges: [
      ed(0, 1), ed(1, 2), ed(3, 4), ed(4, 5), ed(6, 7), ed(7, 8),
      ed(0, 3), ed(3, 6), ed(1, 4), ed(4, 7), ed(2, 5), ed(5, 8),
    ],
    name: { en: 'Grand Net', zh: '大网' },
    newElement: '九星大网：长线规划，一子走错全盘重织',
  },
  {
    index: 11, scene: 'deep-space', mode: 'edges', start: 0,
    nodes: [
      { x: 0.50, y: 0.10 }, { x: 0.88, y: 0.38 }, { x: 0.74, y: 0.82 },
      { x: 0.26, y: 0.82 }, { x: 0.12, y: 0.38 },
    ],
    edges: [
      ed(0, 1, { dir: 1 }), ed(1, 2, { dir: 1 }), ed(2, 3, { dir: 1 }), ed(3, 4, { dir: 1 }), ed(4, 0, { dir: 1 }),
      ed(0, 2, { dir: 1 }), ed(2, 4, { dir: 1 }), ed(4, 1, { dir: 1 }), ed(1, 3, { dir: 1 }), ed(3, 0, { dir: 1 }),
    ],
    name: { en: 'Silk Orbit', zh: '丝轨' },
    newElement: '单向欧拉网：每条箭头丝线恰好走一次',
  },
  {
    index: 12, scene: 'deep-space', mode: 'nodes', start: 0,
    nodes: [
      { x: 0.10, y: 0.50 }, { x: 0.28, y: 0.20 }, { x: 0.50, y: 0.35 },
      { x: 0.72, y: 0.20 }, { x: 0.90, y: 0.50 }, { x: 0.72, y: 0.80 },
      { x: 0.50, y: 0.65 }, { x: 0.28, y: 0.80 },
    ],
    edges: [
      ed(1, 2), ed(2, 3), ed(3, 4), ed(4, 5), ed(5, 6), ed(6, 7), ed(7, 0),
      ed(0, 2, { dir: 1 }), ed(1, 7), ed(3, 6), ed(4, 7, { gate: 2 }),
    ],
    name: { en: 'Master Web', zh: '大师网' },
    newElement: '大师网：全机制叠加（箭头 + 断线 + 多岔路）',
  },
];

export const LEVEL_COUNT = LEVELS.length;
