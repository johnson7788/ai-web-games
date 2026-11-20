// DUNE BUGGY · 玩法数值配置（全部数值常量都在这，逻辑不写死数字）
// 契约：docs/dune-buggy/analysis.md（事件名 / 字段一字不差）

// ---- 载具 / 速度 ----
export const CAR = {
  MAX_SPEED: 34,        // 基准极速（m/s，平沙 / 中性胎压的参照值）
  ACCEL: 15,            // 满油门加速度（m/s²，按 grip 缩放）
  BRAKE: 26,            // 刹车减速度（m/s²）
  DRAG: 0.55,           // 自然阻力系数（速度越大衰减越明显）
  REVERSE_MAX: 6,       // 允许的最小速度（不允许倒车）
  STEER_RATE: 2.7,      // 满速转向时横向移动速率（playerX 单位/秒）
  CENTRIFUGAL: 0.62,    // 弯道离心外抛系数
  OFFTRACK_X: 1.16,     // 超过此横向值视为冲出赛道
  OFFTRACK_DRAG: 2.4,   // 冲出赛道额外阻力
  RIDGE_HALF: 0.26,     // 沙脊半宽（playerX 单位，中心线）
  RIDGE_BOOST: 1.26,    // 骑脊时的极速倍率（+持续加速）
  RIDGE_ACCEL: 5,       // 骑脊额外加速度（m/s²）
  STORM_SPEED_PENALTY: 0.14, // 沙暴使极速与抓地下降的比例
};

// ---- 胎压（进站式取舍） ----
export const PRESSURE = {
  high: { maxSpeedMult: 1.16, gripMult: 0.74, label: 'pressure.high' }, // 快，但沙地打滑
  low:  { maxSpeedMult: 0.80, gripMult: 1.26, label: 'pressure.low'  }, // 稳，但慢
};
export const DEFAULT_PRESSURE = 'high';

// ---- 地形（抓地 / 极速修正） ----
export const TERRAIN = {
  sand:  { grip: 1.00, maxSpeedMult: 1.00 },
  rock:  { grip: 0.58, maxSpeedMult: 0.72 }, // 岩区：糙、慢
  ridge: { grip: 0.90, maxSpeedMult: 1.00 }, // 沙脊覆盖段（骑脊另有加速）
  jump:  { grip: 1.00, maxSpeedMult: 1.00 }, // 绿洲跳台
  oasis: { grip: 0.86, maxSpeedMult: 0.94 }, // 绿洲软地
};

// ---- 跳台 ----
export const JUMP = {
  DURATION: 0.85,     // 腾空时长（s）
  LAND_GRACE: 0.5,    // 落地后 0.5s 不重复触发跳台
};

// ---- 赛段推进 / 判定 ----
export const STAGE = {
  SEG_LEN: 6,          // 每段长度（m）
  DNF_GRACE: 12,       // 超过 parSec 后再给 12s，仍到不了终点即 DNF
  CHECKPOINT_EVERY: 90, // 每 90m 一个检查点
};

// ---- 反馈节奏（保证事件密度，maxEventGap ≤3s） ----
export const FEEDBACK = {
  MILESTONE_EVERY: 20, // 每 20m 一个 speedMilestone
  RIDGE_THROTTLE: 0.6, // 骑脊反馈节流（s）
  OFFTRACK_THROTTLE: 1.0,
  NEARMISS_THROTTLE: 1.6,
  NEARMISS_BAND: [0.92, 1.16], // 贴边但未冲出即 nearMiss（playerX 绝对值范围）
};

// ---- 评级 ----
export const RATING = {
  gold: 1.0,    // time <= parSec * gold  → 金牌
  silver: 1.22, // <= parSec * silver       → 银牌
  bronze: 1.5,  // <= parSec * bronze       → 铜牌
};

// ============================================================
// 纯函数（无副作用，供 sim/selfplay 复用；数字全部来自上面的常量）
// ============================================================

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// 给定胎压与地形，返回有效 grip 与极速倍率（storm ∈ 0..1 由赛段提供）
export function effectiveGrip(pressure, terrain, storm = 0) {
  const p = PRESSURE[pressure] || PRESSURE[DEFAULT_PRESSURE];
  const t = TERRAIN[terrain] || TERRAIN.sand;
  return p.gripMult * t.grip * (1 - CAR.STORM_SPEED_PENALTY * storm);
}

export function effectiveMaxSpeed(pressure, terrain, storm = 0) {
  const p = PRESSURE[pressure] || PRESSURE[DEFAULT_PRESSURE];
  const t = TERRAIN[terrain] || TERRAIN.sand;
  return CAR.MAX_SPEED * p.maxSpeedMult * t.maxSpeedMult * (1 - CAR.STORM_SPEED_PENALTY * storm);
}

// 完赛评级：'gold' | 'silver' | 'bronze' | 'finish'
export function ratingFor(timeSec, parSec) {
  if (timeSec <= parSec * RATING.gold) return 'gold';
  if (timeSec <= parSec * RATING.silver) return 'silver';
  if (timeSec <= parSec * RATING.bronze) return 'bronze';
  return 'finish';
}

export function ratingScore(rating) {
  return { gold: 3, silver: 2, bronze: 1, finish: 0 }[rating] || 0;
}
