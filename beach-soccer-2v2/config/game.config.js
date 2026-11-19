// BEACH SOCCER 2V2 · 全局数值配置（世界坐标 y-up，原点居中，1280×720 舞台）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  GROUND_Y: -320,      // 沙面（球静止时接触的 y）
  BALL_R: 24,
};

export const STEP = 1 / 60;

// 物理（确定性，固定步长积分）
export const PHYS = {
  GRAVITY: 900,        // px/s^2
  RESTITUTION: 0.70,   // 墙面/地面反弹系数
  AIR_DRAG: 0.9992,    // 每帧速度阻尼（空气）
  ROLL_DRAG: 0.985,    // 贴地滚动摩擦（每帧）
  SETTLE_SPEED: 42,    // 低于此速度视为将停
  SETTLE_FRAMES: 22,   // 连续低于 SETTLE_SPEED 这么多帧 → 停球
  MAX_FLIGHT: 9.0,     // 单次飞行硬上限（秒），超时强制停球
  MAX_SPEED: 1700,     // 球速上限
  BOUNCE_BOOST: 1.42,  // 弹力垫对球速的放大
};

// 玩家输入 → 发射速度
export const KICK = {
  SCALE: 8,            // 拖拽像素 × 8 = 发射速度 px/s
  MEGA_SCALE: 2,       // 能量球加持：下一次踢球力度 ×2
  GRAB_RADIUS: 46,     // 允许从球附近开始拖拽的半径（世界单位）
};

export const RULES = {
  COMBO_WINDOW: 3.0,   // 连续吃星判定窗口（秒）
  TIME_STARS: [        // 完赛时间 → 时间星
    { max: 10, stars: 3 },
    { max: 20, stars: 2 },
    { max: 30, stars: 1 },
  ],
  STAR_SCORE: 250,     // 每颗星基础分（时间星同）
};

export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'beach-soccer-2v2-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'beach-soccer-2v2-save',
};
