// ENDLESS ORB · 玩法数值配置（全部数值常量都在这，逻辑不写死数字）。
// 契约：docs/endless-orb/analysis.md 的「模块 API / 事件名」一字不差。

// ---- 世界 / 坐标 ----
export const WORLD = {
  WIDTH: 1280, // 逻辑世界宽（px）
  HEIGHT: 720, // 逻辑世界高（px）
  CORE_X: 640, // 单核默认圆心 x
  CORE_Y: 320, // 单核默认圆心 y
  LAUNCH_X: 640, // 发射口 x（固定，光子直线向上）
  LAUNCH_Y: 680, // 发射口 y
  PHOTON_START_Y: 668, // 光子出生点 y
};

export const STEP = 1 / 60; // 固定步长（秒）

// ---- 能量核 ----
export const CORE = {
  R: 165, // 单核半径（px）
  TARGET_BASE: 8, // 每环目标钉数 = TARGET_BASE + ring*TARGET_STEP
  TARGET_STEP: 2,
  TARGET_CAP: 30,
};

// ---- 双核（互绕） ----
export const TWIN = {
  R: 95, // 双核各自半径
  ORBIT_R: 60, // 绕公共圆心半径
  ORBIT_OMEGA: 0.9, // 公转角速度（rad/s）
};

// ---- 光子 ----
export const PHOTON = {
  R: 14, // 普通光子半径
  HEAVY_R: 26, // 重光子半径（2 倍占位）
  SPEED: 560, // 飞行速度 px/s（向上）
  OVERLOAD_EVERY: 20, // 每 20 钉出现一颗重光子
  NEAR_MISS_GAP: 1.6, // 擦肩判定：与已钉光子角距 < slotHalf*该系数 且未碰撞
};

// ---- 极性反转 ----
export const POLARITY = {
  ENABLE_RING: 5, // 从第 5 环起启用
  BASE_INTERVAL: 11, // 基础间隔（秒）
  PER_RING: 0.55, // 每环缩短间隔（秒），随环数递减
  MIN_INTERVAL: 5, // 最短间隔
  SUCK_COUNT: 1, // 每次吸入已钉光子数
};

// ---- 计分 ----
export const SCORE = {
  PIN: 10, // 每钉一颗 = PIN * ring
  HEAVY_PIN: 30, // 重光子 = HEAVY_PIN * ring
  RING_CLEAR: 50, // 清环奖励 = RING_CLEAR * ring
  NEAR_MISS: 4, // 擦肩加分（不减命）
};

// ---- 连击（连续 clean pin） ----
export const COMBO = {
  NEAR_MISS_BREAK: true, // 擦肩不清连击（擦肩仍是 clean 的代价提醒，但不中断）
};

// ---- 角距工具 ----
// 光子半径 pr 在半径 coreR 圆上占据的半角（rad）。
export function slotHalf(pr, coreR) {
  const k = Math.max(1e-3, Math.min(0.999, pr / coreR));
  return Math.asin(k);
}

// 归一化角差（-π, π]
export function angDist(a, b) {
  let d = (a - b) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

// 归一化角到 [0, 2π)
export function normAngle(a) {
  let x = a % (2 * Math.PI);
  if (x < 0) x += 2 * Math.PI;
  return x;
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
