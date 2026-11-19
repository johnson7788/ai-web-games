// 关卡配置（1 基 index）：时间 / 目标分 / 星级阈值 / 物品预算
// item counts 决定生成哪些物品；具体位置由 sim 按 seed 在矿坑里确定性铺放。
export const LEVELS = [
  {
    index: 1,
    name: { en: 'Carrot Hollow', zh: '胡萝卜谷' },
    time: 50,
    target: 30,
    stars: [30, 45, 60],
    counts: { gold1: 4, gold2: 3, gold3: 1, diamond: 1, rock: 2, carrot: 1 },
  },
  {
    index: 2,
    name: { en: 'Rubble Run', zh: '碎石道' },
    time: 45,
    target: 45,
    stars: [45, 65, 85],
    counts: { gold1: 3, gold2: 3, gold3: 2, diamond: 2, rock: 2, carrot: 1 },
  },
  {
    index: 3,
    name: { en: 'Deep Glow', zh: '深光矿' },
    time: 40,
    target: 60,
    stars: [60, 85, 110],
    counts: { gold1: 2, gold2: 3, gold3: 2, diamond: 3, rock: 2, carrot: 1 },
  },
  {
    index: 4,
    name: { en: 'Diamond Drop', zh: '钻石矿脉' },
    time: 38,
    target: 70,
    stars: [70, 95, 120],
    counts: { gold1: 1, gold2: 2, gold3: 3, diamond: 3, rock: 3, carrot: 1 },
  },
  {
    index: 5,
    name: { en: 'Bunny Warren', zh: '兔穴尽头' },
    time: 35,
    target: 80,
    stars: [80, 110, 140],
    counts: { gold1: 1, gold2: 2, gold3: 3, diamond: 3, rock: 3, carrot: 1 },
  },
];

export const LEVEL_COUNT = LEVELS.length;

export function totalGold(level) {
  const c = level.counts || {};
  return (c.gold1 || 0) * 2 + (c.gold2 || 0) * 5 + (c.gold3 || 0) * 10 + (c.diamond || 0) * 20;
}
