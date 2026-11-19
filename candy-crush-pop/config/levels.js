// CANDY CRUSH POP · 关卡数据
// 字段：index/rows/cols/moves/time/target/rocks/difficulty/tutorial/newElement。
// 坐标约定：[r, c]，r=行(0..rows-1，0=顶部)，c=列(0..cols-1，0=左)。
// rocks 为 [r, c, hp]：冰封岩石（frosted candy），hp=1 或 2；消除相邻糖果减层，归零即破冰。
// 全部关卡由 solver（findHint + reshuffle）保证开局至少存在一步可消。

const N = (r, c, hp = 1) => [r, c, hp];

export const LEVELS = [
  {
    index: 1, rows: 10, cols: 8,
    moves: 10, time: 60, target: 150,
    rocks: [], difficulty: 1,
    tutorial: true, newElement: '基础三连消除（教学）',
  },
  {
    index: 2, rows: 10, cols: 8,
    moves: 12, time: 70, target: 260,
    rocks: [], difficulty: 1.5,
    newElement: '步数 + 目标分结算闭环',
  },
  {
    index: 3, rows: 10, cols: 8,
    moves: 14, time: 80, target: 380,
    rocks: [N(2, 3), N(4, 4), N(6, 2), N(7, 5)],
    difficulty: 2.2, newElement: '冰封岩石（1 层）',
  },
  {
    index: 4, rows: 10, cols: 8,
    moves: 16, time: 90, target: 540,
    rocks: [N(1, 1, 2), N(3, 6, 2), N(5, 2), N(8, 5)],
    difficulty: 2.8, newElement: '双层冰封岩石',
  },
  {
    index: 5, rows: 10, cols: 8,
    moves: 18, time: 90, target: 760,
    rocks: [N(2, 2), N(4, 5), N(6, 3), N(7, 6), N(3, 1)],
    difficulty: 3.2, newElement: '连击倍率（连击条）',
  },
  {
    index: 6, rows: 10, cols: 8,
    moves: 20, time: 100, target: 980,
    rocks: [N(1, 4), N(3, 2), N(5, 6), N(7, 1), N(8, 4)],
    difficulty: 3.5, newElement: '连击奖励加步',
  },
  {
    index: 7, rows: 10, cols: 8,
    moves: 22, time: 100, target: 1200,
    rocks: [N(1, 1), N(2, 6), N(4, 3), N(5, 5), N(7, 2), N(8, 6)],
    difficulty: 4.2, newElement: '密集冰封阵',
  },
  {
    index: 8, rows: 10, cols: 8,
    moves: 24, time: 110, target: 1480,
    rocks: [N(1, 3), N(2, 5), N(4, 1), N(5, 4), N(6, 6), N(8, 2)],
    difficulty: 4.6, newElement: '目标分跳涨',
  },
  {
    index: 9, rows: 10, cols: 8,
    moves: 26, time: 110, target: 1750,
    rocks: [N(1, 2), N(2, 4, 2), N(3, 6), N(4, 1), N(5, 3), N(6, 5), N(7, 7)],
    difficulty: 5.0, newElement: '岩石 + 冰封混合阵',
  },
  {
    index: 10, rows: 10, cols: 8,
    moves: 28, time: 120, target: 2050,
    rocks: [N(1, 1, 2), N(2, 6, 2), N(4, 3, 2), N(5, 2), N(6, 5), N(8, 4, 2)],
    difficulty: 5.4, newElement: '双层岩石群',
  },
  {
    index: 11, rows: 10, cols: 8,
    moves: 30, time: 120, target: 2350,
    rocks: [N(1, 3), N(2, 5), N(3, 1), N(4, 6), N(6, 2), N(7, 4), N(8, 7)],
    difficulty: 6.0, newElement: '高分马拉松',
  },
  {
    index: 12, rows: 10, cols: 8,
    moves: 34, time: 130, target: 2650,
    rocks: [N(1, 2, 2), N(2, 4), N(3, 6, 2), N(4, 1), N(5, 3), N(6, 5, 2), N(7, 7), N(8, 2)],
    difficulty: 6.5, newElement: '终章三轴（岩石 + 连击 + 高分）',
  },
];

export const LEVEL_COUNT = LEVELS.length;
