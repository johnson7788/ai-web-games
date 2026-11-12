import { TILE, WORLD } from './game.config.js';

// 乌龟布局（经典 144 张、5 层）。
// 坐标用「半张牌栅格」：x 步长 30px、y 步长 40px；牌占 2×2 格（60×80px）。
// 每层一行是一个 [y, [x0, x1, ...]]：x 为牌左缘的格子坐标，同层相邻牌间距 2 格（刚好相接）。
// 更高层逐层上移 1 格（40px）形成半张牌的交叠，x 保持对齐、居中对称。
const ROWS = [
  // 层 0：乌龟轮廓（头、前腿、肩、壳、后腿、尾）—— 56 张
  [
    [0, [-1, 0]],
    [1, [-8, -7, -1, 0, 6, 7]],
    [2, [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4]],
    [3, [-8, -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7]],
    [4, [-8, -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7]],
    [5, [-8, -7, -1, 0, 6, 7]],
  ],
  // 层 1：壳丘 —— 42 张
  [
    [1, [-1, 0]],
    [2, [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4]],
    [3, [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4]],
    [4, [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4]],
    [5, [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4]],
  ],
  // 层 2 —— 26 张
  [
    [2, [-4, -3, -2, -1, 0, 1, 2, 3]],
    [3, [-4, -3, -2, -1, 0, 1, 2, 3]],
    [4, [-4, -3, -2, -1, 0, 1, 2, 3]],
    [5, [-1, 0]],
  ],
  // 层 3 —— 14 张
  [
    [2, [-3, -2, -1, 0, 1, 2]],
    [3, [-3, -2, -1, 0, 1, 2]],
    [4, [-1, 0]],
  ],
  // 层 4 —— 6 张
  [
    [2, [-2, -1, 0, 1]],
    [3, [-1, 0]],
  ],
];

export function createSlots() {
  const slots = [];
  ROWS.forEach((rows, layer) => {
    for (const [gy, xs] of rows) {
      for (const gx of xs) {
        slots.push({ x: gx * 2, y: gy * 2 - layer, layer });
      }
    }
  });
  return slots;
}

// 居中偏移（像素）：把布局整体挪到 1280×720 正中，渲染时用
export function layoutOffset() {
  const slots = createSlots();
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const s of slots) {
    minX = Math.min(minX, s.x * TILE.STEP_X);
    maxX = Math.max(maxX, (s.x + 2) * TILE.STEP_X);
    minY = Math.min(minY, s.y * TILE.STEP_Y);
    maxY = Math.max(maxY, (s.y + 2) * TILE.STEP_Y);
  }
  return {
    x: Math.round((WORLD.WIDTH - (maxX - minX)) / 2 - minX),
    y: Math.round((WORLD.HEIGHT - (maxY - minY)) / 2 - minY),
  };
}
