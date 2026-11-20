// TILE TRIAD · 关卡数据（M1 拥有）
// 契约：docs/README.md §4（12 关 3 章逐字落实）。
// 字段：index/scene/slotCap/types/totalTiles/cols/rows/layers/
//       feature/timeLimit/undo/shuffle/newElement/difficulty。
// 坐标约定：stack 布局由 generate.js 依据 cols×rows 生成；此处只给参数。
// 全部关卡由 board.js 的生成器 + 回溯求解器验证存在不依赖道具的解（单测覆盖）。

export const LEVELS = [
  {
    index: 1, scene: 'dawn-market', slotCap: 7, types: 6, totalTiles: 18,
    cols: 3, rows: 3, layers: 2,
    feature: 'basic', timeLimit: null, undo: 1, shuffle: 0, difficulty: 1,
    newElement: 'basic',
  },
  {
    index: 2, scene: 'dawn-market', slotCap: 7, types: 7, totalTiles: 24,
    cols: 4, rows: 3, layers: 3,
    feature: 'basic', timeLimit: null, undo: 1, shuffle: 0, difficulty: 1.5,
    newElement: 'depth3',
  },
  {
    index: 3, scene: 'dawn-market', slotCap: 6, types: 8, totalTiles: 24,
    cols: 4, rows: 3, layers: 3,
    feature: 'basic', timeLimit: null, undo: 1, shuffle: 0, difficulty: 2.2,
    newElement: 'slot6',
  },
  {
    index: 4, scene: 'dawn-market', slotCap: 6, types: 8, totalTiles: 30,
    cols: 4, rows: 4, layers: 4,
    feature: 'cap', timeLimit: null, undo: 1, shuffle: 0, difficulty: 2.8,
    newElement: 'capLayer',
  },
  {
    index: 5, scene: 'afternoon-market', slotCap: 6, types: 9, totalTiles: 30,
    cols: 4, rows: 4, layers: 4,
    feature: 'twin', timeLimit: null, undo: 1, shuffle: 0, difficulty: 3.2,
    newElement: 'twinTowers',
  },
  {
    index: 6, scene: 'afternoon-market', slotCap: 6, types: 9, totalTiles: 36,
    cols: 5, rows: 3, layers: 4,
    feature: 'lock', timeLimit: null, undo: 1, shuffle: 0, difficulty: 3.6,
    newElement: 'fakeLock',
  },
  {
    index: 7, scene: 'afternoon-market', slotCap: 6, types: 10, totalTiles: 36,
    cols: 5, rows: 4, layers: 5,
    feature: 'basic', timeLimit: null, undo: 1, shuffle: 0, difficulty: 4.2,
    newElement: 'depth5',
  },
  {
    index: 8, scene: 'afternoon-market', slotCap: 6, types: 10, totalTiles: 36,
    cols: 5, rows: 4, layers: 5,
    feature: 'timed', timeLimit: 90, undo: 1, shuffle: 0, difficulty: 4.6,
    newElement: 'timed',
  },
  {
    index: 9, scene: 'night-market', slotCap: 6, types: 11, totalTiles: 42,
    cols: 5, rows: 4, layers: 5,
    feature: 'basic', timeLimit: null, undo: 1, shuffle: 0, difficulty: 5,
    newElement: 'types11',
  },
  {
    index: 10, scene: 'night-market', slotCap: 6, types: 11, totalTiles: 42,
    cols: 5, rows: 4, layers: 5,
    feature: 'prop', timeLimit: null, undo: 2, shuffle: 1, difficulty: 5.4,
    newElement: 'propLoadout',
  },
  {
    index: 11, scene: 'night-market', slotCap: 6, types: 12, totalTiles: 48,
    cols: 6, rows: 4, layers: 5,
    feature: 'lock', timeLimit: null, undo: 2, shuffle: 1, difficulty: 6,
    newElement: 'types12',
  },
  {
    index: 12, scene: 'night-market', slotCap: 6, types: 12, totalTiles: 48,
    cols: 6, rows: 4, layers: 5,
    feature: 'cap', timeLimit: 75, undo: 2, shuffle: 1, difficulty: 6.5,
    newElement: 'final',
  },
];

export const LEVEL_COUNT = LEVELS.length;

// 三章：晨光集市 / 午后市集 / 灯会夜市（换章必换场景）
export const CHAPTERS = [
  { from: 1, to: 4, key: 'dawn-market' },
  { from: 5, to: 8, key: 'afternoon-market' },
  { from: 9, to: 12, key: 'night-market' },
];

export function sceneOfLevel(index) {
  const lv = LEVELS[index] || LEVELS[0];
  return lv.scene;
}
