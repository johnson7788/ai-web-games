// 全局数值配置（唯一数值源：sim/render/main 都从这里读）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 语言：默认英文；zh 必做（当前只暴露 en/zh）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'draw-truck-path-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'draw-truck-path-save',
};

// 玩法规则数值（跨关公共项）
export const GAME = {
  // 世界几何（逻辑像素）
  LEDGE_X0: 90,        // 起点平台左界
  LEDGE_X1: 300,       // 起点平台右界
  LEDGE_Y: 470,        // 平台顶面 y（卡车底部停靠）
  GOAL_X0: 980,        // 终点平台左界（胜利线）
  GOAL_X1: 1190,       // 终点平台右界
  GOAL_Y: 470,
  FIRE_Y: 600,         // 等离子火池顶面 y（低于此即烧毁）

  TRUCK_R: 18,         // 卡车碰撞半径
  TRUCK_START_X: 200,

  GRAVITY: 0.42,       // px/帧²（60fps）
  DRIVE_SPEED: 5.4,    // 目标车速 px/帧（≈324px/s）
  DRIVE_SMOOTH: 0.28,  // 车速向目标速度的收敛系数
  AIR_FRICTION: 0.995, // 空中水平减速

  BEAM_HALF_W: 16,     // 火花束半宽（危险区 x 范围）
  NEAR_R: 60,          // 近失判定半径（擦过火花束）
  PICKUP_R: 44,        // 能量核心拾取半径

  MIN_SEG: 7,          // 画线采样最小间距
  PAR_LINES: 2,        // ≤该线数获「省墨」星

  AUTO_LAUNCH_S: 2.5,  // 首笔完成后自动发车延迟
  TUTORIAL_STEPS: 3,
};
