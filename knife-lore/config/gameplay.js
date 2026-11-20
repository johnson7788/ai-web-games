// KNIFE LORE · 玩法数值配置（全部数值常量都在这，逻辑不写死数字）
// 契约：docs/knife-lore/README.md（事件名/字段一字不差）

export const STEP = 1 / 60; // 固定步长（秒）

// ---- 世界 / 坐标 ----
export const WORLD = {
  WIDTH: 1280, // 逻辑世界宽（px）
  HEIGHT: 720, // 逻辑世界高（px）
};

// ---- 桩（卷轴桩） ----
export const POST = {
  SINGLE_X: 640, // 单桩中心 x
  SINGLE_Y: 360, // 单桩中心 y
  SINGLE_R: 150, // 单桩半径
  DUAL_X: [360, 920], // 双桩两中心 x
  DUAL_Y: 360,
  DUAL_R: 110, // 双桩半径
  MOVE_AMP: 150, // 移动桩水平振幅
  MOVE_PERIOD: 4, // 移动桩往返周期（秒）
};

// ---- 掷刀 ----
export const KNIFE = {
  FLIGHT_SEC: 0.28, // 飞行时间（秒）：决定提前量手感
  GAP_DEG: 14, // 每把刀占据的角度宽度（碰撞判定）
  IMPACT_DEG: 180, // 命中角：刀从下方飞入，总是插在桩底（0=上，顺时针）
  SCORE: 10, // 每插一刀得分
  SYM_DEG: 15, // 对称加成容差（±度）
  SYM_BONUS: 30, // 对称加成额外分
  SPAWN_OFFSET: 60, // 飞刀出生点到桩表面距离（px）
};

// ---- 斩铁（每 3 关解锁 1 次必中安全角度提示） ----
export const ZANTIE = {
  EVERY: 3, // 每 3 关解锁 1 次
};

// ---- 事件密度：桩每转多少度发一个 sweep 里程碑（保遥测事件密度） ----
export const SWEEP_DEG = 30;

// ---- 角度工具（0=上，顺时针，度） ----
export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// 角度归一化到 (-180, 180]
export function normalizeDeg(a) {
  let x = a % 360;
  if (x > 180) x -= 360;
  else if (x <= -180) x += 360;
  return x;
}

// 两角度最小夹角（0..180，度）
export function angDist(a, b) {
  return Math.abs(normalizeDeg(a - b));
}

// 两角度差的带符号值（-180..180，度）
export function angSignedDiff(a, b) {
  return normalizeDeg(a - b);
}
