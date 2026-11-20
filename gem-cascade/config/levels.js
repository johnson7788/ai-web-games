// 关卡与特性轮换（12 关）。每关只有一个新元素（fun-audit 校验不重复）。
// 特性字段：
//   colors      5|6 色数
//   rockEdges   true = 边界岩块（不可消）
//   rocks       随机岩块数量（不可消，占据格位）
//   doubleColor true = 随机一色分 ×2
//   sinking     true = 沉底宝石（每次消除后顶部补新矿，矿脉持续下压）
//   moveLimit   限定步数（null = 不限）
//   chargeRate  矿镐蓄力速率（默认 1，蓄力关 2）
//   frozen      冰封宝石数量（相邻消除后解冻，冻结不可选）
export const LEVELS = [
  { index: 1,  colors: 5, rockEdges: false, rocks: 0, doubleColor: false, sinking: false, moveLimit: null, chargeRate: 1, frozen: 0 },
  { index: 2,  colors: 6, rockEdges: false, rocks: 0, doubleColor: false, sinking: false, moveLimit: null, chargeRate: 1, frozen: 0 },
  { index: 3,  colors: 5, rockEdges: true,  rocks: 0, doubleColor: false, sinking: false, moveLimit: null, chargeRate: 1, frozen: 0 },
  { index: 4,  colors: 5, rockEdges: false, rocks: 0, doubleColor: true,  sinking: false, moveLimit: null, chargeRate: 1, frozen: 0 },
  { index: 5,  colors: 5, rockEdges: false, rocks: 0, doubleColor: false, sinking: true,  moveLimit: null, chargeRate: 1, frozen: 0 },
  { index: 6,  colors: 5, rockEdges: false, rocks: 0, doubleColor: false, sinking: false, moveLimit: 30,  chargeRate: 1, frozen: 0 },
  { index: 7,  colors: 5, rockEdges: false, rocks: 0, doubleColor: false, sinking: false, moveLimit: null, chargeRate: 2, frozen: 0 },
  { index: 8,  colors: 5, rockEdges: false, rocks: 0, doubleColor: false, sinking: false, moveLimit: null, chargeRate: 1, frozen: 6 },
  { index: 9,  colors: 5, rockEdges: false, rocks: 4, doubleColor: false, sinking: false, moveLimit: null, chargeRate: 1, frozen: 0 },
  { index: 10, colors: 6, rockEdges: false, rocks: 0, doubleColor: true,  sinking: false, moveLimit: null, chargeRate: 1, frozen: 0 },
  { index: 11, colors: 5, rockEdges: false, rocks: 0, doubleColor: false, sinking: true,  moveLimit: 30,  chargeRate: 1, frozen: 0 },
  { index: 12, colors: 6, rockEdges: false, rocks: 3, doubleColor: true,  sinking: false, moveLimit: 40,  chargeRate: 1, frozen: 0 },
];

export const LEVEL_COUNT = LEVELS.length;

export function levelAt(index) {
  return LEVELS[clamp(index - 1, 0, LEVEL_COUNT - 1)];
}

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

/** 三场景包：按关卡区间换色板/构图/装饰。1-4 萤石洞 / 5-8 铜矿坑 / 9-12 极光冰洞。 */
export function themeFor(level) {
  const lv = clamp(Math.floor(level) || 1, 1, LEVEL_COUNT);
  if (lv <= 4) return 1;
  if (lv <= 8) return 2;
  return 3;
}
