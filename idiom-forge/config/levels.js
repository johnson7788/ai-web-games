// config/levels.js — 12 关推进结构
// 每关：题量 / 计时收紧 / 缺字数 1→2 / 字格干扰项 8→14 / 场景包（0 铁匠铺 / 1 书院 / 2 天工阁）
// 场景包三章循环：1-6 铁匠铺、7-9 书院、10-12 天工阁（每章换色板 + 构图 + 装饰）
export const LEVELS = [
  { index: 1,  questions: 8,  time: 60, blanks: 1, gridSize: 8,  scene: 0 },
  { index: 2,  questions: 8,  time: 55, blanks: 1, gridSize: 8,  scene: 0 },
  { index: 3,  questions: 9,  time: 55, blanks: 1, gridSize: 9,  scene: 0 },
  { index: 4,  questions: 9,  time: 50, blanks: 1, gridSize: 9,  scene: 0 },
  { index: 5,  questions: 10, time: 50, blanks: 2, gridSize: 10, scene: 0 },
  { index: 6,  questions: 10, time: 45, blanks: 2, gridSize: 10, scene: 0 },
  { index: 7,  questions: 10, time: 45, blanks: 1, gridSize: 11, scene: 1 },
  { index: 8,  questions: 11, time: 42, blanks: 1, gridSize: 11, scene: 1 },
  { index: 9,  questions: 11, time: 42, blanks: 2, gridSize: 12, scene: 1 },
  { index: 10, questions: 12, time: 40, blanks: 2, gridSize: 14, scene: 2 },
  { index: 11, questions: 12, time: 38, blanks: 2, gridSize: 14, scene: 2 },
  { index: 12, questions: 12, time: 36, blanks: 2, gridSize: 14, scene: 2 },
];

export const LEVEL_COUNT = LEVELS.length;

export function levelAt(index) {
  return LEVELS[Math.max(0, Math.min(LEVELS.length - 1, index - 1))];
}
