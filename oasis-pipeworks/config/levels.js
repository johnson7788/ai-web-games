// Oasis Pipeworks · 关卡数据（M1 拥有）
// 契约：docs/README.md §4（12 关 3 章逐字落实）。
// 字段：index/scene/rows/cols/time/blockTime/rocks/blooms/start/end/queueCap/difficulty/
//       tutorial/failSafe/teachSteps/newElement/dig/lock。
// 坐标约定：[r, c]，r=行(0..rows-1)，c=列(0..cols-1)。
// start/end 自带 N 型管（top↔down），只存 entrance，exit 由 sim 取反（OPPOSITE）。
// rock/bloom 不压 start/end，bloom 不落在 rock 上；全部关卡由 solver 验证可解。

const N = (r, c, entrance = 'top') => ({ r, c, entrance });

// 注意：第 6 关起终点对调，start 在右下（水从底边进入、向上出），end 在左上（水从下方进入）。
const start = N;
const end = N;

export const LEVELS = [
  {
    index: 1, scene: 'dawn-desert', rows: 3, cols: 4,
    time: 45, blockTime: 3.5, // failSafe：水流 3.5s/格（宽松但观水不拖）
    rocks: [], blooms: [],
    start: start(0, 0, 'top'), end: end(2, 3, 'top'),
    queueCap: 3, difficulty: 1,
    tutorial: true, failSafe: true, teachSteps: ['grab', 'place', 'flow'],
    newElement: '基本管型（直/弯）',
    dig: false, lock: false,
  },
  {
    index: 2, scene: 'dawn-desert', rows: 4, cols: 5,
    time: 45, blockTime: 4,
    rocks: [], blooms: [],
    start: start(0, 0, 'top'), end: end(3, 4, 'top'),
    queueCap: 4, difficulty: 1.5,
    newElement: '队列预览 4 槽',
    dig: false, lock: false,
  },
  {
    index: 3, scene: 'dawn-desert', rows: 4, cols: 5,
    time: 45, blockTime: 4,
    rocks: [[1, 1], [2, 3]], blooms: [],
    start: start(0, 0, 'top'), end: end(3, 4, 'top'),
    queueCap: 4, difficulty: 2.2,
    newElement: '岩石格 + 解锁铲除',
    dig: true, lock: false,
  },
  {
    index: 4, scene: 'dawn-desert', rows: 4, cols: 6,
    time: 50, blockTime: 4,
    rocks: [[1, 2], [2, 4]], blooms: [[1, 3], [2, 2]],
    start: start(0, 0, 'top'), end: end(3, 5, 'top'),
    queueCap: 4, difficulty: 2.8,
    newElement: '花朵计星',
    dig: true, lock: false,
  },
  {
    index: 5, scene: 'dusk-canyon', rows: 4, cols: 6,
    time: 50, blockTime: 4,
    rocks: [[1, 1], [1, 4], [3, 3]], blooms: [[1, 3], [2, 4]],
    start: start(0, 0, 'top'), end: end(3, 5, 'top'),
    queueCap: 4, difficulty: 3.2,
    newElement: '十字管入队',
    dig: true, lock: false,
  },
  {
    index: 6, scene: 'dusk-canyon', rows: 4, cols: 6,
    time: 50, blockTime: 4,
    rocks: [[1, 3], [2, 2]], blooms: [[1, 1], [2, 4], [3, 2]],
    start: start(3, 5, 'down'), end: end(0, 0, 'down'),
    queueCap: 4, difficulty: 3.5,
    newElement: '起终点对调（逆向布管）',
    dig: true, lock: false,
  },
  {
    index: 7, scene: 'dusk-canyon', rows: 5, cols: 6,
    time: 55, blockTime: 4,
    rocks: [[1, 1], [2, 1], [3, 1], [1, 3], [2, 3]], blooms: [[2, 2], [3, 4]],
    start: start(0, 0, 'top'), end: end(4, 5, 'top'),
    queueCap: 4, difficulty: 4.2,
    newElement: '双岩石走廊窄缝',
    dig: true, lock: false,
  },
  {
    index: 8, scene: 'dusk-canyon', rows: 5, cols: 6,
    time: 55, blockTime: 3, // 水速 ×1.3
    rocks: [[1, 2], [2, 4], [3, 1]], blooms: [[1, 4], [2, 2], [3, 4]],
    start: start(0, 0, 'top'), end: end(4, 5, 'top'),
    queueCap: 5, difficulty: 4.6,
    newElement: '水速 ×1.3',
    dig: true, lock: false,
  },
  {
    index: 9, scene: 'night-oasis', rows: 5, cols: 6,
    time: 55, blockTime: 4,
    rocks: [[2, 2], [3, 3]], blooms: [[1, 1], [1, 2], [1, 3], [2, 4], [3, 1]],
    start: start(0, 0, 'top'), end: end(4, 5, 'top'),
    queueCap: 5, difficulty: 5,
    newElement: '三连花田',
    dig: true, lock: false,
  },
  {
    index: 10, scene: 'night-oasis', rows: 5, cols: 7,
    time: 60, blockTime: 4,
    rocks: [[1, 2], [2, 4], [3, 1], [3, 5]], blooms: [[1, 4], [2, 2], [3, 4]],
    start: start(0, 0, 'top'), end: end(4, 6, 'top'),
    queueCap: 5, difficulty: 5.4,
    newElement: '队列锁定件',
    dig: true, lock: true,
  },
  {
    index: 11, scene: 'night-oasis', rows: 5, cols: 7,
    time: 60, blockTime: 4,
    rocks: [[1, 1], [1, 2], [1, 5], [3, 2], [3, 3], [3, 4]], blooms: [[2, 2], [2, 4], [4, 3]],
    start: start(0, 0, 'top'), end: end(4, 6, 'top'),
    queueCap: 5, difficulty: 6,
    newElement: '大网格长线规划',
    dig: true, lock: true,
  },
  {
    index: 12, scene: 'night-oasis', rows: 5, cols: 7,
    time: 60, blockTime: 3, // 水速 ×1.3
    rocks: [[1, 2], [1, 4], [2, 1], [3, 3], [3, 5], [4, 2]], blooms: [[1, 1], [1, 3], [2, 3], [3, 4], [4, 5]],
    start: start(0, 0, 'top'), end: end(4, 6, 'top'),
    queueCap: 5, difficulty: 6.5,
    newElement: '终章三轴叠加（岩石+花田+快水）',
    dig: true, lock: true,
  },
];

export const LEVEL_COUNT = LEVELS.length;
