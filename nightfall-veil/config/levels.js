// 20 关数值，1:1 从参考玩法（夜幕降临 game05）提取。
// 字段：
//   countdown   开局倒计时（秒）
//   createRate  每秒生成几道算式
//   downSpeed   下落速度（×WORLD.HEIGHT px/s）
//   timeLimit   本关时间（秒），撑过即过关
//   maxMissCount 允许遗漏上限（0 = 一道都不能漏）
//   types       [项数, 位数, 权重] 的列表；项数 2/3/4，位数 1（个位）
export const LEVELS = [
  { index: 1, countdown: 1.5, createRate: 1, downSpeed: 0.1, timeLimit: 60, maxMissCount: 0, types: [[2, 1, 1]] },
  { index: 2, countdown: 1.5, createRate: 2, downSpeed: 0.1, timeLimit: 60, maxMissCount: 0, types: [[2, 1, 1]] },
  { index: 3, countdown: 1.5, createRate: 2, downSpeed: 0.1, timeLimit: 60, maxMissCount: 0, types: [[2, 1, 0.75], [3, 1, 0.25]] },
  { index: 4, countdown: 1.5, createRate: 2, downSpeed: 0.2, timeLimit: 60, maxMissCount: 0, types: [[2, 1, 0.75], [3, 1, 0.25]] },
  { index: 5, countdown: 1.5, createRate: 2, downSpeed: 0.2, timeLimit: 60, maxMissCount: 0, types: [[2, 1, 0.5], [3, 1, 0.5]] },
  { index: 6, countdown: 1.5, createRate: 3, downSpeed: 0.2, timeLimit: 60, maxMissCount: 0, types: [[2, 1, 0.5], [3, 1, 0.5]] },
  { index: 7, countdown: 1.5, createRate: 3, downSpeed: 0.2, timeLimit: 60, maxMissCount: 0, types: [[2, 1, 0.25], [3, 1, 0.75]] },
  { index: 8, countdown: 1.5, createRate: 3, downSpeed: 0.2, timeLimit: 60, maxMissCount: 0, types: [[2, 1, 0.25], [3, 1, 0.75]] },
  { index: 9, countdown: 1.5, createRate: 3, downSpeed: 0.2, timeLimit: 60, maxMissCount: 0, types: [[3, 1, 1]] },
  { index: 10, countdown: 1.5, createRate: 3, downSpeed: 0.2, timeLimit: 60, maxMissCount: 0, types: [[3, 1, 1]] },
  { index: 11, countdown: 1.5, createRate: 4, downSpeed: 0.2, timeLimit: 60, maxMissCount: 1, types: [[2, 1, 0.25], [3, 1, 0.75]] },
  { index: 12, countdown: 1.5, createRate: 4, downSpeed: 0.2, timeLimit: 60, maxMissCount: 1, types: [[2, 1, 0.5], [3, 1, 0.5]] },
  { index: 13, countdown: 1.5, createRate: 4, downSpeed: 0.2, timeLimit: 60, maxMissCount: 1, types: [[3, 1, 0.25], [4, 1, 0.75]] },
  { index: 14, countdown: 1.5, createRate: 4, downSpeed: 0.2, timeLimit: 60, maxMissCount: 1, types: [[4, 1, 1]] },
  { index: 15, countdown: 1.5, createRate: 5, downSpeed: 0.2, timeLimit: 60, maxMissCount: 1, types: [[4, 1, 1]] },
  { index: 16, countdown: 1.5, createRate: 5, downSpeed: 0.2, timeLimit: 60, maxMissCount: 1, types: [[2, 1, 1]] },
  { index: 17, countdown: 1.5, createRate: 5, downSpeed: 0.2, timeLimit: 60, maxMissCount: 1, types: [[2, 1, 0.75], [3, 1, 0.25]] },
  { index: 18, countdown: 1.5, createRate: 5, downSpeed: 0.2, timeLimit: 60, maxMissCount: 1, types: [[2, 1, 0.5], [3, 1, 0.5]] },
  { index: 19, countdown: 1.5, createRate: 5, downSpeed: 0.2, timeLimit: 60, maxMissCount: 1, types: [[2, 1, 0.25], [3, 1, 0.75]] },
  { index: 20, countdown: 1.5, createRate: 5, downSpeed: 0.2, timeLimit: 60, maxMissCount: 1, types: [[3, 1, 1]] },
];

export const LEVEL_COUNT = LEVELS.length;
