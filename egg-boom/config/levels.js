// EGG BOOM · 12 关定义：每关一个新元素 + 场景包（换章换色板/构图/装饰）
// 场景包：1–4 清晨厨房（暖白）/ 5–8 甜品站（粉）/ 9–12 午夜食堂（靛蓝）

export const LEVELS = [
  {
    index: 1,
    name: 'level.1',
    scene: 'kitchen',          // 清晨厨房
    pattern: 'basic',          // 基础团（教：射碎数字团 + 跳过）
    fill: 3,                   // 每排填充数
    armoredRate: 0,
    movingRate: 0,
  },
  {
    index: 2,
    name: 'level.2',
    scene: 'kitchen',
    pattern: 'high',           // 高数字团
    fill: 3,
    armoredRate: 0,
    movingRate: 0,
  },
  {
    index: 3,
    name: 'level.3',
    scene: 'kitchen',
    pattern: 'floating',       // 悬空团：无地面行，全部悬空 + 空隙
    fill: 3,
    armoredRate: 0,
    movingRate: 0,
  },
  {
    index: 4,
    name: 'level.4',
    scene: 'kitchen',
    pattern: 'moving',         // 移动团：垂直往返
    fill: 3,
    armoredRate: 0,
    movingRate: 0.45,
  },
  {
    index: 5,
    name: 'level.5',
    scene: 'dessert',          // 甜品站（粉）
    pattern: 'doubleGap',      // 双排夹缝
    fill: 4,
    armoredRate: 0,
    movingRate: 0.2,
  },
  {
    index: 6,
    name: 'level.6',
    scene: 'dessert',
    pattern: 'armored',        // 护甲团（需蛋黄弹）
    fill: 3,
    armoredRate: 0.5,
    movingRate: 0.15,
  },
  {
    index: 7,
    name: 'level.7',
    scene: 'dessert',
    pattern: 'moving',         // 移动 + 高数字
    fill: 4,
    armoredRate: 0.1,
    movingRate: 0.5,
  },
  {
    index: 8,
    name: 'level.8',
    scene: 'dessert',
    pattern: 'doubleGap',      // 夹缝 + 护甲
    fill: 4,
    armoredRate: 0.35,
    movingRate: 0.2,
  },
  {
    index: 9,
    name: 'level.9',
    scene: 'canteen',          // 午夜食堂（靛蓝）
    pattern: 'high',           // 高数字 + 移动
    fill: 4,
    armoredRate: 0.15,
    movingRate: 0.45,
  },
  {
    index: 10,
    name: 'level.10',
    scene: 'canteen',
    pattern: 'doubleGap',      // 夹缝 + 护甲
    fill: 4,
    armoredRate: 0.4,
    movingRate: 0.25,
  },
  {
    index: 11,
    name: 'level.11',
    scene: 'canteen',
    pattern: 'mixed',          // 全特征混合
    fill: 5,
    armoredRate: 0.45,
    movingRate: 0.5,
  },
  {
    index: 12,
    name: 'level.12',
    scene: 'canteen',
    pattern: 'finale',         // 终极：高密度 + 护甲 + 移动
    fill: 6,
    armoredRate: 0.55,
    movingRate: 0.55,
  },
];

export const SCENES = {
  kitchen: { index: 1, key: 'scene.kitchen' },
  dessert: { index: 2, key: 'scene.dessert' },
  canteen: { index: 3, key: 'scene.canteen' },
};

export function levelDef(level) {
  return LEVELS[clampLevel(level) - 1];
}

export function sceneOf(level) {
  return levelDef(level).scene;
}

export function clampLevel(level) {
  return Math.max(1, Math.min(LEVELS.length, Math.floor(level)));
}
