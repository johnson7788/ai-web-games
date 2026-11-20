// HELIX ORBIT · M1 数值配置（全部数值常量都在这，逻辑不写死数字）
// 契约：docs/report.md（事件名 / 字段一字不差）

// ---- 世界 / 坐标（渲染用，逻辑用「层单位」）----
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  TOWER_X: 640,
  BALL_Y: 468,
  RING_RX: 424,
  RING_RY: 122,
  LAYER_GAP: 60,
};

export const STEP = 1 / 60; // 固定步长（秒）

// ---- 球（下落/弹跳，单位：层/s）----
export const BALL = {
  GRAVITY: 10,       // 层/s²
  BOUNCE_VEL: 4.8,   // 弹跳初速（层/s，向上）
  MAX_FALL: 2.0,     // 最大下落速度（控制每层至少 ~0.5s，给旋转留时间）
  START_Y: -0.35,    // 开局球在层 0 上方 0.35 层
};

// ---- 旋转 ----
export const ROT = {
  SPEED: 3.4,        // 满输入旋转速度（rad/s）
  REVERSE_SPEED: 2.0, // 反向层自旋速度（rad/s）
};

// ---- 层结构 ----
export const TOWER = {
  SLOTS: 8,          // 每层分 8 槽
  CRYSTAL_CHANCE: 0.55, // 每层出现冰晶的概率
  CREVICE_EVERY: 5,  // 每 5 层一条岩芯裂隙（窄缝 + 双倍分）
  DEADLOCK_MAX: 3,   // 同一层连弹次数 ≥3 判负（卡死）
};

// ---- 陨石态（连穿 3 层进入）----
export const METEOR = {
  STREAK: 3,         // 连续穿落多少层进入陨石态
  SLOWMO_SEC: 0.55,  // 砸穿岩浆的慢镜时长（渲染/时间缩放）
};

// ---- 冰晶冻结 ----
export const FREEZE = {
  NEED: 4,           // 攒满 4 冰晶触发冻结
  SEC: 5,            // 冻结 5s，岩浆变安全
};

// ---- 计分 ----
export const SCORE = {
  PASS: 1,           // 穿落一层基础分
  CREVICE_MULT: 2,   // 岩芯裂隙双倍分
  METEOR_SMASH: 8,   // 陨石态砸穿岩浆奖励分
  MILESTONE_EVERY: 5, // 每 5 层发里程碑事件
};

// ---- 事件节流 ----
export const NEAR_MISS = {
  GAP: 0.16,         // 层角距离 <0.16 rad 且未落在缺口上 = 擦肩（nearMiss）
  THROTTLE: 1.2,     // 节流 1.2s
};

// ============================================================
// 纯函数（无副作用，供 sim/selfplay 复用；数字全部来自常量）
// ============================================================

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/** 归一化到 [0, 2π) */
export function normAngle(a) {
  const t = a % (2 * Math.PI);
  return t < 0 ? t + 2 * Math.PI : t;
}

/** 有符号最短角差（-π, π]：从 from 到 to 需要加多少 */
export function signedAngle(from, to) {
  let d = normAngle(to) - normAngle(from);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d <= -Math.PI) d += 2 * Math.PI;
  return d;
}

/** 无符号最短角距离 */
export function angleDist(a, b) {
  return Math.abs(signedAngle(a, b));
}

/** φ（已归一化）是否落在某条 [a0,a1] 弧内（含边界），返回该弧或 null */
export function angleInArcs(phi, arcs) {
  for (const arc of arcs) {
    if (phi >= arc.a0 && phi <= arc.a1) return arc;
  }
  return null;
}
