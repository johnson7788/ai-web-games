// SNAKE ARENA · 12 场名次赛定义
// 每场 90s；AI 数量 / 攻击性 / 食物密度轮换；三场景包：数据核心(蓝) / 熔断区(橙红) / 深网(紫黑)。
// theme ∈ 'core' | 'meltdown' | 'deepnet'（render/theme.js 据此换色板 + 构图 + 装饰）。

export const ROUNDS = [
  { index: 1, nameKey: 'round.1',  theme: 'core',     aiCount: 4, aggression: 0.00, foodDensity: 38, newElementKey: 'novel.1' },
  { index: 2, nameKey: 'round.2',  theme: 'core',     aiCount: 5, aggression: 0.10, foodDensity: 36, newElementKey: 'novel.2' },
  { index: 3, nameKey: 'round.3',  theme: 'core',     aiCount: 5, aggression: 0.16, foodDensity: 34, newElementKey: 'novel.3' },
  { index: 4, nameKey: 'round.4',  theme: 'core',     aiCount: 5, aggression: 0.24, foodDensity: 34, newElementKey: 'novel.4' },
  { index: 5, nameKey: 'round.5',  theme: 'meltdown', aiCount: 5, aggression: 0.34, foodDensity: 36, newElementKey: 'novel.5' },
  { index: 6, nameKey: 'round.6',  theme: 'meltdown', aiCount: 6, aggression: 0.40, foodDensity: 38, newElementKey: 'novel.6' },
  { index: 7, nameKey: 'round.7',  theme: 'meltdown', aiCount: 6, aggression: 0.46, foodDensity: 40, newElementKey: 'novel.7' },
  { index: 8, nameKey: 'round.8',  theme: 'meltdown', aiCount: 6, aggression: 0.52, foodDensity: 42, newElementKey: 'novel.8' },
  { index: 9,  nameKey: 'round.9',  theme: 'deepnet', aiCount: 6, aggression: 0.58, foodDensity: 44, newElementKey: 'novel.9' },
  { index: 10, nameKey: 'round.10', theme: 'deepnet', aiCount: 6, aggression: 0.64, foodDensity: 46, newElementKey: 'novel.10' },
  { index: 11, nameKey: 'round.11', theme: 'deepnet', aiCount: 6, aggression: 0.70, foodDensity: 48, newElementKey: 'novel.11' },
  { index: 12, nameKey: 'round.12', theme: 'deepnet', aiCount: 6, aggression: 0.80, foodDensity: 50, newElementKey: 'novel.12' },
];

export function roundDef(index) {
  return ROUNDS[Math.max(0, Math.min(ROUNDS.length - 1, index - 1))];
}
