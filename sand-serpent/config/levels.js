// Sand Serpent · 关卡数据（12 关 3 章，蛇形网格 12 行 × 20 列）
// 坐标约定：[r, c]，r=行(0..11)，c=列(0..19)。
// 字段：
//   index/scene/rows/cols/wrap/walls/cacti/hard/boosts/
//   scorpion/foodCount/thorn/sandstorm/start/goalLength/interval/difficulty/newElement
// wrap：穿边环绕（无墙）；walls：边框为墙；cacti/hard：内部障碍；boosts：加速带格。
// 食物：beetle 常驻；scorpion 从 L4 起；thorn 从 L9 起；L5 起 foodCount=2（双食同屏）。

const START = { r: 6, c: 9, dir: 'right' }; // 头朝右，身体向左延伸 (6,8),(6,7)

export const LEVELS = [
  {
    index: 1, scene: 'dunes', rows: 12, cols: 20,
    wrap: true, walls: false, cacti: [], hard: [], boosts: [],
    scorpion: false, foodCount: 1, thorn: false, sandstorm: false,
    start: START, goalLength: 6, interval: 0.18, difficulty: 1,
    newElement: 'wrap-around edges（穿边环绕，无墙）',
  },
  {
    index: 2, scene: 'dunes', rows: 12, cols: 20,
    wrap: false, walls: true, cacti: [], hard: [], boosts: [],
    scorpion: false, foodCount: 1, thorn: false, sandstorm: false,
    start: START, goalLength: 8, interval: 0.18, difficulty: 1.4,
    newElement: 'border walls（有墙，撞墙即死）',
  },
  {
    index: 3, scene: 'dunes', rows: 12, cols: 20,
    wrap: false, walls: true, cacti: [[3, 7], [8, 12], [4, 14], [9, 5]], hard: [], boosts: [],
    scorpion: false, foodCount: 1, thorn: false, sandstorm: false,
    start: START, goalLength: 10, interval: 0.17, difficulty: 2.0,
    newElement: 'cactus obstacles（仙人掌障碍）',
  },
  {
    index: 4, scene: 'dunes', rows: 12, cols: 20,
    wrap: false, walls: true, cacti: [[3, 7], [8, 12]], hard: [], boosts: [],
    scorpion: true, foodCount: 1, thorn: false, sandstorm: false,
    start: START, goalLength: 12, interval: 0.16, difficulty: 2.6,
    newElement: 'escaping scorpion（会横逃的蝎子，+3 分）',
  },
  {
    index: 5, scene: 'oasis', rows: 12, cols: 20,
    wrap: false, walls: true, cacti: [[4, 9], [7, 5]], hard: [], boosts: [],
    scorpion: true, foodCount: 2, thorn: false, sandstorm: false,
    start: START, goalLength: 14, interval: 0.16, difficulty: 3.2,
    newElement: 'two foods at once（双食同屏）',
  },
  {
    index: 6, scene: 'oasis', rows: 12, cols: 20,
    wrap: false, walls: true, cacti: [[3, 6], [8, 13]], hard: [], boosts: [[2, 3], [5, 15], [9, 8]],
    scorpion: true, foodCount: 2, thorn: false, sandstorm: false,
    start: START, goalLength: 15, interval: 0.16, difficulty: 3.8,
    newElement: 'speed boost tiles（加速带，踩到临时提速）',
  },
  {
    index: 7, scene: 'oasis', rows: 12, cols: 20,
    wrap: false, walls: true, cacti: [[3, 6], [8, 13]], hard: [[2, 2], [2, 3], [6, 10], [6, 11], [10, 16]], boosts: [],
    scorpion: true, foodCount: 2, thorn: false, sandstorm: false,
    start: START, goalLength: 16, interval: 0.15, difficulty: 4.4,
    newElement: 'hard ground（硬地格，不能穿过）',
  },
  {
    index: 8, scene: 'oasis', rows: 12, cols: 20,
    wrap: false, walls: true, cacti: [[3, 6], [8, 13]], hard: [], boosts: [],
    scorpion: true, foodCount: 2, thorn: false, sandstorm: true,
    start: START, goalLength: 17, interval: 0.15, difficulty: 4.8,
    newElement: 'periodic sandstorm（定时沙暴遮挡视野）',
  },
  {
    index: 9, scene: 'starlight', rows: 12, cols: 20,
    wrap: false, walls: true, cacti: [[4, 8], [7, 12]], hard: [], boosts: [],
    scorpion: true, foodCount: 2, thorn: true, sandstorm: false,
    start: START, goalLength: 18, interval: 0.15, difficulty: 5.2,
    newElement: 'camel thorn（骆驼刺，+5 分但掉一节尾巴）',
  },
  {
    index: 10, scene: 'starlight', rows: 12, cols: 20,
    wrap: false, walls: true, cacti: [[3, 5], [8, 14], [5, 10]], hard: [], boosts: [],
    scorpion: true, foodCount: 2, thorn: true, sandstorm: false,
    start: START, goalLength: 19, interval: 0.15, difficulty: 5.6,
    newElement: 'scorpion + cactus combo（蝎子+仙人掌组合）',
  },
  {
    index: 11, scene: 'starlight', rows: 12, cols: 20,
    wrap: false, walls: true, cacti: [[5, 15]], hard: [[3, 8], [3, 9], [7, 4], [7, 5]], boosts: [[4, 12], [6, 6], [9, 14]],
    scorpion: true, foodCount: 2, thorn: true, sandstorm: false,
    start: START, goalLength: 20, interval: 0.14, difficulty: 6.2,
    newElement: 'boost + hard ground combo（加速带+硬地组合）',
  },
  {
    index: 12, scene: 'starlight', rows: 12, cols: 20,
    wrap: false, walls: true, cacti: [[4, 6], [8, 13], [7, 14]], hard: [[2, 10], [2, 11], [9, 5], [9, 6]], boosts: [[5, 3], [7, 16]],
    scorpion: true, foodCount: 2, thorn: true, sandstorm: true,
    start: START, goalLength: 22, interval: 0.14, difficulty: 7.0,
    newElement: 'full storm finale（全要素综合）',
  },
];

export const LEVEL_COUNT = LEVELS.length;
