// ABC POP · 玩法数值配置（全部数值常量都在这，逻辑不写死数字）。
// 契约：字母数据见 config/levels.js；事件名与 sim.js 一字不差。

// ---- 世界 / 布局 ----
export const PLAY = {
  TOP: 104,        // 泡泡活动区上边界（HUD 之下）
  BOTTOM: 720,     // 泡泡活动区下边界
};

// ---- 泡泡 ----
export const BUBBLE = {
  COUNT: 6,        // 场景中同时漂浮的泡泡数
  R_MIN: 40,       // 半径范围（px）
  R_MAX: 52,
  RISE_MIN: -14,   // 上升速度范围（px/s，负 = 向上）
  RISE_MAX: -6,
  TAP_SLACK: 14,   // 点击判定松弛（px，超出半径仍算点中，触屏友好）
  SHAKE_SEC: 0.45, // 点错抖动时长
};

// ---- 难度曲线（随 levelIndex = letterIndex*3 + round 递增）----
export const DIFF = {
  DISTRACT_BASE: 4,   // 基础干扰字母数（正确数 + 干扰数 = 场景泡泡总数）
  DISTRACT_MAX: 5,
  DISTRACT_STEP: 6,   // 每 6 级 +1 干扰
  WIND_BASE: 22,      // 基础风速（px/s）
  WIND_PER_LEVEL: 1.1,
  WIND_MAX: 120,
  SWAY_BASE: 16,      // 基础横向摆动幅度（px/s）
  SWAY_PER_LEVEL: 1.6,
  SWAY_MAX: 110,      // 后期泡泡交叉换位的摆动上限
  MIXED_CASE_FROM: 9, // 从这个 level 起干扰字母允许出现小写（大小写混淆）
};

// ---- 计分 / 连击 ----
export const SCORE = {
  CORRECT: 10,       // 单次正确得分
  BRIDGE_BONUS: 50,  // 连续 5 对触发彩虹桥额外加分
};

export const BRIDGE = {
  STREAK: 5,         // 连续 5 对触发彩虹字母桥
};

// ---- 轮次 ----
export const ROUND = {
  COUNT_PER_LETTER: 3, // 每字母 3 轮：认读 / 大小写 / 首字母词
  GOAL: 2,            // 认读轮与首词轮需点中的次数（大小写轮需两形态各一次）
};

// ---- 里程碑事件（压事件密度，控制死时间）----
export const DRIFT = {
  TICKS: 1,           // 每 tick 发一次 drift 心跳事件（泡泡持续漂移 = 可感知变化，不算空转）
};

// ---- 杂项纯函数 ----
export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
