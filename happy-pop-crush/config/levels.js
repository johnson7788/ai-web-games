// HAPPY POP CRUSH · 关卡数据（M1 拥有）
// 字段：index / name{en,zh} / target(过关分) / moves(步数上限) / colors(颜色种类) /
//       rocks([r,c] 岩石格) / hammers(锤子道具数) / newElement(本关新元素)
// 坐标约定：[r, c]，r=行(0..ROWS-1)，c=列(0..COLS-1)。ROWS=COLS=8。

export const LEVELS = [
  {
    index: 1,
    name: { en: 'First Spark', zh: '第一道火花' },
    target: 1500, moves: 20, colors: 5, rocks: [], hammers: 1,
    newElement: '基础三消：相邻交换凑 3 连',
  },
  {
    index: 2,
    name: { en: 'Stone Field', zh: '石头地' },
    target: 2000, moves: 18, colors: 5, rocks: [[3, 3], [4, 4]], hammers: 1,
    newElement: '岩石格：挡路，相邻消除可震碎',
  },
  {
    index: 3,
    name: { en: 'Four Corners', zh: '四角埋伏' },
    target: 2500, moves: 16, colors: 6, rocks: [[2, 2], [2, 5], [5, 2], [5, 5]], hammers: 1,
    newElement: '六色全开 + 四角岩石',
  },
  {
    index: 4,
    name: { en: 'Line Fever', zh: '直线狂热' },
    target: 3000, moves: 18, colors: 6, rocks: [[1, 4], [6, 3]], hammers: 1,
    newElement: '4 连生成行/列特殊宝石',
  },
  {
    index: 5,
    name: { en: 'Crossroads', zh: '十字路口' },
    target: 3500, moves: 16, colors: 6, rocks: [[2, 3], [3, 2], [4, 5], [5, 4]], hammers: 1,
    newElement: 'L/T 形生成包裹爆炸（3×3）',
  },
  {
    index: 6,
    name: { en: 'Rainbow Rush', zh: '彩虹冲刺' },
    target: 4000, moves: 20, colors: 6, rocks: [[1, 1], [1, 6], [6, 1], [6, 6]], hammers: 1,
    newElement: '5 连生成彩虹鸟（清一整色）',
  },
  {
    index: 7,
    name: { en: 'Edges', zh: '边缘压力' },
    target: 5000, moves: 18, colors: 6, rocks: [[0, 2], [2, 0], [5, 7], [7, 5]], hammers: 2,
    newElement: '边缘岩石 + 双锤',
  },
  {
    index: 8,
    name: { en: 'Neon Finale', zh: '霓虹终章' },
    target: 6000, moves: 20, colors: 6,
    rocks: [[2, 2], [2, 5], [3, 3], [3, 4], [4, 3], [4, 4], [5, 2], [5, 5]],
    hammers: 2,
    newElement: '中心岩石阵 + 高目标连击收尾',
  },
];

export const LEVEL_COUNT = LEVELS.length;
