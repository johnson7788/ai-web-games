// MOSAIC SLIDE · 关卡数据（Lead 拥有）
// 12 关 3 章：滑块拼图（缺口在左上角 = 源码 isBlank(0,0)）。
// 字段：index/scene/rows/cols/cut/time/movePar/timePar/scramble/rotateCount/
//       rotate/blind/dual/timed/hex/grand/difficulty/newElement/chapter。
// 图案：每关由 config 层的确定性 seeded 生成（pattern.js），同关所有块来自同一花窗，
//       参考图与拼块永远一致；shuffle 只由 run seed 决定，可复现。
// 可解性：shuffle 用「随机游走缺口 + 记录路径」，天然可解；solver.js 另提供逆序奇偶判定做单测。

const L = (o) => ({
  cut: 'square',
  time: 150,
  movePar: 30,
  timePar: 36,
  scramble: 30,
  rotateCount: 0,
  rotate: false,
  blind: false,
  dual: false,
  timed: false,
  hex: false,
  grand: false,
  ...o,
});

export const LEVELS = [
  L({ index: 1, scene: 'workshop-dawn', chapter: 1, rows: 3, cols: 3,
    time: 90, movePar: 12, timePar: 20, scramble: 12, difficulty: 1,
    newElement: '3×3 基本滑块：缺口在左上角' }),
  L({ index: 2, scene: 'workshop-dawn', chapter: 1, rows: 4, cols: 4,
    time: 150, movePar: 24, timePar: 30, scramble: 24, difficulty: 1.5,
    newElement: '4×4 更密的棋盘' }),
  L({ index: 3, scene: 'workshop-dawn', chapter: 1, rows: 4, cols: 5,
    time: 150, movePar: 30, timePar: 36, scramble: 30, difficulty: 2.2,
    newElement: '4×5 矩形花窗（非正方形）' }),
  L({ index: 4, scene: 'workshop-dawn', chapter: 1, rows: 5, cols: 5,
    time: 180, movePar: 40, timePar: 45, scramble: 40, difficulty: 2.8,
    newElement: '5×5 大花窗' }),
  L({ index: 5, scene: 'glass-afternoon', chapter: 2, rows: 5, cols: 5, cut: 'hex',
    time: 180, movePar: 40, timePar: 45, scramble: 40, difficulty: 3.2, hex: true,
    newElement: '异形切：六边形琉璃片（视觉近似）' }),
  L({ index: 6, scene: 'glass-afternoon', chapter: 2, rows: 4, cols: 5,
    time: 90, movePar: 30, timePar: 30, scramble: 30, difficulty: 3.5, timed: true,
    newElement: '限时关：更紧张的时间预算' }),
  L({ index: 7, scene: 'glass-afternoon', chapter: 2, rows: 4, cols: 4,
    time: 150, movePar: 29, timePar: 34, scramble: 20, rotateCount: 9, difficulty: 4.2, rotate: true,
    newElement: '旋转块：碎片可旋转 90° 归位' }),
  L({ index: 8, scene: 'glass-afternoon', chapter: 2, rows: 5, cols: 5,
    time: 180, movePar: 40, timePar: 45, scramble: 40, difficulty: 4.6, blind: true,
    newElement: '盲拼关：参考图 5 秒后隐藏，可偷看' }),
  L({ index: 9, scene: 'candle-night', chapter: 3, rows: 4, cols: 5,
    time: 160, movePar: 30, timePar: 36, scramble: 30, difficulty: 5, dual: true,
    newElement: '双图交替：两幅纹样交织嵌套' }),
  L({ index: 10, scene: 'candle-night', chapter: 3, rows: 5, cols: 5,
    time: 120, movePar: 44, timePar: 40, scramble: 30, rotateCount: 14, difficulty: 5.4, rotate: true, timed: true,
    newElement: '旋转 + 限时叠加' }),
  L({ index: 11, scene: 'candle-night', chapter: 3, rows: 5, cols: 6,
    time: 200, movePar: 46, timePar: 52, scramble: 46, difficulty: 6, blind: true, dual: true,
    newElement: '盲拼 + 双图叠加（5×6）' }),
  L({ index: 12, scene: 'candle-night', chapter: 3, rows: 6, cols: 6,
    time: 240, movePar: 55, timePar: 60, scramble: 55, difficulty: 6.5, grand: true,
    newElement: '终章 6×6 大花窗' }),
];

export const LEVEL_COUNT = LEVELS.length;
