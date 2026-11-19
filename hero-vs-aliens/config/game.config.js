// 全局数值配置（纯逻辑 sim 与渲染共用）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 英雄 / 发射 / 跳跃数值（单位为像素级世界坐标）
export const HERO = {
  START_X: 640,
  MIN_X: 60,
  MAX_X: 1220,
  E0: 100,             // 初始弹力
  EMIN: 18,            // 弹力低于此 → 失败（外星入侵得逞）
  DECAY: 0.05,         // 每次落地弹力衰减比例
  LAUNCH_SPEED: 400,   // 视觉/节奏用：决定单跳时长与抛物线高度
  GRAVITY: 500,
  CLIMB_PER_E: 2.4,    // 每跳爬升高度 = 弹力 * 该系数
  STEER_RANGE: 130,    // 空中转向的水平幅度（px）
  STEER_CLIMB_COST: 0.12, // 转向越大，爬升损失越多（动词代价）
  BASE_RADIUS: 46,     // 软落地碾压半径
  DROP_RADIUS: 92,     // 主动下落攻击碾压半径
  WALL_DAMP: 0.9,      // 撞墙反弹角度衰减
  PERFECT_E_BONUS: 1.05,
  DROP_RADIUS_E: 0.4,  // 下落攻击半径随弹力放大
};

export const AIM = {
  ROTATE_DEG: 30,
  SHOT_VALUE: [4, 11, 21, 30],   // 完美/很好/普通/糟糕 的 |角度| 分档
  AUTO_LAUNCH_SEC: 8,            // 发射类兜底：超时自动发射
  AUTO_THETA: 16,
  OSC_SPEED: 1.8,                // 箭头摆动角速度
};

export const MAP = {
  ROW_H: 90,
  LANES: [120, 300, 480, 640, 800, 980, 1160],
  CENTER: 640,
  SIDE_LANES: [120, 300, 480, 800, 980, 1160],
  HAZARD_LANES: [120, 300, 980, 1160],
  HAZARD_RADIUS: 44,
  SPRING_RADIUS: 52,
  ELEMENT_RADIUS: 24,
};

export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'hero-vs-aliens-lang',
  langNames: { en: 'English', zh: '中文' },
  saveKey: 'hero-vs-aliens-save',
};
