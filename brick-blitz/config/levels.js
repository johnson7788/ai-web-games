// BRICK BLITZ · 关卡数据（12 关 · 三座窑：青瓷窑 / 钧红窑 / 天青窑）
// pattern：字符串数组，每串一行，长度 === cols。
//   字符：'.' 空 · '1' 普通(1击) · '2' 硬(2击) · '3' 硬(3击) · 'g' 金釉 · 'b' 炸窑
// 可选特性字段：
//   moveCols: number[] —— 这些列左右漂移（移动砖列）
//   descend:  boolean   —— 砖墙整体缓降，压到 DESCEND_LINE 判负
//   startBalls: number  —— 开局多球（默认 1）
//   paddleW:  number    —— 覆盖挡板宽度（窄缝防守）
//   lives:    number    —— 覆盖生命数（默认 3）

export const LEVELS = [
  {
    index: 1, scene: 'celadon', cols: 8, newElement: '横排基础砖阵',
    name: { en: 'First Firing', zh: '初烧' },
    pattern: [
      '11111111',
      '11111111',
      '11111111',
    ],
  },
  {
    index: 2, scene: 'celadon', cols: 9, newElement: '金字塔阵 + 硬砖(2击)',
    name: { en: 'Glaze Pyramid', zh: '釉塔' },
    pattern: [
      '....2....',
      '...111...',
      '..11211..',
      '.1111111.',
    ],
  },
  {
    index: 3, scene: 'celadon', cols: 9, newElement: '空心阵（球会绕背）',
    name: { en: 'Hollow Kiln', zh: '空心窑' },
    pattern: [
      '111111111',
      '1.......1',
      '1..2.2..1',
      '1.......1',
      '111111111',
    ],
  },
  {
    index: 4, scene: 'celadon', cols: 9, newElement: '移动砖列',
    name: { en: 'Wandering Tiles', zh: '走窑' },
    moveCols: [0, 2, 4, 6, 8],
    pattern: [
      '2.1.1.1.2',
      '1.1.2.1.1',
      '1.1.1.1.1',
      '1.1.1.1.1',
    ],
  },
  {
    index: 5, scene: 'jun-red', cols: 9, newElement: '下压砖墙（压线判负）',
    name: { en: 'The Press', zh: '压窑' },
    descend: true,
    pattern: [
      '111.111.1',
      '111.111.1',
      '111.111.1',
    ],
  },
  {
    index: 6, scene: 'jun-red', cols: 9, newElement: '炸窑砖连锁',
    name: { en: 'Chain Fire', zh: '炸窑' },
    pattern: [
      '1.1b1.1b1',
      '.1.1.1.1.',
      '1b1.1.1b1',
      '1.1.1.1.1',
    ],
  },
  {
    index: 7, scene: 'jun-red', cols: 8, newElement: '窄缝防守（短挡板）',
    name: { en: 'Narrow Guard', zh: '窄缝' },
    paddleW: 80,
    pattern: [
      '11111111',
      '11.11.11',
      '11111111',
    ],
  },
  {
    index: 8, scene: 'jun-red', cols: 9, newElement: '多球雨',
    name: { en: 'Twin Beads', zh: '多球雨' },
    startBalls: 2,
    pattern: [
      '.1.111.1.',
      '111.1.111',
      '.1.111.1.',
      '1.1.1.1.1',
    ],
  },
  {
    index: 9, scene: 'sky-blue', cols: 9, newElement: '金釉砖（高分）',
    name: { en: 'Gold Glaze', zh: '金釉' },
    pattern: [
      '1.1g1g1.1',
      '1.11111.1',
      '1.1g1g1.1',
      '1.1.1.1.1',
    ],
  },
  {
    index: 10, scene: 'sky-blue', cols: 9, newElement: '硬砖阵（3击）',
    name: { en: 'Stoneware Wall', zh: '硬窑' },
    pattern: [
      '333.3.333',
      '333.3.333',
      '3.3.3.3.3',
    ],
  },
  {
    index: 11, scene: 'sky-blue', cols: 9, newElement: '移动列 + 下压复合',
    name: { en: 'Rushing Kiln', zh: '赶窑' },
    descend: true,
    moveCols: [1, 4, 7],
    pattern: [
      '1.1.1.1.1',
      '2.1.2.1.2',
      '1.1.1.1.1',
    ],
  },
  {
    index: 12, scene: 'sky-blue', cols: 10, newElement: '终局大阵（全特性叠加）',
    name: { en: 'Final Blaze', zh: '终窑' },
    startBalls: 2,
    moveCols: [0, 3, 6, 9],
    pattern: [
      '1b1g1.1g1b',
      '333.33.333',
      '1g1.1b1.1g',
      '.333.33.3.',
    ],
  },
];

export const LEVEL_COUNT = LEVELS.length;
