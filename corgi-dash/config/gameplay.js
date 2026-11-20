// CORGI DASH · 玩法数值配置（全部数值常量都在这，逻辑不写死数字）
// 契约：docs/README.md（事件名/字段一字不差）

// ---- 世界 / 坐标 ----
export const WORLD = {
  WIDTH: 1280,        // 逻辑世界宽（px）
  HEIGHT: 720,        // 逻辑世界高（px）
  GROUND_Y: 560,      // 地面 y（px）
  PLAYER_X: 300,      // 柯基固定屏幕 x（世界左滚）
  PX_PER_METER: 16,   // 距离（米）= 累计滚动像素 / 16
};

export const STEP = 1 / 60; // 固定步长（秒）

// ---- 柯基（碰撞盒 + 跳跃） ----
export const PLAYER = {
  W: 56,              // 碰撞盒宽（px）
  H: 44,              // 碰撞盒高（px）
  COYOTE: 0.10,       // coyote time（离地后可补跳的宽限，秒）
  JUMP_BUFFER: 0.12,  // 落地前缓冲（提前按跳，落地即跳，秒）
  GRAVITY: 2400,      // 常规重力（px/s²）
  HOLD_GRAVITY: 1400, // 按住跳跃键时的重力（变高跳）
  JUMP_VELOCITY: -780, // 起跳初速（px/s）
  DOUBLE_JUMP_VELOCITY: -720, // 二段跳初速
  MAX_FALL: 1500,     // 最大下落速度
};

// ---- 速度（距离越远越快） ----
export const SPEED = {
  BASE: 320,      // 初始滚动速度（px/s）
  ACCEL: 2.2,     // 每秒加速（px/s²）
  MAX: 620,       // 速度上限
};

// ---- 计分 ----
export const SCORE = {
  PER_METER: 1,           // 每米基础分
  FLOCK_MULT_PER: 0.12,   // 每只羊 +12% 分数倍率
  SHEEP_PICKUP: 50,       // 拾取一只羊 +50 分
  PERFECT_BONUS: 30,      // 完美落点 +30 分
  SHEEP_LOSS_PENALTY: 20, // 每损失一只羊扣 20 分
};

// ---- 羊群 ----
export const FLOCK = {
  MAX: 30,        // 羊群上限
  LOSS_RATIO: 0.5, // 撞障碍损失比例（ceil(flock*0.5)，至少 1）
  TRAIL_GAP: 34,  // 羊链间距（px，渲染/轨迹采样）
};

// ---- 口哨 ----
export const WHISTLE = {
  COOLDOWN: 8.0,   // 冷却 8s
  SCATTER: 1.5,    // 散开持续 1.5s（期间撞障碍不死羊）
};

// ---- 完美跳 / 牧羊冲鸭 ----
export const PERFECT = {
  CLEARANCE: 10,   // 越过障碍时脚底与障碍顶的垂直间距 ≤10px 记完美
  SURGE_STREAK: 2, // 连续 2 次完美跳触发牧羊冲鸭
  SURGE_BONUS_PER_SHEEP: 20, // 冲鸭奖励 = 羊数 × 20
};

// ---- 碰撞 / 无敌 ----
export const HIT = {
  INVULN: 1.4,     // 撞障碍后无敌（秒），防止连续帧重复扣羊
};

// ---- nearMiss ----
export const NEAR_MISS = {
  RANGE: 34,       // 越过障碍时脚底间距在 (PERFECT.CLEARANCE, RANGE] 内算擦肩
  THROTTLE: 1.5,   // 擦肩事件节流（秒）
};

// ---- 生成 ----
export const SPAWN = {
  LOOKAHEAD: 1500,   // 前方预生成距离（px）
  FIRST_OBSTACLE_X: 700, // 第一个障碍世界 x（必须早于第一只羊，保证 noinput 无羊撞死）
  SHEEP_GAP_MIN: 260, // 羊拾取物间距范围（px）
  SHEEP_GAP_MAX: 420,
  FIRST_SHEEP_X: 900, // 第一只羊出现位置（世界 x）
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

// 速度：BASE + ACCEL*time，封顶 MAX
export function speedAt(time) {
  return clamp(SPEED.BASE + SPEED.ACCEL * time, SPEED.BASE, SPEED.MAX);
}

// 分数倍率：1 + flock*0.12
export function scoreMult(flock) {
  return 1 + SCORE.FLOCK_MULT_PER * Math.max(0, flock);
}

// 撞障碍损失的羊数（至少 1，封顶当前羊数）
export function sheepLossFor(flock) {
  if (flock <= 0) return 0;
  return clamp(Math.ceil(flock * FLOCK.LOSS_RATIO), 1, flock);
}
