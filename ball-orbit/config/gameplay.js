// BALL ORBIT · 玩法数值（全部数值常量都在这，逻辑不写死数字）
// 契约：docs/analysis.md 的映射 + 事件表（src/game/sim.js 顶部注释）

export const WORLD = { WIDTH: 1280, HEIGHT: 720 };
export const STEP = 1 / 60;

// ---- 弹弓 / 发射 ----
export const CANNON = {
  X: 640,          // 弹弓固定 x
  Y: 668,          // 弹弓视觉 y
  BALL_Y: 646,     // 待发流星排布的 y
  R: 24,           // 弹弓半径
  AIM_MAX_ANGLE: 1.15, // 最大偏角（rad，相对正上方）
};

// ---- 流星（球） ----
export const BALL = {
  R: 7,
  GRAVITY: 700,    // px/s²（够轻，流星能弹上顶墙再回落穿带）
  SPEED: 1000,     // 初速 px/s（直射可触顶墙）
  MAX_SPEED: 1800,
  WALL_REST: 1.0,  // 左右/顶墙反弹恢复系数
  SUBSTEPS: 2,     // 每逻辑帧子步数（防穿隧）
};

// ---- 陨石（数字砖） ----
export const ASTEROID = {
  W: 74,           // 单元格宽
  H: 40,           // 单元格高
  COL_GAP: 6,
  ROW_GAP: 6,
  TOP_Y: 88,       // 首行中心 y（给单行 HUD 留出清晰间距）
  DANGER_Y: 618,   // 触底判负线
  DESCEND_STEP: 46,// = H + ROW_GAP，每次下坠的行高
  MOVE_SPEED: 44,  // 移动陨石横移速度 px/s
  VALUE_MAX: 40,
};

// ---- 行星引力偏折 ----
export const PLANET = {
  R: 30,
  GM: 1500000,     // 引力强度（px³/s²）
  MAX_ACC: 2000,   // 加速度上限
  INFLUENCE: 300,  // 影响半径（超出不计算）
};

// ---- 彗星蓄力 ----
export const COMET = {
  CHARGE_PER: 50,  // 每清 50 硬度蓄一颗彗星
  IMPACT: 3,       // 彗星撞击力 ×3
  MAX: 3,          // 最多存 3 颗
};

// ---- 引力涟漪（signature） ----
export const RIPPLE = {
  SKEW: 30,        // 邻行最大横移 px
  DECAY: 0.88,     // 每帧衰减系数（向 0 收敛）
};

// ---- 发射串 ----
export const SHOT = {
  BALLS_START: 3,  // 开局每串流星数（「发射一串球」）
  STAGGER: 0.08,   // 串内相邻球间隔 s
  BALLS_MAX: 9,
};

// ---- 空闲自动下坠（无输入基线，也让 noinput 终会判负） ----
export const IDLE_DESCEND = {
  DELAY: 9.0,      // 无发射 9s 后开始
  STEP_EVERY: 4.0, // 每 4s 下坠一行
};

// ---- 波次推进 ----
export const WAVES = {
  DESCENTS_PER_WAVE: 3, // 每 3 次下坠推进一波
};

// ---- 弹射加倍带 ----
export const BOUNCE_BAND = {
  Y1: 300,         // 带上下界（世界 y）
  Y2: 440,
  MULT: 1.6,       // 球速乘数
};

// ---- 连击（同一串内连破计数，用于音高） ----
export const COMBO = {
  WINDOW: 2.0,
};

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}
