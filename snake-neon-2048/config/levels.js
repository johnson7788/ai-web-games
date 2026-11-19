// 关卡定义：12 列 × 13 行，0 = 可通行，1 = 能量墙。
// 三关全为原创霓虹电路主题（不复刻参考源码的美术/地图）。
// 蛇初始方向由 head 指向 neck 推导（snake.dir 直接给出，与 parts 一致）。

const open = (n) => Array.from({ length: n }, () => 0);

export const LEVELS = [
  // L1 · Neon Grid：无墙开放式网格，教转向与吃核心
  {
    name: { en: 'Neon Grid', zh: '霓虹网格' },
    scene: 'neon-grid',
    cols: 12,
    rows: 13,
    tiles: [
      open(12), open(12), open(12), open(12), open(12), open(12),
      open(12), open(12), open(12), open(12), open(12), open(12), open(12),
    ],
    snake: {
      parts: [
        { x: 9, y: 6 }, { x: 8, y: 6 }, { x: 7, y: 6 }, { x: 6, y: 6 },
      ],
      dir: { x: -1, y: 0 },
    },
    speed: { initial: 0.3, accelerateMultiplier: 0.9, accelerateEvery: 2, minimum: 0.12 },
    target: 5,
    goldenEvery: 5,
  },
  // L2 · Circuit Maze：稀疏电路柱墙 + 黄金核心
  {
    name: { en: 'Circuit Maze', zh: '电路迷宫' },
    scene: 'circuit-maze',
    cols: 12,
    rows: 13,
    tiles: [
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ],
    snake: {
      parts: [
        { x: 10, y: 12 }, { x: 9, y: 12 }, { x: 8, y: 12 }, { x: 7, y: 12 },
      ],
      dir: { x: -1, y: 0 },
    },
    speed: { initial: 0.28, accelerateMultiplier: 0.9, accelerateEvery: 3, minimum: 0.11 },
    target: 8,
    goldenEvery: 5,
  },
  // L3 · Synth Spiral：更多电路柱墙 + 更快节奏 + 更高目标
  {
    name: { en: 'Synth Spiral', zh: '合成螺旋' },
    scene: 'synth-spiral',
    cols: 12,
    rows: 13,
    tiles: [
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
      [0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0],
      [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ],
    snake: {
      parts: [
        { x: 9, y: 12 }, { x: 8, y: 12 }, { x: 7, y: 12 }, { x: 6, y: 12 },
      ],
      dir: { x: -1, y: 0 },
    },
    speed: { initial: 0.24, accelerateMultiplier: 0.9, accelerateEvery: 3, minimum: 0.1 },
    target: 12,
    goldenEvery: 4,
  },
];

export const LEVEL_COUNT = LEVELS.length;
