// 全局数值与配置
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  FLOOR_Y: 664,       // 地面反弹线（球落在它之上弹起）
  TOP_Y: 74,          // 顶部回收线（球越过它 = 被接住，回收一发射）
  WALL_L: 18,         // 左墙
  WALL_R: 1262,       // 右墙
  LAUNCH_X: 640,      // 发射口 x（= 第 3 列中心）
  LAUNCH_Y: 596,      // 发射口 y
  BALL_R: 12,         // 球半径
  BRICK_R: 40,        // 砖块碰撞圆半径
  GRID_COLS: 7,
  GRID_COL_X: [130, 300, 470, 640, 810, 980, 1150],
  GRID_ROW_Y: [140, 226, 312, 398, 484],
};

export const STEP = 1 / 60;

export const GAME = {
  gravity: 900,           // 重力加速度（px/s^2，向下）
  shootSpeed: 1400,       // 发球初速
  floorBounceVy: 1080,    // 撞地后强制向上的速度（保证总能爬回顶部）
  wallRestitution: 0.96,  // 撞地后的横向衰减
  minSpeed: 560,          // 球的最小维持速度
  maxAngle: 1.45,         // 发射角上限（弧度，约 83°，正 = 右）
  autoLaunchDelay: 10,    // 空闲多久后自动直线发射（兜底，防死局 / noinput 必输）
  maxFlightTime: 12,      // 单球最长飞行时间，超时强制回收
  comboMilestones: [3, 6, 9, 12],
  levelAdvanceDelay: 0.8, // 过关后短暂停留
};

export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'spider-ball-web-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'spider-ball-web-save',
};
