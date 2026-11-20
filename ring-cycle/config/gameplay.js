// config/gameplay.js — RING CYCLE · M1 数值配置（全部数值常量都在这，逻辑不写死数字）
// 契约：docs/analysis.md（事件名 / 接口签名一字不差）

// ---- 糖球 ----
export const BALL = {
  R: 16,          // 糖球半径（px）
  START_X: 640,   // 开局中心 x
};

// ---- 下落 / 滚动 ----
export const SCROLL = {
  BASE: 300,      // 基础下落速度（px/s，各带覆盖）
  MAX: 460,       // 下落速度上限（px/s）
};

// ---- 彩环（每带覆盖 cells/targetCells/gap/white/wood/moving/swap） ----
export const RING = {
  CELLS: 6,           // 默认每环格数
  TARGET_CELLS: 2,    // 默认每环同色目标格数（安全落点）
  GAP: 520,           // 默认相邻环垂直间距（px）
  LOOKAHEAD: 1050,    // 前方预生成距离（px）
  H: 46,              // 环（横向色条）高（px）
  WHITE_PROB: 0.20,   // 白（万能）格概率
  WOOD_PROB: 0.08,    // 木环（跳板）格概率
  MOVE_SPEED: 60,     // 移动环横移速度（px/s，滚动 marquee）
  SWAP_EVERY: 4.0,    // 变色环每 N 秒重洗一次格色
};

// ---- 颜色 ----
export const COLOR = {
  COUNT: 4,           // 染色颜色数（0..3）
  WHITE: -1,          // 白（万能安全）
  WOOD: -2,           // 木环（一次性跳板）
};

// ---- 染色 / 连击 ----
export const DYE = {
  // 每带推进时染料轮转 +1（颜色随进度轮转）；白格则随机换新色
};

export const COMBO = {
  WINDOW: 6.0,          // 6s 内未吃环则连击清零
  RAINBOW_STREAK: 5,    // 连吃 5 个同色环触发彩虹糖雨
  RAINBOW_BONUS: 3,     // 彩虹糖雨额外加分
  MULT_PER: 0.2,        // 连击分乘数 = 1 + combo*0.2
  MULT_CAP: 3.0,
};

// ---- 得分 ----
export const SCORE = {
  CLEAR: 1,             // 同色环得分
  WHITE: 1,             // 白环得分
  RAINBOW: 3,           // 彩虹糖雨奖励分
  MILESTONE_EVERY: 10,  // 每 10 环一个里程碑事件（反馈密度）
};

// ---- 带推进 ----
export const RINGS_PER_BAND = 5;   // 每 5 环推进一带（12 带）

// ---- 生成 ----
export const SPAWN = {
  FIRST: 420,       // 首个环相对球的上方偏移（px，更快见首个决定）
  LOOKAHEAD: 1050,  // 前方预生成距离（px）
};

// ---- nearMiss ----
export const NEAR_MISS = {
  GAP: 26,              // 水平擦过致命格边缘 <26px 且未撞
  THROTTLE: 2.0,        // 节流 2s 一次
};

// ---- 转向 ----
export const STEER = {
  LERP: 16,             // 缓动追踪系数（1/s）
  MAX_VX: 1300,         // 最大横移速度（px/s）
  TILT_PER_VX: 0.0004,
  MAX_TILT: 0.55,
};

// ============================================================
// 纯函数（无副作用，供 sim/spawner 复用；数字全部来自上面的常量）
// ============================================================

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function comboMult(combo) {
  return Math.min(COMBO.MULT_CAP, 1 + combo * COMBO.MULT_PER);
}

export function isDyeColor(c) {
  return typeof c === 'number' && c >= 0;
}
