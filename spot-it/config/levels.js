// config/levels.js — 12 关推进结构：清单件数 / 场景密度 / 诱饵率 / 场景包轮换。
// 关卡数值全部在这里；src/game/levelgen.js 只读这些参数 + 种子生成物品布局。
//
// 关卡字段：
//   index       关卡号（1..12）
//   scenePack   场景包下标（0 旧书摊 / 1 玩具堆 / 2 鬼市）
//   targetCount 清单目标种类数（清单 3→6 件）
//   copies      每个目标在场上出现份数（通常 1）
//   density     场上物品总数（目标 + 诱饵 + 填充物）
//   decoyRate   诱饵率（0..1；与目标同款孪生的比例）
//   timeSec     本关限时（秒）
//   scale       物品绘制缩放（高关卡更小）

export const LEVEL_COUNT = 12;

export const LEVELS = [
  { index: 1,  scenePack: 0, targetCount: 3, copies: 1, density: 16, decoyRate: 0.0,  timeSec: 45, scale: 1.30 },
  { index: 2,  scenePack: 0, targetCount: 3, copies: 1, density: 18, decoyRate: 0.0,  timeSec: 45, scale: 1.25 },
  { index: 3,  scenePack: 0, targetCount: 4, copies: 1, density: 20, decoyRate: 0.0,  timeSec: 45, scale: 1.20 },
  { index: 4,  scenePack: 0, targetCount: 4, copies: 1, density: 22, decoyRate: 0.18, timeSec: 45, scale: 1.15 },
  { index: 5,  scenePack: 1, targetCount: 5, copies: 1, density: 24, decoyRate: 0.18, timeSec: 42, scale: 1.10 },
  { index: 6,  scenePack: 1, targetCount: 5, copies: 1, density: 26, decoyRate: 0.22, timeSec: 42, scale: 1.05 },
  { index: 7,  scenePack: 1, targetCount: 5, copies: 1, density: 28, decoyRate: 0.30, timeSec: 40, scale: 1.00 },
  { index: 8,  scenePack: 1, targetCount: 6, copies: 1, density: 30, decoyRate: 0.30, timeSec: 40, scale: 0.95 },
  { index: 9,  scenePack: 2, targetCount: 6, copies: 1, density: 30, decoyRate: 0.34, timeSec: 38, scale: 0.90 },
  { index: 10, scenePack: 2, targetCount: 6, copies: 1, density: 32, decoyRate: 0.38, timeSec: 38, scale: 0.86 },
  { index: 11, scenePack: 2, targetCount: 6, copies: 1, density: 34, decoyRate: 0.42, timeSec: 36, scale: 0.84 },
  { index: 12, scenePack: 2, targetCount: 6, copies: 1, density: 36, decoyRate: 0.46, timeSec: 34, scale: 0.82 },
];

export function levelAt(n) {
  return LEVELS[Math.max(0, Math.min(LEVEL_COUNT - 1, (n || 1) - 1))];
}

export function scenePackFor(n) {
  return levelAt(n).scenePack;
}
