// ABYSS EEL · M1 5 深度带定义
// 深度带：阳光带 / 暮光带 / 午夜带 / 深渊带 / 热泉带
// 深度范围（m）：0–300 / 300–700 / 700–1200 / 1200–1800 / 1800–2100（之后无尽续潜）

export const ZONES = [
  {
    index: 1,
    name: 'zone.1', // i18n key（getHud().zoneName / zoneEnter.name 都用它，非文案）
    minDepth: 0,
    maxDepth: 300,
    scroll: 140, // px/s（zone1 140 → zone5 240）
    wallValue: [1, 9], // 墙值范围（对 wallValueAt 结果再 clamp）
    dark: 0, // 暗度（render 用；前两带全亮）
    decor: 'sunlit', // 装饰主题（render 用）
    patterns: ['single', 'corridor'], // 生成模式
    foods: ['spark'], // 食物种类
  },
  {
    index: 2,
    name: 'zone.2',
    minDepth: 300,
    maxDepth: 700,
    scroll: 165,
    wallValue: [2, 14],
    dark: 0,
    decor: 'twilight',
    patterns: ['single', 'gap', 'moving'],
    foods: ['spark'],
  },
  {
    index: 3,
    name: 'zone.3',
    minDepth: 700,
    maxDepth: 1200,
    scroll: 190,
    wallValue: [3, 20],
    dark: 0.5,
    decor: 'midnight',
    patterns: ['single', 'gap', 'corridor', 'moving'],
    foods: ['spark', 'gold'],
  },
  {
    index: 4,
    name: 'zone.4',
    minDepth: 1200,
    maxDepth: 1800,
    scroll: 215,
    wallValue: [4, 30],
    dark: 0.75,
    decor: 'abyss',
    patterns: ['single', 'gap', 'fork', 'urchin'],
    foods: ['spark', 'gold'],
  },
  {
    index: 5,
    name: 'zone.5',
    minDepth: 1800,
    maxDepth: Infinity,
    scroll: 240,
    wallValue: [6, 60],
    dark: 1,
    decor: 'vent',
    patterns: ['gap', 'fork', 'urchin', 'moving'],
    foods: ['spark', 'gold'],
  },
];

export const ZONE_COUNT = ZONES.length;

// depth（米）→ zone index（1-based）
export function zoneIndex(depth) {
  for (const z of ZONES) {
    if (depth >= z.minDepth && depth < z.maxDepth) return z.index;
  }
  return ZONES[ZONES.length - 1].index; // 无尽续潜（>=2100 仍是热泉带）
}

// depth（米）→ zone 对象
export function zoneAt(depth) {
  return ZONES[zoneIndex(depth) - 1];
}
