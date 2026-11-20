// 玩法数值（M1 所有）：形状池 / 12 档推进 / 计分 / 三场景包色板。
// 逻辑层不写死数字：sim 只读这里。

// ---- 蜂巢块组形状池（轴向偏移，锚点 = 第一个格子） ----
// 2–4 格连通形状；每个形状都连通、不重复（去重靠 sim 的 normalizeOffsets）。
export const SHAPES = [
  // 2 格
  [[0, 0], [1, 0]],
  [[0, 0], [0, 1]],
  [[0, 0], [1, -1]],
  // 3 格直线 / 拐角
  [[0, 0], [1, 0], [2, 0]],
  [[0, 0], [1, 0], [0, 1]],
  [[0, 0], [1, 0], [1, -1]],
  [[0, 0], [0, 1], [1, 1]],
  [[0, 0], [1, -1], [0, -1]],
  // 3 格三角（三格互邻，最容易拼环）
  [[0, 0], [1, 0], [0, 1]],
  // 4 格
  [[0, 0], [1, 0], [2, 0], [3, 0]],
  [[0, 0], [1, 0], [0, 1], [1, 1]],
  [[0, 0], [1, 0], [2, 0], [0, 1]],
  [[0, 0], [1, 0], [2, 0], [2, 1]],
  [[0, 0], [1, 0], [0, 1], [0, -1]],
  [[0, 0], [1, 0], [1, -1], [0, -1]],
  [[0, 0], [0, 1], [1, 1], [2, 1]],
  [[0, 0], [1, 0], [2, 0], [1, -1]],
  [[0, 0], [1, 0], [0, 1], [1, -1]],
  [[0, 0], [1, 0], [2, 0], [1, 1]],
];

// ---- 12 档推进（target = 累计分数达到该档的准入门槛） ----
// features：
//   narrow: true          -> 外环空格封成蜂蜡墙（可玩区缩小）
//   shapeSlots             -> 候选形状数量（3 或 4 = 双生成口）
//   waxEvery               -> 每放 N 块随机封蜡一格
//   pollenChance           -> 新块组成为花粉块的概率
//   pollenChain: true      -> 花粉传染可连锁
//   bigBlockRatio          -> 4 格形状的抽取权重
export const TIERS = [
  { index: 1, target: 0,    shapeSlots: 3, waxEvery: 10, pollenChance: 0,   pollenChain: false, bigBlockRatio: 0.15, narrow: false },
  { index: 2, target: 150,  shapeSlots: 3, waxEvery: 10, pollenChance: 0,   pollenChain: false, bigBlockRatio: 0.20, narrow: false },
  { index: 3, target: 450,  shapeSlots: 3, waxEvery: 10, pollenChance: 0,   pollenChain: false, bigBlockRatio: 0.20, narrow: true },
  { index: 4, target: 900,  shapeSlots: 3, waxEvery: 10, pollenChance: 0.22,pollenChain: false, bigBlockRatio: 0.22, narrow: true },
  { index: 5, target: 1500, shapeSlots: 4, waxEvery: 10, pollenChance: 0.22,pollenChain: false, bigBlockRatio: 0.22, narrow: true },
  { index: 6, target: 2200, shapeSlots: 4, waxEvery: 8,  pollenChance: 0.22,pollenChain: false, bigBlockRatio: 0.25, narrow: false },
  { index: 7, target: 3000, shapeSlots: 4, waxEvery: 8,  pollenChance: 0.22,pollenChain: false, bigBlockRatio: 0.38, narrow: false },
  { index: 8, target: 3900, shapeSlots: 4, waxEvery: 8,  pollenChance: 0.40,pollenChain: false, bigBlockRatio: 0.30, narrow: false },
  { index: 9, target: 4900, shapeSlots: 4, waxEvery: 8,  pollenChance: 0.40,pollenChain: false, bigBlockRatio: 0.30, narrow: false },
  { index: 10, target: 6000, shapeSlots: 4, waxEvery: 8, pollenChance: 0.40,pollenChain: true,  bigBlockRatio: 0.30, narrow: false },
  { index: 11, target: 7200, shapeSlots: 4, waxEvery: 8, pollenChance: 0.40,pollenChain: true,  bigBlockRatio: 0.32, narrow: false },
  { index: 12, target: 8500, shapeSlots: 4, waxEvery: 6, pollenChance: 0.40,pollenChain: true,  bigBlockRatio: 0.32, narrow: true },
];

// ---- 计分 ----
export const SCORING = {
  placePerCell: 10,       // 放一块奖励（每格）
  clearPerCell: 50,       // 消除每格基础分
  cascadeBonus: 500,      // 一次消 3 线（蜂王浆金瀑）额外奖励
  comboBonus: 100,        // 每多消一条线额外（(lines-1)*comboBonus）
  pollenCellBonus: 25,    // 花粉传染每额外消一格奖励
};

// 花粉块在落地后 N 步内被消除才传染（每放一块衰减 1）
export const POLLEN_LIFE = 3;

// ---- 三场景包（换章必换：色板 + 装饰主题） ----
// 1-4 春巢（金绿）/ 5-8 蜜库（琥珀）/ 9-12 冬巢（蓝白）
export function scenePackOf(tier) {
  if (tier <= 4) return 'spring';
  if (tier <= 8) return 'honey';
  return 'winter';
}

export const SCENE_PACKS = {
  spring: {
    name: 'spring',
    bgTop: '#0c2b1f', bgBottom: '#07160f',
    boardEmpty: '#12352a', boardEmptyEdge: '#2c6a4a',
    wall: '#6b5a2e',
    accent: '#ffd45e',
    cells: ['#ffd45e', '#7ce38b', '#5fd0a8', '#ff8a5b', '#c8f06b', '#ff6f91'],
    decor: 'blossom',
  },
  honey: {
    name: 'honey',
    bgTop: '#2b1706', bgBottom: '#170c02',
    boardEmpty: '#3a2208', boardEmptyEdge: '#8a5a16',
    wall: '#5b3c10',
    accent: '#ffb347',
    cells: ['#ffb347', '#ffd98a', '#f2853b', '#e8a33d', '#fff0c2', '#d97a2b'],
    decor: 'comb',
  },
  winter: {
    name: 'winter',
    bgTop: '#0a1e2e', bgBottom: '#040d16',
    boardEmpty: '#143043', boardEmptyEdge: '#3a6f96',
    wall: '#35546e',
    accent: '#bfe3ff',
    cells: ['#bfe3ff', '#7fc4ff', '#e8f6ff', '#a8d8ff', '#5f9fd8', '#f2fbff'],
    decor: 'frost',
  },
};
