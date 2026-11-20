// config/levels.js — 12 层深度目标与特性轮换
// 每层：目标深度(rows)、三场景包 theme(0 黄土 / 1 化石暗河 / 2 熔核)、
//       洪水上涨速度(rows/s)、格子类型权重(采样用整数)、本层新元素说明。
// 权重为相对概率：dirt 软土 / rock 障碍岩 / diamond 钻石 / fossil 化石 / fault 断层 / lava 熔岩。
export const THEMES = [
  { id: 'loam',  name: 'theme.0' },   // 黄土层（暖褐）
  { id: 'fossil', name: 'theme.1' },  // 化石暗河（青黑）
  { id: 'core',  name: 'theme.2' },   // 熔核（红金）
];

export const LAYERS = [
  { index: 1, rows: 8, theme: 0, floodRise: 0.35, unlock: 1, fossilHard: 2,
    weights: { dirt: 100, rock: 6, diamond: 22, fossil: 6, fault: 0, lava: 0 },
    newElement: 'new.1' },
  { index: 2, rows: 8, theme: 0, floodRise: 0.40, unlock: 2, fossilHard: 2,
    weights: { dirt: 100, rock: 10, diamond: 24, fossil: 14, fault: 0, lava: 0 },
    newElement: 'new.2' },
  { index: 3, rows: 8, theme: 0, floodRise: 0.45, unlock: 3, fossilHard: 2,
    weights: { dirt: 100, rock: 14, diamond: 20, fossil: 16, fault: 22, lava: 0 },
    newElement: 'new.3' },
  { index: 4, rows: 8, theme: 0, floodRise: 0.50, unlock: 3, fossilHard: 2,
    weights: { dirt: 100, rock: 40, diamond: 16, fossil: 14, fault: 24, lava: 0 },
    newElement: 'new.4' },
  { index: 5, rows: 8, theme: 1, floodRise: 0.85, unlock: 3, fossilHard: 2,
    weights: { dirt: 100, rock: 20, diamond: 18, fossil: 40, fault: 14, lava: 0 },
    newElement: 'new.5' },
  { index: 6, rows: 8, theme: 1, floodRise: 0.90, unlock: 3, fossilHard: 5,
    weights: { dirt: 100, rock: 18, diamond: 14, fossil: 34, fault: 18, lava: 0 },
    newElement: 'new.6' },
  { index: 7, rows: 8, theme: 1, floodRise: 0.95, unlock: 3, fossilHard: 2,
    weights: { dirt: 100, rock: 16, diamond: 46, fossil: 20, fault: 16, lava: 0 },
    newElement: 'new.7' },
  { index: 8, rows: 8, theme: 1, floodRise: 1.00, unlock: 3, fossilHard: 3,
    weights: { dirt: 100, rock: 26, diamond: 18, fossil: 22, fault: 30, lava: 0 },
    newElement: 'new.8' },
  { index: 9, rows: 8, theme: 2, floodRise: 0.70, unlock: 3, fossilHard: 2,
    weights: { dirt: 100, rock: 24, diamond: 18, fossil: 16, fault: 20, lava: 26 },
    newElement: 'new.9' },
  { index: 10, rows: 8, theme: 2, floodRise: 0.80, unlock: 3, fossilHard: 2,
    weights: { dirt: 100, rock: 20, diamond: 34, fossil: 12, fault: 16, lava: 30 },
    newElement: 'new.10' },
  { index: 11, rows: 8, theme: 2, floodRise: 1.10, unlock: 3, fossilHard: 2,
    weights: { dirt: 100, rock: 16, diamond: 20, fossil: 10, fault: 14, lava: 38 },
    newElement: 'new.11' },
  { index: 12, rows: 8, theme: 2, floodRise: 0.60, unlock: 3, fossilHard: 2,
    weights: { dirt: 100, rock: 6, diamond: 30, fossil: 8, fault: 0, lava: 12 },
    newElement: 'new.12' },
];

export function layerAt(depth) {
  let acc = 0;
  for (const l of LAYERS) {
    acc += l.rows;
    if (depth < acc) return l;
  }
  return LAYERS[LAYERS.length - 1];
}

export function layerStartDepth(layerIndex) {
  let acc = 0;
  for (const l of LAYERS) {
    if (l.index >= layerIndex) return acc;
    acc += l.rows;
  }
  return acc;
}

export const TOTAL_ROWS = LAYERS.reduce((s, l) => s + l.rows, 0);
