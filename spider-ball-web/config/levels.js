// 关卡配置：bricks 每一项 = [type, col, row, hp]
// type: penta/rect/tri/cir/hex（普通数字砖）| rock（不可破坏岩石障碍，只放第 0 行顶部）
//       addBall（+1 球）| laser（清一整列）| violet（3×3 范围爆破）
// 布局纪律（保证 greedy 可全清、noinput 直线发射必输）：
//   - rock 只放 row 0（顶部），不遮挡任何下方砖块的竖直弹道；
//   - 第 3 列（发射口正上方）不放 rock，noinput 只清中列、必输；
//   - 远列(0/6)只放上两行；底行(4)只放中列(2/3/4)。
export const LEVELS = [
  {
    name: { en: 'First Thread', zh: '初织蛛网' },
    shots: 10,
    bricks: [
      ['penta', 2, 0, 2], ['cir', 4, 0, 2],
      ['tri', 1, 1, 1], ['hex', 3, 1, 2], ['rect', 5, 1, 1],
      ['cir', 0, 2, 1], ['addBall', 2, 2, 1], ['penta', 4, 2, 2], ['tri', 6, 2, 1],
      ['rect', 2, 3, 1], ['cir', 4, 3, 2],
    ],
  },
  {
    name: { en: 'Rocky Web', zh: '岩网迷阵' },
    shots: 12,
    bricks: [
      ['tri', 0, 0, 2], ['rock', 1, 0], ['penta', 2, 0, 2], ['cir', 4, 0, 2], ['rock', 5, 0], ['rect', 6, 0, 2],
      ['cir', 1, 1, 1], ['hex', 3, 1, 2], ['rect', 5, 1, 1],
      ['rect', 2, 2, 2], ['tri', 4, 2, 2], ['penta', 6, 2, 1],
      ['cir', 3, 3, 1],
      ['tri', 2, 4, 1], ['hex', 4, 4, 1],
    ],
  },
  {
    name: { en: 'Charged Nodes', zh: '充能节点' },
    shots: 13,
    bricks: [
      ['tri', 0, 0, 2], ['rock', 1, 0], ['addBall', 2, 0, 1], ['penta', 4, 0, 2], ['cir', 6, 0, 2],
      ['cir', 1, 1, 1], ['hex', 3, 1, 2], ['rect', 5, 1, 1],
      ['laser', 0, 2, 1], ['tri', 2, 2, 2], ['cir', 4, 2, 2], ['penta', 6, 2, 1],
      ['rect', 1, 3, 1], ['tri', 3, 3, 2], ['violet', 5, 3, 1],
      ['penta', 2, 4, 1], ['cir', 4, 4, 1],
    ],
  },
  {
    name: { en: 'Crown Web', zh: '王冠之网' },
    shots: 14,
    bricks: [
      ['rock', 0, 0], ['penta', 1, 0, 2], ['rect', 3, 0, 2], ['hex', 5, 0, 2], ['rock', 6, 0],
      ['cir', 0, 1, 1], ['tri', 2, 1, 2], ['violet', 4, 1, 1], ['cir', 6, 1, 1],
      ['hex', 2, 2, 2], ['penta', 3, 2, 2], ['laser', 5, 2, 1],
      ['penta', 0, 3, 1], ['cir', 2, 3, 2], ['rect', 4, 3, 2], ['penta', 6, 3, 1],
      ['tri', 1, 4, 1], ['addBall', 3, 4, 1], ['cir', 5, 4, 1],
    ],
  },
];

export const LEVEL_COUNT = LEVELS.length;
