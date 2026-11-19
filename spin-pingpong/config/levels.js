// 关卡表：grid 为内部格边长（棋盘实际 size = grid+2，含一圈出口门），
// pad 为反弹棱镜数量，duration 为整关时间上限，memorizeSec 为记忆窗口，
// voidCount 为干扰黑洞数量。
// 生成器逐关可解（回溯放置棱镜，路径不交叉、直达出口）。
export const LEVELS = [
  { grid: 2, pad: 1,  duration: 20, memorizeSec: 1.4, voidCount: 0 },
  { grid: 2, pad: 2,  duration: 20, memorizeSec: 1.3, voidCount: 0 },
  { grid: 3, pad: 3,  duration: 25, memorizeSec: 1.2, voidCount: 0 },
  { grid: 3, pad: 4,  duration: 25, memorizeSec: 1.2, voidCount: 0 },
  { grid: 3, pad: 5,  duration: 30, memorizeSec: 1.1, voidCount: 0 },
  { grid: 4, pad: 6,  duration: 30, memorizeSec: 1.1, voidCount: 0 },
  { grid: 4, pad: 7,  duration: 35, memorizeSec: 1.0, voidCount: 1 },
  { grid: 4, pad: 8,  duration: 35, memorizeSec: 1.0, voidCount: 2 },
  { grid: 4, pad: 9,  duration: 40, memorizeSec: 0.9, voidCount: 2 },
  { grid: 5, pad: 10, duration: 40, memorizeSec: 0.9, voidCount: 3 },
  { grid: 5, pad: 11, duration: 45, memorizeSec: 0.8, voidCount: 3 },
  { grid: 5, pad: 12, duration: 45, memorizeSec: 0.8, voidCount: 4 },
];

export const LEVEL_COUNT = LEVELS.length;
